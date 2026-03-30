import type { PickupDef } from "./pickupTypes";

export const pickupDefs = [
  {
    id: "GAUNTLETS_OF_THE_NECROMANCER",
    kind: "weapon",
    visualId: "gauntlets",
    grants: { giveWeaponId: "gauntlets_of_the_necromancer" },
    pickupSoundId: "pickup_weapon",
    respawnSeconds: null
  },
  {
    id: "ETHEREAL_CROSSBOW",
    kind: "weapon",
    visualId: "etherealCrossbow",
    grants: {
      giveWeaponId: "ethereal_crossbow",
      ammo: { crossbow: 10 }
    },
    pickupSoundId: "pickup_weapon",
    respawnSeconds: null
  },
  {
    id: "DRAGON_CLAW",
    kind: "weapon",
    visualId: "dragonClaw",
    grants: {
      giveWeaponId: "dragon_claw",
      ammo: { claw: 20 }
    },
    pickupSoundId: "pickup_weapon",
    respawnSeconds: null
  },
  {
    id: "HELLSTAFF",
    kind: "weapon",
    visualId: "hellstaff",
    grants: {
      giveWeaponId: "hellstaff",
      ammo: { hellstaff: 10 }
    },
    pickupSoundId: "pickup_weapon",
    respawnSeconds: null
  },
  {
    id: "PHOENIX_ROD",
    kind: "weapon",
    visualId: "phoenixRod",
    grants: {
      giveWeaponId: "phoenix_rod",
      ammo: { phoenix: 6 }
    },
    pickupSoundId: "pickup_weapon",
    respawnSeconds: null
  },
  {
    id: "FIREMACE",
    kind: "weapon",
    visualId: "firemace",
    grants: {
      giveWeaponId: "firemace",
      ammo: { firemace: 12 }
    },
    pickupSoundId: "pickup_weapon",
    respawnSeconds: null
  },
  {
    id: "WAND_CRYSTAL",
    kind: "ammo",
    visualId: "wandCrystal",
    grants: { ammo: { wand: 10 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 18
  },
  {
    id: "ETHEREAL_ARROWS",
    kind: "ammo",
    visualId: "etherealArrows",
    grants: { ammo: { crossbow: 5 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 18
  },
  {
    id: "CLAW_ORB",
    kind: "ammo",
    visualId: "clawOrb",
    grants: { ammo: { claw: 10 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 18
  },
  {
    id: "ENERGY_ORB",
    kind: "ammo",
    visualId: "energyOrb",
    grants: { ammo: { claw: 25 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 22
  },
  {
    id: "LESSER_RUNES",
    kind: "ammo",
    visualId: "lesserRunes",
    grants: { ammo: { hellstaff: 10 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 18
  },
  {
    id: "GREATER_RUNES",
    kind: "ammo",
    visualId: "greaterRunes",
    grants: { ammo: { hellstaff: 20 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 22
  },
  {
    id: "FLAME_ORB",
    kind: "ammo",
    visualId: "flameOrb",
    grants: { ammo: { phoenix: 4 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 18
  },
  {
    id: "INFERNO_ORB",
    kind: "ammo",
    visualId: "infernoOrb",
    grants: { ammo: { phoenix: 8 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 22
  },
  {
    id: "MACE_SPHERES",
    kind: "ammo",
    visualId: "maceSpheres",
    grants: { ammo: { firemace: 6 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 18
  },
  {
    id: "PILE_OF_MACE_SPHERES",
    kind: "ammo",
    visualId: "pileOfMaceSpheres",
    grants: { ammo: { firemace: 18 } },
    pickupSoundId: "pickup_ammo",
    respawnSeconds: 22
  },
  {
    id: "BAG_OF_HOLDING",
    kind: "support",
    visualId: "bagOfHolding",
    grants: {
      backpackUpgrade: true,
      ammo: {
        wand: 10,
        crossbow: 5,
        claw: 10,
        hellstaff: 10,
        phoenix: 2,
        firemace: 4
      }
    },
    canPickupWhenFull: true,
    pickupSoundId: "pickup_support",
    notes: "Increases ammo capacity and inventory capacity without renderer special-casing."
  },
  {
    id: "CRYSTAL_VIAL",
    kind: "health",
    visualId: "crystalVial",
    grants: { health: 10 },
    canPickupWhenFull: false,
    pickupSoundId: "pickup_health",
    respawnSeconds: 15
  },
  {
    id: "QUARTZ_FLASK",
    kind: "artifact",
    visualId: "quartzFlask",
    inventoryIconId: "inventoryIcon_quartzFlask",
    grants: { inventoryItemId: "QUARTZ_FLASK" },
    stackable: true,
    maxCarry: 25,
    useAction: "heal_25",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "SILVER_SHIELD",
    kind: "armor",
    visualId: "silverShield",
    grants: { armor: 25 },
    pickupSoundId: "pickup_armor",
    respawnSeconds: 18
  },
  {
    id: "ENCHANTED_SHIELD",
    kind: "armor",
    visualId: "enchantedShield",
    grants: { armor: 100 },
    pickupSoundId: "pickup_armor",
    respawnSeconds: 24
  },
  {
    id: "MYSTIC_URN",
    kind: "artifact",
    visualId: "mysticUrn",
    inventoryIconId: "inventoryIcon_mysticUrn",
    grants: { inventoryItemId: "MYSTIC_URN" },
    stackable: true,
    maxCarry: 16,
    useAction: "restore_to_full_health",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "GREEN_KEY",
    kind: "key",
    visualId: "greenKey",
    grants: { keys: ["green"] },
    canPickupWhenFull: true,
    pickupSoundId: "pickup_key"
  },
  {
    id: "YELLOW_KEY",
    kind: "key",
    visualId: "yellowKey",
    grants: { keys: ["yellow"] },
    canPickupWhenFull: true,
    pickupSoundId: "pickup_key"
  },
  {
    id: "BLUE_KEY",
    kind: "key",
    visualId: "blueKey",
    grants: { keys: ["blue"] },
    canPickupWhenFull: true,
    pickupSoundId: "pickup_key"
  },
  {
    id: "RING_OF_INVINCIBILITY",
    kind: "artifact",
    visualId: "ringOfInvincibility",
    inventoryIconId: "inventoryIcon_ringOfInvincibility",
    grants: { inventoryItemId: "RING_OF_INVINCIBILITY" },
    stackable: true,
    maxCarry: 16,
    useAction: "invulnerable_temporarily",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "SHADOWSPHERE",
    kind: "artifact",
    visualId: "shadowsphere",
    inventoryIconId: "inventoryIcon_shadowsphere",
    grants: { inventoryItemId: "SHADOWSPHERE" },
    stackable: true,
    maxCarry: 16,
    useAction: "partial_invisibility_temporarily",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "MORPH_OVUM",
    kind: "artifact",
    visualId: "morphOvum",
    inventoryIconId: "inventoryIcon_morphOvum",
    grants: { inventoryItemId: "MORPH_OVUM" },
    stackable: true,
    maxCarry: 16,
    useAction: "launch_morph_projectile",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "TIMEBOMB_OF_THE_ANCIENTS",
    kind: "artifact",
    visualId: "timebombPickup",
    inventoryIconId: "inventoryIcon_timebomb",
    grants: { inventoryItemId: "TIMEBOMB_OF_THE_ANCIENTS" },
    stackable: true,
    maxCarry: 16,
    useAction: "place_timebomb",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "CHAOS_DEVICE",
    kind: "artifact",
    visualId: "chaosDevice",
    inventoryIconId: "inventoryIcon_chaosDevice",
    grants: { inventoryItemId: "CHAOS_DEVICE" },
    stackable: true,
    maxCarry: 16,
    useAction: "teleport_to_start",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "WINGS_OF_WRATH",
    kind: "artifact",
    visualId: "wingsOfWrath",
    inventoryIconId: "inventoryIcon_wingsOfWrath",
    grants: { inventoryItemId: "WINGS_OF_WRATH" },
    stackable: true,
    maxCarry: 16,
    useAction: "flight_temporarily",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "TOME_OF_POWER",
    kind: "artifact",
    visualId: "tomeOfPower",
    inventoryIconId: "inventoryIcon_tomeOfPower",
    grants: { inventoryItemId: "TOME_OF_POWER" },
    stackable: true,
    maxCarry: 16,
    useAction: "weapon_powerup_temporarily",
    pickupSoundId: "pickup_artifact"
  },
  {
    id: "MAP_SCROLL",
    kind: "artifact",
    visualId: "mapScroll",
    grants: { inventoryItemId: "MAP_SCROLL" },
    stackable: true,
    maxCarry: 8,
    useAction: "reveal_map",
    pickupSoundId: "pickup_artifact",
    notes: "The sheet provides world pickup art but no separate HUD inventory icon on this sheet."
  },
  {
    id: "TORCH",
    kind: "artifact",
    visualId: "torch",
    inventoryIconId: "inventoryIcon_torch",
    grants: { inventoryItemId: "TORCH" },
    stackable: true,
    maxCarry: 16,
    useAction: "brighten_level_temporarily",
    pickupSoundId: "pickup_artifact"
  }
] as const satisfies readonly PickupDef[];

export const pickupDefsById = new Map<string, PickupDef>(
  pickupDefs.map((definition) => [definition.id, definition] as const)
);

export function getPickupDef(defId: string): PickupDef {
  const definition = pickupDefsById.get(defId);
  if (!definition) {
    throw new Error(`Unknown pickup definition '${defId}'.`);
  }
  return definition;
}
