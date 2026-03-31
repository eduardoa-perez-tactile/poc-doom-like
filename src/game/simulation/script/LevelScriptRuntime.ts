import type { LevelScriptDef, LevelScriptRuntimeState } from "./LevelScriptTypes";

export function createInitialLevelScriptRuntime(script: LevelScriptDef | undefined): LevelScriptRuntimeState | null {
  if (!script) {
    return null;
  }

  const flags: Record<string, boolean> = { ...(script.flags ?? {}) };
  const triggers = Object.fromEntries(
    (script.triggers ?? []).map((trigger) => [
      trigger.id,
      {
        fired: false,
        enabled: trigger.enabled ?? true,
        cooldownRemaining: 0,
        elapsedSeconds: 0,
        wasInside: false
      }
    ])
  );
  const switches = Object.fromEntries(
    (script.switches ?? []).map((switchDef) => [
      switchDef.id,
      {
        used: false,
        enabled: switchDef.startsEnabled ?? true
      }
    ])
  );
  const doors = Object.fromEntries(
    (script.doors ?? []).map((door) => [
      door.id,
      {
        isOpen: door.startsOpen ?? false,
        isLocked: door.locked ?? Boolean(door.requiredKeyId)
      }
    ])
  );
  const teleporters = Object.fromEntries(
    (script.teleporters ?? []).map((teleporter) => [
      teleporter.id,
      {
        enabled: teleporter.enabled ?? true,
        revealed: teleporter.revealByDefault ?? true
      }
    ])
  );
  const secrets = Object.fromEntries(
    (script.secrets ?? []).map((secret) => [
      secret.id,
      {
        discovered: false
      }
    ])
  );
  const floorRegions = Object.fromEntries(
    (script.floorRegions ?? []).map((region) => [
      region.id,
      {
        height: region.initialHeight ?? 0
      }
    ])
  );

  return {
    flags,
    triggers,
    switches,
    doors,
    teleporters,
    secrets,
    floorRegions,
    teleporterCooldownRemaining: 0
  };
}
