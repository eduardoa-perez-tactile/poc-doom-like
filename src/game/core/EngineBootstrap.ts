import { Engine, WebGPUEngine } from "@babylonjs/core";

export interface EngineBootstrapResult {
  engine: Engine | WebGPUEngine;
  backend: "webgpu" | "webgl";
}

export async function createBabylonEngine(
  canvas: HTMLCanvasElement
): Promise<EngineBootstrapResult> {
  const explicitBackend = new URLSearchParams(window.location.search).get("backend");
  const canTryWebGpu =
    explicitBackend === "webgpu" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    (await WebGPUEngine.IsSupportedAsync);

  if (canTryWebGpu) {
    try {
      const engine = new WebGPUEngine(canvas, {
        antialias: false,
        adaptToDeviceRatio: false
      });
      await engine.initAsync();
      return { engine, backend: "webgpu" };
    } catch {
      // Fall through to the stable WebGL path.
    }
  }

  const engine = new Engine(canvas, true, {
    antialias: false,
    preserveDrawingBuffer: false,
    stencil: true
  });
  return { engine, backend: "webgl" };
}
