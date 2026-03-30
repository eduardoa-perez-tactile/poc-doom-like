import {
  Color3,
  DynamicTexture,
  Scene,
  StandardMaterial,
  Texture
} from "@babylonjs/core";
import {
  FLAT_TILE_SIZE,
  FLAT_SHEET_URL,
  getFlatDef,
  getFlatFrameIndex,
  getFlatVisual,
  type FlatDef,
  type FlatDefId,
  type FlatVisual
} from "../../content/flats";
import type { LevelDefinition } from "../../content/types";

interface FlatRuntimeMaterial {
  def: FlatDef;
  visual: FlatVisual;
  material: StandardMaterial;
  texture: DynamicTexture;
  context: CanvasRenderingContext2D;
  currentFrameIndex: number;
}

export class FlatMaterialSystem {
  private readonly runtimeByFlatId = new Map<FlatDefId, FlatRuntimeMaterial>();
  private elapsedTime = 0;

  private constructor(
    private readonly scene: Scene,
    private readonly atlasImage: HTMLImageElement,
    private readonly repeatU: number,
    private readonly repeatV: number
  ) {}

  static async create(scene: Scene, level: LevelDefinition): Promise<FlatMaterialSystem> {
    const atlasImage = await loadImage(FLAT_SHEET_URL);
    return new FlatMaterialSystem(
      scene,
      atlasImage,
      Math.max(1, level.grid[0]?.length ?? 1),
      Math.max(1, level.grid.length)
    );
  }

  getFlatMaterial(flatId: FlatDefId): StandardMaterial {
    let runtime = this.runtimeByFlatId.get(flatId);
    if (!runtime) {
      runtime = this.createRuntime(flatId);
      this.runtimeByFlatId.set(flatId, runtime);
    }
    return runtime.material;
  }

  update(dt: number): void {
    this.elapsedTime += dt;

    for (const runtime of this.runtimeByFlatId.values()) {
      const nextFrameIndex = getFlatFrameIndex(runtime.def.visualId, this.elapsedTime);
      if (nextFrameIndex !== runtime.currentFrameIndex) {
        this.applyFrame(runtime, nextFrameIndex);
      }

      if (runtime.def.scroll) {
        runtime.texture.uOffset = wrapUnit(this.elapsedTime * runtime.def.scroll.x);
        runtime.texture.vOffset = wrapUnit(this.elapsedTime * runtime.def.scroll.y);
      }
    }
  }

  dispose(): void {
    for (const runtime of this.runtimeByFlatId.values()) {
      runtime.material.dispose(false, true);
    }
    this.runtimeByFlatId.clear();
  }

  private createRuntime(flatId: FlatDefId): FlatRuntimeMaterial {
    const def = getFlatDef(flatId);
    const visual = getFlatVisual(def.visualId);
    const texture = new DynamicTexture(
      `flat-${flatId.toLowerCase()}-texture`,
      { width: FLAT_TILE_SIZE, height: FLAT_TILE_SIZE },
      this.scene,
      false
    );
    const context = texture.getContext() as CanvasRenderingContext2D;
    context.imageSmoothingEnabled = false;
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.uScale = this.repeatU;
    texture.vScale = this.repeatV;
    texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);

    const material = new StandardMaterial(`flat-${flatId.toLowerCase()}-material`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.emissiveColor = def.emissive ? Color3.White() : Color3.FromInts(176, 176, 176);
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;

    const runtime: FlatRuntimeMaterial = {
      def,
      visual,
      material,
      texture,
      context,
      currentFrameIndex: -1
    };

    this.applyFrame(runtime, 0);
    return runtime;
  }

  private applyFrame(runtime: FlatRuntimeMaterial, frameIndex: number): void {
    const frame = runtime.visual.anim.frames[frameIndex] ?? runtime.visual.anim.frames[0];
    runtime.context.clearRect(0, 0, FLAT_TILE_SIZE, FLAT_TILE_SIZE);
    runtime.context.drawImage(
      this.atlasImage,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      FLAT_TILE_SIZE,
      FLAT_TILE_SIZE
    );
    runtime.texture.update(false);
    runtime.currentFrameIndex = frameIndex;
  }
}

function wrapUnit(value: number): number {
  const wrapped = value % 1;
  return wrapped >= 0 ? wrapped : wrapped + 1;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load flat texture sheet: ${url}`));
    image.src = url;
  });
}
