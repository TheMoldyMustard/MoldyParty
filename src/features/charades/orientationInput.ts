import type { CharadesOutcome } from '../../domain/charades'

export interface OrientationSample {
  beta: number | null
  gamma: number | null
  angle: number
}

export type OrientationRecognizerStatus = 'idle' | 'calibrating' | 'armed' | 'latched' | 'failed'

export interface OrientationRecognizerOptions {
  calibrationMs?: number
  minimumSamples?: number
  maximumCalibrationSpread?: number
  actionThreshold?: number
  neutralThreshold?: number
  dwellMs?: number
}

export function normalizeForwardTilt(beta: number, gamma: number, angle: number): number {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360
  if (normalized === 90) return -gamma
  if (normalized === 180) return -beta
  if (normalized === 270) return gamma
  return beta
}

export interface OrientationRecognizer {
  startCalibration(startedAtMs: number): void
  update(sample: OrientationSample, nowMs: number): { action: CharadesOutcome | null; status: OrientationRecognizerStatus }
  getStatus(): OrientationRecognizerStatus
}

export function createOrientationRecognizer(options: OrientationRecognizerOptions = {}): OrientationRecognizer {
  const calibrationMs = options.calibrationMs ?? 1_000
  const minimumSamples = options.minimumSamples ?? 8
  const maximumCalibrationSpread = options.maximumCalibrationSpread ?? 8
  const actionThreshold = options.actionThreshold ?? 25
  const neutralThreshold = options.neutralThreshold ?? 8
  const dwellMs = options.dwellMs ?? 100

  let status: OrientationRecognizerStatus = 'idle'
  let calibrationStartedAt = 0
  let calibrationAngle = 0
  let calibrationAngleKnown = false
  let recoveringFromRotation = false
  let samples: number[] = []
  let baseline = 0
  let candidate: CharadesOutcome | null = null
  let candidateSince = 0

  function result(action: CharadesOutcome | null = null) {
    return { action, status }
  }

  function beginCalibration(startedAtMs: number, angle?: number, recovering = false) {
    status = 'calibrating'
    calibrationStartedAt = startedAtMs
    calibrationAngle = angle ?? 0
    calibrationAngleKnown = angle !== undefined
    recoveringFromRotation = recovering
    samples = []
    baseline = 0
    candidate = null
    candidateSince = 0
  }

  return {
    startCalibration(startedAtMs) {
      beginCalibration(startedAtMs)
    },
    update(sample, nowMs) {
      if (status === 'idle' || status === 'failed') return result()
      const normalizedAngle = ((Math.round(sample.angle / 90) * 90) % 360 + 360) % 360
      if (!calibrationAngleKnown) {
        calibrationAngle = normalizedAngle
        calibrationAngleKnown = true
      } else if (normalizedAngle !== calibrationAngle) {
        beginCalibration(nowMs, normalizedAngle, true)
      }
      if (!Number.isFinite(sample.beta) || !Number.isFinite(sample.gamma)) return result()
      const beta = sample.beta as number
      const gamma = sample.gamma as number

      if (status === 'calibrating') {
        const normalizedTilt = normalizeForwardTilt(beta, gamma, normalizedAngle)
        samples.push(normalizedTilt)
        if (nowMs - calibrationStartedAt < calibrationMs) return result()
        const ordered = [...samples].sort((left, right) => left - right)
        const spread = ordered.length > 0 ? ordered[ordered.length - 1] - ordered[0] : Number.POSITIVE_INFINITY
        if (ordered.length < minimumSamples || spread > maximumCalibrationSpread) {
          if (recoveringFromRotation) {
            beginCalibration(nowMs, normalizedAngle, true)
            samples.push(normalizedTilt)
            return result()
          }
          status = 'failed'
          return result()
        }
        baseline = ordered[Math.floor(ordered.length / 2)]
        status = 'armed'
        return result()
      }

      const delta = normalizeForwardTilt(beta, gamma, normalizedAngle) - baseline
      if (Math.abs(delta) <= neutralThreshold) {
        candidate = null
        if (status === 'latched') status = 'armed'
        return result()
      }
      if (status === 'latched') return result()

      const nextCandidate = delta >= actionThreshold ? 'correct' : delta <= -actionThreshold ? 'pass' : null
      if (!nextCandidate) {
        candidate = null
        return result()
      }
      if (candidate !== nextCandidate) {
        candidate = nextCandidate
        candidateSince = nowMs
        return result()
      }
      if (nowMs - candidateSince >= dwellMs) {
        status = 'latched'
        candidate = null
        return result(nextCandidate)
      }
      return result()
    },
    getStatus() {
      return status
    },
  }
}
