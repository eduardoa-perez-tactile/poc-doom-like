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
const PROJECTILES_SHEET_URL = new URL("./assets/projectiles.png", import.meta.url).href;

const GOLEM_CELL_WIDTH = 76;
const GOLEM_CELL_HEIGHT = 74;
const WEAPON_CELL_WIDTH = 321;
const WEAPON_CELL_HEIGHT = 176;
const PROJECTILE_CELL_WIDTH = 96;
const PROJECTILE_CELL_HEIGHT = 96;

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

function cellRect(
  cellCol: number,
  cellRow: number,
  rect: SpriteRectDefinition
): SpriteRectDefinition {
  return {
    x: cellCol * WEAPON_CELL_WIDTH + rect.x,
    y: cellRow * WEAPON_CELL_HEIGHT + rect.y,
    width: rect.width,
    height: rect.height
  };
}

function projectileCellFrame(id: string, col: number, row: number): SpriteFrameDefinition {
  return cellFrame(id, col, row, PROJECTILE_CELL_WIDTH, PROJECTILE_CELL_HEIGHT);
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
    flipY: true,
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
    flipY: true,
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
    flipY: true,
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

function buildWeaponViewSet(
  id: string,
  row: number,
  idleCol: number,
  attackCols: number[],
  worldWidth: number,
  worldHeight: number,
  viewModel: SpriteSetDefinition["viewModel"]
): SpriteSetDefinition {
  // Temporary whole-cell slicing for weapon viewmodels.
  // This is convenient for wiring the full roster quickly, but it is not faithful
  // to the Heretic sheet layout: several weapons need hand-authored rect crops,
  // per-frame pivots, and separate Tome frame selections instead of uniform cells.
  const idleFrameId = `${id}_idle`;
  const frames = [cellFrame(idleFrameId, idleCol, row, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT)];
  const attackFrameIds: string[] = [];

  for (let index = 0; index < attackCols.length; index += 1) {
    const frameId = `${id}_attack_${index}`;
    frames.push(cellFrame(frameId, attackCols[index], row, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT));
    attackFrameIds.push(frameId);
  }

  return {
    id: `${id}_set`,
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth,
    worldHeight,
    anchorOffsetY: 0,
    flipY: true,
    pivotX: 0.5,
    pivotY: 1,
    viewModel,
    frames,
    clips: [
      { id: `${id}_idle_clip`, frames: [idleFrameId], fps: 1, loop: true },
      {
        id: `${id}_attack_clip`,
        frames: attackFrameIds,
        fps: 18,
        loop: false
      }
    ],
    animations: [
      { state: "idle", directionalClips: [{ clipId: `${id}_idle_clip` }] },
      { state: "attack", directionalClips: [{ clipId: `${id}_attack_clip` }] }
    ]
  };
}

function buildStaffSet(): SpriteSetDefinition {
  // Row 0 contains the staff strip. The current mapping uses the broad cell bounds,
  // so this is one of the first candidates to replace with explicit rectFrame crops.
  return buildWeaponViewSet("staff", 0, 1, [2, 3], 0.98, 0.76, {
    offsetX: 0.02,
    offsetY: -0.61,
    offsetZ: 0.94,
    bobAmplitude: 0.01,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildGauntletsSet(): SpriteSetDefinition {
  // Row 1 covers the gauntlets strip. Powered/Tome art also lives in this region,
  // but the current pass only wires a single shared idle/attack set.
  return buildWeaponViewSet("gauntlets", 1, 0, [1, 2, 3, 4, 5], 1.14, 0.66, {
    offsetX: 0.02,
    offsetY: -0.68,
    offsetZ: 0.95,
    bobAmplitude: 0.008,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildElvenWandSet(): SpriteSetDefinition {
  return buildWeaponViewSet("elven_wand", 2, 0, [1, 2, 3], 1.06, 0.59, {
    offsetX: 0.02,
    offsetY: -0.66,
    offsetZ: 0.98,
    bobAmplitude: 0.01,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildEtherealCrossbowSet(): SpriteSetDefinition {
  return buildWeaponViewSet("ethereal_crossbow", 2, 5, [6, 7, 8, 9, 10, 11, 12], 1.24, 0.5, {
    offsetX: 0.01,
    offsetY: -0.61,
    offsetZ: 1,
    bobAmplitude: 0.009,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildDragonClawSet(): SpriteSetDefinition {
  return buildWeaponViewSet("dragon_claw", 3, 0, [1, 2, 3], 1.02, 0.62, {
    offsetX: 0.02,
    offsetY: -0.67,
    offsetZ: 0.99,
    bobAmplitude: 0.01,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildHellstaffSet(): SpriteSetDefinition {
  // Hellstaff starts one cell later than the first pass assumed:
  // col 5 is still Dragon Claw powered FX, while the actual Hellstaff idle frame is col 6.
  return buildWeaponViewSet("hellstaff", 3, 6, [7, 8, 9, 10, 11, 12], 1.24, 0.5, {
    offsetX: 0.02,
    offsetY: -0.62,
    offsetZ: 0.99,
    bobAmplitude: 0.009,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildPhoenixRodSet(): SpriteSetDefinition {
  return buildWeaponViewSet("phoenix_rod", 4, 0, [1, 2, 3], 1.08, 0.6, {
    offsetX: 0.02,
    offsetY: -0.68,
    offsetZ: 0.98,
    bobAmplitude: 0.01,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildFiremaceSet(): SpriteSetDefinition {
  // Firemace also starts one cell later than the first pass assumed:
  // col 5 is still the impact strip, while the actual Firemace idle frame is col 6.
  return buildWeaponViewSet("firemace", 4, 6, [7, 8, 9, 10, 11], 1.18, 0.48, {
    offsetX: 0.02,
    offsetY: -0.62,
    offsetZ: 0.99,
    bobAmplitude: 0.008,
    flipX: true,
    flipY: true,
    rotationY: Math.PI
  });
}

function buildElvenProjectileSet(): SpriteSetDefinition {
  // Projectile/effect crops are hand-sliced from the atlas strips on the right side
  // of weapons.png. Elven Wand uses the lower "Tomed Projectile" strip here, not
  // the upper puff/impact strip, so the shot reads as a traveling bolt in-game.
  const frames = [
    rectFrame("elven_projectile_0", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 4, y: 103, width: 11, height: 22 }),
    rectFrame("elven_projectile_1", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 20, y: 102, width: 14, height: 24 }),
    rectFrame("elven_projectile_2", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 39, y: 101, width: 17, height: 26 }),
    rectFrame("elven_projectile_3", 4, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 61, y: 105, width: 13, height: 19 })
  ];

  return {
    id: "elven_projectile_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 0.42,
    worldHeight: 0.7,
    anchorOffsetY: 0.18,
    flipY: true,
    frames,
    clips: [
      {
        id: "elven_projectile_clip",
        frames: [
          "elven_projectile_0",
          "elven_projectile_1",
          "elven_projectile_2",
          "elven_projectile_3"
        ],
        fps: 18,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "elven_projectile_clip" }] }]
  };
}

function buildCrossbowBoltSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("crossbow_bolt_0", 13, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 2, y: 88, width: 26, height: 14 }),
    rectFrame("crossbow_bolt_1", 13, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 30, y: 84, width: 46, height: 18 }),
    rectFrame("crossbow_bolt_2", 13, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 79, y: 81, width: 68, height: 24 }),
    rectFrame("crossbow_bolt_3", 13, 2, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 151, y: 87, width: 40, height: 16 })
  ];

  return {
    id: "crossbow_bolt_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 0.62,
    worldHeight: 0.22,
    anchorOffsetY: 0.16,
    flipY: true,
    frames,
    clips: [
      {
        id: "crossbow_bolt_clip",
        frames: ["crossbow_bolt_0", "crossbow_bolt_1", "crossbow_bolt_2", "crossbow_bolt_3"],
        fps: 14,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "crossbow_bolt_clip" }] }]
  };
}

function buildDragonRipperSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("dragon_ripper_0", 5, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 184, y: 20, width: 17, height: 15 }),
    rectFrame("dragon_ripper_1", 5, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 205, y: 20, width: 20, height: 15 }),
    rectFrame("dragon_ripper_2", 5, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 229, y: 19, width: 28, height: 18 }),
    rectFrame("dragon_ripper_3", 5, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 259, y: 19, width: 24, height: 18 }),
    rectFrame("dragon_ripper_4", 5, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 285, y: 21, width: 12, height: 12 })
  ];

  return {
    id: "dragon_ripper_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 0.72,
    worldHeight: 0.22,
    anchorOffsetY: 0.2,
    flipY: true,
    frames,
    clips: [
      {
        id: "dragon_ripper_clip",
        frames: [
          "dragon_ripper_0",
          "dragon_ripper_1",
          "dragon_ripper_2",
          "dragon_ripper_3",
          "dragon_ripper_4"
        ],
        fps: 16,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "dragon_ripper_clip" }] }]
  };
}

