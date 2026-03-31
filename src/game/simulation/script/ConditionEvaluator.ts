import type { EnemyState, GameSessionState } from "../../core/types";
import type {
  ConditionDef,
  LevelScriptDef,
  LevelScriptRuntimeState,
  RegionId
} from "./LevelScriptTypes";
import { enemySpawnCell, normalizeKeyId, rectContainsCell } from "./LevelScriptUtils";

export interface ConditionContext {
  state: GameSessionState;
  script: LevelScriptDef;
  runtime: LevelScriptRuntimeState;
  hasDoorOpen(doorId: string): boolean;
  isTeleporterEnabled(teleporterId: string): boolean;
}

export class ConditionEvaluator {
  private readonly regionRects = new Map<RegionId, { x: number; y: number; w: number; h: number }>();

  constructor(script: LevelScriptDef) {
    for (const region of script.regions ?? []) {
      this.regionRects.set(region.id, region.rect);
    }
  }

  evaluateAll(conditions: ConditionDef[] | undefined, context: ConditionContext): boolean {
    return (conditions ?? []).every((condition) => this.evaluate(condition, context));
  }

  private evaluate(condition: ConditionDef, context: ConditionContext): boolean {
    switch (condition.kind) {
      case "flag_set":
        return Boolean(context.runtime.flags[condition.flag]);
      case "flag_clear":
        return !context.runtime.flags[condition.flag];
      case "has_key":
        return context.state.player.keys.some(
          (ownedKey) => normalizeKeyId(ownedKey) === normalizeKeyId(condition.keyId)
        );
      case "secret_found":
        return Boolean(context.runtime.secrets[condition.secretId]?.discovered);
      case "door_open":
        return context.hasDoorOpen(condition.doorId);
      case "teleporter_enabled":
        return context.isTeleporterEnabled(condition.teleporterId);
      case "trigger_fired":
        return Boolean(context.runtime.triggers[condition.triggerId]?.fired);
      case "enemy_dead":
        return this.enemyById(context.state.enemies, condition.entityId)?.fsmState === "dead";
      case "all_enemies_dead_in_region":
        return this.areAllEnemiesDeadInRegion(condition.regionId, context);
      default:
        return false;
    }
  }

  areAllEnemiesDeadInRegion(regionId: RegionId, context: ConditionContext): boolean {
    const rect = this.regionRects.get(regionId);
    if (!rect) {
      return false;
    }

    const matchingEnemies = context.state.enemies.filter((enemy) =>
      rectContainsCell(rect, enemySpawnCell(context.state.level, enemy))
    );
    return matchingEnemies.length > 0 && matchingEnemies.every((enemy) => enemy.fsmState === "dead");
  }

  getRegionRect(regionId: RegionId): { x: number; y: number; w: number; h: number } | undefined {
    return this.regionRects.get(regionId);
  }

  private enemyById(enemies: EnemyState[], entityId: string): EnemyState | undefined {
    return enemies.find((enemy) => enemy.id === entityId);
  }
}
