import type { WallTextureTypeName } from "../content/types";

const TILE_SIZE = 64;
const TILE_STRIDE = 65;
const ROW_STARTS = [16, 80, 145, 209, 504, 568, 633] as const;

export enum WallTextureType {
  Stone = "Stone",
  Brick = "Brick",
  Wood = "Wood",
  Metal = "Metal",
  Decorative = "Decorative",
  Door = "Door",
  Portal = "Portal",
  Lava = "Lava",
  Water = "Water",
  Moss = "Moss",
  Arcane = "Arcane",
  StainedGlass = "StainedGlass",
  Bars = "Bars"
}

export interface WallAtlasSourceTile {
  id: string;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export const WALL_ATLAS_SOURCE_URL = new URL("../content/assets/walls.png", import.meta.url).href;
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

export const WALL_ATLAS_SOURCE_TILES: WallAtlasSourceTile[] = [
  sourceTile("stone_gray_panel", 0, 0),
  sourceTile("stone_dark_block", 1, 0),
  sourceTile("stone_carved_relief", 13, 0),
  sourceTile("stone_rocky_face", 14, 0),
  sourceTile("brick_gray_course", 10, 1),
  sourceTile("brick_brown_tiles", 5, 3),
  sourceTile("brick_brown_planks", 9, 1),
  sourceTile("wood_crossbeam", 2, 0),
  sourceTile("wood_lattice_dark", 5, 0),
  sourceTile("wood_ringed_panel", 8, 1),
  sourceTile("wood_light_planks", 7, 1),
  sourceTile("metal_dark_panel", 11, 0),
  sourceTile("metal_arcane_panel", 6, 1),
  sourceTile("decor_statue_left", 3, 1),
  sourceTile("decor_statue_right", 4, 1),
  sourceTile("decor_torch_sconce", 15, 0),
  sourceTile("decor_banner_gold", 4, 4),
  sourceTile("door_wood_planks", 12, 0),
  sourceTile("door_arcane_gate", 4, 3),
  sourceTile("lava_red_pool", 2, 1),
  sourceTile("lava_orange_flow", 0, 5),
  sourceTile("water_blue_fall", 3, 5),
  sourceTile("water_blue_fall_torch", 6, 5),
  sourceTile("water_purple_fall", 11, 5),
  sourceTile("moss_cobweb_vine", 3, 3),
  sourceTile("moss_green_block_a", 1, 6),
  sourceTile("moss_green_block_b", 3, 6),
  sourceTile("arcane_blue_diamond", 8, 4),
  sourceTile("arcane_skull_relief", 2, 3),
  sourceTile("stained_glass_square", 6, 3),
  sourceTile("stained_glass_figure", 10, 6),
  sourceTile("stained_glass_round", 11, 6),
  sourceTile("bars_cyan_grate", 13, 4),
  sourceTile("bars_cyan_columns", 15, 4)
];

export const WallTextureRegistry: Record<WallTextureType, number[]> = {
  [WallTextureType.Stone]: [0, 1, 2, 3],
  [WallTextureType.Brick]: [4, 5, 6],
  [WallTextureType.Wood]: [7, 8, 9, 10, 17],
  [WallTextureType.Metal]: [11, 12],
  [WallTextureType.Decorative]: [13, 14, 15, 16, 28],
  [WallTextureType.Door]: [18],
  [WallTextureType.Portal]: [31],
  [WallTextureType.Lava]: [19, 20],
  [WallTextureType.Water]: [21, 22, 23],
  [WallTextureType.Moss]: [24, 25, 26],
  [WallTextureType.Arcane]: [12, 18, 27, 28],
  [WallTextureType.StainedGlass]: [29, 30, 31],
  [WallTextureType.Bars]: [32, 33]
};

export function wallTextureTypeFromName(name: WallTextureTypeName | undefined): WallTextureType | null {
  if (!name) {
    return null;
  }

  switch (name) {
    case "Stone":
      return WallTextureType.Stone;
    case "Brick":
      return WallTextureType.Brick;
    case "Wood":
      return WallTextureType.Wood;
    case "Metal":
      return WallTextureType.Metal;
    case "Decorative":
      return WallTextureType.Decorative;
    case "Door":
      return WallTextureType.Door;
    case "Portal":
      return WallTextureType.Portal;
    case "Lava":
      return WallTextureType.Lava;
    case "Water":
      return WallTextureType.Water;
    case "Moss":
      return WallTextureType.Moss;
    case "Arcane":
      return WallTextureType.Arcane;
    case "StainedGlass":
      return WallTextureType.StainedGlass;
    case "Bars":
      return WallTextureType.Bars;
  }
}

export function pickTexture(
  type: WallTextureType,
  x: number,
  y: number,
  neighborTextureIndices: number[] = []
): number {
  const pool = WallTextureRegistry[type];
  if (pool.length === 0) {
    throw new Error(`No wall textures registered for ${type}.`);
  }

  const hashed = wallHash(x, y, type);
  let textureIndex = pool[hashed % pool.length];

  if (pool.length === 1) {
    return textureIndex;
  }

  const blocked = new Set(neighborTextureIndices);
  for (let offset = 1; offset < pool.length && blocked.has(textureIndex); offset += 1) {
    textureIndex = pool[(hashed + offset) % pool.length];
  }

  return textureIndex;
}

function wallHash(x: number, y: number, type: WallTextureType): number {
  let hash = (x * 73856093) ^ (y * 19349663) ^ (type.length * 83492791);
  hash ^= hash >>> 13;
  return Math.abs(hash);
}
