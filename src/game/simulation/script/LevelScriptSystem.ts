import type { GameSessionState } from "../../core/types";
import { ConditionEvaluator } from "./ConditionEvaluator";
import { ScriptActionExecutor, type ScriptActionContext } from "./ScriptActionExecutor";
import type {
  DoorDef,
  LevelScriptDef,
  LevelScriptRuntimeState,
  ScriptFrameEvents,
  SecretDef,
  SwitchDef,
  TriggerDef,
  TriggerId,
  Vec2
} from "./LevelScriptTypes";
import { cellKey, playerCell, rectContainsCell } from "./LevelScriptUtils";
import { DoorSystem } from "../world/DoorSystem";
import { FloorRegionSystem } from "../world/FloorRegionSystem";
import { SecretSystem } from "../world/SecretSystem";
import { TeleporterSystem } from "../world/TeleporterSystem";

export interface LevelScriptCallbacks {
  state: GameSessionState;
  pushMessage(message: string, ttl?: number): void;
  teleportPlayer(targetPos: Vec2, facingRadians?: number): void;
  spawnEnemy(enemyDefId: string, spawnPos: Vec2, entityId?: string): void;
  spawnPickup(pickupDefId: string, spawnPos: Vec2): void;
  completeLevel(message?: string): void;
  playSound(soundId: string): void;
  debug(message: string): void;
  warn(message: string): void;
}

export class LevelScriptSystem {
  private readonly script: LevelScriptDef;
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly actionExecutor = new ScriptActionExecutor();
  private readonly doorSystem: DoorSystem;
  private readonly teleporterSystem: TeleporterSystem;
  private readonly secretSystem: SecretSystem;
  private readonly floorRegionSystem: FloorRegionSystem;
  private readonly triggersByKind: Record<string, TriggerDef[]>;
  private readonly switchesByCell = new Map<string, SwitchDef>();
  private readonly switchesById = new Map<string, SwitchDef>();
  private readonly secretsById = new Map<string, SecretDef>();
  private readonly doorsById = new Map<string, DoorDef>();
  private readonly triggersById = new Map<TriggerId, TriggerDef>();

  constructor(script: LevelScriptDef) {
    this.script = script;
    this.conditionEvaluator = new ConditionEvaluator(script);
    this.doorSystem = new DoorSystem(script.doors ?? []);
    this.teleporterSystem = new TeleporterSystem(script.teleporters ?? []);
    this.secretSystem = new SecretSystem(script.secrets ?? []);
    this.floorRegionSystem = new FloorRegionSystem(script.floorRegions ?? []);
    this.triggersByKind = {
      enter_region: [],
      use_switch: [],
      pickup_item: [],
      enemy_killed: [],
      all_enemies_dead_in_region: [],
      step_on_cell: [],
      use_line: [],
      timer: [],
      manual: []
    };

    for (const switchDef of script.switches ?? []) {
      this.switchesByCell.set(cellKey(switchDef.cell.x, switchDef.cell.y), switchDef);
      this.switchesById.set(switchDef.id, switchDef);
    }
    for (const secret of script.secrets ?? []) {
      this.secretsById.set(secret.id, secret);
    }
    for (const door of script.doors ?? []) {
      this.doorsById.set(door.id, door);
    }
    for (const trigger of script.triggers ?? []) {
      this.triggersByKind[trigger.kind].push(trigger);
      this.triggersById.set(trigger.id, trigger);
    }
  }

  getRuntime(state: GameSessionState): LevelScriptRuntimeState | null {
    return state.levelScript;
  }

  getDebugSnapshot(state: GameSessionState): LevelScriptRuntimeState | null {
    return state.levelScript ? structuredClone(state.levelScript) : null;
  }

  resolveCellSolidOverride(state: GameSessionState, cellX: number, cellY: number): boolean | null {
    const runtime = this.getRuntime(state);
    if (!runtime) {
      return null;
    }

    if (this.doorSystem.hasDoorAtCell(cellX, cellY)) {
      return this.doorSystem.isCellBlocked(runtime, cellX, cellY);
    }
    if (this.floorRegionSystem.isCellBlocked(runtime, cellX, cellY)) {
      return true;
    }
    return null;
  }

  isDoorOpen(state: GameSessionState, doorId: string): boolean {
    const runtime = this.getRuntime(state);
    return Boolean(runtime?.doors[doorId]?.isOpen);
  }

