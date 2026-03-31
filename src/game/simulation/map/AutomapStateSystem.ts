import type { InputFrame } from "../../systems/InputSystem";
import type { AutomapRuntimeState } from "./AutomapTypes";

const DEFAULT_ZOOM = 9;
const MIN_ZOOM = 3;
const MAX_ZOOM = 27;
const ZOOM_STEP = 1.14;
const PAN_SPEED = 24;

export class AutomapStateSystem {
  createInitialState(): AutomapRuntimeState {
    return {
      isOpen: false,
      labelsOpen: false,
      followPlayer: true,
      rotateWithPlayer: false,
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,
      fullReveal: false,
      discoveredLineIds: {},
      discoveredMarkerIds: {}
    };
  }

  update(runtime: AutomapRuntimeState, input: InputFrame, dt: number): void {
    if (input.toggleAutomap) {
      runtime.isOpen = !runtime.isOpen;
      if (runtime.isOpen) {
        runtime.labelsOpen = false;
        runtime.followPlayer = true;
        runtime.panX = 0;
        runtime.panY = 0;
      } else {
        runtime.labelsOpen = false;
      }
    }

    if (!runtime.isOpen) {
      runtime.labelsOpen = false;
      return;
    }

    if (input.toggleAutomapLabels) {
      runtime.labelsOpen = !runtime.labelsOpen;
    }

    if (input.toggleAutomapFollow) {
      runtime.followPlayer = !runtime.followPlayer;
      if (runtime.followPlayer) {
        runtime.panX = 0;
        runtime.panY = 0;
      }
    }

    if (input.toggleAutomapRotate) {
      runtime.rotateWithPlayer = !runtime.rotateWithPlayer;
    }

    if (input.automapZoomIn) {
      runtime.zoom = Math.min(MAX_ZOOM, runtime.zoom * ZOOM_STEP);
    }
    if (input.automapZoomOut) {
      runtime.zoom = Math.max(MIN_ZOOM, runtime.zoom / ZOOM_STEP);
    }

    if (!runtime.followPlayer) {
      runtime.panX += input.automapPanX * PAN_SPEED * dt;
      runtime.panY -= input.automapPanY * PAN_SPEED * dt;
    }
  }

  revealFullMap(runtime: AutomapRuntimeState): boolean {
    if (runtime.fullReveal) {
      return false;
    }
    runtime.fullReveal = true;
    return true;
  }
}
