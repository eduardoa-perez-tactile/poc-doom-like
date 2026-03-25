# Recommended approach

Use **B) fake-2.5D gameplay with full 3D geometry and retro presentation**.

This is the fastest path to a strong playable result in Babylon.js for one engineer. A custom raycaster or sector renderer would consume the prototype budget on renderer tech, editor constraints, collision edge cases, browser fill-rate tuning, and content tooling before the game is fun. Babylon already solves camera, scene management, batching, materials, input surfaces, audio interop, and WebGPU/WebGL backend selection. The game feel should come from movement, encounter pacing, map layout, billboard enemies, unlit textured geometry, low-resolution presentation, and strict combat rules, not from reproducing 1990s renderer internals.

To preserve the classic feel while using full 3D:

- Lock gameplay to a mostly planar world: no freelook vertical aim required, no jumping, no vertical combat dependency in the slice.
- Build levels as flat-floor labyrinths with orthogonal walls, doors, keys, and secrets.
- Render enemies, pickups, and effects as billboards or sprite cards.
- Use unlit materials, fog, low render resolution, nearest-neighbor textures, and simple color palettes.
- Keep movement fast, collision sharp, and combat readable.
- Avoid modern FPS features that break the era feel: mantle, sprint slide, procedural physics clutter, heavy postprocessing, and fully dynamic lighting.

# Vertical slice

The slice is one level called **Ashen Catacomb**. The player enters with the **Ember Wand**, finds the **Ember Seal** key, unlocks the **vault gate**, discovers a hidden **ossuary secret** containing the **Shard Caster**, then fights through to the exit.

Vertical slice content:

- 1 level with a complete start-to-exit path.
- 2 weapons: `Ember Wand` and `Shard Caster`.
- 3 enemies: `Grave Thrall`, `Cinder Acolyte`, `Vault Sentinel`.
- 1 key and 1 locked door.
- Health and shard ammo pickups.
- 1 secret door leading to a side cache.
- 1 exit tile.
- HUD with health, ammo, weapon, kill count, secrets, timer, backend.
- Options menu with mouse sensitivity, master volume, pixel scale.
- Save/load to local storage.
- Death and restart flow.

Proof criteria for the slice:

- Player can load the page and enter the level with mouse look and keyboard movement.
- Combat loop works with at least one hitscan and one projectile weapon.
- Enemies can patrol loosely, aggro, move, and attack.
- Progression requires the key to pass the door.
- The player can finish the slice and get a completion message.

# Architecture

Recommended runtime split:

- `GameApp`: owns boot order, top-level services, pause/menu state, and the fixed-step loop.
- `ContentDb`: loads JSON definitions for weapons, enemies, and level metadata.
- `GameSimulation`: authoritative gameplay state and fixed-step updates.
- `RetroRenderer`: Babylon scene creation and rendering sync from simulation state.
- `InputSystem`: keyboard, mouse delta, pointer lock, and frame-level actions.
- `AudioSystem`: simple WebAudio wrapper for prototype SFX and volume control.
- `UiOverlay`: DOM HUD and menu, isolated from simulation rules.
- `SettingsStore`: local persistence for settings.
- `SaveStore`: local persistence for game state snapshots.

Authoritative data flow:

1. Browser boots `GameApp`.
2. `GameApp` creates Babylon engine with WebGPU capability check and WebGL fallback.
3. JSON content is loaded into `ContentDb`.
4. `GameSimulation` constructs runtime state from content definitions.
5. `FixedStepLoop` advances simulation at 60 Hz.
6. `InputSystem` produces one frame input packet per update.
7. `GameSimulation` mutates pure runtime data only.
8. `RetroRenderer` reads the runtime state and updates scene objects.
9. `UiOverlay` reads summarized state and dispatches menu/settings actions back to `GameApp`.
10. Save/load serializes and restores the runtime state object.

Entity architecture:

- Use plain arrays of structs, not ECS.
- Keep separate arrays for enemies, projectiles, pickups, and doors.
- Use content definition maps keyed by id for static data.
- Use stable ids so save/load and renderer mesh lookup remain deterministic.

# Folder structure

```text
src/
  main.ts
  styles.css
  game/
    GameApp.ts
    content/
      ContentDb.ts
      types.ts
      data/
        enemies.json
        level-ashen-catacomb.json
        weapons.json
    core/
      EngineBootstrap.ts
      FixedStepLoop.ts
      math.ts
      types.ts
    render/
      RetroRenderer.ts
    simulation/
      GameSimulation.ts
    systems/
      AudioSystem.ts
      InputSystem.ts
      SaveStore.ts
      SettingsStore.ts
      UiOverlay.ts
docs/
  implementation-plan.md
```

Scale-out rule:

