import { BASE_UNLOCK_IDS, META_UPGRADES } from "./ProgressionContent";
import type { MetaProgressionState, MetaUpgradeDef, MetaUpgradeId, ResourceGrant } from "./types";
import type { StatModifier } from "../core/types";

export interface MetaRunBundle {
  modifiers: StatModifier[];
  startGrants: ResourceGrant[];
  unlockIds: string[];
}

const UPGRADE_BY_ID = new Map(META_UPGRADES.map((upgrade) => [upgrade.id, upgrade] as const));

export function createInitialMetaProgressionState(): MetaProgressionState {
  return {
    currencies: {
      ash: 0,
      sigil: 0
    },
    purchasedRanks: {},
    unlockedContentIds: [...BASE_UNLOCK_IDS],
    discoveredCodexIds: []
  };
}

export function getMetaUpgradeDef(upgradeId: MetaUpgradeId): MetaUpgradeDef {
  const definition = UPGRADE_BY_ID.get(upgradeId);
  if (!definition) {
    throw new Error(`Unknown meta upgrade '${upgradeId}'.`);
  }
  return definition;
}

export function listMetaUpgradeDefs(): readonly MetaUpgradeDef[] {
  return META_UPGRADES;
}

export function getPurchasedRank(state: MetaProgressionState, upgradeId: MetaUpgradeId): number {
  return state.purchasedRanks[upgradeId] ?? 0;
}

export function canPurchaseMetaUpgrade(
  state: MetaProgressionState,
  definition: MetaUpgradeDef
): { allowed: boolean; reason?: string } {
  const currentRank = getPurchasedRank(state, definition.id);
  if (currentRank >= definition.maxRank) {
    return { allowed: false, reason: "Maxed" };
  }

  for (const prerequisiteId of definition.prerequisites ?? []) {
    if (getPurchasedRank(state, prerequisiteId) <= 0) {
      return { allowed: false, reason: "Locked" };
    }
  }

  if (state.currencies[definition.costCurrency] < definition.costAmount) {
    return { allowed: false, reason: "Need currency" };
  }

  return { allowed: true };
}

export function purchaseMetaUpgrade(state: MetaProgressionState, upgradeId: MetaUpgradeId): boolean {
  const definition = getMetaUpgradeDef(upgradeId);
  const canPurchase = canPurchaseMetaUpgrade(state, definition);
  if (!canPurchase.allowed) {
    return false;
  }

  state.currencies[definition.costCurrency] -= definition.costAmount;
  state.purchasedRanks[upgradeId] = getPurchasedRank(state, upgradeId) + 1;
  for (const unlockId of definition.unlocks ?? []) {
    if (!state.unlockedContentIds.includes(unlockId)) {
      state.unlockedContentIds.push(unlockId);
    }
  }

  return true;
}

export function buildMetaRunBundle(state: MetaProgressionState): MetaRunBundle {
  const modifiers: StatModifier[] = [];
  const startGrants: ResourceGrant[] = [];
  const unlockIds = new Set<string>(state.unlockedContentIds);

  for (const definition of META_UPGRADES) {
    const rank = getPurchasedRank(state, definition.id);
    if (rank <= 0) {
      continue;
    }

    for (let currentRank = 0; currentRank < rank; currentRank += 1) {
      modifiers.push(...(definition.modifiers ?? []));
      if (definition.startGrants) {
        startGrants.push(definition.startGrants);
      }
    }

    for (const unlockId of definition.unlocks ?? []) {
      unlockIds.add(unlockId);
    }
  }

  return {
    modifiers,
    startGrants,
    unlockIds: [...unlockIds]
  };
}
