import { createContentDb } from "./content/ContentDb";
import { FixedStepLoop } from "./core/FixedStepLoop";
import { createBabylonEngine } from "./core/EngineBootstrap";
import type { SettingsState } from "./core/types";
import { RetroRenderer } from "./render/RetroRenderer";
import { GameSimulation } from "./simulation/GameSimulation";
import { AudioSystem } from "./systems/AudioSystem";
import { InputSystem } from "./systems/InputSystem";
import { SaveStore } from "./systems/SaveStore";
import { SettingsStore } from "./systems/SettingsStore";
import { UiOverlay } from "./systems/UiOverlay";

export class GameApp {
  private readonly shell: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly settingsStore = new SettingsStore();
  private readonly saveStore = new SaveStore();
  private readonly audio = new AudioSystem();
  private readonly content = createContentDb();
  private readonly simulation = new GameSimulation(this.content);
  private readonly settings: SettingsState;
  private readonly input: InputSystem;
  private readonly ui: UiOverlay;
  private loop: FixedStepLoop | null = null;
  private renderer: RetroRenderer | null = null;
  private backend: "webgpu" | "webgl" = "webgl";
  private menuOpen = true;

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
      onResume: () => this.closeMenuAndLock(),
      onSave: () => this.saveGame(),
      onLoad: () => this.loadGame(),
      onRestart: () => this.restartGame(),
      onApplySettings: (settings) => this.applySettings(settings)
    });

    window.addEventListener("resize", this.onResize);
  }

  async start(): Promise<void> {
    const bootstrap = await createBabylonEngine(this.canvas);
    this.backend = bootstrap.backend;
    this.renderer = new RetroRenderer(bootstrap.engine, this.content);
    this.renderer.setPixelScale(this.settings.pixelScale);
    this.renderer.sync(this.simulation.state);

    this.ui.setMenuState(
      true,
      this.saveStore.hasSave(),
      "A one-level vertical slice is live: recover the ember seal, unlock the vault gate, raid the secret ossuary, and reach the exit."
    );
    this.ui.updateHud(this.simulation.state, this.backend);
    this.audio.setMasterVolume(this.settings.masterVolume);

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
    if (input.menuPressed || (!this.input.isPointerLocked() && !this.menuOpen)) {
      this.toggleMenu();
    }

    input.lookDeltaX *= this.settings.mouseSensitivity / 0.0022;

    if (!this.menuOpen) {
      const events = this.simulation.update(dt, input);
      if (events.shot) {
        this.audio.playShot(events.shot.kind);
      }
      if (events.pickup) {
        this.audio.playPickup();
      }
      if (events.damageTaken) {
        this.audio.playDamage();
      }
      if (events.doorOpened) {
        this.audio.playDoor();
      }
      if (events.secretOpened) {
        this.audio.playSecret();
      }
    }

    this.renderer.sync(this.simulation.state);
    this.ui.updateHud(this.simulation.state, this.backend);
  }

  private render(): void {
    this.renderer?.render();
  }

  private saveGame(): void {
    this.saveStore.save(this.simulation.createSaveState());
    this.ui.setMenuState(true, true, "Game saved to the local browser slot.");
  }

  private loadGame(): void {
    const save = this.saveStore.load();
    if (!save) {
      this.ui.setMenuState(true, false, "No local save exists yet.");
      return;
    }

    this.simulation.applySavedState(save.state);
    this.renderer?.sync(this.simulation.state);
    this.ui.updateHud(this.simulation.state, this.backend);
    this.ui.setMenuState(true, true, "Save loaded.");
  }

  private restartGame(): void {
    this.simulation.restart();
    this.renderer?.sync(this.simulation.state);
    this.ui.updateHud(this.simulation.state, this.backend);
    this.ui.setMenuState(true, this.saveStore.hasSave(), "The catacomb has been reset.");
  }

  private applySettings(settings: SettingsState): void {
    this.settings.masterVolume = settings.masterVolume;
    this.settings.mouseSensitivity = settings.mouseSensitivity;
    this.settings.pixelScale = settings.pixelScale;
    this.settingsStore.save(this.settings);
    this.audio.setMasterVolume(this.settings.masterVolume);
    this.renderer?.setPixelScale(this.settings.pixelScale);
  }

  private toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenuAndLock();
    } else {
      this.openMenu();
    }
  }

  private async closeMenuAndLock(): Promise<void> {
    this.menuOpen = false;
    this.ui.setMenuState(false, this.saveStore.hasSave(), "");
    await this.audio.unlock();
    this.input.requestPointerLock();
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.ui.applySettings(this.settings);
    this.ui.setMenuState(
      true,
      this.saveStore.hasSave(),
      this.simulation.state.player.alive
        ? "Resume the run, save progress, or adjust sensitivity, volume, and pixel scale."
        : "You fell in the catacomb. Restart or load the last save."
    );
  }

  private readonly onResize = (): void => {
    this.renderer?.resize();
  };
}
