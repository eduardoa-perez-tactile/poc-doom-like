import type {
  EntityVisualDefinition,
  SpriteAnimationDefinition,
  SpriteClipDefinition,
  SpriteFrameDefinition,
  SpriteSetDefinition,
  SpriteSheetDefinition
} from "../types";
import {
  getPickupAtlasClip,
  PICKUP_SHEET_CHROMA_KEYS,
  PICKUP_SHEET_ID,
  PICKUP_SHEET_URL,
  type PickupAtlasClipId
} from "./pickupAtlas";
import type { PickupVisualId } from "./pickupTypes";

export interface PickupVisualDefinition {
  id: PickupVisualId;
  atlasId: PickupAtlasClipId;
  entityId?: string;
  worldHeight?: number;
  anchorOffsetY?: number;
  pivotY?: number;
}

function visual(
  id: PickupVisualId,
  atlasId: PickupAtlasClipId,
  options: Omit<PickupVisualDefinition, "id" | "atlasId"> = {}
): PickupVisualDefinition {
  return {
    id,
    atlasId,
    ...options
  };
}

export const pickupVisuals = [
  visual("gauntlets", "atlas.weapon.gauntlets", {
    entityId: "pickup:gauntlets",
    worldHeight: 1.08,
    anchorOffsetY: 0.54
  }),
  visual("etherealCrossbow", "atlas.weapon.etherealCrossbow", {
    entityId: "pickup:etherealCrossbow",
    worldHeight: 1.02,
    anchorOffsetY: 0.5
  }),
  visual("dragonClaw", "atlas.weapon.dragonClaw", {
    entityId: "pickup:dragonClaw",
    worldHeight: 0.82,
    anchorOffsetY: 0.38
  }),
  visual("hellstaff", "atlas.weapon.hellstaff", {
    entityId: "pickup:hellstaff",
    worldHeight: 1.12,
    anchorOffsetY: 0.56
  }),
  visual("phoenixRod", "atlas.weapon.phoenixRod", {
    entityId: "pickup:phoenixRod",
    worldHeight: 1.08,
    anchorOffsetY: 0.54
  }),
  visual("firemace", "atlas.weapon.firemace", {
    entityId: "pickup:firemace",
    worldHeight: 1.04,
    anchorOffsetY: 0.52
  }),
  visual("wandCrystal", "atlas.ammo.wandCrystal", {
    entityId: "pickup:wandCrystal",
    worldHeight: 0.52,
    anchorOffsetY: 0.23
  }),
  visual("etherealArrows", "atlas.ammo.etherealArrows", {
    entityId: "pickup:etherealArrows",
    worldHeight: 0.92,
    anchorOffsetY: 0.42
  }),
  visual("clawOrb", "atlas.ammo.clawOrb", {
    entityId: "pickup:clawOrb",
    worldHeight: 0.6,
    anchorOffsetY: 0.26
  }),
  visual("energyOrb", "atlas.ammo.energyOrb", {
    entityId: "pickup:energyOrb",
    worldHeight: 0.86,
    anchorOffsetY: 0.38
  }),
  visual("lesserRunes", "atlas.ammo.lesserRunes", {
    entityId: "pickup:lesserRunes",
    worldHeight: 0.48,
    anchorOffsetY: 0.2
  }),
  visual("greaterRunes", "atlas.ammo.greaterRunes", {
    entityId: "pickup:greaterRunes",
    worldHeight: 0.82,
    anchorOffsetY: 0.35
  }),
  visual("flameOrb", "atlas.ammo.flameOrb", {
    entityId: "pickup:flameOrb",
    worldHeight: 0.58,
    anchorOffsetY: 0.24
  }),
  visual("infernoOrb", "atlas.ammo.infernoOrb", {
    entityId: "pickup:infernoOrb",
    worldHeight: 0.9,
    anchorOffsetY: 0.4
  }),
  visual("maceSpheres", "atlas.ammo.maceSpheres", {
    entityId: "pickup:maceSpheres",
    worldHeight: 0.74,
    anchorOffsetY: 0.3
  }),
  visual("pileOfMaceSpheres", "atlas.ammo.pileOfMaceSpheres", {
    entityId: "pickup:pileOfMaceSpheres",
    worldHeight: 0.9,
    anchorOffsetY: 0.38
  }),
  visual("bagOfHolding", "atlas.support.bagOfHolding", {
    entityId: "pickup:bagOfHolding",
    worldHeight: 0.72,
    anchorOffsetY: 0.28
  }),
  visual("crystalVial", "atlas.health.crystalVial", {
    entityId: "pickup:crystalVial",
    worldHeight: 0.7,
    anchorOffsetY: 0.3
  }),
  visual("quartzFlask", "atlas.artifact.quartzFlaskPickup", {
    entityId: "pickup:quartzFlask",
    worldHeight: 0.74,
    anchorOffsetY: 0.31
  }),
  visual("mysticUrn", "atlas.artifact.mysticUrnPickup", {
    entityId: "pickup:mysticUrn",
    worldHeight: 0.84,
    anchorOffsetY: 0.34
  }),
  visual("silverShield", "atlas.armor.silverShield", {
    entityId: "pickup:silverShield",
    worldHeight: 0.82,
    anchorOffsetY: 0.34
  }),
  visual("enchantedShield", "atlas.armor.enchantedShield", {
    entityId: "pickup:enchantedShield",
    worldHeight: 0.86,
    anchorOffsetY: 0.36
  }),
  visual("greenKey", "atlas.key.green", {
    entityId: "pickup:greenKey",
    worldHeight: 1.02,
    anchorOffsetY: 0.44
  }),
  visual("yellowKey", "atlas.key.yellow", {
    entityId: "pickup:yellowKey",
    worldHeight: 1.06,
    anchorOffsetY: 0.48
  }),
  visual("blueKey", "atlas.key.blue", {
    entityId: "pickup:blueKey",
    worldHeight: 1.06,
    anchorOffsetY: 0.48
  }),
  visual("ringOfInvincibility", "atlas.artifact.ringOfInvincibilityPickup", {
    entityId: "pickup:ringOfInvincibility",
    worldHeight: 0.9,
    anchorOffsetY: 0.38
  }),
  visual("shadowsphere", "atlas.artifact.shadowspherePickup", {
    entityId: "pickup:shadowsphere",
    worldHeight: 0.72,
    anchorOffsetY: 0.28
  }),
  visual("morphOvum", "atlas.artifact.morphOvumPickup", {
    entityId: "pickup:morphOvum",
    worldHeight: 0.78,
    anchorOffsetY: 0.31
  }),
  visual("timebombPickup", "atlas.artifact.timebombPickup", {
    entityId: "pickup:timebombPickup",
    worldHeight: 0.72,
    anchorOffsetY: 0.28
  }),
  visual("chaosDevice", "atlas.artifact.chaosDevicePickup", {
    entityId: "pickup:chaosDevice",
    worldHeight: 0.92,
    anchorOffsetY: 0.39
  }),
  visual("wingsOfWrath", "atlas.artifact.wingsOfWrathPickup", {
    entityId: "pickup:wingsOfWrath",
    worldHeight: 0.86,
    anchorOffsetY: 0.34
  }),
  visual("tomeOfPower", "atlas.artifact.tomeOfPowerPickup", {
    entityId: "pickup:tomeOfPower",
    worldHeight: 0.84,
    anchorOffsetY: 0.33
  }),
  visual("mapScroll", "atlas.artifact.mapScrollPickup", {
    entityId: "pickup:mapScroll",
    worldHeight: 0.8,
    anchorOffsetY: 0.3
  }),
  visual("torch", "atlas.artifact.torchPickup", {
    entityId: "pickup:torch",
    worldHeight: 0.82,
    anchorOffsetY: 0.34
  }),
  visual("morphOvumProjectile", "atlas.projectile.morphOvum", {
    entityId: "projectile:morphOvumProjectile",
    worldHeight: 0.42,
    anchorOffsetY: 0.2
  }),
  visual("timebombUse", "atlas.effect.timebombUse", {
    entityId: "projectile:timebombUse",
    worldHeight: 0.74,
    anchorOffsetY: 0.32
  }),
  visual("inventoryIcon_ringOfInvincibility", "atlas.icon.ringOfInvincibility"),
  visual("inventoryIcon_shadowsphere", "atlas.icon.shadowsphere"),
  visual("inventoryIcon_morphOvum", "atlas.icon.morphOvum"),
  visual("inventoryIcon_timebomb", "atlas.icon.timebomb"),
  visual("inventoryIcon_chaosDevice", "atlas.icon.chaosDevice"),
  visual("inventoryIcon_quartzFlask", "atlas.icon.quartzFlask"),
  visual("inventoryIcon_tomeOfPower", "atlas.icon.tomeOfPower"),
  visual("inventoryIcon_wingsOfWrath", "atlas.icon.wingsOfWrath"),
  visual("inventoryIcon_mysticUrn", "atlas.icon.mysticUrn"),
  visual("inventoryIcon_torch", "atlas.icon.torch")
] as const satisfies readonly PickupVisualDefinition[];

