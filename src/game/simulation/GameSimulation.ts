import type { ContentDatabase, DoorSpawn, PickupSpawn } from "../content/types";
import { clamp, distance2, length2, normalizeAngle } from "../core/math";
import type {
  DoorState,
  EnemyState,
  ExitState,
  GameState,
  LevelState,
  PickupState,
  PlayerState
} from "../core/types";
import type { InputFrame } from "../systems/InputSystem";

export class GameSimulation {
  private readonly initialState: GameState;
  private projectileId = 1;
  state: GameState;

  constructor(private readonly content: ContentDatabase) {
    this.initialState = this.buildInitialState();
    this.state = structuredClone(this.initialState);
  }

  restart(): void {
    this.projectileId = 1;
    this.state = structuredClone(this.initialState);
    this.pushMessage("The catacomb reforms around you.", 3);
  }

  applySavedState(state: GameState): void {
    this.state = structuredClone(state);
    this.pushMessage("Save restored.", 2);
  }

  createSaveState(): GameState {
    return structuredClone(this.state);
  }

  update(dt: number, input: InputFrame): SimulationEvents {
    const events: SimulationEvents = {
      shot: null,
      pickup: false,
      damageTaken: false,
      doorOpened: false,
      secretOpened: false
    };

    this.updateMessages(dt);

    if (input.weaponSlot !== undefined) {
      this.trySwitchWeapon(input.weaponSlot);
    }

    if (this.state.levelComplete || !this.state.player.alive) {
      return events;
    }

    this.state.elapsedTime += dt;
    this.state.player.angle = normalizeAngle(
      this.state.player.angle - input.lookDeltaX * 0.0022 * 60 * dt
    );
    this.updatePlayerMovement(dt, input);
    this.updateWeaponCooldown(dt);

    if (input.usePressed) {
      const interactionResult = this.useInFront();
      events.doorOpened = interactionResult.doorOpened;
      events.secretOpened = interactionResult.secretOpened;
    }

    if (input.firePressed) {
      events.shot = this.fireCurrentWeapon();
    }

    this.updateEnemies(dt, events);
    this.updateProjectiles(dt, events);
    this.collectPickups(events);
    this.checkExitReached();

    return events;
  }

