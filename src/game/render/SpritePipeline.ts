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
  VertexBuffer
} from "@babylonjs/core";
import type {
  SpriteAnimationStateName,
  SpriteAtlasDefinition,
  SpriteClipDefinition,
  SpriteSetDefinition,
  VisualDatabaseDefinition
} from "../content/types";
import { TAU, normalizeAngle } from "../core/math";
import type { SpriteRuntimeState } from "../core/types";

interface CompiledSpriteAtlas {
  definition: SpriteAtlasDefinition;
  texture: DynamicTexture;
  uStep: number;
  vStep: number;
}

interface CompiledSpriteClip {
  id: string;
  frames: number[];
  fps: number;
  loop: boolean;
}

interface CompiledSpriteSet {
  definition: SpriteSetDefinition;
  atlas: CompiledSpriteAtlas;
  material: StandardMaterial;
  animations: Map<SpriteAnimationStateName, CompiledSpriteClip[]>;
}

export class SpriteLibrary {
  private readonly atlases = new Map<string, CompiledSpriteAtlas>();
  private readonly spriteSets = new Map<string, CompiledSpriteSet>();
  private readonly visuals = new Map<string, string>();

  constructor(private readonly scene: Scene, database: VisualDatabaseDefinition) {
    for (const atlasDefinition of database.atlases) {
      this.atlases.set(atlasDefinition.id, this.compileAtlas(atlasDefinition));
    }

    for (const spriteSetDefinition of database.spriteSets) {
      this.spriteSets.set(spriteSetDefinition.id, this.compileSpriteSet(spriteSetDefinition));
    }

    for (const visualDefinition of database.entities) {
      this.visuals.set(visualDefinition.entityId, visualDefinition.spriteSetId);
    }
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

  private compileAtlas(definition: SpriteAtlasDefinition): CompiledSpriteAtlas {
    const texture = new DynamicTexture(
      `${definition.id}-atlas`,
      {
        width: definition.frameWidth * definition.columns,
        height: definition.frameHeight * definition.rows
      },
      this.scene,
      true
    );
    texture.hasAlpha = true;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    generateAtlas(texture, definition);

    return {
      definition,
      texture,
      uStep: 1 / definition.columns,
      vStep: 1 / definition.rows
    };
  }

  private compileSpriteSet(definition: SpriteSetDefinition): CompiledSpriteSet {
    const atlas = this.atlases.get(definition.atlasId);
    if (!atlas) {
      throw new Error(`Unknown sprite atlas: ${definition.atlasId}`);
    }

    const clips = new Map<string, CompiledSpriteClip>();
    for (const clipDefinition of definition.clips) {
      clips.set(clipDefinition.id, compileClip(clipDefinition));
    }

    const animations = new Map<SpriteAnimationStateName, CompiledSpriteClip[]>();
    for (const animationDefinition of definition.animations) {
      const directionalClips = animationDefinition.directionalClips.map((clipId) => {
        const clip = clips.get(clipId);
        if (!clip) {
          throw new Error(`Missing sprite clip '${clipId}' in set '${definition.id}'.`);
        }
        return clip;
      });
      animations.set(animationDefinition.state, directionalClips);
    }

    const material = new StandardMaterial(`${definition.id}-material`, this.scene);
    material.diffuseTexture = atlas.texture;
    material.opacityTexture = atlas.texture;
    material.useAlphaFromDiffuseTexture = true;
    material.emissiveTexture = atlas.texture;
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;

    return {
      definition,
      atlas,
      material,
      animations
    };
  }
}

export class AnimatedSpriteInstance {
  readonly mesh: Mesh;
  readonly runtime: SpriteRuntimeState;
  private readonly uvData = new Float32Array(8);
  private animationState: SpriteAnimationStateName;
  private facingAngle = 0;
  private worldX = 0;
  private worldY = 0;
  private lastFrame = -1;

