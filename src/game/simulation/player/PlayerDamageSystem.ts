import type { PlayerState } from "../../core/types";

export interface PlayerDamageResult {
  appliedDamage: number;
  absorbedArmor: number;
  died: boolean;
}

export function applyDamageToPlayer(player: PlayerState, amount: number): PlayerDamageResult {
  if (!player.alive || amount <= 0 || player.derived.invulnerable) {
    return {
      appliedDamage: 0,
      absorbedArmor: 0,
      died: false
    };
  }

  let remainingDamage = amount;
  let absorbedArmor = 0;
  if (player.resources.armor > 0) {
    absorbedArmor = Math.min(
      player.resources.armor,
      Math.ceil(amount * player.derived.armorAbsorbRatio)
    );
    player.resources.armor -= absorbedArmor;
    remainingDamage -= absorbedArmor;
  }

  player.resources.health = Math.max(0, player.resources.health - remainingDamage);
  if (player.resources.health <= 0) {
    player.alive = false;
  }

  return {
    appliedDamage: remainingDamage,
    absorbedArmor,
    died: !player.alive
  };
}
