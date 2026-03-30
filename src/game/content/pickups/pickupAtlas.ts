import type { AtlasAnim, Rect } from "./pickupTypes";

export type PickupAtlasClipId = string;

export interface PickupAtlasClipDefinition extends AtlasAnim {
  id: PickupAtlasClipId;
}

export const PICKUP_SHEET_ID = "pickup_sheet";
export const PICKUP_SHEET_URL = new URL("../assets/pickups.png", import.meta.url).href;
export const PICKUP_SHEET_CHROMA_KEYS = ["#00FFFF", "#008080"] as const;

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

function clip(id: PickupAtlasClipId, frames: Rect[], fps = 8, loop = true): PickupAtlasClipDefinition {
  return { id, frames, fps, loop };
}

export const pickupAtlasClips = [
  clip("atlas.weapon.gauntlets", [rect(1, 25, 31, 32)], 1),
  clip("atlas.weapon.etherealCrossbow", [rect(40, 17, 45, 40)], 1),
  clip("atlas.weapon.dragonClaw", [rect(133, 37, 23, 20)], 1),
  clip("atlas.weapon.hellstaff", [rect(235, 16, 20, 41)], 1),
  clip("atlas.weapon.phoenixRod", [rect(340, 17, 24, 40)], 1),
  clip("atlas.weapon.firemace", [rect(443, 18, 16, 39)], 1),
  clip("atlas.ammo.wandCrystal", [
    rect(1, 96, 8, 8),
    rect(10, 97, 10, 7),
    rect(21, 97, 10, 7),
    rect(32, 97, 10, 7)
  ], 10),
  clip("atlas.ammo.etherealArrows", [
    rect(43, 73, 9, 31),
    rect(53, 78, 9, 26),
    rect(63, 78, 9, 26),
    rect(73, 78, 9, 26)
  ], 10),
  clip("atlas.ammo.clawOrb", [
    rect(83, 90, 15, 14),
    rect(99, 90, 15, 14),
    rect(115, 90, 15, 14)
  ], 8),
  clip("atlas.ammo.energyOrb", [
    rect(131, 81, 23, 23),
    rect(155, 81, 23, 23),
    rect(179, 81, 23, 23)
  ], 8),
  clip("atlas.ammo.lesserRunes", [rect(203, 92, 11, 12), rect(215, 92, 11, 12)], 6),
  clip("atlas.ammo.greaterRunes", [rect(227, 78, 26, 26), rect(255, 79, 24, 24)], 6),
  clip("atlas.ammo.flameOrb", [
    rect(281, 90, 15, 14),
    rect(297, 90, 15, 14),
    rect(313, 90, 15, 14)
  ], 8),
  clip("atlas.ammo.infernoOrb", [
    rect(329, 77, 28, 27),
    rect(358, 77, 28, 27),
    rect(387, 77, 28, 27)
  ], 8),
  clip("atlas.ammo.maceSpheres", [rect(416, 83, 28, 21)], 1),
  clip("atlas.ammo.pileOfMaceSpheres", [rect(445, 76, 35, 28)], 1),
  clip("atlas.support.bagOfHolding", [rect(481, 79, 21, 19)], 1),
  clip("atlas.health.crystalVial", [
    rect(1, 124, 6, 16),
    rect(8, 124, 6, 16),
    rect(15, 124, 6, 16)
  ], 8),
  clip("atlas.artifact.quartzFlaskPickup", [
    rect(22, 123, 15, 19),
    rect(38, 123, 15, 19),
    rect(54, 123, 15, 19)
  ], 8),
  clip("atlas.artifact.mysticUrnPickup", [rect(70, 120, 19, 25)], 1),
  clip("atlas.armor.silverShield", [rect(90, 122, 26, 21)], 1),
  clip("atlas.armor.enchantedShield", [rect(120, 120, 21, 25)], 1),
  clip("atlas.icon.ringOfInvincibility", [rect(144, 121, 27, 23)], 1),
  clip("atlas.icon.morphOvum", [rect(176, 122, 18, 21)], 1),
  clip("atlas.icon.timebomb", [rect(203, 122, 20, 20)], 1),
  clip("atlas.icon.chaosDevice", [rect(229, 121, 25, 22)], 1),
  clip("atlas.icon.shadowsphere", [rect(260, 125, 19, 15)], 1),
  clip("atlas.icon.quartzFlask", [rect(290, 123, 15, 19)], 1),
  clip("atlas.icon.tomeOfPower", [rect(313, 121, 25, 23)], 1),
  clip("atlas.icon.wingsOfWrath", [rect(341, 122, 25, 20)], 1),
  clip("atlas.icon.mysticUrn", [rect(372, 120, 19, 25)], 1),
  clip("atlas.icon.torch", [rect(402, 122, 15, 21)], 1),
  clip("atlas.key.green", [
    rect(5, 168, 19, 25),
    rect(33, 168, 16, 25),
    rect(62, 168, 13, 25),
    rect(89, 168, 13, 25),
    rect(121, 168, 3, 25),
    rect(146, 168, 7, 25),
    rect(170, 168, 12, 25),
    rect(195, 168, 17, 25),
    rect(221, 168, 19, 25),
    rect(248, 168, 19, 25)
  ], 12),
  clip("atlas.key.yellow", [
    rect(2, 194, 24, 32),
    rect(30, 194, 23, 32),
    rect(59, 194, 18, 32),
    rect(89, 194, 12, 32),
    rect(120, 194, 4, 32),
    rect(147, 194, 4, 32),
    rect(171, 194, 11, 32),
    rect(194, 194, 18, 32),
    rect(219, 194, 22, 32)
  ], 12),
  clip("atlas.key.blue", [
    rect(1, 234, 26, 25),
    rect(29, 234, 25, 25),
    rect(59, 234, 19, 25),
    rect(89, 234, 13, 25),
    rect(119, 234, 6, 25),
    rect(143, 234, 12, 25),
    rect(167, 234, 18, 25),
    rect(191, 234, 24, 25),
    rect(217, 234, 26, 25),
    rect(244, 234, 26, 25)
  ], 12),
  clip("atlas.artifact.ringOfInvincibilityPickup", [
    rect(1, 277, 27, 23),
    rect(29, 277, 27, 23),
    rect(57, 277, 27, 23)
  ], 8),
  clip("atlas.artifact.morphOvumPickup", [
    rect(86, 278, 20, 21),
    rect(108, 278, 22, 21),
    rect(133, 278, 18, 21)
  ], 8),
  clip("atlas.artifact.timebombPickup", [rect(154, 278, 20, 20)], 1),
  clip("atlas.artifact.chaosDevicePickup", [rect(175, 275, 34, 27)], 1),
  clip("atlas.artifact.shadowspherePickup", [
    rect(210, 281, 19, 15),
    rect(230, 281, 19, 15),
    rect(250, 281, 19, 15),
    rect(270, 281, 19, 15)
  ], 8),
  clip("atlas.artifact.wingsOfWrathPickup", [
    rect(291, 277, 35, 20),
    rect(328, 284, 37, 13),
    rect(368, 284, 33, 16)
  ], 8),
  clip("atlas.artifact.tomeOfPowerPickup", [rect(404, 277, 25, 23)], 1),
  clip("atlas.artifact.mapScrollPickup", [rect(430, 278, 30, 21)], 1),
  clip("atlas.artifact.torchPickup", [
    rect(461, 278, 15, 21),
    rect(477, 279, 15, 20),
    rect(493, 278, 15, 21)
  ], 10),
  clip("atlas.projectile.morphOvum", [
    rect(271, 198, 9, 25),
    rect(281, 200, 9, 21),
    rect(291, 198, 9, 23),
    rect(301, 198, 9, 23),
    rect(311, 200, 9, 23)
  ], 14),
  clip("atlas.effect.timebombUse", [
    rect(271, 227, 20, 32),
    rect(292, 227, 20, 32),
    rect(313, 227, 20, 32),
    rect(334, 227, 20, 32)
  ], 10)
] as const satisfies readonly PickupAtlasClipDefinition[];

export const pickupAtlasById = new Map<PickupAtlasClipId, PickupAtlasClipDefinition>(
  pickupAtlasClips.map((definition) => [definition.id, definition])
);

export function getPickupAtlasClip(id: PickupAtlasClipId): PickupAtlasClipDefinition {
  const definition = pickupAtlasById.get(id);
  if (!definition) {
    throw new Error(`Unknown pickup atlas clip '${id}'.`);
  }
  return definition;
}
