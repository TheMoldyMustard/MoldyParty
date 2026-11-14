export type AudioCue = 'correct' | 'pass' | 'yes' | 'no' | 'maybe' | 'foul' | 'tick'

interface AudioParamLike {
  setValueAtTime(value: number, time: number): void
  exponentialRampToValueAtTime(value: number, time: number): void
}

interface OscillatorLike {
  type: string
  frequency: AudioParamLike
  connect(node: unknown): void
  start(time: number): void
  stop(time: number): void
}

interface GainLike {
  gain: AudioParamLike
  connect(node: unknown): void
}

export interface AudioContextLike {
  state: string
  currentTime: number
  destination: unknown
  resume(): Promise<void>
  close(): Promise<void>
  createOscillator(): OscillatorLike
  createGain(): GainLike
}

export interface AudioSynth {
  unlock(): Promise<boolean>
  play(cue: AudioCue): boolean
  playCountdown(second: number): boolean
  setEnabled(enabled: boolean): void
  dispose(): Promise<void>
}

const cueConfig: Record<AudioCue, { frequency: number; duration: number; type: string }> = {
  correct: { frequency: 880, duration: 0.12, type: 'sine' },
  pass: { frequency: 180, duration: 0.18, type: 'sawtooth' },
  yes: { frequency: 720, duration: 0.1, type: 'sine' },
  no: { frequency: 220, duration: 0.14, type: 'square' },
  maybe: { frequency: 480, duration: 0.13, type: 'triangle' },
  foul: { frequency: 130, duration: 0.22, type: 'square' },
  tick: { frequency: 1_050, duration: 0.04, type: 'sine' },
}

function defaultContextFactory(): AudioContextLike {
  const Constructor = window.AudioContext
  return new Constructor() as unknown as AudioContextLike
}

export function createAudioSynth(
  contextFactory: () => AudioContextLike = defaultContextFactory,
): AudioSynth {
  let context: AudioContextLike | null = null
  let enabled = true
  let lastCountdownSecond: number | null = null

  return {
    async unlock() {
      if (!enabled) return false
      try {
        context ??= contextFactory()
        if (context.state !== 'running') await context.resume()
        return context.state === 'running'
      } catch {
        context = null
        return false
      }
    },
    play(cue) {
      if (!enabled || !context || context.state !== 'running') return false
      try {
        const config = cueConfig[cue]
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const start = context.currentTime
        oscillator.type = config.type
        oscillator.frequency.setValueAtTime(config.frequency, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + config.duration)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + config.duration)
        return true
      } catch {
        return false
      }
    },
    playCountdown(second) {
      if (second < 1 || second > 10 || second === lastCountdownSecond) return false
      lastCountdownSecond = second
      return this.play('tick')
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled
      if (!enabled) lastCountdownSecond = null
    },
    async dispose() {
      const current = context
      context = null
      lastCountdownSecond = null
      if (current && current.state !== 'closed') {
        try {
          await current.close()
        } catch {
          // Audio cleanup is best-effort.
        }
      }
    },
  }
}
