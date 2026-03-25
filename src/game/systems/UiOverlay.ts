import type { GameState, SettingsState } from "../core/types";

export interface UiOverlayCallbacks {
  onResume(): void;
  onSave(): void;
  onLoad(): void;
  onRestart(): void;
  onApplySettings(settings: SettingsState): void;
}

export class UiOverlay {
  private readonly root: HTMLDivElement;
  private readonly statusBanner: HTMLDivElement;
  private readonly hudStats: HTMLDivElement;
  private readonly hudWeapon: HTMLDivElement;
  private readonly menuBackdrop: HTMLDivElement;
  private readonly menuBody: HTMLParagraphElement;
  private readonly sensitivityInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly pixelScaleInput: HTMLInputElement;
  private readonly sensitivityValue: HTMLSpanElement;
  private readonly volumeValue: HTMLSpanElement;
  private readonly pixelScaleValue: HTMLSpanElement;

  constructor(
    parent: HTMLElement,
    initialSettings: SettingsState,
    callbacks: UiOverlayCallbacks
  ) {
    this.root = document.createElement("div");
    this.root.className = "ui-root";
    this.root.innerHTML = `
      <div class="status-banner" data-role="status-banner">Click into the viewport to bind the ritual sight.</div>
      <div class="crosshair"></div>
      <div class="hud">
        <div class="panel" data-role="hud-stats"></div>
        <div class="panel" data-role="hud-weapon"></div>
      </div>
      <div class="menu-backdrop hidden">
        <div class="menu-panel">
          <h1>Wyrmwake</h1>
          <p data-role="menu-body"></p>
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
            <button data-action="resume">Resume</button>
            <button data-action="save">Save</button>
            <button data-action="load">Load</button>
            <button data-action="restart">Restart</button>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(this.root);

    this.statusBanner = this.requireElement<HTMLDivElement>('[data-role="status-banner"]', false);
    this.hudStats = this.requireElement<HTMLDivElement>('[data-role="hud-stats"]');
    this.hudWeapon = this.requireElement<HTMLDivElement>('[data-role="hud-weapon"]');
    this.menuBackdrop = this.requireElement<HTMLDivElement>(".menu-backdrop", false);
    this.menuBody = this.requireElement<HTMLParagraphElement>('[data-role="menu-body"]');
    this.sensitivityInput = this.requireElement<HTMLInputElement>("#mouse-sensitivity", false);
    this.volumeInput = this.requireElement<HTMLInputElement>("#master-volume", false);
    this.pixelScaleInput = this.requireElement<HTMLInputElement>("#pixel-scale", false);
    this.sensitivityValue = this.requireElement<HTMLSpanElement>('[data-role="mouse-value"]');
    this.volumeValue = this.requireElement<HTMLSpanElement>('[data-role="volume-value"]');
    this.pixelScaleValue = this.requireElement<HTMLSpanElement>('[data-role="pixel-value"]');

    const resumeButton = this.requireElement<HTMLButtonElement>('[data-action="resume"]');
    const saveButton = this.requireElement<HTMLButtonElement>('[data-action="save"]');
    const loadButton = this.requireElement<HTMLButtonElement>('[data-action="load"]');
    const restartButton = this.requireElement<HTMLButtonElement>('[data-action="restart"]');

    resumeButton.addEventListener("click", () => callbacks.onResume());
    saveButton.addEventListener("click", () => callbacks.onSave());
    loadButton.addEventListener("click", () => callbacks.onLoad());
    restartButton.addEventListener("click", () => callbacks.onRestart());

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
  }

  updateHud(state: GameState, backend: string): void {
    const currentMessage = state.messages[0]?.text ?? state.level.name;
    this.statusBanner.textContent = currentMessage;
    this.hudStats.innerHTML = `
      <div><strong>Health</strong> ${Math.max(0, Math.ceil(state.player.health))}</div>
      <div><strong>Shards</strong> ${state.player.ammoShards}</div>
      <div><strong>Kills</strong> ${state.killCount}/${state.totalKills}</div>
      <div><strong>Secrets</strong> ${state.secretsFound}/${state.totalSecrets}</div>
      <div><strong>Backend</strong> ${backend.toUpperCase()}</div>
    `;

    this.hudWeapon.innerHTML = `
      <div><strong>Weapon</strong> ${titleFromId(state.weapon.currentId)}</div>
      <div><strong>Keys</strong> ${state.player.keys.length > 0 ? state.player.keys.join(", ") : "none"}</div>
      <div><strong>Objective</strong> ${state.levelComplete ? "exit reached" : "find the seal"}</div>
      <div><strong>Time</strong> ${formatTime(state.elapsedTime)}</div>
    `;
  }

  applySettings(settings: SettingsState): void {
    this.sensitivityInput.value = String(settings.mouseSensitivity);
    this.volumeInput.value = String(settings.masterVolume);
    this.pixelScaleInput.value = String(settings.pixelScale);
    this.setSettingsValues(settings);
  }

  setMenuState(open: boolean, canLoad: boolean, text: string): void {
    this.menuBackdrop.classList.toggle("hidden", !open);
    this.menuBody.textContent = text;
    const loadButton = this.requireElement<HTMLButtonElement>('[data-action="load"]');
    loadButton.disabled = !canLoad;
  }

  private setSettingsValues(settings: SettingsState): void {
    this.sensitivityValue.textContent = settings.mouseSensitivity.toFixed(4);
    this.volumeValue.textContent = `${Math.round(settings.masterVolume * 100)}%`;
    this.pixelScaleValue.textContent = `${settings.pixelScale.toFixed(0)}x`;
  }

  private requireElement<T extends HTMLElement>(selector: string, scoped = true): T {
    const root = scoped ? this.root : document;
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }
}

function formatTime(elapsed: number): string {
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function titleFromId(id: string): string {
  return id
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
