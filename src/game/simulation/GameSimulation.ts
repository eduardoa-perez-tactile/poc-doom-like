import { WEAPON_ORDER } from "../content/ContentDb";
import type {
  ContentDatabase,
  EnemyDefinition,
  EnemySpawn,
  PickupSpawn,
  WeaponBehaviorDefinition,
  WeaponDefinition
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
  PlayerState,
  ProjectileState
} from "../core/types";
import type { InputFrame } from "../systems/InputSystem";

const ALERT_TIME = 0.12;
const ATTACK_RESOLVE_TIME = 0.1;
const TOME_DURATION = 20;
const WEAPON_ATTACK_ANIM_TIME = 0.14;
const PLAYER_PROJECTILE_OFFSET = 0.58;

export class GameSimulation {
  private readonly initialState: GameSessionState;
  private projectileId = 1;
  private hazardId = 1;
  state: GameSessionState;

  constructor(private readonly content: ContentDatabase) {
    this.initialState = this.buildInitialState();
    this.state = structuredClone(this.initialState);
  }

  restart(): void {
    this.projectileId = 1;
    this.hazardId = 1;
    this.state = structuredClone(this.initialState);
  }

  applySavedState(state: GameSessionState): void {
    this.state = structuredClone(state);
  }

  createSaveState(): GameSessionState {
    return structuredClone(this.state);
  }

  update(dt: number, input: InputFrame): SimulationEvents {
    const events: SimulationEvents = {
      shot: null,
      pickup: false,
      damageTaken: false,
      enemyAttack: false,
      playerDied: false
    };

    this.updateMessages(dt);
    this.updateWeaponView(dt);
    this.updateTome(dt);

    if (!input.fireDown) {
      this.state.weapon.sustainTargetId = null;
    }

    if (!this.state.player.alive) {
      this.updateDeadEnemies(dt);
      return events;
    }

    if (input.weaponSlot !== undefined) {
      this.trySwitchWeapon(input.weaponSlot);
    }
    if (input.toggleTome) {
      this.toggleTome();
    }

    this.state.elapsedTime += dt;
    this.state.player.angle = normalizeAngle(
      this.state.player.angle - input.lookDeltaX * 0.0022 * 60 * dt
    );

    this.updatePlayerMovement(dt, input);
    this.updateWeaponCooldown(dt);

    if (input.fireDown) {
      events.shot = this.fireCurrentWeapon();
    }

    this.updateEnemies(dt, events);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.collectPickups(events);
    this.updateDeadEnemies(dt);

    if (!this.state.player.alive) {
      events.playerDied = true;
    }

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
    const player: PlayerState = {
      x: playerStart.x,
      y: playerStart.y,
      angle: (levelDef.playerStart.angleDeg * Math.PI) / 180,
      health: 100,
      maxHealth: 100,
      radius: 0.28 * level.cellSize,
      moveSpeed: 5.8,
      bobPhase: 0,
      ammo: {
        wand: 70,
        crossbow: 30,
        claw: 60,
        hellstaff: 30,
        phoenix: 20,
        firemace: 18
      },
      alive: true
    };

    const enemies = levelDef.enemies.map((spawn) => this.createEnemyState(spawn));
    const pickups = levelDef.pickups.map((spawn) =>
      this.createPickupState(spawn, this.cellCenter(spawn.x, spawn.y))
    );
    const unlocked = WEAPON_ORDER.filter((id) => this.content.weapons.has(id));
    const initialWeaponId = unlocked[0] ?? "staff";

    return {
      level,
      player,
      tome: {
        active: false,
        remaining: 0
      },
      weapon: {
        currentId: initialWeaponId,
        unlocked,
        cooldownRemaining: 0,
        viewAnimation: "idle",
        viewAnimationTime: 0,
        viewAnimationRevision: 0,
        sustainTargetId: null
      },
      enemies,
      projectiles: [],
      hazards: [],
      pickups,
      messages: [{ text: levelDef.briefing, ttl: 6 }],
      elapsedTime: 0,
      killCount: 0,
      totalKills: enemies.length
    };
  }

