const TILE_SIZE = 64;
const TILE_STRIDE = 65;
const ROW_STARTS = [16, 80, 145, 209, 504, 568, 633] as const;

export interface WallAtlasSourceTile {
  id: string;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export const WALL_ATLAS_SOURCE_URL = new URL("../assets/walls.png", import.meta.url).href;
export const WALL_ATLAS_TILE_SIZE = TILE_SIZE;

function sourceTile(id: string, column: number, row: number): WallAtlasSourceTile {
  return {
    id,
    sourceX: 1 + column * TILE_STRIDE,
    sourceY: ROW_STARTS[row],
    sourceWidth: TILE_SIZE,
    sourceHeight: TILE_SIZE
  };
}

// Curated from the Heretic wall sheet into reusable semantic families.
export const WALL_ATLAS_SOURCE_TILES: WallAtlasSourceTile[] = [
  sourceTile("stone_plain_gray", 0, 0),
  sourceTile("stone_dark_block", 1, 0),
  sourceTile("wood_crossbrace", 2, 0),
  sourceTile("stone_inset_gray", 4, 0),
  sourceTile("wood_lattice_dark", 5, 0),
  sourceTile("wood_reinforced_dark", 6, 0),
  sourceTile("wood_grid_window", 7, 0),
  sourceTile("wood_ring_panel", 8, 0),
  sourceTile("metal_window_dark", 9, 0),
  sourceTile("metal_window_brown", 10, 0),
  sourceTile("metal_dark_panel", 11, 0),
  sourceTile("door_wood_planks", 12, 0),
  sourceTile("stone_relief_carved", 13, 0),
  sourceTile("stone_relief_rough", 14, 0),
  sourceTile("decor_torch_sconce", 15, 0),

  sourceTile("black_panel_blank", 0, 1),
  sourceTile("rock_rubble_brown", 1, 1),
  sourceTile("lava_red_bubbling", 2, 1),
  sourceTile("decor_statue_left", 3, 1),
  sourceTile("decor_statue_right", 4, 1),
  sourceTile("plain_tan_panel", 5, 1),
  sourceTile("occult_diamond_panel", 6, 1),
  sourceTile("wood_tan_planks", 8, 1),
  sourceTile("occult_spine_panel", 9, 1),
  sourceTile("brick_gray_course", 10, 1),
  sourceTile("door_wood_ribs", 12, 1),
  sourceTile("stone_cut_block_light", 13, 1),
  sourceTile("switch_rune_gray", 14, 1),
  sourceTile("switch_rune_blue", 15, 1),

  sourceTile("stone_skull_wall", 0, 3),
  sourceTile("stone_sigil_wall", 1, 3),
  sourceTile("stone_skull_inset", 2, 3),
  sourceTile("moss_vine_wall", 3, 3),
  sourceTile("door_occult_gate", 4, 3),
  sourceTile("brick_brown_tiles", 5, 3),
  sourceTile("arcane_skull_relief", 6, 3),
  sourceTile("stained_glass_square", 7, 3),

  sourceTile("banner_arcane_gold", 0, 4),
  sourceTile("banner_arcane_blue", 1, 4),
  sourceTile("banner_flame_red", 2, 4),
  sourceTile("banner_arcane_red", 6, 4),
  sourceTile("bars_cyan_short", 11, 4),
  sourceTile("bars_cyan_grate", 13, 4),
  sourceTile("bars_cyan_columns", 15, 4),

  sourceTile("lava_orange_flow", 0, 5),
  sourceTile("rock_dark_cluster", 3, 5),
  sourceTile("portal_blue_stream_a", 4, 5),
  sourceTile("portal_blue_stream_b", 5, 5),
  sourceTile("portal_blue_stream_c", 6, 5),
  sourceTile("water_blue_fall_torch", 7, 5),
  sourceTile("wood_plain_brown", 8, 5),
  sourceTile("rock_brown_face", 9, 5),
  sourceTile("water_purple_fall", 11, 5),

  sourceTile("bars_cyan_fence", 0, 6),
  sourceTile("moss_green_block_a", 1, 6),
  sourceTile("moss_green_block_b", 2, 6),
  sourceTile("moss_green_lantern_a", 3, 6),
  sourceTile("moss_green_lantern_b", 4, 6),
  sourceTile("hazard_flesh_vein", 5, 6),
  sourceTile("portal_stained_figure", 6, 6),
  sourceTile("portal_stained_orb", 7, 6),
  sourceTile("stained_glass_round", 11, 6)
];

const WALL_ATLAS_TILE_INDEX_BY_ID = new Map(
  WALL_ATLAS_SOURCE_TILES.map((tile, index) => [tile.id, index] as const)
);

export type WallAtlasTileId = (typeof WALL_ATLAS_SOURCE_TILES)[number]["id"];

export function getWallAtlasTileIndex(tileId: string): number {
  const index = WALL_ATLAS_TILE_INDEX_BY_ID.get(tileId);
  if (index === undefined) {
    throw new Error(`Unknown wall atlas tile '${tileId}'.`);
  }
  return index;
}

export function hasWallAtlasTile(tileId: string): boolean {
  return WALL_ATLAS_TILE_INDEX_BY_ID.has(tileId);
}
