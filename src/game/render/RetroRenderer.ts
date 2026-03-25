import {
  AbstractMesh,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
  WebGPUEngine
} from "@babylonjs/core";
import type { ContentDatabase } from "../content/types";
import type { DoorState, EnemyState, GameState, PickupState, ProjectileState } from "../core/types";

const PLAYER_EYE_HEIGHT = 1.2;

export class RetroRenderer {
  readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly root: TransformNode;
  private readonly enemyMeshes = new Map<string, Mesh>();
  private readonly pickupMeshes = new Map<string, Mesh>();
  private readonly doorMeshes = new Map<string, Mesh>();
  private readonly projectileMeshes = new Map<number, Mesh>();
  private readonly exitMeshes = new Map<string, Mesh>();
  private readonly wallMaterial: StandardMaterial;
  private readonly secretWallMaterial: StandardMaterial;
  private readonly floorMaterial: StandardMaterial;
  private readonly ceilingMaterial: StandardMaterial;
  private readonly doorMaterial: StandardMaterial;
  private readonly exitMaterial: StandardMaterial;
  private readonly weaponNode: TransformNode;

  constructor(
    private readonly engine: Engine | WebGPUEngine,
    private readonly content: ContentDatabase
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor = Color4.FromHexString(`${content.level.skyColor}ff`);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.03;
    this.scene.fogColor = Color3.FromHexString(content.level.fogColor);

    this.camera = new UniversalCamera("player-camera", new Vector3(0, PLAYER_EYE_HEIGHT, 0), this.scene);
    this.camera.fov = 1.18;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 80;
    this.camera.inputs.clear();

    new HemisphericLight("key-light", new Vector3(0.2, 1, 0.1), this.scene).intensity = 0.65;

    this.root = new TransformNode("world-root", this.scene);
    this.wallMaterial = createPatternMaterial(this.scene, "wall", "#6b4a2f", "#2a1b12", "#8a674a");
    this.secretWallMaterial = createPatternMaterial(this.scene, "secret-wall", "#4b3c35", "#231817", "#65514b");
    this.floorMaterial = createPatternMaterial(this.scene, "floor", "#342a1e", "#1f1812", "#4b3a2e");
    this.ceilingMaterial = createPatternMaterial(this.scene, "ceiling", "#221511", "#100b09", "#382019");
    this.doorMaterial = createPatternMaterial(this.scene, "door", "#7c6a3d", "#2f2817", "#aa8f55");
    this.exitMaterial = createSpriteMaterial(this.scene, "exit", "#f4ca74", "#704a18");

    this.buildStaticLevel();
    this.buildDynamicProps();

    this.weaponNode = MeshBuilder.CreatePlane(
      "weapon-plane",
      { width: 0.85, height: 0.45 },
      this.scene
    );
    this.weaponNode.parent = this.camera;
    this.weaponNode.position = new Vector3(0.34, -0.28, 0.8);
    this.weaponNode.rotation = new Vector3(0, Math.PI, 0);
    (this.weaponNode as Mesh).material = createWeaponMaterial(this.scene);
    (this.weaponNode as Mesh).renderingGroupId = 1;
  }

  setPixelScale(scale: number): void {
    this.engine.setHardwareScalingLevel(scale);
  }

