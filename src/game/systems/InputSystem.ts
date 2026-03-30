const MENU_KEYS = new Set(["Escape"]);

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookDeltaX: number;
  fireDown: boolean;
  usePressed: boolean;
  inventoryPrevPressed: boolean;
  inventoryNextPressed: boolean;
  menuPressed: boolean;
  toggleTome: boolean;
  weaponSlot?: number;
}

export class InputSystem {
  private readonly heldKeys = new Set<string>();
  private lookDeltaX = 0;
  private frameUsePressed = false;
  private frameInventoryPrevPressed = false;
  private frameInventoryNextPressed = false;
  private frameMenuPressed = false;
  private frameToggleTome = false;
  private frameWeaponSlot?: number;
  private pointerLocked = false;
  private pointerLockLost = false;
  private fireDown = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("blur", this.onBlur);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("blur", this.onBlur);
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  consumePointerLockLost(): boolean {
    const lost = this.pointerLockLost;
    this.pointerLockLost = false;
    return lost;
  }

  async requestPointerLock(): Promise<void> {
    try {
      await this.canvas.requestPointerLock();
    } catch {
      // Browsers can reject immediate reacquire after an ESC unlock.
      // The game can continue waiting for the next explicit canvas click.
    }
  }

  releasePointerLock(): void {
    if (document.pointerLockElement === this.canvas) {
      void document.exitPointerLock();
    }
  }

  sampleFrame(): InputFrame {
    const frame: InputFrame = {
      moveX: (this.heldKeys.has("KeyD") ? 1 : 0) - (this.heldKeys.has("KeyA") ? 1 : 0),
      moveY: (this.heldKeys.has("KeyW") ? 1 : 0) - (this.heldKeys.has("KeyS") ? 1 : 0),
      lookDeltaX: this.lookDeltaX,
      fireDown: this.fireDown,
      usePressed: this.frameUsePressed,
      inventoryPrevPressed: this.frameInventoryPrevPressed,
      inventoryNextPressed: this.frameInventoryNextPressed,
      menuPressed: this.frameMenuPressed,
      toggleTome: this.frameToggleTome,
      weaponSlot: this.frameWeaponSlot
    };

    this.lookDeltaX = 0;
    this.frameUsePressed = false;
    this.frameInventoryPrevPressed = false;
    this.frameInventoryNextPressed = false;
    this.frameMenuPressed = false;
    this.frameToggleTome = false;
    this.frameWeaponSlot = undefined;

    return frame;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.heldKeys.add(event.code);

    if (event.code === "KeyE") {
      this.frameUsePressed = true;
    } else if (event.code === "BracketLeft") {
      this.frameInventoryPrevPressed = true;
    } else if (event.code === "BracketRight") {
      this.frameInventoryNextPressed = true;
    } else if (event.code === "KeyT") {
      this.frameToggleTome = true;
    } else if (MENU_KEYS.has(event.code)) {
      this.frameMenuPressed = true;
      event.preventDefault();
    } else if (event.code.startsWith("Digit")) {
      const slot = Number.parseInt(event.code.slice(5), 10);
      if (slot >= 1 && slot <= 8) {
        this.frameWeaponSlot = slot;
      }
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
      this.fireDown = true;
    }
    if (!this.pointerLocked && event.target === this.canvas) {
      this.requestPointerLock();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.fireDown = false;
    }
  };

  private readonly onPointerLockChange = (): void => {
    const nextLocked = document.pointerLockElement === this.canvas;
    this.pointerLockLost = this.pointerLocked && !nextLocked;
    this.pointerLocked = nextLocked;
  };

  private readonly onBlur = (): void => {
    this.fireDown = false;
    this.lookDeltaX = 0;
    this.heldKeys.clear();
  };
}
