import type { PickupDef, PickupUseActionId } from "../content/pickups";
import type {
  ContentDatabase,
  EnemyAttackProfileDefinition,
  EnemyDeathProfileDefinition,
  EffectDefinition,
  EnemyDefinition,
  EnemyProjectileDefinition,
  EnemySpawn,
  PickupSpawn,
  WeaponBehaviorDefinition
} from "../content/types";
import { clamp, distance2, length2, normalizeAngle } from "../core/math";
import type {
  EnemyFsmState,
  EnemyState,
  GameSessionState,
  HazardState,
  HazardTemplateState,
  LevelState,
  PickupState,
  ProjectileState,
  ResolvedWeaponContext
} from "../core/types";
import type { RunLoadoutState } from "../progression/types";
import type { InputFrame } from "../systems/InputSystem";
import { AutomapBuilder } from "./map/AutomapBuilder";
import { AutomapDiscoverySystem } from "./map/AutomapDiscoverySystem";
import { AutomapStateSystem } from "./map/AutomapStateSystem";
import {
  executeArtifactUseAction
} from "./pickups/ArtifactUseSystem";
import {
  applyPickupDefinition as applyPickupGrants,
  canCollectPickup as canPickupBeCollected
} from "./pickups/PickupApplicationSystem";
import { PickupSystem } from "./pickups/PickupSystem";
import { PickupUseSystem } from "./pickups/PickupUseSystem";
import { applyDamageToPlayer } from "./player/PlayerDamageSystem";
import {
  PLAYER_EFFECT_DURATIONS,
  createInitialPlayerState,
  healPlayer,
  recomputePlayerDerivedState,
  tickPlayerEffects,
  toggleTimedPlayerEffect
} from "./player/PlayerStatSystem";
import { createInitialLevelScriptRuntime } from "./script/LevelScriptRuntime";
import { LevelScriptSystem, type LevelScriptCallbacks } from "./script/LevelScriptSystem";
import type {
  LevelScriptRuntimeState,
  Rect,
  ScriptFrameEvents,
  Vec2,
  ZoneEffectDef
} from "./script/LevelScriptTypes";
import type {
  AutomapPickupState,
  AutomapRenderSnapshot,
  LevelMapBuildResult
} from "./map/AutomapTypes";
import { rectContainsCell } from "./script/LevelScriptUtils";
import {
  hasAmmoForResolvedWeapon,
  resolveWeaponContext,
  spendResolvedWeaponAmmo
} from "./weapons/WeaponResolver";
import type { GameSessionOptions } from "./GameSession";

const ALERT_TIME = 0.12;
const ATTACK_RESOLVE_TIME = 0.1;
const WEAPON_ATTACK_ANIM_TIME = 0.14;
const PLAYER_PROJECTILE_OFFSET = 0.58;
const SCRIPT_SPAWN_MIN_PLAYER_DISTANCE = 2.25;

interface ZoneEffectSnapshot {
  playerSafe: boolean;
  playerRegenPerSecond: number;
  enemySpeedScale: number;
}

export class GameSimulation {
  private readonly initialState: GameSessionState;
  private readonly automapBuild: LevelMapBuildResult;
  private readonly automapStateSystem = new AutomapStateSystem();
  private readonly automapDiscoverySystem = new AutomapDiscoverySystem();
  private readonly pickupSystem = new PickupSystem();
  private readonly pickupUseSystem = new PickupUseSystem();
  private readonly scriptSystem: LevelScriptSystem | null;
  private readonly automapPickupStates: Record<string, AutomapPickupState> = {};
  private readonly automapRenderSnapshot: AutomapRenderSnapshot;
  private projectileId = 1;
  private hazardId = 1;
  private effectId = 1;
  private spawnedEnemyId = 1;
  private spawnedPickupId = 1;
  private currentScriptEvents: ScriptFrameEvents | null = null;
  private readonly scriptedZoneEffects: ZoneEffectDef[];
  private readonly enemyBlockZones: Rect[];
  private zoneEffects: ZoneEffectSnapshot = {
    playerSafe: false,
    playerRegenPerSecond: 0,
    enemySpeedScale: 1
  };
  state: GameSessionState;

  constructor(
    private readonly content: ContentDatabase,
    private readonly options: GameSessionOptions = {}
  ) {
    this.automapBuild = new AutomapBuilder().build(content);
    this.scriptSystem = content.level.script ? new LevelScriptSystem(content.level.script) : null;
    this.scriptedZoneEffects = content.level.script?.zoneEffects ?? [];
    this.enemyBlockZones = this.scriptedZoneEffects
      .filter((zoneEffect) => zoneEffect.effect === "enemy_block")
      .map((zoneEffect) => zoneEffect.region);
    this.automapRenderSnapshot = {
      definition: this.automapBuild.definition,
      runtime: this.automapStateSystem.createInitialState(),
      playerX: 0,
      playerY: 0,
      playerAngle: 0,
      doors: {},
      teleporters: {},
      secrets: {},
      switches: {},
      flags: {},
      pickups: this.automapPickupStates
    };
    this.initialState = this.buildInitialState();
    this.state = structuredClone(this.initialState);
  }

  restart(): void {
    this.projectileId = 1;
    this.hazardId = 1;
    this.effectId = 1;
    this.spawnedEnemyId = 1;
    this.spawnedPickupId = 1;
    this.currentScriptEvents = null;
    this.zoneEffects = { playerSafe: false, playerRegenPerSecond: 0, enemySpeedScale: 1 };
    for (const key of Object.keys(this.automapPickupStates)) {
      delete this.automapPickupStates[key];
    }
    this.state = structuredClone(this.initialState);
  }

  applySavedState(state: GameSessionState): void {
    for (const key of Object.keys(this.automapPickupStates)) {
      delete this.automapPickupStates[key];
    }
    this.state = structuredClone(state);
    this.zoneEffects = { playerSafe: false, playerRegenPerSecond: 0, enemySpeedScale: 1 };
    recomputePlayerDerivedState(this.state.player);
  }

  createSaveState(): GameSessionState {
    return structuredClone(this.state);
  }

  createRunLoadoutState(): RunLoadoutState {
    return {
      health: this.state.player.resources.health,
      armor: this.state.player.resources.armor,
      ammo: { ...this.state.player.resources.ammo },
      inventory: this.state.player.resources.inventory.map((entry) => ({ ...entry })),
      unlockedWeaponIds: [...this.state.weapon.unlocked],
      currentWeaponId: this.state.weapon.currentId
    };
  }

  update(dt: number, input: InputFrame): SimulationEvents {
    const events: SimulationEvents = {
      shot: null,
      pickup: false,
      damageTaken: false,
      enemyAttack: false,
      playerDied: false
    };
    this.currentScriptEvents = this.createScriptFrameEvents();

    this.updateMessages(dt);
    this.updateWeaponView(dt);
    this.updatePlayerEffects(dt);
    this.automapStateSystem.update(this.state.automap, input, dt);

    if (!input.fireDown) {
      this.state.weapon.sustainTargetId = null;
    }

    if (!this.state.player.alive) {
      this.updateDeadEnemies(dt);
      this.currentScriptEvents = null;
      return events;
    }

    if (this.state.levelCompleted) {
      this.currentScriptEvents = null;
      return events;
    }

    if (input.weaponSlot !== undefined) {
      this.trySwitchWeapon(input.weaponSlot);
    }
    if (input.toggleTome) {
      this.toggleTome();
    }
    this.pickupUseSystem.update(input, {
      content: this.content,
      state: this.state,
      cycleInventory: (direction) => this.cycleInventory(direction),
      tryUseWorld: () => this.tryUseWorld(),
      useSelectedInventoryItem: () => this.useSelectedInventoryItem()
    });

    this.state.elapsedTime += dt;
    const movementLockedByAutomap = this.state.automap.isOpen && !this.state.automap.followPlayer;
    this.state.player.angle = normalizeAngle(
      this.state.player.angle - (movementLockedByAutomap ? 0 : input.lookDeltaX) * 0.0022 * 60 * dt
    );

    this.updatePlayerMovement(
      dt,
      movementLockedByAutomap ? 0 : input.moveX,
      movementLockedByAutomap ? 0 : input.moveY
    );
    this.updateZoneEffects(dt);
    this.updateWeaponCooldown(dt);

    if (input.fireDown) {
      events.shot = this.fireCurrentWeapon();
    }

    this.updateEnemies(dt, events);
    this.updateProjectiles(dt, events);
    this.updateHazards(dt);
    this.updateEffects(dt);
    this.pickupSystem.update(
      dt,
      {
        content: this.content,
        state: this.state,
        tryGrantPickup: (definition, pickup) => this.tryCollectPickup(definition, pickup)
      },
      events
    );
    this.updateLevelScript(dt);
    this.automapDiscoverySystem.update(
      this.state.automap,
      this.state.level,
      this.state.player,
      this.automapBuild.definition,
      this.automapBuild.cache
    );
    this.updateDeadEnemies(dt);

    if (!this.state.player.alive) {
      events.playerDied = true;
    }

    this.currentScriptEvents = null;

    return events;
  }

