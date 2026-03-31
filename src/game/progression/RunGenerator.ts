import { BIOMES, CONTENT_UNLOCK_IDS, ELITE_MODIFIERS, NODE_TEMPLATES } from "./ProgressionContent";
import type { MetaProgressionState, RunNodeDef, RunNodeKind, RunState } from "./types";
import {
  createEmptyCurrencyRecord,
  createInitialRunLoadout,
  createRunModifierStateFromMeta
} from "./RunState";

const TEMPLATE_BY_ID = new Map(NODE_TEMPLATES.map((template) => [template.id, template] as const));

export function createRunState(meta: MetaProgressionState, seed: number): RunState {
  const biomeId = BIOMES[0]?.id ?? "ember_crypt";
  const biomeSequence = [biomeId, biomeId, biomeId, biomeId, biomeId];
  const treasureUnlocked = meta.unlockedContentIds.includes(CONTENT_UNLOCK_IDS.templateTreasure);
  const eliteModifierId = chooseEliteModifier(seed);

  const nodes: RunNodeDef[] = [
    createNode("node-1", "combat", pickTemplateId(seed, "combat", biomeId, 1), biomeId, 1, ["node-2a", "node-2b"]),
    createNode("node-2a", "combat", pickTemplateId(seed + 17, "combat", biomeId, 2), biomeId, 2, ["node-3a"]),
    createNode("node-2b", "shrine", "template.shrine.embers", biomeId, 2, ["node-3b"]),
    createNode(
      "node-3a",
      "elite",
      "template.open_arena.elite",
      biomeId,
      3,
      ["node-4"],
      eliteModifierId ? [eliteModifierId] : []
    ),
    createNode(
      "node-3b",
      treasureUnlocked ? "treasure" : "combat",
      treasureUnlocked ? "template.vault.ash" : pickTemplateId(seed + 41, "combat", biomeId, 3),
      biomeId,
      3,
      ["node-4"]
    ),
    createNode("node-4", "combat", pickTemplateId(seed + 93, "combat", biomeId, 4), biomeId, 4, ["node-5"]),
    createNode("node-5", "boss", "template.dspairils_keep.boss", biomeId, 5, [])
  ];

  return {
    active: true,
    seed,
    currentNodeId: null,
    completedNodeIds: [],
    availableNodeIds: ["node-1"],
    nodes,
    biomeSequence,
    difficultyTier: 1,
    pendingRewardChoices: [],
    runModifiers: createRunModifierStateFromMeta(meta),
    earnedCurrencies: createEmptyCurrencyRecord(),
    loadout: createInitialRunLoadout(meta),
    claimedRewardIds: [],
    stats: {
      roomsCleared: 0,
      elitesCleared: 0,
      bossesCleared: 0
    }
  };
}

export function getRunNode(run: RunState, nodeId: string): RunNodeDef {
  const node = run.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new Error(`Unknown run node '${nodeId}'.`);
  }
  return node;
}

export function getNodeTemplate(templateId: string) {
  const template = TEMPLATE_BY_ID.get(templateId);
  if (!template) {
    throw new Error(`Unknown node template '${templateId}'.`);
  }
  return template;
}

export function selectRunNode(run: RunState, nodeId: string): boolean {
  if (!run.availableNodeIds.includes(nodeId) || run.completedNodeIds.includes(nodeId)) {
    return false;
  }

  run.currentNodeId = nodeId;
  run.pendingRewardChoices = [];
  run.difficultyTier = getRunNode(run, nodeId).difficultyTier;
  return true;
}

export function completeRunNode(run: RunState, nodeId: string): void {
  const node = getRunNode(run, nodeId);
  if (!run.completedNodeIds.includes(node.id)) {
    run.completedNodeIds.push(node.id);
  }
  run.availableNodeIds = run.availableNodeIds.filter((candidate) => candidate !== node.id);
  for (const nextNodeId of node.nextNodeIds) {
    if (!run.completedNodeIds.includes(nextNodeId) && !run.availableNodeIds.includes(nextNodeId)) {
      run.availableNodeIds.push(nextNodeId);
    }
  }

  run.currentNodeId = null;
  run.stats.roomsCleared += 1;
  if (node.kind === "elite") {
    run.stats.elitesCleared += 1;
  }
  if (node.kind === "boss") {
    run.stats.bossesCleared += 1;
  }
}

export function isBossNode(run: RunState, nodeId: string): boolean {
  return getRunNode(run, nodeId).kind === "boss";
}

function createNode(
  id: string,
  kind: RunNodeKind,
  templateId: string,
  biomeId: string,
  difficultyTier: number,
  nextNodeIds: string[],
  eliteModifierIds: string[] = []
): RunNodeDef {
  const template = getNodeTemplate(templateId);
  return {
    id,
    kind,
    templateId,
    biomeId,
    difficultyTier,
    rewardTableId: template.rewardTableId,
    nextNodeIds,
    eliteModifierIds,
    debugLabel: `${kind.toUpperCase()} T${difficultyTier} ${template.name}`
  };
}

function pickTemplateId(seed: number, kind: RunNodeKind, biomeId: string, difficultyTier: number): string {
  const exactMatches = NODE_TEMPLATES.filter((template) => {
    if (template.kind !== kind || template.biomeId !== biomeId) {
      return false;
    }
    if (template.minDifficulty !== undefined && difficultyTier < template.minDifficulty) {
      return false;
    }
    if (template.maxDifficulty !== undefined && difficultyTier > template.maxDifficulty) {
      return false;
    }
    return true;
  });

  const matchingTemplates = exactMatches.length > 0
    ? exactMatches
    : NODE_TEMPLATES.filter((template) => template.kind === kind && template.biomeId === biomeId);

  if (matchingTemplates.length === 0) {
    throw new Error(`No templates available for ${kind} in biome '${biomeId}'.`);
  }

  const totalWeight = matchingTemplates.reduce((sum, template) => sum + (template.weight ?? 1), 0);
  let target = seededFloat(seed) * totalWeight;
  for (const template of matchingTemplates) {
    target -= template.weight ?? 1;
    if (target <= 0) {
      return template.id;
    }
  }

  return matchingTemplates[matchingTemplates.length - 1].id;
}

function chooseEliteModifier(seed: number): string | undefined {
  if (seededFloat(seed + 301) < 0.18) {
    return undefined;
  }
  const index = Math.floor(seededFloat(seed + 457) * ELITE_MODIFIERS.length);
  return ELITE_MODIFIERS[index]?.id;
}

function seededFloat(seed: number): number {
  let state = seed | 0;
  state = Math.imul(state ^ 0x6d2b79f5, 1 | state);
  state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
  return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
}
