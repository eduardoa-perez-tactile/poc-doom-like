import type { InventoryEntry, PlayerEffectTimers, WorldPickupInstance } from "../content/pickups";
import type { SpriteAnimationStateName, WeaponAmmoType } from "../content/types";
import type { LevelScriptRuntimeState } from "../simulation/script/LevelScriptTypes";
import type { AutomapRuntimeState } from "../simulation/map/AutomapTypes";

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
  viewAnimationRevision: number;
  sustainTargetId: string | null;
}

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  radius: number;
  moveSpeed: number;
  bobPhase: number;
  ammo: Record<Exclude<WeaponAmmoType, "none">, number>;
  ammoCapacity: Record<Exclude<WeaponAmmoType, "none">, number>;
  keys: string[];
  inventory: InventoryEntry[];
  inventoryCapacity: number;
  selectedInventoryIndex: number;
  effects: PlayerEffectTimers;
  flags: string[];
  alive: boolean;
}

export interface TomeRuntimeState {
  active: boolean;
  remaining: number;
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
  visualId: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  radius: number;
  damage: number;
  ttl: number;
  homingStrength: number;
  splashRadius: number;
  splashDamageScale: number;
  bouncesRemaining: number;
  bounceSpeedMultiplier: number;
  seekAfterBounce: boolean;
  hasBounced: boolean;
  impactBurstVisualId?: string;
  impactBurstCount?: number;
  impactBurstSpreadDeg?: number;
  impactEffectId?: string;
  impactHazard?: HazardTemplateState;
}

export interface HazardTemplateState {
  visualId: string;
  radius: number;
  duration: number;
  damagePerTick: number;
  tickInterval: number;
}

export interface HazardState {
  id: number;
  source: "player" | "enemy";
  ownerId: string;
  weaponId: string;
  visualId: string;
  x: number;
  y: number;
  radius: number;
  damagePerTick: number;
  tickInterval: number;
  tickRemaining: number;
  ttl: number;
}

export interface EffectState {
  id: number;
  effectId: string;
  x: number;
  y: number;
  facingAngle: number;
  ttl: number;
  animationState: SpriteAnimationStateName;
}

export type PickupState = WorldPickupInstance;

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
  levelScript: LevelScriptRuntimeState | null;
  automap: AutomapRuntimeState;
  player: PlayerState;
  tome: TomeRuntimeState;
  weapon: WeaponRuntimeState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  hazards: HazardState[];
  effects: EffectState[];
  pickups: PickupState[];
  messages: SimulationMessage[];
  elapsedTime: number;
  killCount: number;
  totalKills: number;
  secretsFound: number;
  totalSecrets: number;
  levelCompleted: boolean;
}

export type GameState = GameSessionState;

export interface SaveGameData {
  version: 5;
  savedAt: string;
  state: GameSessionState;
}

export interface HudViewModel {
  visible: boolean;
  health: number;
  armor: number;
  ammo: number;
  weaponName: string;
  enemiesRemaining: number;
  message: string;
  keys: string[];
  inventory: HudInventoryEntry[];
  selectedInventoryIndex: number;
  automapOpen: boolean;
  backend: "webgpu" | "webgl";
}

export interface HudIconFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HudInventoryEntry {
  defId: string;
  label: string;
  count: number;
  iconFrame: HudIconFrame | null;
}

export interface SpriteRuntimeState {
  animationState: SpriteAnimationStateName;
  animationTime: number;
  directionIndex: number;
  finished: boolean;
}
