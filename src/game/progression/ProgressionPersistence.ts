import { createInitialMetaProgressionState } from "./MetaProgressionSystem";
import type { MetaProgressionState, ProgressionSaveData, RunState } from "./types";

const SAVE_KEY = "wyrmwake-progression-save-slot-1";

export class ProgressionPersistence {
  load(): { meta: MetaProgressionState; activeRun: RunState | null } {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return {
        meta: createInitialMetaProgressionState(),
        activeRun: null
      };
    }

    try {
      const parsed = JSON.parse(raw) as ProgressionSaveData;
      if (parsed.version !== 1) {
        throw new Error("Unsupported progression save version.");
      }
      return {
        meta: parsed.meta,
        activeRun: parsed.activeRun
      };
    } catch {
      return {
        meta: createInitialMetaProgressionState(),
        activeRun: null
      };
    }
  }

  save(meta: MetaProgressionState, activeRun: RunState | null): void {
    const payload: ProgressionSaveData = {
      version: 1,
      savedAt: new Date().toISOString(),
      meta,
      activeRun
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }
}