  private buildInitialState(): GameSessionState {
    const levelDef = this.content.level;
    const level: LevelState = {
      id: levelDef.id,
      name: levelDef.name,
      cellSize: levelDef.cellSize,
      grid: levelDef.grid,
      width: levelDef.grid[0]?.length ?? 0,
      height: levelDef.grid.length
    };

    const playerStart = this.cellCenter(levelDef.playerStart.x, levelDef.playerStart.y);
    const player = createInitialPlayerState({
      x: playerStart.x,
      y: playerStart.y,
      angle: (levelDef.playerStart.angleDeg * Math.PI) / 180,
      cellSize: level.cellSize
    });
    player.runtimeModifiers = [...(this.options.playerModifiers ?? [])];
    recomputePlayerDerivedState(player);
    const automap = this.automapStateSystem.createInitialState();

    const enemies = levelDef.enemies.map((spawn) => this.createEnemyState(spawn));
    const pickups = levelDef.pickups.map((spawn) =>
      this.createPickupState(spawn, this.cellCenter(spawn.x, spawn.y))
    );
    const authoredWeapons = Array.from(this.content.weapons.values()).sort((left, right) => left.slot - right.slot);
    const unlocked = authoredWeapons
      .filter((definition) => definition.startingOwned)
      .map((definition) => definition.id);
    if (unlocked.length === 0 && authoredWeapons[0]) {
      unlocked.push(authoredWeapons[0].id);
    }
    const initialLoadout = this.options.loadout;
    const resolvedUnlocked = initialLoadout?.unlockedWeaponIds.length
      ? [...initialLoadout.unlockedWeaponIds]
      : unlocked;
    const initialWeaponId = initialLoadout?.currentWeaponId && resolvedUnlocked.includes(initialLoadout.currentWeaponId)
      ? initialLoadout.currentWeaponId
      : resolvedUnlocked[0] ?? "staff";
    if (initialLoadout) {
      player.resources.health = initialLoadout.health;
      player.resources.armor = initialLoadout.armor;
      player.resources.ammo = { ...initialLoadout.ammo };
      player.resources.inventory = initialLoadout.inventory.map((entry) => ({ ...entry }));
      player.resources.selectedInventoryIndex = Math.min(
        player.resources.selectedInventoryIndex,
        Math.max(0, player.resources.inventory.length - 1)
      );
      player.resources.keys = [];
      recomputePlayerDerivedState(player);
    }

    const initialState: GameSessionState = {
      level,
      levelScript: createInitialLevelScriptRuntime(levelDef.script),
      automap,
      player,
      weapon: {
        currentId: initialWeaponId,
        unlocked: resolvedUnlocked,
        cooldownRemaining: 0,
        viewAnimation: "idle",
        viewAnimationTime: 0,
        viewAnimationRevision: 0,
        sustainTargetId: null
      },
      enemies,
      projectiles: [],
      hazards: [],
      effects: [],
      pickups,
      messages: [{ text: levelDef.briefing, ttl: 6 }],
      elapsedTime: 0,
      killCount: 0,
      totalKills: enemies.length,
      secretsFound: 0,
      totalSecrets: levelDef.script?.secrets?.length ?? 0,
      levelCompleted: false
    };
    this.automapDiscoverySystem.update(
      initialState.automap,
      level,
      player,
      this.automapBuild.definition,
      this.automapBuild.cache
    );

    return initialState;
  }

  private createEnemyState(spawn: EnemySpawn): EnemyState {
    const position = this.cellCenter(spawn.x, spawn.y);
    return this.instantiateEnemyState(
      spawn.id,
      spawn.type,
      position.x,
      position.y,
      ((spawn.facingDeg ?? 180) * Math.PI) / 180
    );
  }

  private instantiateEnemyState(
    id: string,
    typeId: string,
    x: number,
    y: number,
    facingAngle: number
  ): EnemyState {
    const definition = this.requireEnemyDefinition(typeId);
    return {
      id,
      typeId,
      x,
      y,
      spawnX: x,
      spawnY: y,
      health: definition.health,
      alive: true,
      fsmState: "idle",
      stateTime: 0,
      lastKnownPlayerX: x,
      lastKnownPlayerY: y,
      hasLineOfSight: false,
      facingAngle,
      memoryTime: 0,
      attackApplied: false
    };
  }

  private createPickupState(
    spawn: PickupSpawn,
    position: { x: number; y: number }
  ): PickupState {
    return {
      entityId: spawn.id,
      defId: spawn.defId,
      position: {
        x: position.x,
        y: position.y,
        z: spawn.z ?? 0
      },
      bobPhase: (position.x + position.y) * 0.5,
      animTime: ((position.x * 13.37 + position.y * 7.11) % 1 + 1) % 1,
      picked: false,
      respawnAtTime: null
    };
  }

  private updateMessages(dt: number): void {
    for (let index = this.state.messages.length - 1; index >= 0; index -= 1) {
      this.state.messages[index].ttl -= dt;
      if (this.state.messages[index].ttl <= 0) {
        this.state.messages.splice(index, 1);
      }
    }
  }

  private updateWeaponView(dt: number): void {
    const weapon = this.state.weapon;
    weapon.viewAnimationTime += dt;
    if (weapon.viewAnimation === "attack" && weapon.viewAnimationTime >= WEAPON_ATTACK_ANIM_TIME) {
      weapon.viewAnimation = "idle";
      weapon.viewAnimationTime = 0;
    }
  }

  private updatePlayerEffects(dt: number): void {
    const tomeWasActive = this.state.player.derived.weaponPowered;
    tickPlayerEffects(this.state.player, dt);
    if (tomeWasActive && !this.state.player.derived.weaponPowered) {
      this.pushMessage("The Tome of Power fades.", 1.2);
    }
  }

  private toggleTome(): void {
    const active = toggleTimedPlayerEffect(
      this.state.player,
      "tomeOfPower",
      PLAYER_EFFECT_DURATIONS.tomeOfPower
    );
    this.pushMessage(
      active ? "Tome of Power ignites." : "The Tome of Power subsides.",
      1.2
    );
  }

  private updatePlayerMovement(dt: number, moveX: number, moveY: number): void {
    const forwardX = Math.cos(this.state.player.angle);
    const forwardY = Math.sin(this.state.player.angle);
    const rightX = forwardY;
    const rightY = -forwardX;
    const rawX = forwardX * moveY + rightX * moveX;
    const rawY = forwardY * moveY + rightY * moveX;
    const length = length2(rawX, rawY);

    if (length < 0.0001) {
      return;
    }

    const velocity = this.state.player.derived.moveSpeed / length;
    const nextX = this.state.player.x + rawX * velocity * dt;
    const nextY = this.state.player.y + rawY * velocity * dt;
    const radius = this.state.player.derived.radius;
    const resolved = this.resolveMotion(this.state.player.x, this.state.player.y, nextX, nextY, radius);
    this.state.player.x = resolved.x;
    this.state.player.y = resolved.y;
    this.state.player.bobPhase += dt * 10;
  }

  private updateWeaponCooldown(dt: number): void {
    this.state.weapon.cooldownRemaining = Math.max(0, this.state.weapon.cooldownRemaining - dt);
  }

  private trySwitchWeapon(slot: number): void {
    const definition = Array.from(this.content.weapons.values()).find((item) => item.slot === slot);
    if (!definition || !this.state.weapon.unlocked.includes(definition.id)) {
      return;
    }
    if (this.state.weapon.currentId !== definition.id) {
      this.state.weapon.currentId = definition.id;
      this.state.weapon.viewAnimation = "idle";
      this.state.weapon.viewAnimationTime = 0;
      this.state.weapon.viewAnimationRevision += 1;
      this.state.weapon.sustainTargetId = null;
      this.pushMessage(`${definition.name} readied.`, 1.2);
    }
  }

  private fireCurrentWeapon(): ShotEvent | null {
    if (this.state.weapon.cooldownRemaining > 0 || !this.state.player.alive) {
      return null;
    }

    const weaponContext = resolveWeaponContext(this.state.weapon, this.state.player, this.content);
    if (!hasAmmoForResolvedWeapon(weaponContext, this.state.player)) {
      this.pushMessage("Out of ammo.", 0.7);
      this.trySwitchWeapon(1);
      return null;
    }

    const result = this.executeWeaponBehavior(weaponContext);
    if (!result.performed) {
      return null;
    }

    this.state.weapon.cooldownRemaining = weaponContext.cooldown;
    this.state.weapon.viewAnimation = "attack";
    this.state.weapon.viewAnimationTime = 0;
    this.state.weapon.viewAnimationRevision += 1;
    this.state.weapon.sustainTargetId = result.sustainTargetId ?? null;
    spendResolvedWeaponAmmo(weaponContext, this.state.player);
    return {
      weaponId: weaponContext.weaponId,
      powered: weaponContext.powered
    };
  }

