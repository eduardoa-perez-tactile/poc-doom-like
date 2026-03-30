import type { GameState, SaveGameData } from "../core/types";

const SAVE_KEY = "wyrmwake-save-slot-1";

export class SaveStore {
  save(state: GameState): void {
    const payload: SaveGameData = {
      version: 3,
      savedAt: new Date().toISOString(),
      state
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  load(): SaveGameData | null {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as SaveGameData;
      return parsed.version === 3 ? parsed : null;
    } catch {
      return null;
    }
  }

  hasSave(): boolean {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  }
}