  isTeleporterEnabled(state: GameSessionState, teleporterId: string): boolean {
    const runtime = this.getRuntime(state);
    return Boolean(runtime?.teleporters[teleporterId]?.enabled);
  }

  tryUseCell(state: GameSessionState, cell: Vec2, callbacks: LevelScriptCallbacks, frameEvents: ScriptFrameEvents): boolean {
    const runtime = this.getRuntime(state);
    if (!runtime) {
      return false;
    }

    const switchDef = this.switchesByCell.get(cellKey(cell.x, cell.y));
    if (switchDef && this.tryUseSwitch(switchDef, state, runtime, callbacks, frameEvents)) {
      this.processUseLineTriggers(cell, callbacks, runtime, frameEvents);
      return true;
    }

    if (
      this.doorSystem.tryUseDoor(runtime, cell, {
        playerKeys: state.player.resources.keys,
        pushMessage: (message, ttl = 1.2) => callbacks.pushMessage(message, ttl),
        debug: callbacks.debug
      })
    ) {
      frameEvents.usedCells.push(cell);
      this.processUseLineTriggers(cell, callbacks, runtime, frameEvents);
      return true;
    }

    return false;
  }

  update(dt: number, callbacks: LevelScriptCallbacks, frameEvents: ScriptFrameEvents): void {
    const runtime = this.getRuntime(callbacks.state);
    if (!runtime) {
      return;
    }

    this.teleporterSystem.tick(runtime, dt);
    for (const trigger of this.script.triggers ?? []) {
      const triggerState = runtime.triggers[trigger.id];
      if (!triggerState) {
        continue;
      }
      triggerState.cooldownRemaining = Math.max(0, triggerState.cooldownRemaining - dt);
      triggerState.elapsedSeconds += dt;
    }

    const actionContext = this.createActionContext(callbacks, runtime, frameEvents);
    this.processSecrets(callbacks, runtime, actionContext);
    this.processEnterRegionTriggers(callbacks, runtime, actionContext);
    this.processStepOnCellTriggers(callbacks, runtime, actionContext);
    this.processTimedTriggers(callbacks, runtime, actionContext);
    this.processUseSwitchTriggers(callbacks, runtime, actionContext, frameEvents);
    this.processPickupTriggers(callbacks, runtime, actionContext, frameEvents);
    this.processEnemyKilledTriggers(callbacks, runtime, actionContext, frameEvents);
    this.processAllEnemiesDeadTriggers(callbacks, runtime, actionContext);
    this.processManualQueue(callbacks, runtime, actionContext, frameEvents);
    this.teleporterSystem.update(runtime, {
      level: callbacks.state.level,
      player: callbacks.state.player,
      debug: callbacks.debug
    });
  }

  private tryUseSwitch(
    switchDef: SwitchDef,
    state: GameSessionState,
    runtime: LevelScriptRuntimeState,
    callbacks: LevelScriptCallbacks,
    frameEvents: ScriptFrameEvents
  ): boolean {
    const switchState = runtime.switches[switchDef.id];
    if (!switchState?.enabled) {
      return false;
    }
    if ((switchDef.once ?? false) && switchState.used) {
      return false;
    }

    if (
      !this.conditionEvaluator.evaluateAll(switchDef.conditions, {
        state,
        script: this.script,
        runtime,
        hasDoorOpen: (doorId) => this.isDoorOpen(state, doorId),
        isTeleporterEnabled: (teleporterId) => this.isTeleporterEnabled(state, teleporterId)
      })
    ) {
      callbacks.pushMessage("Nothing happens.", 0.9);
      return true;
    }

    switchState.used = true;
    if (switchDef.once ?? false) {
      switchState.enabled = false;
    }
    frameEvents.usedSwitchIds.push(switchDef.id);
    callbacks.debug(`Switch '${switchDef.id}' activated.`);
    this.actionExecutor.execute(switchDef.actions ?? [], this.createActionContext(callbacks, runtime, frameEvents));
    this.processManualQueue(callbacks, runtime, this.createActionContext(callbacks, runtime, frameEvents), frameEvents);
    return true;
  }

  private processSecrets(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext
  ): void {
    for (const result of this.secretSystem.update(runtime, callbacks.state.level, callbacks.state.player)) {
      callbacks.state.secretsFound += 1;
      callbacks.pushMessage(result.secret.message ?? "A secret is revealed!", 2.4);
      callbacks.debug(`Secret '${result.secret.id}' discovered.`);
      this.actionExecutor.execute(result.rewardActions, actionContext);
    }
  }

