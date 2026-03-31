import type {
  AutomapRenderSnapshot,
  MapLineDef,
  MapMarkerDef
} from "../simulation/map/AutomapTypes";

interface ScreenPoint {
  x: number;
  y: number;
}

interface LineStyle {
  stroke: string;
  width: number;
}

export class AutomapRenderSystem {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private active = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Automap overlay requires a 2D canvas context.");
    }
    this.context = context;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.max(1, dpr);
    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.clear();
    }
  }

  render(snapshot: AutomapRenderSnapshot | null): void {
    if (!this.active || !snapshot?.runtime.isOpen) {
      this.clear();
      return;
    }

    const ctx = this.context;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "rgba(10, 8, 8, 0.72)";
    ctx.fillRect(0, 0, this.width, this.height);

    for (const line of snapshot.definition.lines) {
      if (!this.isLineVisible(snapshot, line)) {
        continue;
      }
      const style = this.resolveLineStyle(snapshot, line);
      const a = this.worldToScreen(snapshot, line.ax, line.ay);
      const b = this.worldToScreen(snapshot, line.bx, line.by);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const marker of snapshot.definition.markers) {
      if (!this.isMarkerVisible(snapshot, marker)) {
        continue;
      }
      this.drawMarker(snapshot, marker);
    }

    this.drawPlayer(snapshot);
    this.drawFrame(snapshot);
  }

  private clear(): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawFrame(snapshot: AutomapRenderSnapshot): void {
    const ctx = this.context;
    ctx.strokeStyle = "rgba(235, 214, 180, 0.26)";
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, this.width - 24, this.height - 24);

    ctx.fillStyle = "rgba(245, 227, 197, 0.82)";
    ctx.font = '12px "Trebuchet MS", Verdana, sans-serif';
    ctx.textBaseline = "top";
    ctx.fillText(
      `AUTOMAP ${snapshot.runtime.followPlayer ? "FOLLOW" : "FREE PAN"} ${snapshot.runtime.rotateWithPlayer ? "ROTATE" : "NORTH"}`,
      20,
      20
    );
    ctx.fillText("TAB CLOSE  +/- ZOOM  F FOLLOW  SHIFT+R ROTATE", 20, 38);
  }

  private drawPlayer(snapshot: AutomapRenderSnapshot): void {
    const ctx = this.context;
    const center = this.worldToScreen(snapshot, snapshot.playerX, snapshot.playerY);
    const angle = snapshot.runtime.rotateWithPlayer ? -Math.PI / 2 : snapshot.playerAngle;
    const size = 10;

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.65);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(-size * 0.7, -size * 0.65);
    ctx.closePath();
    ctx.fillStyle = "#f8f2cb";
    ctx.strokeStyle = "#6b351f";
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawMarker(snapshot: AutomapRenderSnapshot, marker: MapMarkerDef): void {
    const ctx = this.context;
    const point = this.worldToScreen(snapshot, marker.x, marker.y);
    const discovered = Boolean(snapshot.runtime.discoveredMarkerIds[marker.id]);
    const dimmed = !discovered && snapshot.runtime.fullReveal;
    const alpha = dimmed ? 0.45 : 1;
    const active = marker.flagId ? Boolean(snapshot.flags[marker.flagId]) : true;
    const stroke =
      marker.kind === "exit"
        ? active ? `rgba(245, 235, 176, ${alpha})` : `rgba(118, 118, 108, ${alpha})`
        : marker.kind === "teleporter"
          ? `rgba(88, 199, 214, ${alpha})`
          : marker.kind === "switch"
            ? `rgba(245, 188, 112, ${alpha})`
            : marker.kind === "secret"
              ? `rgba(231, 130, 91, ${alpha})`
              : `rgba(161, 222, 112, ${alpha})`;

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.translate(point.x, point.y);

    switch (marker.kind) {
      case "key":
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.stroke();
        break;
      case "switch":
        ctx.strokeRect(-4, -4, 8, 8);
        break;
      case "teleporter":
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "exit":
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.stroke();
        break;
      case "secret":
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(2, -2);
        ctx.lineTo(6, 0);
        ctx.lineTo(2, 2);
        ctx.lineTo(0, 6);
        ctx.lineTo(-2, 2);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-2, -2);
        ctx.closePath();
        ctx.stroke();
        break;
      case "pickup":
      default:
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  private isLineVisible(snapshot: AutomapRenderSnapshot, line: MapLineDef): boolean {
    if (line.hideOnMapAlways) {
      return false;
    }

    const discovered = Boolean(snapshot.runtime.discoveredLineIds[line.id]);
    const revealedByScroll = snapshot.runtime.fullReveal && line.revealOnFullMap !== false;
    if (!discovered && !revealedByScroll) {
      return false;
    }

    if (line.secretId && !snapshot.secrets[line.secretId]?.discovered && !snapshot.runtime.fullReveal) {
      return false;
    }
    if (line.teleporterId && !snapshot.teleporters[line.teleporterId]?.revealed && !snapshot.runtime.fullReveal) {
      return false;
    }

    return true;
  }

  private isMarkerVisible(snapshot: AutomapRenderSnapshot, marker: MapMarkerDef): boolean {
    if (marker.hideOnMapAlways || marker.visibleWhen === "never") {
      return false;
    }

    const discovered = Boolean(snapshot.runtime.discoveredMarkerIds[marker.id]);
    const revealedByScroll = snapshot.runtime.fullReveal && marker.revealOnFullMap !== false;

    if (marker.visibleWhen === "fullMapOnly" && !revealedByScroll) {
      return false;
    }
    if (marker.visibleWhen === "discovered" && !discovered && !revealedByScroll) {
      return false;
    }

    if (marker.secretId && !snapshot.secrets[marker.secretId]?.discovered && !snapshot.runtime.fullReveal) {
      return false;
    }
    if (marker.teleporterId && !snapshot.teleporters[marker.teleporterId]?.revealed && !snapshot.runtime.fullReveal) {
      return false;
    }
    if (marker.pickupEntityId && snapshot.pickups[marker.pickupEntityId]?.picked) {
      return false;
    }

    return true;
  }

  private resolveLineStyle(snapshot: AutomapRenderSnapshot, line: MapLineDef): LineStyle {
    const discovered = Boolean(snapshot.runtime.discoveredLineIds[line.id]);
    const dim = !discovered && snapshot.runtime.fullReveal;
    const alpha = dim ? 0.46 : 1;

    if (line.doorId) {
      const door = snapshot.doors[line.doorId];
      if (door?.isOpen) {
        return { stroke: `rgba(92, 196, 137, ${alpha})`, width: 1.6 };
      }
      if (door?.isLocked) {
        return { stroke: `rgba(213, 115, 82, ${alpha})`, width: 1.8 };
      }
      if (line.kind === "exit") {
        return { stroke: `rgba(240, 222, 132, ${alpha})`, width: 1.8 };
      }
      if (line.kind === "secret") {
        return { stroke: `rgba(235, 150, 94, ${alpha})`, width: 1.8 };
      }
      return { stroke: `rgba(233, 191, 104, ${alpha})`, width: 1.8 };
    }

    switch (line.kind) {
      case "secret":
        return { stroke: `rgba(220, 137, 94, ${alpha})`, width: 1.7 };
      case "exit":
        return { stroke: `rgba(231, 224, 178, ${alpha})`, width: 1.7 };
      case "teleporter":
        return { stroke: `rgba(94, 195, 214, ${alpha})`, width: 1.6 };
      case "window":
        return { stroke: `rgba(132, 155, 178, ${alpha})`, width: 1.3 };
      case "door":
        return { stroke: `rgba(233, 191, 104, ${alpha})`, width: 1.7 };
      case "wall":
      default:
        return { stroke: `rgba(232, 223, 203, ${alpha})`, width: 1.4 };
    }
  }

  private worldToScreen(
    snapshot: AutomapRenderSnapshot,
    worldX: number,
    worldY: number
  ): ScreenPoint {
    const centerWorldX = snapshot.runtime.followPlayer
      ? snapshot.playerX
      : snapshot.playerX + snapshot.runtime.panX;
    const centerWorldY = snapshot.runtime.followPlayer
      ? snapshot.playerY
      : snapshot.playerY + snapshot.runtime.panY;
    let dx = worldX - centerWorldX;
    let dy = worldY - centerWorldY;

    if (snapshot.runtime.rotateWithPlayer) {
      const rotation = -snapshot.playerAngle - Math.PI / 2;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }

    return {
      x: this.width * 0.5 + dx * snapshot.runtime.zoom,
      y: this.height * 0.5 + dy * snapshot.runtime.zoom
    };
  }
}
