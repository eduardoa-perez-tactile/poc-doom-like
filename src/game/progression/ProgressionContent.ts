import type { PickupDefId } from "../content/pickups/pickupTypes";
import type { MetaUpgradeDef, UnlockId } from "./types";
import type {
  BiomeDef,
  BlessingDef,
  EliteModifierDef,
  NodeTemplateDef,
  RewardDef,
  WeaponInfusionDef
} from "./types";

const UNLOCK_REWARD_CROSSBOW = "reward_pool.crossbow";
const UNLOCK_INFUSION_CROSSBOW = "reward_pool.crossbow_infusion";
const UNLOCK_REWARD_DRAGON_CLAW = "reward_pool.dragon_claw";
const UNLOCK_REWARD_HELLSTAFF = "reward_pool.hellstaff";
const UNLOCK_REWARD_TOME = "reward_pool.tome";
const UNLOCK_TEMPLATE_TREASURE = "template_pool.ash_vault";

export const BIOMES: readonly BiomeDef[] = [
  {
    id: "ember_crypt",
    name: "Ember Crypt",
    availableTemplateIds: [
      "template.ashen_catacomb.combat",
      "template.keep_test.combat",
      "template.open_arena.elite",
      "template.shrine.embers",
      "template.vault.ash",
      "template.dspairils_keep.boss"
    ],
    enemyPoolIds: ["grave_thrall", "golem", "nitrogolem", "dspairil"],
    rewardBiasTags: ["ash", "relics"],
    bossTemplateIds: ["template.dspairils_keep.boss"]
  }
] as const;

export const NODE_TEMPLATES: readonly NodeTemplateDef[] = [
  {
    id: "template.ashen_catacomb.combat",
    name: "Ashen Catacomb",
    levelId: "ashen_catacomb",
    kind: "combat",
    biomeId: "ember_crypt",
    minDifficulty: 1,
    maxDifficulty: 4,
    rewardTableId: "reward_table.combat",
    weight: 3,
    clearCurrencies: { ash: 10 },
    tags: ["starter", "gauntlet"],
    extraEnemySpawns: [
      { id: "catacomb_extra_thrall_1", type: "grave_thrall", x: 7, y: 3, facingDeg: 180, minDifficultyTier: 2 }
    ]
  },
  {
    id: "template.keep_test.combat",
    name: "Riven Keep",
    levelId: "dspairils_keep_test",
    kind: "combat",
    biomeId: "ember_crypt",
    minDifficulty: 1,
    maxDifficulty: 4,
    rewardTableId: "reward_table.combat",
    weight: 2,
    clearCurrencies: { ash: 12 },
    tags: ["keep", "switches"]
  },
  {
    id: "template.open_arena.elite",
    name: "Sealbreaker Arena",
    levelId: "level-open-arena",
    kind: "elite",
    biomeId: "ember_crypt",
    minDifficulty: 2,
    maxDifficulty: 4,
    rewardTableId: "reward_table.elite",
    weight: 1,
    clearCurrencies: { ash: 18 },
    tags: ["arena", "elite"],
    extraEnemySpawns: [
      { id: "arena_extra_thrall_1", type: "grave_thrall", x: 6, y: 14, facingDeg: 90, minDifficultyTier: 2 },
      { id: "arena_extra_nitro_1", type: "nitrogolem", x: 23, y: 15, facingDeg: 270, minDifficultyTier: 3 }
    ]
  },
  {
    id: "template.shrine.embers",
    name: "Shrine of Embers",
    kind: "shrine",
    biomeId: "ember_crypt",
    minDifficulty: 1,
    maxDifficulty: 4,
    rewardTableId: "reward_table.shrine",
    weight: 2,
    clearCurrencies: { ash: 8 },
    tags: ["shrine", "blessing"]
  },
  {
    id: "template.vault.ash",
    name: "Ash Vault",
    kind: "treasure",
    biomeId: "ember_crypt",
    minDifficulty: 2,
    maxDifficulty: 4,
    rewardTableId: "reward_table.treasure",
    weight: 1,
    clearCurrencies: { ash: 12 },
    tags: ["treasure", "cache"]
  },
  {
    id: "template.dspairils_keep.boss",
    name: "D'Spairil's Keep",
    levelId: "level-dspairils-keep",
    kind: "boss",
    biomeId: "ember_crypt",
    minDifficulty: 4,
    maxDifficulty: 5,
    rewardTableId: "reward_table.boss",
    weight: 1,
    clearCurrencies: { ash: 26, sigil: 1 },
    tags: ["boss", "finale"]
  }
] as const;

