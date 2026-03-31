import type { InventoryEntry, PlayerEffectTimers, WorldPickupInstance } from "../content/pickups";
import type {
  AmmoType,
  SpriteAnimationStateName,
  WeaponBehaviorDefinition,
  WeaponId
} from "../content/types";
import type { LevelScriptRuntimeState } from "../simulation/script/LevelScriptTypes";
import type { AutomapRuntimeState } from "../simulation/map/AutomapTypes";

export type AppMode =
  | "boot"
  | "main_menu"
  | "starting_run"
  | "run_map"
  | "reward_choice"
  | "run_result"
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

export type WeaponViewAnimation = SpriteAnimationStateName;

export interface BaseStats {
  maxHealth: number;
  maxArmor: number;
  moveSpeed: number;
  radius: number;
  inventoryCapacity: number;
  armorAbsorbRatio: number;
  ammoCapacity: Record<AmmoType, number>;
}

export interface PlayerRuntimeResources {
  health: number;
  armor: number;
  ammo: Record<AmmoType, number>;
  keys: string[];
  inventory: InventoryEntry[];
  selectedInventoryIndex: number;
}

export interface DerivedStats {
  maxHealth: number;
  maxArmor: number;
  moveSpeed: number;
  radius: number;
  inventoryCapacity: number;
  armorAbsorbRatio: number;
  ammoCapacity: Record<AmmoType, number>;
  invulnerable: boolean;
  partialInvisibility: boolean;
  canFly: boolean;
  torchActive: boolean;
  weaponPowered: boolean;
  weaponDamageScale: number;
  weaponCooldownScale: number;
  ammoUseScale: number;
}

export type StatModifierSource =
  | "base"
  | "pickup"
  | "artifact"
  | "powerup"
  | "weapon"
  | "level"
  | "meta"
  | "run"
  | "debug";

export type StatModifierMode = "add" | "mul" | "set" | "max";

export type StatModifier =
  | {
      sourceId: string;
      sourceType: StatModifierSource;
      stat:
        | "maxHealth"
        | "maxArmor"
        | "moveSpeed"
        | "radius"
        | "inventoryCapacity"
        | "armorAbsorbRatio"
        | "weaponDamageScale"
        | "weaponCooldownScale"
        | "ammoUseScale";
      mode: StatModifierMode;
      value: number;
    }
  | {
      sourceId: string;
      sourceType: StatModifierSource;
      stat: "ammoCapacity";
      ammoType: AmmoType;
      mode: StatModifierMode;
      value: number;
    }
  | {
      sourceId: string;
      sourceType: StatModifierSource;
      stat: "invulnerable" | "partialInvisibility" | "canFly" | "torchActive" | "weaponPowered";
      mode: "set";
      value: boolean;
    };

export interface PlayerProgressionState {
  baseStats: BaseStats;
  upgradeFlags: string[];
  permanentModifiers: StatModifier[];
}

export interface WeaponState {
  currentId: WeaponId;
  unlocked: WeaponId[];
  cooldownRemaining: number;
  viewAnimation: WeaponViewAnimation;
  viewAnimationTime: number;
  viewAnimationRevision: number;
  sustainTargetId: string | null;
}

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
  bobPhase: number;
  alive: boolean;
  flags: string[];
  runtimeModifiers: StatModifier[];
  progression: PlayerProgressionState;
  resources: PlayerRuntimeResources;
  effects: PlayerEffectTimers;
  derived: DerivedStats;
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

export interface ResolvedWeaponContext {
  weaponId: WeaponId;
  powered: boolean;
  ammoType: AmmoType | null;
  ammoCost: number;
  cooldown: number;
  behavior: WeaponBehaviorDefinition;
  damageScale: number;
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
  levelScript: LevelScriptRuntimeState | null;
  automap: AutomapRuntimeState;
  player: PlayerState;
  weapon: WeaponState;
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
  version: 6;
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
  objectivesVisible: boolean;
  objectives: string[];
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
