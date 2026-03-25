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

  playShot(kind: "ember" | "shard"): void {
    const frequency = kind === "ember" ? 310 : 210;
    const duration = kind === "ember" ? 0.08 : 0.12;
    const gain = kind === "ember" ? 0.05 : 0.06;
    this.beep(frequency, duration, gain, kind === "ember" ? "triangle" : "square");
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