export const BLESSINGS: readonly BlessingDef[] = [
  {
    id: "blessing.featherstep",
    name: "Featherstep",
    description: "Stride faster between volleys and keep the Heretic rhythm aggressive.",
    modifiers: [
      {
        sourceId: "blessing.featherstep",
        sourceType: "run",
        stat: "moveSpeed",
        mode: "add",
        value: 0.7
      }
    ]
  },
  {
    id: "blessing.iron_ward",
    name: "Iron Ward",
    description: "Arcane plating hardens each scrape instead of inflating raw damage numbers.",
    modifiers: [
      {
        sourceId: "blessing.iron_ward",
        sourceType: "run",
        stat: "maxArmor",
        mode: "add",
        value: 20
      },
      {
        sourceId: "blessing.iron_ward",
        sourceType: "run",
        stat: "armorAbsorbRatio",
        mode: "add",
        value: 0.08
      }
    ]
  },
  {
    id: "blessing.battle_liturgy",
    name: "Battle Liturgy",
    description: "A tighter mantra sharpens every weapon without turning the run into pure stat bloat.",
    modifiers: [
      {
        sourceId: "blessing.battle_liturgy",
        sourceType: "run",
        stat: "weaponDamageScale",
        mode: "mul",
        value: 1.14
      }
    ]
  }
] as const;

export const WEAPON_INFUSIONS: readonly WeaponInfusionDef[] = [
  {
    id: "infusion.crossbow.splinter",
    weaponId: "ethereal_crossbow",
    name: "Splinter Volley",
    description: "The crossbow sheds two extra splinters and cycles slightly faster.",
    behaviorOverrides: {
      extraProjectiles: 2,
      cooldownScale: 0.92
    }
  },
  {
    id: "infusion.dragon_claw.spikes",
    weaponId: "dragon_claw",
    name: "Impact Spikes",
    description: "Dragon Claw shots burst into a denser spray after impact.",
    behaviorOverrides: {
      impactBurstCountBonus: 4,
      cooldownScale: 0.94
    }
  },
  {
    id: "infusion.hellstaff.embers",
    weaponId: "hellstaff",
    name: "Ember Trail",
    description: "Hellstaff residue hangs in the air longer and burns a broader patch.",
    behaviorOverrides: {
      hazardDurationBonus: 2,
      splashRadiusBonus: 0.45
    }
  }
] as const;

export const ELITE_MODIFIERS: readonly EliteModifierDef[] = [
  {
    id: "elite.fast",
    name: "Fast",
    description: "The entire node surges forward with quicker movement and shorter attack recovery.",
    enemyTuning: {
      moveSpeedScale: 1.22,
      attackCooldownScale: 0.88
    }
  },
  {
    id: "elite.armored",
    name: "Armored",
    description: "Heavier bodies and longer fights without resorting to grotesque HP inflation.",
    enemyTuning: {
      healthScale: 1.35
    }
  },
  {
    id: "elite.enraged",
    name: "Enraged",
    description: "Attacks come in hotter waves and punish idle strafing.",
    enemyTuning: {
      attackDamageScale: 1.22,
      projectileSpeedScale: 1.15
    }
  }
] as const;

