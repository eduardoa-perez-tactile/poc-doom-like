import type { PickupUseActionId } from "../../content/pickups";
import type { PlayerState } from "../../core/types";
import {
  PLAYER_EFFECT_DURATIONS,
  healPlayer,
  restorePlayerToFullHealth,
  setPlayerEffectTimer
} from "../player/PlayerStatSystem";

export interface ArtifactUseContext {
  player: PlayerState;
  revealMap(): boolean;
  teleportToStart(): void;
  spawnMorphProjectile(): void;
  placeTimebomb(): void;
}

export function executeArtifactUseAction(
  action: PickupUseActionId,
  context: ArtifactUseContext
): boolean {
  switch (action) {
    case "heal_25":
      if (context.player.resources.health >= context.player.derived.maxHealth) {
        return false;
      }
      healPlayer(context.player, 25);
      return true;
    case "restore_to_full_health":
      if (context.player.resources.health >= context.player.derived.maxHealth) {
        return false;
      }
      restorePlayerToFullHealth(context.player);
      return true;
    case "invulnerable_temporarily":
      setPlayerEffectTimer(context.player, "invulnerable", PLAYER_EFFECT_DURATIONS.invulnerable);
      return true;
    case "partial_invisibility_temporarily":
      setPlayerEffectTimer(
        context.player,
        "partialInvisibility",
        PLAYER_EFFECT_DURATIONS.partialInvisibility
      );
      return true;
    case "flight_temporarily":
      setPlayerEffectTimer(context.player, "flight", PLAYER_EFFECT_DURATIONS.flight);
      return true;
    case "weapon_powerup_temporarily":
      setPlayerEffectTimer(context.player, "tomeOfPower", PLAYER_EFFECT_DURATIONS.tomeOfPower);
      return true;
    case "reveal_map":
      return context.revealMap();
    case "brighten_level_temporarily":
      setPlayerEffectTimer(context.player, "torch", PLAYER_EFFECT_DURATIONS.torch);
      return true;
    case "teleport_to_start":
      context.teleportToStart();
      return true;
    case "launch_morph_projectile":
      context.spawnMorphProjectile();
      return true;
    case "place_timebomb":
      context.placeTimebomb();
      return true;
    default:
      return false;
  }
}