  private createEnemyState(spawn: EnemySpawn): EnemyState {
    const definition = this.requireEnemyDefinition(spawn.type);
    const position = this.cellCenter(spawn.x, spawn.y);
    return {
      id: spawn.id,
      typeId: spawn.type,
      x: position.x,
      y: position.y,
      spawnX: position.x,
      spawnY: position.y,
      health: definition.health,
      alive: true,
      fsmState: "idle",
      stateTime: 0,
      lastKnownPlayerX: position.x,
      lastKnownPlayerY: position.y,
      hasLineOfSight: false,
      facingAngle: ((spawn.facingDeg ?? 180) * Math.PI) / 180,
      memoryTime: 0,
      attackApplied: false
    };
  }

  private createPickupState(
    spawn: PickupSpawn,
    position: { x: number; y: number }
  ): PickupState {
    return {
      id: spawn.id,
      kind: spawn.kind,
      x: position.x,
      y: position.y,
      amount: spawn.amount,
      collected: false
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

  private updateTome(dt: number): void {
    if (!this.state.tome.active) {
      return;
    }

    this.state.tome.remaining = Math.max(0, this.state.tome.remaining - dt);
    if (this.state.tome.remaining <= 0) {
      this.state.tome.active = false;
      this.pushMessage("The Tome of Power fades.", 1.2);
    }
  }

  private toggleTome(): void {
    this.state.tome.active = !this.state.tome.active;
    this.state.tome.remaining = this.state.tome.active ? TOME_DURATION : 0;
    this.pushMessage(
      this.state.tome.active ? "Tome of Power ignites." : "The Tome of Power subsides.",
      1.2
    );
  }

  private updatePlayerMovement(dt: number, input: InputFrame): void {
    const forwardX = Math.cos(this.state.player.angle);
    const forwardY = Math.sin(this.state.player.angle);
    const rightX = forwardY;
    const rightY = -forwardX;
    const rawX = forwardX * input.moveY + rightX * input.moveX;
    const rawY = forwardY * input.moveY + rightY * input.moveX;
    const length = length2(rawX, rawY);

    if (length < 0.0001) {
      return;
    }

    const velocity = this.state.player.moveSpeed / length;
    const nextX = this.state.player.x + rawX * velocity * dt;
    const nextY = this.state.player.y + rawY * velocity * dt;
    const radius = this.state.player.radius;
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

    const weapon = this.requireWeaponDefinition(this.state.weapon.currentId);
    const behavior = this.resolveWeaponBehavior(weapon);
    const ammoCost = this.resolveAmmoCost(weapon);
    if (!this.hasAmmoForWeapon(weapon, ammoCost)) {
      this.pushMessage("Out of ammo.", 0.7);
      this.trySwitchWeapon(1);
      return null;
    }

    const result = this.executeWeaponBehavior(weapon, behavior);
    if (!result.performed) {
      return null;
    }

    this.state.weapon.cooldownRemaining = this.resolveWeaponCooldown(weapon);
    this.state.weapon.viewAnimation = "attack";
    this.state.weapon.viewAnimationTime = 0;
    this.state.weapon.viewAnimationRevision += 1;
    this.state.weapon.sustainTargetId = result.sustainTargetId ?? null;
    this.consumeAmmo(weapon, ammoCost);
    return {
      weaponId: weapon.id,
      powered: this.state.tome.active
    };
  }

  private executeWeaponBehavior(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition
  ): WeaponFireResult {
    switch (behavior.kind) {
      case "melee_strike":
        return this.performMeleeStrike(weapon, behavior);
      case "melee_latch":
        return this.performMeleeLatch(weapon, behavior);
      case "hitscan_single":
      case "hitscan_rapid":
        return this.performHitscanAttack(weapon, behavior);
      case "projectile_single":
      case "projectile_spread":
      case "projectile_splash":
      case "projectile_homing":
      case "projectile_bounce":
      case "impact_spawn_hazard":
        return this.performProjectileAttack(weapon, behavior);
      case "beam_sustain":
        return this.performBeamSustain(weapon, behavior);
      default:
        return { performed: false };
    }
  }

  private performMeleeStrike(
    _weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition
  ): WeaponFireResult {
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
    const damageDealt = this.damageEnemy(target, behavior.damage, {
      knockbackForce: behavior.knockback ?? 0,
      knockbackX: directionX,
      knockbackY: directionY
    });
    return { performed: true, sustainTargetId: null, hit: damageDealt > 0 };
  }

  private performMeleeLatch(
    _weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition
  ): WeaponFireResult {
    const target = this.findBestTargetInCone(
      behavior.reach ?? 1.4,
      behavior.coneAngleDeg ?? 28,
      behavior.ghostInteraction,
      this.state.weapon.sustainTargetId
    );
    if (!target) {
      return { performed: true, sustainTargetId: null };
    }

    const damageDealt = this.damageEnemy(target, behavior.damage);
    if (damageDealt > 0 && behavior.healFactor) {
      this.state.player.health = clamp(
        this.state.player.health + damageDealt * behavior.healFactor,
        0,
        this.state.player.maxHealth
      );
    }

    return { performed: true, sustainTargetId: target.id, hit: damageDealt > 0 };
  }

  private performHitscanAttack(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition
  ): WeaponFireResult {
    const spreadCount = behavior.spread?.count ?? 1;
    const spreadAngleDeg = behavior.spread?.angleDeg ?? 0;
    for (let index = 0; index < spreadCount; index += 1) {
      const angleOffset = spreadCount === 1 ? 0 : centeredSpreadOffset(index, spreadCount, spreadAngleDeg);
      this.spawnVisualHitscanProjectile(weapon, behavior, angleOffset);
      this.fireHitscanRay(weapon, behavior, angleOffset);
    }
    return { performed: true, sustainTargetId: null };
  }

  private performProjectileAttack(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition
  ): WeaponFireResult {
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
      this.spawnProjectile(weapon, behavior, angleOffset);
    }

    return { performed: true, sustainTargetId: null };
  }

  private performBeamSustain(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition
  ): WeaponFireResult {
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
      this.damageEnemy(enemy, behavior.damage);
      hit = true;
    }

    if (behavior.impactEffect?.kind === "flame_visual" && behavior.impactEffect.projectileVisualId) {
      this.spawnFlameVisuals(weapon.id, behavior.impactEffect.projectileVisualId);
    }

    return { performed: true, sustainTargetId: null, hit };
  }

