import { flatAtlasAliases, flatAtlasRects } from "./flatAtlas";
import type { FlatVisual, FlatVisualId, Rect } from "./flatTypes";

function frames(...rects: Rect[]): readonly Rect[] {
  return rects;
}

function visual(
  id: FlatVisualId,
  atlasFrames: readonly Rect[],
  options: Pick<FlatVisual["anim"], "fps" | "loop"> = {}
): FlatVisual {
  return {
    id,
    anim: {
      frames: atlasFrames,
      fps: options.fps,
      loop: options.loop
    }
  };
}

export const flatVisuals = [
  visual("stoneDark", frames(flatAtlasRects.s1r1c1)),
  visual("rockBrown", frames(flatAtlasRects.s1r1c2)),
  visual("stoneBrickGray", frames(flatAtlasRects.s1r1c3)),
  visual("stoneCracked", frames(flatAtlasRects.s1r1c4)),
  visual("slimeStoneGreen", frames(flatAtlasRects.s1r1c5)),
  visual("sandstoneTan", frames(flatAtlasRects.s1r1c6)),
  visual("metalGrate", frames(flatAtlasRects.s1r1c7)),
  visual("fleshRed", frames(flatAtlasRects.s1r1c8)),
  visual("woodPlanks", frames(flatAtlasRects.s1r1c9)),
  visual("stoneWornGray", frames(flatAtlasRects.s1r1c10)),
  visual("woodBeam", frames(flatAtlasRects.s1r1c11)),
  visual("runeBlueDark", frames(flatAtlasRects.s1r1c12)),
  visual("dirtBrown", frames(flatAtlasRects.s1r1c13)),
  visual("stoneGreenMottled", frames(flatAtlasRects.s1r1c14)),
  visual("groundMurkyGreen", frames(flatAtlasRects.s1r2c1)),
  visual("runeTileBlueA", frames(flatAtlasRects.s1r2c2)),
  visual("runeTileBlueB", frames(flatAtlasRects.s1r2c3)),
  visual("runeTileBlueTrident", frames(flatAtlasRects.s1r2c4)),
  visual("runeTileBlueArrow", frames(flatAtlasRects.s1r2c5)),
  visual("woodPanelVertical", frames(flatAtlasRects.s1r2c6)),
  visual("runeTileBlueTridentVariant", frames(flatAtlasRects.s1r2c7)),
  visual("earthBrown", frames(flatAtlasRects.s1r2c8)),
  visual("metalRiveted", frames(flatAtlasRects.s1r2c9)),
  visual("metalHatchBlack", frames(flatAtlasRects.s1r2c10)),
  visual("voidBlack", frames(flatAtlasRects.s1r2c11)),
  visual("waterBlue", frames(flatAtlasRects.s1r2c12, flatAtlasRects.s1r2c13, flatAtlasRects.s1r2c14), {
    fps: 4,
    loop: true
  }),
  visual("bloodPool", frames(flatAtlasRects.s1r3c1, flatAtlasRects.s1r3c2, flatAtlasRects.s1r3c3, flatAtlasRects.s1r3c4), {
    fps: 5,
    loop: true
  }),
  visual("grayFlesh", frames(flatAtlasRects.s1r3c5, flatAtlasRects.s1r3c6, flatAtlasRects.s1r3c7), {
    fps: 4,
    loop: true
  }),
  visual(
    "chaosRuneFloor",
    frames(flatAtlasRects.s1r3c8, flatAtlasRects.s1r3c9, flatAtlasRects.s1r3c10, flatAtlasRects.s1r3c11),
    {
      fps: 5,
      loop: true
    }
  ),
  visual("energyBlue", frames(flatAtlasRects.s1r3c12, flatAtlasRects.s1r3c13, flatAtlasRects.s1r3c14), {
    fps: 5,
    loop: true
  }),
  visual("borderTileBrown", frames(flatAtlasRects.s2r1c1)),
  visual("runeTileBlueDiamond", frames(flatAtlasRects.s2r1c2)),
  visual("stoneBlocksGray", frames(flatAtlasRects.s2r1c3)),
  visual("panelGridGray", frames(flatAtlasRects.s2r1c4)),
  visual("organicCrackBrown", frames(flatAtlasRects.s2r1c5)),
  visual("medallionStoneDark", frames(flatAtlasRects.s2r1c6)),
  visual("woodBoardBrown", frames(flatAtlasRects.s2r1c7)),
  visual("ashStoneWhite", frames(flatAtlasRects.s2r1c8)),
  visual("lavaRockGround", frames(flatAtlasRects.s2r1c9)),
  visual("mossLinesGreen", frames(flatAtlasRects.s2r1c10)),
  visual("organicGreenVertical", frames(flatAtlasRects.s2r1c11)),
  visual("earthCorruptedDark", frames(flatAtlasRects.s2r1c12)),
  visual("stoneBrickMossy", frames(flatAtlasRects.s2r1c14)),
  visual("stonePlainGray", frames(flatAtlasRects.s2r2c1)),
  visual("sandstoneBlock", frames(flatAtlasRects.s2r2c2)),
  visual("rockBlack", frames(flatAtlasRects.s2r2c3)),
  visual("lava", frames(flatAtlasRects.s2r2c4, flatAtlasRects.s2r2c5, flatAtlasRects.s2r2c6, flatAtlasRects.s2r2c7), {
    fps: 5,
    loop: true
  }),
  visual("runestoneCircle", frames(flatAtlasRects.s2r2c8)),
  visual("tileDiamondBrown", frames(flatAtlasRects.s2r2c9))
] as const satisfies readonly FlatVisual[];

export const flatVisualsById = new Map<FlatVisualId, FlatVisual>(
  flatVisuals.map((definition) => [definition.id, definition])
);

export function getFlatVisual(id: FlatVisualId): FlatVisual {
  const definition = flatVisualsById.get(id);
  if (!definition) {
    throw new Error(`Unknown flat visual '${id}'.`);
  }
  return definition;
}

export function getFlatFrameIndex(visualId: FlatVisualId, elapsedTimeSeconds: number): number {
  const visual = getFlatVisual(visualId);
  const frameCount = visual.anim.frames.length;
  if (frameCount <= 1) {
    return 0;
  }

  const fps = visual.anim.fps ?? 1;
  const frameOffset = Math.max(0, Math.floor(elapsedTimeSeconds * fps));
  if (visual.anim.loop ?? true) {
    return frameOffset % frameCount;
  }
  return Math.min(frameCount - 1, frameOffset);
}

export function getFlatFrame(visualId: FlatVisualId, elapsedTimeSeconds: number): Rect {
  const visual = getFlatVisual(visualId);
  return visual.anim.frames[getFlatFrameIndex(visualId, elapsedTimeSeconds)];
}

export const originalWaterStripAlias = flatAtlasAliases.originalWaterStrip.aliasOf;
