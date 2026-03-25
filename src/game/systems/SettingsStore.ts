import type { SettingsState } from "../core/types";

const SETTINGS_KEY = "wyrmwake-settings";

export const DEFAULT_SETTINGS: SettingsState = {
  masterVolume: 0.7,
  mouseSensitivity: 0.0022,
  pixelScale: 2
};

export class SettingsStore {
  load(): SettingsState {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      return {
        masterVolume: sanitizeRange(parsed.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
        mouseSensitivity: sanitizeRange(
          parsed.mouseSensitivity,
          0.0008,
          0.006,
          DEFAULT_SETTINGS.mouseSensitivity
        ),
        pixelScale: sanitizeRange(parsed.pixelScale, 1, 4, DEFAULT_SETTINGS.pixelScale)
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(settings: SettingsState): void {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

function sanitizeRange(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
