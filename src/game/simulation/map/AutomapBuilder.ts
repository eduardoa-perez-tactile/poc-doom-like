import type { ContentDatabase, LevelDefinition } from "../../content/types";
import { cellKey } from "../script/LevelScriptUtils";
import type {
  ConditionDef,
  DoorDef,
  LevelScriptDef,
  ScriptRegionDef
} from "../script/LevelScriptTypes";
import type {
  LevelAutomapMarkerDef,
  LevelMapBuildResult,
  LevelMapDef,
  MapLineDef,
  MapMarkerDef
} from "./AutomapTypes";

const DEV = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

interface MutableBuildState {
  lines: MapLineDef[];
  markers: MapMarkerDef[];
  lineIdsByDiscoveryCell: Record<string, string[]>;
  markerIdsByDiscoveryCell: Record<string, string[]>;
}

interface DoorOrientation {
  axis: "horizontal" | "vertical";
  adjacentDiscoveryCells: { x: number; y: number }[];
}

export class AutomapBuilder {
  build(content: ContentDatabase): LevelMapBuildResult {
    const level = content.level;
    const script = level.script;
    const state: MutableBuildState = {
      lines: [],
      markers: [],
      lineIdsByDiscoveryCell: {},
      markerIdsByDiscoveryCell: {}
    };

    const doorCellToId = new Map<string, string>();
    const doorById = new Map<string, DoorDef>();
    for (const door of script?.doors ?? []) {
      doorById.set(door.id, door);
      for (const cell of door.gridCells) {
        doorCellToId.set(cellKey(cell.x, cell.y), door.id);
      }
    }

    this.validateMetadata(level, content, doorById);
    this.addWallLines(level, doorCellToId, state);
    this.addDoorLines(level, script, state);
    this.addSecretMarkers(level, script, state);
    this.addSwitchMarkers(level, script, state);
    this.addTeleporterMarkers(level, script, state);
    this.addKeyMarkers(level, content, state);
    this.addExitMarkers(level, script, state);
    this.addAuthoredMarkers(level, state);
    this.validateUniqueIds(level.id, state.lines, state.markers);

    const bounds = this.computeBounds(level);
    const definition: LevelMapDef = {
      lines: state.lines,
      markers: state.markers,
      ...bounds
    };

    return {
      definition,
      cache: {
        lineIdsByDiscoveryCell: state.lineIdsByDiscoveryCell,
        markerIdsByDiscoveryCell: state.markerIdsByDiscoveryCell
      }
    };
  }

  private addWallLines(
    level: LevelDefinition,
    doorCellToId: Map<string, string>,
    state: MutableBuildState
  ): void {
    const half = level.cellSize * 0.5;
    const directions = [
      { dx: 0, dy: -1, line: (cx: number, cy: number) => ({ ax: cx - half, ay: cy - half, bx: cx + half, by: cy - half }) },
      { dx: 1, dy: 0, line: (cx: number, cy: number) => ({ ax: cx + half, ay: cy - half, bx: cx + half, by: cy + half }) },
      { dx: 0, dy: 1, line: (cx: number, cy: number) => ({ ax: cx + half, ay: cy + half, bx: cx - half, by: cy + half }) },
      { dx: -1, dy: 0, line: (cx: number, cy: number) => ({ ax: cx - half, ay: cy + half, bx: cx - half, by: cy - half }) }
    ];

    for (let y = 0; y < level.grid.length; y += 1) {
      for (let x = 0; x < level.grid[y].length; x += 1) {
        if (isSolidGlyph(level.grid[y][x])) {
          continue;
        }

        const center = this.cellToWorld(level, x, y);
        for (const direction of directions) {
          const neighborX = x + direction.dx;
          const neighborY = y + direction.dy;
          if (
            neighborY >= 0 &&
            neighborY < level.grid.length &&
            neighborX >= 0 &&
            neighborX < level.grid[neighborY].length &&
            !isSolidGlyph(level.grid[neighborY][neighborX])
          ) {
            continue;
          }
          if (doorCellToId.has(cellKey(neighborX, neighborY))) {
            continue;
          }

          const segment = direction.line(center.x, center.y);
          this.addLine(
            state,
            {
              id: `wall:${x}:${y}:${direction.dx},${direction.dy}`,
              kind: "wall",
              revealOnFullMap: true,
              ...segment
            },
            [{ x, y }]
          );
        }
      }
    }
  }

