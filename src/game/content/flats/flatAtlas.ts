import type { Rect } from "./flatTypes";

export const FLAT_SHEET_URL = new URL("../assets/flats.png", import.meta.url).href;
export const FLAT_TILE_SIZE = 64;

const FLAT_TILE_STRIDE_X = 65;
const FLAT_TILE_ORIGIN_X = 1;

const FLAT_ROW_START_Y = {
  section1Row1: 16,
  section1Row2: 81,
  section1Row3: 146,
  section2Row1: 227,
  section2Row2: 292,
  originalStrip: 372
} as const;

type FlatSheetRowId = keyof typeof FLAT_ROW_START_Y;

function tile(column: number, row: FlatSheetRowId): Rect {
  return {
    x: FLAT_TILE_ORIGIN_X + (column - 1) * FLAT_TILE_STRIDE_X,
    y: FLAT_ROW_START_Y[row],
    w: FLAT_TILE_SIZE,
    h: FLAT_TILE_SIZE
  };
}

export const flatAtlasRects = {
  s1r1c1: tile(1, "section1Row1"),
  s1r1c2: tile(2, "section1Row1"),
  s1r1c3: tile(3, "section1Row1"),
  s1r1c4: tile(4, "section1Row1"),
  s1r1c5: tile(5, "section1Row1"),
  s1r1c6: tile(6, "section1Row1"),
  s1r1c7: tile(7, "section1Row1"),
  s1r1c8: tile(8, "section1Row1"),
  s1r1c9: tile(9, "section1Row1"),
  s1r1c10: tile(10, "section1Row1"),
  s1r1c11: tile(11, "section1Row1"),
  s1r1c12: tile(12, "section1Row1"),
  s1r1c13: tile(13, "section1Row1"),
  s1r1c14: tile(14, "section1Row1"),
  s1r2c1: tile(1, "section1Row2"),
  s1r2c2: tile(2, "section1Row2"),
  s1r2c3: tile(3, "section1Row2"),
  s1r2c4: tile(4, "section1Row2"),
  s1r2c5: tile(5, "section1Row2"),
  s1r2c6: tile(6, "section1Row2"),
  s1r2c7: tile(7, "section1Row2"),
  s1r2c8: tile(8, "section1Row2"),
  s1r2c9: tile(9, "section1Row2"),
  s1r2c10: tile(10, "section1Row2"),
  s1r2c11: tile(11, "section1Row2"),
  s1r2c12: tile(12, "section1Row2"),
  s1r2c13: tile(13, "section1Row2"),
  s1r2c14: tile(14, "section1Row2"),
  s1r3c1: tile(1, "section1Row3"),
  s1r3c2: tile(2, "section1Row3"),
  s1r3c3: tile(3, "section1Row3"),
  s1r3c4: tile(4, "section1Row3"),
  s1r3c5: tile(5, "section1Row3"),
  s1r3c6: tile(6, "section1Row3"),
  s1r3c7: tile(7, "section1Row3"),
  s1r3c8: tile(8, "section1Row3"),
  s1r3c9: tile(9, "section1Row3"),
  s1r3c10: tile(10, "section1Row3"),
  s1r3c11: tile(11, "section1Row3"),
  s1r3c12: tile(12, "section1Row3"),
  s1r3c13: tile(13, "section1Row3"),
  s1r3c14: tile(14, "section1Row3"),
  s2r1c1: tile(1, "section2Row1"),
  s2r1c2: tile(2, "section2Row1"),
  s2r1c3: tile(3, "section2Row1"),
  s2r1c4: tile(4, "section2Row1"),
  s2r1c5: tile(5, "section2Row1"),
  s2r1c6: tile(6, "section2Row1"),
  s2r1c7: tile(7, "section2Row1"),
  s2r1c8: tile(8, "section2Row1"),
  s2r1c9: tile(9, "section2Row1"),
  s2r1c10: tile(10, "section2Row1"),
  s2r1c11: tile(11, "section2Row1"),
  s2r1c12: tile(12, "section2Row1"),
  s2r1c13: tile(13, "section2Row1"),
  s2r1c14: tile(14, "section2Row1"),
  s2r2c1: tile(1, "section2Row2"),
  s2r2c2: tile(2, "section2Row2"),
  s2r2c3: tile(3, "section2Row2"),
  s2r2c4: tile(4, "section2Row2"),
  s2r2c5: tile(5, "section2Row2"),
  s2r2c6: tile(6, "section2Row2"),
  s2r2c7: tile(7, "section2Row2"),
  s2r2c8: tile(8, "section2Row2"),
  s2r2c9: tile(9, "section2Row2")
} as const satisfies Record<string, Rect>;

export const flatAtlasAliases = {
  originalWaterStrip: {
    aliasOf: "s1r2c12-14",
    frames: [
      tile(1, "originalStrip"),
      tile(2, "originalStrip"),
      tile(3, "originalStrip")
    ]
  }
} as const;