  constructor(
    private readonly scene: Scene,
    private readonly spriteSet: CompiledSpriteSet,
    mode: "world" | "view",
    parent?: Node
  ) {
    this.mesh = MeshBuilder.CreatePlane(
      `${spriteSet.definition.id}-${mode}`,
      {
        width: spriteSet.definition.worldWidth,
        height: spriteSet.definition.worldHeight
      },
      this.scene
    );
    this.mesh.material = spriteSet.material;
    this.mesh.isPickable = false;
    this.mesh.setVerticesData(VertexBuffer.UVKind, this.uvData, true, 2);
    this.mesh.renderingGroupId = mode === "view" ? 1 : 0;

    if (mode === "world") {
      this.mesh.billboardMode = AbstractMesh.BILLBOARDMODE_Y;
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
    this.applyFrame(0);
  }

  get anchorOffsetY(): number {
    return this.spriteSet.definition.anchorOffsetY;
  }

  setVisible(visible: boolean): void {
    this.mesh.setEnabled(visible);
  }

  setAnimationState(state: SpriteAnimationStateName): void {
    if (this.animationState === state) {
      return;
    }
    this.animationState = state;
    this.runtime.animationState = state;
    this.runtime.animationTime = 0;
    this.runtime.finished = false;
    this.lastFrame = -1;
  }

  setPosition(x: number, z: number, y: number): void {
    this.worldX = x;
    this.worldY = z;
    this.mesh.position.set(x, y, z);
  }

  setFacingAngle(angle: number): void {
    this.facingAngle = angle;
  }

  update(dt: number, viewerX?: number, viewerY?: number): void {
    this.runtime.animationTime += dt;
    const clips =
      this.spriteSet.animations.get(this.animationState) ??
      this.spriteSet.animations.get(this.spriteSet.definition.defaultState);

    if (!clips || clips.length === 0) {
      return;
    }

    const directionIndex =
      clips.length <= 1 || viewerX === undefined || viewerY === undefined
        ? 0
        : resolveDirectionIndex(this.facingAngle, Math.atan2(viewerY - this.worldY, viewerX - this.worldX), clips.length);
    this.runtime.directionIndex = directionIndex;

    const clip = clips[Math.min(directionIndex, clips.length - 1)];
    const frameIndex = clip.loop
      ? clip.frames[Math.floor(this.runtime.animationTime * clip.fps) % clip.frames.length]
      : clip.frames[Math.min(clip.frames.length - 1, Math.floor(this.runtime.animationTime * clip.fps))];

    if (!clip.loop && this.runtime.animationTime * clip.fps >= clip.frames.length - 1) {
      this.runtime.finished = true;
    }

    this.applyFrame(frameIndex);
  }

  dispose(): void {
    this.mesh.dispose();
  }

  private applyFrame(frameIndex: number): void {
    if (this.lastFrame === frameIndex) {
      return;
    }
    this.lastFrame = frameIndex;

    const atlas = this.spriteSet.atlas;
    const col = frameIndex % atlas.definition.columns;
    const row = Math.floor(frameIndex / atlas.definition.columns);
    const u0 = col * atlas.uStep;
    const u1 = u0 + atlas.uStep;
    const v1 = 1 - row * atlas.vStep;
    const v0 = v1 - atlas.vStep;

    this.uvData[0] = u0;
    this.uvData[1] = v0;
    this.uvData[2] = u1;
    this.uvData[3] = v0;
    this.uvData[4] = u1;
    this.uvData[5] = v1;
    this.uvData[6] = u0;
    this.uvData[7] = v1;
    this.mesh.updateVerticesData(VertexBuffer.UVKind, this.uvData, false, false);
  }
}

function compileClip(definition: SpriteClipDefinition): CompiledSpriteClip {
  return {
    id: definition.id,
    frames: Array.from({ length: definition.length }, (_, index) => definition.startFrame + index),
    fps: definition.fps,
    loop: definition.loop
  };
}

function resolveDirectionIndex(entityFacingAngle: number, angleToViewer: number, directionCount: number): number {
  const relative = normalizeAngle(angleToViewer - entityFacingAngle);
  const bucket = Math.round(relative / (TAU / directionCount));
  return ((bucket % directionCount) + directionCount) % directionCount;
}

function generateAtlas(texture: DynamicTexture, definition: SpriteAtlasDefinition): void {
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  const width = definition.frameWidth * definition.columns;
  const height = definition.frameHeight * definition.rows;
  context.clearRect(0, 0, width, height);

  const frameCount = definition.columns * definition.rows;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const col = frameIndex % definition.columns;
    const row = Math.floor(frameIndex / definition.columns);
    const x = col * definition.frameWidth;
    const y = row * definition.frameHeight;
    context.save();
    context.translate(x, y);
    drawFrame(context, definition.generatorId, frameIndex, definition.frameWidth, definition.frameHeight);
    context.restore();
  }

