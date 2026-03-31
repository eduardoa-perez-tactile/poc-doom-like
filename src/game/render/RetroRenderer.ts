import {
  Mesh,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
  Vector4,
  WebGPUEngine
} from "@babylonjs/core";
import { getLevelCeilingFlat, getLevelFloorFlat } from "../content/flats";
import type {
  ContentDatabase,
  EnemyAttackProfileDefinition,
  EnemyVisualProfileDefinition,
  LevelDefinition,
  SpriteAnimationStateName
} from "../content/types";
import type {
  EnemyState,
  EffectState,
  GameSessionState,
  HazardState,
  ProjectileState
} from "../core/types";
import type { AutomapRenderSnapshot } from "../simulation/map/AutomapTypes";
import { AutomapRenderSystem } from "./AutomapRenderSystem";
import { AnimatedSpriteInstance, SpriteLibrary } from "./SpritePipeline";
import { FlatMaterialSystem } from "./flats/FlatMaterialSystem";
import { PickupRenderSystem } from "./pickups/PickupRenderSystem";
import { WallTextureAtlas } from "./WallTextureAtlas";
import {
  pickTexture,
  WALL_ATLAS_SOURCE_TILES,
  WALL_ATLAS_SOURCE_URL,
  WALL_ATLAS_TILE_SIZE,
  wallTextureTypeFromName,
  WallTextureType
} from "./WallTextureRegistry";

const PLAYER_EYE_HEIGHT = 1.2;
const FLOOR_REGION_MESH_HEIGHT = 0.44;

export class RetroRenderer {
  readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly root: TransformNode;
  private readonly automapRenderSystem: AutomapRenderSystem;
  private spriteLibrary!: SpriteLibrary;
  private readonly enemySprites = new Map<string, AnimatedSpriteInstance>();
  private pickupRenderSystem!: PickupRenderSystem;
  private readonly projectileSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly hazardSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly effectSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly weaponSprites = new Map<string, AnimatedSpriteInstance>();
  private wallMaterial!: StandardMaterial;
  private doorMaterial!: StandardMaterial;
  private lockedDoorMaterial!: StandardMaterial;
  private doorMarkerMaterial!: StandardMaterial;
  private lockedDoorMarkerMaterial!: StandardMaterial;
  private wallAtlas!: WallTextureAtlas;
  private flatMaterials!: FlatMaterialSystem;
  private readonly doorMeshes = new Map<string, Mesh[]>();
  private readonly doorMarkers = new Map<string, Mesh[]>();
  private readonly teleporterMarkers = new Map<string, Mesh[]>();
  private readonly floorRegionMeshes = new Map<string, Mesh[]>();

  constructor(
    private readonly engine: Engine | WebGPUEngine,
    private readonly content: ContentDatabase,
    automapCanvas: HTMLCanvasElement
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor = Color4.FromHexString(`${content.level.skyColor}ff`);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.032;
    this.scene.fogColor = Color3.FromHexString(content.level.fogColor);
    this.scene.ambientColor = Color3.FromHexString(content.level.ambientColor);

    this.camera = new UniversalCamera("player-camera", new Vector3(0, PLAYER_EYE_HEIGHT, 0), this.scene);
    this.camera.fov = 1.14;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 60;
    this.camera.inputs.clear();

    new HemisphericLight("key-light", new Vector3(0.2, 1, 0.1), this.scene).intensity = 0.6;

    this.root = new TransformNode("world-root", this.scene);
    this.automapRenderSystem = new AutomapRenderSystem(automapCanvas);
  }

  static async create(
    engine: Engine | WebGPUEngine,
    content: ContentDatabase,
    automapCanvas: HTMLCanvasElement
  ): Promise<RetroRenderer> {
    const renderer = new RetroRenderer(engine, content, automapCanvas);
    await renderer.initializeWallTextures();
    renderer.flatMaterials = await FlatMaterialSystem.create(renderer.scene, content.level);
    renderer.buildStaticLevel();
    await renderer.initializeSprites();
    renderer.resize();
    renderer.setAttractCamera();
    return renderer;
  }

  setPixelScale(scale: number): void {
    this.engine.setHardwareScalingLevel(scale);
    this.resize();
  }

