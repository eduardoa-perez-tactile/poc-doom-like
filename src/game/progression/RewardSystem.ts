import { REWARD_TABLES, REWARDS, WEAPON_INFUSIONS } from "./ProgressionContent";
import { getRunNode, getNodeTemplate } from "./RunGenerator";
import type { MetaProgressionState, RewardDef, RunRewardChoice, RunState } from "./types";

export function createRewardChoices(
  run: RunState,
  meta: MetaProgressionState,
  nodeId: string,
  choiceCount = 3
): RunRewardChoice[] {
  const node = getRunNode(run, nodeId);
  const template = getNodeTemplate(node.templateId);
  const rewardTableId = node.rewardTableId ?? template.rewardTableId;
  if (!rewardTableId) {
    return [];
  }

  const rewardIds = REWARD_TABLES[rewardTableId] ?? [];
  const pool = rewardIds
    .map((rewardId) => REWARDS.find((candidate) => candidate.id === rewardId))
    .filter((reward): reward is RewardDef => reward !== undefined)
    .filter((reward) => rewardEligible(reward, run, meta));

  const choices: RunRewardChoice[] = [];
  const sortedPool = [...pool].sort((left, right) => (right.weight ?? 1) - (left.weight ?? 1));
  for (const reward of sortedPool) {
    if (choices.length >= choiceCount) {
      break;
    }
    choices.push({
      id: `${nodeId}:${reward.id}`,
      rewardDefId: reward.id
    });
  }

  return choices;
}

export function grantNodeCurrencies(run: RunState, nodeId: string): void {
  const node = getRunNode(run, nodeId);
  const template = getNodeTemplate(node.templateId);
  for (const [currencyId, amount] of Object.entries(template.clearCurrencies ?? {})) {
    run.earnedCurrencies[currencyId as keyof typeof run.earnedCurrencies] += amount ?? 0;
  }
}

function rewardEligible(reward: RewardDef, run: RunState, meta: MetaProgressionState): boolean {
  for (const unlockId of reward.requiresUnlockIds ?? []) {
    if (!meta.unlockedContentIds.includes(unlockId)) {
      return false;
    }
  }

  if (reward.oncePerRun && run.claimedRewardIds.includes(reward.id)) {
    return false;
  }

  if (reward.kind === "weapon_unlock") {
    const weaponId = reward.payload.weaponId;
    return typeof weaponId === "string" && !run.loadout.unlockedWeaponIds.includes(weaponId);
  }

  if (reward.kind === "weapon_infusion") {
    const infusionId = reward.payload.infusionId;
    if (typeof infusionId !== "string") {
      return false;
    }
    const infusion = WEAPON_INFUSIONS.find((candidate) => candidate.id === infusionId);
    if (!infusion || !run.loadout.unlockedWeaponIds.includes(infusion.weaponId)) {
      return false;
    }
    if (run.runModifiers.some((modifier) => modifier.sourceDefId === infusionId)) {
      return false;
    }
    return true;
  }

  if (reward.kind === "blessing") {
    const blessingId = reward.payload.blessingId;
    return typeof blessingId === "string" && !run.runModifiers.some((modifier) => modifier.sourceDefId === blessingId);
  }

  return true;
}
