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
 * The repo has no arrow asset, so the arrow is drawn once and kept in the
 * texture cache. It is a shard of ice with a snowflake for fletching, pointing
 * right at angle 0 - Arrow.fire() rotates it from there.
 *
 * Written out pixel by pixel rather than as rectangles and triangles: at this
 * size every pixel is a decision, and a map you can read is the only way to
 * keep it cute rather than merely small.
 */
const SHARD = [
  '........o........',
  '.o.....oloo......',
  'oio....ollloo....',
  'iiiooooolwwlloo..',
  'oilllllllllwlllo.',
  'iiiiiiiiiiiiiiiio',
  'oiiiiiiiiiiiiiio.',
  'iiioooooiiiiioo..',
  'oio....oiiioo....',
  '.o.....oioo......',
  '........o........',
]

const SHARD_COLOURS: Record<string, string> = {
  o: '#2f6f9e', // deep ice, the outline
  i: '#7fcdf0', // ice
  l: '#cdf0ff', // where the light catches it
  w: '#ffffff', // shine
}

export function createArrowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(ARROW_TEXTURE)) return

  const width = SHARD[0].length
  const height = SHARD.length
  const canvas = scene.textures.createCanvas(ARROW_TEXTURE, width, height)
  const ctx = canvas.getContext()

  SHARD.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const colour = SHARD_COLOURS[cell]
      if (!colour) return
      ctx.fillStyle = colour
      ctx.fillRect(x, y, 1, 1)
    })
  })

  canvas.refresh()
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
