import Phaser from 'phaser'
import { BackgroundMode } from '../../../types/BackgroundMode'

/**
 * The polar sky behind the office.
 *
 * The repo ships no arctic art, so everything here is drawn at runtime:
 * a graded sky, aurora ribbons that drift and breathe, stars, and snow falling
 * across the whole view. That keeps the theme asset-free and means the colours
 * stay in step with the CSS tokens rather than being baked into a PNG.
 */

const SKY = {
  [BackgroundMode.DAY]: {
    // 백야: a high clean blue that washes out to glare at the horizon
    top: 0x8ecdf0,
    bottom: 0xf2fbff,
    background: '#8ecdf0',
    aurora: [] as number[],
    star: 0,
    sun: true,
    snow: 0xffffff,
    snowAlpha: 0.9,
  },
  [BackgroundMode.NIGHT]: {
    top: 0x040a16,
    bottom: 0x0d2140,
    background: '#040a16',
    aurora: [0x5ff0c8, 0x7ad7f0, 0xa78bfa],
    star: 0xdcf3ff,
    sun: false,
    snow: 0xdcf3ff,
    snowAlpha: 0.7,
  },
}

export default class Background extends Phaser.Scene {
  private snow!: Phaser.GameObjects.Group

  constructor() {
    super('background')
  }

  create(data: { backgroundMode: BackgroundMode }) {
    const height = this.cameras.main.height
    const width = this.cameras.main.width
    const palette = SKY[data.backgroundMode] ?? SKY[BackgroundMode.NIGHT]

    this.cameras.main.setBackgroundColor(palette.background)

    this.paintSky(width, height, palette.top, palette.bottom)
    if (palette.sun) this.hangTheSun(width, height)
    if (palette.star) this.scatterStars(width, height, palette.star)
    palette.aurora.forEach((color, band) => this.raiseAurora(width, height, color, band))
    this.paintSnowfield(width, height)
    this.letItSnow(width, height, palette.snow, palette.snowAlpha)
  }