function buildDragonBurstSet(): SpriteSetDefinition {
  const frames = [
    projectileCellFrame("dragon_burst_0", 0, 1),
    projectileCellFrame("dragon_burst_1", 1, 1),
    projectileCellFrame("dragon_burst_2", 2, 1),
    projectileCellFrame("dragon_burst_3", 3, 1)
  ];

  return {
    id: "dragon_burst_set",
    sheetId: "projectiles_sheet",
    defaultState: "idle",
    worldWidth: 0.92,
    worldHeight: 0.92,
    anchorOffsetY: 0.24,
    flipY: true,
    frames,
    clips: [
      {
        id: "dragon_burst_clip",
        frames: ["dragon_burst_0", "dragon_burst_1", "dragon_burst_2", "dragon_burst_3"],
        fps: 12,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "dragon_burst_clip" }] }]
  };
}

function buildHellstaffProjectileSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("hellstaff_proj_0", 13, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 2, y: 16, width: 28, height: 20 }),
    rectFrame("hellstaff_proj_1", 13, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 31, y: 13, width: 36, height: 26 }),
    rectFrame("hellstaff_proj_2", 13, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 69, y: 9, width: 43, height: 34 }),
    rectFrame("hellstaff_proj_3", 13, 3, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 113, y: 5, width: 56, height: 43 })
  ];

  return {
    id: "hellstaff_projectile_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 0.52,
    worldHeight: 0.52,
    anchorOffsetY: 0.18,
    flipY: true,
    frames,
    clips: [
      {
        id: "hellstaff_projectile_clip",
        frames: ["hellstaff_proj_0", "hellstaff_proj_1", "hellstaff_proj_2", "hellstaff_proj_3"],
        fps: 12,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "hellstaff_projectile_clip" }] }]
  };
}

