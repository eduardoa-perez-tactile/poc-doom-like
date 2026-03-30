import type {
  FloorRegionDef,
  FloorRegionId,
  LevelScriptRuntimeState
} from "../script/LevelScriptTypes";
import { cellKey } from "../script/LevelScriptUtils";

interface CellFloorBinding {
  regionId: FloorRegionId;
  passableWhenHeightAtLeast: number;
}

export class FloorRegionSystem {
  private readonly regionsById = new Map<FloorRegionId, FloorRegionDef>();
  private readonly bindingByCell = new Map<string, CellFloorBinding>();

  constructor(floorRegions: FloorRegionDef[]) {
    for (const region of floorRegions) {
      this.regionsById.set(region.id, region);
      for (const cell of region.blockingCells ?? []) {
        this.bindingByCell.set(cellKey(cell.x, cell.y), {
          regionId: region.id,
          passableWhenHeightAtLeast: region.passableWhenHeightAtLeast ?? 0
        });
      }
    }
  }

  getDefinition(id: FloorRegionId): FloorRegionDef | undefined {
    return this.regionsById.get(id);
  }

  isCellBlocked(runtime: LevelScriptRuntimeState, cellX: number, cellY: number): boolean {
    const binding = this.bindingByCell.get(cellKey(cellX, cellY));
    if (!binding) {
      return false;
    }

    const height = runtime.floorRegions[binding.regionId]?.height ?? 0;
    return height < binding.passableWhenHeightAtLeast;
  }

  setHeight(runtime: LevelScriptRuntimeState, regionId: FloorRegionId, height: number): boolean {
    const state = runtime.floorRegions[regionId];
    if (!state || state.height === height) {
      return false;
    }
    state.height = height;
    return true;
  }

  raise(runtime: LevelScriptRuntimeState, regionId: FloorRegionId, delta: number): boolean {
    const state = runtime.floorRegions[regionId];
    if (!state) {
      return false;
    }
    state.height += delta;
    return true;
  }

  lower(runtime: LevelScriptRuntimeState, regionId: FloorRegionId, delta: number): boolean {
    const state = runtime.floorRegions[regionId];
    if (!state) {
      return false;
    }
    state.height -= delta;
    return true;
  }
}
