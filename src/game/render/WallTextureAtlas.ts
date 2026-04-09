import {
  DynamicTexture,
  Scene,
  Texture
} from "@babylonjs/core";
import type { WallAtlasSourceTile } from "../content/walls";

export interface WallTileUv {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export class WallTextureAtlas {
  readonly columns: number;
  readonly rows: number;

  private constructor(
    readonly texture: DynamicTexture,
    private readonly tileSize: number
  ) {
    this.columns = texture.getSize().width / tileSize;
    this.rows = texture.getSize().height / tileSize;
  }

  static async create(
    scene: Scene,
    sourceImageUrl: string,
    tiles: WallAtlasSourceTile[],
    tileSize: number,
    maxColumns = 6
  ): Promise<WallTextureAtlas> {
    const image = await loadImage(sourceImageUrl);
    const columns = Math.min(maxColumns, tiles.length);
    const rows = Math.ceil(tiles.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * tileSize;
    canvas.height = rows * tileSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to create 2D context for wall atlas.");
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);

    tiles.forEach((tile, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      context.drawImage(
        image,
        tile.sourceX,
        tile.sourceY,
        tile.sourceWidth,
        tile.sourceHeight,
        column * tileSize,
        row * tileSize,
        tileSize,
        tileSize
      );
    });

    const texture = new DynamicTexture("wall-atlas", canvas, scene, false);
    texture.hasAlpha = true;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    texture.update(false);

    return new WallTextureAtlas(texture, tileSize);
  }

  getTileUV(index: number): WallTileUv {
    const size = this.texture.getSize();
    const tileColumn = index % this.columns;
    const tileRow = Math.floor(index / this.columns);
    const inset = 0.5;
    const x = tileColumn * this.tileSize;
    const y = tileRow * this.tileSize;

    return {
      u0: (x + inset) / size.width,
      v0: (y + inset) / size.height,
      u1: (x + this.tileSize - inset) / size.width,
      v1: (y + this.tileSize - inset) / size.height
    };
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load wall texture atlas: ${url}`));
    image.src = url;
  });
}
