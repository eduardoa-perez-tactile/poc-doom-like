import type { WallSemanticKind } from "../types";

export type WallVariationMode = "hash" | "fixed";
export type DoorLockMarkerStyle = "none" | "plate" | "sigil" | "bar";
export type DoorKeyColor = "green" | "yellow" | "blue";

export interface WallVisualFamily {
  id: string;
  texturePool: string[];
  notes?: string;
}

export interface WallVisualProfile {
  id: string;
  semantic: Extract<WallSemanticKind, "wall" | "major_wall" | "secret_wall" | "gate" | "landmark" | "hazard">;
  texturePool: string[];
  trimTexturePool?: string[];
  variationMode?: WallVariationMode;
  allowNeighborDeDupe?: boolean;
  emissiveColor?: string | null;
  notes?: string;
}

export interface DoorVisualProfile {
  id: string;
  semantic: Extract<WallSemanticKind, "door" | "locked_door" | "exit" | "gate" | "secret_wall">;
  baseTexturePool: string[];
  frameTexturePool?: string[];
  lockedMarkerStyle?: DoorLockMarkerStyle;
  keyColor?: DoorKeyColor | null;
  emissiveColor?: string | null;
  notes?: string;
}

export interface SurfaceVisualProfile {
  id: string;
  semantic: Extract<WallSemanticKind, "teleporter" | "switch_panel" | "exit" | "landmark">;
  surfaceTexturePool: string[];
  frameTexturePool?: string[];
  emissiveColor?: string | null;
  notes?: string;
}

export const wallVisualFamilies: readonly WallVisualFamily[] = [
  {
    id: "structuralStone",
    texturePool: ["stone_plain_gray", "stone_dark_block", "stone_inset_gray", "stone_cut_block_light"],
    notes: "Low-noise structural stone reserved for most filler walls."
  },
  {
    id: "structuralBrick",
    texturePool: ["brick_gray_course", "brick_brown_tiles"],
    notes: "Readable branch and arena walls."
  },
  {
    id: "insetPanel",
    texturePool: ["stone_inset_gray", "stone_relief_carved", "plain_tan_panel", "metal_window_dark"],
    notes: "Framed masonry and inset panel surfaces."
  },
  {
    id: "woodDoor",
    texturePool: ["door_wood_planks", "door_wood_ribs", "wood_ring_panel", "wood_reinforced_dark"],
    notes: "Movable wood door language."
  },
  {
    id: "metalDoor",
    texturePool: ["metal_dark_panel", "metal_window_brown", "metal_window_dark", "door_occult_gate"],
    notes: "Heavy metal barrier language."
  },
  {
    id: "occultDoor",
    texturePool: ["door_occult_gate", "occult_diamond_panel", "occult_spine_panel", "arcane_skull_relief"],
    notes: "Occult progression blockers and inner keep doors."
  },
  {
    id: "lockedDoorBase",
    texturePool: ["door_occult_gate", "metal_dark_panel", "metal_window_brown"],
    notes: "Neutral heavy base used by keyed locked doors."
  },
  {
    id: "gateBars",
    texturePool: ["bars_cyan_short", "bars_cyan_grate", "bars_cyan_columns", "bars_cyan_fence"],
    notes: "Barred gates and visible blockers."
  },
  {
    id: "runePanel",
    texturePool: ["switch_rune_gray", "switch_rune_blue", "occult_diamond_panel", "stone_sigil_wall"],
    notes: "Readable rune panels and interaction motifs."
  },
  {
    id: "switchPanel",
    texturePool: ["switch_rune_blue", "switch_rune_gray", "stone_skull_inset"],
    notes: "Strongly readable use targets."
  },
  {
    id: "secretHintWall",
    texturePool: ["stone_relief_carved", "arcane_skull_relief", "moss_vine_wall", "stone_skull_inset"],
    notes: "Subtly suspicious, not loud."
  },
  {
    id: "portalSurface",
    texturePool: [
      "portal_blue_stream_a",
      "portal_blue_stream_b",
      "portal_blue_stream_c",
      "portal_stained_figure",
      "stained_glass_round"
    ],
    notes: "Teleport and magical anchor language."
  },
  {
    id: "exitSurface",
    texturePool: ["portal_stained_orb", "stained_glass_square", "stained_glass_round", "banner_arcane_gold"],
    notes: "Strong goal/exit language."
  },
  {
    id: "hazardDecor",
    texturePool: ["lava_red_bubbling", "lava_orange_flow", "water_purple_fall", "hazard_flesh_vein"],
    notes: "Hazard-adjacent decorative surfaces."
  },
  {
    id: "landmarkDecor",
    texturePool: [
      "stone_skull_wall",
      "stone_sigil_wall",
      "stone_skull_inset",
      "banner_arcane_gold",
      "banner_arcane_red",
      "portal_stained_orb"
    ],
    notes: "Rare orientation anchors and focal walls."
  }
] as const;

