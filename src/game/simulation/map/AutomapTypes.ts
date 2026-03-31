export type MapLineId = string;
export type MapMarkerId = string;

export type MapLineKind =
  | "wall"
  | "door"
  | "secret"
  | "teleporter"
  | "exit"
  | "window";

export type MapMarkerKind =
  | "player"
  | "key"
  | "switch"
  | "teleporter"
  | "exit"
  | "secret"
  | "pickup";

export type MapMarkerVisibility = "always" | "discovered" | "fullMapOnly" | "never";

export interface MapLineDef {
  id: MapLineId;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: MapLineKind;
  doorId?: string;
  secretId?: string;
  teleporterId?: string;
  discoveredByDefault?: boolean;
  revealOnFullMap?: boolean;
  hideOnMapAlways?: boolean;
}

export interface MapMarkerDef {
  id: MapMarkerId;
  kind: MapMarkerKind;
  x: number;
  y: number;
  visibleWhen: MapMarkerVisibility;
  keyId?: string;
  switchId?: string;
  teleporterId?: string;
  secretId?: string;
  pickupDefId?: string;
  pickupEntityId?: string;
  flagId?: string;
  discoveredByDefault?: boolean;
  revealOnFullMap?: boolean;
  hideOnMapAlways?: boolean;
}

export interface LevelMapDef {
  lines: MapLineDef[];
  markers: MapMarkerDef[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LevelMapBuildCache {
  lineIdsByDiscoveryCell: Record<string, string[]>;
  markerIdsByDiscoveryCell: Record<string, string[]>;
}

export interface LevelMapBuildResult {
  definition: LevelMapDef;
  cache: LevelMapBuildCache;
}

export interface AutomapRuntimeState {
  isOpen: boolean;
  followPlayer: boolean;
  rotateWithPlayer: boolean;
  zoom: number;
  panX: number;
  panY: number;
  fullReveal: boolean;
  discoveredLineIds: Record<string, boolean>;
  discoveredMarkerIds: Record<string, boolean>;
}

export interface AutomapDoorState {
  isOpen: boolean;
  isLocked: boolean;
}

export interface AutomapTeleporterState {
  enabled: boolean;
  revealed: boolean;
}

export interface AutomapSecretState {
  discovered: boolean;
}

export interface AutomapSwitchState {
  enabled: boolean;
  used: boolean;
}

export interface AutomapPickupState {
  defId: string;
  picked: boolean;
}

export interface AutomapRenderSnapshot {
  definition: LevelMapDef;
  runtime: AutomapRuntimeState;
  playerX: number;
  playerY: number;
  playerAngle: number;
  doors: Record<string, AutomapDoorState>;
  teleporters: Record<string, AutomapTeleporterState>;
  secrets: Record<string, AutomapSecretState>;
  switches: Record<string, AutomapSwitchState>;
  flags: Record<string, boolean>;
  pickups: Record<string, AutomapPickupState>;
}

export interface LevelAutomapMarkerDef {
  id: string;
  kind: Exclude<MapMarkerKind, "player">;
  cell?: { x: number; y: number };
  x?: number;
  y?: number;
  visibleWhen?: MapMarkerVisibility;
  keyId?: string;
  switchId?: string;
  teleporterId?: string;
  secretId?: string;
  pickupDefId?: string;
  pickupEntityId?: string;
  flagId?: string;
  revealOnFullMap?: boolean;
  hideOnMapAlways?: boolean;
}

export interface LevelAutomapMetadataDef {
  doorKinds?: Record<string, Extract<MapLineKind, "door" | "secret" | "exit">>;
  markers?: LevelAutomapMarkerDef[];
}
