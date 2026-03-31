import { createPickupHudSheetDataUrl, getPickupAtlasClip, pickupDefs } from "./content/pickups";
import { createContentDb } from "./content/ContentDb";
import { DEFAULT_LEVEL_ID, getRegisteredLevel, listRegisteredLevels } from "./content/LevelRegistry";
import type { ContentRuntimeTuning, EnemyRuntimeTuning, LevelDefinition, WeaponRuntimeTuning } from "./content/types";
import { FixedStepLoop } from "./core/FixedStepLoop";
import { createBabylonEngine, type EngineBootstrapResult } from "./core/EngineBootstrap";
import type { AppMode, HudViewModel, SettingsState } from "./core/types";
import { canPurchaseMetaUpgrade, listMetaUpgradeDefs, purchaseMetaUpgrade } from "./progression/MetaProgressionSystem";
import {
  BLESSINGS,
  ELITE_MODIFIERS,
  META_UPGRADES,
  NODE_TEMPLATES,
  WEAPON_INFUSIONS
} from "./progression/ProgressionContent";
import { ProgressionPersistence } from "./progression/ProgressionPersistence";
import { applyRewardChoice as applyRunRewardChoice, getRewardDef } from "./progression/RewardExecutor";
import { createRunState, getNodeTemplate, getRunNode, selectRunNode } from "./progression/RunGenerator";
import { createRewardChoices, grantNodeCurrencies } from "./progression/RewardSystem";
import { cloneLoadout, collectRunModifiers } from "./progression/RunState";
import type { MetaProgressionState, RunResultSummary, RunState } from "./progression/types";
import { RetroRenderer } from "./render/RetroRenderer";
import { GameSession, type GameSessionOptions } from "./simulation/GameSession";
import { AudioSystem } from "./systems/AudioSystem";
import { InputSystem, type InputFrame } from "./systems/InputSystem";
import { SettingsStore } from "./systems/SettingsStore";
import {
  UiOverlay,
  type HubViewModel,
  type RewardChoiceScreenViewModel,
  type RunMapViewModel,
  type RunResultViewModel
} from "./systems/UiOverlay";

const DEATH_TO_MENU_DELAY = 0.75;
const RUN_PICKUP_FILTER_IDS = pickupDefs
  .filter((definition) => definition.kind === "weapon" || definition.kind === "support")
  .map((definition) => definition.id);

interface SessionLaunchContext {
  kind: "direct_level" | "run_node";
  levelId: string;
  runtimeTuning?: ContentRuntimeTuning;
  sessionOptions?: GameSessionOptions;
  runNodeId?: string;
}

const BLESSING_NAME_BY_ID = new Map(BLESSINGS.map((definition) => [definition.id, definition.name] as const));
const INFUSION_NAME_BY_ID = new Map(WEAPON_INFUSIONS.map((definition) => [definition.id, definition.name] as const));
const ELITE_NAME_BY_ID = new Map(ELITE_MODIFIERS.map((definition) => [definition.id, definition.name] as const));
const META_NAME_BY_ID = new Map(META_UPGRADES.map((definition) => [definition.id, definition.name] as const));

export class GameApp {
  private readonly shell: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly automapCanvas: HTMLCanvasElement;
  private readonly settingsStore = new SettingsStore();
  private readonly progressionPersistence = new ProgressionPersistence();
  private readonly audio = new AudioSystem();
  private readonly availableLevels = listRegisteredLevels();
  private readonly settings: SettingsState;
  private readonly input: InputSystem;
  private readonly ui: UiOverlay;
  private content = createContentDb(resolveRequestedLevelId());
  private loop: FixedStepLoop | null = null;
  private renderer: RetroRenderer | null = null;
  private engine: EngineBootstrapResult["engine"] | null = null;
  private backend: "webgpu" | "webgl" = "webgl";
  private appMode: AppMode = "boot";
  private session: GameSession | null = null;
  private deathTimer = 0;
  private selectedLevelId = this.content.level.id;
  private metaState: MetaProgressionState;
  private activeRun: RunState | null;
  private launchContext: SessionLaunchContext | null = null;
  private runResult: RunResultSummary | null = null;
  private menuNotice = "";
  private objectivesVisible = false;

