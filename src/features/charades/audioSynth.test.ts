import { describe, expect, it, vi } from 'vitest'
import { createAudioSynth } from './audioSynth'

function fakeAudioContext() {
  const starts: number[] = []
  const frequencies: number[] = []
  const parameter = () => ({
    setValueAtTime: vi.fn((value: number) => { frequencies.push(value) }),
    exponentialRampToValueAtTime: vi.fn(),
  })
  const context = {
    state: 'suspended',
    currentTime: 1,
    destination: {},
    resume: vi.fn(async () => { context.state = 'running' }),
    close: vi.fn(async () => { context.state = 'closed' }),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: parameter(),
      connect: vi.fn(),
      start: vi.fn((time: number) => { starts.push(time) }),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({ gain: parameter(), connect: vi.fn() })),
  }
  return { context, starts, frequencies }
}

describe('audio synth', () => {
  it('unlocks from a gesture and synthesizes distinct cues without media assets', async () => {
    const fake = fakeAudioContext()
    const synth = createAudioSynth(() => fake.context)

    expect(synth.play('correct')).toBe(false)
    expect(await synth.unlock()).toBe(true)
    expect(synth.play('correct')).toBe(true)
    expect(synth.play('pass')).toBe(true)
    expect(synth.play('bomb-accept')).toBe(true)
    expect(synth.play('explode')).toBe(true)

    expect(fake.context.resume).toHaveBeenCalledTimes(1)
    expect(new Set(fake.frequencies).size).toBeGreaterThan(1)
    expect(fake.starts).toHaveLength(4)
  })

  it('ticks once per countdown second and stops immediately when disabled or disposed', async () => {
    const fake = fakeAudioContext()
    const synth = createAudioSynth(() => fake.context)
    await synth.unlock()

    expect(synth.playCountdown(10)).toBe(true)
    expect(synth.playCountdown(10)).toBe(false)
    expect(synth.playCountdown(9)).toBe(true)
    synth.setEnabled(false)
    expect(synth.playCountdown(8)).toBe(false)
    await synth.dispose()
    expect(fake.context.close).toHaveBeenCalledTimes(1)
  })
})
