import type { CharadesOutcome } from '../../domain/charades'

export interface GravitySample {
  x: number | null
  y: number | null
  z: number | null
  angle: number
}

export type TiltRecognizerStatus =
  | 'idle'
  | 'calibrating-neutral'
  | 'calibrating-correct'
  | 'returning-neutral'
  | 'armed'
  | 'latched'
  | 'failed'

export interface TiltRecognizerOptions {
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

export interface TiltRecognizer {
  startCalibration(startedAtMs: number): void
  beginGameplay(): void
  update(sample: GravitySample, nowMs: number): { action: CharadesOutcome | null; status: TiltRecognizerStatus }
  getStatus(): TiltRecognizerStatus
}

interface Vector3 {
  x: number
  y: number
  z: number
}

const degreesToRadians = (degrees: number) => degrees * Math.PI / 180
const degreesToChord = (degrees: number) => 2 * Math.sin(degreesToRadians(degrees) / 2)
const dot = (left: Vector3, right: Vector3) => left.x * right.x + left.y * right.y + left.z * right.z
const subtract = (left: Vector3, right: Vector3): Vector3 => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z,
})

function normalize(vector: Vector3): Vector3 | null {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z)
  if (!Number.isFinite(magnitude) || magnitude <= Number.EPSILON) return null
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude }
}

function normalizeSample(sample: GravitySample): Vector3 | null {
  if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y) || !Number.isFinite(sample.z)) return null
  return normalize({ x: sample.x as number, y: sample.y as number, z: sample.z as number })
}

function angularDistance(left: Vector3, right: Vector3) {
  return Math.acos(Math.min(1, Math.max(-1, dot(left, right)))) * 180 / Math.PI
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.floor(ordered.length / 2)]
}

function medianVector(values: Vector3[]) {
  return normalize({
    x: median(values.map((value) => value.x)),
    y: median(values.map((value) => value.y)),
    z: median(values.map((value) => value.z)),
  })
}

export function createTiltRecognizer(options: TiltRecognizerOptions = {}): TiltRecognizer {
  const calibrationMs = options.calibrationMs ?? 1_000
  const minimumSamples = options.minimumSamples ?? 8
  const maximumCalibrationSpread = options.maximumCalibrationSpread ?? 8
  const gestureCalibrationMs = options.gestureCalibrationMs ?? 250
  const minimumGestureSamples = options.minimumGestureSamples ?? 3
  const minimumGestureMagnitude = options.minimumGestureMagnitude ?? 16
  const neutralThreshold = options.neutralThreshold ?? 8
  const dwellMs = options.dwellMs ?? 100

  let status: TiltRecognizerStatus = 'idle'
  let calibrationStartedAt = 0
  let calibrationAngle = 0
  let calibrationAngleKnown = false
  let recoveringFromRotation = false
  let gameplayStarted = false
  let neutralSamples: Vector3[] = []
  let neutralVector: Vector3 = { x: 0, y: 0, z: 1 }
  let correctStartedAt: number | null = null
  let correctSamples: Vector3[] = []
  let correctAxis: Vector3 = { x: 0, y: 0, z: 1 }
  let learnedActionThreshold = degreesToChord(options.actionThreshold ?? 25)
  let returnNeutralSince: number | null = null
  let candidate: CharadesOutcome | null = null
  let candidateSince = 0

  function result(action: CharadesOutcome | null = null) {
    return { action, status }
  }

  function beginNeutralCalibration(startedAtMs: number, angle?: number, recovering = false) {
    status = 'calibrating-neutral'
    calibrationStartedAt = startedAtMs
    calibrationAngle = angle ?? 0
    calibrationAngleKnown = angle !== undefined
    recoveringFromRotation = recovering
    neutralSamples = []
    correctStartedAt = null
    correctSamples = []
    learnedActionThreshold = degreesToChord(options.actionThreshold ?? 25)
    returnNeutralSince = null
    candidate = null
    candidateSince = 0
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

      const vector = normalizeSample(sample)
      if (!vector) return result()

      if (status === 'calibrating-neutral') {
        neutralSamples.push(vector)
        if (nowMs - calibrationStartedAt < calibrationMs) return result()
        const baseline = medianVector(neutralSamples)
        const stable = baseline !== null
          && neutralSamples.length >= minimumSamples
          && neutralSamples.every((value) => angularDistance(value, baseline) <= maximumCalibrationSpread)
        if (!stable) {
          if (recoveringFromRotation) {
            beginNeutralCalibration(nowMs, normalizedAngle, true)
            neutralSamples.push(vector)
            return result()
          }
          status = 'failed'
          return result()
        }
        neutralVector = baseline
        status = 'calibrating-correct'
        correctStartedAt = null
        correctSamples = []
        return result()
      }

      if (status === 'calibrating-correct') {
        const displacement = subtract(vector, neutralVector)
        const gestureMagnitude = angularDistance(vector, neutralVector)
        if (gestureMagnitude < minimumGestureMagnitude) {
          correctStartedAt = null
          correctSamples = []
          return result()
        }
        if (correctSamples.length > 0) {
          const reference = subtract(correctSamples[0], neutralVector)
          const alignment = dot(displacement, reference)
            / (Math.hypot(displacement.x, displacement.y, displacement.z) * Math.hypot(reference.x, reference.y, reference.z))
          if (alignment < 0.8) {
            correctStartedAt = nowMs
            correctSamples = [vector]
            return result()
          }
        }
        if (correctStartedAt === null) correctStartedAt = nowMs
        correctSamples.push(vector)
        if (nowMs - correctStartedAt < gestureCalibrationMs || correctSamples.length < minimumGestureSamples) return result()

        const correctVector = medianVector(correctSamples)
        if (!correctVector) return result()
        const learnedMagnitude = angularDistance(correctVector, neutralVector)
        const axis = normalize(subtract(correctVector, neutralVector))
        if (!axis || learnedMagnitude < minimumGestureMagnitude) {
          correctStartedAt = null
          correctSamples = []
          return result()
        }
        correctAxis = axis
        const learnedThresholdDegrees = options.actionThreshold
          ?? Math.min(30, Math.max(neutralThreshold + 4, learnedMagnitude * 0.5))
        learnedActionThreshold = degreesToChord(learnedThresholdDegrees)
        status = 'returning-neutral'
        returnNeutralSince = null
        return result()
      }

      const distance = angularDistance(vector, neutralVector)
      if (status === 'returning-neutral') {
        if (distance <= neutralThreshold) {
          if (returnNeutralSince === null) returnNeutralSince = nowMs
          if (nowMs - returnNeutralSince >= dwellMs) status = 'armed'
        } else {
          returnNeutralSince = null
        }
        return result()
      }

      if (distance <= neutralThreshold) {
        candidate = null
        if (status === 'latched') status = 'armed'
        return result()
      }
      if (status === 'latched') return result()

      const projection = dot(subtract(vector, neutralVector), correctAxis)
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
