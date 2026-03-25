import { Engine, WebGPUEngine } from "@babylonjs/core";

export interface EngineBootstrapResult {
  engine: Engine | WebGPUEngine;
  backend: "webgpu" | "webgl";
}

export async function createBabylonEngine(
  canvas: HTMLCanvasElement
): Promise<EngineBootstrapResult> {
  const canTryWebGpu =
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    (await WebGPUEngine.IsSupportedAsync);

  if (canTryWebGpu) {
    const engine = new WebGPUEngine(canvas, {
      antialias: false,
      adaptToDeviceRatio: false
    });
    await engine.initAsync();
    return { engine, backend: "webgpu" };
  }

  const engine = new Engine(canvas, true, {
    antialias: false,
    preserveDrawingBuffer: false,
    stencil: true
  });
  return { engine, backend: "webgl" };
}
