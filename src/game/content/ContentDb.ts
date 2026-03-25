import enemyDefs from "./data/enemies.json";
import levelDef from "./data/level-ashen-catacomb.json";
import visualDefs from "./data/visuals.json";
import weaponDefs from "./data/weapons.json";
import type {
  ContentDatabase,
  EnemyDefinition,
  LevelDefinition,
  VisualDatabaseDefinition,
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
    visuals: visualDefs as VisualDatabaseDefinition
  };
}
