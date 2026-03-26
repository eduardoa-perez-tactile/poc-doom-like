import type {
  DirectionalSpriteClipDefinition,
  SpriteFrameDefinition,
  SpriteRectDefinition,
  SpriteClipDefinition,
  SpriteSetDefinition,
  VisualDatabaseDefinition
} from "./types";

const GOLEM_SHEET_URL = new URL("./assets/golem.png", import.meta.url).href;
const WEAPONS_SHEET_URL = new URL("./assets/weapons.png", import.meta.url).href;

const GOLEM_CELL_WIDTH = 76;
const GOLEM_CELL_HEIGHT = 74;
const WEAPON_CELL_WIDTH = 321;
const WEAPON_CELL_HEIGHT = 176;

function cellFrame(
  id: string,
  col: number,
  row: number,
  cellWidth: number,
  cellHeight: number
): SpriteFrameDefinition {
  return {
    id,
    x: col * cellWidth + 1,
    y: row * cellHeight + 1,
    width: cellWidth - 1,
    height: cellHeight - 1
  };
}

function rectFrame(
  id: string,
  cellCol: number,
  cellRow: number,
  cellWidth: number,
  cellHeight: number,
  rect: SpriteRectDefinition
): SpriteFrameDefinition {
  return {
    id,
    x: cellCol * cellWidth + rect.x,
    y: cellRow * cellHeight + rect.y,
    width: rect.width,
    height: rect.height
  };
}

function mirroredFiveDirections(clipIds: string[]): DirectionalSpriteClipDefinition[] {
  if (clipIds.length !== 5) {
    throw new Error("Expected 5 directional clips for mirrored Doom-style sprites.");
  }

  return [
    { clipId: clipIds[0] },
    { clipId: clipIds[1] },
    { clipId: clipIds[2] },
    { clipId: clipIds[3] },
    { clipId: clipIds[4] },
    { clipId: clipIds[3], mirrorX: true },
    { clipId: clipIds[2], mirrorX: true },
    { clipId: clipIds[1], mirrorX: true }
  ];
}

function repeatedDirections(clipId: string, count = 8): DirectionalSpriteClipDefinition[] {
  return Array.from({ length: count }, () => ({ clipId }));
}

function buildGolemSet(): SpriteSetDefinition {
  const frames: SpriteFrameDefinition[] = [];
  const clips: SpriteClipDefinition[] = [];

  const idleClipIds: string[] = [];
  const walkClipIds: string[] = [];
  const meleeClipIds: string[] = [];
  const painClipIds: string[] = [];

  for (let row = 0; row < 5; row += 1) {
    const walkFrameIds: string[] = [];
    for (let col = 0; col < 4; col += 1) {
      const frameId = `golem_walk_r${row}_f${col}`;
      frames.push(cellFrame(frameId, col, row, GOLEM_CELL_WIDTH, GOLEM_CELL_HEIGHT));
      walkFrameIds.push(frameId);
    }

    const meleeFrameIds: string[] = [];
    for (let col = 4; col < 8; col += 1) {
      const frameId = `golem_melee_r${row}_f${col - 4}`;
      frames.push(cellFrame(frameId, col, row, GOLEM_CELL_WIDTH, GOLEM_CELL_HEIGHT));
      meleeFrameIds.push(frameId);
    }

    const painFrameId = `golem_pain_r${row}`;
    frames.push(cellFrame(painFrameId, 9, row, GOLEM_CELL_WIDTH, GOLEM_CELL_HEIGHT));

    const idleClipId = `golem_idle_r${row}`;
    const walkClipId = `golem_walk_r${row}`;
    const meleeClipId = `golem_melee_r${row}`;
    const painClipId = `golem_pain_r${row}`;

    idleClipIds.push(idleClipId);
    walkClipIds.push(walkClipId);
    meleeClipIds.push(meleeClipId);
    painClipIds.push(painClipId);

    clips.push({ id: idleClipId, frames: [walkFrameIds[0]], fps: 1, loop: true });
    clips.push({ id: walkClipId, frames: walkFrameIds, fps: 7, loop: true });
    clips.push({ id: meleeClipId, frames: meleeFrameIds, fps: 8, loop: false });
    clips.push({ id: painClipId, frames: [painFrameId], fps: 1, loop: false });
  }

  const deathFrameIds: string[] = [];
  for (let row = 0; row < 8; row += 1) {
    const frameId = `golem_death_f${row}`;
    frames.push(cellFrame(frameId, 10, row, GOLEM_CELL_WIDTH, GOLEM_CELL_HEIGHT));
    deathFrameIds.push(frameId);
  }
  clips.push({ id: "golem_death", frames: deathFrameIds, fps: 7, loop: false });

  return {
    id: "golem_set",
    sheetId: "golem_sheet",
    defaultState: "idle",
    worldWidth: 1.55,
    worldHeight: 1.8,
    anchorOffsetY: 0.9,
    frames,
    clips,
    animations: [
      { state: "idle", directionalClips: mirroredFiveDirections(idleClipIds) },
      { state: "move", directionalClips: mirroredFiveDirections(walkClipIds) },
      { state: "attack", directionalClips: mirroredFiveDirections(meleeClipIds) },
      { state: "hurt", directionalClips: mirroredFiveDirections(painClipIds) },
      { state: "death", directionalClips: repeatedDirections("golem_death") }
    ]
  };
}

