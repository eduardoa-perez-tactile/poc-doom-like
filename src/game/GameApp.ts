import { createPickupHudSheetDataUrl, getPickupAtlasClip } from "./content/pickups";
import { createContentDb } from "./content/ContentDb";
import { DEFAULT_LEVEL_ID } from "./content/LevelRegistry";
import { FixedStepLoop } from "./core/FixedStepLoop";
import { createBabylonEngine } from "./core/EngineBootstrap";
import type { AppMode, HudViewModel, SettingsState } from "./core/types";
import { RetroRenderer } from "./render/RetroRenderer";
import { GameSession } from "./simulation/GameSession";
import { AudioSystem } from "./systems/AudioSystem";
import { InputSystem, type InputFrame } from "./systems/InputSystem";
import { SettingsStore } from "./systems/SettingsStore";
import { UiOverlay } from "./systems/UiOverlay";

const DEATH_TO_MENU_DELAY = 0.75;

export class GameApp {
  private readonly shell: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly settingsStore = new SettingsStore();
  private readonly audio = new AudioSystem();
  private readonly content = createContentDb(resolveRequestedLevelId());
  private readonly settings: SettingsState;
  private readonly input: InputSystem;
  private readonly ui: UiOverlay;
  private loop: FixedStepLoop | null = null;
  private renderer: RetroRenderer | null = null;
  private backend: "webgpu" | "webgl" = "webgl";
  private appMode: AppMode = "boot";
  private session: GameSession | null = null;
  private deathTimer = 0;

  constructor(parent: HTMLElement) {
    this.settings = this.settingsStore.load();
    this.shell = document.createElement("div");
    this.shell.className = "game-shell";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    this.shell.appendChild(this.canvas);
    parent.appendChild(this.shell);

    this.input = new InputSystem(this.canvas);
    this.ui = new UiOverlay(this.shell, this.settings, {
      onStartRun: () => {
        void this.startRun();
      },
      onResume: () => {
        void this.resumeGame();
      },
      onRestart: () => {
        void this.restartRun();
      },
      onMainMenu: () => this.returnToMainMenu(),
      onApplySettings: (settings) => this.applySettings(settings)
    });

    window.addEventListener("resize", this.onResize);
  }

  async start(): Promise<void> {
    const bootstrap = await createBabylonEngine(this.canvas);
    this.backend = bootstrap.backend;
    this.renderer = await RetroRenderer.create(bootstrap.engine, this.content);
    this.renderer.setPixelScale(this.settings.pixelScale);
    this.audio.setMasterVolume(this.settings.masterVolume);
    this.ui.setPickupSheetUrl(await createPickupHudSheetDataUrl());
    this.setMode("main_menu");
    this.loop = new FixedStepLoop({
      update: (dt) => this.update(dt),
      render: () => this.render()
    });
    this.loop.start();
  }

  private update(dt: number): void {
    if (!this.renderer) {
      return;
    }

    const input = this.input.sampleFrame();
    input.lookDeltaX *= this.settings.mouseSensitivity / 0.0022;

    switch (this.appMode) {
      case "main_menu":
        this.ui.updateHud(this.createEmptyHud());
        break;
      case "starting_run":
        break;
      case "in_game":
        this.updateInGame(dt, input);
        break;
      case "paused":
        this.updatePaused(input);
        break;
      case "death_transition":
        this.updateDeathTransition(dt);
        break;
      case "boot":
        break;
    }
  }

  private updateInGame(dt: number, input: InputFrame): void {
    if (!this.session || !this.renderer) {
      return;
    }

    if (input.menuPressed || this.input.consumePointerLockLost()) {
      this.pauseGame();
      return;
    }

    const canControl = this.input.isPointerLocked();
    const simInput = canControl ? input : createNeutralInput();
    const events = this.session.update(dt, simInput);
    this.renderer.sync(this.session.state, dt);
    this.ui.updateHud(
      this.createHudViewModel(
        canControl ? undefined : "Click the viewport to capture the mouse."
      )
    );

    if (events.shot) {
      this.audio.playShot(events.shot.weaponId, events.shot.powered);
    }
    if (events.pickup) {
      this.audio.playPickup();
    }
    if (events.damageTaken) {
      this.audio.playDamage();
    }
    if (events.enemyAttack) {
      this.audio.playEnemyAttack();
    }
    if (events.playerDied) {
      this.audio.playDeath();
      this.deathTimer = DEATH_TO_MENU_DELAY;
      this.input.releasePointerLock();
      this.setMode("death_transition");
    }
  }

  private updatePaused(input: InputFrame): void {
    if (input.menuPressed) {
      void this.resumeGame();
    }
    this.ui.updateHud(this.createEmptyHud());
  }

  private updateDeathTransition(dt: number): void {
    if (this.session && this.renderer) {
      this.renderer.sync(this.session.state, dt);
      this.ui.updateHud(this.createHudViewModel("You have fallen."));
    }

    this.deathTimer -= dt;
    if (this.deathTimer <= 0) {
      this.returnToMainMenu();
      this.session = null;
      this.renderer?.setAttractCamera();
    }
  }

  private render(): void {
    this.renderer?.render();
  }

