export type LevelScriptId = string;
export type TriggerId = string;
export type ActionId = string;
export type DoorId = string;
export type TeleporterId = string;
export type SecretId = string;
export type SwitchId = string;
export type ConditionId = string;
export type FloorRegionId = string;
export type RegionId = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TriggerKind =
  | "enter_region"
  | "use_switch"
  | "pickup_item"
  | "enemy_killed"
  | "all_enemies_dead_in_region"
  | "step_on_cell"
  | "use_line"
  | "timer"
  | "manual";

export type ActionKind =
  | "open_door"
  | "close_door"
  | "unlock_door"
  | "toggle_door"
  | "enable_teleporter"
  | "disable_teleporter"
  | "teleport_player"
  | "raise_floor"
  | "lower_floor"
  | "set_floor_height"
  | "reveal_secret"
  | "spawn_enemy"
  | "spawn_pickup"
  | "show_message"
  | "play_sound"
  | "set_flag"
  | "clear_flag"
  | "activate_trigger"
  | "deactivate_trigger"
  | "complete_level";

export type ConditionDef =
  | { kind: "flag_set"; flag: string }
  | { kind: "flag_clear"; flag: string }
  | { kind: "has_key"; keyId: string }
  | { kind: "secret_found"; secretId: string }
  | { kind: "door_open"; doorId: string }
  | { kind: "teleporter_enabled"; teleporterId: string }
  | { kind: "trigger_fired"; triggerId: string }
  | { kind: "enemy_dead"; entityId: string }
  | { kind: "all_enemies_dead_in_region"; regionId: string };

export interface ScriptActionDef {
  id?: ActionId;
  kind: ActionKind;
  doorId?: DoorId;
  teleporterId?: TeleporterId;
  secretId?: SecretId;
  switchId?: SwitchId;
  targetPos?: Vec2;
  targetFacingRadians?: number;
  floorRegionId?: FloorRegionId;
  targetHeight?: number;
  deltaHeight?: number;
  enemyDefId?: string;
  pickupDefId?: string;
  spawnPos?: Vec2;
  flag?: string;
  value?: string | number | boolean;
  message?: string;
  soundId?: string;
  triggerId?: TriggerId;
}

export interface ScriptRegionDef {
  id: RegionId;
  rect: Rect;
  debugLabel?: string;
}

export interface TriggerDef {
  id: TriggerId;
  kind: TriggerKind;
  region?: Rect;
  cell?: Vec2;
  switchId?: SwitchId;
  itemId?: string;
  enemyEntityId?: string;
  regionId?: RegionId;
  delaySeconds?: number;
  conditions?: ConditionDef[];
  actions: ScriptActionDef[];
  enabled?: boolean;
  once?: boolean;
  cooldownSeconds?: number;
  debugLabel?: string;
}

export interface DoorDef {
  id: DoorId;
  gridCells: Vec2[];
  requiredKeyId?: string | null;
  startsOpen?: boolean;
  locked?: boolean;
  oneWay?: boolean;
  openOffset?: number;
  visualProfileId?: string;
  debugLabel?: string;
}

export interface TeleporterDef {
  id: TeleporterId;
  fromRegion: Rect;
  targetPos: Vec2;
  targetFacingRadians?: number;
  enabled?: boolean;
  revealByDefault?: boolean;
  visualProfileId?: string;
  debugLabel?: string;
}

export interface SwitchDef {
  id: SwitchId;
  cell: Vec2;
  once?: boolean;
  startsEnabled?: boolean;
  actions?: ScriptActionDef[];
  conditions?: ConditionDef[];
  visualProfileId?: string;
  debugLabel?: string;
}

export interface SecretDef {
  id: SecretId;
  region: Rect;
  message?: string;
  rewardActions?: ScriptActionDef[];
  once?: boolean;
  hintCells?: Vec2[];
  hintVisualProfileId?: string;
  debugLabel?: string;
}

export interface FloorRegionDef {
  id: FloorRegionId;
  region?: Rect;
  blockingCells?: Vec2[];
  initialHeight?: number;
  passableWhenHeightAtLeast?: number;
  debugLabel?: string;
}

export interface LevelScriptDef {
  id?: LevelScriptId;
  debug?: boolean;
  flags?: Record<string, boolean>;
  regions?: ScriptRegionDef[];
  doors?: DoorDef[];
  teleporters?: TeleporterDef[];
  switches?: SwitchDef[];
  secrets?: SecretDef[];
  floorRegions?: FloorRegionDef[];
  triggers?: TriggerDef[];
}

export interface TriggerRuntimeState {
  fired: boolean;
  enabled: boolean;
  cooldownRemaining: number;
  elapsedSeconds: number;
  wasInside: boolean;
}

export interface SwitchRuntimeState {
  used: boolean;
  enabled: boolean;
}

export interface DoorRuntimeState {
  isOpen: boolean;
  isLocked: boolean;
}

export interface TeleporterRuntimeState {
  enabled: boolean;
  revealed: boolean;
}

export interface SecretRuntimeState {
  discovered: boolean;
}

export interface FloorRegionRuntimeState {
  height: number;
}

export interface LevelScriptRuntimeState {
  flags: Record<string, boolean>;
  triggers: Record<TriggerId, TriggerRuntimeState>;
  switches: Record<SwitchId, SwitchRuntimeState>;
  doors: Record<DoorId, DoorRuntimeState>;
  teleporters: Record<TeleporterId, TeleporterRuntimeState>;
  secrets: Record<SecretId, SecretRuntimeState>;
  floorRegions: Record<FloorRegionId, FloorRegionRuntimeState>;
  teleporterCooldownRemaining: number;
}

export interface ScriptFrameEvents {
  usedSwitchIds: SwitchId[];
  usedCells: Vec2[];
  pickupDefIds: string[];
  pickupEntityIds: string[];
  killedEnemyIds: string[];
  manualTriggerIds: TriggerId[];
}
