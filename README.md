# poc-heretic

`poc-heretic` is a small browser FPS prototype built with Vite, TypeScript, and Babylon.js. It aims for a retro fantasy-shooter feel: flat labyrinth maps, sprite-driven enemies and weapons, simple WebAudio feedback, and a renderer that can use WebGPU with WebGL fallback.

The current playable slice is a single-level prototype with:

- first-person movement and mouse look
- two weapons: `Ember Wand` and `Shard Caster`
- one enemy family currently wired into the level
- pickups for health and ammo
- HUD, pause flow, and local settings persistence

## Stack

- Vite
- TypeScript
- Babylon.js
- DOM-based HUD and menus
- WebAudio for placeholder SFX

## Run

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Controls

- `WASD`: move
- mouse: turn
- left click: fire
- `1` / `2`: switch weapon
- `Esc`: pause or release pointer lock

Click the canvas to capture the mouse.

## Project Layout

```text
src/
  main.ts
  styles.css
  game/
    GameApp.ts
    content/
      ContentDb.ts
      spriteManifest.ts
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
      SpritePipeline.ts
    simulation/
      GameSession.ts
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

## Weapons

Weapon definitions live in `src/game/content/data/weapons.json` and are loaded into the content database at startup. The simulation keeps weapon runtime state separate from static weapon data:

- `Ember Wand`: hitscan, no ammo cost
- `Shard Caster`: projectile weapon, uses shared player ammo

Weapon switching, cooldowns, ammo checks, and projectile spawning are handled in `src/game/simulation/GameSimulation.ts`.

## Sprite Pipeline

Sprites are defined in `src/game/content/spriteManifest.ts`. The project currently uses two source sheets:

- `src/game/content/assets/golem.png`
- `src/game/content/assets/weapons.png`

The sprite pipeline in `src/game/render/SpritePipeline.ts`:

- slices named frames from those sheets
- removes label strips with `clearRects`
- chroma-keys cyan and teal backgrounds to transparency
- builds animation clips and directional variants
- renders world sprites as billboards
- renders weapon sprites as camera-attached view models

Weapon sprites and projectile sprites both come from `weapons.png`. The first-person weapon view uses per-weapon offsets, flips, and bob settings from each sprite set's `viewModel` config.

## Notes

- `src/game/content/data/visuals.json` exists in the repo but is not the active visual source. The live game uses `spriteManifest.ts`.
- The project is a prototype, so several systems are intentionally simple: no reload flow, no weapon raise/lower animation, and placeholder synthesized audio.
