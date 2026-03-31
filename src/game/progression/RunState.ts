import type { AmmoType, WeaponId } from "../content/types";
import type { MetaProgressionState, RunLoadoutState, RunModifierState, RunState } from "./types";
import { buildMetaRunBundle } from "./MetaProgressionSystem";

const STARTING_WEAPON_IDS = ["staff", "elven_wand"] as const satisfies readonly WeaponId[];

export function createEmptyCurrencyRecord(): Record<"ash" | "sigil", number> {
  return { ash: 0, sigil: 0 };
}

export function createBaseRunLoadout(): RunLoadoutState {
  return {
    health: 100,
    armor: 0,
    ammo: {
      wand: 70,
      crossbow: 30,
      claw: 60,
      hellstaff: 30,
      phoenix: 20,
      firemace: 18
    },
    inventory: [],
    unlockedWeaponIds: [...STARTING_WEAPON_IDS],
    currentWeaponId: "staff"
  };
}

export function createInitialRunLoadout(meta: MetaProgressionState): RunLoadoutState {
  const loadout = createBaseRunLoadout();
  const bundle = buildMetaRunBundle(meta);

  for (const grant of bundle.startGrants) {
    loadout.health += grant.health ?? 0;
    loadout.armor += grant.armor ?? 0;
    if (grant.ammo) {
      for (const [ammoType, amount] of Object.entries(grant.ammo)) {
        loadout.ammo[ammoType as AmmoType] += amount ?? 0;
      }
    }
    if (grant.inventoryItemId) {
      addInventoryItem(loadout, grant.inventoryItemId, grant.inventoryCount ?? 1);
    }
  }

  return loadout;
}

export function createRunModifierStateFromMeta(meta: MetaProgressionState): RunModifierState[] {
  const bundle = buildMetaRunBundle(meta);
  if (bundle.modifiers.length === 0) {
    return [];
  }
  return [
    {
      id: "meta:bundle",
      sourceKind: "meta",
      sourceDefId: "meta:bundle",
      modifiers: bundle.modifiers
    }
  ];
}

export function cloneLoadout(loadout: RunLoadoutState): RunLoadoutState {
  return {
    health: loadout.health,
    armor: loadout.armor,
    ammo: { ...loadout.ammo },
    inventory: loadout.inventory.map((entry) => ({ ...entry })),
    unlockedWeaponIds: [...loadout.unlockedWeaponIds],
    currentWeaponId: loadout.currentWeaponId
  };
}

export function addInventoryItem(loadout: RunLoadoutState, itemDefId: string, count = 1): void {
  const existing = loadout.inventory.find((entry) => entry.itemDefId === itemDefId);
  if (existing) {
    existing.count += count;
    return;
  }

  loadout.inventory.push({ itemDefId, count });
}

export function collectRunModifiers(run: RunState): RunModifierState[] {
  return [...run.runModifiers];
}