export const wallVisualProfiles: readonly WallVisualProfile[] = [
  {
    id: "structural_stone_wall",
    semantic: "wall",
    texturePool: ["stone_plain_gray", "stone_dark_block", "stone_inset_gray"],
    variationMode: "hash",
    allowNeighborDeDupe: true,
    notes: "Default filler masonry."
  },
  {
    id: "major_structural_stone",
    semantic: "major_wall",
    texturePool: ["stone_cut_block_light", "stone_plain_gray", "stone_dark_block"],
    trimTexturePool: ["stone_relief_rough"],
    variationMode: "hash",
    allowNeighborDeDupe: true,
    notes: "Strong load-bearing walls and outer ring structures."
  },
  {
    id: "structural_brick_wall",
    semantic: "wall",
    texturePool: ["brick_gray_course", "brick_brown_tiles"],
    variationMode: "hash",
    allowNeighborDeDupe: true,
    notes: "Readable branch walls."
  },
  {
    id: "reinforced_panel_wall",
    semantic: "wall",
    texturePool: ["metal_window_dark", "metal_window_brown", "stone_inset_gray"],
    variationMode: "hash",
    allowNeighborDeDupe: true,
    notes: "Inset structural panels for junctions."
  },
  {
    id: "gate_barrier_wall",
    semantic: "gate",
    texturePool: ["bars_cyan_grate", "bars_cyan_columns"],
    trimTexturePool: ["metal_dark_panel"],
    variationMode: "hash",
    allowNeighborDeDupe: false,
    notes: "Barred barriers."
  },
  {
    id: "hazard_wall",
    semantic: "hazard",
    texturePool: ["hazard_flesh_vein", "rock_rubble_brown", "rock_brown_face"],
    variationMode: "hash",
    allowNeighborDeDupe: true,
    emissiveColor: "#c77048",
    notes: "Danger-adjacent walls."
  },
  {
    id: "secret_occult_hint",
    semantic: "secret_wall",
    texturePool: ["stone_relief_carved", "arcane_skull_relief", "stone_skull_inset"],
    variationMode: "fixed",
    allowNeighborDeDupe: false,
    notes: "Subtle secret panel."
  },
  {
    id: "secret_moss_hint",
    semantic: "secret_wall",
    texturePool: ["moss_vine_wall", "stone_relief_rough"],
    trimTexturePool: ["stone_plain_gray"],
    variationMode: "fixed",
    allowNeighborDeDupe: false,
    notes: "Softer secret affordance hidden in structural walls."
  },
  {
    id: "landmark_skull_sanctum",
    semantic: "landmark",
    texturePool: ["stone_skull_wall", "stone_sigil_wall", "banner_arcane_gold"],
    variationMode: "fixed",
    allowNeighborDeDupe: false,
    emissiveColor: "#8c7259",
    notes: "Navigation anchor."
  },
  {
    id: "landmark_arcane_window",
    semantic: "landmark",
    texturePool: ["stained_glass_square", "stained_glass_round", "portal_stained_orb"],
    variationMode: "fixed",
    allowNeighborDeDupe: false,
    emissiveColor: "#7f9de0",
    notes: "Important magical landmark."
  }
] as const;