  private executeWeaponBehavior(context: ResolvedWeaponContext): WeaponFireResult {
    switch (context.behavior.kind) {
      case "melee_strike":
        return this.performMeleeStrike(context);
      case "melee_latch":
        return this.performMeleeLatch(context);
      case "hitscan_single":
      case "hitscan_rapid":
        return this.performHitscanAttack(context);
      case "projectile_single":
      case "projectile_spread":
      case "projectile_splash":
      case "projectile_homing":
      case "projectile_bounce":
      case "impact_spawn_hazard":
        return this.performProjectileAttack(context);
      case "beam_sustain":
        return this.performBeamSustain(context);
      default:
        return { performed: false };
    }
  }

  private performMeleeStrike(context: ResolvedWeaponContext): WeaponFireResult {
    const behavior = context.behavior;
    const target = this.findBestTargetInCone(
      behavior.reach ?? 1.2,
      behavior.coneAngleDeg ?? 24,
      behavior.ghostInteraction,
      null
    );
    if (!target) {
      return { performed: true, sustainTargetId: null };
    }

    const directionX = target.x - this.state.player.x;
    const directionY = target.y - this.state.player.y;
    const damageDealt = this.damageEnemy(target, this.resolveWeaponDamage(context, behavior.damage), {
      knockbackForce: behavior.knockback ?? 0,
      knockbackX: directionX,
      knockbackY: directionY
    });
    return { performed: true, sustainTargetId: null, hit: damageDealt > 0 };
  }

  private performMeleeLatch(context: ResolvedWeaponContext): WeaponFireResult {
    const behavior = context.behavior;
    const target = this.findBestTargetInCone(
      behavior.reach ?? 1.4,
      behavior.coneAngleDeg ?? 28,
      behavior.ghostInteraction,
      this.state.weapon.sustainTargetId
    );
    if (!target) {
      return { performed: true, sustainTargetId: null };
    }

    const damageDealt = this.damageEnemy(target, this.resolveWeaponDamage(context, behavior.damage));
    if (damageDealt > 0 && behavior.healFactor) {
      healPlayer(this.state.player, damageDealt * behavior.healFactor);
    }

    return { performed: true, sustainTargetId: target.id, hit: damageDealt > 0 };
  }

  private performHitscanAttack(context: ResolvedWeaponContext): WeaponFireResult {
    const behavior = context.behavior;
    const spreadCount = behavior.spread?.count ?? 1;
    const spreadAngleDeg = behavior.spread?.angleDeg ?? 0;
    for (let index = 0; index < spreadCount; index += 1) {
      const angleOffset = spreadCount === 1 ? 0 : centeredSpreadOffset(index, spreadCount, spreadAngleDeg);
      this.spawnVisualHitscanProjectile(context, angleOffset);
      this.fireHitscanRay(context, angleOffset);
    }
    return { performed: true, sustainTargetId: null };
  }

  private performProjectileAttack(context: ResolvedWeaponContext): WeaponFireResult {
    const behavior = context.behavior;
    const projectile = behavior.projectile;
    if (!projectile) {
      return { performed: false };
    }

    const spreadCount =
      behavior.kind === "projectile_spread" ? behavior.spread?.count ?? 1 : 1;
    const spreadAngleDeg =
      behavior.kind === "projectile_spread" ? behavior.spread?.angleDeg ?? 0 : 0;

    for (let index = 0; index < spreadCount; index += 1) {
      const angleOffset = spreadCount === 1 ? 0 : centeredSpreadOffset(index, spreadCount, spreadAngleDeg);
      this.spawnProjectile(context, angleOffset);
    }

    return { performed: true, sustainTargetId: null };
  }

  private performBeamSustain(context: ResolvedWeaponContext): WeaponFireResult {
    const behavior = context.behavior;
    const range = behavior.range ?? 4;
    const cone = behavior.coneAngleDeg ?? 30;
    let hit = false;

    for (const enemy of this.state.enemies) {
      if (enemy.fsmState === "dead") {
        continue;
      }
      if (!this.enemyWithinCone(enemy, range, cone, behavior.ghostInteraction)) {
        continue;
      }
      this.damageEnemy(enemy, this.resolveWeaponDamage(context, behavior.damage));
      hit = true;
    }

    if (behavior.impactEffect?.kind === "flame_visual" && behavior.impactEffect.projectileVisualId) {
      this.spawnFlameVisuals(context.weaponId, behavior.impactEffect.projectileVisualId);
    }

    return { performed: true, sustainTargetId: null, hit };
  }

