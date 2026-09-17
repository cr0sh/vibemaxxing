export type SoundCue = 'click' | 'task-transfer' | 'artifact-transfer' | 'milestone'

type AudioContextConstructor = new () => AudioContext

type ActiveVoice = {
  oscillator: OscillatorNode
  gain: GainNode
  disposed: boolean
}

type VoiceSpec = {
  frequency: number
  startOffset: number
  duration: number
  volume: number
  type: OscillatorType
}

const MIN_GAIN = 0.0001
const ATTACK_SECONDS = 0.008
const RELEASE_SECONDS = 0.045
const MAX_ACTIVE_VOICES = 12

// Keep the individual voices quiet: the game can layer a transfer motif over a
// click without making either interaction feel harsh.
const CLICK_VOICES: readonly VoiceSpec[] = [
  { frequency: 620, startOffset: 0, duration: 0.07, volume: 0.035, type: 'sine' },
]

const TASK_TRANSFER_VOICES: readonly VoiceSpec[] = [
  { frequency: 440, startOffset: 0, duration: 0.16, volume: 0.04, type: 'triangle' },
  { frequency: 660, startOffset: 0.065, duration: 0.17, volume: 0.038, type: 'triangle' },
  { frequency: 880, startOffset: 0.13, duration: 0.2, volume: 0.034, type: 'sine' },
]

const ARTIFACT_TRANSFER_VOICES: readonly VoiceSpec[] = [
  { frequency: 784, startOffset: 0, duration: 0.16, volume: 0.035, type: 'sine' },
  { frequency: 988, startOffset: 0.06, duration: 0.18, volume: 0.035, type: 'sine' },
  { frequency: 1318.5, startOffset: 0.12, duration: 0.24, volume: 0.03, type: 'triangle' },
]

// A compact, major-key tada that can be reused for later milestone states.
const MILESTONE_VOICES: readonly VoiceSpec[] = [
  { frequency: 523.25, startOffset: 0, duration: 0.25, volume: 0.032, type: 'triangle' },
  { frequency: 659.25, startOffset: 0.035, duration: 0.27, volume: 0.03, type: 'triangle' },
  { frequency: 783.99, startOffset: 0.07, duration: 0.3, volume: 0.028, type: 'triangle' },
  { frequency: 1046.5, startOffset: 0.15, duration: 0.42, volume: 0.035, type: 'sine' },
  { frequency: 1318.5, startOffset: 0.18, duration: 0.34, volume: 0.019, type: 'sine' },
]

let audioContext: AudioContext | null = null
let audioUnavailable = false
const activeVoices = new Set<ActiveVoice>()

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null

  try {
    const browserWindow = window as Window & {
      AudioContext?: AudioContextConstructor
      webkitAudioContext?: AudioContextConstructor
    }
    return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null
  } catch {
    return null
  }
}

function getAudioContext(): AudioContext | null {
  if (audioContext || audioUnavailable) return audioContext

  const AudioContextClass = getAudioContextConstructor()
  if (!AudioContextClass) {
    audioUnavailable = true
    return null
  }

  try {
    audioContext = new AudioContextClass()
  } catch {
    // Audio is optional. A browser policy, private mode, or an older browser
    // should never turn an otherwise valid interaction into an exception.
    audioUnavailable = true
  }
  return audioContext
}

function resumeAudioContext(context: AudioContext): void {
  if (context.state === 'running' || context.state === 'closed') return

  try {
    // Calling resume in the event handler (rather than awaiting it first) is
    // important for browsers that require the user-activation stack.
    const pendingResume = context.resume()
    void pendingResume.catch(() => undefined)
  } catch {
    // A rejected resume is recoverable on a later user gesture.
  }
}

// Kept separate from playSound so state transitions cannot construct an
// AudioContext until useInteractionSounds has observed a real user gesture.
export function unlockAudio(): void {
  try {
    const context = getAudioContext()
    if (!context || context.state === 'closed') return
    resumeAudioContext(context)
  } catch {
    // Audio setup must never block the user gesture that requested it.
  }
}

function disposeVoice(voice: ActiveVoice): void {
  if (voice.disposed) return
  voice.disposed = true
  activeVoices.delete(voice)

  try {
    voice.oscillator.stop()
  } catch {
    // The oscillator may already have reached its scheduled stop time.
  }
  try {
    voice.oscillator.disconnect()
  } catch {
    // Disconnecting an already-disconnected node is harmless but not uniform
    // across older Web Audio implementations.
  }
  try {
    voice.gain.disconnect()
  } catch {
    // See the oscillator disconnect note above.
  }
}

function makeVoice(context: AudioContext, spec: VoiceSpec, now: number): void {

  const startAt = now + spec.startOffset
  const stopAt = startAt + spec.duration
  const releaseAt = Math.max(startAt + ATTACK_SECONDS, stopAt - RELEASE_SECONDS)

  let oscillator: OscillatorNode | null = null
  let gain: GainNode | null = null
  let voice: ActiveVoice | null = null

  try {
    oscillator = context.createOscillator()
    gain = context.createGain()
    oscillator.type = spec.type
    oscillator.frequency.setValueAtTime(spec.frequency, startAt)

    gain.gain.setValueAtTime(MIN_GAIN, startAt)
    gain.gain.linearRampToValueAtTime(spec.volume, startAt + ATTACK_SECONDS)
    gain.gain.setValueAtTime(spec.volume, releaseAt)
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, stopAt)

    oscillator.connect(gain)
    gain.connect(context.destination)

    voice = { oscillator, gain, disposed: false }
    activeVoices.add(voice)
    oscillator.onended = () => {
      if (voice) disposeVoice(voice)
    }
    oscillator.start(startAt)
    oscillator.stop(stopAt)
  } catch {
    if (voice) {
      disposeVoice(voice)
    } else {
      try {
        oscillator?.disconnect()
      } catch {
        // Best-effort cleanup after an unavailable Web Audio node.
      }
      try {
        gain?.disconnect()
      } catch {
        // Best-effort cleanup after an unavailable Web Audio node.
      }
    }
  }
}

function voicesForCue(cue: SoundCue): readonly VoiceSpec[] {
  switch (cue) {
    case 'click':
      return CLICK_VOICES
    case 'task-transfer':
      return TASK_TRANSFER_VOICES
    case 'artifact-transfer':
      return ARTIFACT_TRANSFER_VOICES
    case 'milestone':
      return MILESTONE_VOICES
  }
}

export function playSound(cue: SoundCue): void {
  try {
    const context = audioContext
    if (!context || context.state === 'closed') return

    resumeAudioContext(context)
    const voices = voicesForCue(cue)
    if (activeVoices.size + voices.length > MAX_ACTIVE_VOICES) return
    const now = context.currentTime
    for (const spec of voices) makeVoice(context, spec, now)
  } catch {
    // Audio is strictly best-effort. In particular, partially implemented Web
    // Audio shims must not break a game action.
  }
}
