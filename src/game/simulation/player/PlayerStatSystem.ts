import type {
  AmmoType
} from "../../content/types";
import type {
  BaseStats,
  DerivedStats,
  PlayerProgressionState,
  PlayerRuntimeResources,
  PlayerState,
  StatModifier
} from "../../core/types";
import { clamp } from "../../core/math";

export const AMMO_TYPES: AmmoType[] = [
  "wand",
  "crossbow",
  "claw",
  "hellstaff",
  "phoenix",
  "firemace"
];

export const PLAYER_EFFECT_DURATIONS = {
  invulnerable: 15,
  partialInvisibility: 20,
  flight: 18,
  torch: 40,
  tomeOfPower: 20
} as const;

type NumericDerivedStat =
  | "maxHealth"
  | "maxArmor"
  | "moveSpeed"
  | "radius"
  | "inventoryCapacity"
  | "armorAbsorbRatio"
  | "weaponDamageScale"
  | "weaponCooldownScale"
  | "ammoUseScale";

type BooleanDerivedStat =
  | "invulnerable"
  | "partialInvisibility"
  | "canFly"
  | "torchActive"
  | "weaponPowered";

const BAG_OF_HOLDING_UPGRADE_ID = "bag_of_holding";

const UPGRADE_FLAG_MODIFIERS: Record<string, StatModifier[]> = {
  [BAG_OF_HOLDING_UPGRADE_ID]: [
    {
      sourceId: BAG_OF_HOLDING_UPGRADE_ID,
      sourceType: "pickup",
      stat: "inventoryCapacity",
      mode: "add",
      value: 8
    },
    ...AMMO_TYPES.map(
      (ammoType): StatModifier => ({
        sourceId: BAG_OF_HOLDING_UPGRADE_ID,
        sourceType: "pickup",
        stat: "ammoCapacity",
        ammoType,
        mode: "mul",
        value: 2
      })
    )
  ]
};

export function createDefaultBaseStats(cellSize: number): BaseStats {
  return {
    maxHealth: 100,
    maxArmor: 200,
    moveSpeed: 5.8,
    radius: 0.28 * cellSize,
    inventoryCapacity: 16,
    armorAbsorbRatio: 0.5,
    ammoCapacity: {
      wand: 200,
      crossbow: 100,
      claw: 200,
      hellstaff: 100,
      phoenix: 50,
      firemace: 50
    }
  };
}

export function createDefaultPlayerProgression(cellSize: number): PlayerProgressionState {
  return {
    baseStats: createDefaultBaseStats(cellSize),
    upgradeFlags: [],
    permanentModifiers: []
  };
}

export function createDefaultPlayerResources(): PlayerRuntimeResources {
  return {
    health: 100,
    armor: 0,
    ammo: {
      wand: 70,
      crossbow: 30,
      claw: 60,
      hellstaff: 30,
      phoenix: 20,
      firemace: 18
    },
    keys: [],
    inventory: [],
    selectedInventoryIndex: 0
  };
}

export function createDefaultPlayerEffects() {
  return {
    invulnerable: 0,
    partialInvisibility: 0,
    flight: 0,
    torch: 0,
    tomeOfPower: 0
  };
}

export function createInitialPlayerState(params: {
  x: number;
  y: number;
  angle: number;
  cellSize: number;
}): PlayerState {
  const player: PlayerState = {
    x: params.x,
    y: params.y,
    angle: params.angle,
    bobPhase: 0,
    alive: true,
    flags: [],
    runtimeModifiers: [],
    progression: createDefaultPlayerProgression(params.cellSize),
    resources: createDefaultPlayerResources(),
    effects: createDefaultPlayerEffects(),
    derived: createDefaultDerivedStats(createDefaultBaseStats(params.cellSize))
  };
  recomputePlayerDerivedState(player);
  return player;
}

export function createDefaultDerivedStats(baseStats: BaseStats): DerivedStats {
  return {
    maxHealth: baseStats.maxHealth,
    maxArmor: baseStats.maxArmor,
    moveSpeed: baseStats.moveSpeed,
    radius: baseStats.radius,
    inventoryCapacity: baseStats.inventoryCapacity,
    armorAbsorbRatio: baseStats.armorAbsorbRatio,
    ammoCapacity: { ...baseStats.ammoCapacity },
    invulnerable: false,
    partialInvisibility: false,
    canFly: false,
    torchActive: false,
    weaponPowered: false,
    weaponDamageScale: 1,
    weaponCooldownScale: 1,
    ammoUseScale: 1
  };
}

export function recomputePlayerDerivedState(
  player: PlayerState,
  externalModifiers: readonly StatModifier[] = []
): void {
  player.derived = computeDerivedStats(player.progression, player.effects, [
    ...player.runtimeModifiers,
    ...externalModifiers
  ]);
  clampPlayerResources(player);
}

