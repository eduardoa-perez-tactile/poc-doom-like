import enemyDefs from "./data/enemies.json";
import levelDef from "./data/level-open-arena.json";
import { spriteManifest } from "./spriteManifest";
import weaponDefs from "./data/weapons.json";
import type {
  ContentDatabase,
  EnemyDefinition,
  LevelDefinition,
  WeaponDefinition
} from "./types";

export const WEAPON_ORDER = [
  "staff",
  "gauntlets_of_the_necromancer",
  "elven_wand",
  "ethereal_crossbow",
  "dragon_claw",
  "hellstaff",
  "phoenix_rod",
  "firemace"
] as const;

export function createContentDb(): ContentDatabase {
  const definitionsById = new Map(
    (weaponDefs as WeaponDefinition[]).map((definition) => [definition.id, definition] as const)
  );
  const sortedWeapons = WEAPON_ORDER.map((id, index) => {
    const definition = definitionsById.get(id);
    if (!definition) {
      throw new Error(`Missing weapon definition for ordered weapon '${id}'.`);
    }
    if (definition.slot !== index + 1) {
      throw new Error(
        `Weapon '${id}' must use slot ${index + 1}, received slot ${definition.slot}.`
      );
    }
    return definition;
  });

  return {
    weapons: new Map(
      sortedWeapons.map((definition) => [definition.id, definition])
    ),
    enemies: new Map(
      (enemyDefs as EnemyDefinition[]).map((definition) => [definition.id, definition])
    ),
    level: levelDef as LevelDefinition,
    visuals: spriteManifest
  };
}
