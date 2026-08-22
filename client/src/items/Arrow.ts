import Phaser from 'phaser'

export const ARROW_TEXTURE = 'wake-up-arrow'

/** pixels per second */
const ARROW_SPEED = 320
/** how far the arrow gets before it gives up - it is a nudge, not a weapon */
export const ARROW_RANGE = 130
/**
 * other players carry a deliberately oversized body (see OtherPlayer's factory)
 * so webrtc calls connect on approach. that body is far too generous for a hit,
 * so the overlap callback measures the real distance against this instead.
 */
export const ARROW_HIT_RADIUS = 26

export type Direction = 'up' | 'down' | 'left' | 'right'

const directions: Record<Direction, { x: number; y: number; angle: number }> = {
  right: { x: 1, y: 0, angle: 0 },
  down: { x: 0, y: 1, angle: 90 },
  left: { x: -1, y: 0, angle: 180 },
  up: { x: 0, y: -1, angle: -90 },
}

/**
 * The repo has no arrow asset, so draw one once and keep it in the texture
 * cache. Replacing this with a loaded spritesheet later only touches this file.
 */
export function createArrowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(ARROW_TEXTURE)) return

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
  graphics.fillStyle(0x222639, 1)
  graphics.fillRect(0, 3, 11, 2) // shaft
  graphics.fillTriangle(10, 0, 18, 4, 10, 8) // head
  graphics.fillStyle(0x33ac96, 1)
  graphics.fillRect(0, 1, 2, 6) // fletching
  graphics.generateTexture(ARROW_TEXTURE, 18, 8)
  graphics.destroy()
}

export default class Arrow extends Phaser.Physics.Arcade.Sprite {
  /** sessionId of whoever fired it */
  ownerId = ''
  private travelled = 0

  fire(ownerId: string, direction: Direction) {
    this.ownerId = ownerId
    this.travelled = 0

    const vector = directions[direction] ?? directions.down
    this.setAngle(vector.angle)
    this.setVelocity(vector.x * ARROW_SPEED, vector.y * ARROW_SPEED)
    this.setDepth(this.y + 1)
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)

    this.setDepth(this.y + 1)
    this.travelled += (ARROW_SPEED * delta) / 1000
    if (this.travelled >= ARROW_RANGE) this.destroy()
  }
}

/** spawn point, nudged forward so the arrow does not start inside the shooter */
export function arrowSpawnPoint(x: number, y: number, direction: Direction) {
  const vector = directions[direction] ?? directions.down
  return { x: x + vector.x * 18, y: y + vector.y * 18 }
}
