import Phaser from 'phaser'

/**
 * Sound and visuals for the wake-up arrow.
 *
 * The project ships no audio assets and has no Phaser sound system wired up,
 * so the blip is synthesised with the Web Audio API instead. Swap in a real
 * asset later by replacing playPokeSound - nothing else needs to change.
 */

let audioContext: AudioContext | undefined

/** two short blips, like knocking on someone's desk */
export function playPokeSound() {
  try {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      audioContext = new AudioContextClass()
    }
    // browsers start the context suspended until a user gesture; by the time
    // someone presses Z they have already clicked their way into the room
    if (audioContext.state === 'suspended') audioContext.resume()

    const context = audioContext
    const startedAt = context.currentTime
    const blips = [
      { delay: 0, frequency: 880 },
      { delay: 0.13, frequency: 1174 },
    ]

    blips.forEach(({ delay, frequency }) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const at = startedAt + delay

      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency, at)
      // ramp instead of a hard start/stop, otherwise it clicks
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.22, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.12)
    })
  } catch (error) {
    // audio is a nice-to-have, never let it break the hit handling
    console.error('could not play the poke sound', error)
  }
}

/** expanding ring plus a "!" that floats off the player who got hit */
export function playPokeEffect(scene: Phaser.Scene, x: number, y: number) {
  const ring = scene.add
    .circle(x, y, 10, 0xffffff, 0)
    .setStrokeStyle(2, 0xffe066, 1)
    .setDepth(10000)

  scene.tweens.add({
    targets: ring,
    scale: 3,
    alpha: 0,
    duration: 320,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  })

  const mark = scene.add
    .text(x, y - 38, '!')
    .setFontFamily('Arial')
    .setFontSize(20)
    .setColor('#ffe066')
    .setStroke('#000000', 3)
    .setOrigin(0.5)
    .setDepth(10000)

  scene.tweens.add({
    targets: mark,
    y: y - 58,
    alpha: 0,
    duration: 600,
    ease: 'Cubic.easeOut',
    onComplete: () => mark.destroy(),
  })
}