function buildGolemSoulSet(): SpriteSetDefinition {
  const frames = Array.from({ length: 6 }, (_, index) =>
    cellFrame(`golem_soul_${index}`, index, 5, GOLEM_CELL_WIDTH, GOLEM_CELL_HEIGHT)
  );

  return {
    id: "golem_soul_set",
    sheetId: "golem_sheet",
    defaultState: "idle",
    worldWidth: 0.82,
    worldHeight: 0.82,
    anchorOffsetY: 0.45,
    frames,
    clips: [
      {
        id: "golem_soul_idle",
        frames: frames.map((frame) => frame.id),
        fps: 10,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "golem_soul_idle" }] }]
  };
}

function buildBandageSet(): SpriteSetDefinition {
  const frames = Array.from({ length: 4 }, (_, index) =>
    cellFrame(`bandage_${index}`, index, 6, GOLEM_CELL_WIDTH, GOLEM_CELL_HEIGHT)
  );

  return {
    id: "bandage_set",
    sheetId: "golem_sheet",
    defaultState: "idle",
    worldWidth: 0.82,
    worldHeight: 0.82,
    anchorOffsetY: 0.45,
    frames,
    clips: [
      {
        id: "bandage_idle",
        frames: frames.map((frame) => frame.id),
        fps: 7,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "bandage_idle" }] }]
  };
}

function buildElvenWandSet(): SpriteSetDefinition {
  const frames = [
    cellFrame("elven_wand_idle", 0, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT),
    cellFrame("elven_wand_attack_0", 1, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT),
    cellFrame("elven_wand_attack_1", 2, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT),
    cellFrame("elven_wand_attack_2", 3, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT)
  ];

  return {
    id: "elven_wand_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 1.06,
    worldHeight: 0.59,
    anchorOffsetY: 0,
    pivotX: 0.5,
    pivotY: 1,
    viewModel: {
      offsetX: 0.02,
      offsetY: -0.66,
      offsetZ: 0.98,
      bobAmplitude: 0.01,
      flipX: true,
      flipY: true,
      rotationY: Math.PI,
      rotationZ: 0
    },
    frames,
    clips: [
      { id: "elven_wand_idle_clip", frames: ["elven_wand_idle"], fps: 1, loop: true },
      {
        id: "elven_wand_attack_clip",
        frames: ["elven_wand_attack_0", "elven_wand_attack_1", "elven_wand_attack_2"],
        fps: 18,
        loop: false
      }
    ],
    animations: [
      { state: "idle", directionalClips: [{ clipId: "elven_wand_idle_clip" }] },
      { state: "attack", directionalClips: [{ clipId: "elven_wand_attack_clip" }] }
    ]
  };
}

