import type { EnemyState, LevelState, PlayerState } from "../../core/types";
import type { Rect, Vec2 } from "./LevelScriptTypes";

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function rectContainsCell(rect: Rect, cell: Vec2): boolean {
  return (
    cell.x >= rect.x &&
    cell.y >= rect.y &&
    cell.x < rect.x + rect.w &&
    cell.y < rect.y + rect.h
  );
}

export function worldToCell(level: LevelState, worldX: number, worldY: number): Vec2 {
  const half = level.cellSize * 0.5;
  return {
    x: Math.floor((worldX + half) / level.cellSize),
    y: Math.floor((worldY + half) / level.cellSize)
  };
}

export function cellToWorldCenter(level: LevelState, cell: Vec2): Vec2 {
  return {
    x: cell.x * level.cellSize,
    y: cell.y * level.cellSize
  };
}

export function playerCell(level: LevelState, player: PlayerState): Vec2 {
  return worldToCell(level, player.x, player.y);
}

export function enemySpawnCell(level: LevelState, enemy: EnemyState): Vec2 {
  return worldToCell(level, enemy.spawnX, enemy.spawnY);
}

export function normalizeKeyId(keyId: string): string {
  return keyId.trim().toUpperCase();
}
