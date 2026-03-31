export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasAnim {
  frames: Rect[];
  fps?: number;
  loop?: boolean;
}

export type PickupKind =
  | "weapon"
  | "ammo"
  | "health"
  | "armor"
  | "artifact"
  | "key"
  | "support";

export type PickupAmmoType = AmmoType;
export type PickupUpgradeId = "bag_of_holding";

export type PickupVisualId = string;
export type PickupDefId = string;
export type PickupUseActionId =
  | "heal_25"
  | "restore_to_full_health"
  | "invulnerable_temporarily"
  | "partial_invisibility_temporarily"
  | "flight_temporarily"
  | "weapon_powerup_temporarily"
  | "reveal_map"
  | "brighten_level_temporarily"
  | "teleport_to_start"
  | "launch_morph_projectile"
  | "place_timebomb";

export interface PickupGrantSet {
  health?: number;
  armor?: number;
  giveWeaponId?: string;
  ammo?: Partial<Record<PickupAmmoType, number>>;
  keys?: string[];
  flags?: string[];
  inventoryItemId?: string;
  upgradeId?: PickupUpgradeId;
}

export interface PickupDef {
  id: PickupDefId;
  kind: PickupKind;
  visualId: PickupVisualId;
  inventoryIconId?: PickupVisualId;
  grants?: PickupGrantSet;
  stackable?: boolean;
  maxCarry?: number;
  respawnSeconds?: number | null;
  useAction?: PickupUseActionId | null;
  pickupSoundId?: string | null;
  canPickupWhenFull?: boolean;
  notes?: string;
}

export interface WorldPickupSpawn {
  id: string;
  defId: PickupDefId;
  x: number;
  y: number;
  z?: number;
  respawnSeconds?: number | null;
}

export interface WorldPickupInstance {
  entityId: string;
  defId: PickupDefId;
  position: { x: number; y: number; z: number };
  bobPhase: number;
  animTime: number;
  picked: boolean;
  respawnAtTime?: number | null;
}

export interface InventoryEntry {
  itemDefId: PickupDefId;
  count: number;
}

export type PowerupTimerId =
  | "invulnerable"
  | "partialInvisibility"
  | "flight"
  | "torch"
  | "tomeOfPower";

export interface PlayerEffectTimers {
  invulnerable: number;
  partialInvisibility: number;
  flight: number;
  torch: number;
  tomeOfPower: number;
}
import type { AmmoType } from "../types";
