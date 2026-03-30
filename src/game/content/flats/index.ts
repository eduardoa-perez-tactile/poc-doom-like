export * from "./flatAtlas";
export * from "./flatDefs";
export * from "./flatTypes";
export * from "./flatVisuals";

import type { LevelDefinition } from "../types";
import type { FlatDefId } from "./flatTypes";

export const DEFAULT_LEVEL_FLOOR_FLAT: FlatDefId = "STONE_BRICK_GRAY";
export const DEFAULT_LEVEL_CEILING_FLAT: FlatDefId = "STONE_WORN_GRAY";

export function getLevelFloorFlat(level: LevelDefinition): FlatDefId {
  return level.floorFlat ?? DEFAULT_LEVEL_FLOOR_FLAT;
}

export function getLevelCeilingFlat(level: LevelDefinition): FlatDefId {
  return level.ceilingFlat ?? DEFAULT_LEVEL_CEILING_FLAT;
}
