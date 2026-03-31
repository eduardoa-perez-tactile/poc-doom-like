import type { LevelScriptRuntimeState, Vec2, DoorDef, DoorId } from "../script/LevelScriptTypes";
import { cellKey, normalizeKeyId } from "../script/LevelScriptUtils";

export interface DoorUseContext {
  playerKeys: string[];
  pushMessage(message: string, ttl?: number): void;
  debug(message: string): void;
}

export class DoorSystem {
  private readonly doorsById = new Map<DoorId, DoorDef>();
  private readonly doorByCell = new Map<string, DoorDef>();

  constructor(doors: DoorDef[]) {
    for (const door of doors) {
      this.doorsById.set(door.id, door);
      for (const cell of door.gridCells) {
        this.doorByCell.set(cellKey(cell.x, cell.y), door);
      }
    }
  }

  getDefinition(id: DoorId): DoorDef | undefined {
    return this.doorsById.get(id);
  }

  getDoorAtCell(cell: Vec2): DoorDef | undefined {
    return this.doorByCell.get(cellKey(cell.x, cell.y));
  }

  hasDoorAtCell(cellX: number, cellY: number): boolean {
    return this.doorByCell.has(cellKey(cellX, cellY));
  }

  isCellBlocked(runtime: LevelScriptRuntimeState, cellX: number, cellY: number): boolean {
    const door = this.doorByCell.get(cellKey(cellX, cellY));
    if (!door) {
      return false;
    }
    return !runtime.doors[door.id]?.isOpen;
  }

  setOpen(runtime: LevelScriptRuntimeState, doorId: DoorId, isOpen: boolean): boolean {
    const state = runtime.doors[doorId];
    if (!state || state.isOpen === isOpen) {
      return false;
    }
    state.isOpen = isOpen;
    return true;
  }

  unlock(runtime: LevelScriptRuntimeState, doorId: DoorId): boolean {
    const state = runtime.doors[doorId];
    if (!state || !state.isLocked) {
      return false;
    }
    state.isLocked = false;
    return true;
  }

  toggle(runtime: LevelScriptRuntimeState, doorId: DoorId): boolean {
    const state = runtime.doors[doorId];
    if (!state) {
      return false;
    }
    state.isOpen = !state.isOpen;
    return true;
  }

  tryUseDoor(runtime: LevelScriptRuntimeState, cell: Vec2, context: DoorUseContext): boolean {
    const door = this.getDoorAtCell(cell);
    if (!door) {
      return false;
    }

    const state = runtime.doors[door.id];
    if (!state) {
      return false;
    }

    if (state.isLocked) {
      const requiredKeyId = door.requiredKeyId ? normalizeKeyId(door.requiredKeyId) : null;
      if (!requiredKeyId) {
        context.pushMessage("The way is sealed.", 1.2);
        return true;
      }

      const hasKey = context.playerKeys.some(
        (ownedKey) => normalizeKeyId(ownedKey) === requiredKeyId
      );
      if (!hasKey) {
        context.pushMessage(
          `${requiredKeyId.replaceAll("_", " ")} is required.`,
          1.2
        );
        return true;
      }
      state.isLocked = false;
      context.debug(`Door '${door.id}' unlocked by use interaction.`);
    }

    if (!state.isOpen) {
      state.isOpen = true;
      context.debug(`Door '${door.id}' opened by use interaction.`);
    }
    return true;
  }
}
