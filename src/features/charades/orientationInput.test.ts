import { describe, expect, it } from 'vitest'
import { createOrientationRecognizer, normalizeForwardTilt } from './orientationInput'

describe('normalizeForwardTilt', () => {
  it('maps beta and gamma into one screen-relative axis for every right-angle rotation', () => {
    expect(normalizeForwardTilt(10, 20, 0)).toBe(10)
    expect(normalizeForwardTilt(10, 20, 90)).toBe(-20)
    expect(normalizeForwardTilt(10, 20, 180)).toBe(-10)
    expect(normalizeForwardTilt(10, 20, 270)).toBe(20)
  })
})

describe('orientation recognizer', () => {
  it('calibrates a stable baseline for one second then emits once until neutral re-arms', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 5, dwellMs: 80 })
    recognizer.startCalibration(0)
    for (const time of [0, 250, 500, 750, 1_000]) {
      expect(recognizer.update({ beta: 10, gamma: 0, angle: 0 }, time).action).toBeNull()
    }
    expect(recognizer.getStatus()).toBe('armed')

    expect(recognizer.update({ beta: 42, gamma: 0, angle: 0 }, 1_100).action).toBeNull()
    expect(recognizer.update({ beta: 42, gamma: 0, angle: 0 }, 1_180).action).toBe('correct')
    expect(recognizer.update({ beta: 45, gamma: 0, angle: 0 }, 1_300).action).toBeNull()

    recognizer.update({ beta: 12, gamma: 0, angle: 0 }, 1_400)
    expect(recognizer.update({ beta: -22, gamma: 0, angle: 0 }, 1_500).action).toBeNull()
    expect(recognizer.update({ beta: -22, gamma: 0, angle: 0 }, 1_580).action).toBe('pass')
  })

  it('fails open when calibration samples are unstable or incomplete', () => {
    const unstable = createOrientationRecognizer({ minimumSamples: 3, maximumCalibrationSpread: 5 })
    unstable.startCalibration(0)
    unstable.update({ beta: 0, gamma: 0, angle: 0 }, 0)
    unstable.update({ beta: 20, gamma: 0, angle: 0 }, 500)
    unstable.update({ beta: 0, gamma: 0, angle: 0 }, 1_000)

    expect(unstable.getStatus()).toBe('failed')
    expect(unstable.update({ beta: 40, gamma: 0, angle: 0 }, 1_200).action).toBeNull()
  })

  it('disables motion when screen orientation changes after calibration', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 2 })
    recognizer.startCalibration(0)
    recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 0)
    recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 1_000)

    recognizer.update({ beta: 5, gamma: 5, angle: 0 }, 1_100)

    expect(recognizer.getStatus()).toBe('failed')
  })
})
