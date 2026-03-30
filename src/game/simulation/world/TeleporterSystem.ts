import type { LevelState, PlayerState } from "../../core/types";
import type { LevelScriptRuntimeState, TeleporterDef } from "../script/LevelScriptTypes";
import { cellToWorldCenter, playerCell, rectContainsCell } from "../script/LevelScriptUtils";

const TELEPORTER_COOLDOWN_SECONDS = 0.35;

export interface TeleportContext {
  level: LevelState;
  player: PlayerState;
  debug(message: string): void;
}

export class TeleporterSystem {
  private readonly teleporters: TeleporterDef[];

  constructor(teleporters: TeleporterDef[]) {
    this.teleporters = teleporters;
  }

  update(runtime: LevelScriptRuntimeState, context: TeleportContext): boolean {
    runtime.teleporterCooldownRemaining = Math.max(0, runtime.teleporterCooldownRemaining);
    if (runtime.teleporterCooldownRemaining > 0) {
      return false;
    }

    const cell = playerCell(context.level, context.player);
    for (const teleporter of this.teleporters) {
      const teleporterState = runtime.teleporters[teleporter.id];
      if (!teleporterState?.enabled) {
        continue;
      }
      if (!rectContainsCell(teleporter.fromRegion, cell)) {
        continue;
      }

      const target = cellToWorldCenter(context.level, teleporter.targetPos);
      context.player.x = target.x;
      context.player.y = target.y;
      if (teleporter.targetFacingRadians !== undefined) {
        context.player.angle = teleporter.targetFacingRadians;
      }
      runtime.teleporterCooldownRemaining = TELEPORTER_COOLDOWN_SECONDS;
      context.debug(`Teleporter '${teleporter.id}' moved the player.`);
      return true;
    }

    return false;
  }

  tick(runtime: LevelScriptRuntimeState, dt: number): void {
    runtime.teleporterCooldownRemaining = Math.max(0, runtime.teleporterCooldownRemaining - dt);
  }
}