  private addDoorLines(
    level: LevelDefinition,
    script: LevelScriptDef | undefined,
    state: MutableBuildState
  ): void {
    const exitDoorIds = this.collectExitDoorIds(script);
    for (const door of script?.doors ?? []) {
      const orientation = this.resolveDoorOrientation(level, door);
      const doorKind =
        level.map?.doorKinds?.[door.id] ??
        (exitDoorIds.has(door.id) ? "exit" : "door");

      const xs = door.gridCells.map((cell) => cell.x);
      const ys = door.gridCells.map((cell) => cell.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const half = level.cellSize * 0.5;

      const line =
        orientation.axis === "horizontal"
          ? {
              ax: (minX * level.cellSize) - half,
              ay: minY * level.cellSize,
              bx: (maxX * level.cellSize) + half,
              by: minY * level.cellSize
            }
          : {
              ax: minX * level.cellSize,
              ay: (minY * level.cellSize) - half,
              bx: minX * level.cellSize,
              by: (maxY * level.cellSize) + half
            };

      this.addLine(
        state,
        {
          id: `door:${door.id}`,
          kind: doorKind,
          doorId: door.id,
          revealOnFullMap: true,
          ...line
        },
        orientation.adjacentDiscoveryCells
      );
    }
  }

  private addSecretMarkers(
    level: LevelDefinition,
    script: LevelScriptDef | undefined,
    state: MutableBuildState
  ): void {
    for (const secret of script?.secrets ?? []) {
      const world = this.rectCenterToWorld(level, secret.region);
      this.addMarker(
        state,
        {
          id: `secret:${secret.id}`,
          kind: "secret",
          x: world.x,
          y: world.y,
          visibleWhen: "discovered",
          secretId: secret.id,
          revealOnFullMap: true
        },
        [{ x: Math.round(world.x / level.cellSize), y: Math.round(world.y / level.cellSize) }]
      );
    }
  }

  private addSwitchMarkers(
    level: LevelDefinition,
    script: LevelScriptDef | undefined,
    state: MutableBuildState
  ): void {
    for (const switchDef of script?.switches ?? []) {
      const world = this.cellToWorld(level, switchDef.cell.x, switchDef.cell.y);
      this.addMarker(
        state,
        {
          id: `switch:${switchDef.id}`,
          kind: "switch",
          x: world.x,
          y: world.y,
          visibleWhen: "discovered",
          switchId: switchDef.id,
          revealOnFullMap: true
        },
        [switchDef.cell]
      );
    }
  }

  private addTeleporterMarkers(
    level: LevelDefinition,
    script: LevelScriptDef | undefined,
    state: MutableBuildState
  ): void {
    for (const teleporter of script?.teleporters ?? []) {
      const world = this.rectCenterToWorld(level, teleporter.fromRegion);
      this.addMarker(
        state,
        {
          id: `teleporter:${teleporter.id}`,
          kind: "teleporter",
          x: world.x,
          y: world.y,
          visibleWhen: "discovered",
          teleporterId: teleporter.id,
          revealOnFullMap: true
        },
        [{ x: Math.round(world.x / level.cellSize), y: Math.round(world.y / level.cellSize) }]
      );
    }
  }

  private addKeyMarkers(
    level: LevelDefinition,
    content: ContentDatabase,
    state: MutableBuildState
  ): void {
    for (const pickup of level.pickups) {
      const definition = content.pickupDefs.get(pickup.defId);
      if (definition?.kind !== "key") {
        continue;
      }
      const world = this.cellToWorld(level, pickup.x, pickup.y);
      const keyId = definition.grants?.keys?.[0] ?? definition.id;
      this.addMarker(
        state,
        {
          id: `pickup:${pickup.id}`,
          kind: "key",
          x: world.x,
          y: world.y,
          visibleWhen: "discovered",
          keyId,
          pickupDefId: definition.id,
          pickupEntityId: pickup.id,
          revealOnFullMap: true
        },
        [{ x: pickup.x, y: pickup.y }]
      );
    }
  }

  private addExitMarkers(
    level: LevelDefinition,
    script: LevelScriptDef | undefined,
    state: MutableBuildState
  ): void {
    if (!script) {
      return;
    }

    const regionsById = new Map<string, ScriptRegionDef>((script.regions ?? []).map((region) => [region.id, region]));
    for (const trigger of script.triggers ?? []) {
      if (!trigger.actions.some((action) => action.kind === "complete_level")) {
        continue;
      }
      const rect = trigger.region ?? (trigger.regionId ? regionsById.get(trigger.regionId)?.rect : undefined);
      if (!rect) {
        continue;
      }
      const world = this.rectCenterToWorld(level, rect);
      const flagId = trigger.conditions?.find((condition): condition is Extract<ConditionDef, { kind: "flag_set" }> =>
        condition.kind === "flag_set"
      )?.flag;

      this.addMarker(
        state,
        {
          id: `exit:${trigger.id}`,
          kind: "exit",
          x: world.x,
          y: world.y,
          visibleWhen: "discovered",
          flagId,
          revealOnFullMap: true
        },
        [{ x: Math.round(world.x / level.cellSize), y: Math.round(world.y / level.cellSize) }]
      );
    }
  }

  private addAuthoredMarkers(level: LevelDefinition, state: MutableBuildState): void {
    for (const marker of level.map?.markers ?? []) {
      const x =
        marker.cell !== undefined ? marker.cell.x * level.cellSize : marker.x;
      const y =
        marker.cell !== undefined ? marker.cell.y * level.cellSize : marker.y;
      if (x === undefined || y === undefined) {
        this.warnOrThrow(
          `Automap marker '${marker.id}' in level '${level.id}' is missing coordinates.`
        );
        continue;
      }

      this.addMarker(
        state,
        {
          id: marker.id,
          kind: marker.kind,
          x,
          y,
          visibleWhen: marker.visibleWhen ?? "discovered",
          keyId: marker.keyId,
          switchId: marker.switchId,
          teleporterId: marker.teleporterId,
          secretId: marker.secretId,
          pickupDefId: marker.pickupDefId,
          pickupEntityId: marker.pickupEntityId,
          flagId: marker.flagId,
          revealOnFullMap: marker.revealOnFullMap ?? marker.visibleWhen !== "never",
          hideOnMapAlways: marker.hideOnMapAlways
        },
        marker.cell ? [marker.cell] : [{ x: Math.round(x / level.cellSize), y: Math.round(y / level.cellSize) }]
      );
    }
  }

  private addLine(
    state: MutableBuildState,
    line: MapLineDef,
    discoveryCells: { x: number; y: number }[]
  ): void {
    state.lines.push(line);
    for (const cell of discoveryCells) {
      this.pushDiscoveryId(state.lineIdsByDiscoveryCell, cell, line.id);
    }
  }

  private addMarker(
    state: MutableBuildState,
    marker: MapMarkerDef,
    discoveryCells: { x: number; y: number }[]
  ): void {
    state.markers.push(marker);
    for (const cell of discoveryCells) {
      this.pushDiscoveryId(state.markerIdsByDiscoveryCell, cell, marker.id);
    }
  }

  private pushDiscoveryId(
    target: Record<string, string[]>,
    cell: { x: number; y: number },
    id: string
  ): void {
    const key = cellKey(cell.x, cell.y);
    if (!target[key]) {
      target[key] = [id];
      return;
    }
    if (!target[key].includes(id)) {
      target[key].push(id);
    }
  }

  private resolveDoorOrientation(level: LevelDefinition, door: DoorDef): DoorOrientation {
    const uniqueXs = new Set(door.gridCells.map((cell) => cell.x));
    const uniqueYs = new Set(door.gridCells.map((cell) => cell.y));
    if (uniqueYs.size === 1) {
      return {
        axis: "horizontal",
        adjacentDiscoveryCells: door.gridCells.flatMap((cell) => this.walkableNeighbors(level, cell.x, cell.y, [
          { x: cell.x, y: cell.y - 1 },
          { x: cell.x, y: cell.y + 1 }
        ]))
      };
    }
    if (uniqueXs.size === 1) {
      return {
        axis: "vertical",
        adjacentDiscoveryCells: door.gridCells.flatMap((cell) => this.walkableNeighbors(level, cell.x, cell.y, [
          { x: cell.x - 1, y: cell.y },
          { x: cell.x + 1, y: cell.y }
        ]))
      };
    }

    const pivot = door.gridCells[0];
    const horizontalNeighbors = this.walkableNeighbors(level, pivot.x, pivot.y, [
      { x: pivot.x, y: pivot.y - 1 },
      { x: pivot.x, y: pivot.y + 1 }
    ]);
    if (horizontalNeighbors.length > 0) {
      return {
        axis: "horizontal",
        adjacentDiscoveryCells: horizontalNeighbors
      };
    }

    return {
      axis: "vertical",
      adjacentDiscoveryCells: this.walkableNeighbors(level, pivot.x, pivot.y, [
        { x: pivot.x - 1, y: pivot.y },
        { x: pivot.x + 1, y: pivot.y }
      ])
    };
  }

  private walkableNeighbors(
    level: LevelDefinition,
    _cellX: number,
    _cellY: number,
    candidates: { x: number; y: number }[]
  ): { x: number; y: number }[] {
    const results: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (!isWalkableCell(level, candidate.x, candidate.y)) {
        continue;
      }
      const key = cellKey(candidate.x, candidate.y);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(candidate);
    }
    return results;
  }

