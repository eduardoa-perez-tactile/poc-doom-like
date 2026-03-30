import type { FlatDef, FlatDefId, FlatVisualId } from "./flatTypes";

function def(
  id: FlatDefId,
  visualId: FlatVisualId,
  options: Omit<FlatDef, "id" | "visualId"> = {}
): FlatDef {
  return {
    id,
    visualId,
    ...options
  };
}

export const flatDefs = [
  def("STONE_DARK", "stoneDark"),
  def("ROCK_BROWN", "rockBrown"),
  def("STONE_BRICK_GRAY", "stoneBrickGray"),
  def("STONE_CRACKED", "stoneCracked"),
  def("SLIME_STONE_GREEN", "slimeStoneGreen"),
  def("SANDSTONE_TAN", "sandstoneTan"),
  def("METAL_GRATE", "metalGrate"),
  def("FLESH_RED", "fleshRed"),
  def("WOOD_PLANKS", "woodPlanks"),
  def("STONE_WORN_GRAY", "stoneWornGray"),
  def("WOOD_BEAM", "woodBeam"),
  def("RUNE_BLUE_DARK", "runeBlueDark"),
  def("DIRT_BROWN", "dirtBrown"),
  def("STONE_GREEN_MOTTLED", "stoneGreenMottled"),
  def("GROUND_MURKY_GREEN", "groundMurkyGreen"),
  def("RUNE_TILE_BLUE_A", "runeTileBlueA"),
  def("RUNE_TILE_BLUE_B", "runeTileBlueB"),
  def("RUNE_TILE_BLUE_TRIDENT", "runeTileBlueTrident"),
  def("RUNE_TILE_BLUE_ARROW", "runeTileBlueArrow"),
  def("WOOD_PANEL_VERTICAL", "woodPanelVertical"),
  def("EARTH_BROWN", "earthBrown"),
  def("METAL_RIVETED", "metalRiveted"),
  def("METAL_HATCH_BLACK", "metalHatchBlack"),
  def("VOID_BLACK", "voidBlack"),
  def("BORDER_TILE_BROWN", "borderTileBrown"),
  def("RUNE_TILE_BLUE_DIAMOND", "runeTileBlueDiamond"),
  def("STONE_BLOCKS_GRAY", "stoneBlocksGray"),
  def("PANEL_GRID_GRAY", "panelGridGray"),
  def("ORGANIC_CRACK_BROWN", "organicCrackBrown"),
  def("MEDALLION_STONE_DARK", "medallionStoneDark"),
  def("WOOD_BOARD_BROWN", "woodBoardBrown"),
  def("ASH_STONE_WHITE", "ashStoneWhite"),
  def("LAVA_ROCK_GROUND", "lavaRockGround"),
  def("MOSS_LINES_GREEN", "mossLinesGreen"),
  def("ORGANIC_GREEN_VERTICAL", "organicGreenVertical"),
  def("EARTH_CORRUPTED_DARK", "earthCorruptedDark"),
  def("STONE_BRICK_MOSSY", "stoneBrickMossy"),
  def("STONE_PLAIN_GRAY", "stonePlainGray"),
  def("SANDSTONE_BLOCK", "sandstoneBlock"),
  def("ROCK_BLACK", "rockBlack"),
  def("RUNESTONE_CIRCLE", "runestoneCircle"),
  def("TILE_DIAMOND_BROWN", "tileDiamondBrown"),
  def("WATER_BLUE", "waterBlue", {
    scroll: { x: 0.0125, y: 0.0075 }
  }),
  def("BLOOD_POOL", "bloodPool"),
  def("GRAY_FLESH", "grayFlesh"),
  def("CHAOS_RUNE_FLOOR", "chaosRuneFloor", {
    emissive: true
  }),
  def("ENERGY_BLUE", "energyBlue", {
    emissive: true,
    scroll: { x: 0, y: -0.02 }
  }),
  def("LAVA", "lava", {
    emissive: true,
    scroll: { x: 0.01, y: 0.006 }
  })
] as const satisfies readonly FlatDef[];

export const flatDefsById = new Map<FlatDefId, FlatDef>(
  flatDefs.map((definition) => [definition.id, definition])
);

export function getFlatDef(id: FlatDefId): FlatDef {
  const definition = flatDefsById.get(id);
  if (!definition) {
    throw new Error(`Unknown flat def '${id}'.`);
  }
  return definition;
}