export const doorVisualProfiles: readonly DoorVisualProfile[] = [
  {
    id: "door_wood_reinforced",
    semantic: "door",
    baseTexturePool: ["door_wood_planks", "door_wood_ribs", "wood_ring_panel"],
    frameTexturePool: ["wood_crossbrace", "wood_lattice_dark"],
    lockedMarkerStyle: "none",
    notes: "Readable standard door."
  },
  {
    id: "door_metal_gate",
    semantic: "door",
    baseTexturePool: ["metal_dark_panel", "metal_window_brown", "metal_window_dark"],
    frameTexturePool: ["stone_cut_block_light"],
    lockedMarkerStyle: "none",
    notes: "Heavy but unlocked door."
  },
  {
    id: "door_occult_reinforced",
    semantic: "door",
    baseTexturePool: ["door_occult_gate", "occult_diamond_panel", "occult_spine_panel"],
    frameTexturePool: ["arcane_skull_relief", "stone_cut_block_light"],
    lockedMarkerStyle: "sigil",
    emissiveColor: "#9d835d",
    notes: "Occult doors with stronger story weight."
  },
  {
    id: "door_locked_green",
    semantic: "locked_door",
    baseTexturePool: ["door_occult_gate", "metal_dark_panel"],
    frameTexturePool: ["stone_cut_block_light", "stone_plain_gray"],
    lockedMarkerStyle: "plate",
    keyColor: "green",
    emissiveColor: "#50875a",
    notes: "Green key progression lock."
  },
  {
    id: "door_locked_yellow",
    semantic: "locked_door",
    baseTexturePool: ["door_occult_gate", "metal_dark_panel"],
    frameTexturePool: ["stone_cut_block_light", "stone_plain_gray"],
    lockedMarkerStyle: "plate",
    keyColor: "yellow",
    emissiveColor: "#d3a64e",
    notes: "Yellow key progression lock."
  },
  {
    id: "door_locked_blue",
    semantic: "locked_door",
    baseTexturePool: ["door_occult_gate", "metal_dark_panel"],
    frameTexturePool: ["stone_cut_block_light", "stone_plain_gray"],
    lockedMarkerStyle: "plate",
    keyColor: "blue",
    emissiveColor: "#5a82cb",
    notes: "Blue key progression lock."
  },
  {
    id: "door_secret_occult",
    semantic: "secret_wall",
    baseTexturePool: ["stone_relief_carved", "stone_skull_inset", "arcane_skull_relief"],
    frameTexturePool: ["stone_plain_gray"],
    lockedMarkerStyle: "sigil",
    emissiveColor: "#7c6752",
    notes: "Secret wall seam that still reads as unusual."
  },
  {
    id: "door_exit_seal",
    semantic: "exit",
    baseTexturePool: ["portal_stained_orb", "stained_glass_round", "door_occult_gate"],
    frameTexturePool: ["stone_sigil_wall", "stone_cut_block_light"],
    lockedMarkerStyle: "bar",
    emissiveColor: "#9d7cc8",
    notes: "Exit/goal seal."
  }
] as const;

export const surfaceVisualProfiles: readonly SurfaceVisualProfile[] = [
  {
    id: "switch_rune_panel",
    semantic: "switch_panel",
    surfaceTexturePool: ["switch_rune_blue", "switch_rune_gray"],
    frameTexturePool: ["stone_cut_block_light", "metal_dark_panel"],
    emissiveColor: "#b79b63",
    notes: "Default progression switch."
  },
  {
    id: "switch_skull_panel",
    semantic: "switch_panel",
    surfaceTexturePool: ["stone_skull_inset", "stone_sigil_wall"],
    frameTexturePool: ["stone_plain_gray"],
    emissiveColor: "#b79b63",
    notes: "More ceremonial switch."
  },
  {
    id: "teleporter_arcane_pad",
    semantic: "teleporter",
    surfaceTexturePool: ["portal_blue_stream_a", "portal_blue_stream_b", "portal_blue_stream_c"],
    frameTexturePool: ["stained_glass_square", "bars_cyan_short"],
    emissiveColor: "#78b9f2",
    notes: "Blue teleport pad."
  },
  {
    id: "teleporter_stained_glass",
    semantic: "teleporter",
    surfaceTexturePool: ["portal_stained_figure", "stained_glass_square", "stained_glass_round"],
    frameTexturePool: ["stone_cut_block_light"],
    emissiveColor: "#ae89ec",
    notes: "Higher-contrast magical teleporter."
  },
  {
    id: "exit_arcane_orb",
    semantic: "exit",
    surfaceTexturePool: ["portal_stained_orb", "stained_glass_round"],
    frameTexturePool: ["stone_sigil_wall", "stone_cut_block_light"],
    emissiveColor: "#d39cff",
    notes: "Goal / exit anchor."
  }
] as const;

