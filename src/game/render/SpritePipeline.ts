import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Node,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer
} from "@babylonjs/core";
import type {
  DirectionalSpriteClipDefinition,
  SpriteAnimationStateName,
  SpriteFrameDefinition,
  SpriteSetDefinition,
  SpriteSheetDefinition,
  VisualDatabaseDefinition
} from "../content/types";
import { TAU, normalizeAngle } from "../core/math";
import type { SpriteRuntimeState } from "../core/types";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface CompiledSpriteSheet {
  definition: SpriteSheetDefinition;
  texture: DynamicTexture;
  width: number;
  height: number;
}

interface CompiledSpriteFrame {
  definition: SpriteFrameDefinition;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

interface CompiledSpriteClip {
  id: string;
  frames: CompiledSpriteFrame[];
  fps: number;
  loop: boolean;
}

interface CompiledDirectionalClip {
  clip: CompiledSpriteClip;
  mirrorX: boolean;
}

interface CompiledSpriteSet {
  definition: SpriteSetDefinition;
  material: StandardMaterial;
  animations: Map<SpriteAnimationStateName, CompiledDirectionalClip[]>;
}

export class SpriteLibrary {
  private readonly sheets = new Map<string, CompiledSpriteSheet>();
  private readonly spriteSets = new Map<string, CompiledSpriteSet>();
  private readonly visuals = new Map<string, string>();

  private constructor(private readonly scene: Scene) {}

  static async create(scene: Scene, database: VisualDatabaseDefinition): Promise<SpriteLibrary> {
    const library = new SpriteLibrary(scene);

    const compiledSheets = await Promise.all(
      database.sheets.map(async (definition) => [definition.id, await compileSpriteSheet(scene, definition)] as const)
    );
    for (const [id, sheet] of compiledSheets) {
      library.sheets.set(id, sheet);
    }

    for (const spriteSetDefinition of database.spriteSets) {
      library.spriteSets.set(spriteSetDefinition.id, library.compileSpriteSet(spriteSetDefinition));
    }

    for (const visualDefinition of database.entities) {
      library.visuals.set(visualDefinition.entityId, visualDefinition.spriteSetId);
    }

    return library;
  }

  createSpriteForEntity(
    entityId: string,
    mode: "world" | "view",
    parent?: Node
  ): AnimatedSpriteInstance {
    const spriteSetId = this.visuals.get(entityId);
    if (!spriteSetId) {
      throw new Error(`No sprite set registered for entity visual: ${entityId}`);
    }

    const spriteSet = this.spriteSets.get(spriteSetId);
    if (!spriteSet) {
      throw new Error(`Unknown sprite set: ${spriteSetId}`);
    }

    return new AnimatedSpriteInstance(this.scene, spriteSet, mode, parent);
  }

  private compileSpriteSet(definition: SpriteSetDefinition): CompiledSpriteSet {
    const sheet = this.sheets.get(definition.sheetId);
    if (!sheet) {
      throw new Error(`Unknown sprite sheet: ${definition.sheetId}`);
    }

    const frames = new Map<string, CompiledSpriteFrame>();
    for (const frameDefinition of definition.frames) {
      frames.set(frameDefinition.id, compileFrame(frameDefinition, sheet));
    }

    const clips = new Map<string, CompiledSpriteClip>();
    for (const clipDefinition of definition.clips) {
      clips.set(clipDefinition.id, {
        id: clipDefinition.id,
        frames: clipDefinition.frames.map((frameId) => {
          const frame = frames.get(frameId);
          if (!frame) {
            throw new Error(`Missing sprite frame '${frameId}' in set '${definition.id}'.`);
          }
          return frame;
        }),
        fps: clipDefinition.fps,
        loop: clipDefinition.loop
      });
    }

    const animations = new Map<SpriteAnimationStateName, CompiledDirectionalClip[]>();
    for (const animationDefinition of definition.animations) {
      animations.set(
        animationDefinition.state,
        animationDefinition.directionalClips.map((directionalClip) =>
          compileDirectionalClip(directionalClip, clips, definition.id)
        )
      );
    }

    const material = new StandardMaterial(`${definition.id}-material`, this.scene);
    material.diffuseTexture = sheet.texture;
    material.opacityTexture = sheet.texture;
    material.useAlphaFromDiffuseTexture = true;
    material.emissiveTexture = sheet.texture;
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;
    if (!definition.viewModel) {
      material.zOffset = -2;
      material.zOffsetUnits = -2;
    }

    return {
      definition,
      material,
      animations
    };
  }
}

export class AnimatedSpriteInstance {
  readonly mesh: Mesh;
  readonly runtime: SpriteRuntimeState;

  private readonly uvData = new Float32Array(8);
  private readonly basePosition = new Vector3();
  private animationState: SpriteAnimationStateName;
  private animationRevision = -1;
  private facingAngle = 0;
  private worldX = 0;
  private worldY = 0;
  private lastFrameId = "";
  private lastMirrorX = false;
  private frameOffsetX = 0;
  private frameOffsetY = 0;
  private readonly worldFacing: "billboard" | "direction";

