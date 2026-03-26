import { clamp } from "../core/math";

export class AudioSystem {
  private context: AudioContext | null = null;
  private masterVolume = 0.7;

  setMasterVolume(value: number): void {
    this.masterVolume = clamp(value, 0, 1);
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state !== "running") {
      await this.context.resume();
    }
  }

  playShot(weaponId: string, powered: boolean): void {
    const profile = powered
      ? poweredShotProfile(weaponId)
      : baseShotProfile(weaponId);
    this.beep(profile.frequency, profile.duration, profile.gain, profile.type);
  }

  playPickup(): void {
    this.beep(660, 0.08, 0.045, "triangle");
  }

  playDamage(): void {
    this.beep(120, 0.1, 0.06, "sawtooth");
  }

  playEnemyAttack(): void {
    this.beep(150, 0.08, 0.05, "square");
  }

  playDeath(): void {
    this.beep(90, 0.22, 0.08, "sawtooth");
  }

  private beep(
    frequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType
  ): void {
    if (!this.context || this.context.state !== "running") {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(gainValue * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}

function baseShotProfile(weaponId: string): ShotProfile {
  switch (weaponId) {
    case "staff":
      return { frequency: 170, duration: 0.07, gain: 0.045, type: "sawtooth" };
    case "gauntlets_of_the_necromancer":
      return { frequency: 260, duration: 0.09, gain: 0.05, type: "triangle" };
    case "ethereal_crossbow":
      return { frequency: 360, duration: 0.08, gain: 0.05, type: "square" };
    case "dragon_claw":
      return { frequency: 240, duration: 0.06, gain: 0.04, type: "square" };
    case "hellstaff":
      return { frequency: 220, duration: 0.1, gain: 0.055, type: "triangle" };
    case "phoenix_rod":
      return { frequency: 290, duration: 0.12, gain: 0.06, type: "sawtooth" };
    case "firemace":
      return { frequency: 200, duration: 0.11, gain: 0.055, type: "square" };
    case "elven_wand":
    default:
      return { frequency: 310, duration: 0.08, gain: 0.05, type: "triangle" };
  }
}

function poweredShotProfile(weaponId: string): ShotProfile {
  const base = baseShotProfile(weaponId);
  return {
    frequency: base.frequency + 80,
    duration: base.duration + 0.03,
    gain: base.gain + 0.015,
    type: "sawtooth"
  };
}

interface ShotProfile {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}
