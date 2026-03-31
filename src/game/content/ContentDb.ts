import enemyDefs from "./data/enemies.json";
import enemyAttackProfileDefs from "./data/enemyAttackProfiles.json";
import enemyDeathProfileDefs from "./data/enemyDeathProfiles.json";
import enemyVisualProfileDefs from "./data/enemyVisualProfiles.json";
import effectDefs from "./data/effects.json";
import projectileDefs from "./data/projectiles.json";
import { getFlatDef, getLevelCeilingFlat, getLevelFloorFlat } from "./flats";
import { getRegisteredLevel } from "./LevelRegistry";
import { validateLevelScript } from "./LevelScriptValidation";
import { pickupDefs, pickupVisuals } from "./pickups";
import { spriteManifest } from "./spriteManifest";
import weaponDefs from "./data/weapons.json";
import type {
  ContentRuntimeTuning,
  ContentDatabase,
  EffectDefinition,
  EnemyAttackProfileDefinition,
  EnemyDeathProfileDefinition,
  EnemyDefinition,
  EnemyProjectileDefinition,
  EnemyVisualProfileDefinition,
  WeaponBehaviorDefinition,
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

export function createContentDb(levelId?: string, runtimeTuning?: ContentRuntimeTuning): ContentDatabase {
  const level = applyLevelRuntimeTuning(getRegisteredLevel(levelId), runtimeTuning);
  getFlatDef(getLevelFloorFlat(level));
  getFlatDef(getLevelCeilingFlat(level));

  const definitionsById = new Map(
    (weaponDefs as WeaponDefinition[]).map((definition) => [definition.id, definition] as const)
  );
  const sortedWeapons = WEAPON_ORDER.map((id, index) => {
    const authoredDefinition = definitionsById.get(id);
    const definition = authoredDefinition
      ? applyWeaponRuntimeTuning(authoredDefinition, runtimeTuning)
      : undefined;
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
    (enemyDefs as EnemyDefinition[]).map((definition) => [
      definition.id,
      applyEnemyRuntimeTuning(definition, runtimeTuning)
    ] as const)
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
      (enemyAttackProfileDefs as EnemyAttackProfileDefinition[]).map((definition) => [
        definition.id,
        applyEnemyAttackRuntimeTuning(definition, runtimeTuning)
      ])
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

function applyLevelRuntimeTuning(
  level: ReturnType<typeof getRegisteredLevel>,
  runtimeTuning?: ContentRuntimeTuning
): ReturnType<typeof getRegisteredLevel> {
  if (!runtimeTuning?.additionalEnemySpawns || runtimeTuning.additionalEnemySpawns.length === 0) {
    return level;
  }

  return {
    ...level,
    pickups: runtimeTuning.disabledPickupDefIds
      ? level.pickups.filter((pickup) => !runtimeTuning.disabledPickupDefIds?.includes(pickup.defId))
      : level.pickups,
    enemies: [...level.enemies, ...runtimeTuning.additionalEnemySpawns]
  };
}

function applyWeaponRuntimeTuning(
  definition: WeaponDefinition,
  runtimeTuning?: ContentRuntimeTuning
): WeaponDefinition {
  const tuning = runtimeTuning?.weaponTunings?.find((candidate) => candidate.weaponId === definition.id);
  if (!tuning) {
    return structuredClone(definition);
  }

  const cooldownScale = tuning.cooldownScale ?? 1;
  const ammoCostDelta = tuning.ammoCostDelta ?? 0;

  return {
    ...structuredClone(definition),
    ammoCostBase: Math.max(0, definition.ammoCostBase + ammoCostDelta),
    ammoCostPowered: Math.max(0, definition.ammoCostPowered + ammoCostDelta),
    cooldownBase: definition.cooldownBase * cooldownScale,
    cooldownPowered: definition.cooldownPowered * cooldownScale,
    baseBehavior: applyBehaviorOverrides(definition.baseBehavior, tuning),
    poweredBehavior: applyBehaviorOverrides(definition.poweredBehavior, tuning)
  };
}

function applyBehaviorOverrides(
  behavior: WeaponBehaviorDefinition,
  tuning: NonNullable<ContentRuntimeTuning["weaponTunings"]>[number]
): WeaponBehaviorDefinition {
  const extraSpreadCount = (tuning.extraProjectiles ?? 0) + (tuning.spreadCountBonus ?? 0);
  const nextSpreadCount = Math.max(1, (behavior.spread?.count ?? 1) + extraSpreadCount);
  const spread = nextSpreadCount > 1
    ? {
        count: nextSpreadCount,
        angleDeg: behavior.spread?.angleDeg ?? Math.max(10, 8 + extraSpreadCount * 4)
      }
    : behavior.spread;

  return {
    ...structuredClone(behavior),
    damage: behavior.damage + (tuning.damageBonus ?? 0),
    spread,
    projectile: behavior.projectile
      ? {
          ...behavior.projectile,
          speed: behavior.projectile.speed * (tuning.projectileSpeedScale ?? 1),
          homingStrength: (behavior.projectile.homingStrength ?? 0) + (tuning.homingStrengthBonus ?? 0)
        }
      : undefined,
    bounce: behavior.bounce
      ? {
          ...behavior.bounce,
          maxBounces: behavior.bounce.maxBounces + (tuning.extraBounces ?? 0)
        }
      : undefined,
    splash: behavior.splash
      ? {
          ...behavior.splash,
          radius: behavior.splash.radius + (tuning.splashRadiusBonus ?? 0)
        }
      : undefined,
    impactEffect: behavior.impactEffect
      ? {
          ...behavior.impactEffect,
          count: behavior.impactEffect.count !== undefined
            ? behavior.impactEffect.count + (tuning.impactBurstCountBonus ?? 0)
            : behavior.impactEffect.count,
          hazard: behavior.impactEffect.hazard
            ? {
                ...behavior.impactEffect.hazard,
                duration: behavior.impactEffect.hazard.duration + (tuning.hazardDurationBonus ?? 0),
                radius: behavior.impactEffect.hazard.radius + (tuning.splashRadiusBonus ?? 0)
              }
            : behavior.impactEffect.hazard
        }
      : undefined
  };
}

function applyEnemyRuntimeTuning(
  definition: EnemyDefinition,
  runtimeTuning?: ContentRuntimeTuning
): EnemyDefinition {
  const tuning = runtimeTuning?.enemyTuning;
  if (!tuning) {
    return structuredClone(definition);
  }

  return {
    ...structuredClone(definition),
    health: Math.round(definition.health * (tuning.healthScale ?? 1)),
    moveSpeed: definition.moveSpeed * (tuning.moveSpeedScale ?? 1),
    aggroRange: definition.aggroRange * (tuning.aggroRangeScale ?? 1)
  };
}

function applyEnemyAttackRuntimeTuning(
  definition: EnemyAttackProfileDefinition,
  runtimeTuning?: ContentRuntimeTuning
): EnemyAttackProfileDefinition {
  const tuning = runtimeTuning?.enemyTuning;
  if (!tuning) {
    return structuredClone(definition);
  }

  return {
    ...structuredClone(definition),
    damage: Math.round(definition.damage * (tuning.attackDamageScale ?? 1)),
    cooldownTime: definition.cooldownTime * (tuning.attackCooldownScale ?? 1),
    projectileSpeed: definition.projectileSpeed
      ? definition.projectileSpeed * (tuning.projectileSpeedScale ?? 1)
      : definition.projectileSpeed
  };
}
