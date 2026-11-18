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

  it('restarts calibration when screen orientation changes during calibration', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 2 })
    recognizer.startCalibration(0)
    recognizer.update({ beta: 5, gamma: 5, angle: 0 }, 0)

    expect(recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 500)).toEqual({ action: null, status: 'calibrating' })
    expect(recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 1_000)).toEqual({ action: null, status: 'calibrating' })
    expect(recognizer.update({ beta: 5, gamma: 5, angle: 90 }, 1_500)).toEqual({ action: null, status: 'armed' })
  })

  it('recalibrates without emitting an action when screen orientation changes after arming', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 2 })
    recognizer.startCalibration(0)
    recognizer.update({ beta: 5, gamma: 5, angle: 0 }, 0)
    recognizer.update({ beta: 5, gamma: 5, angle: 0 }, 1_000)

    expect(recognizer.update({ beta: 45, gamma: 5, angle: 90 }, 1_100)).toEqual({ action: null, status: 'calibrating' })
    expect(recognizer.update({ beta: 45, gamma: 5, angle: 90 }, 2_100)).toEqual({ action: null, status: 'armed' })

    expect(recognizer.getStatus()).toBe('armed')
  })

  it('keeps recalibrating after an unstable rotation until a stable baseline is available', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 2, maximumCalibrationSpread: 5 })
    recognizer.startCalibration(0)
    recognizer.update({ beta: 0, gamma: 0, angle: 0 }, 0)
    recognizer.update({ beta: 0, gamma: 0, angle: 0 }, 1_000)

    recognizer.update({ beta: 0, gamma: -20, angle: 90 }, 1_100)
    expect(recognizer.update({ beta: 0, gamma: 0, angle: 90 }, 2_100)).toEqual({ action: null, status: 'calibrating' })
    expect(recognizer.update({ beta: 0, gamma: 0, angle: 90 }, 3_100)).toEqual({ action: null, status: 'armed' })
  })

  it('clears a pending gesture when an angle change arrives without tilt axes', () => {
    const recognizer = createOrientationRecognizer({ minimumSamples: 2, dwellMs: 100 })
    recognizer.startCalibration(0)
    recognizer.update({ beta: 0, gamma: 0, angle: 0 }, 0)
    recognizer.update({ beta: 0, gamma: 0, angle: 0 }, 1_000)
    recognizer.update({ beta: 40, gamma: 0, angle: 0 }, 1_100)

    expect(recognizer.update({ beta: null, gamma: null, angle: 90 }, 1_150)).toEqual({ action: null, status: 'calibrating' })
    expect(recognizer.update({ beta: 40, gamma: 0, angle: 0 }, 1_250)).toEqual({ action: null, status: 'calibrating' })
  })
})
