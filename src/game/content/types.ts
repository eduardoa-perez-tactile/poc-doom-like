export type WeaponAmmoType = "none" | "shards";
export type EnemyAttackType = "melee" | "projectile";
export type PickupKind = "health" | "ammo" | "key" | "weapon";
export type DoorKeyId = "ember_key";

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
  attackRange: number;
  attackCooldown: number;
  projectileSpeed: number;
  aggroRange: number;
  colorA: string;
  colorB: string;
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

export interface DoorSpawn extends GridPoint {
  id: string;
  keyId?: DoorKeyId;
  secret?: boolean;
  initiallyOpen?: boolean;
}

export interface PickupSpawn extends GridPoint {
  id: string;
  kind: PickupKind;
  amount?: number;
  keyId?: DoorKeyId;
  weaponId?: string;
}

export interface EnemySpawn extends GridPoint {
  id: string;
  type: string;
  facingDeg?: number;
}

export interface ExitSpawn extends GridPoint {
  id: string;
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
  doors: DoorSpawn[];
  pickups: PickupSpawn[];
  enemies: EnemySpawn[];
  exits: ExitSpawn[];
  briefing: string;
}

export interface ContentDatabase {
  weapons: Map<string, WeaponDefinition>;
  enemies: Map<string, EnemyDefinition>;
  level: LevelDefinition;
}
