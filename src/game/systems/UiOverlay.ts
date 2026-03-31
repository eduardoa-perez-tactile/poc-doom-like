import type { LevelDefinition } from "../content/types";
import type { AppMode, HudViewModel, SettingsState } from "../core/types";

export interface HubUpgradeViewModel {
  id: string;
  name: string;
  category: string;
  description: string;
  costLabel: string;
  rankLabel: string;
  disabledReason?: string;
  canPurchase: boolean;
}

export interface HubViewModel {
  ash: number;
  sigil: number;
  canContinueRun: boolean;
  runSummary: string;
  upgrades: HubUpgradeViewModel[];
}

export interface RunMapNodeViewModel {
  id: string;
  label: string;
  kind: string;
  difficultyTier: number;
  status: "available" | "completed" | "current" | "locked";
  eliteLabels: string[];
}

export interface RunMapViewModel {
  ash: number;
  sigil: number;
  biomeLabel: string;
  loadoutSummary: string[];
  modifierSummary: string[];
  nodes: RunMapNodeViewModel[];
}

export interface RewardChoiceViewModel {
  id: string;
  name: string;
  description: string;
  kind: string;
}

export interface RewardChoiceScreenViewModel {
  ash: number;
  sigil: number;
  choices: RewardChoiceViewModel[];
}

export interface RunResultViewModel {
  title: string;
  description: string;
  ash: number;
  sigil: number;
  stats: string[];
}

export interface UiOverlayCallbacks {
  onStartRun(): void;
  onContinueRun(): void;
  onLaunchSelectedLevel(): void;
  onSelectLevel(levelId: string): void;
  onSelectRunNode(nodeId: string): void;
  onSelectRewardChoice(choiceId: string): void;
  onPurchaseMetaUpgrade(upgradeId: string): void;
  onDismissResult(): void;
  onResume(): void;
  onRestart(): void;
  onMainMenu(): void;
  onApplySettings(settings: SettingsState): void;
}

export class UiOverlay {
  private static readonly PICKUP_SHEET_WIDTH = 509;
  private static readonly PICKUP_SHEET_HEIGHT = 303;
  private readonly root: HTMLDivElement;
  private readonly statusBanner: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly hudStats: HTMLDivElement;
  private readonly hudWeapon: HTMLDivElement;
  private readonly hudInventory: HTMLDivElement;
  private readonly hudObjectives: HTMLDivElement;
  private readonly menuBackdrop: HTMLDivElement;
  private readonly menuTitle: HTMLHeadingElement;
  private readonly menuBody: HTMLParagraphElement;
  private readonly summaryStrip: HTMLDivElement;
  private readonly levelSelect: HTMLDivElement;
  private readonly hubSection: HTMLDivElement;
  private readonly hubRunSummary: HTMLDivElement;
  private readonly hubUpgrades: HTMLDivElement;
  private readonly continueRunButton: HTMLButtonElement;
  private readonly launchLevelButton: HTMLButtonElement;
  private readonly runMapSection: HTMLDivElement;
  private readonly runMapLoadout: HTMLDivElement;
  private readonly runMapModifiers: HTMLDivElement;
  private readonly runMapNodes: HTMLDivElement;
  private readonly rewardSection: HTMLDivElement;
  private readonly rewardChoices: HTMLDivElement;
  private readonly resultSection: HTMLDivElement;
  private readonly resultSummary: HTMLDivElement;
  private readonly pauseSection: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly dismissResultButton: HTMLButtonElement;
  private readonly sensitivityInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly pixelScaleInput: HTMLInputElement;
  private readonly sensitivityValue: HTMLSpanElement;
  private readonly volumeValue: HTMLSpanElement;
  private readonly pixelScaleValue: HTMLSpanElement;
  private pickupSheetUrl: string | null = null;