  private fireHitscanRay(context: ResolvedWeaponContext, angleOffset: number): void {
    const behavior = context.behavior;
    const step = 0.18;
    const angle = normalizeAngle(this.state.player.angle + angleOffset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const range = behavior.range ?? 16;

    for (let distance = 0; distance <= range; distance += step) {
      const sampleX = this.state.player.x + dx * distance;
      const sampleY = this.state.player.y + dy * distance;
      if (this.isWallAtWorld(sampleX, sampleY)) {
        this.applyImpactEffect(context, sampleX, sampleY);
        return;
      }

      for (const enemy of this.state.enemies) {
        if (enemy.fsmState === "dead") {
          continue;
        }

        const definition = this.requireEnemyDefinition(enemy.typeId);
        if (!this.canAffectEnemy(definition, behavior.ghostInteraction)) {
          continue;
        }

        if (distance2(sampleX, sampleY, enemy.x, enemy.y) <= definition.radius) {
          this.damageEnemy(enemy, this.resolveWeaponDamage(context, behavior.damage));
          this.applyImpactEffect(context, enemy.x, enemy.y);
          return;
        }
      }
    }
  }

  private spawnRuntimeProjectile(spawn: {
    source: "player" | "enemy";
    ownerId: string;
    weaponId: string;
    visualId: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    radius: number;
    damage: number;
    ttl: number;
    homingStrength?: number;
    splashRadius?: number;
    splashDamageScale?: number;
    bouncesRemaining?: number;
    bounceSpeedMultiplier?: number;
    seekAfterBounce?: boolean;
    impactBurstVisualId?: string;
    impactBurstCount?: number;
    impactBurstSpreadDeg?: number;
    impactEffectId?: string;
    impactHazard?: HazardTemplateState;
  }): void {
    this.state.projectiles.push({
      id: this.projectileId++,
      source: spawn.source,
      ownerId: spawn.ownerId,
      weaponId: spawn.weaponId,
      visualId: spawn.visualId,
      x: spawn.x,
      y: spawn.y,
      dx: spawn.dx,
      dy: spawn.dy,
      speed: spawn.speed,
      radius: spawn.radius,
      damage: spawn.damage,
      ttl: spawn.ttl,
      homingStrength: spawn.homingStrength ?? 0,
      splashRadius: spawn.splashRadius ?? 0,
      splashDamageScale: spawn.splashDamageScale ?? 0,
      bouncesRemaining: spawn.bouncesRemaining ?? 0,
      bounceSpeedMultiplier: spawn.bounceSpeedMultiplier ?? 1,
      seekAfterBounce: spawn.seekAfterBounce ?? false,
      hasBounced: false,
      impactBurstVisualId: spawn.impactBurstVisualId,
      impactBurstCount: spawn.impactBurstCount,
      impactBurstSpreadDeg: spawn.impactBurstSpreadDeg,
      impactEffectId: spawn.impactEffectId,
      impactHazard: spawn.impactHazard
    });
  }

  private spawnProjectile(context: ResolvedWeaponContext, angleOffset: number): void {
    const behavior = context.behavior;
    const projectile = behavior.projectile;
    if (!projectile) {
      return;
    }

    const angle = normalizeAngle(this.state.player.angle + angleOffset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    this.spawnRuntimeProjectile({
      source: "player",
      ownerId: "player",
      weaponId: context.weaponId,
      visualId: projectile.visualId,
      x: this.state.player.x + dx * PLAYER_PROJECTILE_OFFSET,
      y: this.state.player.y + dy * PLAYER_PROJECTILE_OFFSET,
      dx,
      dy,
      speed: projectile.speed,
      radius: projectile.radius,
      damage: this.resolveWeaponDamage(context, behavior.damage),
      ttl: projectile.life,
      homingStrength: projectile.homingStrength ?? 0,
      splashRadius: behavior.splash?.radius ?? 0,
      splashDamageScale: behavior.splash?.damageScale ?? 0.5,
      bouncesRemaining: behavior.bounce?.maxBounces ?? 0,
      bounceSpeedMultiplier: behavior.bounce?.speedMultiplier ?? 1,
      seekAfterBounce: behavior.bounce?.seekAfterBounce ?? false,
      impactBurstVisualId: behavior.impactEffect?.projectileVisualId,
      impactBurstCount: behavior.impactEffect?.count,
      impactBurstSpreadDeg: behavior.impactEffect?.spreadAngleDeg,
      impactHazard: behavior.impactEffect?.hazard
        ? this.createHazardTemplate(behavior.impactEffect.hazard)
        : undefined
    });
  }

  private spawnVisualHitscanProjectile(context: ResolvedWeaponContext, angleOffset: number): void {
    const behavior = context.behavior;
    const projectile = behavior.projectile;
    if (!projectile) {
      return;
    }

    const angle = normalizeAngle(this.state.player.angle + angleOffset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    this.spawnRuntimeProjectile({
      source: "player",
      ownerId: "player",
      weaponId: context.weaponId,
      visualId: projectile.visualId,
      x: this.state.player.x + dx * PLAYER_PROJECTILE_OFFSET,
      y: this.state.player.y + dy * PLAYER_PROJECTILE_OFFSET,
      dx,
      dy,
      speed: projectile.speed,
      radius: projectile.radius,
      damage: 0,
      ttl: projectile.life
    });
  }

  private spawnFlameVisuals(weaponId: string, visualId: string): void {
    for (let index = 0; index < 3; index += 1) {
      const angleOffset = centeredSpreadOffset(index, 3, 12);
      const angle = normalizeAngle(this.state.player.angle + angleOffset);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      this.spawnRuntimeProjectile({
        source: "player",
        ownerId: "player",
        weaponId,
        visualId,
        x: this.state.player.x + dx * 0.65,
        y: this.state.player.y + dy * 0.65,
        dx,
        dy,
        speed: 8,
        radius: 0.12,
        damage: 0,
        ttl: 0.18
      });
    }
  }

  private createHazardTemplate(template: HazardTemplateState): HazardTemplateState {
    return {
      visualId: template.visualId,
      radius: template.radius,
      duration: template.duration,
      damagePerTick: template.damagePerTick,
      tickInterval: template.tickInterval
    };
  }

  private getEnemyAttackRange(definition: EnemyDefinition): number {
    return this.requireEnemyAttackProfile(definition.attackProfileId).range;
  }

  private canEnemyStartAttack(
    definition: EnemyDefinition,
    attackProfile: EnemyAttackProfileDefinition,
    hasLineOfSight: boolean,
    distanceToPlayer: number
  ): boolean {
    const requiresLineOfSight = attackProfile.requiresLineOfSight ?? true;
    return distanceToPlayer <= this.getEnemyAttackRange(definition) && (!requiresLineOfSight || hasLineOfSight);
  }

  private resolveEnemyAttack(
    enemy: EnemyState,
    definition: EnemyDefinition,
    attackProfile: EnemyAttackProfileDefinition,
    hasLineOfSight: boolean,
    distanceToPlayer: number,
    events: SimulationEvents
  ): void {
    if (this.zoneEffects.playerSafe) {
      return;
    }

    if (attackProfile.type === "projectile") {
      const canFireFromMemory = !(attackProfile.requiresLineOfSight ?? true) && enemy.memoryTime > 0;
      const canResolveProjectile = hasLineOfSight || canFireFromMemory;
      const targetX = hasLineOfSight ? this.state.player.x : enemy.lastKnownPlayerX;
      const targetY = hasLineOfSight ? this.state.player.y : enemy.lastKnownPlayerY;
      const attackDistance = Math.hypot(targetX - enemy.x, targetY - enemy.y);
      if (canResolveProjectile && attackDistance <= attackProfile.range) {
        this.spawnEnemyProjectile(enemy, definition, attackProfile, targetX, targetY);
        events.enemyAttack = true;
      }
      return;
    }

    if (hasLineOfSight && distanceToPlayer <= attackProfile.range) {
      this.damagePlayer(attackProfile.damage, events);
      events.enemyAttack = true;
    }
  }

  private spawnEnemyProjectile(
    enemy: EnemyState,
    definition: EnemyDefinition,
    attackProfile: EnemyAttackProfileDefinition,
    targetX: number,
    targetY: number
  ): void {
    const projectileDefId = attackProfile.projectileDefId;
    if (!projectileDefId) {
      return;
    }

    const projectileDefinition = this.requireProjectileDefinition(projectileDefId);
    const aimX = targetX - enemy.x;
    const aimY = targetY - enemy.y;
    const aimLength = Math.hypot(aimX, aimY);
    if (aimLength < 0.001) {
      return;
    }

    const dx = aimX / aimLength;
    const dy = aimY / aimLength;
    const spawnOffset =
      attackProfile.spawnOffset ??
      projectileDefinition.spawnOffset ??
      definition.radius + projectileDefinition.radius + 0.18;
    const baseAngle = Math.atan2(dy, dx);
    const fireCount = attackProfile.fireCount ?? 1;
    const spreadDegrees = attackProfile.spreadDegrees ?? 0;
    enemy.facingAngle = baseAngle;

    for (let index = 0; index < fireCount; index += 1) {
      const shotAngle = normalizeAngle(baseAngle + centeredSpreadOffset(index, fireCount, spreadDegrees));
      const shotDx = Math.cos(shotAngle);
      const shotDy = Math.sin(shotAngle);
      this.spawnRuntimeProjectile({
        source: "enemy",
        ownerId: enemy.id,
        weaponId: projectileDefinition.id,
        visualId: projectileDefinition.visualId,
        x: enemy.x + shotDx * spawnOffset,
        y: enemy.y + shotDy * spawnOffset,
        dx: shotDx,
        dy: shotDy,
        speed: attackProfile.projectileSpeed ?? 0,
        radius: projectileDefinition.radius,
        damage: attackProfile.damage,
        ttl: projectileDefinition.life,
        impactEffectId: projectileDefinition.impactEffectId
      });
    }
  }

  private spawnDeathPayloads(enemy: EnemyState, deathProfile: EnemyDeathProfileDefinition | null): void {
    if (!deathProfile) {
      return;
    }

    for (const spawnId of deathProfile.spawnEnemyIds ?? []) {
      if (this.content.enemies.has(spawnId)) {
        this.spawnEnemyFromDeathSpawn(spawnId, enemy.x, enemy.y, enemy.facingAngle);
      }
    }

    for (const effectId of deathProfile.spawnEffectIds ?? []) {
      if (this.content.effects.has(effectId)) {
        this.spawnEffect(effectId, enemy.x, enemy.y, enemy.facingAngle);
      }
    }
  }

  private spawnEnemyFromDeathSpawn(
    typeId: string,
    x: number,
    y: number,
    facingAngle: number
  ): void {
    const enemyId = `spawned_enemy_${this.spawnedEnemyId++}`;
    this.state.enemies.push(this.instantiateEnemyState(enemyId, typeId, x, y, facingAngle));
    this.state.totalKills += 1;
  }

  private spawnEffect(
    effectId: string,
    x: number,
    y: number,
    facingAngle: number
  ): void {
    const definition = this.requireEffectDefinition(effectId);
    this.state.effects.push({
      id: this.effectId++,
      effectId,
      x,
      y,
      facingAngle,
      ttl: definition.lifetime,
      animationState: definition.animationState ?? "idle"
    });
  }

  private updateEnemies(dt: number, events: SimulationEvents): void {
    for (const enemy of this.state.enemies) {
      const definition = this.requireEnemyDefinition(enemy.typeId);
      const attackProfile = this.requireEnemyAttackProfile(definition.attackProfileId);

      if (enemy.fsmState === "dead") {
        enemy.stateTime += dt;
        continue;
      }

      enemy.stateTime += dt;

      const toPlayerX = this.state.player.x - enemy.x;
      const toPlayerY = this.state.player.y - enemy.y;
      const distanceToPlayer = Math.hypot(toPlayerX, toPlayerY);
      const playerSafe = this.zoneEffects.playerSafe;
      const hasLos =
        !playerSafe &&
        distanceToPlayer <= definition.aggroRange &&
        this.hasLineOfSight(enemy.x, enemy.y, this.state.player.x, this.state.player.y);
      enemy.hasLineOfSight = hasLos;

      if (hasLos) {
        enemy.lastKnownPlayerX = this.state.player.x;
        enemy.lastKnownPlayerY = this.state.player.y;
        enemy.memoryTime = definition.loseSightGrace;
      } else {
        enemy.memoryTime = Math.max(0, enemy.memoryTime - dt);
      }

      if (distanceToPlayer > 0.001) {
        enemy.facingAngle = Math.atan2(toPlayerY, toPlayerX);
      }
      const chaseSpeed = definition.moveSpeed * this.zoneEffects.enemySpeedScale;

      switch (enemy.fsmState) {
        case "idle":
          if (hasLos) {
            this.transitionEnemy(enemy, "alert");
          }
          break;
        case "alert":
          if (enemy.stateTime >= ALERT_TIME) {
            this.transitionEnemy(enemy, "chase");
          }
          break;
        case "chase":
          if (this.canEnemyStartAttack(definition, attackProfile, hasLos, distanceToPlayer)) {
            this.transitionEnemy(enemy, "windup");
            break;
          }

          if (
            hasLos &&
            attackProfile.type === "projectile" &&
            distanceToPlayer <= (definition.preferredRange ?? attackProfile.range)
          ) {
            enemy.facingAngle = Math.atan2(toPlayerY, toPlayerX);
          } else if (hasLos || enemy.memoryTime > 0) {
            this.moveEnemyToward(enemy, enemy.lastKnownPlayerX, enemy.lastKnownPlayerY, chaseSpeed, dt);
          } else if (distance2(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY) > 0.2) {
            this.moveEnemyToward(enemy, enemy.spawnX, enemy.spawnY, chaseSpeed * 0.8, dt);
          } else {
            this.transitionEnemy(enemy, "idle");
          }
          break;
        case "windup":
          if (enemy.stateTime >= attackProfile.windupTime) {
            this.transitionEnemy(enemy, "attack");
          }
          break;
        case "attack":
          if (!enemy.attackApplied) {
            enemy.attackApplied = true;
            this.resolveEnemyAttack(enemy, definition, attackProfile, hasLos, distanceToPlayer, events);
          }

          if (enemy.stateTime >= ATTACK_RESOLVE_TIME) {
            this.transitionEnemy(enemy, "cooldown");
          }
          break;
        case "cooldown":
          if (enemy.stateTime >= attackProfile.cooldownTime) {
            if (hasLos || enemy.memoryTime > 0) {
              this.transitionEnemy(enemy, "chase");
            } else {
              this.transitionEnemy(enemy, "idle");
            }
          }
          break;
        case "hurt":
          if (enemy.stateTime >= definition.hurtTime) {
            if (enemy.health <= 0) {
              this.transitionEnemy(enemy, "dead");
            } else if (hasLos || enemy.memoryTime > 0) {
              this.transitionEnemy(enemy, "chase");
            } else {
              this.transitionEnemy(enemy, "idle");
            }
          }
          break;
      }
    }
  }

  private moveEnemyToward(
    enemy: EnemyState,
    targetX: number,
    targetY: number,
    speed: number,
    dt: number
  ): void {
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      return;
    }
    enemy.facingAngle = Math.atan2(dy, dx);
    const stepX = (dx / distance) * speed * dt;
    const stepY = (dy / distance) * speed * dt;
    const radius = this.requireEnemyDefinition(enemy.typeId).radius * 0.8;
    const resolved = this.resolveMotion(enemy.x, enemy.y, enemy.x + stepX, enemy.y + stepY, radius);
    const startCell = this.worldToCell(enemy.x, enemy.y);
    const targetCell = this.worldToCell(resolved.x, resolved.y);
    if (
      !this.isEnemyBlockedCell(startCell.x, startCell.y) &&
      this.isEnemyBlockedCell(targetCell.x, targetCell.y)
    ) {
      return;
    }
    enemy.x = resolved.x;
    enemy.y = resolved.y;
  }

  private updateProjectiles(dt: number, events: SimulationEvents): void {
    for (let index = this.state.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.state.projectiles[index];
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) {
        this.state.projectiles.splice(index, 1);
        continue;
      }

      if (projectile.homingStrength > 0 && (!projectile.seekAfterBounce || projectile.hasBounced)) {
        this.applyProjectileHoming(projectile, projectile.homingStrength * dt * 60);
      }

      const nextX = projectile.x + projectile.dx * projectile.speed * dt;
      const nextY = projectile.y + projectile.dy * projectile.speed * dt;
      if (this.isWallAtWorld(nextX, nextY)) {
        if (projectile.bouncesRemaining > 0) {
          this.bounceProjectile(projectile, dt);
          continue;
        }

        this.resolveProjectileImpact(projectile, nextX, nextY);
        this.state.projectiles.splice(index, 1);
        continue;
      }

      projectile.x = nextX;
      projectile.y = nextY;

      if (projectile.source === "enemy") {
        if (
          this.state.player.alive &&
          distance2(projectile.x, projectile.y, this.state.player.x, this.state.player.y) <=
            this.state.player.derived.radius + projectile.radius
        ) {
          if (!this.zoneEffects.playerSafe && projectile.damage > 0) {
            this.damagePlayer(projectile.damage, events);
          }
          this.resolveProjectileImpact(projectile, projectile.x, projectile.y);
          this.state.projectiles.splice(index, 1);
        }
        continue;
      }

      for (const enemy of this.state.enemies) {
        if (enemy.fsmState === "dead") {
          continue;
        }
        const definition = this.requireEnemyDefinition(enemy.typeId);
        if (distance2(projectile.x, projectile.y, enemy.x, enemy.y) <= definition.radius + projectile.radius) {
          if (projectile.weaponId === "artifact:morph_ovum") {
            this.applyMorphProjectileHit(enemy);
          } else if (projectile.damage > 0) {
            this.damageEnemy(enemy, projectile.damage);
          }
          this.resolveProjectileImpact(projectile, projectile.x, projectile.y);
          this.state.projectiles.splice(index, 1);
          break;
        }
      }
    }
  }

  private updateHazards(dt: number): void {
    for (let index = this.state.hazards.length - 1; index >= 0; index -= 1) {
      const hazard = this.state.hazards[index];
      hazard.ttl -= dt;
      hazard.tickRemaining -= dt;

      if (hazard.tickRemaining <= 0) {
        hazard.tickRemaining += hazard.tickInterval;
        this.applyHazardDamage(hazard);
      }

      if (hazard.ttl <= 0) {
        this.state.hazards.splice(index, 1);
      }
    }
  }

  private applyHazardDamage(hazard: HazardState): void {
    if (hazard.source === "enemy") {
      if (
        !this.zoneEffects.playerSafe &&
        this.state.player.alive &&
        distance2(hazard.x, hazard.y, this.state.player.x, this.state.player.y) <=
          hazard.radius + this.state.player.derived.radius
      ) {
        this.damagePlayer(hazard.damagePerTick);
      }
      return;
    }

    for (const enemy of this.state.enemies) {
      if (enemy.fsmState === "dead") {
        continue;
      }

      const definition = this.requireEnemyDefinition(enemy.typeId);
      if (distance2(hazard.x, hazard.y, enemy.x, enemy.y) <= hazard.radius + definition.radius) {
        this.damageEnemy(enemy, hazard.damagePerTick);
      }
    }
  }

  private bounceProjectile(projectile: ProjectileState, dt: number): void {
    const stepX = projectile.dx * projectile.speed * dt;
    const stepY = projectile.dy * projectile.speed * dt;
    const hitX = this.isWallAtWorld(projectile.x + stepX, projectile.y);
    const hitY = this.isWallAtWorld(projectile.x, projectile.y + stepY);

    if (hitX) {
      projectile.dx *= -1;
    }
    if (hitY) {
      projectile.dy *= -1;
    }
    if (!hitX && !hitY) {
      projectile.dx *= -1;
      projectile.dy *= -1;
    }

    projectile.bouncesRemaining -= 1;
    projectile.hasBounced = true;
    projectile.speed *= projectile.bounceSpeedMultiplier;
  }

  private resolveProjectileImpact(projectile: ProjectileState, x: number, y: number): void {
    if (projectile.impactEffectId) {
      this.spawnEffect(projectile.impactEffectId, x, y, Math.atan2(projectile.dy, projectile.dx));
    }

    if (projectile.splashRadius > 0) {
      this.applySplashDamage(x, y, projectile.splashRadius, projectile.damage, projectile.splashDamageScale);
    }

    if (projectile.impactBurstVisualId && projectile.impactBurstCount && projectile.impactBurstSpreadDeg) {
      this.spawnRadialBurst(projectile, x, y);
    }

    if (projectile.impactHazard) {
      this.spawnHazard(projectile, x, y, projectile.impactHazard);
    }
  }

  private updateEffects(dt: number): void {
    for (let index = this.state.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.state.effects[index];
      effect.ttl -= dt;
      if (effect.ttl <= 0) {
        this.state.effects.splice(index, 1);
      }
    }
  }

  private updateZoneEffects(dt: number): void {
    if (this.scriptedZoneEffects.length === 0) {
      this.zoneEffects.playerSafe = false;
      this.zoneEffects.playerRegenPerSecond = 0;
      this.zoneEffects.enemySpeedScale = 1;
      return;
    }

    const playerCell = this.worldToCell(this.state.player.x, this.state.player.y);
    let playerSafe = false;
    let playerRegenPerSecond = 0;
    let enemySpeedScale = 1;

    for (const zoneEffect of this.scriptedZoneEffects) {
      if (!rectContainsCell(zoneEffect.region, playerCell)) {
        continue;
      }

      switch (zoneEffect.effect) {
        case "safe":
          playerSafe = true;
          break;
        case "regen":
          playerRegenPerSecond += zoneEffect.regenPerSecond ?? 4;
          break;
        case "enemy_block":
          enemySpeedScale = Math.min(enemySpeedScale, zoneEffect.enemySpeedScale ?? 1);
          break;
      }
    }

    this.zoneEffects.playerSafe = playerSafe;
    this.zoneEffects.playerRegenPerSecond = playerRegenPerSecond;
    this.zoneEffects.enemySpeedScale = enemySpeedScale;

    if (playerRegenPerSecond > 0) {
      healPlayer(this.state.player, playerRegenPerSecond * dt);
    }
  }

  private isEnemyBlockedCell(cellX: number, cellY: number): boolean {
    if (this.enemyBlockZones.length === 0) {
      return false;
    }
    const cell = { x: cellX, y: cellY };
    for (const zone of this.enemyBlockZones) {
      if (rectContainsCell(zone, cell)) {
        return true;
      }
    }
    return false;
  }

  private applySplashDamage(
    impactX: number,
    impactY: number,
    radius: number,
    baseDamage: number,
    damageScale: number
  ): void {
    for (const enemy of this.state.enemies) {
      if (enemy.fsmState === "dead") {
        continue;
      }

      const definition = this.requireEnemyDefinition(enemy.typeId);
      const distance = Math.hypot(enemy.x - impactX, enemy.y - impactY);
      const maxDistance = radius + definition.radius;
      if (distance > maxDistance) {
        continue;
      }

      const falloff = 1 - clamp(distance / Math.max(maxDistance, 0.001), 0, 1);
      const splashDamage = Math.max(1, Math.round(baseDamage * damageScale * falloff));
      this.damageEnemy(enemy, splashDamage);
    }
  }

  private spawnRadialBurst(projectile: ProjectileState, x: number, y: number): void {
    const count = projectile.impactBurstCount ?? 0;
    if (count <= 0 || !projectile.impactBurstVisualId) {
      return;
    }

    const spread = projectile.impactBurstSpreadDeg ?? 360;
    const step = spread / count;
    for (let index = 0; index < count; index += 1) {
      const angle = (index * step * Math.PI) / 180;
      this.spawnRuntimeProjectile({
        source: projectile.source,
        ownerId: projectile.ownerId,
        weaponId: projectile.weaponId,
        visualId: projectile.impactBurstVisualId,
        x,
        y,
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        speed: 11,
        radius: 0.1,
        damage: 9,
        ttl: 0.6
      });
    }
  }

  private spawnHazard(
    projectile: ProjectileState,
    x: number,
    y: number,
    template: HazardTemplateState
  ): void {
    this.state.hazards.push({
      id: this.hazardId++,
      source: projectile.source,
      ownerId: projectile.ownerId,
      weaponId: projectile.weaponId,
      visualId: template.visualId,
      x,
      y,
      radius: template.radius,
      damagePerTick: template.damagePerTick,
      tickInterval: template.tickInterval,
      tickRemaining: template.tickInterval,
      ttl: template.duration
    });
  }

  private applyProjectileHoming(projectile: ProjectileState, turnFactor: number): void {
    const target =
      projectile.source === "enemy"
        ? (this.zoneEffects.playerSafe ? null : { x: this.state.player.x, y: this.state.player.y })
        : this.findNearestEnemy(projectile.x, projectile.y, 8);
    if (!target) {
      return;
    }

    const desiredX = target.x - projectile.x;
    const desiredY = target.y - projectile.y;
    const desiredLength = Math.hypot(desiredX, desiredY);
    if (desiredLength < 0.001) {
      return;
    }

    const currentLength = Math.hypot(projectile.dx, projectile.dy);
    const targetDx = desiredX / desiredLength;
    const targetDy = desiredY / desiredLength;
    const blend = clamp(turnFactor, 0, 1);
    projectile.dx = projectile.dx * (1 - blend) + targetDx * blend;
    projectile.dy = projectile.dy * (1 - blend) + targetDy * blend;
    const normalized = Math.hypot(projectile.dx, projectile.dy) || currentLength || 1;
    projectile.dx /= normalized;
    projectile.dy /= normalized;
  }

  private updateDeadEnemies(dt: number): void {
    for (const enemy of this.state.enemies) {
      if (enemy.fsmState === "dead") {
        enemy.stateTime += dt;
      }
    }
  }

  private damageEnemy(
    enemy: EnemyState,
    damage: number,
    options?: {
      knockbackForce?: number;
      knockbackX?: number;
      knockbackY?: number;
    }
  ): number {
    if (enemy.fsmState === "dead" || damage <= 0) {
      return 0;
    }

    const definition = this.requireEnemyDefinition(enemy.typeId);
    const deathProfile = definition.deathProfileId
      ? this.requireEnemyDeathProfile(definition.deathProfileId)
      : null;
    enemy.health -= damage;
    enemy.lastKnownPlayerX = this.state.player.x;
    enemy.lastKnownPlayerY = this.state.player.y;
    enemy.memoryTime = definition.loseSightGrace;

    if ((options?.knockbackForce ?? 0) > 0) {
      this.applyEnemyKnockback(
        enemy,
        options?.knockbackX ?? 0,
        options?.knockbackY ?? 0,
        options?.knockbackForce ?? 0
      );
    }

    if (enemy.health <= 0) {
      enemy.health = 0;
      enemy.alive = false;
      this.state.killCount += 1;
      this.transitionEnemy(enemy, "dead");
      this.spawnDeathPayloads(enemy, deathProfile);
      this.currentScriptEvents?.killedEnemyIds.push(enemy.id);
      this.pushMessage(`${definition.displayName} falls.`, 0.8);
      if (this.state.killCount >= this.state.totalKills) {
        this.pushMessage("The catacomb falls silent.", 4);
      }
      return damage;
    }

    this.transitionEnemy(enemy, "hurt");
    return damage;
  }

  private applyEnemyKnockback(enemy: EnemyState, x: number, y: number, force: number): void {
    const length = Math.hypot(x, y);
    if (length < 0.001) {
      return;
    }

    const dx = (x / length) * force;
    const dy = (y / length) * force;
    const radius = this.requireEnemyDefinition(enemy.typeId).radius * 0.8;
    const resolved = this.resolveMotion(enemy.x, enemy.y, enemy.x + dx, enemy.y + dy, radius);
    enemy.x = resolved.x;
    enemy.y = resolved.y;
  }

  private damagePlayer(amount: number, events?: SimulationEvents): void {
    if (!this.state.player.alive) {
      return;
    }

    const result = applyDamageToPlayer(this.state.player, amount);
    if (events && result.appliedDamage > 0) {
      events.damageTaken = true;
    }
    if (result.died) {
      this.pushMessage("You have fallen.", 3);
    }
  }

  private transitionEnemy(enemy: EnemyState, nextState: EnemyFsmState): void {
    enemy.fsmState = nextState;
    enemy.stateTime = 0;
    enemy.attackApplied = false;
    if (nextState === "dead") {
      enemy.alive = false;
    }
  }

  private resolveMotion(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    radius: number
  ): { x: number; y: number } {
    let resolvedX = startX;
    let resolvedY = startY;

    if (!this.collidesAt(targetX, startY, radius)) {
      resolvedX = targetX;
    }
    if (!this.collidesAt(resolvedX, targetY, radius)) {
      resolvedY = targetY;
    }

    return { x: resolvedX, y: resolvedY };
  }

  private collidesAt(worldX: number, worldY: number, radius: number): boolean {
    const cell = this.worldToCell(worldX, worldY);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const testX = cell.x + offsetX;
        const testY = cell.y + offsetY;
        if (!this.isCellSolid(testX, testY)) {
          continue;
        }

        const center = this.cellCenter(testX, testY);
        const halfSize = this.state.level.cellSize * 0.5;
        const closestX = clamp(worldX, center.x - halfSize, center.x + halfSize);
        const closestY = clamp(worldY, center.y - halfSize, center.y + halfSize);
        if (distance2(worldX, worldY, closestX, closestY) < radius) {
          return true;
        }
      }
    }