export function computeDerivedStats(
  progression: PlayerProgressionState,
  effects: PlayerState["effects"],
  externalModifiers: readonly StatModifier[] = []
): DerivedStats {
  const modifiers = [
    ...progression.permanentModifiers,
    ...resolveUpgradeFlagModifiers(progression.upgradeFlags),
    ...createEffectModifiers(effects),
    ...externalModifiers
  ];

  const derived = createDefaultDerivedStats(progression.baseStats);
  derived.maxHealth = resolveNumericStat("maxHealth", progression.baseStats.maxHealth, modifiers);
  derived.maxArmor = resolveNumericStat("maxArmor", progression.baseStats.maxArmor, modifiers);
  derived.moveSpeed = resolveNumericStat("moveSpeed", progression.baseStats.moveSpeed, modifiers);
  derived.radius = resolveNumericStat("radius", progression.baseStats.radius, modifiers);
  derived.inventoryCapacity = resolveNumericStat(
    "inventoryCapacity",
    progression.baseStats.inventoryCapacity,
    modifiers
  );
  derived.armorAbsorbRatio = resolveNumericStat(
    "armorAbsorbRatio",
    progression.baseStats.armorAbsorbRatio,
    modifiers
  );
  derived.weaponDamageScale = resolveNumericStat("weaponDamageScale", 1, modifiers);
  derived.weaponCooldownScale = resolveNumericStat("weaponCooldownScale", 1, modifiers);
  derived.ammoUseScale = resolveNumericStat("ammoUseScale", 1, modifiers);

  for (const ammoType of AMMO_TYPES) {
    derived.ammoCapacity[ammoType] = resolveAmmoCapacityStat(
      ammoType,
      progression.baseStats.ammoCapacity[ammoType],
      modifiers
    );
  }

  derived.invulnerable = resolveBooleanStat("invulnerable", false, modifiers);
  derived.partialInvisibility = resolveBooleanStat("partialInvisibility", false, modifiers);
  derived.canFly = resolveBooleanStat("canFly", false, modifiers);
  derived.torchActive = resolveBooleanStat("torchActive", false, modifiers);
  derived.weaponPowered = resolveBooleanStat("weaponPowered", false, modifiers);
  return derived;
}

export function clampPlayerResources(player: PlayerState): void {
  player.resources.health = clamp(player.resources.health, 0, player.derived.maxHealth);
  player.resources.armor = clamp(player.resources.armor, 0, player.derived.maxArmor);
  for (const ammoType of AMMO_TYPES) {
    player.resources.ammo[ammoType] = clamp(
      player.resources.ammo[ammoType],
      0,
      player.derived.ammoCapacity[ammoType]
    );
  }
  if (player.resources.inventory.length === 0) {
    player.resources.selectedInventoryIndex = 0;
    return;
  }
  player.resources.selectedInventoryIndex = clamp(
    player.resources.selectedInventoryIndex,
    0,
    player.resources.inventory.length - 1
  );
}

export function hasAmmoSpace(player: PlayerState, ammoType: AmmoType): boolean {
  return player.resources.ammo[ammoType] < player.derived.ammoCapacity[ammoType];
}

export function addAmmo(player: PlayerState, ammoType: AmmoType, amount: number): void {
  player.resources.ammo[ammoType] = clamp(
    player.resources.ammo[ammoType] + amount,
    0,
    player.derived.ammoCapacity[ammoType]
  );
}

export function healPlayer(player: PlayerState, amount: number): void {
  player.resources.health = clamp(player.resources.health + amount, 0, player.derived.maxHealth);
}

export function restorePlayerToFullHealth(player: PlayerState): void {
  player.resources.health = player.derived.maxHealth;
}

export function addArmor(player: PlayerState, amount: number): void {
  player.resources.armor = clamp(player.resources.armor + amount, 0, player.derived.maxArmor);
}

export function addKey(player: PlayerState, key: string): void {
  if (!player.resources.keys.includes(key)) {
    player.resources.keys.push(key);
  }
}

export function canAddInventoryItem(player: PlayerState, itemDefId: string, maxCarry?: number): boolean {
  const entry = player.resources.inventory.find((item) => item.itemDefId === itemDefId);
  if (entry) {
    return maxCarry === undefined || entry.count < maxCarry;
  }
  return player.resources.inventory.length < player.derived.inventoryCapacity;
}

export function addInventoryItem(player: PlayerState, itemDefId: string, maxCarry?: number): boolean {
  const entry = player.resources.inventory.find((item) => item.itemDefId === itemDefId);
  if (entry) {
    entry.count = Math.min(maxCarry ?? Number.MAX_SAFE_INTEGER, entry.count + 1);
    return true;
  }
  if (player.resources.inventory.length >= player.derived.inventoryCapacity) {
    return false;
  }
  player.resources.inventory.push({ itemDefId, count: 1 });
  player.resources.selectedInventoryIndex = Math.max(0, player.resources.inventory.length - 1);
  return true;
}

