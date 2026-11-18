import { describe, expect, it } from 'vitest'
import { createOrientationRecognizer, normalizeForwardTilt, type OrientationRecognizer } from './orientationInput'

describe('normalizeForwardTilt', () => {
  it('maps beta and gamma into one screen-relative axis for every right-angle rotation', () => {
    expect(normalizeForwardTilt(10, 20, 0)).toBe(10)
    expect(normalizeForwardTilt(10, 20, 90)).toBe(-20)
    expect(normalizeForwardTilt(10, 20, 180)).toBe(-10)
    expect(normalizeForwardTilt(10, 20, 270)).toBe(20)
  })
})

function completeNeutral(
  recognizer: OrientationRecognizer,
  { beta = 10, gamma = 20, angle = 0, start = 0 } = {},
) {
  recognizer.startCalibration(start)
  for (const time of [start, start + 250, start + 500, start + 750, start + 1_000]) {
    recognizer.update({ beta, gamma, angle }, time)
  }
}

function completeGuidedCalibration(recognizer: OrientationRecognizer) {
  completeNeutral(recognizer)
  expect(recognizer.getStatus()).toBe('calibrating-correct')

  recognizer.update({ beta: 10, gamma: -20, angle: 0 }, 1_100)
  recognizer.update({ beta: 10, gamma: -20, angle: 0 }, 1_200)
  expect(recognizer.update({ beta: 10, gamma: -20, angle: 0 }, 1_350)).toEqual({ action: null, status: 'returning-neutral' })

  expect(recognizer.update({ beta: 10, gamma: 20, angle: 0 }, 1_400)).toEqual({ action: null, status: 'returning-neutral' })
  expect(recognizer.update({ beta: 10, gamma: 20, angle: 0 }, 1_500)).toEqual({ action: null, status: 'armed' })
}

describe('orientation recognizer', () => {
  it('learns a gamma-dominant phone-face-up gesture as Correct and its opposite as Pass', () => {
    const recognizer = createOrientationRecognizer({
      minimumSamples: 5,
      gestureCalibrationMs: 200,
      minimumGestureSamples: 3,
      dwellMs: 80,
    })
    completeGuidedCalibration(recognizer)

    expect(recognizer.update({ beta: 10, gamma: -20, angle: 0 }, 1_600).action).toBeNull()
    expect(recognizer.update({ beta: 10, gamma: -20, angle: 0 }, 1_680).action).toBe('correct')
    expect(recognizer.update({ beta: 10, gamma: 20, angle: 0 }, 1_760).status).toBe('armed')
    expect(recognizer.update({ beta: 10, gamma: 60, angle: 0 }, 1_850).action).toBeNull()
    expect(recognizer.update({ beta: 10, gamma: 60, angle: 0 }, 1_930).action).toBe('pass')
  })

  it('does not arm from a weak phone-face-up demonstration', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 5, gestureCalibrationMs: 200, minimumGestureSamples: 3 })
    completeNeutral(recognizer)

    for (const time of [1_100, 1_250, 1_500]) {
      recognizer.update({ beta: 10, gamma: 10, angle: 0 }, time)
    }

    expect(recognizer.getStatus()).toBe('calibrating-correct')
  })

  it('does not learn an oscillating demonstration as the Correct direction', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 5, gestureCalibrationMs: 200, minimumGestureSamples: 3 })
    completeNeutral(recognizer)

    recognizer.update({ beta: 30, gamma: 20, angle: 0 }, 1_100)
    recognizer.update({ beta: -10, gamma: 20, angle: 0 }, 1_250)
    recognizer.update({ beta: 30, gamma: 20, angle: 0 }, 1_500)

    expect(recognizer.getStatus()).toBe('calibrating-correct')
  })

  it('fails open when neutral calibration samples are unstable', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 3, maximumCalibrationSpread: 5 })
    recognizer.startCalibration(0)
    recognizer.update({ beta: 0, gamma: 0, angle: 0 }, 0)
    recognizer.update({ beta: 20, gamma: 0, angle: 0 }, 500)
    recognizer.update({ beta: 0, gamma: 0, angle: 0 }, 1_000)

    expect(recognizer.getStatus()).toBe('failed')
  })

  it('restarts guided calibration from neutral when orientation changes before gameplay', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 2 })
    completeNeutral(recognizer, { beta: 5, gamma: 5 })

    expect(recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 1_100)).toEqual({ action: null, status: 'calibrating-neutral' })
    expect(recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 2_100)).toEqual({ action: null, status: 'calibrating-correct' })
  })

  it('fails tilt closed when orientation changes after gameplay begins', () => {
    const recognizer = createOrientationRecognizer({
      minimumSamples: 5,
      gestureCalibrationMs: 200,
      minimumGestureSamples: 3,
      dwellMs: 80,
    })
    completeGuidedCalibration(recognizer)
    recognizer.beginGameplay()

    expect(recognizer.update({ beta: 10, gamma: -20, angle: 90 }, 1_600)).toEqual({ action: null, status: 'failed' })
  })
})