  setAttractCamera(): void {
    const spawn = this.content.level.playerStart;
    this.camera.position.set(spawn.x * this.content.level.cellSize, PLAYER_EYE_HEIGHT, spawn.y * this.content.level.cellSize);
    this.camera.rotation.set(0, Math.PI / 2 - (spawn.angleDeg * Math.PI) / 180, 0);
  }

  render(): void {
    this.scene.render();
  }

  resize(): void {
    this.engine.resize();
    this.automapRenderSystem.resize(
      this.engine.getRenderWidth() / this.engine.getHardwareScalingLevel(),
      this.engine.getRenderHeight() / this.engine.getHardwareScalingLevel(),
      window.devicePixelRatio || 1
    );
  }

  dispose(): void {
    this.flatMaterials.dispose();
    this.scene.dispose();
  }

  sync(state: GameSessionState, automapSnapshot: AutomapRenderSnapshot | null, dt: number): void {
    this.flatMaterials.update(dt);
    this.camera.position.x = state.player.x;
    this.camera.position.z = state.player.y;
    this.camera.position.y = PLAYER_EYE_HEIGHT + Math.sin(state.player.bobPhase) * 0.03;
    this.camera.rotation.y = Math.PI / 2 - state.player.angle;

    this.syncEnemies(state.enemies, state.player.x, state.player.y, dt);
    this.syncDoors(state);
    this.syncTeleporters(state);
    this.syncFloorRegions(state, dt);
    this.pickupRenderSystem.sync(state.pickups, state.player.x, state.player.y);
    this.syncProjectiles(state.projectiles, state.player.x, state.player.y, dt);
    this.syncHazards(state.hazards, state.player.x, state.player.y, dt);
    this.syncEffects(state.effects, state.player.x, state.player.y, dt);
    this.syncWeapon(state, dt);
    this.automapRenderSystem.render(automapSnapshot);
  }

  setAutomapActive(active: boolean): void {
    this.automapRenderSystem.setActive(active);
  }

  private async initializeSprites(): Promise<void> {
    this.spriteLibrary = await SpriteLibrary.create(this.scene, this.content.visuals);
    this.pickupRenderSystem = new PickupRenderSystem(this.content, this.spriteLibrary);
    this.buildSprites();
  }

  private async initializeWallTextures(): Promise<void> {
    this.wallAtlas = await WallTextureAtlas.create(
      this.scene,
      WALL_ATLAS_SOURCE_URL,
      WALL_ATLAS_SOURCE_TILES,
      WALL_ATLAS_TILE_SIZE
    );

    this.wallMaterial = new StandardMaterial("wall-atlas-material", this.scene);
    this.wallMaterial.diffuseTexture = this.wallAtlas.texture;
    this.wallMaterial.emissiveTexture = this.wallAtlas.texture;
    this.wallMaterial.specularColor = Color3.Black();
    this.wallMaterial.disableLighting = true;

    this.doorMaterial = this.wallMaterial.clone("door-atlas-material");
    this.doorMaterial.emissiveColor = Color3.FromHexString("#f2be6a");

    this.lockedDoorMaterial = this.wallMaterial.clone("locked-door-atlas-material");
    this.lockedDoorMaterial.emissiveColor = Color3.FromHexString("#d4714d");

    this.doorMarkerMaterial = new StandardMaterial("door-marker-material", this.scene);
    this.doorMarkerMaterial.diffuseColor = Color3.FromHexString("#f0c772");
    this.doorMarkerMaterial.emissiveColor = Color3.FromHexString("#f0c772");
    this.doorMarkerMaterial.specularColor = Color3.Black();
    this.doorMarkerMaterial.disableLighting = true;

    this.lockedDoorMarkerMaterial = new StandardMaterial("locked-door-marker-material", this.scene);
    this.lockedDoorMarkerMaterial.diffuseColor = Color3.FromHexString("#df7f5c");
    this.lockedDoorMarkerMaterial.emissiveColor = Color3.FromHexString("#df7f5c");
    this.lockedDoorMarkerMaterial.specularColor = Color3.Black();
    this.lockedDoorMarkerMaterial.disableLighting = true;
  }

