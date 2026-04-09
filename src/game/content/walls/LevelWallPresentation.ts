import type { LevelDefinition, WallSemanticKind } from "../types";
import type {
  DoorDef,
  SecretDef,
  SwitchDef,
  TeleporterDef,
  Vec2
} from "../../simulation/script/LevelScriptTypes";
import {
  getDoorVisualProfile,
  getSurfaceVisualProfile,
  getWallVisualProfile,
  hasDoorVisualProfile,
  hasSurfaceVisualProfile,
  hasWallVisualProfile,
  resolveLegacyWallVisualProfileId,
  type DoorVisualProfile,
  type SurfaceVisualProfile,
  type WallVisualProfile
} from "./WallProfiles";

const DEV = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

export interface ResolvedWallCellPresentation {
  semantic: WallSemanticKind;
  profile: WallVisualProfile;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function isSolidCell(level: LevelDefinition, x: number, y: number): boolean {
  return level.grid[y]?.[x] !== "." && level.grid[y]?.[x] !== undefined;
}

function inBounds(level: LevelDefinition, x: number, y: number): boolean {
  return y >= 0 && y < level.grid.length && x >= 0 && x < (level.grid[0]?.length ?? 0);
}

function defaultWallProfileIdForSemantic(semantic: WallSemanticKind): string {
  switch (semantic) {
    case "major_wall":
      return "major_structural_stone";
    case "secret_wall":
      return "secret_occult_hint";
    case "gate":
      return "gate_barrier_wall";
    case "landmark":
      return "landmark_skull_sanctum";
    case "hazard":
      return "hazard_wall";
    case "wall":
    default:
      return "structural_stone_wall";
  }
}

function fallbackStructuralProfileId(level: LevelDefinition, x: number, y: number): string {
  if (x === 0 || y === 0 || x === (level.grid[0]?.length ?? 0) - 1 || y === level.grid.length - 1) {
    return "major_structural_stone";
  }

  const neighbors = [
    level.grid[y - 1]?.[x],
    level.grid[y + 1]?.[x],
    level.grid[y]?.[x - 1],
    level.grid[y]?.[x + 1]
  ];
  const wallNeighborCount = neighbors.reduce((count, neighbor) => count + Number(neighbor !== "." && neighbor !== undefined), 0);
  return wallNeighborCount >= 3 ? "structural_brick_wall" : "structural_stone_wall";
}

function defaultDoorProfileId(level: LevelDefinition, door: DoorDef): string {
  const mapKind = level.map?.doorKinds?.[door.id];
  if (mapKind === "secret") {
    return "door_secret_occult";
  }
  if (mapKind === "exit") {
    return "door_exit_seal";
  }

  const normalizedKey = door.requiredKeyId?.toUpperCase() ?? null;
  if (normalizedKey?.includes("GREEN")) {
    return "door_locked_green";
  }
  if (normalizedKey?.includes("YELLOW")) {
    return "door_locked_yellow";
  }
  if (normalizedKey?.includes("BLUE")) {
    return "door_locked_blue";
  }

  if (door.locked) {
    return "door_occult_reinforced";
  }
  return "door_wood_reinforced";
}

export class LevelWallPresentationResolver {
  private readonly overrideByCell = new Map<string, { semantic: WallSemanticKind; profileId?: string }>();
  private readonly secretHintByCell = new Map<string, string | undefined>();

  constructor(private readonly level: LevelDefinition) {
    for (const override of level.wallSemantics?.cells ?? []) {
      this.overrideByCell.set(cellKey(override.x, override.y), {
        semantic: override.semantic,
        profileId: override.visualProfileId
      });
    }

    for (const secret of level.script?.secrets ?? []) {
      for (const hintCell of secret.hintCells ?? []) {
        this.secretHintByCell.set(cellKey(hintCell.x, hintCell.y), secret.hintVisualProfileId);
      }
    }
  }

  resolveWallCell(x: number, y: number): ResolvedWallCellPresentation {
    const explicit = this.overrideByCell.get(cellKey(x, y));
    if (explicit) {
      return {
        semantic: explicit.semantic,
        profile: getWallVisualProfile(explicit.profileId ?? defaultWallProfileIdForSemantic(explicit.semantic))
      };
    }

    const secretHintProfileId = this.secretHintByCell.get(cellKey(x, y));
    if (secretHintProfileId !== undefined) {
      return {
        semantic: "secret_wall",
        profile: getWallVisualProfile(secretHintProfileId ?? "secret_occult_hint")
      };
    }

    const glyphProfileId = resolveLegacyWallVisualProfileId(this.level.wallTypes?.[this.level.grid[y]?.[x] ?? ""]);
    return {
      semantic: glyphProfileId === "major_structural_stone" ? "major_wall" : "wall",
      profile: getWallVisualProfile(glyphProfileId ?? fallbackStructuralProfileId(this.level, x, y))
    };
  }

  resolveDoorProfile(door: DoorDef): DoorVisualProfile {
    return getDoorVisualProfile(door.visualProfileId ?? defaultDoorProfileId(this.level, door));
  }

