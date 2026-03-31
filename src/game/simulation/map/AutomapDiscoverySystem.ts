import { cellKey, worldToCell } from "../script/LevelScriptUtils";
import type { LevelState, PlayerState } from "../../core/types";
import type { AutomapRuntimeState, LevelMapBuildCache, LevelMapDef } from "./AutomapTypes";

const DISCOVERY_RADIUS_CELLS = 1;

export class AutomapDiscoverySystem {
  update(
    runtime: AutomapRuntimeState,
    level: LevelState,
    player: PlayerState,
    definition: LevelMapDef,
    cache: LevelMapBuildCache
  ): void {
    const playerCell = worldToCell(level, player.x, player.y);
    for (let offsetY = -DISCOVERY_RADIUS_CELLS; offsetY <= DISCOVERY_RADIUS_CELLS; offsetY += 1) {
      for (let offsetX = -DISCOVERY_RADIUS_CELLS; offsetX <= DISCOVERY_RADIUS_CELLS; offsetX += 1) {
        const key = cellKey(playerCell.x + offsetX, playerCell.y + offsetY);
        for (const lineId of cache.lineIdsByDiscoveryCell[key] ?? []) {
          runtime.discoveredLineIds[lineId] = true;
        }
        for (const markerId of cache.markerIdsByDiscoveryCell[key] ?? []) {
          runtime.discoveredMarkerIds[markerId] = true;
        }
      }
    }

    for (const line of definition.lines) {
      if (line.discoveredByDefault) {
        runtime.discoveredLineIds[line.id] = true;
      }
    }
    for (const marker of definition.markers) {
      if (marker.discoveredByDefault) {
        runtime.discoveredMarkerIds[marker.id] = true;
      }
    }
  }
}