  private buildStaticLevel(): void {
    const { grid, cellSize } = this.content.level;
    const width = grid[0]?.length ?? 0;
    const height = grid.length;
    const chosenWallTiles = new Map<string, number>();
    const doorCellToId = new Map<string, string>();

    for (const door of this.content.level.script?.doors ?? []) {
      for (const cell of door.gridCells) {
        doorCellToId.set(`${cell.x},${cell.y}`, door.id);
      }
    }

    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: width * cellSize, height: height * cellSize },
      this.scene
    );
    ground.position.x = ((width - 1) * cellSize) / 2;
    ground.position.z = ((height - 1) * cellSize) / 2;
    ground.material = this.flatMaterials.getFlatMaterial(getLevelFloorFlat(this.content.level));
    ground.parent = this.root;

    const ceiling = MeshBuilder.CreateGround(
      "ceiling",
      { width: width * cellSize, height: height * cellSize },
      this.scene
    );
    ceiling.position.x = ground.position.x;
    ceiling.position.z = ground.position.z;
    ceiling.position.y = 2.6;
    ceiling.rotation.x = Math.PI;
    ceiling.material = this.flatMaterials.getFlatMaterial(getLevelCeilingFlat(this.content.level));
    ceiling.parent = this.root;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isWallCell(grid[y][x])) {
          continue;
        }
        if (doorCellToId.has(`${x},${y}`)) {
          continue;
        }

        const textureType = resolveWallTextureType(this.content.level, x, y);
        const tileIndex = pickTexture(textureType, x, y, [
          chosenWallTiles.get(`${x - 1},${y}`) ?? -1,
          chosenWallTiles.get(`${x},${y - 1}`) ?? -1
        ]);
        chosenWallTiles.set(`${x},${y}`, tileIndex);
        const uv = this.wallAtlas.getTileUV(tileIndex);
        const faceUV = Array.from({ length: 6 }, () => new Vector4(uv.u0, uv.v0, uv.u1, uv.v1));

        const wall = MeshBuilder.CreateBox(
          `wall-${x}-${y}`,
          { width: cellSize, depth: cellSize, height: 2.6, faceUV },
          this.scene
        );
        wall.position = new Vector3(x * cellSize, 1.3, y * cellSize);
        wall.material = this.wallMaterial;
        wall.parent = this.root;
      }
    }

    for (const door of this.content.level.script?.doors ?? []) {
      const meshes: Mesh[] = [];
      for (const cell of door.gridCells) {
        const textureType = resolveWallTextureType(this.content.level, cell.x, cell.y);
        const tileIndex = pickTexture(textureType, cell.x, cell.y, []);
        const uv = this.wallAtlas.getTileUV(tileIndex);
        const faceUV = Array.from({ length: 6 }, () => new Vector4(uv.u0, uv.v0, uv.u1, uv.v1));
        const mesh = MeshBuilder.CreateBox(
          `door-${door.id}-${cell.x}-${cell.y}`,
          { width: cellSize, depth: cellSize, height: 2.6, faceUV },
          this.scene
        );
        mesh.position = new Vector3(cell.x * cellSize, 1.3, cell.y * cellSize);
        mesh.material = door.locked ? this.lockedDoorMaterial : this.doorMaterial;
        mesh.parent = this.root;
        meshes.push(mesh);
      }
      this.doorMeshes.set(door.id, meshes);

      const markers: Mesh[] = [];
      for (const cell of door.gridCells) {
        const marker = MeshBuilder.CreateBox(
          `door-marker-${door.id}-${cell.x}-${cell.y}`,
          {
            width: cellSize * 0.42,
            depth: cellSize * 0.18,
            height: 0.16
          },
          this.scene
        );
        marker.position = new Vector3(cell.x * cellSize, 2.18, cell.y * cellSize);
        marker.material = door.locked ? this.lockedDoorMarkerMaterial : this.doorMarkerMaterial;
        marker.parent = this.root;
        markers.push(marker);
      }
      this.doorMarkers.set(door.id, markers);
    }

    for (const teleporter of this.content.level.script?.teleporters ?? []) {
      const meshes: Mesh[] = [];
      const tileIndex = pickTexture(WallTextureType.Portal, teleporter.fromRegion.x, teleporter.fromRegion.y);
      const uv = this.wallAtlas.getTileUV(tileIndex);
      const faceUV = Array.from({ length: 6 }, () => new Vector4(uv.u0, uv.v0, uv.u1, uv.v1));

      for (let dy = 0; dy < teleporter.fromRegion.h; dy += 1) {
        for (let dx = 0; dx < teleporter.fromRegion.w; dx += 1) {
          const cellX = teleporter.fromRegion.x + dx;
          const cellY = teleporter.fromRegion.y + dy;
          const marker = MeshBuilder.CreateBox(
            `teleporter-${teleporter.id}-${cellX}-${cellY}`,
            {
              width: cellSize * 0.72,
              depth: cellSize * 0.72,
              height: 0.04,
              faceUV
            },
            this.scene
          );
          marker.position = new Vector3(cellX * cellSize, 0.02, cellY * cellSize);
          marker.material = this.wallMaterial;
          marker.parent = this.root;
          marker.setEnabled(false);
          meshes.push(marker);
        }
      }

      this.teleporterMarkers.set(teleporter.id, meshes);
    }

    for (const floorRegion of this.content.level.script?.floorRegions ?? []) {
      const meshes: Mesh[] = [];
      for (const cell of floorRegion.blockingCells ?? []) {
        const mesh = MeshBuilder.CreateBox(
          `floor-region-${floorRegion.id}-${cell.x}-${cell.y}`,
          {
            width: cellSize,
            depth: cellSize,
            height: FLOOR_REGION_MESH_HEIGHT
          },
          this.scene
        );
        mesh.position = new Vector3(
          cell.x * cellSize,
          floorRegionCenterY(floorRegion.initialHeight ?? 0),
          cell.y * cellSize
        );
        mesh.material = this.flatMaterials.getFlatMaterial(getLevelFloorFlat(this.content.level));
        mesh.parent = this.root;
        mesh.setEnabled((floorRegion.initialHeight ?? 0) >= 0);
        meshes.push(mesh);
      }
      this.floorRegionMeshes.set(floorRegion.id, meshes);
    }
  }

  private buildSprites(): void {
    for (const enemy of this.content.level.enemies) {
      const definition = this.content.enemies.get(enemy.type);
      const visualProfile = definition
        ? this.content.enemyVisualProfiles.get(definition.visualProfileId)
        : undefined;
      if (!visualProfile) {
        continue;
      }
      const sprite = this.spriteLibrary.createSpriteForEntity(visualProfile.entityId, "world");
      this.enemySprites.set(enemy.id, sprite);
    }

    this.pickupRenderSystem.buildSprites(this.content.level.pickups.map((pickup) => ({
      entityId: pickup.id,
      defId: pickup.defId,
      position: { x: pickup.x * this.content.level.cellSize, y: pickup.y * this.content.level.cellSize, z: pickup.z ?? 0 },
      bobPhase: 0,
      animTime: 0,
      picked: false,
      respawnAtTime: null
    })));

    for (const weapon of this.content.weapons.values()) {
      const sprite = this.spriteLibrary.createSpriteForEntity(`weapon:${weapon.id}`, "view", this.camera);
      const viewModel = sprite.viewModel;
      sprite.setVisible(false);
      sprite.mesh.rotation.set(
        viewModel?.rotationX ?? 0,
        viewModel?.rotationY ?? 0,
        viewModel?.rotationZ ?? 0
      );
      sprite.setPosition(
        viewModel?.offsetX ?? 0.2,
        viewModel?.offsetZ ?? 1,
        viewModel?.offsetY ?? -0.6
      );
      this.weaponSprites.set(weapon.id, sprite);
    }
  }

  private syncEnemies(enemies: EnemyState[], viewerX: number, viewerY: number, dt: number): void {
    for (const enemy of enemies) {
      let sprite = this.enemySprites.get(enemy.id);
      const definition = this.content.enemies.get(enemy.typeId);
      if (!definition) {
        continue;
      }
      const visualProfile = this.content.enemyVisualProfiles.get(definition.visualProfileId);
      if (!visualProfile) {
        continue;
      }
      const attackProfile = this.content.enemyAttackProfiles.get(definition.attackProfileId);
      if (!attackProfile) {
        continue;
      }
      if (!sprite) {
        sprite = this.spriteLibrary.createSpriteForEntity(visualProfile.entityId, "world");
        this.enemySprites.set(enemy.id, sprite);
      }

      sprite.setUniformScale(definition.height / sprite.baseWorldHeight);
      sprite.setVisible(true);
      sprite.setPosition(enemy.x, enemy.y, sprite.usesGroundPlacement ? 0 : sprite.anchorOffsetY);
      sprite.setFacingAngle(enemy.facingAngle);
      sprite.setAnimationState(enemyAnimationState(enemy, visualProfile, attackProfile));
      sprite.update(dt, viewerX, viewerY);
    }
  }

  private syncProjectiles(
    projectiles: ProjectileState[],
    viewerX: number,
    viewerY: number,
    dt: number
  ): void {
    const liveIds = new Set<number>();
    for (const projectile of projectiles) {
      let sprite = this.projectileSprites.get(projectile.id);
      if (!sprite) {
        sprite = this.spriteLibrary.createSpriteForEntity(`projectile:${projectile.visualId}`, "world");
        this.projectileSprites.set(projectile.id, sprite);
      }

      sprite.setVisible(true);
      sprite.setPosition(projectile.x, projectile.y, sprite.anchorOffsetY + 0.5);
      sprite.setFacingAngle(Math.atan2(projectile.dy, projectile.dx));
      sprite.setAnimationState("move");
      sprite.update(dt, viewerX, viewerY);
      liveIds.add(projectile.id);
    }

    for (const [id, sprite] of this.projectileSprites) {
      if (liveIds.has(id)) {
        continue;
      }
      sprite.dispose();
      this.projectileSprites.delete(id);
    }
  }

  private syncHazards(
    hazards: HazardState[],
    viewerX: number,
    viewerY: number,
    dt: number
  ): void {
    const liveIds = new Set<number>();
    for (const hazard of hazards) {
      let sprite = this.hazardSprites.get(hazard.id);
      if (!sprite) {
        sprite = this.spriteLibrary.createSpriteForEntity(`projectile:${hazard.visualId}`, "world");
        this.hazardSprites.set(hazard.id, sprite);
      }

      sprite.setVisible(true);
      sprite.setPosition(hazard.x, hazard.y, sprite.anchorOffsetY + 0.35);
      sprite.setFacingAngle(0);
      sprite.setAnimationState("idle");
      sprite.update(dt, viewerX, viewerY);
      liveIds.add(hazard.id);
    }

    for (const [id, sprite] of this.hazardSprites) {
      if (liveIds.has(id)) {
        continue;
      }
      sprite.dispose();
      this.hazardSprites.delete(id);
    }
  }

  private syncEffects(
    effects: EffectState[],
    viewerX: number,
    viewerY: number,
    dt: number
  ): void {
    const liveIds = new Set<number>();
    for (const effect of effects) {
      let sprite = this.effectSprites.get(effect.id);
      if (!sprite) {
        sprite = this.spriteLibrary.createSpriteForEntity(`effect:${effect.effectId}`, "world");
        this.effectSprites.set(effect.id, sprite);
      }

      const definition = this.content.effects.get(effect.effectId);
      const heightOffset = definition?.heightOffset ?? 0;
      sprite.setVisible(true);
      sprite.setPosition(effect.x, effect.y, sprite.anchorOffsetY + heightOffset);
      sprite.setFacingAngle(effect.facingAngle);
      sprite.setAnimationState(effect.animationState);
      sprite.update(dt, viewerX, viewerY);
      liveIds.add(effect.id);
    }

    for (const [id, sprite] of this.effectSprites) {
      if (liveIds.has(id)) {
        continue;
      }
      sprite.dispose();
      this.effectSprites.delete(id);
    }
  }

  private syncWeapon(state: GameSessionState, dt: number): void {
    for (const [weaponId, sprite] of this.weaponSprites) {
      const visible = weaponId === state.weapon.currentId && state.player.alive;
      sprite.setVisible(visible);
      if (!visible) {
        continue;
      }

      const viewModel = sprite.viewModel;
      const bobAmplitude = viewModel?.bobAmplitude ?? 0.01;
      sprite.setPosition(
        viewModel?.offsetX ?? 0.2,
        viewModel?.offsetZ ?? 1,
        (viewModel?.offsetY ?? -0.6) + Math.sin(state.player.bobPhase) * bobAmplitude
      );
      sprite.setAnimationState(state.weapon.viewAnimation, state.weapon.viewAnimationRevision);
      sprite.update(dt);
    }
  }

  private syncDoors(state: GameSessionState): void {
    for (const [doorId, meshes] of this.doorMeshes) {
      const doorState = state.levelScript?.doors[doorId];
      const isOpen = doorState?.isOpen ?? false;
      const isLocked = doorState?.isLocked ?? false;
      for (const mesh of meshes) {
        mesh.setEnabled(!isOpen);
        mesh.material = isLocked ? this.lockedDoorMaterial : this.doorMaterial;
      }
      for (const marker of this.doorMarkers.get(doorId) ?? []) {
        marker.setEnabled(!isOpen);
        marker.material = isLocked ? this.lockedDoorMarkerMaterial : this.doorMarkerMaterial;
      }
    }
  }

  private syncTeleporters(state: GameSessionState): void {
    for (const [teleporterId, meshes] of this.teleporterMarkers) {
      const visible = state.levelScript?.teleporters[teleporterId]?.revealed ?? true;
      for (const mesh of meshes) {
        mesh.setEnabled(visible);
      }
    }
  }

  private syncFloorRegions(state: GameSessionState, dt: number): void {
    for (const [regionId, meshes] of this.floorRegionMeshes) {
      const targetHeight = state.levelScript?.floorRegions[regionId]?.height ?? 0;
      const targetY = floorRegionCenterY(targetHeight);
      for (const mesh of meshes) {
        mesh.setEnabled(targetHeight >= 0 || mesh.position.y > -FLOOR_REGION_MESH_HEIGHT);
        mesh.position.y += (targetY - mesh.position.y) * Math.min(1, dt * 10);
      }
    }
  }
}

