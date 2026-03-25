import type { ContentDatabase } from "../content/types";
import type { GameSessionState } from "../core/types";
import type { InputFrame } from "../systems/InputSystem";
import { GameSimulation, type SimulationEvents } from "./GameSimulation";

export class GameSession {
  private readonly simulation: GameSimulation;

  constructor(content: ContentDatabase) {
    this.simulation = new GameSimulation(content);
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

  applySavedState(state: GameSessionState): void {
    this.simulation.applySavedState(state);
  }
}
