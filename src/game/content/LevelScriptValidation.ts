import type { PickupDef } from "./pickups";
import type { EnemyDefinition, LevelDefinition } from "./types";
import type {
  ConditionDef,
  ScriptActionDef,
  TriggerDef
} from "../simulation/script/LevelScriptTypes";

interface ValidationContext {
  level: LevelDefinition;
  pickups: Map<string, PickupDef>;
  enemies: Map<string, EnemyDefinition>;
}

export function validateLevelScript(level: LevelDefinition, context: ValidationContext): void {
  validateWalkableCell(level, level.playerStart.x, level.playerStart.y, "player start");

  for (const enemy of level.enemies) {
    validateWalkableCell(level, enemy.x, enemy.y, `enemy spawn '${enemy.id}'`);
  }

  for (const pickup of level.pickups) {
    validateWalkableCell(level, pickup.x, pickup.y, `pickup spawn '${pickup.id}'`);
  }

  const script = level.script;
  if (!script) {
    return;
  }

  const allIds = new Set<string>();
  const registerId = (category: string, id: string): void => {
    if (allIds.has(id)) {
      throw new Error(`Duplicate ${category} id '${id}' in level '${level.id}'.`);
    }
    allIds.add(id);
  };

  const regionIds = new Set<string>();
  const doorIds = new Set<string>();
  const teleporterIds = new Set<string>();
  const switchIds = new Set<string>();
  const secretIds = new Set<string>();
  const floorRegionIds = new Set<string>();
  const triggerIds = new Set<string>();
  const enemyEntityIds = new Set(level.enemies.map((enemy) => enemy.id));

  for (const region of script.regions ?? []) {
    registerId("region", region.id);
    regionIds.add(region.id);
  }
  for (const door of script.doors ?? []) {
    registerId("door", door.id);
    doorIds.add(door.id);
  }
  for (const teleporter of script.teleporters ?? []) {
    registerId("teleporter", teleporter.id);
    teleporterIds.add(teleporter.id);
    validateRectBounds(level, teleporter.fromRegion, `teleporter '${teleporter.id}'`);
  }
  for (const switchDef of script.switches ?? []) {
    registerId("switch", switchDef.id);
    switchIds.add(switchDef.id);
    validateCellBounds(level, switchDef.cell.x, switchDef.cell.y, `switch '${switchDef.id}'`);
  }
  for (const secret of script.secrets ?? []) {
    registerId("secret", secret.id);
    secretIds.add(secret.id);
    validateRectBounds(level, secret.region, `secret '${secret.id}'`);
  }
  for (const floorRegion of script.floorRegions ?? []) {
    registerId("floor region", floorRegion.id);
    floorRegionIds.add(floorRegion.id);
    if (floorRegion.region) {
      validateRectBounds(level, floorRegion.region, `floor region '${floorRegion.id}'`);
    }
    for (const cell of floorRegion.blockingCells ?? []) {
      validateCellBounds(level, cell.x, cell.y, `floor region '${floorRegion.id}' blocker`);
    }
  }
  for (const zoneEffect of script.zoneEffects ?? []) {
    registerId("zone effect", zoneEffect.id);
    validateRectBounds(level, zoneEffect.region, `zone effect '${zoneEffect.id}'`);
    if (zoneEffect.regenPerSecond !== undefined && zoneEffect.regenPerSecond < 0) {
      throw new Error(`Zone effect '${zoneEffect.id}' has invalid regenPerSecond value.`);
    }
    if (zoneEffect.enemySpeedScale !== undefined && zoneEffect.enemySpeedScale < 0) {
      throw new Error(`Zone effect '${zoneEffect.id}' has invalid enemySpeedScale value.`);
    }
  }
  for (const trigger of script.triggers ?? []) {
    registerId("trigger", trigger.id);
    triggerIds.add(trigger.id);
    validateTrigger(trigger, level, regionIds);
  }

  for (const switchDef of script.switches ?? []) {
    validateConditions(
      switchDef.conditions ?? [],
      regionIds,
      doorIds,
      teleporterIds,
      secretIds,
      triggerIds
    );
    validateActions(
      switchDef.actions ?? [],
      regionIds,
      doorIds,
      teleporterIds,
      secretIds,
      switchIds,
      floorRegionIds,
      triggerIds,
      enemyEntityIds,
      context
    );
  }

  for (const secret of script.secrets ?? []) {
    validateActions(
      secret.rewardActions ?? [],
      regionIds,
      doorIds,
      teleporterIds,
      secretIds,
      switchIds,
      floorRegionIds,
      triggerIds,
      enemyEntityIds,
      context
    );
  }

  for (const trigger of script.triggers ?? []) {
    validateConditions(
      trigger.conditions ?? [],
      regionIds,
      doorIds,
      teleporterIds,
      secretIds,
      triggerIds
    );
    validateActions(
      trigger.actions,
      regionIds,
      doorIds,
      teleporterIds,
      secretIds,
      switchIds,
      floorRegionIds,
      triggerIds,
      enemyEntityIds,
      context
    );
  }
}