- Add new content in `content/data`.
- Extend simulation behavior in `simulation`.
- Keep Babylon-specific code out of gameplay logic.
- Keep DOM-specific code out of gameplay logic.

# Core systems

## Simulation

Responsibilities:

- Own player state, enemy state, projectiles, pickups, door states, messages, stats, and completion state.
- Advance the game only on a fixed timestep.
- Enforce collisions, combat, interaction, pickup collection, death, and exit logic.

Data flow:

- Input packet enters simulation.
- Simulation updates player movement.
- Interaction and firing resolve against doors, enemies, and projectiles.
- AI updates after player input.
- Projectiles update after AI.
- Pickups and exit checks happen last.
- Resulting state is read by renderer and UI.

## Input

Responsibilities:

- Capture WASD, mouse delta, weapon slots, use, and pause/menu.
- Avoid direct Babylon camera controls.
- Convert browser input into one compact per-frame object.

Implementation choices:

- Pointer lock for aiming.
- Keyboard movement only.
- No runtime rebinding in the slice.

## Rendering

Responsibilities:

- Build static level geometry once.
- Own dynamic Babylon meshes for enemies, projectiles, doors, pickups, and exit markers.
- Sync transforms and visibility from simulation state every frame.

Rules:

- Rendering never decides gameplay outcomes.
- Scene objects are looked up by runtime ids.

## UI

Responsibilities:

- DOM HUD for fast iteration.
- Pause/options menu.
- Save/load/restart buttons.
- Status banner for current objective and interaction feedback.

## Audio

Responsibilities:

- Light wrapper around WebAudio for prototype feedback.
- Central volume scaling from settings.
- Minimal synthesized sounds until real assets exist.

## Save/load

Responsibilities:

- Serialize the current runtime state to local storage.
- Restore a valid state snapshot with versioning.
- Keep save format separate from content definitions.

# Rendering plan

Use Babylon.js with **backend selection at startup**:

- Try `WebGPUEngine` only if in a secure context and support is available.
- Fall back to standard `Engine` on WebGL immediately otherwise.
- Treat WebGPU as a bonus backend, not a dependency.

Retro FPS presentation choices:

- Full 3D orthogonal level geometry for walls, floor, ceiling, and doors.
- Billboard sprite cards for enemies, pickups, and exit markers.
- Unlit materials with emissive color and nearest-neighbor textures.
- Heavy fog and a low-contrast sky color to reduce draw distance and increase mood.
- Low internal render resolution via hardware scaling option.
- No physically based materials, shadows, or post stack required for the slice.

Camera and feel:

- First-person camera with a fixed FOV around classic shooter values.
- Horizontal mouse look only in the slice.
- Slight movement bob only.
- Weapon rendered as a camera child plane, not a physically simulated model.

Level representation:

- Grid-authored map with floor cells and wall cells.
- Doors occupy full grid cells.
- Secret doors are special doors that visually read as walls until activated.

Exact browser-first rendering constraints:

- Keep scene geometry simple and static.
- Use one material family for walls, one for floor/ceiling, one for doors.
- Limit dynamic lights to a single hemispheric light or pure unlit shading.
- Avoid transparent particles except for a few projectile meshes if needed.

# Content pipeline

Authoring path for the prototype:

1. Author weapon, enemy, and level metadata in JSON.
2. Load JSON directly through Vite with TypeScript types.
3. Convert content definitions into runtime state on level start.
4. Use procedural placeholder textures and synthesized sounds during preproduction.
5. Replace placeholder materials, sprites, and audio incrementally without changing simulation code.

Data formats:

- `weapons.json`: slot, ammo, cooldown, damage, fire mode, projectile speed, range.
- `enemies.json`: health, move speed, collision radius, attack data, colors, aggro range.
- `level-*.json`: grid, player start, door list, pickups, enemy spawns, exits, briefing.

Scale plan:

- Later add `levels/` with one JSON per level.
- Add sprite atlases and texture sheets while keeping the same ids.
- Add a lightweight import script only when manual JSON editing becomes the bottleneck.

Do not build yet:

- Custom map editor.
- Full asset baking pipeline.
- Scriptable cutscene system.
- Complex animation rigging.

# Performance plan

Hard rules:

- Fixed simulation at 60 Hz.
- No per-frame object graph rebuilds.
- No physics engine.
- Keep arrays hot and reuse scene objects.
- Limit total active projectiles and enemy counts in the slice.

Browser strategy:

- Render at reduced internal resolution using `setHardwareScalingLevel`.
- Use fog to cap effective visibility.
- Build static wall geometry once.
- Keep material count low.
- Keep billboard textures tiny and nearest-filtered.
- Use DOM HUD instead of a heavy in-engine UI layer.
- Prefer simple collision tests over generalized systems.

Garbage control:

- Reuse arrays and mesh maps where practical.
- Avoid creating temporary vectors in gameplay logic.
- Keep save/load snapshots out of the hot path.
- Defer any expensive JSON parsing to boot only.

Validation targets for the slice:

- Stable 60 simulation Hz on desktop browsers with a handful of enemies active.
- Comfortable play on integrated GPUs with WebGL fallback.

# Milestones

## Milestone 1: Project bootstrap

- Vite + TypeScript + Babylon.js.
- Engine bootstrap with WebGPU/WebGL selection.
- Fixed-step loop.
- DOM shell and HUD/menu foundation.

## Milestone 2: Traversal and level shell

- Grid-based level definition.
- Static wall, floor, and ceiling rendering.
- First-person movement and collision.
- Pointer lock and pause menu flow.

## Milestone 3: Combat baseline

- Weapon definitions.
- Player firing, damage, death.
- Projectile runtime.
- Enemy definitions and basic aggro/attack logic.

## Milestone 4: Progression loop

- Pickups.
- Key and locked door.
- Secret door.
- Exit trigger.
- Simple objective/status messaging.

## Milestone 5: Persistence and polish

- Save/load.
- Settings persistence.
- Audio feedback.
- Visual cleanup and balancing pass.

## Milestone 6: Slice hardening

- Tune combat pacing.
- Tune map readability.
- Remove major garbage hot spots.
- Build and smoke-test on WebGL fallback browser.

# First playable backlog

The first playable target is not “content complete.” It is “a short run that proves the loop.”

Backlog in build order:

1. Bootstrap Vite/Babylon project.
2. Add fixed-timestep loop and engine backend selection.
3. Add input system with pointer lock.
4. Add one grid-authored level JSON.
5. Render static walls/floor/ceiling.
6. Add player movement and collision.
7. Add HUD and pause/options menu.
8. Add weapon switching and basic firing.
9. Add enemy runtime and simple billboard visuals.
10. Add pickups and inventory state.
11. Add key and locked door interaction.
12. Add secret door interaction.
13. Add exit trigger and slice completion.
14. Add save/load.
15. Add simple synthesized audio.
16. Balance pacing and polish readability.

# Two-week implementation plan

## Week 1

### Day 1

- Initialize project and tooling.
- Add engine bootstrap and fixed-step loop.
- Stand up DOM shell, canvas, and resize handling.

### Day 2

- Define JSON schemas and content types.
- Author the first level layout.
- Implement content loading and runtime state construction.

### Day 3

- Implement player movement, collision, and pointer lock look.
- Add pause/menu flow.
- Add low-resolution rendering settings.

### Day 4

- Build static level rendering in Babylon.
- Add pickup meshes, door meshes, exit marker, and billboard placeholder pipeline.

### Day 5

- Implement weapon system with one hitscan weapon.
- Add damage application and death flow.
- Add HUD ammo/health/weapon display.

## Week 2

### Day 6

- Add projectile weapon and projectile runtime.
- Add projectile visuals and impact handling.

### Day 7

- Add enemy definitions and runtime AI.
- Implement one melee and one ranged enemy behavior.

### Day 8

- Add third enemy type for combat variety.
- Tune movement speeds, damage, and encounter placements.

### Day 9

- Add keys, locked doors, and use interaction.
- Add secret door and secret tracking.

### Day 10

- Add save/load, settings persistence, and audio feedback.
- Run build verification and fix stability issues.

Stretch if the first 10 days land cleanly:

- Add minimap debug overlay for development only.
- Add pickup glow, hit flash, and better completion card.

# Risks

## Risk: spending too long on renderer authenticity

Mitigation:

- Use Babylon full-3D geometry immediately.
- Express retro feel through presentation rules and gameplay constraints.

## Risk: browser backend inconsistency

Mitigation:

- Treat WebGL as the baseline target.
- Gate WebGPU behind capability checks.
- Keep materials and features compatible with both.

## Risk: content iteration bottleneck

Mitigation:

- Keep data in JSON from day one.
- Use a simple grid map and explicit spawn lists instead of building a map editor too early.

## Risk: gameplay code entangled with Babylon objects

Mitigation:

- Keep simulation state plain-data only.
- Let renderer mirror state instead of owning truth.

## Risk: performance death by small allocations

Mitigation:

- Use a fixed-step loop.
- Avoid per-frame dynamic UI rebuild in future passes.
- Reuse arrays and mesh instances when scaling beyond the slice.

## Risk: overbuilding systems before the game is fun

Mitigation:

- Only add systems that directly support the single-level slice.
- Defer tooling, advanced rendering, and multi-level campaign structure.

# Next concrete step

Finish the current implementation into a tighter playable slice:

1. Verify compile and runtime against Babylon APIs.
2. Replace any strict-mode errors.
3. Run the local build.
4. Start the next pass on gameplay feel: enemy tuning, weapon feedback, and level readability.