  constructor(parent: HTMLElement) {
    this.settings = this.settingsStore.load();
    const saveData = this.progressionPersistence.load();
    this.metaState = saveData.meta;
    this.activeRun = saveData.activeRun;

    this.shell = document.createElement("div");
    this.shell.className = "game-shell";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    this.automapCanvas = document.createElement("canvas");
    this.automapCanvas.className = "automap-canvas";
    this.shell.appendChild(this.canvas);
    this.shell.appendChild(this.automapCanvas);
    parent.appendChild(this.shell);

    this.input = new InputSystem(this.canvas);
    this.ui = new UiOverlay(this.shell, this.settings, {
      onStartRun: () => {
        void this.startNewRun();
      },
      onContinueRun: () => this.continueRunFromHub(),
      onLaunchSelectedLevel: () => {
        void this.startDirectLevel();
      },
      onSelectLevel: (levelId) => this.selectLevel(levelId),
      onSelectRunNode: (nodeId) => {
        void this.launchRunNode(nodeId);
      },
      onSelectRewardChoice: (choiceId) => this.applyRewardChoice(choiceId),
      onPurchaseMetaUpgrade: (upgradeId) => this.purchaseMetaUpgrade(upgradeId),
      onDismissResult: () => this.dismissRunResult(),
      onResume: () => {
        void this.resumeGame();
      },
      onRestart: () => {
        void this.restartCurrentSession();
      },
      onMainMenu: () => this.returnToMainMenu(),
      onApplySettings: (settings) => this.applySettings(settings)
    });
    this.ui.setLevelOptions(this.availableLevels, this.selectedLevelId);
    this.refreshProgressionUi();

    window.addEventListener("resize", this.onResize);
  }

  async start(): Promise<void> {
    const bootstrap = await createBabylonEngine(this.canvas);
    this.engine = bootstrap.engine;
    this.backend = bootstrap.backend;
    this.renderer = await RetroRenderer.create(bootstrap.engine, this.content, this.automapCanvas);
    this.renderer.setPixelScale(this.settings.pixelScale);
    this.renderer.setAutomapActive(false);
    this.audio.setMasterVolume(this.settings.masterVolume);
    this.ui.setPickupSheetUrl(await createPickupHudSheetDataUrl());
    this.refreshProgressionUi();
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
      case "run_map":
      case "reward_choice":
      case "run_result":
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
    const simInput = canControl ? input : createNeutralInput(input);
    const events = this.session.update(dt, simInput);
    if (input.toggleObjectives) {
      this.objectivesVisible = !this.objectivesVisible;
    }
    this.renderer.sync(this.session.state, this.session.getAutomapRenderSnapshot(), dt);
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

    if (this.session.state.levelCompleted) {
      this.handleLevelCompleted();
      return;
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
      this.renderer.sync(this.session.state, this.session.getAutomapRenderSnapshot(), dt);
      this.ui.updateHud(this.createHudViewModel("You have fallen."));
    }

    this.deathTimer -= dt;
    if (this.deathTimer > 0) {
      return;
    }

    if (this.launchContext?.kind === "run_node") {
      this.resolveRunFailure();
      return;
    }

    this.session = null;
    this.launchContext = null;
    this.renderer?.setAttractCamera();
    this.menuNotice = "You have fallen.";
    this.setMode("main_menu");
  }

  private render(): void {
    this.renderer?.render();
  }

  private async startNewRun(): Promise<void> {
    const seed = Math.floor(Date.now() % 2147483647);
    this.activeRun = createRunState(this.metaState, seed);
    this.runResult = null;
    this.menuNotice = "A new run begins in the ember crypt.";
    this.saveProgression();
    this.refreshProgressionUi();
    this.setMode("run_map");
  }

  private continueRunFromHub(): void {
    if (!this.activeRun) {
      return;
    }

    this.runResult = null;
    this.refreshProgressionUi();
    this.setMode(this.activeRun.pendingRewardChoices.length > 0 ? "reward_choice" : "run_map");
  }

  private async startDirectLevel(): Promise<void> {
    await this.startSession({
      kind: "direct_level",
      levelId: this.selectedLevelId
    });
  }

