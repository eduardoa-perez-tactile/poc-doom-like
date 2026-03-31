import type { GameSessionState } from "../../core/types";
import type {
  LevelScriptDef,
  LevelScriptRuntimeState,
  ScriptActionDef,
  TriggerId
} from "./LevelScriptTypes";

export interface ScriptActionContext {
  state: GameSessionState;
  script: LevelScriptDef;
  runtime: LevelScriptRuntimeState;
  setDoorOpen(doorId: string, isOpen: boolean): boolean;
  unlockDoor(doorId: string): boolean;
  toggleDoor(doorId: string): boolean;
  setTeleporterEnabled(teleporterId: string, enabled: boolean): boolean;
  revealTeleporter(teleporterId: string): boolean;
  teleportPlayer(targetPos: { x: number; y: number }, facingRadians?: number): void;
  revealSecret(secretId: string): boolean;
  setFloorHeight(regionId: string, height: number): boolean;
  raiseFloor(regionId: string, delta: number): boolean;
  lowerFloor(regionId: string, delta: number): boolean;
  spawnEnemy(enemyDefId: string, spawnPos: { x: number; y: number }): void;
  spawnPickup(pickupDefId: string, spawnPos: { x: number; y: number }): void;
  pushMessage(message: string, ttl?: number): void;
  playSound(soundId: string): void;
  completeLevel(message?: string): void;
  queueTriggerActivation(triggerId: TriggerId): void;
  debug(message: string): void;
  warn(message: string): void;
}

export class ScriptActionExecutor {
  execute(actions: ScriptActionDef[], context: ScriptActionContext): void {
    for (const action of actions) {
      this.executeOne(action, context);
    }
  }

  private executeOne(action: ScriptActionDef, context: ScriptActionContext): void {
    switch (action.kind) {
      case "open_door":
        if (!action.doorId || !context.setDoorOpen(action.doorId, true)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "close_door":
        if (!action.doorId || !context.setDoorOpen(action.doorId, false)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "unlock_door":
        if (!action.doorId || !context.unlockDoor(action.doorId)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "toggle_door":
        if (!action.doorId || !context.toggleDoor(action.doorId)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "enable_teleporter":
        if (!action.teleporterId) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.revealTeleporter(action.teleporterId);
        if (!context.setTeleporterEnabled(action.teleporterId, true)) {
          context.warn(`Teleporter '${action.teleporterId}' was not found for enable_teleporter.`);
        }
        break;
      case "disable_teleporter":
        if (!action.teleporterId || !context.setTeleporterEnabled(action.teleporterId, false)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "teleport_player":
        if (!action.targetPos) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.teleportPlayer(action.targetPos, action.targetFacingRadians);
        break;
      case "raise_floor":
        if (!action.floorRegionId || !context.raiseFloor(action.floorRegionId, action.deltaHeight ?? 1)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "lower_floor":
        if (!action.floorRegionId || !context.lowerFloor(action.floorRegionId, action.deltaHeight ?? 1)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "set_floor_height":
        if (
          !action.floorRegionId ||
          action.targetHeight === undefined ||
          !context.setFloorHeight(action.floorRegionId, action.targetHeight)
        ) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "reveal_secret":
        if (!action.secretId || !context.revealSecret(action.secretId)) {
          this.warnMissingTarget(action, context);
        }
        break;
      case "spawn_enemy":
        if (!action.enemyDefId || !action.spawnPos) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.spawnEnemy(action.enemyDefId, action.spawnPos);
        break;
      case "spawn_pickup":
        if (!action.pickupDefId || !action.spawnPos) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.spawnPickup(action.pickupDefId, action.spawnPos);
        break;
      case "show_message":
        if (action.message) {
          context.pushMessage(action.message, 2.2);
        }
        break;
      case "play_sound":
        if (action.soundId) {
          context.playSound(action.soundId);
        }
        break;
      case "set_flag":
        if (!action.flag) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.runtime.flags[action.flag] = Boolean(action.value);
        break;
      case "clear_flag":
        if (!action.flag) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.runtime.flags[action.flag] = false;
        break;
      case "activate_trigger":
        if (!action.triggerId) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.queueTriggerActivation(action.triggerId);
        break;
      case "deactivate_trigger":
        if (!action.triggerId || !context.runtime.triggers[action.triggerId]) {
          this.warnMissingTarget(action, context);
          break;
        }
        context.runtime.triggers[action.triggerId].enabled = false;
        break;
      case "complete_level":
        context.completeLevel(action.message);
        break;
      default:
        context.warn(`Unhandled script action '${action.kind}'.`);
        break;
    }
  }

  private warnMissingTarget(action: ScriptActionDef, context: ScriptActionContext): void {
    context.warn(`Script action '${action.kind}' is missing a valid target.`);
  }
}