  resolveSwitchProfile(switchDef: SwitchDef): SurfaceVisualProfile {
    return getSurfaceVisualProfile(switchDef.visualProfileId ?? "switch_rune_panel");
  }

  resolveTeleporterProfile(teleporter: TeleporterDef): SurfaceVisualProfile {
    return getSurfaceVisualProfile(teleporter.visualProfileId ?? "teleporter_arcane_pad");
  }

  resolveSecretHintProfile(secret: SecretDef): WallVisualProfile {
    return getWallVisualProfile(secret.hintVisualProfileId ?? "secret_occult_hint");
  }

  describeAssignments(): string[] {
    const lines: string[] = [];
    for (const override of this.level.wallSemantics?.cells ?? []) {
      lines.push(
        `cell(${override.x},${override.y}) => ${override.semantic}:${override.visualProfileId ?? defaultWallProfileIdForSemantic(override.semantic)}`
      );
    }
    for (const secret of this.level.script?.secrets ?? []) {
      for (const hintCell of secret.hintCells ?? []) {
        lines.push(
          `secret(${secret.id}) hint(${hintCell.x},${hintCell.y}) => ${secret.hintVisualProfileId ?? "secret_occult_hint"}`
        );
      }
    }
    return lines;
  }
}

export function validateLevelWallPresentation(level: LevelDefinition): void {
  for (const [glyph, profileId] of Object.entries(level.wallTypes ?? {})) {
    if (!hasWallVisualProfile(profileId)) {
      throw new Error(`Unknown wall visual profile '${profileId}' for glyph '${glyph}' in level '${level.id}'.`);
    }
  }

  for (const override of level.wallSemantics?.cells ?? []) {
    validateCell(level, override, `wall semantic override '${override.semantic}'`);
    if (!isSolidCell(level, override.x, override.y)) {
      throw new Error(
        `Wall semantic override at (${override.x}, ${override.y}) in level '${level.id}' must target a solid cell.`
      );
    }
    if (override.visualProfileId && !hasWallVisualProfile(override.visualProfileId)) {
      throw new Error(
        `Unknown wall semantic profile '${override.visualProfileId}' at (${override.x}, ${override.y}) in level '${level.id}'.`
      );
    }
  }

  for (const door of level.script?.doors ?? []) {
    if (door.visualProfileId && !hasDoorVisualProfile(door.visualProfileId)) {
      throw new Error(`Unknown door visual profile '${door.visualProfileId}' on door '${door.id}' in level '${level.id}'.`);
    }
  }

  for (const switchDef of level.script?.switches ?? []) {
    if (switchDef.visualProfileId && !hasSurfaceVisualProfile(switchDef.visualProfileId)) {
      throw new Error(
        `Unknown switch visual profile '${switchDef.visualProfileId}' on switch '${switchDef.id}' in level '${level.id}'.`
      );
    }
  }

  for (const teleporter of level.script?.teleporters ?? []) {
    if (teleporter.visualProfileId && !hasSurfaceVisualProfile(teleporter.visualProfileId)) {
      throw new Error(
        `Unknown teleporter visual profile '${teleporter.visualProfileId}' on teleporter '${teleporter.id}' in level '${level.id}'.`
      );
    }
  }

  for (const secret of level.script?.secrets ?? []) {
    if (secret.hintVisualProfileId && !hasWallVisualProfile(secret.hintVisualProfileId)) {
      throw new Error(
        `Unknown secret hint visual profile '${secret.hintVisualProfileId}' on secret '${secret.id}' in level '${level.id}'.`
      );
    }
    for (const hintCell of secret.hintCells ?? []) {
      validateCell(level, hintCell, `secret hint cell for '${secret.id}'`);
      if (!isSolidCell(level, hintCell.x, hintCell.y)) {
        throw new Error(
          `Secret hint cell (${hintCell.x}, ${hintCell.y}) on secret '${secret.id}' in level '${level.id}' must target a solid wall cell.`
        );
      }
    }
  }

  if (DEV) {
    const resolver = new LevelWallPresentationResolver(level);
    for (const line of resolver.describeAssignments()) {
      console.debug(`[WallPresentation:${level.id}] ${line}`);
    }
  }
}

export function findAdjacentSolidCell(
  level: LevelDefinition,
  cell: Vec2
): { x: number; y: number; facing: "north" | "south" | "west" | "east" } | null {
  const candidates = [
    { x: cell.x, y: cell.y - 1, facing: "north" as const },
    { x: cell.x, y: cell.y + 1, facing: "south" as const },
    { x: cell.x - 1, y: cell.y, facing: "west" as const },
    { x: cell.x + 1, y: cell.y, facing: "east" as const }
  ];

  for (const candidate of candidates) {
    if (isSolidCell(level, candidate.x, candidate.y)) {
      return candidate;
    }
  }
  return null;
}

function validateCell(level: LevelDefinition, cell: Vec2, label: string): void {
  if (!inBounds(level, cell.x, cell.y)) {
    throw new Error(`${label} is out of bounds at (${cell.x}, ${cell.y}) in level '${level.id}'.`);
  }
}
