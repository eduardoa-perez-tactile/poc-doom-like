import type { ContentDatabase } from "../content/types";
import type { StatModifier } from "../core/types";
import type { GameSessionState } from "../core/types";
import type { RunLoadoutState } from "../progression/types";
import type { InputFrame } from "../systems/InputSystem";
import { GameSimulation, type SimulationEvents } from "./GameSimulation";
import type { AutomapRenderSnapshot } from "./map/AutomapTypes";

export interface GameSessionOptions {
  loadout?: RunLoadoutState;
  playerModifiers?: readonly StatModifier[];
}

export class GameSession {
  private readonly simulation: GameSimulation;

  constructor(content: ContentDatabase, options: GameSessionOptions = {}) {
    this.simulation = new GameSimulation(content, options);
  }

  get state(): GameSessionState {
    return this.simulation.state;
  }

  update(dt: number, input: InputFrame): SimulationEvents {
    return this.simulation.update(dt, input);
  }

  restart(): void {
    this.simulation.restart();
  }

  createSaveState(): GameSessionState {
    return this.simulation.createSaveState();
  }

  createRunLoadoutState(): RunLoadoutState {
    return this.simulation.createRunLoadoutState();
  }

  applySavedState(state: GameSessionState): void {
    this.simulation.applySavedState(state);
  }

  getLevelScriptDebugState() {
    return this.simulation.getLevelScriptDebugState();
  }

  getAutomapRenderSnapshot(): AutomapRenderSnapshot {
    return this.simulation.getAutomapRenderSnapshot();
  }
}