function buildHellstaffCloudSet(): SpriteSetDefinition {
  const frames = [
    projectileCellFrame("hellstaff_cloud_0", 0, 2),
    projectileCellFrame("hellstaff_cloud_1", 1, 2),
    projectileCellFrame("hellstaff_cloud_2", 2, 2)
  ];

  return {
    id: "hellstaff_cloud_set",
    sheetId: "projectiles_sheet",
    defaultState: "idle",
    worldWidth: 1.1,
    worldHeight: 0.92,
    anchorOffsetY: 0.3,
    flipY: true,
    frames,
    clips: [
      {
        id: "hellstaff_cloud_clip",
        frames: ["hellstaff_cloud_0", "hellstaff_cloud_1", "hellstaff_cloud_2"],
        fps: 8,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "hellstaff_cloud_clip" }] }]
  };
}

function buildPhoenixProjectileSet(): SpriteSetDefinition {
  const frames = [
    projectileCellFrame("phoenix_proj_0", 0, 0),
    projectileCellFrame("phoenix_proj_1", 1, 0),
    projectileCellFrame("phoenix_proj_2", 2, 0),
    projectileCellFrame("phoenix_proj_3", 3, 0)
  ];

  return {
    id: "phoenix_projectile_set",
    sheetId: "projectiles_sheet",
    defaultState: "idle",
    // Keep the shared baseline projectile compact and square-ish so it reads as
    // an energy bolt in first person instead of a long horizontal card.
    worldWidth: 0.42,
    worldHeight: 0.42,
    anchorOffsetY: 0.18,
    flipY: true,
    frames,
    clips: [
      {
        id: "phoenix_projectile_clip",
        // Use the most readable compact projectile frame as the shared baseline.
        frames: ["phoenix_proj_0"],
        fps: 1,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "phoenix_projectile_clip" }] }]
  };
}