  /** vertical gradient, painted as strips because Phaser has no gradient fill */
  private paintSky(width: number, height: number, top: number, bottom: number) {
    const sky = this.add.graphics().setScrollFactor(0)
    const strips = 64
    const topColor = Phaser.Display.Color.ValueToColor(top)
    const bottomColor = Phaser.Display.Color.ValueToColor(bottom)

    for (let i = 0; i < strips; i++) {
      const blended = Phaser.Display.Color.Interpolate.ColorWithColor(
        topColor,
        bottomColor,
        strips,
        i
      )
      sky.fillStyle(Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b), 1)
      sky.fillRect(0, (height / strips) * i, width, height / strips + 1)
    }
  }

  /** the low sun that never sets, sitting just above the ice with its glare */
  private hangTheSun(width: number, height: number) {
    const key = 'polar-sun'
    if (!this.textures.exists(key)) {
      const size = 512
      const canvasTexture = this.textures.createCanvas(key, size, size)
      const ctx = canvasTexture.getContext()

      const glare = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      glare.addColorStop(0, 'rgba(255, 255, 255, 1)')
      glare.addColorStop(0.1, 'rgba(255, 250, 234, 0.92)')
      glare.addColorStop(0.22, 'rgba(255, 219, 152, 0.22)')
      glare.addColorStop(0.5, 'rgba(255, 210, 140, 0.06)')
      glare.addColorStop(1, 'rgba(255, 210, 140, 0)')
      ctx.fillStyle = glare
      ctx.fillRect(0, 0, size, size)
      canvasTexture.refresh()
    }

    const sun = this.add
      .image(width * 0.82, height * 0.2, key)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(height * 0.62, height * 0.62)

    // a slow bloom, so the glare feels like light rather than a sticker
    this.tweens.add({
      targets: sun,
      alpha: { from: 0.8, to: 1 },
      scale: { from: sun.scale, to: sun.scale * 1.05 },
      duration: 7000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  private scatterStars(width: number, height: number, color: number) {
    const stars = this.add.graphics().setScrollFactor(0)
    for (let i = 0; i < 90; i++) {
      const x = Phaser.Math.RND.between(0, width)
      // keep them out of the lower sky where the snowfield sits
      const y = Phaser.Math.RND.between(0, height * 0.62)
      stars.fillStyle(color, Phaser.Math.RND.realInRange(0.15, 0.7))
      stars.fillRect(x, y, 2, 2)
    }
  }

  /**
   * One aurora curtain.
   *
   * Drawn onto a canvas texture rather than with Phaser graphics, because a
   * curtain needs a real blur to read as light. Stacked translucent rectangles
   * only ever look like stripes - which is exactly how the first attempt looked.
   */
  private raiseAurora(width: number, height: number, color: number, band: number) {
    const key = `aurora-${band}`
    const texWidth = 1024
    const texHeight = 420

    if (!this.textures.exists(key)) {
      const canvasTexture = this.textures.createCanvas(key, texWidth, texHeight)
      const ctx = canvasTexture.getContext()
      const css = Phaser.Display.Color.IntegerToColor(color).rgba

      // the blur is what turns a stroke into a curtain of light
      ctx.filter = 'blur(26px)'
      ctx.lineCap = 'round'

      // several strokes of different height and offset so the curtain has folds
      for (let pass = 0; pass < 5; pass++) {
        const amplitude = 46 + pass * 12
        const yBase = texHeight * 0.42 + Math.sin(pass) * 26
        const gradient = ctx.createLinearGradient(0, yBase - 150, 0, yBase + 150)
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.5, css)
        gradient.addColorStop(1, 'transparent')

        ctx.strokeStyle = gradient
        ctx.lineWidth = 120 - pass * 14
        ctx.globalAlpha = 0.16

        ctx.beginPath()
        for (let x = -60; x <= texWidth + 60; x += 16) {
          const y =
            yBase +
            Math.sin(x / 190 + pass * 1.3 + band) * amplitude +
            Math.sin(x / 61 + pass) * 13
          if (x === -60) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      canvasTexture.refresh()
    }

    const curtain = this.add
      .image(width / 2, height * (0.2 + band * 0.09), key)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(width * 1.5, height * 0.55)
      .setAlpha(0.45)

    this.tweens.add({
      targets: curtain,
      x: { from: width / 2 - width * 0.1, to: width / 2 + width * 0.1 },
      scaleY: { from: curtain.scaleY, to: curtain.scaleY * 1.35 },
      alpha: { from: 0.28, to: 0.7 },
      duration: 11000 + band * 3400,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  /** the ice shelf along the bottom, so the sky has ground to sit on */
  private paintSnowfield(width: number, height: number) {
    const field = this.add.graphics().setScrollFactor(0)
    const horizon = height * 0.78

    // a canvas gradient, because stepped fills band visibly against a dark sky
    const key = 'snowfield'
    if (!this.textures.exists(key)) {
      const canvasTexture = this.textures.createCanvas(key, 8, 256)
      const ctx = canvasTexture.getContext()
      const fade = ctx.createLinearGradient(0, 0, 0, 256)
      fade.addColorStop(0, 'rgba(255, 255, 255, 0)')
      fade.addColorStop(0.3, 'rgba(255, 255, 255, 0.45)')
      fade.addColorStop(1, 'rgba(255, 255, 255, 0.92)')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, 8, 256)
      canvasTexture.refresh()
    }
    this.add
      .image(width / 2, horizon, key)
      .setOrigin(0.5, 0)
      .setDisplaySize(width, height - horizon)
      .setScrollFactor(0)

    // a couple of drifts, each a flattened arc
    const drifts = [
      { x: width * 0.18, w: width * 0.5, h: height * 0.1, alpha: 0.5 },
      { x: width * 0.72, w: width * 0.62, h: height * 0.13, alpha: 0.42 },
    ]
    drifts.forEach((drift) => {
      field.fillStyle(0xffffff, drift.alpha)
      field.fillEllipse(drift.x, horizon + drift.h * 0.6, drift.w, drift.h * 2)
    })
  }

  private letItSnow(width: number, height: number, color: number, alpha: number) {
    this.snow = this.add.group()

    for (let i = 0; i < 170; i++) {
      const size = Phaser.Math.RND.between(2, 6)
      // treat size as distance: the big ones fall fast and bright up front
      const near = size / 6

      const flake = this.add
        .circle(
          Phaser.Math.RND.between(0, width),
          Phaser.Math.RND.between(0, height),
          size / 2,
          color,
          alpha * (0.45 + near * 0.55)
        )
        .setStrokeStyle(1, 0x7fb2d4, 0.35 * near)
        .setScrollFactor(0)

      this.snow.add(flake)

      this.tweens.add({
        targets: flake,
        y: height + 12,
        x: `+=${Phaser.Math.RND.between(-50, 110)}`,
        duration: Phaser.Math.RND.between(5000, 11000) / near,
        delay: Phaser.Math.RND.between(0, 7000),
        repeat: -1,
        onRepeat: () => {
          flake.y = -12
          flake.x = Phaser.Math.RND.between(-50, width)
        },
      })
    }
  }
}
