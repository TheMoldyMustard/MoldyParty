import { describe, expect, it } from 'vitest'
import { createTiltRecognizer, type GravitySample, type TiltRecognizer } from './tiltInput'

const NEUTRAL: GravitySample = { x: 9.8, y: 0, z: 0, angle: 90 }
const CORRECT: GravitySample = { x: 8.487, y: 0, z: 4.9, angle: 90 }
const PASS: GravitySample = { x: 8.487, y: 0, z: -4.9, angle: 90 }

function update(recognizer: TiltRecognizer, sample: GravitySample, time: number) {
  return recognizer.update(sample, time)
}

function completeNeutral(recognizer: TiltRecognizer, sample: GravitySample = NEUTRAL, start = 0) {
  recognizer.startCalibration(start)
  for (const time of [start, start + 250, start + 500, start + 750, start + 1_000]) {
    update(recognizer, sample, time)
  }
}

function completeGuidedCalibration(recognizer: TiltRecognizer) {
  completeNeutral(recognizer)
  expect(recognizer.getStatus()).toBe('calibrating-correct')

  update(recognizer, CORRECT, 1_100)
  update(recognizer, CORRECT, 1_200)
  expect(update(recognizer, CORRECT, 1_350)).toEqual({ action: null, status: 'returning-neutral' })
  expect(update(recognizer, NEUTRAL, 1_400)).toEqual({ action: null, status: 'returning-neutral' })
  expect(update(recognizer, NEUTRAL, 1_500)).toEqual({ action: null, status: 'armed' })
}

describe('gravity tilt recognizer', () => {
  it('learns phone-face-up as Correct and the opposite physical tilt as Pass', () => {
    const recognizer = createTiltRecognizer({
      minimumSamples: 5,
      gestureCalibrationMs: 200,
      minimumGestureSamples: 3,
      dwellMs: 80,
    })
    completeGuidedCalibration(recognizer)
    recognizer.beginGameplay()

    expect(update(recognizer, CORRECT, 1_600).action).toBeNull()
    expect(update(recognizer, CORRECT, 1_680).action).toBe('correct')
    expect(update(recognizer, CORRECT, 1_700).action).toBeNull()
    expect(update(recognizer, NEUTRAL, 1_760).status).toBe('armed')
    expect(update(recognizer, PASS, 1_850).action).toBeNull()
    expect(update(recognizer, PASS, 1_930).action).toBe('pass')
  })

  it.each([90, 270])('keeps Pass reachable after a full face-up demonstration at %s° landscape', (angle) => {
    const neutral = { x: 9.8, y: 0, z: 0, angle }
    const faceUp = { x: 0, y: 0, z: 9.8, angle }
    const faceDown = { x: 0, y: 0, z: -9.8, angle }
    const recognizer = createTiltRecognizer({
      minimumSamples: 5,
      gestureCalibrationMs: 200,
      minimumGestureSamples: 3,
      dwellMs: 80,
    })

    completeNeutral(recognizer, neutral)
    update(recognizer, faceUp, 1_100)
    update(recognizer, faceUp, 1_200)
    update(recognizer, faceUp, 1_350)
    update(recognizer, neutral, 1_400)
    update(recognizer, neutral, 1_500)
    recognizer.beginGameplay()

    expect(update(recognizer, faceUp, 1_600).action).toBeNull()
    expect(update(recognizer, faceUp, 1_680).action).toBe('correct')
    update(recognizer, neutral, 1_760)
    expect(update(recognizer, faceDown, 1_850).action).toBeNull()
    expect(update(recognizer, faceDown, 1_930).action).toBe('pass')
  })

  it('keeps landscape-vertical neutral stable where equivalent Euler angles wrapped', () => {
    const recognizer = createTiltRecognizer({ minimumSamples: 5, maximumCalibrationSpread: 5 })
    recognizer.startCalibration(0)
    const jitter = [
      { x: 9.8, y: 0.02, z: 0.08, angle: 90 },
      { x: 9.8, y: -0.03, z: -0.07, angle: 90 },
      { x: 9.79, y: 0.01, z: 0.04, angle: 90 },
      { x: 9.81, y: -0.02, z: -0.05, angle: 90 },
      NEUTRAL,
    ] satisfies GravitySample[]

    jitter.forEach((sample, index) => update(recognizer, sample, index * 250))

    expect(recognizer.getStatus()).toBe('calibrating-correct')
  })

  it('does not arm from a weak Correct demonstration', () => {
    const recognizer = createTiltRecognizer({ minimumSamples: 5, gestureCalibrationMs: 200, minimumGestureSamples: 3 })
    completeNeutral(recognizer)
    const weak = { x: 9.705, y: 0, z: 1.364, angle: 90 }

    for (const time of [1_100, 1_250, 1_500]) update(recognizer, weak, time)

    expect(recognizer.getStatus()).toBe('calibrating-correct')
  })

  it('rejects missing, non-finite, and zero-length gravity vectors', () => {
    const recognizer = createTiltRecognizer({ minimumSamples: 2 })
    recognizer.startCalibration(0)

    update(recognizer, { x: null, y: 0, z: 0, angle: 90 }, 0)
    update(recognizer, { x: Number.NaN, y: 0, z: 0, angle: 90 }, 500)
    update(recognizer, { x: 0, y: 0, z: 0, angle: 90 }, 1_000)

    expect(recognizer.getStatus()).toBe('calibrating-neutral')
  })

  it('fails neutral calibration when physical gravity samples are unstable', () => {
    const recognizer = createTiltRecognizer({ minimumSamples: 3, maximumCalibrationSpread: 5 })
    recognizer.startCalibration(0)
    update(recognizer, NEUTRAL, 0)
    update(recognizer, { x: 0, y: 9.8, z: 0, angle: 90 }, 500)
    update(recognizer, NEUTRAL, 1_000)

    expect(recognizer.getStatus()).toBe('failed')
  })

  it('restarts calibration on screen rotation before gameplay', () => {
    const recognizer = createTiltRecognizer({ minimumSamples: 2 })
    completeNeutral(recognizer)
    const rotated = { ...NEUTRAL, angle: 270 }

    expect(update(recognizer, rotated, 1_100)).toEqual({ action: null, status: 'calibrating-neutral' })
    expect(update(recognizer, rotated, 2_100)).toEqual({ action: null, status: 'calibrating-correct' })
  })

  it('fails tilt closed on screen rotation after gameplay begins', () => {
    const recognizer = createTiltRecognizer({
      minimumSamples: 5,
      gestureCalibrationMs: 200,
      minimumGestureSamples: 3,
      dwellMs: 80,
    })
    completeGuidedCalibration(recognizer)
    recognizer.beginGameplay()

    expect(update(recognizer, { ...CORRECT, angle: 270 }, 1_600)).toEqual({ action: null, status: 'failed' })
  })
})
