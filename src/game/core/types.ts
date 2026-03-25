import type { PickupKind, SpriteAnimationStateName } from "../content/types";

export type AppMode =
  | "boot"
  | "main_menu"
  | "starting_run"
  | "in_game"
  | "death_transition"
  | "paused";

export type EnemyFsmState =
  | "idle"
  | "alert"
  | "chase"
  | "windup"
  | "attack"
  | "cooldown"
  | "hurt"
  | "dead";

export interface SettingsState {
  masterVolume: number;
  mouseSensitivity: number;
  pixelScale: number;
}

export interface WeaponRuntimeState {
  currentId: string;
  unlocked: string[];
  cooldownRemaining: number;
  viewAnimation: SpriteAnimationStateName;
  viewAnimationTime: number;
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
  ammo: number;
  alive: boolean;
}

export interface EnemyState {
  id: string;
  typeId: string;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  health: number;
  alive: boolean;
  fsmState: EnemyFsmState;
  stateTime: number;
  lastKnownPlayerX: number;
  lastKnownPlayerY: number;
  hasLineOfSight: boolean;
  facingAngle: number;
  memoryTime: number;
  attackApplied: boolean;
}

export interface ProjectileState {
  id: number;
  source: "player" | "enemy";
  ownerId: string;
  weaponId: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  radius: number;
  damage: number;
  ttl: number;
}

export interface PickupState {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  amount: number;
  collected: boolean;
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
}

export interface GameSessionState {
  level: LevelState;
  player: PlayerState;
  weapon: WeaponRuntimeState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  messages: SimulationMessage[];
  elapsedTime: number;
  killCount: number;
  totalKills: number;
}

export type GameState = GameSessionState;

export interface SaveGameData {
  version: 1;
  savedAt: string;
  state: GameSessionState;
}

export interface HudViewModel {
  visible: boolean;
  health: number;
  ammo: number;
  weaponName: string;
  enemiesRemaining: number;
  message: string;
  backend: "webgpu" | "webgl";
}

export interface SpriteRuntimeState {
  animationState: SpriteAnimationStateName;
  animationTime: number;
  directionIndex: number;
  finished: boolean;
}