  constructor(
    scene: Scene,
    private readonly spriteSet: CompiledSpriteSet,
    mode: "world" | "view",
    parent?: Node
  ) {
    this.worldFacing = spriteSet.definition.worldFacing ?? "billboard";
    this.mesh = MeshBuilder.CreatePlane(
      `${spriteSet.definition.id}-${mode}`,
      {
        width: spriteSet.definition.worldWidth,
        height: spriteSet.definition.worldHeight
      },
      scene
    );
    this.mesh.material = spriteSet.material;
    this.mesh.isPickable = false;
    this.mesh.setVerticesData(VertexBuffer.UVKind, this.uvData, true, 2);
    this.mesh.renderingGroupId = mode === "view" ? 1 : 0;

    if (mode === "world") {
      this.mesh.billboardMode =
        this.worldFacing === "billboard"
          ? AbstractMesh.BILLBOARDMODE_Y
          : AbstractMesh.BILLBOARDMODE_NONE;
    } else if (parent) {
      this.mesh.parent = parent;
    }

    this.runtime = {
      animationState: spriteSet.definition.defaultState,
      animationTime: 0,
      directionIndex: 0,
      finished: false
    };
    this.animationState = spriteSet.definition.defaultState;

    const initialDirections = spriteSet.animations.get(spriteSet.definition.defaultState);
    const initialFrame = initialDirections?.[0]?.clip.frames[0];
    if (!initialFrame) {
      throw new Error(`Sprite set '${spriteSet.definition.id}' does not define any usable frames.`);
    }
    this.applyFrame(initialFrame, false);
  }

  get anchorOffsetY(): number {
    return this.spriteSet.definition.anchorOffsetY;
  }

  get usesGroundPlacement(): boolean {
    return this.spriteSet.definition.verticalPlacement === "grounded";
  }

  get baseWorldHeight(): number {
    return this.spriteSet.definition.worldHeight;
  }

  get viewModel() {
    return this.spriteSet.definition.viewModel;
  }

  setVisible(visible: boolean): void {
    this.mesh.setEnabled(visible);
  }

  setAnimationState(state: SpriteAnimationStateName, revision?: number): void {
    const shouldRestart = revision !== undefined && revision !== this.animationRevision;
    if (this.animationState === state && !shouldRestart) {
      return;
    }
    this.animationState = state;
    if (revision !== undefined) {
      this.animationRevision = revision;
    }
    this.runtime.animationState = state;
    this.runtime.animationTime = 0;
    this.runtime.finished = false;
    this.lastFrameId = "";
  }

  setAnimationTime(time: number): void {
    this.runtime.animationTime = time;
  }

  setPosition(x: number, z: number, y: number): void {
    this.worldX = x;
    this.worldY = z;
    this.basePosition.set(x, y, z);
    this.syncMeshPosition();
  }

  setFacingAngle(angle: number): void {
    this.facingAngle = angle;
    if (this.worldFacing === "direction") {
      // Plane width runs along local +X, so rotate around Y to align the sprite's
      // horizontal travel direction with the projectile velocity on the XZ plane.
      this.mesh.rotation.y = -angle;
    }
  }

  setUniformScale(scale: number): void {
    this.mesh.scaling.x = scale;
    this.mesh.scaling.y = scale;
    this.syncMeshPosition();
  }

  update(dt: number, viewerX?: number, viewerY?: number): void {
    this.runtime.animationTime += dt;
    const directions =
      this.spriteSet.animations.get(this.animationState) ??
      this.spriteSet.animations.get(this.spriteSet.definition.defaultState);

    if (!directions || directions.length === 0) {
      return;
    }

    const directionIndex =
      directions.length <= 1 || viewerX === undefined || viewerY === undefined
        ? 0
        : resolveDirectionIndex(
            this.facingAngle,
            Math.atan2(viewerY - this.worldY, viewerX - this.worldX),
            directions.length
          );
    this.runtime.directionIndex = directionIndex;

    const directionalClip = directions[Math.min(directionIndex, directions.length - 1)];
    const clip = directionalClip.clip;
    const frameOffset = Math.floor(this.runtime.animationTime * clip.fps);
    const frame =
      clip.frames[
        clip.loop
          ? frameOffset % clip.frames.length
          : Math.min(clip.frames.length - 1, frameOffset)
      ];

    if (!clip.loop && frameOffset >= clip.frames.length - 1) {
      this.runtime.finished = true;
    }

    this.applyFrame(frame, directionalClip.mirrorX);
  }

  dispose(): void {
    this.mesh.dispose();
  }

