import type { ContentDatabase, EnemySpawn, PickupSpawn } from "../content/types";
import { clamp, distance2, length2, normalizeAngle } from "../core/math";
import type {
  EnemyFsmState,
  EnemyState,
  GameSessionState,
  LevelState,
  PickupState,
  PlayerState,
  ProjectileState
} from "../core/types";
import type { InputFrame } from "../systems/InputSystem";

const ALERT_TIME = 0.12;
const ATTACK_RESOLVE_TIME = 0.1;
const WEAPON_ATTACK_ANIM_TIME = 0.14;

export class GameSimulation {
  private readonly initialState: GameSessionState;
  private projectileId = 1;
  state: GameSessionState;

  constructor(private readonly content: ContentDatabase) {
    this.initialState = this.buildInitialState();
    this.state = structuredClone(this.initialState);
  }

  restart(): void {
    this.projectileId = 1;
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

    if (!this.state.player.alive) {
      this.updateDeadEnemies(dt);
      return events;
    }

    if (input.weaponSlot !== undefined) {
      this.trySwitchWeapon(input.weaponSlot);
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
      ammo: 30,
      alive: true
    };

    const enemies = levelDef.enemies.map((spawn) => this.createEnemyState(spawn));
    const pickups = levelDef.pickups.map((spawn) =>
      this.createPickupState(spawn, this.cellCenter(spawn.x, spawn.y))
    );

    return {
      level,
      player,
      weapon: {
        currentId: "shard_caster",
        unlocked: ["ember_wand", "shard_caster"],
        cooldownRemaining: 0,
        viewAnimation: "idle",
        viewAnimationTime: 0
      },
      enemies,
      projectiles: [],
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
      this.pushMessage(`${definition.name} readied.`, 1.2);
    }
  }

  private fireCurrentWeapon(): ShotEvent | null {
    if (this.state.weapon.cooldownRemaining > 0 || !this.state.player.alive) {
      return null;
    }

    const weapon = this.requireWeaponDefinition(this.state.weapon.currentId);
    if (weapon.ammoType === "bullets" && this.state.player.ammo < weapon.ammoPerShot) {
      this.pushMessage("Out of ammo.", 0.7);
      this.trySwitchWeapon(1);
      return null;
    }

    this.state.weapon.cooldownRemaining = weapon.cooldown;
    this.state.weapon.viewAnimation = "attack";
    this.state.weapon.viewAnimationTime = 0;

    if (weapon.ammoType === "bullets") {
      this.state.player.ammo -= weapon.ammoPerShot;
    }

    if (weapon.fireMode === "hitscan") {
      this.fireHitscan(weapon.range, weapon.damage);
      return { kind: "ember" };
    }

    const dx = Math.cos(this.state.player.angle);
    const dy = Math.sin(this.state.player.angle);
    const projectile: ProjectileState = {
      id: this.projectileId++,
      source: "player",
      ownerId: "player",
      weaponId: weapon.id,
      x: this.state.player.x + dx * 0.58,
      y: this.state.player.y + dy * 0.58,
      dx,
      dy,
      speed: weapon.projectileSpeed,
      radius: 0.16,
      damage: weapon.damage,
      ttl: weapon.projectileLife
    };
    this.state.projectiles.push(projectile);
    return { kind: "shard" };
  }

  private fireHitscan(range: number, damage: number): void {
    const step = 0.18;
    const dx = Math.cos(this.state.player.angle);
    const dy = Math.sin(this.state.player.angle);
    for (let distance = 0; distance <= range; distance += step) {
      const sampleX = this.state.player.x + dx * distance;
      const sampleY = this.state.player.y + dy * distance;
      if (this.isWallAtWorld(sampleX, sampleY)) {
        return;
      }

      for (const enemy of this.state.enemies) {
        if (enemy.fsmState === "dead") {
          continue;
        }

        const definition = this.requireEnemyDefinition(enemy.typeId);
        if (distance2(sampleX, sampleY, enemy.x, enemy.y) <= definition.radius) {
          this.damageEnemy(enemy, damage);
          return;
        }
      }
    }
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

      const nextX = projectile.x + projectile.dx * projectile.speed * dt;
      const nextY = projectile.y + projectile.dy * projectile.speed * dt;
      if (this.isWallAtWorld(nextX, nextY)) {
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
          this.damageEnemy(enemy, projectile.damage);
          this.state.projectiles.splice(index, 1);
          break;
        }
      }
    }
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
        this.state.player.ammo += pickup.amount;
        this.pushMessage(`Recovered ${pickup.amount} ammo.`, 1.2);
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

  private damageEnemy(enemy: EnemyState, damage: number): void {
    if (enemy.fsmState === "dead") {
      return;
    }

    enemy.health -= damage;
    enemy.lastKnownPlayerX = this.state.player.x;
    enemy.lastKnownPlayerY = this.state.player.y;
    enemy.memoryTime = this.requireEnemyDefinition(enemy.typeId).loseSightGrace;

    if (enemy.health <= 0) {
      enemy.health = 0;
      enemy.alive = false;
      this.state.killCount += 1;
      this.transitionEnemy(enemy, "dead");
      this.pushMessage("A grave thrall collapses.", 0.8);
      if (this.state.killCount >= this.state.totalKills) {
        this.pushMessage("The catacomb falls silent.", 4);
      }
      return;
    }

    this.transitionEnemy(enemy, "hurt");
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

    return this.state.level.grid[cellY][cellX] === "#";
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

  private pushMessage(text: string, ttl: number): void {
    this.state.messages.unshift({ text, ttl });
    if (this.state.messages.length > 5) {
      this.state.messages.length = 5;
    }
  }

  private requireEnemyDefinition(id: string) {
    const definition = this.content.enemies.get(id);
    if (!definition) {
      throw new Error(`Unknown enemy definition: ${id}`);
    }
    return definition;
  }

  private requireWeaponDefinition(id: string) {
    const definition = this.content.weapons.get(id);
    if (!definition) {
      throw new Error(`Unknown weapon definition: ${id}`);
    }
    return definition;
  }
}

export interface ShotEvent {
  kind: "ember" | "shard";
}

export interface SimulationEvents {
  shot: ShotEvent | null;
  pickup: boolean;
  damageTaken: boolean;
  enemyAttack: boolean;
  playerDied: boolean;
}