function buildPhoenixFlameSet(): SpriteSetDefinition {
  const frames = [
    projectileCellFrame("phoenix_flame_0", 0, 3),
    projectileCellFrame("phoenix_flame_1", 1, 3),
    projectileCellFrame("phoenix_flame_2", 2, 3),
    projectileCellFrame("phoenix_flame_3", 3, 3)
  ];

  return {
    id: "phoenix_flame_set",
    sheetId: "projectiles_sheet",
    defaultState: "idle",
    worldWidth: 0.58,
    worldHeight: 0.22,
    anchorOffsetY: 0.14,
    flipY: true,
    frames,
    clips: [
      {
        id: "phoenix_flame_clip",
        frames: ["phoenix_flame_0", "phoenix_flame_1", "phoenix_flame_2", "phoenix_flame_3"],
        fps: 16,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "phoenix_flame_clip" }] }]
  };
}

function buildFiremaceBallSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("firemace_ball_0", 12, 4, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 4, y: 17, width: 13, height: 13 }),
    rectFrame("firemace_ball_1", 12, 4, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 22, y: 16, width: 17, height: 17 }),
    rectFrame("firemace_ball_2", 12, 4, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 44, y: 12, width: 26, height: 26 }),
    rectFrame("firemace_ball_3", 12, 4, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 71, y: 9, width: 37, height: 37 })
  ];

  return {
    id: "firemace_ball_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 1.1,
    worldHeight: 1.1,
    anchorOffsetY: 0.24,
    flipY: true,
    frames,
    clips: [
      {
        id: "firemace_ball_clip",
        frames: ["firemace_ball_0", "firemace_ball_1", "firemace_ball_2", "firemace_ball_3"],
        fps: 10,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "firemace_ball_clip" }] }]
  };
}

function buildFiremacePoweredBallSet(): SpriteSetDefinition {
  const frames = [
    rectFrame("firemace_powered_ball_0", 12, 4, WEAPON_CELL_WIDTH, WEAPON_CELL_HEIGHT, { x: 1, y: 105, width: 48, height: 48 })
  ];

  return {
    id: "firemace_powered_ball_set",
    sheetId: "weapons_sheet",
    defaultState: "idle",
    worldWidth: 1.26,
    worldHeight: 1.26,
    anchorOffsetY: 0.24,
    flipY: true,
    frames,
    clips: [
      {
        id: "firemace_powered_ball_clip",
        frames: ["firemace_powered_ball_0"],
        fps: 1,
        loop: true
      }
    ],
    animations: [{ state: "idle", directionalClips: [{ clipId: "firemace_powered_ball_clip" }] }]
  };
}

function weaponLabelClearRects(): SpriteRectDefinition[] {
  return [
    ...Array.from({ length: 5 }, (_, row) => ({
      x: 0,
      y: row * WEAPON_CELL_HEIGHT,
      width: 4495,
      height: 15
    })),
    ...projectileLabelClearRects()
  ];
}

