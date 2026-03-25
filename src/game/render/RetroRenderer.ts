import {
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
  WebGPUEngine
} from "@babylonjs/core";
import type { ContentDatabase, SpriteAnimationStateName } from "../content/types";
import type { EnemyState, GameSessionState, PickupState, ProjectileState } from "../core/types";
import { AnimatedSpriteInstance, SpriteLibrary } from "./SpritePipeline";

const PLAYER_EYE_HEIGHT = 1.2;

export class RetroRenderer {
  readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly root: TransformNode;
  private readonly spriteLibrary: SpriteLibrary;
  private readonly enemySprites = new Map<string, AnimatedSpriteInstance>();
  private readonly pickupSprites = new Map<string, AnimatedSpriteInstance>();
  private readonly projectileSprites = new Map<number, AnimatedSpriteInstance>();
  private readonly weaponSprites = new Map<string, AnimatedSpriteInstance>();
  private readonly floorMaterial: StandardMaterial;
  private readonly ceilingMaterial: StandardMaterial;
  private readonly wallMaterial: StandardMaterial;

  constructor(
    private readonly engine: Engine | WebGPUEngine,
    private readonly content: ContentDatabase
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
    this.floorMaterial = createPatternMaterial(this.scene, "floor", "#342a1e", "#1f1812", "#4b3a2e");
    this.ceilingMaterial = createPatternMaterial(this.scene, "ceiling", "#221511", "#100b09", "#382019");
    this.wallMaterial = createPatternMaterial(this.scene, "wall", "#6b4a2f", "#2a1b12", "#8a674a");
    this.spriteLibrary = new SpriteLibrary(this.scene, content.visuals);

    this.buildStaticLevel();
    this.buildSprites();
    this.setAttractCamera();
  }

  setPixelScale(scale: number): void {
    this.engine.setHardwareScalingLevel(scale);
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
  }

  dispose(): void {
    this.scene.dispose();
  }

  sync(state: GameSessionState, dt: number): void {
    this.camera.position.x = state.player.x;
    this.camera.position.z = state.player.y;
    this.camera.position.y = PLAYER_EYE_HEIGHT + Math.sin(state.player.bobPhase) * 0.03;
    this.camera.rotation.y = Math.PI / 2 - state.player.angle;

    this.syncEnemies(state.enemies, state.player.x, state.player.y, dt);
    this.syncPickups(state.pickups, state.player.x, state.player.y, dt);
    this.syncProjectiles(state.projectiles, state.player.x, state.player.y, dt);
    this.syncWeapon(state, dt);
  }

  private buildStaticLevel(): void {
    const { grid, cellSize } = this.content.level;
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
    ceiling.position.y = 2.6;
    ceiling.rotation.x = Math.PI;
    ceiling.material = this.ceilingMaterial;
    ceiling.parent = this.root;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (grid[y][x] !== "#") {
          continue;
        }

        const wall = MeshBuilder.CreateBox(
          `wall-${x}-${y}`,
          { width: cellSize, depth: cellSize, height: 2.6 },
          this.scene
        );
        wall.position = new Vector3(x * cellSize, 1.3, y * cellSize);
        wall.material = this.wallMaterial;
        wall.parent = this.root;
      }
    }
  }

  private buildSprites(): void {
    for (const enemy of this.content.level.enemies) {
      const sprite = this.spriteLibrary.createSpriteForEntity(enemy.type, "world");
      this.enemySprites.set(enemy.id, sprite);
    }

    for (const pickup of this.content.level.pickups) {
      const sprite = this.spriteLibrary.createSpriteForEntity(`pickup:${pickup.kind}`, "world");
      this.pickupSprites.set(pickup.id, sprite);
    }

    for (const weapon of this.content.weapons.values()) {
      const sprite = this.spriteLibrary.createSpriteForEntity(`weapon:${weapon.id}`, "view", this.camera);
      sprite.mesh.rotation.y = Math.PI;
      sprite.mesh.position.set(0.36, -0.27, 0.82);
      this.weaponSprites.set(weapon.id, sprite);
    }
  }

  private syncEnemies(enemies: EnemyState[], viewerX: number, viewerY: number, dt: number): void {
    for (const enemy of enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) {
        continue;
      }

      sprite.setVisible(true);
      sprite.setPosition(enemy.x, enemy.y, sprite.anchorOffsetY);
      sprite.setFacingAngle(enemy.facingAngle);
      sprite.setAnimationState(enemyAnimationState(enemy));
      sprite.update(dt, viewerX, viewerY);
    }
  }

  private syncPickups(pickups: PickupState[], viewerX: number, viewerY: number, dt: number): void {
    const time = performance.now() * 0.001;
    for (const pickup of pickups) {
      const sprite = this.pickupSprites.get(pickup.id);
      if (!sprite) {
        continue;
      }

      sprite.setVisible(!pickup.collected);
      if (pickup.collected) {
        continue;
      }

      sprite.setPosition(pickup.x, pickup.y, sprite.anchorOffsetY + Math.sin(time * 2 + pickup.x) * 0.04);
      sprite.setFacingAngle(0);
      sprite.setAnimationState("idle");
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
        sprite = this.spriteLibrary.createSpriteForEntity(`projectile:${projectile.weaponId}`, "world");
        this.projectileSprites.set(projectile.id, sprite);
      }

      sprite.setVisible(true);
      sprite.setPosition(projectile.x, projectile.y, sprite.anchorOffsetY + 0.5);
      sprite.setFacingAngle(Math.atan2(projectile.dy, projectile.dx));
      sprite.setAnimationState("idle");
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

  private syncWeapon(state: GameSessionState, dt: number): void {
    for (const [weaponId, sprite] of this.weaponSprites) {
      const visible = weaponId === state.weapon.currentId && state.player.alive;
      sprite.setVisible(visible);
      if (!visible) {
        continue;
      }

      sprite.mesh.position.x = 0.36;
      sprite.mesh.position.y = -0.27 + Math.sin(state.player.bobPhase) * 0.01;
      sprite.mesh.position.z = 0.82;
      sprite.setAnimationState(state.weapon.viewAnimation);
      sprite.update(dt);
    }
  }
}

function enemyAnimationState(enemy: EnemyState): SpriteAnimationStateName {
  switch (enemy.fsmState) {
    case "chase":
      return "move";
    case "windup":
    case "attack":
    case "cooldown":
      return "attack";
    case "hurt":
      return "hurt";
    case "dead":
      return "death";
    case "idle":
    case "alert":
    default:
      return "idle";
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
