export * from "./pickupAtlas";
export * from "./pickupDefs";
export * from "./pickupHudSheet";
export * from "./pickupTypes";
export * from "./pickupVisuals";

import { getPickupDef } from "./pickupDefs";
import { getPickupVisual } from "./pickupVisuals";

export function getPickupVisualForDef(defId: string) {
  return getPickupVisual(getPickupDef(defId).visualId);
}

export function getInventoryIcon(defId: string) {
  const definition = getPickupDef(defId);
  return definition.inventoryIconId ? getPickupVisual(definition.inventoryIconId) : null;
}
