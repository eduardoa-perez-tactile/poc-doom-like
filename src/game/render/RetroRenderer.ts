import {
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
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
import {
  findAdjacentSolidCell,
  getWallAtlasTileIndex,
  LevelWallPresentationResolver,
  WALL_ATLAS_SOURCE_TILES,
  WALL_ATLAS_SOURCE_URL,
  WALL_ATLAS_TILE_SIZE,
  type DoorVisualProfile,
  type SurfaceVisualProfile,
  type WallVariationMode
} from "../content/walls";
import type {
  EnemyState,
  EffectState,
  GameSessionState,
  HazardState,
  ProjectileState
} from "../core/types";
import type { AutomapRenderSnapshot } from "../simulation/map/AutomapTypes";
import { AutomapRenderSystem } from "./AutomapRenderSystem";
import { FlatMaterialSystem } from "./flats/FlatMaterialSystem";
import { PickupRenderSystem } from "./pickups/PickupRenderSystem";
import { AnimatedSpriteInstance, SpriteLibrary } from "./SpritePipeline";
import { WallTextureAtlas } from "./WallTextureAtlas";

const PLAYER_EYE_HEIGHT = 1.2;
const FLOOR_REGION_MESH_HEIGHT = 0.44;
const WALL_HEIGHT = 2.6;

type DoorAxis = "horizontal" | "vertical";

interface DoorRenderState {
  profile: DoorVisualProfile;
  axis: DoorAxis;
  leaves: Mesh[];
  frames: Mesh[];
  locks: Mesh[];
}

interface TeleporterRenderState {
  profile: SurfaceVisualProfile;
  meshes: Mesh[];
}

interface SwitchRenderState {
  profile: SurfaceVisualProfile;
  meshes: Mesh[];
  indicators: Mesh[];
}

export class RetroRenderer {
  readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly root: TransformNode;
  private readonly automapRenderSystem: AutomapRenderSystem;
  private readonly presentationResolver: LevelWallPresentationResolver;
  private spriteLibrary!: SpriteLibrary;
  private readonly enemySprites = new Map<string, AnimatedSpriteInstance>();
  private pickupRenderSystem!: PickupRenderSystem;
  private readonly projectileSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly hazardSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly effectSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly weaponSprites = new Map<string, AnimatedSpriteInstance>();
  private readonly atlasMaterials = new Map<string, StandardMaterial>();
  private readonly solidMaterials = new Map<string, StandardMaterial>();
  private wallAtlas!: WallTextureAtlas;
  private flatMaterials!: FlatMaterialSystem;
  private wallMaterial!: StandardMaterial;
  private readonly doorRenderStates = new Map<string, DoorRenderState>();
  private readonly teleporterRenderStates = new Map<string, TeleporterRenderState>();
  private readonly switchRenderStates = new Map<string, SwitchRenderState>();
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
    this.presentationResolver = new LevelWallPresentationResolver(content.level);
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
    this.syncSwitches(state);
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
  }

  private buildStaticLevel(): void {
    const { grid, cellSize } = this.content.level;
    const width = grid[0]?.length ?? 0;
    const height = grid.length;
    const chosenWallTiles = new Map<string, number>();
    const doorCellToId = new Map<string, string>();

    for (const door of this.content.level.script?.doors ?? []) {
      for (const cell of door.gridCells) {
        doorCellToId.set(cellKey(cell.x, cell.y), door.id);
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
    ceiling.position.y = WALL_HEIGHT;
    ceiling.rotation.x = Math.PI;
    ceiling.material = this.flatMaterials.getFlatMaterial(getLevelCeilingFlat(this.content.level));
    ceiling.parent = this.root;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isWallCell(grid[y][x]) || doorCellToId.has(cellKey(x, y))) {
          continue;
        }

        const presentation = this.presentationResolver.resolveWallCell(x, y);
        const tileIndex = this.pickProfileTextureIndex(
          presentation.profile.texturePool,
          x,
          y,
          presentation.profile.variationMode ?? "hash",
          presentation.profile.allowNeighborDeDupe ?? true,
          [
            chosenWallTiles.get(cellKey(x - 1, y)) ?? -1,
            chosenWallTiles.get(cellKey(x, y - 1)) ?? -1
          ]
        );
        chosenWallTiles.set(cellKey(x, y), tileIndex);
        const wall = this.createTexturedBox(
          `wall-${x}-${y}`,
          {
            width: cellSize,
            depth: cellSize,
            height: WALL_HEIGHT
          },
          tileIndex,
          this.getAtlasMaterial(presentation.profile.emissiveColor),
          new Vector3(x * cellSize, WALL_HEIGHT * 0.5, y * cellSize)
        );
        wall.parent = this.root;
      }
    }

    for (const door of this.content.level.script?.doors ?? []) {
      this.buildDoorPresentation(door);
    }

    for (const switchDef of this.content.level.script?.switches ?? []) {
      this.buildSwitchPresentation(switchDef);
    }

    for (const teleporter of this.content.level.script?.teleporters ?? []) {
      this.buildTeleporterPresentation(teleporter);
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

  private buildDoorPresentation(door: NonNullable<NonNullable<LevelDefinition["script"]>["doors"]>[number]): void {
    const cellSize = this.content.level.cellSize;
    const profile = this.presentationResolver.resolveDoorProfile(door);
    const axis = resolveDoorAxis(door.gridCells);
    const renderState: DoorRenderState = {
      profile,
      axis,
      leaves: [],
      frames: [],
      locks: []
    };

    const framePool = profile.frameTexturePool?.length ? profile.frameTexturePool : profile.baseTexturePool;
    const frameTileIndex = this.pickProfileTextureIndex(framePool, door.gridCells[0].x, door.gridCells[0].y, "fixed", false);

    for (const cell of door.gridCells) {
      const tileIndex = this.pickProfileTextureIndex(profile.baseTexturePool, cell.x, cell.y, "hash", false);
      const leaf = this.createTexturedBox(
        `door-leaf-${door.id}-${cell.x}-${cell.y}`,
        {
          width: cellSize * 0.9,
          depth: cellSize * 0.9,
          height: WALL_HEIGHT * 0.92
        },
        tileIndex,
        this.getDoorLeafMaterial(profile, door.locked ?? Boolean(door.requiredKeyId)),
        new Vector3(cell.x * cellSize, WALL_HEIGHT * 0.46, cell.y * cellSize)
      );
      leaf.parent = this.root;
      renderState.leaves.push(leaf);
    }

    for (const frame of this.createDoorFrames(door.id, door.gridCells, axis, frameTileIndex)) {
      frame.parent = this.root;
      renderState.frames.push(frame);
    }

    if (profile.lockedMarkerStyle !== "none") {
      for (const lockMesh of this.createDoorLockMarkers(door.id, door.gridCells, axis, profile)) {
        lockMesh.parent = this.root;
        renderState.locks.push(lockMesh);
      }
    }

    this.doorRenderStates.set(door.id, renderState);
  }

  private buildSwitchPresentation(
    switchDef: NonNullable<NonNullable<LevelDefinition["script"]>["switches"]>[number]
  ): void {
    const cellSize = this.content.level.cellSize;
    const profile = this.presentationResolver.resolveSwitchProfile(switchDef);
    const tileIndex = this.pickProfileTextureIndex(
      profile.surfaceTexturePool,
      switchDef.cell.x,
      switchDef.cell.y,
      "fixed",
      false
    );
    const frameTileIndex = this.pickProfileTextureIndex(
      profile.frameTexturePool?.length ? profile.frameTexturePool : profile.surfaceTexturePool,
      switchDef.cell.x,
      switchDef.cell.y,
      "fixed",
      false
    );
    const anchor = findAdjacentSolidCell(this.content.level, switchDef.cell);

    const meshes: Mesh[] = [];
    const indicators: Mesh[] = [];
    const basePosition = new Vector3(switchDef.cell.x * cellSize, 1.05, switchDef.cell.y * cellSize);
    let rotationY = 0;
    let normal = new Vector3(0, 0, 1);

    if (anchor?.facing === "north") {
      basePosition.z -= cellSize * 0.39;
      normal = new Vector3(0, 0, 1);
    } else if (anchor?.facing === "south") {
      basePosition.z += cellSize * 0.39;
      normal = new Vector3(0, 0, -1);
    } else if (anchor?.facing === "west") {
      basePosition.x -= cellSize * 0.39;
      rotationY = Math.PI * 0.5;
      normal = new Vector3(1, 0, 0);
    } else if (anchor?.facing === "east") {
      basePosition.x += cellSize * 0.39;
      rotationY = Math.PI * 0.5;
      normal = new Vector3(-1, 0, 0);
    }

    const frame = this.createTexturedBox(
      `switch-frame-${switchDef.id}`,
      {
        width: cellSize * 0.62,
        depth: cellSize * 0.1,
        height: 1.55
      },
      frameTileIndex,
      this.getAtlasMaterial("#bca982"),
      basePosition
    );
    frame.rotation.y = rotationY;
    frame.parent = this.root;
    meshes.push(frame);

    const panel = this.createTexturedBox(
      `switch-panel-${switchDef.id}`,
      {
        width: cellSize * 0.5,
        depth: cellSize * 0.05,
        height: 1.3
      },
      tileIndex,
      this.getAtlasMaterial(profile.emissiveColor ?? "#d2b279"),
      basePosition.add(normal.scale(0.04))
    );
    panel.rotation.y = rotationY;
    panel.parent = this.root;
    meshes.push(panel);

    const indicator = MeshBuilder.CreateBox(
      `switch-indicator-${switchDef.id}`,
      {
        width: cellSize * 0.12,
        depth: cellSize * 0.12,
        height: cellSize * 0.12
      },
      this.scene
    );
    indicator.position = basePosition.add(normal.scale(0.09));
    indicator.position.y = 1.62;
    indicator.material = this.getSolidMaterial("#f0c772");
    indicator.rotation.y = rotationY;
    indicator.parent = this.root;
    indicators.push(indicator);

    this.switchRenderStates.set(switchDef.id, {
      profile,
      meshes,
      indicators
    });
  }

  private buildTeleporterPresentation(
    teleporter: NonNullable<NonNullable<LevelDefinition["script"]>["teleporters"]>[number]
  ): void {
    const cellSize = this.content.level.cellSize;
    const profile = this.presentationResolver.resolveTeleporterProfile(teleporter);
    const meshes: Mesh[] = [];

    for (let dy = 0; dy < teleporter.fromRegion.h; dy += 1) {
      for (let dx = 0; dx < teleporter.fromRegion.w; dx += 1) {
        const cellX = teleporter.fromRegion.x + dx;
        const cellY = teleporter.fromRegion.y + dy;
        const padTile = this.pickProfileTextureIndex(profile.surfaceTexturePool, cellX, cellY, "hash", false);
        const frameTile = this.pickProfileTextureIndex(
          profile.frameTexturePool?.length ? profile.frameTexturePool : profile.surfaceTexturePool,
          cellX,
          cellY,
          "fixed",
          false
        );

        const pad = this.createTexturedBox(
          `teleporter-pad-${teleporter.id}-${cellX}-${cellY}`,
          {
            width: cellSize * 0.82,
            depth: cellSize * 0.82,
            height: 0.08
          },
          padTile,
          this.getAtlasMaterial(profile.emissiveColor ?? "#6aa6ff"),
          new Vector3(cellX * cellSize, 0.04, cellY * cellSize)
        );
        pad.parent = this.root;
        meshes.push(pad);

        const beaconX = this.createTexturedBox(
          `teleporter-beacon-x-${teleporter.id}-${cellX}-${cellY}`,
          {
            width: cellSize * 0.16,
            depth: cellSize * 0.6,
            height: 1.1
          },
          frameTile,
          this.getAtlasMaterial(profile.emissiveColor ?? "#6aa6ff"),
          new Vector3(cellX * cellSize, 0.62, cellY * cellSize)
        );
        beaconX.parent = this.root;
        meshes.push(beaconX);

        const beaconZ = this.createTexturedBox(
          `teleporter-beacon-z-${teleporter.id}-${cellX}-${cellY}`,
          {
            width: cellSize * 0.6,
            depth: cellSize * 0.16,
            height: 1.1
          },
          frameTile,
          this.getAtlasMaterial(profile.emissiveColor ?? "#6aa6ff"),
          new Vector3(cellX * cellSize, 0.62, cellY * cellSize)
        );
        beaconZ.parent = this.root;
        meshes.push(beaconZ);
      }
    }

    this.teleporterRenderStates.set(teleporter.id, { profile, meshes });
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
      position: {
        x: pickup.x * this.content.level.cellSize,
        y: pickup.y * this.content.level.cellSize,
        z: pickup.z ?? 0
      },
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
    for (const [doorId, renderState] of this.doorRenderStates) {
      const doorState = state.levelScript?.doors[doorId];
      const isOpen = doorState?.isOpen ?? false;
      const isLocked = doorState?.isLocked ?? false;

      for (const frame of renderState.frames) {
        frame.setEnabled(true);
      }
      for (const leaf of renderState.leaves) {
        leaf.setEnabled(!isOpen);
        leaf.material = this.getDoorLeafMaterial(renderState.profile, isLocked);
      }
      for (const lock of renderState.locks) {
        lock.setEnabled(!isOpen && isLocked);
      }
    }
  }

  private syncSwitches(state: GameSessionState): void {
    for (const [switchId, renderState] of this.switchRenderStates) {
      const used = state.levelScript?.switches[switchId]?.used ?? false;
      for (const indicator of renderState.indicators) {
        indicator.material = this.getSolidMaterial(used ? "#67d37a" : "#f0c772");
      }
    }
  }

  private syncTeleporters(state: GameSessionState): void {
    for (const [teleporterId, renderState] of this.teleporterRenderStates) {
      const teleporterState = state.levelScript?.teleporters[teleporterId];
      const visible = teleporterState?.revealed ?? true;
      const active = teleporterState?.enabled ?? true;
      for (const mesh of renderState.meshes) {
        mesh.setEnabled(visible);
        if (mesh.material instanceof StandardMaterial) {
          mesh.material = this.getAtlasMaterial(active ? renderState.profile.emissiveColor ?? "#76b7ff" : "#586575");
        }
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

  private createDoorFrames(
    doorId: string,
    gridCells: readonly { x: number; y: number }[],
    axis: DoorAxis,
    tileIndex: number
  ): Mesh[] {
    const cellSize = this.content.level.cellSize;
    const xs = gridCells.map((cell) => cell.x);
    const ys = gridCells.map((cell) => cell.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const midX = ((minX + maxX) * 0.5) * cellSize;
    const midY = ((minY + maxY) * 0.5) * cellSize;
    const frameMaterial = this.getAtlasMaterial("#b69f80");

    if (axis === "horizontal") {
      return [
        this.createTexturedBox(
          `door-frame-top-${doorId}`,
          {
            width: ((maxX - minX + 1) * cellSize) + cellSize * 0.18,
            depth: cellSize * 0.18,
            height: 0.22
          },
          tileIndex,
          frameMaterial,
          new Vector3(midX, WALL_HEIGHT - 0.11, minY * cellSize)
        ),
        this.createTexturedBox(
          `door-frame-left-${doorId}`,
          {
            width: 0.22,
            depth: cellSize * 0.18,
            height: WALL_HEIGHT - 0.18
          },
          tileIndex,
          frameMaterial,
          new Vector3((minX * cellSize) - cellSize * 0.5 + 0.11, (WALL_HEIGHT - 0.18) * 0.5, minY * cellSize)
        ),
        this.createTexturedBox(
          `door-frame-right-${doorId}`,
          {
            width: 0.22,
            depth: cellSize * 0.18,
            height: WALL_HEIGHT - 0.18
          },
          tileIndex,
          frameMaterial,
          new Vector3((maxX * cellSize) + cellSize * 0.5 - 0.11, (WALL_HEIGHT - 0.18) * 0.5, minY * cellSize)
        )
      ];
    }

    return [
      this.createTexturedBox(
        `door-frame-top-${doorId}`,
        {
          width: cellSize * 0.18,
          depth: ((maxY - minY + 1) * cellSize) + cellSize * 0.18,
          height: 0.22
        },
        tileIndex,
        frameMaterial,
        new Vector3(minX * cellSize, WALL_HEIGHT - 0.11, midY)
      ),
      this.createTexturedBox(
        `door-frame-north-${doorId}`,
        {
          width: cellSize * 0.18,
          depth: 0.22,
          height: WALL_HEIGHT - 0.18
        },
        tileIndex,
        frameMaterial,
        new Vector3(minX * cellSize, (WALL_HEIGHT - 0.18) * 0.5, (minY * cellSize) - cellSize * 0.5 + 0.11)
      ),
      this.createTexturedBox(
        `door-frame-south-${doorId}`,
        {
          width: cellSize * 0.18,
          depth: 0.22,
          height: WALL_HEIGHT - 0.18
        },
        tileIndex,
        frameMaterial,
        new Vector3(minX * cellSize, (WALL_HEIGHT - 0.18) * 0.5, (maxY * cellSize) + cellSize * 0.5 - 0.11)
      )
    ];
  }

  private createDoorLockMarkers(
    doorId: string,
    gridCells: readonly { x: number; y: number }[],
    axis: DoorAxis,
    profile: DoorVisualProfile
  ): Mesh[] {
    const cellSize = this.content.level.cellSize;
    const xs = gridCells.map((cell) => cell.x);
    const ys = gridCells.map((cell) => cell.y);
    const center = new Vector3(
      ((Math.min(...xs) + Math.max(...xs)) * 0.5) * cellSize,
      WALL_HEIGHT * 0.55,
      ((Math.min(...ys) + Math.max(...ys)) * 0.5) * cellSize
    );
    const color = keyColorHex(profile.keyColor);
    const material = this.getSolidMaterial(color);
    const forwardOffset = axis === "horizontal"
      ? [new Vector3(0, 0, cellSize * 0.28), new Vector3(0, 0, -cellSize * 0.28)]
      : [new Vector3(cellSize * 0.28, 0, 0), new Vector3(-cellSize * 0.28, 0, 0)];
    const heights = [-0.28, 0, 0.28];
    const meshes: Mesh[] = [];

    for (const offset of forwardOffset) {
      for (let index = 0; index < heights.length; index += 1) {
        const plate = MeshBuilder.CreateBox(
          `door-lock-${doorId}-${meshes.length}`,
          {
            width: cellSize * 0.18,
            depth: cellSize * 0.08,
            height: cellSize * 0.18
          },
          this.scene
        );
        plate.position = center.add(offset);
        plate.position.y += heights[index];
        if (axis === "vertical") {
          plate.rotation.y = Math.PI * 0.5;
        }
        plate.material = material;
        meshes.push(plate);
      }
    }

    return meshes;
  }

  private getDoorLeafMaterial(profile: DoorVisualProfile, isLocked: boolean): StandardMaterial {
    if (isLocked) {
      return this.getAtlasMaterial(profile.emissiveColor ?? keyColorHex(profile.keyColor));
    }
    return this.getAtlasMaterial("#caa56a");
  }

  private createTexturedBox(
    name: string,
    dimensions: { width: number; depth: number; height: number },
    tileIndex: number,
    material: StandardMaterial,
    position: Vector3
  ): Mesh {
    const uv = this.wallAtlas.getTileUV(tileIndex);
    const faceUV = Array.from({ length: 6 }, () => new Vector4(uv.u0, uv.v0, uv.u1, uv.v1));
    const mesh = MeshBuilder.CreateBox(name, { ...dimensions, faceUV }, this.scene);
    mesh.position = position;
    mesh.material = material;
    return mesh;
  }

  private getAtlasMaterial(emissiveHex?: string | null): StandardMaterial {
    const key = emissiveHex ?? "__base__";
    const existing = this.atlasMaterials.get(key);
    if (existing) {
      return existing;
    }

    if (!emissiveHex) {
      this.atlasMaterials.set(key, this.wallMaterial);
      return this.wallMaterial;
    }

    const material = this.wallMaterial.clone(`wall-atlas-${key}`);
    material.emissiveColor = Color3.FromHexString(emissiveHex);
    this.atlasMaterials.set(key, material);
    return material;
  }

  private getSolidMaterial(colorHex: string): StandardMaterial {
    const existing = this.solidMaterials.get(colorHex);
    if (existing) {
      return existing;
    }

    const material = new StandardMaterial(`solid-${colorHex}`, this.scene);
    material.diffuseColor = Color3.FromHexString(colorHex);
    material.emissiveColor = Color3.FromHexString(colorHex);
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    this.solidMaterials.set(colorHex, material);
    return material;
  }

  private pickProfileTextureIndex(
    texturePool: readonly string[],
    x: number,
    y: number,
    variationMode: WallVariationMode,
    allowNeighborDeDupe: boolean,
    neighborTextureIndices: number[] = []
  ): number {
    const pool = texturePool.map((tileId) => getWallAtlasTileIndex(tileId));
    if (pool.length === 0) {
      throw new Error("Wall presentation profile is missing texture tiles.");
    }

    if (variationMode === "fixed" || pool.length === 1) {
      return pool[0];
    }

    const hashed = wallHash(x, y, texturePool.join(":"));
    let textureIndex = pool[hashed % pool.length];
    if (!allowNeighborDeDupe) {
      return textureIndex;
    }

    const blocked = new Set(neighborTextureIndices);
    for (let offset = 1; offset < pool.length && blocked.has(textureIndex); offset += 1) {
      textureIndex = pool[(hashed + offset) % pool.length];
    }
    return textureIndex;
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

function resolveDoorAxis(gridCells: readonly { x: number; y: number }[]): DoorAxis {
  const uniqueYs = new Set(gridCells.map((cell) => cell.y));
  return uniqueYs.size === 1 ? "horizontal" : "vertical";
}

function keyColorHex(keyColor: DoorVisualProfile["keyColor"]): string {
  switch (keyColor) {
    case "green":
      return "#5fd46b";
    case "yellow":
      return "#f3c75f";
    case "blue":
      return "#6ca4ff";
    default:
      return "#df7f5c";
  }
}

function wallHash(x: number, y: number, salt: string): number {
  let hash = (x * 73856093) ^ (y * 19349663) ^ (salt.length * 83492791);
  hash ^= hash >>> 13;
  return Math.abs(hash);
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function floorRegionCenterY(height: number): number {
  return (height * FLOOR_REGION_MESH_HEIGHT) - FLOOR_REGION_MESH_HEIGHT * 0.5;
}