export const REWARDS: readonly RewardDef[] = [
  {
    id: "reward.weapon.crossbow",
    kind: "weapon_unlock",
    name: "Ethereal Crossbow",
    description: "Add the crossbow to this run and seed it with a fresh quiver.",
    payload: { weaponId: "ethereal_crossbow", ammoGrant: { crossbow: 18 } },
    tags: ["weapon", "arsenal"],
    weight: 3,
    requiresUnlockIds: [UNLOCK_REWARD_CROSSBOW],
    oncePerRun: true
  },
  {
    id: "reward.weapon.dragon_claw",
    kind: "weapon_unlock",
    name: "Dragon Claw",
    description: "Add the Dragon Claw to the run with enough orbs to start shaping a build.",
    payload: { weaponId: "dragon_claw", ammoGrant: { claw: 30 } },
    tags: ["weapon", "arsenal"],
    weight: 2,
    requiresUnlockIds: [UNLOCK_REWARD_DRAGON_CLAW],
    oncePerRun: true
  },
  {
    id: "reward.weapon.hellstaff",
    kind: "weapon_unlock",
    name: "Hellstaff",
    description: "A rarer pact adds the Hellstaff to the current run.",
    payload: { weaponId: "hellstaff", ammoGrant: { hellstaff: 24 } },
    tags: ["weapon", "arsenal", "advanced"],
    weight: 1,
    requiresUnlockIds: [UNLOCK_REWARD_HELLSTAFF],
    oncePerRun: true
  },
  {
    id: "reward.infusion.crossbow",
    kind: "weapon_infusion",
    name: "Splinter Volley",
    description: "Infuse the Ethereal Crossbow with an extra spread of splinters.",
    payload: { infusionId: "infusion.crossbow.splinter" },
    tags: ["infusion", "arsenal"],
    weight: 2,
    requiresUnlockIds: [UNLOCK_INFUSION_CROSSBOW],
    oncePerRun: true
  },
  {
    id: "reward.infusion.dragon_claw",
    kind: "weapon_infusion",
    name: "Impact Spikes",
    description: "Dragon Claw impacts fracture into a denser radial burst.",
    payload: { infusionId: "infusion.dragon_claw.spikes" },
    tags: ["infusion", "arsenal"],
    weight: 2,
    oncePerRun: true
  },
  {
    id: "reward.infusion.hellstaff",
    kind: "weapon_infusion",
    name: "Ember Trail",
    description: "Hellstaff clouds linger longer and spread wider.",
    payload: { infusionId: "infusion.hellstaff.embers" },
    tags: ["infusion", "advanced"],
    weight: 1,
    requiresUnlockIds: [UNLOCK_REWARD_HELLSTAFF],
    oncePerRun: true
  },
  {
    id: "reward.blessing.featherstep",
    kind: "blessing",
    name: "Featherstep",
    description: "A run-only blessing that keeps movement light and aggressive.",
    payload: { blessingId: "blessing.featherstep" },
    tags: ["blessing", "mobility"],
    weight: 3,
    oncePerRun: true
  },
  {
    id: "reward.blessing.iron_ward",
    kind: "blessing",
    name: "Iron Ward",
    description: "Bolster your armor without flattening the combat rhythm.",
    payload: { blessingId: "blessing.iron_ward" },
    tags: ["blessing", "survival"],
    weight: 3,
    oncePerRun: true
  },
  {
    id: "reward.artifact.tome",
    kind: "artifact",
    name: "Tome of Power",
    description: "Store a Tome of Power for the current run.",
    payload: { pickupDefId: "TOME_OF_POWER", amount: 1 },
    tags: ["artifact", "relic"],
    weight: 1,
    requiresUnlockIds: [UNLOCK_REWARD_TOME]
  },
  {
    id: "reward.heal.vitality",
    kind: "heal",
    name: "Vitality Draft",
    description: "Recover health immediately before the next node.",
    payload: { amount: 40 },
    tags: ["heal", "survival"],
    weight: 3
  },
  {
    id: "reward.ammo.cache",
    kind: "ammo_refill",
    name: "Ammo Cache",
    description: "Top up the run's active arsenal instead of spraying loot across the floor.",
    payload: { ratio: 0.4 },
    tags: ["ammo", "arsenal"],
    weight: 3
  },
  {
    id: "reward.currency.ash",
    kind: "currency",
    name: "Ash Cache",
    description: "Bank extra ash before the boss reaches you.",
    payload: { currencyId: "ash", amount: 18 },
    tags: ["ash", "routing"],
    weight: 2
  }
] as const;

