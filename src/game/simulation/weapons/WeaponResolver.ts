import type { ContentDatabase } from "../../content/types";
import type { PlayerState, ResolvedWeaponContext, WeaponState } from "../../core/types";

export function resolveWeaponContext(
  weaponState: WeaponState,
  player: PlayerState,
  content: ContentDatabase
): ResolvedWeaponContext {
  const weapon = content.weapons.get(weaponState.currentId);
  if (!weapon) {
    throw new Error(`Unknown weapon definition: ${weaponState.currentId}`);
  }

  const powered = player.derived.weaponPowered;
  const ammoType = weapon.ammoType === "none" ? null : weapon.ammoType;
  const rawAmmoCost = powered ? weapon.ammoCostPowered : weapon.ammoCostBase;
  const rawCooldown = powered ? weapon.cooldownPowered : weapon.cooldownBase;

  return {
    weaponId: weapon.id,
    powered,
    ammoType,
    ammoCost: ammoType ? Math.max(0, Math.ceil(rawAmmoCost * player.derived.ammoUseScale)) : 0,
    cooldown: rawCooldown * player.derived.weaponCooldownScale,
    behavior: powered ? weapon.poweredBehavior : weapon.baseBehavior,
    damageScale: player.derived.weaponDamageScale
  };
}

export function hasAmmoForResolvedWeapon(
  context: ResolvedWeaponContext,
  player: PlayerState
): boolean {
  if (!context.ammoType || context.ammoCost <= 0) {
    return true;
  }
  return player.resources.ammo[context.ammoType] >= context.ammoCost;
}

export function spendResolvedWeaponAmmo(
  context: ResolvedWeaponContext,
  player: PlayerState
): void {
  if (!context.ammoType || context.ammoCost <= 0) {
    return;
  }
  player.resources.ammo[context.ammoType] = Math.max(
    0,
    player.resources.ammo[context.ammoType] - context.ammoCost
  );
}
