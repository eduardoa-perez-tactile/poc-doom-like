import { getPickupDef } from "../../content/pickups";
import type { ContentDatabase } from "../../content/types";
import type { GameSessionState } from "../../core/types";
import type { InputFrame } from "../../systems/InputSystem";

export interface PickupUseSystemContext {
  content: ContentDatabase;
  state: GameSessionState;
  cycleInventory(direction: -1 | 1): void;
  tryUseWorld(): boolean;
  useSelectedInventoryItem(): boolean;
}

export class PickupUseSystem {
  update(input: InputFrame, context: PickupUseSystemContext): void {
    if (input.inventoryPrevPressed) {
      context.cycleInventory(-1);
    }
    if (input.inventoryNextPressed) {
      context.cycleInventory(1);
    }
    if (input.interactPressed) {
      context.tryUseWorld();
    }
    if (input.useItemPressed) {
      context.useSelectedInventoryItem();
    }
  }

  getSelectedInventoryDefId(state: GameSessionState): string | null {
    if (state.player.inventory.length === 0) {
      return null;
    }
    const index = Math.max(0, Math.min(state.player.selectedInventoryIndex, state.player.inventory.length - 1));
    const entry = state.player.inventory[index];
    return getPickupDef(entry.itemDefId).id;
  }
}
