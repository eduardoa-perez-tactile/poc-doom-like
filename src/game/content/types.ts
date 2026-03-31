import type { PickupDef, PickupVisualDefinition, WorldPickupSpawn } from "./pickups";
import type { FlatDefId } from "./flats/flatTypes";
import type { LevelScriptDef } from "../simulation/script/LevelScriptTypes";
import type { LevelAutomapMetadataDef } from "../simulation/map/AutomapTypes";

export type WeaponId = string;
export type AmmoType =
  | "wand"
  | "crossbow"
  | "claw"
  | "hellstaff"
  | "phoenix"
  | "firemace";
export type WeaponAmmoType = "none" | AmmoType;
export type EnemyAttackType = "melee" | "projectile";
export type EnemyAttackVisualKey = string;
export type WallTextureTypeName =
  | "Stone"
  | "Brick"
  | "Wood"
  | "Metal"
  | "Decorative"
  | "Door"
  | "Portal"
  | "Lava"
  | "Water"
  | "Moss"
  | "Arcane"
  | "StainedGlass"
  | "Bars";
export type SpriteAnimationStateName =
  | "idle"
  | "move"
  | "attack"
  | "attack_melee"
  | "attack_ranged"
  | "hurt"
  | "death"
  | "impact"
  | "select"
  | "lower";

export type WeaponBehaviorKind =
  | "melee_strike"
  | "melee_latch"
  | "hitscan_single"
  | "hitscan_rapid"
  | "projectile_single"
  | "projectile_spread"
  | "projectile_bounce"
  | "projectile_splash"
  | "projectile_homing"
  | "impact_spawn_hazard"
  | "beam_sustain";

export type GhostInteractionRule = "normal" | "ignore";

export interface WeaponSpreadDefinition {
  count: number;
  angleDeg: number;
}

export interface WeaponBounceDefinition {
  maxBounces: number;
  speedMultiplier?: number;
  seekAfterBounce?: boolean;
}

export interface WeaponSplashDefinition {
  radius: number;
  damageScale?: number;
}

export interface WeaponHazardDefinition {
  visualId: string;
  radius: number;
  duration: number;
  damagePerTick: number;
  tickInterval: number;
}

export interface WeaponProjectileDefinition {
  visualId: string;
  speed: number;
  life: number;
  radius: number;
  homingStrength?: number;
}

export interface WeaponImpactEffectDefinition {
  kind: "radial_burst" | "hazard_cloud" | "flame_visual";
  projectileVisualId?: string;
  count?: number;
  spreadAngleDeg?: number;
  damage?: number;
  speed?: number;
  life?: number;
  radius?: number;
  hazard?: WeaponHazardDefinition;
}

export interface WeaponBehaviorDefinition {
  kind: WeaponBehaviorKind;
  damage: number;
  range?: number;
  reach?: number;
  coneAngleDeg?: number;
  holdToFire?: boolean;
  healFactor?: number;
  knockback?: number;
  ghostInteraction?: GhostInteractionRule;
  spread?: WeaponSpreadDefinition;
  projectile?: WeaponProjectileDefinition;
  bounce?: WeaponBounceDefinition;
  splash?: WeaponSplashDefinition;
  impactEffect?: WeaponImpactEffectDefinition;
}

export type WeaponBehaviorDef = WeaponBehaviorDefinition;

export interface WeaponBehaviorOverrides {
  damageBonus?: number;
  cooldownScale?: number;
  ammoCostDelta?: number;
  extraProjectiles?: number;
  extraBounces?: number;
  splashRadiusBonus?: number;
  hazardDurationBonus?: number;
  spreadCountBonus?: number;
  impactBurstCountBonus?: number;
  projectileSpeedScale?: number;
  homingStrengthBonus?: number;
}

export interface WeaponRuntimeTuning extends WeaponBehaviorOverrides {
  weaponId: WeaponId;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  slot: number;
  ammoType: WeaponAmmoType;
  ammoCostBase: number;
  ammoCostPowered: number;
  cooldownBase: number;
  cooldownPowered: number;
  uiColor: string;
  startingOwned?: boolean;
  baseBehavior: WeaponBehaviorDefinition;
  poweredBehavior: WeaponBehaviorDefinition;
}

export interface EnemyDefinition {
  id: string;
  displayName: string;
  visualProfileId: string;
  health: number;
  moveSpeed: number;
  radius: number;
  height: number;
  aggroRange: number;
  loseSightGrace: number;
  preferredRange?: number;
  hurtTime: number;
  enemyClass?: string;
  attackProfileId: string;
  deathProfileId?: string;
  isGhost?: boolean;
  notes?: string;
}

export interface EnemyAttackProfileDefinition {
  id: string;
  type: EnemyAttackType;
  windupTime: number;
  cooldownTime: number;
  damage: number;
  range: number;
  projectileDefId?: string;
  projectileSpeed?: number;
  attackVisualKey?: EnemyAttackVisualKey;
  fireCount?: number;
  spreadDegrees?: number;
  spawnOffset?: number;
  requiresLineOfSight?: boolean;
  notes?: string;
}

