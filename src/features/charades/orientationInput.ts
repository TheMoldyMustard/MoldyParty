import type { CharadesOutcome } from '../../domain/charades'

export interface OrientationSample {
  beta: number | null
  gamma: number | null
  angle: number
}

export type OrientationRecognizerStatus =
  | 'idle'
  | 'calibrating-neutral'
  | 'calibrating-correct'
  | 'returning-neutral'
  | 'armed'
  | 'latched'
  | 'failed'

export interface OrientationRecognizerOptions {
  calibrationMs?: number
  minimumSamples?: number
  maximumCalibrationSpread?: number
  gestureCalibrationMs?: number
  minimumGestureSamples?: number
  minimumGestureMagnitude?: number
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
  beginGameplay(): void
  update(sample: OrientationSample, nowMs: number): { action: CharadesOutcome | null; status: OrientationRecognizerStatus }
  getStatus(): OrientationRecognizerStatus
}

export function createOrientationRecognizer(options: OrientationRecognizerOptions = {}): OrientationRecognizer {
  const calibrationMs = options.calibrationMs ?? 1_000
  const minimumSamples = options.minimumSamples ?? 8
  const maximumCalibrationSpread = options.maximumCalibrationSpread ?? 8
  const gestureCalibrationMs = options.gestureCalibrationMs ?? 250
  const minimumGestureSamples = options.minimumGestureSamples ?? 3
  const minimumGestureMagnitude = options.minimumGestureMagnitude ?? 16
  const neutralThreshold = options.neutralThreshold ?? 8
  const dwellMs = options.dwellMs ?? 100

  let status: OrientationRecognizerStatus = 'idle'
  let calibrationStartedAt = 0
  let calibrationAngle = 0
  let calibrationAngleKnown = false
  let recoveringFromRotation = false
  let gameplayStarted = false
  let betaSamples: number[] = []
  let gammaSamples: number[] = []
  let neutralBeta = 0
  let neutralGamma = 0
  let correctStartedAt: number | null = null
  let correctBetaSamples: number[] = []
  let correctGammaSamples: number[] = []
  let correctAxisBeta = 0
  let correctAxisGamma = 0
  let learnedActionThreshold = options.actionThreshold ?? 25
  let returnNeutralSince: number | null = null
  let candidate: CharadesOutcome | null = null
  let candidateSince = 0

  function result(action: CharadesOutcome | null = null) {
    return { action, status }
  }

  function median(values: number[]) {
    const ordered = [...values].sort((left, right) => left - right)
    return ordered[Math.floor(ordered.length / 2)]
  }

  function spread(values: number[]) {
    if (values.length === 0) return Number.POSITIVE_INFINITY
    return Math.max(...values) - Math.min(...values)
  }

  function beginNeutralCalibration(startedAtMs: number, angle?: number, recovering = false) {
    status = 'calibrating-neutral'
    calibrationStartedAt = startedAtMs
    calibrationAngle = angle ?? 0
    calibrationAngleKnown = angle !== undefined
    recoveringFromRotation = recovering
    betaSamples = []
    gammaSamples = []
    neutralBeta = 0
    neutralGamma = 0
    correctStartedAt = null
    correctBetaSamples = []
    correctGammaSamples = []
    correctAxisBeta = 0
    correctAxisGamma = 0
    learnedActionThreshold = options.actionThreshold ?? 25
    returnNeutralSince = null
    candidate = null
    candidateSince = 0
  }

  function distanceFromNeutral(beta: number, gamma: number) {
    return Math.hypot(beta - neutralBeta, gamma - neutralGamma)
  }

  return {
    startCalibration(startedAtMs) {
      gameplayStarted = false
      beginNeutralCalibration(startedAtMs)
    },
    beginGameplay() {
      gameplayStarted = true
    },
    update(sample, nowMs) {
      if (status === 'idle' || status === 'failed') return result()
      const normalizedAngle = ((Math.round(sample.angle / 90) * 90) % 360 + 360) % 360
      if (!calibrationAngleKnown) {
        calibrationAngle = normalizedAngle
        calibrationAngleKnown = true
      } else if (normalizedAngle !== calibrationAngle) {
        if (gameplayStarted) {
          status = 'failed'
          candidate = null
          return result()
        }
        beginNeutralCalibration(nowMs, normalizedAngle, true)
      }
      if (!Number.isFinite(sample.beta) || !Number.isFinite(sample.gamma)) return result()
      const beta = sample.beta as number
      const gamma = sample.gamma as number

      if (status === 'calibrating-neutral') {
        betaSamples.push(beta)
        gammaSamples.push(gamma)
        if (nowMs - calibrationStartedAt < calibrationMs) return result()
        const stable = betaSamples.length >= minimumSamples
          && gammaSamples.length >= minimumSamples
          && spread(betaSamples) <= maximumCalibrationSpread
          && spread(gammaSamples) <= maximumCalibrationSpread
        if (!stable) {
          if (recoveringFromRotation) {
            beginNeutralCalibration(nowMs, normalizedAngle, true)
            betaSamples.push(beta)
            gammaSamples.push(gamma)
            return result()
          }
          status = 'failed'
          return result()
        }
        neutralBeta = median(betaSamples)
        neutralGamma = median(gammaSamples)
        status = 'calibrating-correct'
        correctStartedAt = null
        correctBetaSamples = []
        correctGammaSamples = []
        return result()
      }

      if (status === 'calibrating-correct') {
        const deltaBeta = beta - neutralBeta
        const deltaGamma = gamma - neutralGamma
        const gestureMagnitude = Math.hypot(deltaBeta, deltaGamma)
        if (gestureMagnitude < minimumGestureMagnitude) {
          correctStartedAt = null
          correctBetaSamples = []
          correctGammaSamples = []
          return result()
        }
        if (correctBetaSamples.length > 0) {
          const referenceBeta = correctBetaSamples[0]
          const referenceGamma = correctGammaSamples[0]
          const referenceMagnitude = Math.hypot(referenceBeta, referenceGamma)
          const alignment = (deltaBeta * referenceBeta + deltaGamma * referenceGamma)
            / (gestureMagnitude * referenceMagnitude)
          if (alignment < 0.8) {
            correctStartedAt = nowMs
            correctBetaSamples = [deltaBeta]
            correctGammaSamples = [deltaGamma]
            return result()
          }
        }
        if (correctStartedAt === null) correctStartedAt = nowMs
        correctBetaSamples.push(deltaBeta)
        correctGammaSamples.push(deltaGamma)
        if (nowMs - correctStartedAt < gestureCalibrationMs || correctBetaSamples.length < minimumGestureSamples) return result()

        const learnedBeta = median(correctBetaSamples)
        const learnedGamma = median(correctGammaSamples)
        const learnedMagnitude = Math.hypot(learnedBeta, learnedGamma)
        if (learnedMagnitude < minimumGestureMagnitude) {
          correctStartedAt = null
          correctBetaSamples = []
          correctGammaSamples = []
          return result()
        }
        correctAxisBeta = learnedBeta / learnedMagnitude
        correctAxisGamma = learnedGamma / learnedMagnitude
        learnedActionThreshold = options.actionThreshold
          ?? Math.min(30, Math.max(neutralThreshold + 4, learnedMagnitude * 0.5))
        status = 'returning-neutral'
        returnNeutralSince = null
        return result()
      }

      if (status === 'returning-neutral') {
        if (distanceFromNeutral(beta, gamma) <= neutralThreshold) {
          if (returnNeutralSince === null) returnNeutralSince = nowMs
          if (nowMs - returnNeutralSince >= dwellMs) status = 'armed'
        } else {
          returnNeutralSince = null
        }
        return result()
      }

      const distance = distanceFromNeutral(beta, gamma)
      if (distance <= neutralThreshold) {
        candidate = null
        if (status === 'latched') status = 'armed'
        return result()
      }
      if (status === 'latched') return result()

      const projection = (beta - neutralBeta) * correctAxisBeta + (gamma - neutralGamma) * correctAxisGamma
      const nextCandidate = projection >= learnedActionThreshold ? 'correct' : projection <= -learnedActionThreshold ? 'pass' : null
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