export const pickupVisualsById = new Map<PickupVisualId, PickupVisualDefinition>(
  pickupVisuals.map((definition) => [definition.id, definition])
);

export const pickupWorldVisuals = pickupVisuals.filter((definition) => definition.entityId);

export const pickupSheetDefinition: SpriteSheetDefinition = {
  id: PICKUP_SHEET_ID,
  imageUrl: PICKUP_SHEET_URL,
  chromaKeyColors: [...PICKUP_SHEET_CHROMA_KEYS]
};

function createSpriteSet(definition: PickupVisualDefinition): SpriteSetDefinition {
  const atlas = getPickupAtlasClip(definition.atlasId);
  const baseFrame = atlas.frames[0];
  const worldHeight = definition.worldHeight ?? 0.82;
  const worldWidth = Math.max(0.24, worldHeight * (baseFrame.w / Math.max(1, baseFrame.h)));
  const framePrefix = `${definition.id}_frame`;
  const clipId = `${definition.id}_clip`;
  const frames: SpriteFrameDefinition[] = atlas.frames.map((frame, index) => ({
    id: `${framePrefix}_${index}`,
    x: frame.x,
    y: frame.y,
    width: frame.w,
    height: frame.h
  }));
  const clips: SpriteClipDefinition[] = [
    {
      id: clipId,
      frames: frames.map((frame) => frame.id),
      fps: atlas.fps ?? 8,
      loop: atlas.loop ?? true
    }
  ];
  const animations: SpriteAnimationDefinition[] = [{ state: "idle", directionalClips: [{ clipId }] }];

  return {
    id: `${definition.id}_set`,
    sheetId: PICKUP_SHEET_ID,
    defaultState: "idle",
    worldWidth,
    worldHeight,
    anchorOffsetY: definition.anchorOffsetY ?? worldHeight * 0.45,
    pivotY: definition.pivotY ?? 1,
    flipY: true,
    frames,
    clips,
    animations
  };
}

export function createPickupSpriteManifest(): {
  sheet: SpriteSheetDefinition;
  spriteSets: SpriteSetDefinition[];
  entities: EntityVisualDefinition[];
} {
  return {
    sheet: pickupSheetDefinition,
    spriteSets: pickupWorldVisuals.map((definition) => createSpriteSet(definition)),
    entities: pickupWorldVisuals.map((definition) => ({
      entityId: definition.entityId!,
      spriteSetId: `${definition.id}_set`
    }))
  };
}

export function getPickupVisual(id: PickupVisualId): PickupVisualDefinition {
  const definition = pickupVisualsById.get(id);
  if (!definition) {
    throw new Error(`Unknown pickup visual '${id}'.`);
  }
  return definition;
}