  private async launchRunNode(nodeId: string): Promise<void> {
    if (!this.activeRun) {
      return;
    }
    if (!selectRunNode(this.activeRun, nodeId)) {
      return;
    }

    const node = getRunNode(this.activeRun, nodeId);
    const template = getNodeTemplate(node.templateId);
    if (!template.levelId) {
      this.resolveInstantNode(nodeId);
      return;
    }

    await this.startSession(this.createRunNodeLaunchContext(this.activeRun, nodeId));
  }

  private resolveInstantNode(nodeId: string): void {
    if (!this.activeRun) {
      return;
    }

    grantNodeCurrencies(this.activeRun, nodeId);
    this.activeRun.completedNodeIds.push(nodeId);
    this.activeRun.availableNodeIds = this.activeRun.availableNodeIds.filter((candidate) => candidate !== nodeId);
    for (const nextNodeId of getRunNode(this.activeRun, nodeId).nextNodeIds) {
      if (!this.activeRun.availableNodeIds.includes(nextNodeId)) {
        this.activeRun.availableNodeIds.push(nextNodeId);
      }
    }
    this.activeRun.currentNodeId = null;
    this.activeRun.stats.roomsCleared += 1;
    this.activeRun.pendingRewardChoices = createRewardChoices(this.activeRun, this.metaState, nodeId);
    this.noteDiscovery(getNodeTemplate(getRunNode(this.activeRun, nodeId).templateId).id);
    this.saveProgression();
    this.refreshProgressionUi();
    this.setMode("reward_choice");
  }

  private async startSession(launchContext: SessionLaunchContext): Promise<void> {
    this.setMode("starting_run");
    await this.loadContent(launchContext.levelId, launchContext.runtimeTuning);
    this.launchContext = launchContext;
    this.session = new GameSession(this.content, launchContext.sessionOptions);
    this.objectivesVisible = false;
    this.bindDebugHelpers();
    this.deathTimer = 0;
    if (this.renderer) {
      this.renderer.sync(this.session.state, this.session.getAutomapRenderSnapshot(), 1 / 60);
    }
    await this.audio.unlock();
    this.setMode("in_game");
  }

  private async restartCurrentSession(): Promise<void> {
    if (!this.launchContext) {
      return;
    }
    await this.startSession(this.launchContext);
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
    if (this.launchContext?.kind === "run_node" && this.activeRun && this.launchContext.runNodeId) {
      this.activeRun.currentNodeId = null;
      if (!this.activeRun.availableNodeIds.includes(this.launchContext.runNodeId)) {
        this.activeRun.availableNodeIds.push(this.launchContext.runNodeId);
      }
      this.saveProgression();
    }

    this.session = null;
    this.launchContext = null;
    this.renderer?.setAttractCamera();
    this.refreshProgressionUi();
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
    this.renderer?.setAutomapActive(mode === "in_game");
    this.ui.applySettings(this.settings);
    this.ui.renderMenu(mode, this.menuMessageForMode(mode));
    if (mode === "main_menu" || mode === "run_map" || mode === "reward_choice" || mode === "run_result") {
      this.ui.updateHud(this.createEmptyHud());
    } else if ((mode === "in_game" || mode === "death_transition") && this.session) {
      this.ui.updateHud(this.createHudViewModel());
    }
  }