function validateTrigger(trigger: TriggerDef, level: LevelDefinition, regionIds: Set<string>): void {
  if (trigger.cell) {
    validateCellBounds(level, trigger.cell.x, trigger.cell.y, `trigger '${trigger.id}'`);
  }
  if (trigger.region) {
    validateRectBounds(level, trigger.region, `trigger '${trigger.id}'`);
  }
  if (trigger.regionId && !regionIds.has(trigger.regionId)) {
    throw new Error(`Trigger '${trigger.id}' references unknown region '${trigger.regionId}'.`);
  }
}

function validateConditions(
  conditions: ConditionDef[],
  regionIds: Set<string>,
  doorIds: Set<string>,
  teleporterIds: Set<string>,
  secretIds: Set<string>,
  triggerIds: Set<string>
): void {
  for (const condition of conditions) {
    switch (condition.kind) {
      case "door_open":
        assertReference(doorIds, condition.doorId, "door");
        break;
      case "teleporter_enabled":
        assertReference(teleporterIds, condition.teleporterId, "teleporter");
        break;
      case "secret_found":
        assertReference(secretIds, condition.secretId, "secret");
        break;
      case "trigger_fired":
        assertReference(triggerIds, condition.triggerId, "trigger");
        break;
      case "all_enemies_dead_in_region":
        assertReference(regionIds, condition.regionId, "region");
        break;
      default:
        break;
    }
  }
}

function validateActions(
  actions: ScriptActionDef[],
  _regionIds: Set<string>,
  doorIds: Set<string>,
  teleporterIds: Set<string>,
  secretIds: Set<string>,
  _switchIds: Set<string>,
  floorRegionIds: Set<string>,
  triggerIds: Set<string>,
  enemyEntityIds: Set<string>,
  context: ValidationContext
): void {
  for (const action of actions) {
    switch (action.kind) {
      case "open_door":
      case "close_door":
      case "unlock_door":
      case "toggle_door":
        if (action.doorId) {
          assertReference(doorIds, action.doorId, "door");
        }
        break;
      case "enable_teleporter":
      case "disable_teleporter":
        if (action.teleporterId) {
          assertReference(teleporterIds, action.teleporterId, "teleporter");
        }
        break;
      case "raise_floor":
      case "lower_floor":
      case "set_floor_height":
        if (action.floorRegionId) {
          assertReference(floorRegionIds, action.floorRegionId, "floor region");
        }
        break;
      case "reveal_secret":
        if (action.secretId) {
          assertReference(secretIds, action.secretId, "secret");
        }
        break;
      case "activate_trigger":
      case "deactivate_trigger":
        if (action.triggerId) {
          assertReference(triggerIds, action.triggerId, "trigger");
        }
        break;
      case "spawn_enemy":
        if (action.enemyDefId && !context.enemies.has(action.enemyDefId)) {
          throw new Error(`Unknown enemy definition '${action.enemyDefId}' in scripted action.`);
        }
        if (action.entityId) {
          if (enemyEntityIds.has(action.entityId)) {
            throw new Error(`Duplicate enemy entity id '${action.entityId}' in scripted action.`);
          }
          enemyEntityIds.add(action.entityId);
        }
        if (action.spawnPos) {
          validateWalkableCell(
            context.level,
            action.spawnPos.x,
            action.spawnPos.y,
            `scripted enemy spawn '${action.enemyDefId ?? "unknown"}'`
          );
        }
        break;
      case "spawn_pickup":
        if (action.pickupDefId && !context.pickups.has(action.pickupDefId)) {
          throw new Error(`Unknown pickup definition '${action.pickupDefId}' in scripted action.`);
        }
        if (action.spawnPos) {
          validateWalkableCell(
            context.level,
            action.spawnPos.x,
            action.spawnPos.y,
            `scripted pickup spawn '${action.pickupDefId ?? "unknown"}'`
          );
        }
        break;
      default:
        break;
    }
  }
}

function assertReference(set: Set<string>, id: string, label: string): void {
  if (!set.has(id)) {
    throw new Error(`Unknown ${label} reference '${id}'.`);
  }
}

function validateCellBounds(level: LevelDefinition, x: number, y: number, label: string): void {
  if (x < 0 || y < 0 || x >= level.grid[0].length || y >= level.grid.length) {
    throw new Error(`${label} is out of bounds at (${x}, ${y}) in level '${level.id}'.`);
  }
}

function validateWalkableCell(level: LevelDefinition, x: number, y: number, label: string): void {
  validateCellBounds(level, x, y, label);
  if (level.grid[y][x] !== ".") {
    throw new Error(`${label} must target a walkable cell at (${x}, ${y}) in level '${level.id}'.`);
  }
}

function validateRectBounds(
  level: LevelDefinition,
  rect: { x: number; y: number; w: number; h: number },
  label: string
): void {
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.w <= 0 ||
    rect.h <= 0 ||
    rect.x + rect.w > level.grid[0].length ||
    rect.y + rect.h > level.grid.length
  ) {
    throw new Error(`${label} is out of bounds in level '${level.id}'.`);
  }
}