export const REWARD_TABLES: Readonly<Record<string, readonly string[]>> = {
  "reward_table.combat": [
    "reward.weapon.crossbow",
    "reward.weapon.dragon_claw",
    "reward.infusion.crossbow",
    "reward.infusion.dragon_claw",
    "reward.blessing.featherstep",
    "reward.blessing.iron_ward",
    "reward.heal.vitality",
    "reward.ammo.cache",
    "reward.currency.ash"
  ],
  "reward_table.elite": [
    "reward.weapon.dragon_claw",
    "reward.weapon.hellstaff",
    "reward.infusion.crossbow",
    "reward.infusion.dragon_claw",
    "reward.infusion.hellstaff",
    "reward.blessing.featherstep",
    "reward.blessing.iron_ward",
    "reward.artifact.tome",
    "reward.ammo.cache"
  ],
  "reward_table.shrine": [
    "reward.blessing.featherstep",
    "reward.blessing.iron_ward",
    "reward.artifact.tome",
    "reward.heal.vitality",
    "reward.currency.ash"
  ],
  "reward_table.treasure": [
    "reward.weapon.hellstaff",
    "reward.infusion.hellstaff",
    "reward.artifact.tome",
    "reward.ammo.cache",
    "reward.currency.ash"
  ],
  "reward_table.boss": []
};

export const META_UPGRADES: readonly MetaUpgradeDef[] = [
  {
    id: "meta.charred_plating",
    name: "Charred Plating",
    category: "survival",
    description: "Start each run with a modest armor buffer.",
    costCurrency: "ash",
    costAmount: 18,
    maxRank: 2,
    startGrants: { armor: 10 }
  },
  {
    id: "meta.wand_satchel",
    name: "Wand Satchel",
    category: "arsenal",
    description: "Carry extra wand crystals into each new run.",
    costCurrency: "ash",
    costAmount: 14,
    maxRank: 2,
    startGrants: { ammo: { wand: 12 } }
  },
  {
    id: "meta.reliquary_strap",
    name: "Reliquary Strap",
    category: "relics",
    description: "Add one permanent inventory slot through the existing stat system.",
    costCurrency: "ash",
    costAmount: 22,
    maxRank: 1,
    modifiers: [
      {
        sourceId: "meta.reliquary_strap",
        sourceType: "meta",
        stat: "inventoryCapacity",
        mode: "add",
        value: 1
      }
    ]
  },
  {
    id: "meta.crossbow_rites",
    name: "Crossbow Rites",
    category: "arsenal",
    description: "Unlock Ethereal Crossbow infusions for future runs.",
    costCurrency: "ash",
    costAmount: 20,
    maxRank: 1,
    unlocks: [UNLOCK_INFUSION_CROSSBOW]
  },
  {
    id: "meta.dragon_claw_rites",
    name: "Dragon Claw Rites",
    category: "arsenal",
    description: "Unlock Dragon Claw rewards for future runs.",
    costCurrency: "ash",
    costAmount: 28,
    maxRank: 1,
    unlocks: [UNLOCK_REWARD_DRAGON_CLAW],
    prerequisites: ["meta.crossbow_rites"]
  },
  {
    id: "meta.sanctum_relics",
    name: "Sanctum Relics",
    category: "relics",
    description: "Let shrines offer Tome of Power rewards.",
    costCurrency: "sigil",
    costAmount: 1,
    maxRank: 1,
    unlocks: [UNLOCK_REWARD_TOME]
  },
  {
    id: "meta.waystone_chart",
    name: "Waystone Chart",
    category: "routing",
    description: "Unlock Ash Vault treasure nodes on future maps.",
    costCurrency: "ash",
    costAmount: 24,
    maxRank: 1,
    unlocks: [UNLOCK_TEMPLATE_TREASURE]
  },
  {
    id: "meta.forbidden_arsenal",
    name: "Forbidden Arsenal",
    category: "arsenal",
    description: "Add Hellstaff rewards and deeper infusions to the pool.",
    costCurrency: "sigil",
    costAmount: 2,
    maxRank: 1,
    unlocks: [UNLOCK_REWARD_HELLSTAFF],
    prerequisites: ["meta.dragon_claw_rites"]
  }
] as const;

export const BASE_UNLOCK_IDS: readonly UnlockId[] = [
  UNLOCK_REWARD_CROSSBOW,
  "base.shrine"
] as const;

export const CONTENT_UNLOCK_IDS = {
  rewardCrossbow: UNLOCK_REWARD_CROSSBOW,
  rewardDragonClaw: UNLOCK_REWARD_DRAGON_CLAW,
  rewardHellstaff: UNLOCK_REWARD_HELLSTAFF,
  rewardTome: UNLOCK_REWARD_TOME,
  templateTreasure: UNLOCK_TEMPLATE_TREASURE
} as const;

export const REWARD_ARTIFACT_PICKUP_IDS: readonly PickupDefId[] = ["TOME_OF_POWER"] as const;