  private menuMessageForMode(mode: AppMode): string {
    const menuLevel = this.getMenuLevelDefinition();
    switch (mode) {
      case "boot":
        return `Preparing ${menuLevel.name}.`;
      case "main_menu":
        return this.menuNotice.length > 0
          ? this.menuNotice
          : "Start a branching run from the hub, spend ash on modest unlocks, or launch an authored level directly.";
      case "paused":
        return "Resume the current node, restart it from the node entrance, or retreat to the hub.";
      case "run_map":
        return "Select the next authored node on the run map.";
      case "reward_choice":
        return "Choose one temporary reward before the next room.";
      case "run_result":
        return this.runResult?.description ?? "The run returns to the hub.";
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
        ? state.player.resources.ammo[weapon.ammoType]
        : 0;

    return {
      visible: this.appMode === "in_game" || this.appMode === "death_transition",
      health: Math.ceil(state.player.resources.health),
      armor: Math.ceil(state.player.resources.armor),
      ammo,
      weaponName: weapon?.name ?? state.weapon.currentId,
      enemiesRemaining,
      message: messageOverride ?? state.messages[0]?.text ?? state.level.name,
      keys: state.player.resources.keys,
      inventory: state.player.resources.inventory.map((entry) => {
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
      selectedInventoryIndex: state.player.resources.selectedInventoryIndex,
      automapOpen: state.automap.isOpen,
      objectivesVisible: this.appMode === "in_game" && this.objectivesVisible,
      objectives: this.currentObjectives(),
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
      automapOpen: false,
      objectivesVisible: false,
      objectives: [],
      backend: this.backend
    };
  }

  private currentObjectives(): string[] {
    const authoredObjectives = this.content.level.objectives ?? [];
    if (this.launchContext?.kind !== "run_node") {
      return authoredObjectives;
    }

    const nodeId = this.launchContext.runNodeId;
    if (!this.activeRun || !nodeId) {
      return authoredObjectives;
    }

    const node = getRunNode(this.activeRun, nodeId);
    const runObjective =
      node.kind === "boss"
        ? "Clear the boss node to end the run and bank sigils."
        : "Clear this node to claim a reward and advance along the run map.";
    return [...authoredObjectives, runObjective];
  }

  private handleLevelCompleted(): void {
    if (!this.launchContext) {
      return;
    }

    this.input.releasePointerLock();
    if (this.launchContext.kind === "direct_level") {
      this.menuNotice = `${this.content.level.name} complete. The direct level flow remains intact.`;
      this.session = null;
      this.launchContext = null;
      this.renderer?.setAttractCamera();
      this.refreshProgressionUi();
      this.setMode("main_menu");
      return;
    }

    if (!this.session || !this.activeRun || !this.launchContext.runNodeId) {
      return;
    }

    const nodeId = this.launchContext.runNodeId;
    const template = getNodeTemplate(getRunNode(this.activeRun, nodeId).templateId);
    this.activeRun.loadout = this.session.createRunLoadoutState();
    grantNodeCurrencies(this.activeRun, nodeId);
    this.activeRun.completedNodeIds.push(nodeId);
    this.activeRun.availableNodeIds = this.activeRun.availableNodeIds.filter((candidate) => candidate !== nodeId);
    for (const nextNodeId of getRunNode(this.activeRun, nodeId).nextNodeIds) {
      if (!this.activeRun.completedNodeIds.includes(nextNodeId) && !this.activeRun.availableNodeIds.includes(nextNodeId)) {
        this.activeRun.availableNodeIds.push(nextNodeId);
      }
    }
    this.activeRun.currentNodeId = null;
    this.activeRun.stats.roomsCleared += 1;
    if (getRunNode(this.activeRun, nodeId).kind === "elite") {
      this.activeRun.stats.elitesCleared += 1;
    }
    if (getRunNode(this.activeRun, nodeId).kind === "boss") {
      this.activeRun.stats.bossesCleared += 1;
    }
    this.noteDiscovery(template.id);
    this.session = null;
    this.launchContext = null;
    this.renderer?.setAttractCamera();

    if (getRunNode(this.activeRun, nodeId).kind === "boss") {
      this.finishRun("victory");
      return;
    }

    this.activeRun.pendingRewardChoices = createRewardChoices(this.activeRun, this.metaState, nodeId);
    this.saveProgression();
    this.refreshProgressionUi();
    this.setMode(this.activeRun.pendingRewardChoices.length > 0 ? "reward_choice" : "run_map");
  }

  private resolveRunFailure(): void {
    this.session = null;
    this.launchContext = null;
    this.renderer?.setAttractCamera();
    this.finishRun("death");
  }

  private finishRun(outcome: "victory" | "death"): void {
    if (!this.activeRun) {
      return;
    }

    this.metaState.currencies.ash += this.activeRun.earnedCurrencies.ash;
    this.metaState.currencies.sigil += this.activeRun.earnedCurrencies.sigil;
    this.runResult = {
      outcome,
      title: outcome === "victory" ? "Run Complete" : "Run Lost",
      description:
        outcome === "victory"
          ? "The boss node is cleared and the hub banks the run's ash and sigils."
          : "Death ends the run and sends the earned ash back to the hub.",
      currenciesEarned: { ...this.activeRun.earnedCurrencies },
      roomsCleared: this.activeRun.stats.roomsCleared,
      elitesCleared: this.activeRun.stats.elitesCleared,
      bossesCleared: this.activeRun.stats.bossesCleared
    };
    this.activeRun = null;
    this.saveProgression();
    this.refreshProgressionUi();
    this.setMode("run_result");
  }

  private dismissRunResult(): void {
    this.runResult = null;
    this.menuNotice = "Spend your ash, then dive back into the keep.";
    this.refreshProgressionUi();
    this.setMode("main_menu");
  }

  private applyRewardChoice(choiceId: string): void {
    if (!this.activeRun) {
      return;
    }

    const choice = this.activeRun.pendingRewardChoices.find((candidate) => candidate.id === choiceId);
    if (!choice) {
      return;
    }

    applyRunRewardChoice(this.activeRun, choice.rewardDefId);
    this.noteDiscovery(choice.rewardDefId);
    this.saveProgression();
    this.refreshProgressionUi();
    this.setMode("run_map");
  }

  private purchaseMetaUpgrade(upgradeId: string): void {
    if (!purchaseMetaUpgrade(this.metaState, upgradeId)) {
      return;
    }

    this.menuNotice = `${META_NAME_BY_ID.get(upgradeId) ?? "Upgrade"} purchased.`;
    this.saveProgression();
    this.refreshProgressionUi();
  }

  private refreshProgressionUi(): void {
    this.ui.setHubViewModel(this.buildHubViewModel());
    this.ui.setRunMapViewModel(this.activeRun ? this.buildRunMapViewModel(this.activeRun) : null);
    this.ui.setRewardChoiceViewModel(
      this.activeRun && this.activeRun.pendingRewardChoices.length > 0
        ? this.buildRewardChoiceViewModel(this.activeRun)
        : null
    );
    this.ui.setRunResultViewModel(this.runResult ? this.buildRunResultViewModel(this.runResult) : null);
  }

  private buildHubViewModel(): HubViewModel {
    return {
      ash: this.metaState.currencies.ash,
      sigil: this.metaState.currencies.sigil,
      canContinueRun: this.activeRun !== null,
      runSummary: this.activeRun
        ? `Active run: ${this.activeRun.stats.roomsCleared} cleared, ${this.activeRun.earnedCurrencies.ash} ash banked.`
        : "No active run. Start from the hub to build a temporary arsenal.",
      upgrades: listMetaUpgradeDefs().map((definition) => {
        const purchaseState = canPurchaseMetaUpgrade(this.metaState, definition);
        const rank = this.metaState.purchasedRanks[definition.id] ?? 0;
        return {
          id: definition.id,
          name: definition.name,
          category: definition.category,
          description: definition.description,
          costLabel: `${definition.costAmount} ${definition.costCurrency}`,
          rankLabel: `${rank}/${definition.maxRank}`,
          canPurchase: purchaseState.allowed,
          disabledReason: purchaseState.reason
        };
      })
    };
  }

  private buildRunMapViewModel(run: RunState): RunMapViewModel {
    return {
      ash: run.earnedCurrencies.ash,
      sigil: run.earnedCurrencies.sigil,
      biomeLabel: getNodeTemplate(run.nodes[0]?.templateId ?? NODE_TEMPLATES[0].id).biomeId,
      loadoutSummary: [
        `Health ${Math.ceil(run.loadout.health)} • Armor ${Math.ceil(run.loadout.armor)}`,
        `Weapons ${run.loadout.unlockedWeaponIds.join(", ")}`,
        `Inventory ${
          run.loadout.inventory.length > 0
            ? run.loadout.inventory.map((entry) => `${entry.itemDefId} x${entry.count}`).join(", ")
            : "Empty"
        }`
      ],
      modifierSummary: collectRunModifiers(run).map((modifier) => this.describeRunModifier(modifier.sourceDefId)),
      nodes: run.nodes.map((node) => {
        const template = getNodeTemplate(node.templateId);
        const status = run.currentNodeId === node.id
          ? "current"
          : run.completedNodeIds.includes(node.id)
            ? "completed"
            : run.availableNodeIds.includes(node.id)
              ? "available"
              : "locked";
        return {
          id: node.id,
          label: template.name,
          kind: node.kind,
          difficultyTier: node.difficultyTier,
          status,
          eliteLabels: node.eliteModifierIds?.map((modifierId) => ELITE_NAME_BY_ID.get(modifierId) ?? modifierId) ?? []
        };
      })
    };
  }

  private buildRewardChoiceViewModel(run: RunState): RewardChoiceScreenViewModel {
    return {
      ash: run.earnedCurrencies.ash,
      sigil: run.earnedCurrencies.sigil,
      choices: run.pendingRewardChoices.map((choice) => {
        const reward = getRewardDef(choice.rewardDefId);
        return {
          id: choice.id,
          name: reward.name,
          description: reward.description,
          kind: reward.kind.replaceAll("_", " ")
        };
      })
    };
  }

  private buildRunResultViewModel(result: RunResultSummary): RunResultViewModel {
    return {
      title: result.title,
      description: result.description,
      ash: result.currenciesEarned.ash,
      sigil: result.currenciesEarned.sigil,
      stats: [
        `Ash banked: ${result.currenciesEarned.ash}`,
        `Sigils banked: ${result.currenciesEarned.sigil}`,
        `Rooms cleared: ${result.roomsCleared}`,
        `Elite nodes cleared: ${result.elitesCleared}`,
        `Bosses cleared: ${result.bossesCleared}`
      ]
    };
  }

  private describeRunModifier(sourceDefId: string): string {
    return (
      BLESSING_NAME_BY_ID.get(sourceDefId) ??
      INFUSION_NAME_BY_ID.get(sourceDefId) ??
      ELITE_NAME_BY_ID.get(sourceDefId) ??
      META_NAME_BY_ID.get(sourceDefId) ??
      sourceDefId
    );
  }

  private createRunNodeLaunchContext(run: RunState, nodeId: string): SessionLaunchContext {
    const node = getRunNode(run, nodeId);
    const template = getNodeTemplate(node.templateId);
    if (!template.levelId) {
      throw new Error(`Node '${nodeId}' does not launch a level.`);
    }

    return {
      kind: "run_node",
      levelId: template.levelId,
      runNodeId: nodeId,
      runtimeTuning: {
        weaponTunings: this.collectWeaponTunings(run),
        enemyTuning: this.collectEnemyTuning(node),
        additionalEnemySpawns: (template.extraEnemySpawns ?? [])
          .filter((spawn) => (spawn.minDifficultyTier ?? 1) <= node.difficultyTier)
          .map((spawn) => ({
            id: spawn.id,
            type: spawn.type,
            x: spawn.x,
            y: spawn.y,
            facingDeg: spawn.facingDeg
          })),
        disabledPickupDefIds: RUN_PICKUP_FILTER_IDS
      },
      sessionOptions: {
        loadout: cloneLoadout(run.loadout),
        playerModifiers: run.runModifiers.flatMap((modifier) => modifier.modifiers ?? [])
      }
    };
  }

  private collectWeaponTunings(run: RunState): WeaponRuntimeTuning[] {
    const tuningByWeapon = new Map<string, WeaponRuntimeTuning>();

    for (const modifier of run.runModifiers) {
      if (!modifier.weaponId || !modifier.behaviorOverrides) {
        continue;
      }

      const current = tuningByWeapon.get(modifier.weaponId) ?? { weaponId: modifier.weaponId };
      const overrides = modifier.behaviorOverrides;
      current.damageBonus = (current.damageBonus ?? 0) + (overrides.damageBonus ?? 0);
      current.cooldownScale = (current.cooldownScale ?? 1) * (overrides.cooldownScale ?? 1);
      current.ammoCostDelta = (current.ammoCostDelta ?? 0) + (overrides.ammoCostDelta ?? 0);
      current.extraProjectiles = (current.extraProjectiles ?? 0) + (overrides.extraProjectiles ?? 0);
      current.extraBounces = (current.extraBounces ?? 0) + (overrides.extraBounces ?? 0);
      current.splashRadiusBonus = (current.splashRadiusBonus ?? 0) + (overrides.splashRadiusBonus ?? 0);
      current.hazardDurationBonus = (current.hazardDurationBonus ?? 0) + (overrides.hazardDurationBonus ?? 0);
      current.spreadCountBonus = (current.spreadCountBonus ?? 0) + (overrides.spreadCountBonus ?? 0);
      current.impactBurstCountBonus = (current.impactBurstCountBonus ?? 0) + (overrides.impactBurstCountBonus ?? 0);
      current.projectileSpeedScale = (current.projectileSpeedScale ?? 1) * (overrides.projectileSpeedScale ?? 1);
      current.homingStrengthBonus = (current.homingStrengthBonus ?? 0) + (overrides.homingStrengthBonus ?? 0);
      tuningByWeapon.set(modifier.weaponId, current);
    }

    return [...tuningByWeapon.values()];
  }

  private collectEnemyTuning(node: RunState["nodes"][number]): EnemyRuntimeTuning | null {
    let healthScale = 1 + (node.difficultyTier - 1) * 0.08;
    let moveSpeedScale = 1 + (node.difficultyTier - 1) * 0.03;
    let attackDamageScale = 1 + (node.difficultyTier - 1) * 0.05;
    let attackCooldownScale = 1 - (node.difficultyTier - 1) * 0.02;
    let projectileSpeedScale = 1 + (node.difficultyTier - 1) * 0.03;

    for (const modifierId of node.eliteModifierIds ?? []) {
      const definition = ELITE_MODIFIERS.find((candidate) => candidate.id === modifierId);
      if (!definition) {
        continue;
      }
      healthScale *= definition.enemyTuning.healthScale ?? 1;
      moveSpeedScale *= definition.enemyTuning.moveSpeedScale ?? 1;
      attackDamageScale *= definition.enemyTuning.attackDamageScale ?? 1;
      attackCooldownScale *= definition.enemyTuning.attackCooldownScale ?? 1;
      projectileSpeedScale *= definition.enemyTuning.projectileSpeedScale ?? 1;
    }

    return {
      healthScale,
      moveSpeedScale,
      attackDamageScale,
      attackCooldownScale,
      projectileSpeedScale
    };
  }

  private saveProgression(): void {
    this.progressionPersistence.save(this.metaState, this.activeRun);
  }

  private noteDiscovery(contentId: string): void {
    if (!this.metaState.discoveredCodexIds.includes(contentId)) {
      this.metaState.discoveredCodexIds.push(contentId);
    }
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

  private selectLevel(levelId: string): void {
    if (levelId === this.selectedLevelId) {
      return;
    }

    this.selectedLevelId = levelId;
    this.ui.setLevelOptions(this.availableLevels, this.selectedLevelId);
    syncLevelQueryParam(levelId);
  }

  private getMenuLevelDefinition(): LevelDefinition {
    return getRegisteredLevel(this.selectedLevelId);
  }

  private async loadContent(levelId: string, runtimeTuning?: ContentRuntimeTuning): Promise<void> {
    this.content = createContentDb(levelId, runtimeTuning);
    if (!this.engine) {
      return;
    }

    const nextRenderer = await RetroRenderer.create(this.engine, this.content, this.automapCanvas);
    nextRenderer.setPixelScale(this.settings.pixelScale);
    nextRenderer.setAutomapActive(this.appMode === "in_game");
    this.renderer?.dispose();
    this.renderer = nextRenderer;
  }
}

function resolveRequestedLevelId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_LEVEL_ID;
  }

  return new URLSearchParams(window.location.search).get("level") ?? DEFAULT_LEVEL_ID;
}

function syncLevelQueryParam(levelId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (levelId === DEFAULT_LEVEL_ID) {
    url.searchParams.delete("level");
  } else {
    url.searchParams.set("level", levelId);
  }
  window.history.replaceState({}, "", url);
}

function createNeutralInput(source?: InputFrame): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    fireDown: false,
    interactPressed: false,
    useItemPressed: false,
    inventoryPrevPressed: false,
    inventoryNextPressed: false,
    menuPressed: source?.menuPressed ?? false,
    toggleTome: false,
    toggleObjectives: false,
    toggleAutomap: source?.toggleAutomap ?? false,
    toggleAutomapLabels: source?.toggleAutomapLabels ?? false,
    toggleAutomapFollow: source?.toggleAutomapFollow ?? false,
    toggleAutomapRotate: source?.toggleAutomapRotate ?? false,
    automapZoomIn: source?.automapZoomIn ?? false,
    automapZoomOut: source?.automapZoomOut ?? false,
    automapPanX: source?.automapPanX ?? 0,
    automapPanY: source?.automapPanY ?? 0,
    weaponSlot: undefined
  };
}