  private collectExitDoorIds(script: LevelScriptDef | undefined): Set<string> {
    const exitDoorIds = new Set<string>();
    for (const trigger of script?.triggers ?? []) {
      if (!trigger.actions.some((action) => action.kind === "complete_level")) {
        continue;
      }
      for (const condition of trigger.conditions ?? []) {
        if (condition.kind === "door_open") {
          exitDoorIds.add(condition.doorId);
        }
      }
    }
    return exitDoorIds;
  }

  private validateMetadata(
    level: LevelDefinition,
    content: ContentDatabase,
    doorById: Map<string, DoorDef>
  ): void {
    const script = level.script;
    const teleporterIds = new Set((script?.teleporters ?? []).map((teleporter) => teleporter.id));
    const secretIds = new Set((script?.secrets ?? []).map((secret) => secret.id));
    const switchIds = new Set((script?.switches ?? []).map((switchDef) => switchDef.id));
    const pickupEntityIds = new Set(level.pickups.map((pickup) => pickup.id));

    for (const doorId of Object.keys(level.map?.doorKinds ?? {})) {
      if (!doorById.has(doorId)) {
        this.warnOrThrow(
          `Automap door override references unknown door '${doorId}' in level '${level.id}'.`
        );
      }
    }

    for (const marker of level.map?.markers ?? []) {
      this.validateMarkerReference(level.id, "switch", marker, marker.switchId, switchIds);
      this.validateMarkerReference(level.id, "teleporter", marker, marker.teleporterId, teleporterIds);
      this.validateMarkerReference(level.id, "secret", marker, marker.secretId, secretIds);
      this.validateMarkerReference(level.id, "pickup entity", marker, marker.pickupEntityId, pickupEntityIds);
      if (marker.pickupDefId && !content.pickupDefs.has(marker.pickupDefId)) {
        this.warnOrThrow(
          `Automap marker '${marker.id}' references unknown pickup def '${marker.pickupDefId}' in level '${level.id}'.`
        );
      }
    }
  }

