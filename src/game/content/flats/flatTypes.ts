export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlatAnim {
  frames: readonly Rect[];
  fps?: number;
  loop?: boolean;
}

export type FlatVisualId = string;

export const FLAT_DEF_IDS = [
  "STONE_DARK",
  "ROCK_BROWN",
  "STONE_BRICK_GRAY",
  "STONE_CRACKED",
  "SLIME_STONE_GREEN",
  "SANDSTONE_TAN",
  "METAL_GRATE",
  "FLESH_RED",
  "WOOD_PLANKS",
  "STONE_WORN_GRAY",
  "WOOD_BEAM",
  "RUNE_BLUE_DARK",
  "DIRT_BROWN",
  "STONE_GREEN_MOTTLED",
  "GROUND_MURKY_GREEN",
  "RUNE_TILE_BLUE_A",
  "RUNE_TILE_BLUE_B",
  "RUNE_TILE_BLUE_TRIDENT",
  "RUNE_TILE_BLUE_ARROW",
  "WOOD_PANEL_VERTICAL",
  "EARTH_BROWN",
  "METAL_RIVETED",
  "METAL_HATCH_BLACK",
  "VOID_BLACK",
  "BORDER_TILE_BROWN",
  "RUNE_TILE_BLUE_DIAMOND",
  "STONE_BLOCKS_GRAY",
  "PANEL_GRID_GRAY",
  "ORGANIC_CRACK_BROWN",
  "MEDALLION_STONE_DARK",
  "WOOD_BOARD_BROWN",
  "ASH_STONE_WHITE",
  "LAVA_ROCK_GROUND",
  "MOSS_LINES_GREEN",
  "ORGANIC_GREEN_VERTICAL",
  "EARTH_CORRUPTED_DARK",
  "STONE_BRICK_MOSSY",
  "STONE_PLAIN_GRAY",
  "SANDSTONE_BLOCK",
  "ROCK_BLACK",
  "RUNESTONE_CIRCLE",
  "TILE_DIAMOND_BROWN",
  "WATER_BLUE",
  "BLOOD_POOL",
  "GRAY_FLESH",
  "CHAOS_RUNE_FLOOR",
  "ENERGY_BLUE",
  "LAVA"
] as const;

export type FlatDefId = (typeof FLAT_DEF_IDS)[number];

export interface FlatVisual {
  id: FlatVisualId;
  anim: FlatAnim;
}

export interface FlatScroll {
  x: number;
  y: number;
}

export interface FlatDef {
  id: FlatDefId;
  visualId: FlatVisualId;
  emissive?: boolean;
  scroll?: FlatScroll;
  notes?: string;
}
