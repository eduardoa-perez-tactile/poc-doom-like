import type { InventoryEntry } from "../content/pickups";
import type {
  AmmoType,
  ContentRuntimeTuning,
  WeaponBehaviorOverrides,
  WeaponId
} from "../content/types";
import type { StatModifier } from "../core/types";

export type MetaCurrencyId = "ash" | "sigil";
export type MetaUpgradeId = string;
export type UnlockId = string;
export type RunNodeId = string;
export type RunNodeKind = "combat" | "elite" | "treasure" | "shrine" | "boss" | "rest";
export type RewardKind =
  | "weapon_unlock"
  | "weapon_infusion"
  | "blessing"
  | "artifact"
  | "heal"
  | "currency"
  | "ammo_refill";

export interface ResourceGrant {
  health?: number;
  armor?: number;
  ammo?: Partial<Record<AmmoType, number>>;
  inventoryItemId?: string;
  inventoryCount?: number;
}

export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  name: string;
  category: "survival" | "arsenal" | "relics" | "routing";
  description: string;
  costCurrency: MetaCurrencyId;
  costAmount: number;
  maxRank: number;
  modifiers?: StatModifier[];
  unlocks?: UnlockId[];
  prerequisites?: MetaUpgradeId[];
  startGrants?: ResourceGrant;
}

export interface MetaProgressionState {
  currencies: Record<MetaCurrencyId, number>;
  purchasedRanks: Record<MetaUpgradeId, number>;
  unlockedContentIds: string[];
  discoveredCodexIds: string[];
}

export interface WeaponInfusionDef {
  id: string;
  weaponId: WeaponId;
  name: string;
  description: string;
  modifiers?: StatModifier[];
  behaviorOverrides?: WeaponBehaviorOverrides;
}

export interface BlessingDef {
  id: string;
  name: string;
  description: string;
  modifiers: StatModifier[];
}

export interface EliteModifierDef {
  id: string;
  name: string;
  description: string;
  enemyTuning: NonNullable<ContentRuntimeTuning["enemyTuning"]>;
}

export interface BiomeDef {
  id: string;
  name: string;
  availableTemplateIds: string[];
  enemyPoolIds?: string[];
  rewardBiasTags?: string[];
  bossTemplateIds?: string[];
}

export interface NodeTemplateExtraSpawn {
  id: string;
  type: string;
  x: number;
  y: number;
  facingDeg?: number;
  minDifficultyTier?: number;
}

export interface NodeTemplateDef {
  id: string;
  name: string;
  levelId?: string;
  kind: RunNodeKind;
  biomeId: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  tags?: string[];
  rewardTableId?: string;
  weight?: number;
  clearCurrencies?: Partial<Record<MetaCurrencyId, number>>;
  extraEnemySpawns?: NodeTemplateExtraSpawn[];
}

export interface RewardDef {
  id: string;
  kind: RewardKind;
  name: string;
  description: string;
  payload: Record<string, unknown>;
  tags?: string[];
  weight?: number;
  requiresUnlockIds?: UnlockId[];
  oncePerRun?: boolean;
}

export interface RunModifierState {
  id: string;
  sourceKind: "blessing" | "weapon_infusion" | "elite" | "curse" | "meta";
  sourceDefId: string;
  weaponId?: string;
  modifiers?: StatModifier[];
  behaviorOverrides?: WeaponBehaviorOverrides;
}

export interface RunRewardChoice {
  id: string;
  rewardDefId: string;
}

export interface RunLoadoutState {
  health: number;
  armor: number;
  ammo: Record<AmmoType, number>;
  inventory: InventoryEntry[];
  unlockedWeaponIds: WeaponId[];
  currentWeaponId: WeaponId;
}

export interface RunNodeDef {
  id: RunNodeId;
  kind: RunNodeKind;
  templateId: string;
  biomeId: string;
  difficultyTier: number;
  rewardTableId?: string;
  nextNodeIds: RunNodeId[];
  eliteModifierIds?: string[];
  debugLabel?: string;
}

export interface RunState {
  active: boolean;
  seed: number;
  currentNodeId: RunNodeId | null;
  completedNodeIds: RunNodeId[];
  availableNodeIds: RunNodeId[];
  nodes: RunNodeDef[];
  biomeSequence: string[];
  difficultyTier: number;
  pendingRewardChoices: RunRewardChoice[];
  runModifiers: RunModifierState[];
  earnedCurrencies: Record<MetaCurrencyId, number>;
  loadout: RunLoadoutState;
  claimedRewardIds: string[];
  stats: {
    roomsCleared: number;
    elitesCleared: number;
    bossesCleared: number;
  };
}

export interface RunResolution {
  kind: "launch_level" | "instant_reward";
  node: RunNodeDef;
  template: NodeTemplateDef;
}

export interface RunResultSummary {
  outcome: "victory" | "death";
  title: string;
  description: string;
  currenciesEarned: Record<MetaCurrencyId, number>;
  roomsCleared: number;
  elitesCleared: number;
  bossesCleared: number;
}

export interface ProgressionSaveData {
  version: 1;
  savedAt: string;
  meta: MetaProgressionState;
  activeRun: RunState | null;
}
