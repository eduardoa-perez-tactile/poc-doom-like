import type { LevelDefinition } from "../content/types";
import type { AppMode, HudViewModel, SettingsState } from "../core/types";

export interface UiOverlayCallbacks {
  onStartRun(): void;
  onSelectLevel(levelId: string): void;
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
  private readonly menuBackdrop: HTMLDivElement;
  private readonly menuTitle: HTMLHeadingElement;
  private readonly menuBody: HTMLParagraphElement;
  private readonly levelSelect: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly mainMenuButton: HTMLButtonElement;
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
      <div class="menu-backdrop" data-role="menu-backdrop">
        <div class="menu-panel">
          <h1 data-role="menu-title">Wyrmwake</h1>
          <p data-role="menu-body"></p>
          <div class="menu-levels" data-role="menu-levels"></div>
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
          <div class="menu-actions">
            <button data-action="start">Start Run</button>
            <button data-action="resume">Resume</button>
            <button data-action="restart">Restart Run</button>
            <button data-action="main-menu">Main Menu</button>
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
    this.menuBackdrop = this.requireElement<HTMLDivElement>('[data-role="menu-backdrop"]');
    this.menuTitle = this.requireElement<HTMLHeadingElement>('[data-role="menu-title"]');
    this.menuBody = this.requireElement<HTMLParagraphElement>('[data-role="menu-body"]');
    this.levelSelect = this.requireElement<HTMLDivElement>('[data-role="menu-levels"]');
    this.startButton = this.requireElement<HTMLButtonElement>('[data-action="start"]');
    this.resumeButton = this.requireElement<HTMLButtonElement>('[data-action="resume"]');
    this.restartButton = this.requireElement<HTMLButtonElement>('[data-action="restart"]');
    this.mainMenuButton = this.requireElement<HTMLButtonElement>('[data-action="main-menu"]');
    this.sensitivityInput = this.requireElement<HTMLInputElement>("#mouse-sensitivity");
    this.volumeInput = this.requireElement<HTMLInputElement>("#master-volume");
    this.pixelScaleInput = this.requireElement<HTMLInputElement>("#pixel-scale");
    this.sensitivityValue = this.requireElement<HTMLSpanElement>('[data-role="mouse-value"]');
    this.volumeValue = this.requireElement<HTMLSpanElement>('[data-role="volume-value"]');
    this.pixelScaleValue = this.requireElement<HTMLSpanElement>('[data-role="pixel-value"]');

    this.startButton.addEventListener("click", () => callbacks.onStartRun());
    this.resumeButton.addEventListener("click", () => callbacks.onResume());
    this.restartButton.addEventListener("click", () => callbacks.onRestart());
    this.mainMenuButton.addEventListener("click", () => callbacks.onMainMenu());

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

    this.levelSelect.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("[data-level-id]");
      const levelId = button?.dataset.levelId;
      if (!levelId || button.disabled) {
        return;
      }

      callbacks.onSelectLevel(levelId);
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

  renderMenu(mode: AppMode, message: string): void {
    const isMenuVisible = mode === "main_menu" || mode === "paused" || mode === "boot";
    this.menuBackdrop.classList.toggle("hidden", !isMenuVisible);

    if (!isMenuVisible) {
      return;
    }

    if (mode === "paused") {
      this.menuTitle.textContent = "Paused";
      this.levelSelect.classList.add("hidden");
      this.startButton.classList.add("hidden");
      this.resumeButton.classList.remove("hidden");
      this.restartButton.classList.remove("hidden");
      this.mainMenuButton.classList.remove("hidden");
    } else {
      this.menuTitle.textContent = "Wyrmwake";
      this.levelSelect.classList.remove("hidden");
      this.startButton.classList.remove("hidden");
      this.resumeButton.classList.add("hidden");
      this.restartButton.classList.add("hidden");
      this.mainMenuButton.classList.add("hidden");
    }

    if (mode === "boot") {
      this.menuTitle.textContent = "Loading";
      this.startButton.disabled = true;
    } else {
      this.startButton.disabled = false;
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
