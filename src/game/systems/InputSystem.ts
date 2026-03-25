const USE_KEYS = new Set(["KeyE"]);
const MENU_KEYS = new Set(["Escape"]);

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookDeltaX: number;
  firePressed: boolean;
  usePressed: boolean;
  menuPressed: boolean;
  weaponSlot?: number;
}

export class InputSystem {
  private readonly heldKeys = new Set<string>();
  private lookDeltaX = 0;
  private frameFirePressed = false;
  private frameUsePressed = false;
  private frameMenuPressed = false;
  private frameWeaponSlot?: number;
  private pointerLocked = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("pointerdown", this.onPointerDown);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  requestPointerLock(): void {
    void this.canvas.requestPointerLock();
  }

  sampleFrame(): InputFrame {
    const frame: InputFrame = {
      moveX: (this.heldKeys.has("KeyD") ? 1 : 0) - (this.heldKeys.has("KeyA") ? 1 : 0),
      moveY: (this.heldKeys.has("KeyW") ? 1 : 0) - (this.heldKeys.has("KeyS") ? 1 : 0),
      lookDeltaX: this.lookDeltaX,
      firePressed: this.frameFirePressed,
      usePressed: this.frameUsePressed,
      menuPressed: this.frameMenuPressed,
      weaponSlot: this.frameWeaponSlot
    };

    this.lookDeltaX = 0;
    this.frameFirePressed = false;
    this.frameUsePressed = false;
    this.frameMenuPressed = false;
    this.frameWeaponSlot = undefined;

    return frame;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.heldKeys.add(event.code);

    if (USE_KEYS.has(event.code)) {
      this.frameUsePressed = true;
    } else if (MENU_KEYS.has(event.code)) {
      this.frameMenuPressed = true;
      event.preventDefault();
    } else if (event.code === "Digit1") {
      this.frameWeaponSlot = 1;
    } else if (event.code === "Digit2") {
      this.frameWeaponSlot = 2;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) {
      return;
    }
    this.lookDeltaX += event.movementX;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.frameFirePressed = true;
    }
    if (!this.pointerLocked && event.target === this.canvas) {
      this.requestPointerLock();
    }
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };
}