  private async startRun(): Promise<void> {
    this.session = new GameSession(this.content);
    this.bindDebugHelpers();
    this.deathTimer = 0;
    if (this.renderer) {
      this.renderer.sync(this.session.state, 1 / 60);
    }
    this.setMode("starting_run");
    await this.audio.unlock();
    this.setMode("in_game");
  }

  private async restartRun(): Promise<void> {
    this.session = new GameSession(this.content);
    this.bindDebugHelpers();
    this.deathTimer = 0;
    if (this.renderer) {
      this.renderer.sync(this.session.state, 1 / 60);
    }
    await this.audio.unlock();
    this.setMode("in_game");
  }

  private async resumeGame(): Promise<void> {
    if (!this.session) {
      return;
    }

    await this.audio.unlock();
    this.setMode("in_game");
  }

  private pauseGame(): void {
    if (this.appMode !== "in_game") {
      return;
    }
    this.input.releasePointerLock();
    this.setMode("paused");
  }

  private returnToMainMenu(): void {
    this.input.releasePointerLock();
    this.setMode("main_menu");
    this.ui.updateHud(this.createEmptyHud());
  }

  private applySettings(settings: SettingsState): void {
    this.settings.masterVolume = settings.masterVolume;
    this.settings.mouseSensitivity = settings.mouseSensitivity;
    this.settings.pixelScale = settings.pixelScale;
    this.settingsStore.save(this.settings);
    this.audio.setMasterVolume(this.settings.masterVolume);
    this.renderer?.setPixelScale(this.settings.pixelScale);
  }

  private setMode(mode: AppMode): void {
    this.appMode = mode;
    this.ui.applySettings(this.settings);
    this.ui.renderMenu(mode, this.menuMessageForMode(mode));
    if (mode === "main_menu") {
      this.ui.updateHud(this.createEmptyHud());
    } else if ((mode === "in_game" || mode === "death_transition") && this.session) {
      this.ui.updateHud(this.createHudViewModel());
    }
  }

  private menuMessageForMode(mode: AppMode): string {
    switch (mode) {
      case "boot":
        return `Preparing ${this.content.level.name}.`;
      case "main_menu":
        return `Enter ${this.content.level.name}: survive the branching keep, break its seals, and reach the upper exit. Interact with E, use the selected item with R.`;
      case "paused":
        return "Resume the run, restart it, or retreat to the main menu. Options stay live here.";
      default:
        return "";
    }
  }

  private createHudViewModel(messageOverride?: string): HudViewModel {
    if (!this.session) {
      return this.createEmptyHud();
    }

    const state = this.session.state;
    const weapon = this.content.weapons.get(state.weapon.currentId);
    const enemiesRemaining = state.enemies.filter((enemy) => enemy.fsmState !== "dead").length;
    const ammo =
      weapon && weapon.ammoType !== "none"
        ? state.player.ammo[weapon.ammoType]
        : 0;

    return {
      visible: this.appMode === "in_game" || this.appMode === "death_transition",
      health: Math.ceil(state.player.health),
      armor: Math.ceil(state.player.armor),
      ammo,
      weaponName: weapon?.name ?? state.weapon.currentId,
      enemiesRemaining,
      message: messageOverride ?? state.messages[0]?.text ?? state.level.name,
      keys: state.player.keys,
      inventory: state.player.inventory.map((entry) => {
        const definition = this.content.pickupDefs.get(entry.itemDefId);
        const iconVisual =
          definition?.inventoryIconId ? this.content.pickupVisuals.get(definition.inventoryIconId) : null;
        const iconFrame = iconVisual ? getPickupAtlasClip(iconVisual.atlasId).frames[0] : null;
        return {
          defId: entry.itemDefId,
          label: definition?.id ?? entry.itemDefId,
          count: entry.count,
          iconFrame: iconFrame
            ? { x: iconFrame.x, y: iconFrame.y, width: iconFrame.w, height: iconFrame.h }
            : null
        };
      }),
      selectedInventoryIndex: state.player.selectedInventoryIndex,
      backend: this.backend
    };
  }

  private createEmptyHud(): HudViewModel {
    return {
      visible: false,
      health: 0,
      armor: 0,
      ammo: 0,
      weaponName: "",
      enemiesRemaining: 0,
      message: "",
      keys: [],
      inventory: [],
      selectedInventoryIndex: 0,
      backend: this.backend
    };
  }

  private readonly onResize = (): void => {
    this.renderer?.resize();
  };

  private bindDebugHelpers(): void {
    const debugHost = window as Window & {
      __hereticDebug?: {
        getSessionState: () => unknown;
        getLevelScriptState: () => unknown;
      };
    };
    debugHost.__hereticDebug = {
      getSessionState: () => this.session?.createSaveState() ?? null,
      getLevelScriptState: () => this.session?.getLevelScriptDebugState() ?? null
    };
  }
}

function resolveRequestedLevelId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_LEVEL_ID;
  }

  return new URLSearchParams(window.location.search).get("level") ?? DEFAULT_LEVEL_ID;
}

function createNeutralInput(): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    fireDown: false,
    interactPressed: false,
    useItemPressed: false,
    inventoryPrevPressed: false,
    inventoryNextPressed: false,
    menuPressed: false,
    toggleTome: false
  };
}
