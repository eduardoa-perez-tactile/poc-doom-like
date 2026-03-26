import enemyDefs from "./data/enemies.json";
import levelDef from "./data/level-ashen-catacomb.json";
import { spriteManifest } from "./spriteManifest";
import weaponDefs from "./data/weapons.json";
import type {
  ContentDatabase,
  EnemyDefinition,
  LevelDefinition,
  WeaponDefinition
} from "./types";

export function createContentDb(): ContentDatabase {
  return {
    weapons: new Map(
      (weaponDefs as WeaponDefinition[]).map((definition) => [definition.id, definition])
    ),
    enemies: new Map(
      (enemyDefs as EnemyDefinition[]).map((definition) => [definition.id, definition])
    ),
    level: levelDef as LevelDefinition,
    visuals: spriteManifest
  };
}