  private fireHitscanRay(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition,
    angleOffset: number
  ): void {
    const step = 0.18;
    const angle = normalizeAngle(this.state.player.angle + angleOffset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const range = behavior.range ?? 16;

    for (let distance = 0; distance <= range; distance += step) {
      const sampleX = this.state.player.x + dx * distance;
      const sampleY = this.state.player.y + dy * distance;
      if (this.isWallAtWorld(sampleX, sampleY)) {
        this.applyImpactEffect(weapon, behavior, sampleX, sampleY);
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
          this.damageEnemy(enemy, behavior.damage);
          this.applyImpactEffect(weapon, behavior, enemy.x, enemy.y);
          return;
        }
      }
    }
  }

  private spawnProjectile(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition,
    angleOffset: number
  ): void {
    const projectile = behavior.projectile;
    if (!projectile) {
      return;
    }

    const angle = normalizeAngle(this.state.player.angle + angleOffset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    this.state.projectiles.push({
      id: this.projectileId++,
      source: "player",
      ownerId: "player",
      weaponId: weapon.id,
      visualId: projectile.visualId,
      x: this.state.player.x + dx * PLAYER_PROJECTILE_OFFSET,
      y: this.state.player.y + dy * PLAYER_PROJECTILE_OFFSET,
      dx,
      dy,
      speed: projectile.speed,
      radius: projectile.radius,
      damage: behavior.damage,
      ttl: projectile.life,
      homingStrength: projectile.homingStrength ?? 0,
      splashRadius: behavior.splash?.radius ?? 0,
      splashDamageScale: behavior.splash?.damageScale ?? 0.5,
      bouncesRemaining: behavior.bounce?.maxBounces ?? 0,
      bounceSpeedMultiplier: behavior.bounce?.speedMultiplier ?? 1,
      seekAfterBounce: behavior.bounce?.seekAfterBounce ?? false,
      hasBounced: false,
      impactBurstVisualId: behavior.impactEffect?.projectileVisualId,
      impactBurstCount: behavior.impactEffect?.count,
      impactBurstSpreadDeg: behavior.impactEffect?.spreadAngleDeg,
      impactHazard: behavior.impactEffect?.hazard
        ? this.createHazardTemplate(behavior.impactEffect.hazard)
        : undefined
    });
  }

  private spawnVisualHitscanProjectile(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition,
    angleOffset: number
  ): void {
    const projectile = behavior.projectile;
    if (!projectile) {
      return;
    }

    const angle = normalizeAngle(this.state.player.angle + angleOffset);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    this.state.projectiles.push({
      id: this.projectileId++,
      source: "player",
      ownerId: "player",
      weaponId: weapon.id,
      visualId: projectile.visualId,
      x: this.state.player.x + dx * PLAYER_PROJECTILE_OFFSET,
      y: this.state.player.y + dy * PLAYER_PROJECTILE_OFFSET,
      dx,
      dy,
      speed: projectile.speed,
      radius: projectile.radius,
      damage: 0,
      ttl: projectile.life,
      homingStrength: 0,
      splashRadius: 0,
      splashDamageScale: 0,
      bouncesRemaining: 0,
      bounceSpeedMultiplier: 1,
      seekAfterBounce: false,
      hasBounced: false
    });
  }

  private spawnFlameVisuals(weaponId: string, visualId: string): void {
    for (let index = 0; index < 3; index += 1) {
      const angleOffset = centeredSpreadOffset(index, 3, 12);
      const angle = normalizeAngle(this.state.player.angle + angleOffset);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      this.state.projectiles.push({
        id: this.projectileId++,
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
        ttl: 0.18,
        homingStrength: 0,
        splashRadius: 0,
        splashDamageScale: 0,
        bouncesRemaining: 0,
        bounceSpeedMultiplier: 1,
        seekAfterBounce: false,
        hasBounced: false
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

  private updateEnemies(dt: number, events: SimulationEvents): void {
    for (const enemy of this.state.enemies) {
      const definition = this.requireEnemyDefinition(enemy.typeId);

      if (enemy.fsmState === "dead") {
        enemy.stateTime += dt;
        continue;
      }

      enemy.stateTime += dt;

      const toPlayerX = this.state.player.x - enemy.x;
      const toPlayerY = this.state.player.y - enemy.y;
      const distanceToPlayer = Math.hypot(toPlayerX, toPlayerY);
      const hasLos =
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
          if (hasLos && distanceToPlayer <= definition.meleeRange) {
            this.transitionEnemy(enemy, "windup");
            break;
          }

          if (hasLos || enemy.memoryTime > 0) {
            this.moveEnemyToward(enemy, enemy.lastKnownPlayerX, enemy.lastKnownPlayerY, definition.moveSpeed, dt);
          } else if (distance2(enemy.x, enemy.y, enemy.spawnX, enemy.spawnY) > 0.2) {
            this.moveEnemyToward(enemy, enemy.spawnX, enemy.spawnY, definition.moveSpeed * 0.8, dt);
          } else {
            this.transitionEnemy(enemy, "idle");
          }
          break;
        case "windup":
          if (enemy.stateTime >= definition.windupTime) {
            this.transitionEnemy(enemy, "attack");
          }
          break;
        case "attack":
          if (!enemy.attackApplied) {
            enemy.attackApplied = true;
            if (hasLos && distanceToPlayer <= definition.meleeRange) {
              this.damagePlayer(definition.attackDamage, events);
              events.enemyAttack = true;
            }
          }

          if (enemy.stateTime >= ATTACK_RESOLVE_TIME) {
            this.transitionEnemy(enemy, "cooldown");
          }
          break;
        case "cooldown":
          if (enemy.stateTime >= definition.cooldownTime) {
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
    enemy.x = resolved.x;
    enemy.y = resolved.y;
  }

  private updateProjectiles(dt: number): void {
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

      for (const enemy of this.state.enemies) {
        if (enemy.fsmState === "dead") {
          continue;
        }
        const definition = this.requireEnemyDefinition(enemy.typeId);
        if (distance2(projectile.x, projectile.y, enemy.x, enemy.y) <= definition.radius + projectile.radius) {
          if (projectile.damage > 0) {
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
      this.state.projectiles.push({
        id: this.projectileId++,
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
        ttl: 0.6,
        homingStrength: 0,
        splashRadius: 0,
        splashDamageScale: 0,
        bouncesRemaining: 0,
        bounceSpeedMultiplier: 1,
        seekAfterBounce: false,
        hasBounced: false
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
    const target = this.findNearestEnemy(projectile.x, projectile.y, 8);
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

  private collectPickups(events: SimulationEvents): void {
    for (const pickup of this.state.pickups) {
      if (pickup.collected) {
        continue;
      }

      if (distance2(this.state.player.x, this.state.player.y, pickup.x, pickup.y) > 0.8) {
        continue;
      }

      pickup.collected = true;
      events.pickup = true;

      if (pickup.kind === "health") {
        this.state.player.health = clamp(
          this.state.player.health + pickup.amount,
          0,
          this.state.player.maxHealth
        );
        this.pushMessage(`Recovered ${pickup.amount} health.`, 1.2);
      } else if (pickup.kind === "ammo") {
        for (const ammoType of Object.keys(this.state.player.ammo) as Array<keyof PlayerState["ammo"]>) {
          this.state.player.ammo[ammoType] += pickup.amount;
        }
        this.pushMessage(`Recovered ${pickup.amount} ammo for every relic.`, 1.2);
      }
    }
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

    enemy.health -= damage;
    enemy.lastKnownPlayerX = this.state.player.x;
    enemy.lastKnownPlayerY = this.state.player.y;
    enemy.memoryTime = this.requireEnemyDefinition(enemy.typeId).loseSightGrace;

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
      this.pushMessage("A grave thrall collapses.", 0.8);
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

  private damagePlayer(amount: number, events: SimulationEvents): void {
    if (!this.state.player.alive) {
      return;
    }

    this.state.player.health -= amount;
    events.damageTaken = true;
    if (this.state.player.health <= 0) {
      this.state.player.health = 0;
      this.state.player.alive = false;
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
    return {
      x: cellX * this.content.level.cellSize,
      y: cellY * this.content.level.cellSize
    };
  }

  private resolveWeaponBehavior(weapon: WeaponDefinition): WeaponBehaviorDefinition {
    return this.state.tome.active ? weapon.poweredBehavior : weapon.baseBehavior;
  }

  private resolveAmmoCost(weapon: WeaponDefinition): number {
    return this.state.tome.active ? weapon.ammoCostPowered : weapon.ammoCostBase;
  }

  private resolveWeaponCooldown(weapon: WeaponDefinition): number {
    return this.state.tome.active ? weapon.cooldownPowered : weapon.cooldownBase;
  }

  private hasAmmoForWeapon(weapon: WeaponDefinition, ammoCost: number): boolean {
    if (weapon.ammoType === "none" || ammoCost <= 0) {
      return true;
    }
    return this.state.player.ammo[weapon.ammoType] >= ammoCost;
  }

  private consumeAmmo(weapon: WeaponDefinition, ammoCost: number): void {
    if (weapon.ammoType === "none" || ammoCost <= 0) {
      return;
    }
    this.state.player.ammo[weapon.ammoType] = Math.max(
      0,
      this.state.player.ammo[weapon.ammoType] - ammoCost
    );
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

  private applyImpactEffect(
    weapon: WeaponDefinition,
    behavior: WeaponBehaviorDefinition,
    x: number,
    y: number
  ): void {
    const effect = behavior.impactEffect;
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
        this.state.projectiles.push({
          id: this.projectileId++,
          source: "player",
          ownerId: "player",
          weaponId: weapon.id,
          visualId: effect.projectileVisualId,
          x,
          y,
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          speed,
          radius,
          damage: effect.damage,
          ttl: life,
          homingStrength: 0,
          splashRadius: 0,
          splashDamageScale: 0,
          bouncesRemaining: 0,
          bounceSpeedMultiplier: 1,
          seekAfterBounce: false,
          hasBounced: false
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

  private pushMessage(text: string, ttl: number): void {
    this.state.messages.unshift({ text, ttl });
    if (this.state.messages.length > 5) {
      this.state.messages.length = 5;
    }
  }

  private requireEnemyDefinition(id: string): EnemyDefinition {
    const definition = this.content.enemies.get(id);
    if (!definition) {
      throw new Error(`Unknown enemy definition: ${id}`);
    }
    return definition;
  }

  private requireWeaponDefinition(id: string): WeaponDefinition {
    const definition = this.content.weapons.get(id);
    if (!definition) {
      throw new Error(`Unknown weapon definition: ${id}`);
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