  private processEnterRegionTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext
  ): void {
    const currentCell = playerCell(callbacks.state.level, callbacks.state.player);
    for (const trigger of this.triggersByKind.enter_region) {
      const triggerState = runtime.triggers[trigger.id];
      const rect = trigger.region ?? (trigger.regionId ? this.conditionEvaluator.getRegionRect(trigger.regionId) : undefined);
      if (!triggerState || !rect) {
        continue;
      }
      const inside = rectContainsCell(rect, currentCell);
      if (inside && !triggerState.wasInside) {
        this.fireTrigger(trigger, callbacks, runtime, actionContext);
      }
      triggerState.wasInside = inside;
    }
  }

  private processStepOnCellTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext
  ): void {
    const currentCell = playerCell(callbacks.state.level, callbacks.state.player);
    for (const trigger of this.triggersByKind.step_on_cell) {
      if (trigger.cell && trigger.cell.x === currentCell.x && trigger.cell.y === currentCell.y) {
        this.fireTrigger(trigger, callbacks, runtime, actionContext);
      }
    }
  }

  private processTimedTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext
  ): void {
    for (const trigger of this.triggersByKind.timer) {
      const triggerState = runtime.triggers[trigger.id];
      if (!triggerState) {
        continue;
      }
      if (triggerState.elapsedSeconds >= (trigger.delaySeconds ?? 0)) {
        this.fireTrigger(trigger, callbacks, runtime, actionContext);
      }
    }
  }

  private processUseSwitchTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext,
    frameEvents: ScriptFrameEvents
  ): void {
    if (frameEvents.usedSwitchIds.length === 0) {
      return;
    }
    const usedSwitchSet = new Set(frameEvents.usedSwitchIds);
    for (const trigger of this.triggersByKind.use_switch) {
      if (!trigger.switchId || !usedSwitchSet.has(trigger.switchId)) {
        continue;
      }
      this.fireTrigger(trigger, callbacks, runtime, actionContext);
    }
  }

  private processPickupTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext,
    frameEvents: ScriptFrameEvents
  ): void {
    if (frameEvents.pickupDefIds.length === 0 && frameEvents.pickupEntityIds.length === 0) {
      return;
    }
    const pickupIds = new Set([...frameEvents.pickupDefIds, ...frameEvents.pickupEntityIds]);
    for (const trigger of this.triggersByKind.pickup_item) {
      if (!trigger.itemId || !pickupIds.has(trigger.itemId)) {
        continue;
      }
      this.fireTrigger(trigger, callbacks, runtime, actionContext);
    }
  }

  private processEnemyKilledTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext,
    frameEvents: ScriptFrameEvents
  ): void {
    if (frameEvents.killedEnemyIds.length === 0) {
      return;
    }
    const killedSet = new Set(frameEvents.killedEnemyIds);
    for (const trigger of this.triggersByKind.enemy_killed) {
      if (!trigger.enemyEntityId || !killedSet.has(trigger.enemyEntityId)) {
        continue;
      }
      this.fireTrigger(trigger, callbacks, runtime, actionContext);
    }
  }

  private processAllEnemiesDeadTriggers(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext
  ): void {
    for (const trigger of this.triggersByKind.all_enemies_dead_in_region) {
      if (!trigger.regionId) {
        continue;
      }
      const allDead = this.conditionEvaluator.areAllEnemiesDeadInRegion(trigger.regionId, {
        state: callbacks.state,
        script: this.script,
        runtime,
        hasDoorOpen: (doorId) => this.isDoorOpen(callbacks.state, doorId),
        isTeleporterEnabled: (teleporterId) => this.isTeleporterEnabled(callbacks.state, teleporterId)
      });
      if (allDead) {
        this.fireTrigger(trigger, callbacks, runtime, actionContext);
      }
    }
  }

  private processManualQueue(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext,
    frameEvents: ScriptFrameEvents
  ): void {
    let safety = 0;
    while (frameEvents.manualTriggerIds.length > 0 && safety < 64) {
      const triggerId = frameEvents.manualTriggerIds.shift();
      if (!triggerId) {
        continue;
      }
      const trigger = this.triggersById.get(triggerId);
      if (!trigger) {
        callbacks.warn(`Manual trigger '${triggerId}' does not exist.`);
        continue;
      }
      const triggerState = runtime.triggers[trigger.id];
      if (triggerState) {
        triggerState.enabled = true;
      }
      this.fireTrigger(trigger, callbacks, runtime, actionContext);
      safety += 1;
    }
  }

  private processUseLineTriggers(
    cell: Vec2,
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContextOrEvents: ScriptActionContext | ScriptFrameEvents,
    maybeEvents?: ScriptFrameEvents
  ): void {
    const frameEvents = "manualTriggerIds" in actionContextOrEvents ? actionContextOrEvents : maybeEvents;
    if (!frameEvents) {
      return;
    }
    frameEvents.usedCells.push(cell);

    const actionContext =
      "queueTriggerActivation" in actionContextOrEvents
        ? actionContextOrEvents
        : this.createActionContext(callbacks, runtime, frameEvents);

    for (const trigger of this.triggersByKind.use_line) {
      if (trigger.cell && trigger.cell.x === cell.x && trigger.cell.y === cell.y) {
        this.fireTrigger(trigger, callbacks, runtime, actionContext);
      }
    }
  }

  private fireTrigger(
    trigger: TriggerDef,
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    actionContext: ScriptActionContext
  ): boolean {
    const triggerState = runtime.triggers[trigger.id];
    if (!triggerState?.enabled) {
      return false;
    }
    if ((trigger.once ?? false) && triggerState.fired) {
      return false;
    }
    if (triggerState.cooldownRemaining > 0) {
      return false;
    }
    if (
      !this.conditionEvaluator.evaluateAll(trigger.conditions, {
        state: callbacks.state,
        script: this.script,
        runtime,
        hasDoorOpen: (doorId) => this.isDoorOpen(callbacks.state, doorId),
        isTeleporterEnabled: (teleporterId) => this.isTeleporterEnabled(callbacks.state, teleporterId)
      })
    ) {
      return false;
    }

    triggerState.fired = true;
    triggerState.cooldownRemaining = trigger.cooldownSeconds ?? 0;
    if (trigger.once ?? false) {
      triggerState.enabled = false;
    }
    callbacks.debug(`Trigger '${trigger.id}' fired${trigger.debugLabel ? ` (${trigger.debugLabel})` : ""}.`);
    this.actionExecutor.execute(trigger.actions, actionContext);
    return true;
  }

  private createActionContext(
    callbacks: LevelScriptCallbacks,
    runtime: LevelScriptRuntimeState,
    frameEvents: ScriptFrameEvents
  ): ScriptActionContext {
    return {
      state: callbacks.state,
      script: this.script,
      runtime,
      setDoorOpen: (doorId, isOpen) => this.doorSystem.setOpen(runtime, doorId, isOpen),
      unlockDoor: (doorId) => this.doorSystem.unlock(runtime, doorId),
      toggleDoor: (doorId) => this.doorSystem.toggle(runtime, doorId),
      setTeleporterEnabled: (teleporterId, enabled) => {
        const teleporter = runtime.teleporters[teleporterId];
        if (!teleporter) {
          return false;
        }
        teleporter.enabled = enabled;
        return true;
      },
      revealTeleporter: (teleporterId) => {
        const teleporter = runtime.teleporters[teleporterId];
        if (!teleporter) {
          return false;
        }
        teleporter.revealed = true;
        return true;
      },
      teleportPlayer: callbacks.teleportPlayer,
      revealSecret: (secretId) => {
        const wasNew = this.secretSystem.reveal(runtime, secretId);
        if (wasNew) {
          callbacks.state.secretsFound += 1;
        }
        return wasNew;
      },
      setFloorHeight: (regionId, height) => this.floorRegionSystem.setHeight(runtime, regionId, height),
      raiseFloor: (regionId, delta) => this.floorRegionSystem.raise(runtime, regionId, delta),
      lowerFloor: (regionId, delta) => this.floorRegionSystem.lower(runtime, regionId, delta),
      spawnEnemy: callbacks.spawnEnemy,
      spawnPickup: callbacks.spawnPickup,
      pushMessage: callbacks.pushMessage,
      playSound: callbacks.playSound,
      completeLevel: callbacks.completeLevel,
      queueTriggerActivation: (triggerId) => frameEvents.manualTriggerIds.push(triggerId),
      debug: callbacks.debug,
      warn: callbacks.warn
    };
  }
}
