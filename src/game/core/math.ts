export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle: number): number {
  let result = angle % TAU;
  if (result <= -Math.PI) {
    result += TAU;
  } else if (result > Math.PI) {
    result -= TAU;
  }
  return result;
}

export function length2(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function distance2(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function dot2(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}