  private validateMarkerReference(
    levelId: string,
    label: string,
    marker: LevelAutomapMarkerDef,
    value: string | undefined,
    ids: Set<string>
  ): void {
    if (!value || ids.has(value)) {
      return;
    }
    this.warnOrThrow(
      `Automap marker '${marker.id}' references unknown ${label} '${value}' in level '${levelId}'.`
    );
  }

  private validateUniqueIds(levelId: string, lines: MapLineDef[], markers: MapMarkerDef[]): void {
    const seen = new Set<string>();
    for (const line of lines) {
      if (seen.has(line.id)) {
        throw new Error(`Duplicate automap line id '${line.id}' in level '${levelId}'.`);
      }
      seen.add(line.id);
    }
    for (const marker of markers) {
      if (seen.has(marker.id)) {
        throw new Error(`Duplicate automap marker id '${marker.id}' in level '${levelId}'.`);
      }
      seen.add(marker.id);
    }
  }

  private computeBounds(level: LevelDefinition): Pick<LevelMapDef, "minX" | "minY" | "maxX" | "maxY"> {
    const width = level.grid[0]?.length ?? 0;
    const height = level.grid.length;
    const half = level.cellSize * 0.5;
    return {
      minX: -half,
      minY: -half,
      maxX: (width - 1) * level.cellSize + half,
      maxY: (height - 1) * level.cellSize + half
    };
  }

  private cellToWorld(level: LevelDefinition, cellX: number, cellY: number): { x: number; y: number } {
    return {
      x: cellX * level.cellSize,
      y: cellY * level.cellSize
    };
  }

  private rectCenterToWorld(
    level: LevelDefinition,
    rect: { x: number; y: number; w: number; h: number }
  ): { x: number; y: number } {
    return {
      x: (rect.x + (rect.w - 1) * 0.5) * level.cellSize,
      y: (rect.y + (rect.h - 1) * 0.5) * level.cellSize
    };
  }

  private warnOrThrow(message: string): void {
    if (DEV) {
      throw new Error(message);
    }
    console.warn(message);
  }
}

function isSolidGlyph(cell: string | undefined): boolean {
  return cell !== undefined && cell !== ".";
}

function isWalkableCell(level: LevelDefinition, cellX: number, cellY: number): boolean {
  if (cellY < 0 || cellY >= level.grid.length || cellX < 0 || cellX >= level.grid[cellY].length) {
    return false;
  }
  return level.grid[cellY][cellX] === ".";
}