  render(): void {
    this.scene.render();
  }

  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.scene.dispose();
  }

  sync(state: GameState): void {
    this.camera.position.x = state.player.x;
    this.camera.position.z = state.player.y;
    this.camera.position.y = PLAYER_EYE_HEIGHT + Math.sin(state.player.bobPhase) * 0.03;
    this.camera.rotation.y = Math.PI / 2 - state.player.angle;

    this.syncDoors(state.level.doors);
    this.syncPickups(state.pickups);
    this.syncEnemies(state.enemies);
    this.syncProjectiles(state.projectiles);
    this.syncExits(state);
    this.syncWeaponColor(state.weapon.currentId);
  }

  private buildStaticLevel(): void {
    const { grid, cellSize, ambientColor } = this.content.level;
    const width = grid[0]?.length ?? 0;
    const height = grid.length;
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: width * cellSize, height: height * cellSize },
      this.scene
    );
    ground.position.x = ((width - 1) * cellSize) / 2;
    ground.position.z = ((height - 1) * cellSize) / 2;
    ground.material = this.floorMaterial;
    ground.parent = this.root;

    const ceiling = MeshBuilder.CreateGround(
      "ceiling",
      { width: width * cellSize, height: height * cellSize },
      this.scene
    );
    ceiling.position.x = ground.position.x;
    ceiling.position.z = ground.position.z;
    ceiling.position.y = 2.4;
    ceiling.rotation.x = Math.PI;
    ceiling.material = this.ceilingMaterial;
    ceiling.parent = this.root;

    this.scene.ambientColor = Color3.FromHexString(ambientColor);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (grid[y][x] !== "#") {
          continue;
        }

        const wall = MeshBuilder.CreateBox(
          `wall-${x}-${y}`,
          { width: cellSize, depth: cellSize, height: 2.4 },
          this.scene
        );
        wall.position = new Vector3(x * cellSize, 1.2, y * cellSize);
        wall.material = this.wallMaterial;
        wall.parent = this.root;
      }
    }
  }

  private buildDynamicProps(): void {
    for (const door of this.content.level.doors) {
      const mesh = MeshBuilder.CreateBox(
        `door-${door.id}`,
        { width: this.content.level.cellSize, depth: this.content.level.cellSize, height: 2.2 },
        this.scene
      );
      mesh.position = new Vector3(door.x * this.content.level.cellSize, 1.1, door.y * this.content.level.cellSize);
      mesh.material = door.secret ? this.secretWallMaterial : this.doorMaterial;
      mesh.parent = this.root;
      this.doorMeshes.set(door.id, mesh);
    }

    for (const pickup of this.content.level.pickups) {
      const mesh = MeshBuilder.CreatePlane(
        `pickup-${pickup.id}`,
        { width: 0.7, height: 0.7 },
        this.scene
      );
      mesh.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
      mesh.position = new Vector3(
        pickup.x * this.content.level.cellSize,
        0.55,
        pickup.y * this.content.level.cellSize
      );
      mesh.material = createPickupMaterial(this.scene, pickup.kind);
      mesh.parent = this.root;
      this.pickupMeshes.set(pickup.id, mesh);
    }

    for (const enemy of this.content.level.enemies) {
      const definition = this.content.enemies.get(enemy.type);
      if (!definition) {
        continue;
      }

      const mesh = MeshBuilder.CreatePlane(
        `enemy-${enemy.id}`,
        { width: definition.radius * 2.6, height: definition.height },
        this.scene
      );
      mesh.billboardMode = AbstractMesh.BILLBOARDMODE_Y;
      mesh.position = new Vector3(
        enemy.x * this.content.level.cellSize,
        definition.height * 0.5,
        enemy.y * this.content.level.cellSize
      );
      mesh.material = createEnemyMaterial(
        this.scene,
        `${enemy.id}-mat`,
        definition.colorA,
        definition.colorB
      );
      mesh.parent = this.root;
      this.enemyMeshes.set(enemy.id, mesh);
    }

    for (const exit of this.content.level.exits) {
      const mesh = MeshBuilder.CreatePlane(
        `exit-${exit.id}`,
        { width: 1, height: 1.6 },
        this.scene
      );
      mesh.billboardMode = AbstractMesh.BILLBOARDMODE_Y;
      mesh.position = new Vector3(
        exit.x * this.content.level.cellSize,
        0.9,
        exit.y * this.content.level.cellSize
      );
      mesh.material = this.exitMaterial;
      mesh.parent = this.root;
      this.exitMeshes.set(exit.id, mesh);
    }
  }

  private syncDoors(doors: DoorState[]): void {
    for (const door of doors) {
      const mesh = this.doorMeshes.get(door.id);
      if (!mesh) {
        continue;
      }
      mesh.setEnabled(!door.open);
    }
  }

  private syncPickups(pickups: PickupState[]): void {
    const time = performance.now() * 0.001;
    for (const pickup of pickups) {
      const mesh = this.pickupMeshes.get(pickup.id);
      if (!mesh) {
        continue;
      }
      mesh.setEnabled(!pickup.collected);
      if (!pickup.collected) {
        mesh.position.y = 0.55 + Math.sin(time * 2 + pickup.x) * 0.06;
        mesh.rotation.z = time * 0.7;
      }
    }
  }

  private syncEnemies(enemies: EnemyState[]): void {
    for (const enemy of enemies) {
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) {
        continue;
      }
      mesh.setEnabled(enemy.alive);
      if (enemy.alive) {
        const definition = this.content.enemies.get(enemy.typeId);
        mesh.position.x = enemy.x;
        mesh.position.z = enemy.y;
        mesh.position.y = (definition?.height ?? 1.6) * 0.5;
      }
    }
  }

  private syncProjectiles(projectiles: ProjectileState[]): void {
    const liveIds = new Set<number>();
    for (const projectile of projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        mesh = MeshBuilder.CreateSphere(
          `projectile-${projectile.id}`,
          { diameter: projectile.radius * 2, segments: 8 },
          this.scene
        );
        mesh.material = createSolidMaterial(this.scene, `projectile-${projectile.id}-mat`, projectile.color);
        mesh.parent = this.root;
        this.projectileMeshes.set(projectile.id, mesh);
      }
      mesh.position.set(projectile.x, 0.7, projectile.y);
      liveIds.add(projectile.id);
    }

    for (const [id, mesh] of this.projectileMeshes) {
      const alive = liveIds.has(id);
      mesh.setEnabled(alive);
      if (!alive) {
        mesh.dispose();
        this.projectileMeshes.delete(id);
      }
    }
  }

  private syncExits(state: GameState): void {
    for (const [id, mesh] of this.exitMeshes) {
      mesh.setEnabled(!state.levelComplete);
      mesh.scaling.y = 1 + Math.sin(performance.now() * 0.003 + id.length) * 0.05;
    }
  }

  private syncWeaponColor(currentWeaponId: string): void {
    const material = this.weaponNode instanceof Mesh ? (this.weaponNode.material as StandardMaterial) : null;
    if (!material) {
      return;
    }

    if (currentWeaponId === "ember_wand") {
      material.emissiveColor = Color3.FromHexString("#d67c49");
    } else {
      material.emissiveColor = Color3.FromHexString("#86d9ff");
    }
  }
}