export function setPlayerEffectTimer(
  player: PlayerState,
  effectId: keyof PlayerState["effects"],
  duration: number
): void {
  player.effects[effectId] = duration;
  recomputePlayerDerivedState(player);
}

export function tickPlayerEffects(player: PlayerState, dt: number): void {
  player.effects.invulnerable = Math.max(0, player.effects.invulnerable - dt);
  player.effects.partialInvisibility = Math.max(0, player.effects.partialInvisibility - dt);
  player.effects.flight = Math.max(0, player.effects.flight - dt);
  player.effects.torch = Math.max(0, player.effects.torch - dt);
  player.effects.tomeOfPower = Math.max(0, player.effects.tomeOfPower - dt);
  recomputePlayerDerivedState(player);
}

export function toggleTimedPlayerEffect(
  player: PlayerState,
  effectId: keyof PlayerState["effects"],
  duration: number
): boolean {
  player.effects[effectId] = player.effects[effectId] > 0 ? 0 : duration;
  recomputePlayerDerivedState(player);
  return player.effects[effectId] > 0;
}

export function hasPlayerUpgrade(player: PlayerState, upgradeId: string): boolean {
  return player.progression.upgradeFlags.includes(upgradeId);
}

export function grantPlayerUpgrade(player: PlayerState, upgradeId: string): boolean {
  if (hasPlayerUpgrade(player, upgradeId)) {
    return false;
  }
  player.progression.upgradeFlags.push(upgradeId);
  recomputePlayerDerivedState(player);
  return true;
}

export function addPermanentModifier(player: PlayerState, modifier: StatModifier): void {
  player.progression.permanentModifiers.push(modifier);
  recomputePlayerDerivedState(player);
}

function resolveUpgradeFlagModifiers(upgradeFlags: readonly string[]): StatModifier[] {
  return upgradeFlags.flatMap((upgradeId) => UPGRADE_FLAG_MODIFIERS[upgradeId] ?? []);
}

function createEffectModifiers(effects: PlayerState["effects"]): StatModifier[] {
  const modifiers: StatModifier[] = [];
  if (effects.invulnerable > 0) {
    modifiers.push(effectBooleanModifier("invulnerable"));
  }
  if (effects.partialInvisibility > 0) {
    modifiers.push(effectBooleanModifier("partialInvisibility"));
  }
  if (effects.flight > 0) {
    modifiers.push(effectBooleanModifier("canFly"));
  }
  if (effects.torch > 0) {
    modifiers.push(effectBooleanModifier("torchActive"));
  }
  if (effects.tomeOfPower > 0) {
    modifiers.push(effectBooleanModifier("weaponPowered"));
  }
  return modifiers;
}

function effectBooleanModifier(stat: BooleanDerivedStat): StatModifier {
  return {
    sourceId: `effect:${stat}`,
    sourceType: "powerup",
    stat,
    mode: "set",
    value: true
  };
}

function resolveNumericStat(
  stat: NumericDerivedStat,
  baseValue: number,
  modifiers: readonly StatModifier[]
): number {
  let currentValue = baseValue;
  for (const modifier of modifiers) {
    if (modifier.stat !== stat) {
      continue;
    }
    switch (modifier.mode) {
      case "set":
        currentValue = modifier.value;
        break;
      case "add":
        currentValue += modifier.value;
        break;
      case "mul":
        currentValue *= modifier.value;
        break;
      case "max":
        currentValue = Math.max(currentValue, modifier.value);
        break;
      default:
        break;
    }
  }
  return currentValue;
}

function resolveAmmoCapacityStat(
  ammoType: AmmoType,
  baseValue: number,
  modifiers: readonly StatModifier[]
): number {
  let currentValue = baseValue;
  for (const modifier of modifiers) {
    if (modifier.stat !== "ammoCapacity" || modifier.ammoType !== ammoType) {
      continue;
    }
    switch (modifier.mode) {
      case "set":
        currentValue = modifier.value;
        break;
      case "add":
        currentValue += modifier.value;
        break;
      case "mul":
        currentValue *= modifier.value;
        break;
      case "max":
        currentValue = Math.max(currentValue, modifier.value);
        break;
      default:
        break;
    }
  }
  return currentValue;
}

function resolveBooleanStat(
  stat: BooleanDerivedStat,
  baseValue: boolean,
  modifiers: readonly StatModifier[]
): boolean {
  let currentValue = baseValue;
  for (const modifier of modifiers) {
    if (modifier.stat === stat) {
      currentValue = modifier.value;
    }
  }
  return currentValue;
}