function enemyAnimationState(
  enemy: EnemyState,
  visualProfile: EnemyVisualProfileDefinition,
  attackProfile: EnemyAttackProfileDefinition
): SpriteAnimationStateName {
  switch (enemy.fsmState) {
    case "chase":
      return visualProfile.moveState ?? "move";
    case "windup":
    case "attack":
    case "cooldown":
      if (attackProfile.attackVisualKey && visualProfile.attackStates?.[attackProfile.attackVisualKey]) {
        return visualProfile.attackStates[attackProfile.attackVisualKey];
      }
      return visualProfile.defaultAttackState ?? "attack";
    case "hurt":
      return visualProfile.hurtState ?? "hurt";
    case "dead":
      return visualProfile.deathState ?? "death";
    case "idle":
    case "alert":
    default:
      return visualProfile.idleState ?? "idle";
  }
}

function isWallCell(cell: string | undefined): boolean {
  return cell !== undefined && cell !== ".";
}

function resolveWallTextureType(level: LevelDefinition, x: number, y: number): WallTextureType {
  const glyph = level.grid[y]?.[x];
  const mappedType = wallTextureTypeFromName(level.wallTypes?.[glyph]);
  if (mappedType) {
    return mappedType;
  }

  if (x === 0 || y === 0 || x === level.grid[0].length - 1 || y === level.grid.length - 1) {
    return WallTextureType.Stone;
  }

  const neighbors = [
    level.grid[y - 1]?.[x],
    level.grid[y + 1]?.[x],
    level.grid[y]?.[x - 1],
    level.grid[y]?.[x + 1]
  ];
  const wallNeighborCount = neighbors.reduce((count, neighbor) => count + Number(isWallCell(neighbor)), 0);
  return wallNeighborCount >= 3 ? WallTextureType.Brick : WallTextureType.Decorative;
}

function floorRegionCenterY(height: number): number {
  return (height * FLOOR_REGION_MESH_HEIGHT) - FLOOR_REGION_MESH_HEIGHT * 0.5;
}