  texture.update();
}

function drawFrame(
  context: CanvasRenderingContext2D,
  generatorId: string,
  frameIndex: number,
  width: number,
  height: number
): void {
  context.clearRect(0, 0, width, height);

  switch (generatorId) {
    case "grave_thrall":
      drawGraveThrallFrame(context, frameIndex, width, height);
      break;
    case "health_pickup":
      drawHealthPickupFrame(context, frameIndex, width, height);
      break;
    case "ammo_pickup":
      drawAmmoPickupFrame(context, frameIndex, width, height);
      break;
    case "ember_wand":
      drawWeaponFrame(context, frameIndex, width, height, "#cf8a55", "#5a2b18");
      break;
    case "shard_caster":
      drawWeaponFrame(context, frameIndex, width, height, "#8ad6ff", "#20415c");
      break;
    case "ember_projectile":
      drawProjectileFrame(context, frameIndex, width, height, "#f8a56a", "#fff4cc");
      break;
    case "shard_projectile":
      drawProjectileFrame(context, frameIndex, width, height, "#84d9ff", "#eefcff");
      break;
  }
}

function drawGraveThrallFrame(
  context: CanvasRenderingContext2D,
  frameIndex: number,
  width: number,
  height: number
): void {
  const decoded = decodeThrallFrame(frameIndex);
  const centerX = width * 0.5;
  const floorY = height - 4;
  const stride = decoded.state === "move" ? (decoded.frame % 2 === 0 ? -2 : 2) : 0;
  const reach = decoded.state === "attack" ? 8 + decoded.frame * 3 : 4;
  const deathDrop = decoded.state === "death" ? decoded.frame * 6 : 0;
  const torsoHeight = decoded.state === "death" ? 18 - decoded.frame * 3 : 24;
  const bodyOffset = (decoded.direction - 3.5) * 1.1;

  context.fillStyle = "rgba(0, 0, 0, 0.18)";
  context.fillRect(centerX - 14, floorY - 4, 28, 4);

  context.fillStyle = decoded.state === "hurt" ? "#c77474" : "#8db08d";
  context.fillRect(centerX - 9 + bodyOffset, floorY - deathDrop - torsoHeight, 18, torsoHeight);

  context.fillStyle = "#263926";
  context.fillRect(centerX - 6 + bodyOffset, floorY - deathDrop - torsoHeight - 12, 12, 12);

  context.fillStyle = "#cfdcab";
  context.fillRect(centerX - 5 + bodyOffset + decoded.direction * 0.2, floorY - deathDrop - torsoHeight - 8, 3, 3);
  context.fillRect(centerX + 2 + bodyOffset + decoded.direction * 0.2, floorY - deathDrop - torsoHeight - 8, 3, 3);

  if (decoded.state !== "death") {
    context.fillStyle = "#415a41";
    context.fillRect(centerX - 14 + bodyOffset - reach * 0.45, floorY - deathDrop - torsoHeight + 3, 8 + reach, 4);
    context.fillRect(centerX - 6 + bodyOffset + stride, floorY - deathDrop, 4, 8);
    context.fillRect(centerX + 2 + bodyOffset - stride, floorY - deathDrop, 4, 8);
  } else {
    context.fillStyle = "#334333";
    context.fillRect(centerX - 14 + bodyOffset, floorY - 5 - decoded.frame, 28, 6);
  }
}

function decodeThrallFrame(frameIndex: number): {
  state: SpriteAnimationStateName;
  direction: number;
  frame: number;
} {
  if (frameIndex < 8) {
    return { state: "idle", direction: frameIndex, frame: 0 };
  }
  if (frameIndex < 24) {
    const local = frameIndex - 8;
    return { state: "move", direction: Math.floor(local / 2), frame: local % 2 };
  }
  if (frameIndex < 40) {
    const local = frameIndex - 24;
    return { state: "attack", direction: Math.floor(local / 2), frame: local % 2 };
  }
  if (frameIndex < 48) {
    return { state: "hurt", direction: frameIndex - 40, frame: 0 };
  }
  const local = frameIndex - 48;
  return { state: "death", direction: Math.floor(local / 4), frame: local % 4 };
}

function drawHealthPickupFrame(
  context: CanvasRenderingContext2D,
  frameIndex: number,
  width: number,
  height: number
): void {
  const pulse = 1 + ((frameIndex % 8) - 3.5) * 0.02;
  context.fillStyle = "rgba(0,0,0,0.18)";
  context.fillRect(7, height - 8, width - 14, 4);
  context.fillStyle = "#d45454";
  context.fillRect(10, 8, 12 * pulse, 16 * pulse);
  context.fillStyle = "#ffe3d1";
  context.fillRect(14, 12, 4, 12);
  context.fillRect(10, 16, 12, 4);
}

function drawAmmoPickupFrame(
  context: CanvasRenderingContext2D,
  frameIndex: number,
  width: number,
  height: number
): void {
  const tilt = (frameIndex % 8) - 3.5;
  context.fillStyle = "rgba(0,0,0,0.18)";
  context.fillRect(6, height - 8, width - 12, 4);
  context.fillStyle = "#76a2d9";
  context.fillRect(8 + tilt * 0.3, 10, 16, 10);
  context.fillStyle = "#eef8ff";
  context.fillRect(10 + tilt * 0.3, 12, 12, 3);
  context.fillStyle = "#395476";
  context.fillRect(11 + tilt * 0.3, 21, 10, 4);
}

function drawWeaponFrame(
  context: CanvasRenderingContext2D,
  frameIndex: number,
  width: number,
  height: number,
  bodyColor: string,
  gripColor: string
): void {
  const recoil = frameIndex === 0 ? 0 : frameIndex === 1 ? 6 : 2;
  context.fillStyle = "rgba(0,0,0,0)";
  context.fillRect(0, 0, width, height);
  context.fillStyle = gripColor;
  context.fillRect(width * 0.46, height * 0.46 + recoil, 18, 18);
  context.fillStyle = bodyColor;
  context.fillRect(width * 0.34, height * 0.28 + recoil, 42, 18);
  context.fillStyle = "#ffe0a6";
  context.fillRect(width * 0.69, height * 0.34 + recoil, 12, 6);
}

function drawProjectileFrame(
  context: CanvasRenderingContext2D,
  frameIndex: number,
  width: number,
  height: number,
  fillColor: string,
  accentColor: string
): void {
  const radius = frameIndex % 2 === 0 ? 6 : 8;
  context.fillStyle = fillColor;
  context.beginPath();
  context.arc(width * 0.5, height * 0.5, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = accentColor;
  context.beginPath();
  context.arc(width * 0.5, height * 0.5, radius * 0.5, 0, Math.PI * 2);
  context.fill();
}