function projectileLabelClearRects(): SpriteRectDefinition[] {
  // The projectile/effect atlas cells on the right side of weapons.png include
  // embedded white guide labels inside the cell, not just along the row header.
  // Clear those bands before chroma-keying so the in-game bullets cannot sample text.
  return [
    cellRect(4, 2, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(4, 2, { x: 0, y: 84, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(13, 2, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(13, 2, { x: 0, y: 84, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(5, 3, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(5, 3, { x: 0, y: 84, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(13, 3, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(13, 3, { x: 0, y: 84, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(13, 3, { x: 0, y: 154, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(4, 4, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(4, 4, { x: 0, y: 84, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(5, 4, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(12, 4, { x: 0, y: 0, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(12, 4, { x: 0, y: 84, width: WEAPON_CELL_WIDTH, height: 16 }),
    cellRect(12, 4, { x: 0, y: 154, width: WEAPON_CELL_WIDTH, height: 16 })
  ];
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
    },
    {
      id: "projectiles_sheet",
      imageUrl: PROJECTILES_SHEET_URL,
      chromaKeyColors: []
    }
  ],
  spriteSets: [
    buildGolemSet(),
    buildGolemSoulSet(),
    buildBandageSet(),
    buildStaffSet(),
    buildGauntletsSet(),
    buildElvenWandSet(),
    buildEtherealCrossbowSet(),
    buildDragonClawSet(),
    buildHellstaffSet(),
    buildPhoenixRodSet(),
    buildFiremaceSet(),
    buildElvenProjectileSet(),
    buildCrossbowBoltSet(),
    buildDragonRipperSet(),
    buildDragonBurstSet(),
    buildHellstaffProjectileSet(),
    buildHellstaffCloudSet(),
    buildPhoenixProjectileSet(),
    buildPhoenixFlameSet(),
    buildFiremaceBallSet(),
    buildFiremacePoweredBallSet()
  ],
  entities: [
    { entityId: "grave_thrall", spriteSetId: "golem_set" },
    { entityId: "pickup:ammo", spriteSetId: "golem_soul_set" },
    { entityId: "pickup:health", spriteSetId: "bandage_set" },
    { entityId: "weapon:staff", spriteSetId: "staff_set" },
    { entityId: "weapon:gauntlets_of_the_necromancer", spriteSetId: "gauntlets_set" },
    { entityId: "weapon:elven_wand", spriteSetId: "elven_wand_set" },
    { entityId: "weapon:ethereal_crossbow", spriteSetId: "ethereal_crossbow_set" },
    { entityId: "weapon:dragon_claw", spriteSetId: "dragon_claw_set" },
    { entityId: "weapon:hellstaff", spriteSetId: "hellstaff_set" },
    { entityId: "weapon:phoenix_rod", spriteSetId: "phoenix_rod_set" },
    { entityId: "weapon:firemace", spriteSetId: "firemace_set" },
    // Normalized projectile baseline: most live shots share the dedicated
    // projectiles sheet until each weapon gets a tuned unique projectile set.
    { entityId: "projectile:elven_wand", spriteSetId: "phoenix_projectile_set" },
    { entityId: "projectile:ethereal_crossbow", spriteSetId: "phoenix_projectile_set" },
    { entityId: "projectile:dragon_claw", spriteSetId: "phoenix_projectile_set" },
    { entityId: "projectile:dragon_claw_burst", spriteSetId: "dragon_burst_set" },
    { entityId: "projectile:hellstaff", spriteSetId: "phoenix_projectile_set" },
    { entityId: "projectile:hellstaff_cloud", spriteSetId: "hellstaff_cloud_set" },
    { entityId: "projectile:phoenix_rod", spriteSetId: "phoenix_projectile_set" },
    { entityId: "projectile:phoenix_flame", spriteSetId: "phoenix_flame_set" },
    { entityId: "projectile:firemace", spriteSetId: "phoenix_projectile_set" },
    { entityId: "projectile:firemace_powered", spriteSetId: "phoenix_projectile_set" }
  ]
};
