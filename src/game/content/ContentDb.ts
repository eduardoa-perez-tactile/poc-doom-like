import enemyDefs from "./data/enemies.json";
import enemyAttackProfileDefs from "./data/enemyAttackProfiles.json";
import enemyDeathProfileDefs from "./data/enemyDeathProfiles.json";
import enemyVisualProfileDefs from "./data/enemyVisualProfiles.json";
import effectDefs from "./data/effects.json";
import levelDef from "./data/level-dspairil-keep.json";
import projectileDefs from "./data/projectiles.json";
import { getFlatDef, getLevelCeilingFlat, getLevelFloorFlat } from "./flats";
import { validateLevelScript } from "./LevelScriptValidation";
import { pickupDefs, pickupVisuals } from "./pickups";
import { spriteManifest } from "./spriteManifest";
import weaponDefs from "./data/weapons.json";
import type {
  ContentDatabase,
  EffectDefinition,
  EnemyAttackProfileDefinition,
  EnemyDeathProfileDefinition,
  EnemyDefinition,
  EnemyProjectileDefinition,
  EnemyVisualProfileDefinition,
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
  const level = levelDef as LevelDefinition;
  getFlatDef(getLevelFloorFlat(level));
  getFlatDef(getLevelCeilingFlat(level));

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

  const pickupMap = new Map(pickupDefs.map((definition) => [definition.id, definition] as const));
  const enemyMap = new Map(
    (enemyDefs as EnemyDefinition[]).map((definition) => [definition.id, definition] as const)
  );
  validateLevelScript(level, {
    level,
    pickups: pickupMap,
    enemies: enemyMap
  });

  return {
    weapons: new Map(
      sortedWeapons.map((definition) => [definition.id, definition])
    ),
    enemies: enemyMap,
    enemyAttackProfiles: new Map(
      (enemyAttackProfileDefs as EnemyAttackProfileDefinition[]).map((definition) => [definition.id, definition])
    ),
    enemyDeathProfiles: new Map(
      (enemyDeathProfileDefs as EnemyDeathProfileDefinition[]).map((definition) => [definition.id, definition])
    ),
    enemyVisualProfiles: new Map(
      (enemyVisualProfileDefs as EnemyVisualProfileDefinition[]).map((definition) => [definition.id, definition])
    ),
    projectiles: new Map(
      (projectileDefs as EnemyProjectileDefinition[]).map((definition) => [definition.id, definition])
    ),
    effects: new Map(
      (effectDefs as EffectDefinition[]).map((definition) => [definition.id, definition])
    ),
    pickupDefs: pickupMap,
    pickupVisuals: new Map(pickupVisuals.map((definition) => [definition.id, definition] as const)),
    level,
    visuals: spriteManifest
  };
}
