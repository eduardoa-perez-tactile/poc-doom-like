import type { DoorKeyId } from "../content/types";

export interface SettingsState {
  masterVolume: number;
  mouseSensitivity: number;
  pixelScale: number;
}

export interface WeaponState {
  currentId: string;
  unlocked: string[];
  cooldownRemaining: number;
}

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  radius: number;
  moveSpeed: number;
  bobPhase: number;
  keys: DoorKeyId[];
  ammoShards: number;
  alive: boolean;
}

export interface EnemyState {
  id: string;
  typeId: string;
  x: number;
  y: number;
  angle: number;
  health: number;
  alive: boolean;
  cooldownRemaining: number;
  wakeTime: number;
}

export interface ProjectileState {
  id: number;
  source: "player" | "enemy";
  ownerId: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  radius: number;
  damage: number;
  ttl: number;
  color: string;
}

export interface PickupState {
  id: string;
  kind: "health" | "ammo" | "key" | "weapon";
  x: number;
  y: number;
  amount: number;
  keyId?: DoorKeyId;
  weaponId?: string;
  collected: boolean;
}

export interface DoorState {
  id: string;
  x: number;
  y: number;
  keyId?: DoorKeyId;
  secret: boolean;
  open: boolean;
}

export interface ExitState {
  id: string;
  x: number;
  y: number;
}

export interface SimulationMessage {
  text: string;
  ttl: number;
}

export interface LevelState {
  id: string;
  name: string;
  cellSize: number;
  grid: string[];
  width: number;
  height: number;
  doors: DoorState[];
  exits: ExitState[];
  secretsTotal: number;
}

export interface GameState {
  level: LevelState;
  player: PlayerState;
  weapon: WeaponState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  messages: SimulationMessage[];
  levelComplete: boolean;
  killCount: number;
  totalKills: number;
  secretsFound: number;
  totalSecrets: number;
  elapsedTime: number;
}

export interface SaveGameData {
  version: 1;
  savedAt: string;
  state: GameState;
}