  private buildInitialState(): GameState {
    const levelDef = this.content.level;
    const level: LevelState = {
      id: levelDef.id,
      name: levelDef.name,
      cellSize: levelDef.cellSize,
      grid: levelDef.grid,
      width: levelDef.grid[0]?.length ?? 0,
      height: levelDef.grid.length,
      doors: levelDef.doors.map((door) => createDoorState(door)),
      exits: levelDef.exits.map((exit): ExitState => ({ ...exit })),
      secretsTotal: levelDef.doors.filter((door) => door.secret).length
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
      keys: [],
      ammoShards: 0,
      alive: true
    };

    const enemies: EnemyState[] = levelDef.enemies.map((spawn) => {
      const definition = this.content.enemies.get(spawn.type);
      if (!definition) {
        throw new Error(`Unknown enemy type: ${spawn.type}`);
      }
      const position = this.cellCenter(spawn.x, spawn.y);
      return {
        id: spawn.id,
        typeId: spawn.type,
        x: position.x,
        y: position.y,
        angle: ((spawn.facingDeg ?? 0) * Math.PI) / 180,
        health: definition.health,
        alive: true,
        cooldownRemaining: 0,
        wakeTime: 0
      };
    });

    const pickups = levelDef.pickups.map((spawn) => createPickupState(spawn, this.cellCenter(spawn.x, spawn.y)));

    return {
      level,
      player,
      weapon: {
        currentId: "ember_wand",
        unlocked: ["ember_wand"],
        cooldownRemaining: 0
      },
      enemies,
      projectiles: [],
      pickups,
      messages: [
        {
          text: levelDef.briefing,
          ttl: 6
        }
      ],
      levelComplete: false,
      killCount: 0,
      totalKills: enemies.length,
      secretsFound: 0,
      totalSecrets: level.secretsTotal,
      elapsedTime: 0
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

  private updatePlayerMovement(dt: number, input: InputFrame): void {
    const settingsSpeed = 1;
    const forwardX = Math.cos(this.state.player.angle);
    const forwardY = Math.sin(this.state.player.angle);
    const rightX = -forwardY;
    const rightY = forwardX;
    const rawX = forwardX * input.moveY + rightX * input.moveX;
    const rawY = forwardY * input.moveY + rightY * input.moveX;
    const length = length2(rawX, rawY);

    if (length < 0.0001) {
      return;
    }

    const velocity = (this.state.player.moveSpeed * settingsSpeed) / length;
    const nextX = this.state.player.x + rawX * velocity * dt;
    const nextY = this.state.player.y + rawY * velocity * dt;
    const radius = this.state.player.radius;
    const separated = this.resolveMotion(this.state.player.x, this.state.player.y, nextX, nextY, radius);
    this.state.player.x = separated.x;
    this.state.player.y = separated.y;
    this.state.player.bobPhase += dt * 9;
  }

  private updateWeaponCooldown(dt: number): void {
    this.state.weapon.cooldownRemaining = Math.max(0, this.state.weapon.cooldownRemaining - dt);
  }

  private trySwitchWeapon(slot: number): void {
    const definition = Array.from(this.content.weapons.values()).find((item) => item.slot === slot);
    if (!definition || !this.state.weapon.unlocked.includes(definition.id)) {
      return;
    }

    this.state.weapon.currentId = definition.id;
    this.pushMessage(`${definition.name} ready.`, 1.5);
  }

  private fireCurrentWeapon(): ShotEvent | null {
    if (this.state.weapon.cooldownRemaining > 0 || !this.state.player.alive) {
      return null;
    }

    const weapon = this.content.weapons.get(this.state.weapon.currentId);
    if (!weapon) {
      return null;
    }

    if (weapon.ammoType === "shards" && this.state.player.ammoShards < weapon.ammoPerShot) {
      this.pushMessage("Shard Caster is dry.", 1.2);
      return null;
    }

    this.state.weapon.cooldownRemaining = weapon.cooldown;
    if (weapon.ammoType === "shards") {
      this.state.player.ammoShards -= weapon.ammoPerShot;
    }

    if (weapon.fireMode === "hitscan") {
      const didHit = this.fireHitscan(weapon.range, weapon.damage);
      if (didHit) {
        this.pushMessage("Ember bolt burns true.", 0.7);
      }
      return { kind: "ember" };
    }

    const dx = Math.cos(this.state.player.angle);
    const dy = Math.sin(this.state.player.angle);
    this.state.projectiles.push({
      id: this.projectileId++,
      source: "player",
      ownerId: "player",
      x: this.state.player.x + dx * 0.55,
      y: this.state.player.y + dy * 0.55,
      dx,
      dy,
      speed: weapon.projectileSpeed,
      radius: 0.16,
      damage: weapon.damage,
      ttl: weapon.projectileLife,
      color: "#9ddaff"
    });
    return { kind: "shard" };
  }

  private fireHitscan(range: number, damage: number): boolean {
    const step = 0.18;
    const dx = Math.cos(this.state.player.angle);
    const dy = Math.sin(this.state.player.angle);
    for (let distance = 0; distance <= range; distance += step) {
      const sampleX = this.state.player.x + dx * distance;
      const sampleY = this.state.player.y + dy * distance;
      if (this.isWallAtWorld(sampleX, sampleY)) {
        return false;
      }

      for (const enemy of this.state.enemies) {
        if (!enemy.alive) {
          continue;
        }
        const definition = this.content.enemies.get(enemy.typeId);
        if (!definition) {
          continue;
        }
        if (distance2(sampleX, sampleY, enemy.x, enemy.y) <= definition.radius) {
          this.damageEnemy(enemy, damage);
          return true;
        }
      }
    }
    return false;
  }

  private updateEnemies(dt: number, events: SimulationEvents): void {
    for (const enemy of this.state.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const definition = this.content.enemies.get(enemy.typeId);
      if (!definition) {
        continue;
      }

      enemy.cooldownRemaining = Math.max(0, enemy.cooldownRemaining - dt);
      enemy.wakeTime = Math.max(0, enemy.wakeTime - dt);

      const dx = this.state.player.x - enemy.x;
      const dy = this.state.player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const hasLos = distance < definition.aggroRange && this.hasLineOfSight(enemy.x, enemy.y, this.state.player.x, this.state.player.y);

      if (hasLos) {
        enemy.wakeTime = 2.5;
      }

      if (enemy.wakeTime <= 0) {
        continue;
      }

      enemy.angle = Math.atan2(dy, dx);

      if (definition.attackType === "melee" && distance <= definition.attackRange && enemy.cooldownRemaining <= 0) {
        enemy.cooldownRemaining = definition.attackCooldown;
        this.damagePlayer(definition.attackDamage, events);
        continue;
      }

      if (
        definition.attackType === "projectile" &&
        distance <= definition.attackRange &&
        hasLos &&
        enemy.cooldownRemaining <= 0
      ) {
        enemy.cooldownRemaining = definition.attackCooldown;
        const norm = distance > 0.0001 ? 1 / distance : 0;
        this.state.projectiles.push({
          id: this.projectileId++,
          source: "enemy",
          ownerId: enemy.id,
          x: enemy.x + dx * norm * 0.5,
          y: enemy.y + dy * norm * 0.5,
          dx: dx * norm,
          dy: dy * norm,
          speed: definition.projectileSpeed,
          radius: 0.14,
          damage: definition.attackDamage,
          ttl: 2.6,
          color: enemy.typeId === "cinder_acolyte" ? "#ff8b57" : "#dadf8d"
        });
        continue;
      }

      const stopDistance = definition.attackType === "melee" ? definition.attackRange * 0.8 : definition.attackRange * 0.6;
      if (distance > stopDistance) {
        const stepX = (dx / Math.max(distance, 0.0001)) * definition.moveSpeed * dt;
        const stepY = (dy / Math.max(distance, 0.0001)) * definition.moveSpeed * dt;
        const next = this.resolveMotion(enemy.x, enemy.y, enemy.x + stepX, enemy.y + stepY, definition.radius * 0.75);
        enemy.x = next.x;
        enemy.y = next.y;
      }
    }
  }

  private updateProjectiles(dt: number, events: SimulationEvents): void {
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

      if (projectile.source === "player") {
        let hit = false;
        for (const enemy of this.state.enemies) {
          if (!enemy.alive) {
            continue;
          }
          const definition = this.content.enemies.get(enemy.typeId);
          if (!definition) {
            continue;
          }
          if (distance2(projectile.x, projectile.y, enemy.x, enemy.y) <= definition.radius + projectile.radius) {
            this.damageEnemy(enemy, projectile.damage);
            hit = true;
            break;
          }
        }

        if (hit) {
          this.state.projectiles.splice(index, 1);
        }
      } else if (
        distance2(projectile.x, projectile.y, this.state.player.x, this.state.player.y) <=
        this.state.player.radius + projectile.radius
      ) {
        this.damagePlayer(projectile.damage, events);
        this.state.projectiles.splice(index, 1);
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

      switch (pickup.kind) {
        case "health":
          this.state.player.health = clamp(
            this.state.player.health + pickup.amount,
            0,
            this.state.player.maxHealth
          );
          this.pushMessage(`Recovered ${pickup.amount} health.`, 1.5);
          break;
        case "ammo":
          this.state.player.ammoShards += pickup.amount;
          this.pushMessage(`Recovered ${pickup.amount} shards.`, 1.5);
          break;
        case "key":
          if (pickup.keyId && !this.state.player.keys.includes(pickup.keyId)) {
            this.state.player.keys.push(pickup.keyId);
            this.pushMessage("Ember seal claimed.", 2);
          }
          break;
        case "weapon":
          if (pickup.weaponId && !this.state.weapon.unlocked.includes(pickup.weaponId)) {
            this.state.weapon.unlocked.push(pickup.weaponId);
            this.state.weapon.currentId = pickup.weaponId;
            this.state.player.ammoShards += 6;
            this.pushMessage("Shard Caster unearthed.", 2);
          }
          break;
      }
    }
  }

  private checkExitReached(): void {
    for (const exit of this.state.level.exits) {
      const center = this.cellCenter(exit.x, exit.y);
      if (distance2(this.state.player.x, this.state.player.y, center.x, center.y) <= 0.9) {
        this.state.levelComplete = true;
        this.pushMessage("Relic secured. Vertical slice complete.", 12);
        return;
      }
    }
  }

  private useInFront(): { doorOpened: boolean; secretOpened: boolean } {
    const useDistance = this.state.level.cellSize * 0.6;
    const sampleX = this.state.player.x + Math.cos(this.state.player.angle) * useDistance;
    const sampleY = this.state.player.y + Math.sin(this.state.player.angle) * useDistance;
    const cell = this.worldToCell(sampleX, sampleY);
    const door = this.state.level.doors.find((entry) => entry.x === cell.x && entry.y === cell.y && !entry.open);

    if (!door) {
      return { doorOpened: false, secretOpened: false };
    }

    if (door.keyId && !this.state.player.keys.includes(door.keyId)) {
      this.pushMessage("The ember seal is required.", 1.5);
      return { doorOpened: false, secretOpened: false };
    }

    door.open = true;
    if (door.secret) {
      this.state.secretsFound += 1;
      this.pushMessage("A hidden ossuary opens.", 2.2);
      return { doorOpened: true, secretOpened: true };
    }

    this.pushMessage("The gate grinds open.", 1.5);
    return { doorOpened: true, secretOpened: false };
  }

  private damageEnemy(enemy: EnemyState, damage: number): void {
    enemy.health -= damage;
    enemy.wakeTime = 3;
    if (enemy.health <= 0 && enemy.alive) {
      enemy.alive = false;
      this.state.killCount += 1;
      this.pushMessage("An enemy falls.", 0.8);
    }
  }

  private damagePlayer(amount: number, events: SimulationEvents): void {
    this.state.player.health -= amount;
    events.damageTaken = true;
    if (this.state.player.health <= 0 && this.state.player.alive) {
      this.state.player.health = 0;
      this.state.player.alive = false;
      this.pushMessage("You have fallen. Restart the rite.", 8);
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
    const steps = Math.ceil(distance / 0.4);
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

    if (this.state.level.grid[cellY][cellX] === "#") {
      return true;
    }

    const door = this.state.level.doors.find((entry) => entry.x === cellX && entry.y === cellY);
    return door ? !door.open : false;
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
}

function createDoorState(spawn: DoorSpawn): DoorState {
  return {
    id: spawn.id,
    x: spawn.x,
    y: spawn.y,
    keyId: spawn.keyId,
    secret: Boolean(spawn.secret),
    open: Boolean(spawn.initiallyOpen)
  };
}

function createPickupState(
  spawn: PickupSpawn,
  position: { x: number; y: number }
): PickupState {
  return {
    id: spawn.id,
    kind: spawn.kind,
    x: position.x,
    y: position.y,
    amount: spawn.amount ?? 0,
    keyId: spawn.keyId,
    weaponId: spawn.weaponId,
    collected: false
  };
}

export interface ShotEvent {
  kind: "ember" | "shard";
}

export interface SimulationEvents {
  shot: ShotEvent | null;
  pickup: boolean;
  damageTaken: boolean;
  doorOpened: boolean;
  secretOpened: boolean;
}