  private applyFrame(frame: CompiledSpriteFrame, mirrorX: boolean): void {
    const flipX =
      (this.spriteSet.definition.flipX ?? false) || (this.spriteSet.definition.viewModel?.flipX ?? false);
    const flipY =
      (this.spriteSet.definition.flipY ?? false) || (this.spriteSet.definition.viewModel?.flipY ?? false);
    const effectiveMirrorX = mirrorX !== flipX;
    const topV = flipY ? frame.v1 : frame.v0;
    const bottomV = flipY ? frame.v0 : frame.v1;

    if (this.lastFrameId === frame.definition.id && this.lastMirrorX === effectiveMirrorX) {
      return;
    }
    this.lastFrameId = frame.definition.id;
    this.lastMirrorX = effectiveMirrorX;

    const leftU = effectiveMirrorX ? frame.u1 : frame.u0;
    const rightU = effectiveMirrorX ? frame.u0 : frame.u1;

    this.uvData[0] = leftU;
    this.uvData[1] = topV;
    this.uvData[2] = rightU;
    this.uvData[3] = topV;
    this.uvData[4] = rightU;
    this.uvData[5] = bottomV;
    this.uvData[6] = leftU;
    this.uvData[7] = bottomV;
    this.mesh.updateVerticesData(VertexBuffer.UVKind, this.uvData, false, false);
    this.frameOffsetX = frame.definition.offsetX ?? 0;
    this.frameOffsetY = frame.definition.offsetY ?? 0;
    this.syncMeshPosition();
  }

  private syncMeshPosition(): void {
    const scaledWidth = this.spriteSet.definition.worldWidth * this.mesh.scaling.x;
    const scaledHeight = this.spriteSet.definition.worldHeight * this.mesh.scaling.y;
    const pivotX = this.spriteSet.definition.pivotX ?? 0.5;
    const pivotOffsetX = (0.5 - pivotX) * scaledWidth;
    const placement = this.spriteSet.definition.verticalPlacement ?? "anchor";
    const groundClearance = this.spriteSet.definition.groundClearance ?? 0;
    const pivotY = this.spriteSet.definition.pivotY ?? 0.5;
    const meshY =
      placement === "grounded"
        ? this.basePosition.y + groundClearance + scaledHeight * 0.5 + this.frameOffsetY
        : this.basePosition.y + (pivotY - 0.5) * scaledHeight + this.frameOffsetY;
    this.mesh.position.set(
      this.basePosition.x + pivotOffsetX + this.frameOffsetX,
      meshY,
      this.basePosition.z
    );
  }
}

function compileDirectionalClip(
  definition: DirectionalSpriteClipDefinition,
  clips: Map<string, CompiledSpriteClip>,
  spriteSetId: string
): CompiledDirectionalClip {
  const clip = clips.get(definition.clipId);
  if (!clip) {
    throw new Error(`Missing sprite clip '${definition.clipId}' in set '${spriteSetId}'.`);
  }

  return {
    clip,
    mirrorX: definition.mirrorX ?? false
  };
}

function compileFrame(
  definition: SpriteFrameDefinition,
  sheet: CompiledSpriteSheet
): CompiledSpriteFrame {
  const u0 = (definition.x + 0.5) / sheet.width;
  const u1 = (definition.x + definition.width - 0.5) / sheet.width;
  // The source atlases are defined in canvas/image space with a top-left origin.
  // DynamicTexture sampling here expects that same row ordering, so we keep the
  // vertical range in top-to-bottom sheet order and let flipY handle per-sprite
  // orientation without selecting the wrong atlas row.
  const v0 = (definition.y + 0.5) / sheet.height;
  const v1 = (definition.y + definition.height - 0.5) / sheet.height;

  return {
    definition,
    u0,
    u1,
    v0,
    v1
  };
}

function resolveDirectionIndex(entityFacingAngle: number, angleToViewer: number, directionCount: number): number {
  const relative = normalizeAngle(angleToViewer - entityFacingAngle);
  const bucket = Math.round(relative / (TAU / directionCount));
  return ((bucket % directionCount) + directionCount) % directionCount;
}

async function compileSpriteSheet(
  scene: Scene,
  definition: SpriteSheetDefinition
): Promise<CompiledSpriteSheet> {
  const canvas = await loadProcessedCanvas(definition);
  const texture = new DynamicTexture(`${definition.id}-sheet`, canvas, scene, false);
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  texture.update(false);

  return {
    definition,
    texture,
    width: canvas.width,
    height: canvas.height
  };
}

async function loadProcessedCanvas(definition: SpriteSheetDefinition): Promise<HTMLCanvasElement> {
  const image = await loadImage(definition.imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(`Unable to create 2D context for sprite sheet '${definition.id}'.`);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  for (const clearRect of definition.clearRects ?? []) {
    context.clearRect(clearRect.x, clearRect.y, clearRect.width, clearRect.height);
  }

  const chromaKeys = definition.chromaKeyColors.map(parseHexColor);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Exact color replacement keeps the keyed backgrounds clean without touching actual sprite colors.
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];

    if (chromaKeys.some((color) => color.r === red && color.g === green && color.b === blue)) {
      pixels[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load sprite sheet: ${url}`));
    image.src = url;
  });
}

function parseHexColor(value: string): RgbColor {
  const normalized = value.replace("#", "");
  if (normalized.length !== 6) {
    throw new Error(`Unsupported chroma key color: ${value}`);
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}
