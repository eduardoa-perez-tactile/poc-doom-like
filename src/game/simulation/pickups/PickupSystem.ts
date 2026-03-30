import type { ContentDatabase } from "../../content/types";
import type { PickupDef, WorldPickupInstance } from "../../content/pickups";
import { getPickupDef } from "../../content/pickups";
import { distance2 } from "../../core/math";
import type { GameSessionState } from "../../core/types";
import type { SimulationEvents } from "../GameSimulation";

export interface PickupSystemContext {
  content: ContentDatabase;
  state: GameSessionState;
  tryGrantPickup(definition: PickupDef, pickup: WorldPickupInstance): boolean;
}

export class PickupSystem {
  update(dt: number, context: PickupSystemContext, events: SimulationEvents): void {
    const { state } = context;
    for (const pickup of state.pickups) {
      pickup.animTime += dt;

      if (pickup.picked) {
        if (
          pickup.respawnAtTime !== null &&
          pickup.respawnAtTime !== undefined &&
          pickup.respawnAtTime <= state.elapsedTime
        ) {
          pickup.picked = false;
          pickup.animTime = 0;
          pickup.respawnAtTime = null;
        }
        continue;
      }

      if (distance2(state.player.x, state.player.y, pickup.position.x, pickup.position.y) > 0.84) {
        continue;
      }

      const definition = getPickupDef(pickup.defId);
      if (!context.tryGrantPickup(definition, pickup)) {
        continue;
      }

      pickup.picked = true;
      pickup.animTime = 0;
      const respawnSeconds = definition.respawnSeconds ?? null;
      pickup.respawnAtTime = respawnSeconds ? state.elapsedTime + respawnSeconds : null;
      events.pickup = true;
    }
  }
}
