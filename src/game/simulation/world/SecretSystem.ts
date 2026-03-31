import type {
  LevelScriptRuntimeState,
  ScriptActionDef,
  SecretDef
} from "../script/LevelScriptTypes";
import { playerCell, rectContainsCell } from "../script/LevelScriptUtils";
import type { LevelState, PlayerState } from "../../core/types";

export interface SecretDiscoverResult {
  secret: SecretDef;
  rewardActions: ScriptActionDef[];
}

export class SecretSystem {
  private readonly secrets: SecretDef[];

  constructor(secrets: SecretDef[]) {
    this.secrets = secrets;
  }

  update(
    runtime: LevelScriptRuntimeState,
    level: LevelState,
    player: PlayerState
  ): SecretDiscoverResult[] {
    const results: SecretDiscoverResult[] = [];
    const cell = playerCell(level, player);

    for (const secret of this.secrets) {
      const secretState = runtime.secrets[secret.id];
      if (!secretState || secretState.discovered) {
        continue;
      }
      if (!rectContainsCell(secret.region, cell)) {
        continue;
      }

      secretState.discovered = true;
      results.push({
        secret,
        rewardActions: secret.rewardActions ?? []
      });
    }

    return results;
  }

  reveal(runtime: LevelScriptRuntimeState, secretId: string): boolean {
    const state = runtime.secrets[secretId];
    if (!state || state.discovered) {
      return false;
    }
    state.discovered = true;
    return true;
  }
}
