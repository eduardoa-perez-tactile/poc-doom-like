import type { PickupDef } from "../../content/pickups";
import type { AmmoType } from "../../content/types";
import type { WeaponState, PlayerState } from "../../core/types";
import {
  addAmmo,
  addArmor,
  addInventoryItem,
  addKey,
  grantPlayerUpgrade,
  hasAmmoSpace,
  hasPlayerUpgrade,
  healPlayer
} from "../player/PlayerStatSystem";

export interface PickupApplicationContext {
  player: PlayerState;
  weapon: WeaponState;
  pushMessage(text: string, ttl: number): void;
}

export function canCollectPickup(definition: PickupDef, context: PickupApplicationContext): boolean {
  const grants = definition.grants;
  if (!grants) {
    return true;
  }

  if (grants.upgradeId && !hasPlayerUpgrade(context.player, grants.upgradeId)) {
    return true;
  }
  if (grants.health) {
    return definition.canPickupWhenFull || context.player.resources.health < context.player.derived.maxHealth;
  }
  if (grants.armor) {
    return definition.canPickupWhenFull || context.player.resources.armor < context.player.derived.maxArmor;
  }
  if (grants.giveWeaponId && !context.weapon.unlocked.includes(grants.giveWeaponId)) {
    return true;
  }
  if (grants.ammo) {
    for (const [ammoType, amount] of Object.entries(grants.ammo)) {
      if (amount && hasAmmoSpace(context.player, ammoType as AmmoType)) {
        return true;
      }
    }
  }
  if (grants.keys) {
    return grants.keys.some((key) => !context.player.resources.keys.includes(key));
  }
  if (grants.inventoryItemId) {
    return addableInventory(definition, context.player, grants.inventoryItemId);
  }

  return definition.canPickupWhenFull ?? false;
}

export function applyPickupDefinition(
  definition: PickupDef,
  context: PickupApplicationContext
): void {
  const grants = definition.grants;
  if (grants?.upgradeId) {
    grantPlayerUpgrade(context.player, grants.upgradeId);
  }
  if (grants?.health) {
    healPlayer(context.player, grants.health);
  }
  if (grants?.armor) {
    addArmor(context.player, grants.armor);
  }
  if (grants?.giveWeaponId && !context.weapon.unlocked.includes(grants.giveWeaponId)) {
    context.weapon.unlocked.push(grants.giveWeaponId);
  }
  if (grants?.ammo) {
    for (const [ammoType, amount] of Object.entries(grants.ammo)) {
      if (!amount) {
        continue;
      }
      addAmmo(context.player, ammoType as AmmoType, amount);
    }
  }
  if (grants?.keys) {
    for (const key of grants.keys) {
      addKey(context.player, key);
    }
  }
  if (grants?.inventoryItemId) {
    addInventoryItem(context.player, grants.inventoryItemId, definition.maxCarry);
  }

  context.pushMessage(describePickup(definition), 1.4);
}

export function describePickup(definition: PickupDef): string {
  switch (definition.kind) {
    case "weapon":
      return `Claimed ${titleCase(definition.id)}.`;
    case "ammo":
      return `${titleCase(definition.id)} gathered.`;
    case "health":
      return "Health restored.";
    case "armor":
      return "Armor reinforced.";
    case "key":
      return `${titleCase(definition.id)} recovered.`;
    case "artifact":
      return `${titleCase(definition.id)} stored.`;
    case "support":
      return "Bag of Holding secured.";
    default:
      return `${titleCase(definition.id)} collected.`;
  }
}

function addableInventory(definition: PickupDef, player: PlayerState, itemDefId: string): boolean {
  const entry = player.resources.inventory.find((item) => item.itemDefId === itemDefId);
  if (entry) {
    return definition.maxCarry === undefined || entry.count < definition.maxCarry;
  }
  return player.resources.inventory.length < player.derived.inventoryCapacity;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