function buildDragonClawSet(): SpriteSetDefinition {
  const frames = [
    cellFrame("dragon_claw_idle", 0, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT),
    cellFrame("dragon_claw_attack_0", 1, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT),
    cellFrame("dragon_claw_attack_1", 2, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT),
    cellFrame("dragon_claw_attack_2", 3, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT)
  ];

  return {
    id: "dragon_claw_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 1.1,
    worldHeight: 0.61,
    anchorOffsetY: 0,
    pivotX: 0.5,
    pivotY: 1,
    viewModel: {
      offsetX: 0.02,
      offsetY: -0.69,
      offsetZ: 0.98,
      bobAmplitude: 0.01,
      flipX: true,
      flipY: true,
      rotationY: Math.PI,
      rotationZ: 0
    },
    frames,
    clips: [
      { id: "dragon_claw_idle_clip", frames: ["dragon_claw_idle"], fps: 1, loop: true },
      {
        id: "dragon_claw_attack_clip",
        frames: ["dragon_claw_attack_0", "dragon_claw_attack_1", "dragon_claw_attack_2"],
        fps: 20,
        loop: false
      }
    ],
    animations: [
      { state: "idle", directionalClips: [{ clipId: "dragon_claw_idle_clip" }] },
      { state: "attack", directionalClips: [{ clipId: "dragon_claw_attack_clip" }] }
    ]
  };
}

function buildElvenProjectileSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("elven_puff_0", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 1, y: 118, width: 29, height: 31 }),
    rectFrame("elven_puff_1", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 31, y: 121, width: 25, height: 25 }),
    rectFrame("elven_puff_2", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 57, y: 124, width: 17, height: 19 }),
    rectFrame("elven_puff_3", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 75, y: 129, width: 9, height: 9 })
  ];

  return {
    id: "elven_puff_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 0.34,
    worldHeight: 0.34,
    anchorOffsetY: 0.16,
    frames,
    clips: [
      {
        id: "elven_puff_clip",
        frames: ["elven_puff_0", "elven_puff_1", "elven_puff_2", "elven_puff_3"],
        fps: 12,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "elven_puff_clip" }] }]
  };
}

function buildDragonProjectileSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("dragon_bolt_0", 4, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 1, y: 42, width: 29, height: 29 }),
    rectFrame("dragon_bolt_1", 4, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 31, y: 45, width: 23, height: 23 }),
    rectFrame("dragon_bolt_2", 4, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 55, y: 47, width: 19, height: 19 }),
    rectFrame("dragon_bolt_3", 4, 1, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 31, y: 45, width: 23, height: 23 })
  ];

  return {
    id: "dragon_bolt_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 0.32,
    worldHeight: 0.32,
    anchorOffsetY: 0.16,
    frames,
    clips: [
      {
        id: "dragon_bolt_clip",
        frames: ["dragon_bolt_0", "dragon_bolt_1", "dragon_bolt_2", "dragon_bolt_3"],
        fps: 14,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "dragon_bolt_clip" }] }]
  };
}

function weaponLabelClearRects(): SpriteRectDefinition[] {
  return Array.from({ length: 5 }, (_, row) => ({
    x: 0,
    y: row * WEAPON_CELL_HEIGHT,
    width: 4495,
    height: 15
  }));
}

export const spriteManifest: VisualDatabaseDefinition = {
  sheets: [
    {
      id: "golem_sheet",
      imageUrl: GOLEM_SHEET_URL,
      chromaKeyColors: ["#00FFFF", "#008080"],
      clearRects: [
        { x: 0, y: 0, width: 837, height: 15 },
        { x: 0, y: 5 * GOLEM_CELL_HEIGHT, width: 837, height: 15 },
        { x: 0, y: 6 * GOLEM_CELL_HEIGHT, width: 837, height: 15 }
      ]
    },
    {
      id: "weapons_sheet",
      imageUrl: WEAPONS_SHEET_URL,
      chromaKeyColors: ["#00FFFF", "#008080"],
      clearRects: weaponLabelClearRects()
    }
  ],
  spriteSets: [
    buildGolemSet(),
    buildGolemSoulSet(),
    buildBandageSet(),
    buildElvenWandSet(),
    buildDragonClawSet(),
    buildElvenProjectileSet(),
    buildDragonProjectileSet()
  ],
  entities: [
    { entityId: "grave_thrall", spriteSetId: "golem_set" },
    { entityId: "pickup:ammo", spriteSetId: "golem_soul_set" },
    { entityId: "pickup:health", spriteSetId: "bandage_set" },
    { entityId: "weapon:ember_wand", spriteSetId: "elven_wand_set" },
    { entityId: "weapon:shard_caster", spriteSetId: "dragon_claw_set" },
    { entityId: "projectile:ember_wand", spriteSetId: "elven_puff_set" },
    { entityId: "projectile:shard_caster", spriteSetId: "dragon_bolt_set" }
  ]
};
