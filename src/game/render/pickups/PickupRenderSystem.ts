import type { ContentDatabase } from "../../content/types";
import type { PickupState } from "../../core/types";
import { AnimatedSpriteInstance, SpriteLibrary } from "../SpritePipeline";

export class PickupRenderSystem {
  private readonly sprites = new Map<string, AnimatedSpriteInstance>();

  constructor(
    private readonly content: ContentDatabase,
    private readonly spriteLibrary: SpriteLibrary
  ) {}

  buildSprites(pickups: PickupState[]): void {
    for (const pickup of pickups) {
      if (this.sprites.has(pickup.entityId)) {
        continue;
      }
      const definition = this.content.pickupDefs.get(pickup.defId);
      if (!definition) {
        continue;
      }
      const visual = this.content.pickupVisuals.get(definition.visualId);
      if (!visual?.entityId) {
        continue;
      }
      this.sprites.set(
        pickup.entityId,
        this.spriteLibrary.createSpriteForEntity(visual.entityId, "world")
      );
    }
  }

  sync(pickups: PickupState[], viewerX: number, viewerY: number): void {
    this.buildSprites(pickups);
    for (const pickup of pickups) {
      const sprite = this.sprites.get(pickup.entityId);
      if (!sprite) {
        continue;
      }

      sprite.setVisible(!pickup.picked);
      if (pickup.picked) {
        continue;
      }

      sprite.setAnimationTime(pickup.animTime);
      sprite.setPosition(
        pickup.position.x,
        pickup.position.y,
        sprite.anchorOffsetY + Math.sin(pickup.animTime * 2.5 + pickup.bobPhase) * 0.05 + pickup.position.z
      );
      sprite.setFacingAngle(0);
      sprite.setAnimationState("idle");
      sprite.update(0, viewerX, viewerY);
    }
  }
}