    return false;
  }

  private hasLineOfSight(startX: number, startY: number, endX: number, endY: number): boolean {
    const distance = distance2(startX, startY, endX, endY);
    const steps = Math.ceil(distance / 0.35);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const sampleX = startX + (endX - startX) * t;
      const sampleY = startY + (endY - startY) * t;
      if (this.isWallAtWorld(sampleX, sampleY)) {
        return false;
      }
    }
    return true;
  }

  private isWallAtWorld(worldX: number, worldY: number): boolean {
    const cell = this.worldToCell(worldX, worldY);
    return this.isCellSolid(cell.x, cell.y);
  }

  private isCellSolid(cellX: number, cellY: number): boolean {
    if (
      cellY < 0 ||
      cellY >= this.state.level.height ||
      cellX < 0 ||
      cellX >= this.state.level.width
    ) {
      return true;
    }

    const scriptOverride = this.scriptSystem?.resolveCellSolidOverride(this.state, cellX, cellY);
    if (scriptOverride !== undefined && scriptOverride !== null) {
      return scriptOverride;
    }

    return this.state.level.grid[cellY][cellX] !== ".";
  }

  private worldToCell(worldX: number, worldY: number): { x: number; y: number } {
    const half = this.state.level.cellSize * 0.5;
    return {
      x: Math.floor((worldX + half) / this.state.level.cellSize),
      y: Math.floor((worldY + half) / this.state.level.cellSize)
    };
  }

  private cellCenter(cellX: number, cellY: number): { x: number; y: number } {
    const cellSize = this.state?.level.cellSize ?? this.content.level.cellSize;
    return {
      x: cellX * cellSize,
      y: cellY * cellSize
    };
  }

  private findBestTargetInCone(
    reach: number,
    coneAngleDeg: number,
    ghostInteraction: WeaponBehaviorDefinition["ghostInteraction"],
    preferredTargetId: string | null
  ): EnemyState | null {
    if (preferredTargetId) {
      const preferred = this.state.enemies.find((enemy) => enemy.id === preferredTargetId);
      if (
        preferred &&
        preferred.fsmState !== "dead" &&
        this.enemyWithinCone(preferred, reach, coneAngleDeg, ghostInteraction)
      ) {
        return preferred;
      }
    }

    let bestTarget: EnemyState | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.state.enemies) {
      if (enemy.fsmState === "dead") {
        continue;
      }
      if (!this.enemyWithinCone(enemy, reach, coneAngleDeg, ghostInteraction)) {
        continue;
      }

      const distance = Math.hypot(enemy.x - this.state.player.x, enemy.y - this.state.player.y);
      if (distance < bestDistance) {
        bestTarget = enemy;
        bestDistance = distance;
      }
    }

    return bestTarget;
  }

  private enemyWithinCone(
    enemy: EnemyState,
    reach: number,
    coneAngleDeg: number,
    ghostInteraction: WeaponBehaviorDefinition["ghostInteraction"]
  ): boolean {
    const definition = this.requireEnemyDefinition(enemy.typeId);
    if (!this.canAffectEnemy(definition, ghostInteraction)) {
      return false;
    }

    const toEnemyX = enemy.x - this.state.player.x;
    const toEnemyY = enemy.y - this.state.player.y;
    const distance = Math.hypot(toEnemyX, toEnemyY);
    if (distance > reach + definition.radius) {
      return false;
    }
    if (!this.hasLineOfSight(this.state.player.x, this.state.player.y, enemy.x, enemy.y)) {
      return false;
    }

    const angleToEnemy = Math.atan2(toEnemyY, toEnemyX);
    return angleDifference(this.state.player.angle, angleToEnemy) <= ((coneAngleDeg * Math.PI) / 180) * 0.5;
  }

  private canAffectEnemy(
    definition: EnemyDefinition,
    ghostInteraction: WeaponBehaviorDefinition["ghostInteraction"]
  ): boolean {
    return !(ghostInteraction === "ignore" && definition.isGhost);
  }

  private resolveWeaponDamage(context: ResolvedWeaponContext, authoredDamage: number): number {
    if (authoredDamage <= 0) {
      return 0;
    }
    return Math.max(1, Math.round(authoredDamage * context.damageScale));
  }

  private applyImpactEffect(context: ResolvedWeaponContext, x: number, y: number): void {
    const effect = context.behavior.impactEffect;
    if (!effect) {
      return;
    }

    if (effect.kind === "radial_burst" && effect.projectileVisualId && effect.count && effect.damage) {
      const speed = effect.speed ?? 11;
      const life = effect.life ?? 0.6;
      const radius = effect.radius ?? 0.1;
      const step = 360 / effect.count;
      for (let index = 0; index < effect.count; index += 1) {
        const angle = (index * step * Math.PI) / 180;
        this.spawnRuntimeProjectile({
          source: "player",
          ownerId: "player",
          weaponId: context.weaponId,
          visualId: effect.projectileVisualId,
          x,
          y,
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          speed,
          radius,
          damage: this.resolveWeaponDamage(context, effect.damage),
          ttl: life
        });
      }
    }
  }

  private findNearestEnemy(originX: number, originY: number, maxDistance: number): EnemyState | null {
    let best: EnemyState | null = null;
    let bestDistance = maxDistance;
    for (const enemy of this.state.enemies) {
      if (enemy.fsmState === "dead") {
        continue;
      }
      const distance = Math.hypot(enemy.x - originX, enemy.y - originY);
      if (distance <= bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  private resolveScriptedEnemySpawnCenter(spawnPos: Vec2): { x: number; y: number } {
    const preferredCenter = this.cellCenter(spawnPos.x, spawnPos.y);
    const minDistance = this.state.level.cellSize * SCRIPT_SPAWN_MIN_PLAYER_DISTANCE;
    const distanceToPlayer = Math.hypot(
      preferredCenter.x - this.state.player.x,
      preferredCenter.y - this.state.player.y
    );
    if (distanceToPlayer >= minDistance && !this.isEnemyBlockedCell(spawnPos.x, spawnPos.y)) {
      return preferredCenter;
    }

    let bestCenter = preferredCenter;
    let bestDistance = distanceToPlayer;
    for (let radius = 1; radius <= 4; radius += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
            continue;
          }
          const testX = spawnPos.x + offsetX;
          const testY = spawnPos.y + offsetY;
          if (this.isCellSolid(testX, testY) || this.isEnemyBlockedCell(testX, testY)) {
            continue;
          }

          const center = this.cellCenter(testX, testY);
          const distance = Math.hypot(center.x - this.state.player.x, center.y - this.state.player.y);
          if (distance > bestDistance) {
            bestCenter = center;
            bestDistance = distance;
          }
        }
      }
      if (bestDistance >= minDistance) {
        break;
      }
    }

    return bestCenter;
  }

  private tryCollectPickup(definition: PickupDef, _pickup?: unknown): boolean {
    if (
      !canPickupBeCollected(definition, {
        player: this.state.player,
        weapon: this.state.weapon,
        pushMessage: (text, ttl) => this.pushMessage(text, ttl)
      })
    ) {
      return false;
    }

    applyPickupGrants(definition, {
      player: this.state.player,
      weapon: this.state.weapon,
      pushMessage: (text, ttl) => this.pushMessage(text, ttl)
    });
    this.currentScriptEvents?.pickupDefIds.push(definition.id);
    return true;
  }

  private cycleInventory(direction: -1 | 1): void {
    const inventory = this.state.player.resources.inventory;
    if (inventory.length === 0) {
      this.state.player.resources.selectedInventoryIndex = 0;
      return;
    }
    this.state.player.resources.selectedInventoryIndex =
      (this.state.player.resources.selectedInventoryIndex + direction + inventory.length) %
      inventory.length;
    this.pushMessage(
      `Selected ${titleCase(inventory[this.state.player.resources.selectedInventoryIndex].itemDefId)}.`,
      0.9
    );
  }

  private useSelectedInventoryItem(): boolean {
    const inventory = this.state.player.resources.inventory;
    if (inventory.length === 0) {
      this.pushMessage("Inventory is empty.", 0.8);
      return false;
    }
    const index = Math.max(
      0,
      Math.min(this.state.player.resources.selectedInventoryIndex, inventory.length - 1)
    );
    const entry = inventory[index];
    const definition = this.content.pickupDefs.get(entry.itemDefId);
    if (!definition?.useAction) {
      this.pushMessage("That item cannot be used.", 0.8);
      return false;
    }
    if (!this.executeUseAction(definition.useAction)) {
      return false;
    }
    entry.count -= 1;
    if (entry.count <= 0) {
      inventory.splice(index, 1);
      this.state.player.resources.selectedInventoryIndex = Math.max(
        0,
        Math.min(index, inventory.length - 1)
      );
    }
    this.pushMessage(`${titleCase(definition.id)} used.`, 1.1);
    return true;
  }

  private executeUseAction(action: PickupUseActionId): boolean {
    const used = executeArtifactUseAction(action, {
      player: this.state.player,
      revealMap: () => this.automapStateSystem.revealFullMap(this.state.automap),
      teleportToStart: () => {
        const start = this.cellCenter(this.content.level.playerStart.x, this.content.level.playerStart.y);
        this.state.player.x = start.x;
        this.state.player.y = start.y;
      },
      spawnMorphProjectile: () => this.spawnMorphProjectile(),
      placeTimebomb: () => this.placeTimebomb()
    });
    if (used) {
      return true;
    }

    switch (action) {
      case "heal_25":
      case "restore_to_full_health":
        this.pushMessage("Health is already full.", 0.8);
        return false;
      case "reveal_map":
        this.pushMessage("The map is already revealed.", 0.8);
        return false;
      default:
        return false;
    }
  }

  private spawnMorphProjectile(): void {
    const dx = Math.cos(this.state.player.angle);
    const dy = Math.sin(this.state.player.angle);
    this.spawnRuntimeProjectile({
      source: "player",
      ownerId: "player",
      weaponId: "artifact:morph_ovum",
      visualId: "morphOvumProjectile",
      x: this.state.player.x + dx * 0.7,
      y: this.state.player.y + dy * 0.7,
      dx,
      dy,
      speed: 11,
      radius: 0.18,
      damage: 0,
      ttl: 1.8
    });
  }

  private placeTimebomb(): void {
    // TODO: Replace this hazard proxy with a dedicated placed-bomb entity that delays and then detonates.
    this.state.hazards.push({
      id: this.hazardId++,
      source: "player",
      ownerId: "player",
      weaponId: "artifact:timebomb",
      visualId: "timebombUse",
      x: this.state.player.x + Math.cos(this.state.player.angle) * 0.4,
      y: this.state.player.y + Math.sin(this.state.player.angle) * 0.4,
      radius: 2.3,
      damagePerTick: 22,
      tickInterval: 0.45,
      tickRemaining: 0.2,
      ttl: 1.8
    });
  }

  private applyMorphProjectileHit(enemy: EnemyState): void {
    const definition = this.requireEnemyDefinition(enemy.typeId);
    const deathProfile = definition.deathProfileId
      ? this.requireEnemyDeathProfile(definition.deathProfileId)
      : null;
    enemy.health = 0;
    enemy.alive = false;
    this.transitionEnemy(enemy, "dead");
    this.spawnDeathPayloads(enemy, deathProfile);
    this.state.killCount += 1;
    this.currentScriptEvents?.killedEnemyIds.push(enemy.id);
    this.pushMessage("The Morph Ovum warps a target out of the fight.", 1.2);
    if (this.state.killCount >= this.state.totalKills) {
      this.pushMessage("The catacomb falls silent.", 4);
    }
  }

  private pushMessage(text: string, ttl: number): void {
    this.state.messages.unshift({ text, ttl });
    if (this.state.messages.length > 5) {
      this.state.messages.length = 5;
    }
  }

  getLevelScriptDebugState(): LevelScriptRuntimeState | null {
    return this.scriptSystem?.getDebugSnapshot(this.state) ?? null;
  }

  getAutomapRenderSnapshot(): AutomapRenderSnapshot {
    this.automapRenderSnapshot.runtime = this.state.automap;
    this.automapRenderSnapshot.playerX = this.state.player.x;
    this.automapRenderSnapshot.playerY = this.state.player.y;
    this.automapRenderSnapshot.playerAngle = this.state.player.angle;
    this.automapRenderSnapshot.doors = this.state.levelScript?.doors ?? {};
    this.automapRenderSnapshot.teleporters = this.state.levelScript?.teleporters ?? {};
    this.automapRenderSnapshot.secrets = this.state.levelScript?.secrets ?? {};
    this.automapRenderSnapshot.switches = this.state.levelScript?.switches ?? {};
    this.automapRenderSnapshot.flags = this.state.levelScript?.flags ?? {};

    for (const pickup of this.state.pickups) {
      this.automapPickupStates[pickup.entityId] = {
        defId: pickup.defId,
        picked: pickup.picked
      };
    }

    return this.automapRenderSnapshot;
  }

  private updateLevelScript(dt: number): void {
    if (!this.scriptSystem || !this.currentScriptEvents) {
      return;
    }
    this.scriptSystem.update(dt, this.createLevelScriptCallbacks(), this.currentScriptEvents);
  }

  private tryUseWorld(): boolean {
    if (!this.scriptSystem || !this.currentScriptEvents) {
      return false;
    }

    for (const cell of this.getUseCandidateCells()) {
      if (
        this.scriptSystem.tryUseCell(
          this.state,
          cell,
          this.createLevelScriptCallbacks(),
          this.currentScriptEvents
        )
      ) {
        return true;
      }
    }

    return false;
  }

  private getUseCandidateCells(): Vec2[] {
    const distances = [0, 0.4, 0.8, 1.1].map((value) => value * this.state.level.cellSize);
    const forwardX = Math.cos(this.state.player.angle);
    const forwardY = Math.sin(this.state.player.angle);
    const cells: Vec2[] = [];
    const seen = new Set<string>();

    for (const distance of distances) {
      const sampleX = this.state.player.x + forwardX * distance;
      const sampleY = this.state.player.y + forwardY * distance;
      const cell = this.worldToCell(sampleX, sampleY);
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cells.push(cell);
    }

    return cells;
  }

  private createScriptFrameEvents(): ScriptFrameEvents {
    return {
      usedSwitchIds: [],
      usedCells: [],
      pickupDefIds: [],
      pickupEntityIds: [],
      killedEnemyIds: [],
      manualTriggerIds: []
    };
  }

  private createLevelScriptCallbacks(): LevelScriptCallbacks {
    return {
      state: this.state,
      pushMessage: (message, ttl = 2.2) => this.pushMessage(message, ttl),
      teleportPlayer: (targetPos, facingRadians) => {
        const center = this.cellCenter(targetPos.x, targetPos.y);
        this.state.player.x = center.x;
        this.state.player.y = center.y;
        if (facingRadians !== undefined) {
          this.state.player.angle = facingRadians;
        }
      },
      spawnEnemy: (enemyDefId, spawnPos, entityId) => {
        const center = this.resolveScriptedEnemySpawnCenter(spawnPos);
        const resolvedEnemyId = entityId && entityId.length > 0
          ? entityId
          : `script_enemy_${this.spawnedEnemyId++}`;
        this.state.enemies.push(
          this.instantiateEnemyState(
            resolvedEnemyId,
            enemyDefId,
            center.x,
            center.y,
            0
          )
        );
        this.state.totalKills += 1;
      },
      spawnPickup: (pickupDefId, spawnPos) => {
        this.state.pickups.push(
          this.createPickupState(
            {
              id: `script_pickup_${this.spawnedPickupId++}`,
              defId: pickupDefId,
              x: spawnPos.x,
              y: spawnPos.y
            },
            this.cellCenter(spawnPos.x, spawnPos.y)
          )
        );
      },
      completeLevel: (message) => {
        this.state.levelCompleted = true;
        this.pushMessage(message ?? "Level complete.", 4);
      },
      playSound: (soundId) => {
        this.debugScript(`Requested scripted sound '${soundId}'.`);
      },
      debug: (message) => this.debugScript(message),
      warn: (message) => console.warn(`[LevelScript:${this.state.level.id}] ${message}`)
    };
  }

  private debugScript(message: string): void {
    if (!this.content.level.script?.debug) {
      return;
    }
    console.log(`[LevelScript:${this.state.level.id}] ${message}`);
  }

  private requireEnemyDefinition(id: string): EnemyDefinition {
    const definition = this.content.enemies.get(id);
    if (!definition) {
      throw new Error(`Unknown enemy definition: ${id}`);
    }
    return definition;
  }

  private requireEnemyAttackProfile(id: string): EnemyAttackProfileDefinition {
    const definition = this.content.enemyAttackProfiles.get(id);
    if (!definition) {
      throw new Error(`Unknown enemy attack profile: ${id}`);
    }
    return definition;
  }

  private requireEnemyDeathProfile(id: string): EnemyDeathProfileDefinition {
    const definition = this.content.enemyDeathProfiles.get(id);
    if (!definition) {
      throw new Error(`Unknown enemy death profile: ${id}`);
    }
    return definition;
  }

  private requireProjectileDefinition(id: string): EnemyProjectileDefinition {
    const definition = this.content.projectiles.get(id);
    if (!definition) {
      throw new Error(`Unknown enemy projectile definition: ${id}`);
    }
    return definition;
  }

  private requireEffectDefinition(id: string): EffectDefinition {
    const definition = this.content.effects.get(id);
    if (!definition) {
      throw new Error(`Unknown effect definition: ${id}`);
    }
    return definition;
  }

}

function centeredSpreadOffset(index: number, count: number, angleDeg: number): number {
  if (count <= 1) {
    return 0;
  }
  const t = count === 1 ? 0.5 : index / (count - 1);
  return (((t - 0.5) * angleDeg) * Math.PI) / 180;
}

function angleDifference(left: number, right: number): number {
  const delta = normalizeAngle(right - left);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface WeaponFireResult {
  performed: boolean;
  sustainTargetId?: string | null;
  hit?: boolean;
}

export interface ShotEvent {
  weaponId: string;
  powered: boolean;
}

export interface SimulationEvents {
  shot: ShotEvent | null;
  pickup: boolean;
  damageTaken: boolean;
  enemyAttack: boolean;
  playerDied: boolean;
}
