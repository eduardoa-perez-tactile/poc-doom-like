import type {
  AutomapRenderSnapshot,
  MapLineDef,
  MapMarkerDef,
  MapMarkerKind
} from "../simulation/map/AutomapTypes";

interface ScreenPoint {
  x: number;
  y: number;
}

interface LineStyle {
  stroke: string;
  width: number;
}

type NonPlayerMarkerKind = Exclude<MapMarkerKind, "player">;

interface LegendMarkerEntry {
  kind: "marker";
  label: string;
  markerKind: NonPlayerMarkerKind | "player";
  color: string;
}

interface LegendLineEntry {
  kind: "line";
  label: string;
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
    this.drawFooterHint(snapshot);
    if (snapshot.runtime.labelsOpen) {
      this.drawLegend();
    }
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
    this.drawPlayerGlyph(ctx, size);
    ctx.restore();
  }

  private drawMarker(snapshot: AutomapRenderSnapshot, marker: MapMarkerDef): void {
    const ctx = this.context;
    const point = this.worldToScreen(snapshot, marker.x, marker.y);
    const kind = marker.kind as NonPlayerMarkerKind;
    const discovered = Boolean(snapshot.runtime.discoveredMarkerIds[marker.id]);
    const dimmed = !discovered && snapshot.runtime.fullReveal;
    const alpha = dimmed ? 0.45 : 1;
    const active = marker.flagId ? Boolean(snapshot.flags[marker.flagId]) : true;
    const stroke = this.resolveMarkerColor(kind, alpha, active);

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.translate(point.x, point.y);
    this.drawMarkerGlyph(ctx, kind);

    ctx.restore();
  }

  private drawLegend(): void {
    const ctx = this.context;
    const markerEntries: LegendMarkerEntry[] = [
      { kind: "marker", label: "Player", markerKind: "player", color: "#f8f2cb" },
      { kind: "marker", label: "Key", markerKind: "key", color: "rgba(161, 222, 112, 1)" },
      { kind: "marker", label: "Switch", markerKind: "switch", color: "rgba(245, 188, 112, 1)" },
      { kind: "marker", label: "Teleporter", markerKind: "teleporter", color: "rgba(88, 199, 214, 1)" },
      { kind: "marker", label: "Exit", markerKind: "exit", color: "rgba(245, 235, 176, 1)" },
      { kind: "marker", label: "Secret", markerKind: "secret", color: "rgba(231, 130, 91, 1)" },
      { kind: "marker", label: "Pickup", markerKind: "pickup", color: "rgba(161, 222, 112, 1)" }
    ];
    const lineEntries: LegendLineEntry[] = [
      { kind: "line", label: "Wall", stroke: "rgba(232, 223, 203, 1)", width: 1.4 },
      { kind: "line", label: "Door", stroke: "rgba(233, 191, 104, 1)", width: 1.7 },
      { kind: "line", label: "Locked Door", stroke: "rgba(213, 115, 82, 1)", width: 1.8 },
      { kind: "line", label: "Open Door", stroke: "rgba(92, 196, 137, 1)", width: 1.6 }
    ];

    const frameMargin = 20;
    const panelPaddingX = 14;
    const panelPaddingTop = 12;
    const panelPaddingBottom = 14;
    const columnGap = 28;
    const iconSlotWidth = 20;
    const labelGap = 10;
    const titleHeight = 16;
    const titleToSectionGap = 18;
    const sectionHeaderHeight = 12;
    const sectionToRowsGap = 16;
    const rowHeight = 18;
    const headerTop = 20;
    const headerLineHeight = 18;

    ctx.save();
    ctx.font = '10px "Trebuchet MS", Verdana, sans-serif';
    const markerLabelWidth = Math.max(...markerEntries.map((entry) => ctx.measureText(entry.label).width));
    const lineLabelWidth = Math.max(...lineEntries.map((entry) => ctx.measureText(entry.label).width));
    ctx.restore();

    const markerColumnWidth = iconSlotWidth + labelGap + markerLabelWidth;
    const lineColumnWidth = iconSlotWidth + labelGap + lineLabelWidth;
    const contentRows = Math.max(markerEntries.length, lineEntries.length);
    const contentHeight = sectionHeaderHeight + sectionToRowsGap + contentRows * rowHeight;
    const boxWidth = Math.ceil(panelPaddingX * 2 + markerColumnWidth + columnGap + lineColumnWidth);
    const boxHeight = Math.ceil(panelPaddingTop + titleHeight + titleToSectionGap + contentHeight + panelPaddingBottom);
    const boxX = this.width - boxWidth - frameMargin;
    const boxY = headerTop + headerLineHeight * 2 + 10;
    const leftColX = boxX + panelPaddingX;
    const rightColX = leftColX + markerColumnWidth + columnGap;
    const sectionTopY = boxY + panelPaddingTop + titleHeight + titleToSectionGap;

    ctx.fillStyle = "rgba(18, 12, 10, 0.82)";
    ctx.strokeStyle = "rgba(235, 214, 180, 0.22)";
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = "rgba(245, 227, 197, 0.9)";
    ctx.font = '11px "Trebuchet MS", Verdana, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("LEGEND", boxX + 12, boxY + 16);
    ctx.fillStyle = "rgba(196, 178, 150, 0.86)";
    ctx.font = '10px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText("MARKERS", leftColX, sectionTopY);
    ctx.fillText("LINES", rightColX, sectionTopY);

    let rowY = sectionTopY + sectionToRowsGap;
    for (const entry of markerEntries) {
      const iconX = leftColX;
      const iconY = rowY;

      ctx.save();
      ctx.translate(iconX + 8, iconY);
      ctx.strokeStyle = entry.color;
      ctx.fillStyle = entry.color;
      ctx.lineWidth = 1.5;
      if (entry.markerKind === "player") {
        this.drawPlayerGlyph(ctx, 8);
      } else {
        this.drawMarkerGlyph(ctx, entry.markerKind);
      }
      ctx.restore();

      ctx.fillStyle = "rgba(226, 214, 191, 0.92)";
      ctx.font = '10px "Trebuchet MS", Verdana, sans-serif';
      ctx.fillText(entry.label, leftColX + 24, iconY);
      rowY += rowHeight;
    }

    rowY = sectionTopY + sectionToRowsGap;
    for (const entry of lineEntries) {
      const iconX = rightColX;
      const iconY = rowY;

      ctx.save();
      ctx.strokeStyle = entry.stroke;
      ctx.lineWidth = entry.width;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY);
      ctx.lineTo(iconX + 18, iconY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "rgba(226, 214, 191, 0.92)";
      ctx.font = '10px "Trebuchet MS", Verdana, sans-serif';
      ctx.fillText(entry.label, rightColX + 24, iconY);
      rowY += rowHeight;
    }

    ctx.restore();
  }

  private drawFooterHint(snapshot: AutomapRenderSnapshot): void {
    const ctx = this.context;
    const label = snapshot.runtime.labelsOpen
      ? "Press L to hide map labels"
      : "Press L to see map labels";
    const y = this.height - 28;

    ctx.save();
    ctx.font = '12px "Trebuchet MS", Verdana, sans-serif';
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(label).width;
    const boxWidth = Math.ceil(textWidth + 22);
    const boxHeight = 24;
    const x = Math.round((this.width - boxWidth) * 0.5);
    const boxY = y - boxHeight * 0.5;

    ctx.fillStyle = "rgba(18, 12, 10, 0.82)";
    ctx.strokeStyle = "rgba(235, 214, 180, 0.22)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, boxY, boxWidth, boxHeight);
    ctx.strokeRect(x, boxY, boxWidth, boxHeight);
    ctx.fillStyle = "rgba(245, 227, 197, 0.9)";
    ctx.fillText(label, x + 11, y);
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

  private resolveMarkerColor(
    kind: NonPlayerMarkerKind,
    alpha: number,
    active: boolean
  ): string {
    if (kind === "exit") {
      return active ? `rgba(245, 235, 176, ${alpha})` : `rgba(118, 118, 108, ${alpha})`;
    }
    if (kind === "teleporter") {
      return `rgba(88, 199, 214, ${alpha})`;
    }
    if (kind === "switch") {
      return `rgba(245, 188, 112, ${alpha})`;
    }
    if (kind === "secret") {
      return `rgba(231, 130, 91, ${alpha})`;
    }
    return `rgba(161, 222, 112, ${alpha})`;
  }

  private drawPlayerGlyph(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.65);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(-size * 0.7, -size * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawMarkerGlyph(ctx: CanvasRenderingContext2D, kind: NonPlayerMarkerKind): void {
    switch (kind) {
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