export interface EnemyRuntimeTuning {
  healthScale?: number;
  moveSpeedScale?: number;
  attackDamageScale?: number;
  attackCooldownScale?: number;
  projectileSpeedScale?: number;
  aggroRangeScale?: number;
}

export interface EnemyDeathProfileDefinition {
  id: string;
  spawnEnemyIds?: string[];
  spawnEffectIds?: string[];
  removeBodyAfterSeconds?: number | null;
  leaveCorpse?: boolean;
  notes?: string;
}

export interface EnemyVisualProfileDefinition {
  id: string;
  entityId: string;
  idleState?: SpriteAnimationStateName;
  moveState?: SpriteAnimationStateName;
  hurtState?: SpriteAnimationStateName;
  deathState?: SpriteAnimationStateName;
  defaultAttackState?: SpriteAnimationStateName;
  attackStates?: Record<string, SpriteAnimationStateName>;
  notes?: string;
}

export interface EnemyProjectileDefinition {
  id: string;
  visualId: string;
  radius: number;
  life: number;
  spawnOffset?: number;
  impactEffectId?: string;
  notes?: string;
}

export interface EffectDefinition {
  id: string;
  visualId: string;
  lifetime: number;
  animationState?: SpriteAnimationStateName;
  heightOffset?: number;
  notes?: string;
}

export interface GridPoint {
  x: number;
  y: number;
}

export interface PlayerStart {
  x: number;
  y: number;
  angleDeg: number;
}

export type PickupSpawn = WorldPickupSpawn;

export interface EnemySpawn extends GridPoint {
  id: string;
  type: string;
  facingDeg?: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  cellSize: number;
  skyColor: string;
  fogColor: string;
  ambientColor: string;
  floorFlat?: FlatDefId;
  ceilingFlat?: FlatDefId;
  playerStart: PlayerStart;
  grid: string[];
  wallTypes?: Record<string, WallTextureTypeName>;
  pickups: PickupSpawn[];
  enemies: EnemySpawn[];
  briefing: string;
  objectives?: string[];
  script?: LevelScriptDef;
  map?: LevelAutomapMetadataDef;
}

export interface ContentRuntimeTuning {
  weaponTunings?: WeaponRuntimeTuning[];
  enemyTuning?: EnemyRuntimeTuning | null;
  additionalEnemySpawns?: EnemySpawn[];
  disabledPickupDefIds?: string[];
}

export interface SpriteRectDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteSheetDefinition {
  id: string;
  imageUrl: string;
  chromaKeyColors: string[];
  clearRects?: SpriteRectDefinition[];
}

export interface SpriteFrameDefinition extends SpriteRectDefinition {
  id: string;
  offsetX?: number;
  offsetY?: number;
}

export interface SpriteClipDefinition {
  id: string;
  frames: string[];
  fps: number;
  loop: boolean;
}

export interface DirectionalSpriteClipDefinition {
  clipId: string;
  mirrorX?: boolean;
}

export interface SpriteAnimationDefinition {
  state: SpriteAnimationStateName;
  directionalClips: DirectionalSpriteClipDefinition[];
}

export interface SpriteViewModelDefinition {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  bobAmplitude?: number;
  flipX?: boolean;
  flipY?: boolean;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
}

export interface SpriteSetDefinition {
  id: string;
  sheetId: string;
  defaultState: SpriteAnimationStateName;
  worldWidth: number;
  worldHeight: number;
  anchorOffsetY: number;
  verticalPlacement?: "anchor" | "grounded";
  groundClearance?: number;
  worldFacing?: "billboard" | "direction";
  flipX?: boolean;
  flipY?: boolean;
  pivotX?: number;
  pivotY?: number;
  viewModel?: SpriteViewModelDefinition;
  frames: SpriteFrameDefinition[];
  clips: SpriteClipDefinition[];
  animations: SpriteAnimationDefinition[];
}

export interface EntityVisualDefinition {
  entityId: string;
  spriteSetId: string;
}

export interface VisualDatabaseDefinition {
  sheets: SpriteSheetDefinition[];
  spriteSets: SpriteSetDefinition[];
  entities: EntityVisualDefinition[];
}

export interface ContentDatabase {
  weapons: Map<string, WeaponDefinition>;
  enemies: Map<string, EnemyDefinition>;
  enemyAttackProfiles: Map<string, EnemyAttackProfileDefinition>;
  enemyDeathProfiles: Map<string, EnemyDeathProfileDefinition>;
  enemyVisualProfiles: Map<string, EnemyVisualProfileDefinition>;
  projectiles: Map<string, EnemyProjectileDefinition>;
  effects: Map<string, EffectDefinition>;
  pickupDefs: Map<string, PickupDef>;
  pickupVisuals: Map<string, PickupVisualDefinition>;
  level: LevelDefinition;
  visuals: VisualDatabaseDefinition;
}