function createPatternMaterial(
  scene: Scene,
  name: string,
  base: string,
  shadow: string,
  accent: string
): StandardMaterial {
  const texture = new DynamicTexture(`${name}-texture`, { width: 64, height: 64 }, scene, false);
  const context = texture.getContext();
  context.fillStyle = base;
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = shadow;
  for (let row = 0; row < 8; row += 1) {
    context.fillRect(0, row * 8, 64, 2);
  }
  context.fillStyle = accent;
  for (let column = 0; column < 64; column += 16) {
    context.fillRect(column, 0, 2, 64);
  }
  texture.update();
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  return material;
}

function createPickupMaterial(scene: Scene, kind: string): StandardMaterial {
  const colors: Record<string, { base: string; accent: string }> = {
    health: { base: "#d45454", accent: "#ffe3d1" },
    ammo: { base: "#76a2d9", accent: "#eef8ff" },
    key: { base: "#f2ad4a", accent: "#fff2cc" },
    weapon: { base: "#8e7ef4", accent: "#f0efff" }
  };
  const palette = colors[kind] ?? { base: "#ffffff", accent: "#202020" };
  return createSpriteMaterial(scene, `pickup-${kind}`, palette.base, palette.accent);
}

function createEnemyMaterial(
  scene: Scene,
  name: string,
  base: string,
  accent: string
): StandardMaterial {
  return createSpriteMaterial(scene, name, base, accent);
}

function createSpriteMaterial(
  scene: Scene,
  name: string,
  fillColor: string,
  accentColor: string
): StandardMaterial {
  const texture = new DynamicTexture(`${name}-texture`, { width: 64, height: 64 }, scene, true);
  const context = texture.getContext();
  context.clearRect(0, 0, 64, 64);
  context.fillStyle = "rgba(0,0,0,0)";
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = fillColor;
  context.beginPath();
  context.arc(32, 28, 18, 0, Math.PI * 2);
  context.fill();
  context.fillRect(18, 30, 28, 24);
  context.fillStyle = accentColor;
  context.fillRect(24, 24, 5, 5);
  context.fillRect(35, 24, 5, 5);
  context.fillRect(22, 46, 20, 3);
  texture.update();
  texture.hasAlpha = true;
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveTexture = texture;
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  return material;
}

function createSolidMaterial(scene: Scene, name: string, color: string): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(color);
  material.emissiveColor = Color3.FromHexString(color);
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  return material;
}

function createWeaponMaterial(scene: Scene): StandardMaterial {
  const texture = new DynamicTexture("weapon-texture", { width: 128, height: 64 }, scene, true);
  const context = texture.getContext();
  context.clearRect(0, 0, 128, 64);
  context.fillStyle = "#00000000";
  context.fillRect(0, 0, 128, 64);
  context.fillStyle = "#5a2b18";
  context.fillRect(46, 20, 36, 28);
  context.fillStyle = "#cf8a55";
  context.fillRect(36, 12, 52, 18);
  context.fillStyle = "#ffd8a0";
  context.fillRect(76, 18, 14, 8);
  texture.update();
  texture.hasAlpha = true;
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);

  const material = new StandardMaterial("weapon-material", scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveTexture = texture;
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  return material;
}
