import { pickupDefsById } from "../content/pickups/pickupDefs";
import { AMMO_TYPES } from "../simulation/player/PlayerStatSystem";
import { BLESSINGS, REWARDS, WEAPON_INFUSIONS } from "./ProgressionContent";
import type { MetaCurrencyId, RewardDef, RunModifierState, RunState } from "./types";
import { addInventoryItem } from "./RunState";

const REWARD_BY_ID = new Map(REWARDS.map((reward) => [reward.id, reward] as const));
const BLESSING_BY_ID = new Map(BLESSINGS.map((blessing) => [blessing.id, blessing] as const));
const INFUSION_BY_ID = new Map(WEAPON_INFUSIONS.map((infusion) => [infusion.id, infusion] as const));

export function getRewardDef(rewardId: string): RewardDef {
  const definition = REWARD_BY_ID.get(rewardId);
  if (!definition) {
    throw new Error(`Unknown reward '${rewardId}'.`);
  }
  return definition;
}

export function applyRewardChoice(run: RunState, rewardDefId: string): void {
  const reward = getRewardDef(rewardDefId);
  applyReward(run, reward);
  if (!run.claimedRewardIds.includes(rewardDefId)) {
    run.claimedRewardIds.push(rewardDefId);
  }
  run.pendingRewardChoices = [];
}

function applyReward(run: RunState, reward: RewardDef): void {
  switch (reward.kind) {
    case "weapon_unlock":
      applyWeaponUnlock(run, reward);
      break;
    case "weapon_infusion":
      applyWeaponInfusion(run, reward);
      break;
    case "blessing":
      applyBlessing(run, reward);
      break;
    case "artifact":
      applyArtifact(run, reward);
      break;
    case "heal":
      run.loadout.health += numberPayload(reward.payload.amount, 0);
      break;
    case "currency":
      addCurrency(run, stringPayload<MetaCurrencyId>(reward.payload.currencyId, "ash"), numberPayload(reward.payload.amount, 0));
      break;
    case "ammo_refill":
      applyAmmoRefill(run, numberPayload(reward.payload.ratio, 0.25));
      break;
  }
}

function applyWeaponUnlock(run: RunState, reward: RewardDef): void {
  const weaponId = stringPayload(reward.payload.weaponId, "staff");
  if (!run.loadout.unlockedWeaponIds.includes(weaponId)) {
    run.loadout.unlockedWeaponIds.push(weaponId);
    run.loadout.currentWeaponId = weaponId;
  }

  const ammoGrant = reward.payload.ammoGrant;
  if (ammoGrant && typeof ammoGrant === "object") {
    for (const [ammoType, amount] of Object.entries(ammoGrant)) {
      run.loadout.ammo[ammoType as keyof typeof run.loadout.ammo] += Number(amount);
    }
  }
}

function applyWeaponInfusion(run: RunState, reward: RewardDef): void {
  const infusionId = stringPayload(reward.payload.infusionId, "");
  const infusion = INFUSION_BY_ID.get(infusionId);
  if (!infusion) {
    return;
  }
  const modifier: RunModifierState = {
    id: `${reward.id}:${infusion.id}`,
    sourceKind: "weapon_infusion",
    sourceDefId: infusion.id,
    weaponId: infusion.weaponId,
    modifiers: infusion.modifiers,
    behaviorOverrides: infusion.behaviorOverrides
  };
  if (!run.runModifiers.some((candidate) => candidate.sourceDefId === modifier.sourceDefId)) {
    run.runModifiers.push(modifier);
  }
}

function applyBlessing(run: RunState, reward: RewardDef): void {
  const blessingId = stringPayload(reward.payload.blessingId, "");
  const blessing = BLESSING_BY_ID.get(blessingId);
  if (!blessing) {
    return;
  }
  const modifier: RunModifierState = {
    id: `${reward.id}:${blessing.id}`,
    sourceKind: "blessing",
    sourceDefId: blessing.id,
    modifiers: blessing.modifiers
  };
  if (!run.runModifiers.some((candidate) => candidate.sourceDefId === modifier.sourceDefId)) {
    run.runModifiers.push(modifier);
  }
}

function applyArtifact(run: RunState, reward: RewardDef): void {
  const pickupDefId = stringPayload(reward.payload.pickupDefId, "");
  const amount = numberPayload(reward.payload.amount, 1);
  const definition = pickupDefsById.get(pickupDefId);
  if (!definition || !definition.grants?.inventoryItemId) {
    return;
  }

  addInventoryItem(run.loadout, definition.grants.inventoryItemId, amount);
}

function applyAmmoRefill(run: RunState, ratio: number): void {
  for (const ammoType of AMMO_TYPES) {
    run.loadout.ammo[ammoType] += Math.ceil(run.loadout.ammo[ammoType] * ratio * 0.5 + 8);
  }
}

function addCurrency(run: RunState, currencyId: MetaCurrencyId, amount: number): void {
  run.earnedCurrencies[currencyId] += amount;
}

function numberPayload(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function stringPayload<T extends string>(value: unknown, fallback: T): T {
  return typeof value === "string" ? (value as T) : fallback;
}