const WALL_VISUAL_PROFILES_BY_ID = new Map(wallVisualProfiles.map((profile) => [profile.id, profile] as const));
const DOOR_VISUAL_PROFILES_BY_ID = new Map(doorVisualProfiles.map((profile) => [profile.id, profile] as const));
const SURFACE_VISUAL_PROFILES_BY_ID = new Map(surfaceVisualProfiles.map((profile) => [profile.id, profile] as const));

const LEGACY_WALL_TYPE_ALIASES: Record<string, string> = {
  Stone: "structural_stone_wall",
  Brick: "structural_brick_wall",
  Wood: "reinforced_panel_wall",
  Metal: "reinforced_panel_wall",
  Decorative: "major_structural_stone",
  Door: "reinforced_panel_wall",
  Portal: "landmark_arcane_window",
  Lava: "hazard_wall",
  Water: "landmark_arcane_window",
  Moss: "secret_moss_hint",
  Arcane: "major_structural_stone",
  StainedGlass: "landmark_arcane_window",
  Bars: "gate_barrier_wall"
};

export function getWallVisualProfile(id: string): WallVisualProfile {
  const resolvedId = resolveLegacyWallVisualProfileId(id) ?? id;
  const profile = WALL_VISUAL_PROFILES_BY_ID.get(resolvedId);
  if (!profile) {
    throw new Error(`Unknown wall visual profile '${id}'.`);
  }
  return profile;
}

export function getDoorVisualProfile(id: string): DoorVisualProfile {
  const profile = DOOR_VISUAL_PROFILES_BY_ID.get(id);
  if (!profile) {
    throw new Error(`Unknown door visual profile '${id}'.`);
  }
  return profile;
}

export function getSurfaceVisualProfile(id: string): SurfaceVisualProfile {
  const profile = SURFACE_VISUAL_PROFILES_BY_ID.get(id);
  if (!profile) {
    throw new Error(`Unknown surface visual profile '${id}'.`);
  }
  return profile;
}

export function hasWallVisualProfile(id: string | undefined | null): boolean {
  if (!id) {
    return false;
  }
  return WALL_VISUAL_PROFILES_BY_ID.has(id) || resolveLegacyWallVisualProfileId(id) !== null;
}

export function hasDoorVisualProfile(id: string | undefined | null): boolean {
  return Boolean(id && DOOR_VISUAL_PROFILES_BY_ID.has(id));
}

export function hasSurfaceVisualProfile(id: string | undefined | null): boolean {
  return Boolean(id && SURFACE_VISUAL_PROFILES_BY_ID.has(id));
}

export function resolveLegacyWallVisualProfileId(id: string | undefined | null): string | null {
  if (!id) {
    return null;
  }
  return LEGACY_WALL_TYPE_ALIASES[id] ?? (WALL_VISUAL_PROFILES_BY_ID.has(id) ? id : null);
}

export function wallVisualProfileIds(): readonly string[] {
  return wallVisualProfiles.map((profile) => profile.id);
}

export function doorVisualProfileIds(): readonly string[] {
  return doorVisualProfiles.map((profile) => profile.id);
}

export function surfaceVisualProfileIds(): readonly string[] {
  return surfaceVisualProfiles.map((profile) => profile.id);
}
