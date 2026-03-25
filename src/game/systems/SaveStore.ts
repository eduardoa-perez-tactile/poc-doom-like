import type { GameState, SaveGameData } from "../core/types";

const SAVE_KEY = "wyrmwake-save-slot-1";

export class SaveStore {
  save(state: GameState): void {
    const payload: SaveGameData = {
      version: 1,
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
      return JSON.parse(raw) as SaveGameData;
    } catch {
      return null;
    }
  }

  hasSave(): boolean {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  }
}
