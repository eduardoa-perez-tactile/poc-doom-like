import levelDspairilsKeep from "./data/level-dspairils-keep.json";
import levelOpenArena from "./data/level-open-arena.json";
import type { LevelDefinition } from "./types";

export const DEFAULT_LEVEL_ID = "level-dspairils-keep";

const REGISTERED_LEVELS = [
  levelDspairilsKeep as LevelDefinition,
  levelOpenArena as LevelDefinition
] as const;

const LEVELS_BY_ID = new Map(REGISTERED_LEVELS.map((level) => [level.id, level] as const));

export function getRegisteredLevel(levelId?: string): LevelDefinition {
  if (levelId) {
    const requestedLevel = LEVELS_BY_ID.get(levelId);
    if (requestedLevel) {
      return requestedLevel;
    }
    console.warn(
      `[Content] Unknown level id '${levelId}', falling back to '${DEFAULT_LEVEL_ID}'.`
    );
  }

  const defaultLevel = LEVELS_BY_ID.get(DEFAULT_LEVEL_ID);
  if (!defaultLevel) {
    throw new Error(`Default level '${DEFAULT_LEVEL_ID}' is not registered.`);
  }

  return defaultLevel;
}

export function listRegisteredLevels(): readonly LevelDefinition[] {
  return REGISTERED_LEVELS;
}
