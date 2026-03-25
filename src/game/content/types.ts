export type WeaponAmmoType = "none" | "bullets";
export type EnemyAttackType = "melee" | "projectile";
export type PickupKind = "health" | "ammo";
export type SpriteAnimationStateName = "idle" | "move" | "attack" | "hurt" | "death";

export interface WeaponDefinition {
  id: string;
  name: string;
  slot: number;
  ammoType: WeaponAmmoType;
  ammoPerShot: number;
  cooldown: number;
  damage: number;
  projectileSpeed: number;
  range: number;
  projectileLife: number;
  fireMode: "hitscan" | "projectile";
  uiColor: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  health: number;
  moveSpeed: number;
  radius: number;
  height: number;
  attackType: EnemyAttackType;
  attackDamage: number;
  aggroRange: number;
  meleeRange: number;
  windupTime: number;
  cooldownTime: number;
  loseSightGrace: number;
  hurtTime: number;
  projectileSpeed: number;
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

export interface PickupSpawn extends GridPoint {
  id: string;
  kind: PickupKind;
  amount: number;
}

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
  playerStart: PlayerStart;
  grid: string[];
  pickups: PickupSpawn[];
  enemies: EnemySpawn[];
  briefing: string;
}

export interface SpriteAtlasDefinition {
  id: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  generatorId: string;
}

export interface SpriteClipDefinition {
  id: string;
  startFrame: number;
  length: number;
  fps: number;
  loop: boolean;
}

export interface SpriteAnimationDefinition {
  state: SpriteAnimationStateName;
  directionalClips: string[];
}

export interface SpriteSetDefinition {
  id: string;
  atlasId: string;
  defaultState: SpriteAnimationStateName;
  worldWidth: number;
  worldHeight: number;
  anchorOffsetY: number;
  clips: SpriteClipDefinition[];
  animations: SpriteAnimationDefinition[];
}

export interface EntityVisualDefinition {
  entityId: string;
  spriteSetId: string;
}

export interface VisualDatabaseDefinition {
  atlases: SpriteAtlasDefinition[];
  spriteSets: SpriteSetDefinition[];
  entities: EntityVisualDefinition[];
}

export interface ContentDatabase {
  weapons: Map<string, WeaponDefinition>;
  enemies: Map<string, EnemyDefinition>;
  level: LevelDefinition;
  visuals: VisualDatabaseDefinition;
}