  constructor(
    parent: HTMLElement,
    initialSettings: SettingsState,
    callbacks: UiOverlayCallbacks
  ) {
    this.root = document.createElement("div");
    this.root.className = "ui-root";
    this.root.innerHTML = `
      <div class="status-banner" data-role="status-banner"></div>
      <div class="crosshair" data-role="crosshair"></div>
      <div class="hud" data-role="hud">
        <div class="panel hud-panel-stats" data-role="hud-stats"></div>
        <div class="panel hud-panel-weapon" data-role="hud-weapon"></div>
        <div class="panel hud-panel-inventory" data-role="hud-inventory"></div>
      </div>
      <div class="panel hud-objectives hidden" data-role="hud-objectives"></div>
      <div class="menu-backdrop" data-role="menu-backdrop">
        <div class="menu-panel">
          <h1 data-role="menu-title">Wyrmwake</h1>
          <p data-role="menu-body"></p>
          <div class="menu-summary-strip" data-role="menu-summary-strip"></div>
          <div class="menu-section" data-role="hub-section">
            <div class="menu-card">
              <h2>Run Flow</h2>
              <div class="menu-actions">
                <button data-action="start">Start New Run</button>
                <button data-action="continue-run">Continue Run</button>
                <button data-action="launch-level">Launch Selected Level</button>
              </div>
              <div class="menu-run-summary" data-role="hub-run-summary"></div>
            </div>
            <div class="menu-card">
              <h2>Direct Level Launch</h2>
              <div class="menu-levels" data-role="menu-levels"></div>
            </div>
            <div class="menu-card">
              <h2>Meta Upgrades</h2>
              <div class="meta-upgrade-list" data-role="hub-upgrades"></div>
            </div>
            <div class="menu-card">
              <h2>Settings</h2>
              <div class="menu-grid">
                <div class="menu-row">
                  <label for="mouse-sensitivity">Mouse</label>
                  <input id="mouse-sensitivity" type="range" min="0.0008" max="0.006" step="0.0002" />
                  <span data-role="mouse-value"></span>
                </div>
                <div class="menu-row">
                  <label for="master-volume">Volume</label>
                  <input id="master-volume" type="range" min="0" max="1" step="0.05" />
                  <span data-role="volume-value"></span>
                </div>
                <div class="menu-row">
                  <label for="pixel-scale">Pixels</label>
                  <input id="pixel-scale" type="range" min="1" max="4" step="1" />
                  <span data-role="pixel-value"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="menu-section hidden" data-role="run-map-section">
            <div class="menu-card">
              <h2>Loadout</h2>
              <div class="menu-list" data-role="run-map-loadout"></div>
            </div>
            <div class="menu-card">
              <h2>Run Modifiers</h2>
              <div class="menu-list" data-role="run-map-modifiers"></div>
            </div>
            <div class="menu-card">
              <h2>Node Map</h2>
              <div class="run-map-grid" data-role="run-map-nodes"></div>
              <div class="menu-actions">
                <button data-action="main-menu">Return To Hub</button>
              </div>
            </div>
          </div>
          <div class="menu-section hidden" data-role="reward-section">
            <div class="menu-card">
              <h2>Choose Reward</h2>
              <div class="reward-grid" data-role="reward-choices"></div>
            </div>
          </div>
          <div class="menu-section hidden" data-role="result-section">
            <div class="menu-card">
              <h2>Run Result</h2>
              <div class="menu-list" data-role="result-summary"></div>
              <div class="menu-actions">
                <button data-action="dismiss-result">Return To Hub</button>
              </div>
            </div>
          </div>
          <div class="menu-section hidden" data-role="pause-section">
            <div class="menu-card">
              <h2>Paused</h2>
              <div class="menu-grid">
                <div class="menu-row">
                  <label for="pause-mouse-sensitivity">Mouse</label>
                  <input id="pause-mouse-sensitivity" type="range" min="0.0008" max="0.006" step="0.0002" disabled />
                  <span data-role="pause-mouse-value"></span>
                </div>
                <div class="menu-row">
                  <label for="pause-master-volume">Volume</label>
                  <input id="pause-master-volume" type="range" min="0" max="1" step="0.05" disabled />
                  <span data-role="pause-volume-value"></span>
                </div>
                <div class="menu-row">
                  <label for="pause-pixel-scale">Pixels</label>
                  <input id="pause-pixel-scale" type="range" min="1" max="4" step="1" disabled />
                  <span data-role="pause-pixel-value"></span>
                </div>
              </div>
              <div class="menu-actions">
                <button data-action="resume">Resume</button>
                <button data-action="restart">Restart</button>
                <button data-action="main-menu">Main Menu</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(this.root);

    this.statusBanner = this.requireElement<HTMLDivElement>('[data-role="status-banner"]');
    this.crosshair = this.requireElement<HTMLDivElement>('[data-role="crosshair"]');
    this.hud = this.requireElement<HTMLDivElement>('[data-role="hud"]');
    this.hudStats = this.requireElement<HTMLDivElement>('[data-role="hud-stats"]');
    this.hudWeapon = this.requireElement<HTMLDivElement>('[data-role="hud-weapon"]');
    this.hudInventory = this.requireElement<HTMLDivElement>('[data-role="hud-inventory"]');
    this.hudObjectives = this.requireElement<HTMLDivElement>('[data-role="hud-objectives"]');
    this.menuBackdrop = this.requireElement<HTMLDivElement>('[data-role="menu-backdrop"]');
    this.menuTitle = this.requireElement<HTMLHeadingElement>('[data-role="menu-title"]');
    this.menuBody = this.requireElement<HTMLParagraphElement>('[data-role="menu-body"]');
    this.summaryStrip = this.requireElement<HTMLDivElement>('[data-role="menu-summary-strip"]');
    this.levelSelect = this.requireElement<HTMLDivElement>('[data-role="menu-levels"]');
    this.hubSection = this.requireElement<HTMLDivElement>('[data-role="hub-section"]');
    this.hubRunSummary = this.requireElement<HTMLDivElement>('[data-role="hub-run-summary"]');
    this.hubUpgrades = this.requireElement<HTMLDivElement>('[data-role="hub-upgrades"]');
    this.runMapSection = this.requireElement<HTMLDivElement>('[data-role="run-map-section"]');
    this.runMapLoadout = this.requireElement<HTMLDivElement>('[data-role="run-map-loadout"]');
    this.runMapModifiers = this.requireElement<HTMLDivElement>('[data-role="run-map-modifiers"]');
    this.runMapNodes = this.requireElement<HTMLDivElement>('[data-role="run-map-nodes"]');
    this.rewardSection = this.requireElement<HTMLDivElement>('[data-role="reward-section"]');
    this.rewardChoices = this.requireElement<HTMLDivElement>('[data-role="reward-choices"]');
    this.resultSection = this.requireElement<HTMLDivElement>('[data-role="result-section"]');
    this.resultSummary = this.requireElement<HTMLDivElement>('[data-role="result-summary"]');
    this.pauseSection = this.requireElement<HTMLDivElement>('[data-role="pause-section"]');
    this.startButton = this.requireElement<HTMLButtonElement>('[data-action="start"]');
    this.continueRunButton = this.requireElement<HTMLButtonElement>('[data-action="continue-run"]');
    this.launchLevelButton = this.requireElement<HTMLButtonElement>('[data-action="launch-level"]');
    this.resumeButton = this.requireElement<HTMLButtonElement>('[data-action="resume"]');
    this.restartButton = this.requireElement<HTMLButtonElement>('[data-action="restart"]');
    this.dismissResultButton = this.requireElement<HTMLButtonElement>('[data-action="dismiss-result"]');
    this.sensitivityInput = this.requireElement<HTMLInputElement>("#mouse-sensitivity");
    this.volumeInput = this.requireElement<HTMLInputElement>("#master-volume");
    this.pixelScaleInput = this.requireElement<HTMLInputElement>("#pixel-scale");
    this.sensitivityValue = this.requireElement<HTMLSpanElement>('[data-role="mouse-value"]');
    this.volumeValue = this.requireElement<HTMLSpanElement>('[data-role="volume-value"]');
    this.pixelScaleValue = this.requireElement<HTMLSpanElement>('[data-role="pixel-value"]');

    const onSettingsChange = (): void => {
      const settings: SettingsState = {
        mouseSensitivity: Number(this.sensitivityInput.value),
        masterVolume: Number(this.volumeInput.value),
        pixelScale: Number(this.pixelScaleInput.value)
      };
      this.setSettingsValues(settings);
      callbacks.onApplySettings(settings);
    };

    this.sensitivityInput.addEventListener("input", onSettingsChange);
    this.volumeInput.addEventListener("input", onSettingsChange);
    this.pixelScaleInput.addEventListener("input", onSettingsChange);
    this.applySettings(initialSettings);

    this.root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const levelButton = target.closest<HTMLButtonElement>("[data-level-id]");
      const levelId = levelButton?.dataset.levelId;
      if (levelId && !levelButton.disabled) {
        callbacks.onSelectLevel(levelId);
        return;
      }

      const upgradeButton = target.closest<HTMLButtonElement>("[data-upgrade-id]");
      const upgradeId = upgradeButton?.dataset.upgradeId;
      if (upgradeId && !upgradeButton.disabled) {
        callbacks.onPurchaseMetaUpgrade(upgradeId);
        return;
      }

      const nodeButton = target.closest<HTMLButtonElement>("[data-node-id]");
      const nodeId = nodeButton?.dataset.nodeId;
      if (nodeId && !nodeButton.disabled) {
        callbacks.onSelectRunNode(nodeId);
        return;
      }

      const rewardButton = target.closest<HTMLButtonElement>("[data-reward-choice-id]");
      const rewardChoiceId = rewardButton?.dataset.rewardChoiceId;
      if (rewardChoiceId && !rewardButton.disabled) {
        callbacks.onSelectRewardChoice(rewardChoiceId);
        return;
      }

      const actionButton = target.closest<HTMLButtonElement>("[data-action]");
      switch (actionButton?.dataset.action) {
        case "start":
          callbacks.onStartRun();
          break;
        case "continue-run":
          callbacks.onContinueRun();
          break;
        case "launch-level":
          callbacks.onLaunchSelectedLevel();
          break;
        case "resume":
          callbacks.onResume();
          break;
        case "restart":
          callbacks.onRestart();
          break;
        case "main-menu":
          callbacks.onMainMenu();
          break;
        case "dismiss-result":
          callbacks.onDismissResult();
          break;
        default:
          break;
      }
    });
  }

  updateHud(viewModel: HudViewModel): void {
    this.hud.classList.toggle("hidden", !viewModel.visible);
    this.crosshair.classList.toggle("hidden", !viewModel.visible || viewModel.automapOpen);
    this.statusBanner.classList.toggle("hidden", !viewModel.visible || viewModel.message.length === 0);
    this.statusBanner.textContent = viewModel.message;
    this.hudStats.innerHTML = `
      <div><strong>Health</strong> ${viewModel.health}</div>
      <div><strong>Armor</strong> ${viewModel.armor}</div>
      <div><strong>Ammo</strong> ${viewModel.ammo}</div>
      <div><strong>Enemies</strong> ${viewModel.enemiesRemaining}</div>
      <div><strong>Keys</strong> ${viewModel.keys.length > 0 ? viewModel.keys.join(" / ") : "None"}</div>
      <div><strong>Weapon</strong> ${viewModel.weaponName}</div>
      <div><strong>Backend</strong> ${viewModel.backend.toUpperCase()}</div>
    `;
    this.hudWeapon.innerHTML = `
      <div><strong>Ready</strong> ${viewModel.weaponName}</div>
      <div><strong>Interact</strong> E</div>
      <div><strong>Use Item</strong> R</div>
      <div><strong>Map</strong> Tab</div>
    `;
    this.hudInventory.innerHTML = `
      <div><strong>Inventory</strong></div>
      <div><strong>Cycle</strong> [ / ]</div>
      <div class="hud-inventory-row">
        ${
          viewModel.inventory.length === 0
            ? `<span class="hud-inventory-empty">Empty</span>`
            : viewModel.inventory
                .map((entry, index) => this.renderInventoryEntry(entry, index === viewModel.selectedInventoryIndex))
                .join("")
        }
      </div>
    `;
    this.hudObjectives.classList.toggle("hidden", !viewModel.visible || !viewModel.objectivesVisible);
    this.hudObjectives.innerHTML = `
      <div><strong>Objectives</strong> <span class="hud-objectives-hint">O</span></div>
      <div class="hud-objectives-list">
        ${viewModel.objectives.map((objective) => `<div>${objective}</div>`).join("")}
      </div>
    `;
  }

  setPickupSheetUrl(url: string): void {
    this.pickupSheetUrl = url;
  }

  setLevelOptions(
    levels: readonly Pick<LevelDefinition, "id" | "name" | "briefing">[],
    selectedLevelId: string
  ): void {
    this.levelSelect.replaceChildren(
      ...levels.map((level) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `level-option${level.id === selectedLevelId ? " selected" : ""}`;
        button.dataset.levelId = level.id;
        button.innerHTML = `
          <span class="level-option-title">${level.name}</span>
          <span class="level-option-briefing">${level.briefing}</span>
        `;
        return button;
      })
    );
  }

  setHubViewModel(viewModel: HubViewModel): void {
    this.summaryStrip.innerHTML = this.renderSummary(viewModel.ash, viewModel.sigil, viewModel.runSummary);
    this.continueRunButton.disabled = !viewModel.canContinueRun;
    this.hubRunSummary.textContent = viewModel.runSummary;
    this.hubUpgrades.replaceChildren(
      ...viewModel.upgrades.map((upgrade) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "meta-upgrade-button";
        button.dataset.upgradeId = upgrade.id;
        button.disabled = !upgrade.canPurchase;
        button.innerHTML = `
          <span class="meta-upgrade-header">
            <span>${upgrade.name}</span>
            <span>${upgrade.rankLabel}</span>
          </span>
          <span class="meta-upgrade-category">${upgrade.category}</span>
          <span class="meta-upgrade-description">${upgrade.description}</span>
          <span class="meta-upgrade-footer">${upgrade.costLabel}${upgrade.disabledReason ? ` • ${upgrade.disabledReason}` : ""}</span>
        `;
        return button;
      })
    );
  }

  setRunMapViewModel(viewModel: RunMapViewModel | null): void {
    if (!viewModel) {
      this.runMapLoadout.replaceChildren();
      this.runMapModifiers.replaceChildren();
      this.runMapNodes.replaceChildren();
      return;
    }

    this.summaryStrip.innerHTML = this.renderSummary(
      viewModel.ash,
      viewModel.sigil,
      `Biome: ${viewModel.biomeLabel}`
    );
    this.runMapLoadout.innerHTML = viewModel.loadoutSummary
      .map((line) => `<div>${line}</div>`)
      .join("");
    this.runMapModifiers.innerHTML = (viewModel.modifierSummary.length > 0
      ? viewModel.modifierSummary
      : ["No run modifiers yet."])
      .map((line) => `<div>${line}</div>`)
      .join("");
    this.runMapNodes.replaceChildren(
      ...viewModel.nodes.map((node) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `run-node run-node-${node.status}`;
        button.dataset.nodeId = node.id;
        button.disabled = node.status !== "available";
        const elites = node.eliteLabels.length > 0 ? ` • ${node.eliteLabels.join(", ")}` : "";
        button.innerHTML = `
          <span class="run-node-kind">${node.kind}</span>
          <span class="run-node-title">${node.label}</span>
          <span class="run-node-meta">Tier ${node.difficultyTier} • ${node.status}${elites}</span>
        `;
        return button;
      })
    );
  }

  setRewardChoiceViewModel(viewModel: RewardChoiceScreenViewModel | null): void {
    if (!viewModel) {
      this.rewardChoices.replaceChildren();
      return;
    }

    this.summaryStrip.innerHTML = this.renderSummary(
      viewModel.ash,
      viewModel.sigil,
      "Choose one run reward."
    );
    this.rewardChoices.replaceChildren(
      ...viewModel.choices.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reward-choice";
        button.dataset.rewardChoiceId = choice.id;
        button.innerHTML = `
          <span class="reward-choice-kind">${choice.kind}</span>
          <span class="reward-choice-title">${choice.name}</span>
          <span class="reward-choice-description">${choice.description}</span>
        `;
        return button;
      })
    );
  }

  setRunResultViewModel(viewModel: RunResultViewModel | null): void {
    if (!viewModel) {
      this.resultSummary.replaceChildren();
      return;
    }

    this.summaryStrip.innerHTML = this.renderSummary(
      viewModel.ash,
      viewModel.sigil,
      viewModel.title
    );
    this.resultSummary.innerHTML = `
      <div><strong>${viewModel.title}</strong></div>
      <div>${viewModel.description}</div>
      ${viewModel.stats.map((line) => `<div>${line}</div>`).join("")}
    `;
  }

  renderMenu(mode: AppMode, message: string): void {
    const isMenuVisible =
      mode === "main_menu" ||
      mode === "paused" ||
      mode === "boot" ||
      mode === "run_map" ||
      mode === "reward_choice" ||
      mode === "run_result";
    this.menuBackdrop.classList.toggle("hidden", !isMenuVisible);

    if (!isMenuVisible) {
      return;
    }

    this.hubSection.classList.toggle("hidden", mode !== "main_menu" && mode !== "boot");
    this.runMapSection.classList.toggle("hidden", mode !== "run_map");
    this.rewardSection.classList.toggle("hidden", mode !== "reward_choice");
    this.resultSection.classList.toggle("hidden", mode !== "run_result");
    this.pauseSection.classList.toggle("hidden", mode !== "paused");

    switch (mode) {
      case "boot":
        this.menuTitle.textContent = "Loading";
        this.startButton.disabled = true;
        this.continueRunButton.disabled = true;
        this.launchLevelButton.disabled = true;
        break;
      case "paused":
        this.menuTitle.textContent = "Paused";
        this.resumeButton.disabled = false;
        this.restartButton.disabled = false;
        break;
      case "run_map":
        this.menuTitle.textContent = "Run Map";
        break;
      case "reward_choice":
        this.menuTitle.textContent = "Reward";
        break;
      case "run_result":
        this.menuTitle.textContent = "Run Result";
        this.dismissResultButton.disabled = false;
        break;
      default:
        this.menuTitle.textContent = "Wyrmwake";
        this.startButton.disabled = false;
        this.launchLevelButton.disabled = false;
        break;
    }

    for (const button of this.levelSelect.querySelectorAll<HTMLButtonElement>("[data-level-id]")) {
      button.disabled = mode === "boot";
    }

    this.menuBody.textContent = message;
  }

  applySettings(settings: SettingsState): void {
    this.sensitivityInput.value = String(settings.mouseSensitivity);
    this.volumeInput.value = String(settings.masterVolume);
    this.pixelScaleInput.value = String(settings.pixelScale);
    this.setSettingsValues(settings);
  }

  private setSettingsValues(settings: SettingsState): void {
    this.sensitivityValue.textContent = settings.mouseSensitivity.toFixed(4);
    this.volumeValue.textContent = `${Math.round(settings.masterVolume * 100)}%`;
    this.pixelScaleValue.textContent = `${settings.pixelScale.toFixed(0)}x`;
  }

  private renderSummary(ash: number, sigil: number, note: string): string {
    return `
      <span><strong>Ash</strong> ${ash}</span>
      <span><strong>Sigil</strong> ${sigil}</span>
      <span>${note}</span>
    `;
  }

  private requireElement<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }

  private renderInventoryEntry(entry: HudViewModel["inventory"][number], selected: boolean): string {
    const classes = `hud-inventory-entry${selected ? " selected" : ""}`;
    const icon = entry.iconFrame && this.pickupSheetUrl
      ? `<span class="hud-icon" style="${this.iconStyle(entry.iconFrame)}"></span>`
      : `<span class="hud-icon hud-icon-fallback">${entry.label.slice(0, 1)}</span>`;

    return `
      <span class="${classes}">
        ${icon}
        <span class="hud-inventory-count">${entry.count}</span>
      </span>
    `;
  }

  private iconStyle(frame: NonNullable<HudViewModel["inventory"][number]["iconFrame"]>): string {
    const scale = 2;
    return [
      `width:${frame.width * scale}px`,
      `height:${frame.height * scale}px`,
      `background-image:url('${this.pickupSheetUrl}')`,
      `background-position:-${frame.x * scale}px -${frame.y * scale}px`,
      `background-size:${UiOverlay.PICKUP_SHEET_WIDTH * scale}px ${UiOverlay.PICKUP_SHEET_HEIGHT * scale}px`
    ].join(";");
  }
}
