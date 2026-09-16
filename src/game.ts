export type Application = {
  name: string
  email: string
  pitch: string
}

export type Stage = 'ready' | 'applying' | 'offer' | 'hired' | 'lost'

type TaskStatus = 'assigned' | 'working' | 'approval' | 'blocked' | 'artifact'

export type WorkTask = {
  id: number
  title: string
  description: string
  difficulty: number
  deadlineAt: number
  startedAt: number | null
  status: TaskStatus
  progress: number
  nextApprovalAt: number
  artifactName: string
}

export type GameState = {
  stage: Stage
  submissions: number
  company: string | null
  lastResult: 'rejected' | null
  energy: number
  tokens: number
  money: number
  elapsed: number
  task: WorkTask | null
  completedTasks: number
  nextTaskAt: number
  nextPingAt: number
  pingDeadline: number | null
  welcomeReacted: boolean
  lastDelivery: string | null
  failure: string | null
  expectation: number
  rng: number
}

export type GameAction =
  | { type: 'start'; seed: number }
  | { type: 'submit'; roll: number; companyIndex: number }
  | { type: 'accept' }
  | { type: 'reset' }
  | { type: 'dev-jump'; stage: Stage }
  | { type: 'tick'; seconds: number }
  | { type: 'welcome-react' }
  | { type: 'acknowledge-ping' }
  | { type: 'start-task'; id: number }
  | { type: 'approve-task'; id: number; approved: boolean }
  | { type: 'deliver-task'; id: number }
  | { type: 'buy-tokens' }

export const companies: readonly string[] = [
  'Prompt & Circumstance',
  'Ship It Labs',
  'The Merge Conflict',
  'Copilot & Chill',
  'Definitely Not a Startup',
]

const MAX_ENERGY = 100
const MAX_TOKENS = 1_000_000
const TOKEN_TASK_COST = 10_000
const TOKEN_PURCHASE_AMOUNT = 100_000
const TOKEN_PURCHASE_COST = 10
const TASK_INTERVAL = 120
const MIN_EXPECTATION = 0.05
const MAX_EXPECTATION = 1
const UINT_RANGE = 4_294_967_296

const taskBlueprints: readonly Pick<WorkTask, 'title' | 'description' | 'artifactName'>[] = [
  {
    title: 'Tame the onboarding flow',
    description: 'Make the first-run checklist feel calm, clear, and impossible to miss.',
    artifactName: 'onboarding-checklist.patch',
  },
  {
    title: 'Patch the midnight timeout',
    description: 'Trace the flaky timeout and make the retry path safe for sleepy users.',
    artifactName: 'timeout-fix.diff',
  },
  {
    title: 'Polish the activity feed',
    description: 'Turn noisy event records into a useful stream with readable timestamps.',
    artifactName: 'activity-feed-preview.png',
  },
  {
    title: 'Document the quiet endpoint',
    description: 'Give the team a short, accurate guide for the endpoint nobody remembers.',
    artifactName: 'endpoint-notes.md',
  },
  {
    title: 'Harden the import job',
    description: 'Handle malformed rows without losing the rest of a customer import.',
    artifactName: 'import-guard.test.ts',
  },
  {
    title: 'Tune the search signal',
    description: 'Make the most useful matches rise to the top without hiding exact hits.',
    artifactName: 'search-ranking.json',
  },
  {
    title: 'Rescue the empty state',
    description: 'Write a friendly next step for the screen that currently says nothing.',
    artifactName: 'empty-state-copy.txt',
  },
  {
    title: 'Compress the release notes',
    description: 'Shape the scattered changes into a release note people will actually read.',
    artifactName: 'release-notes.md',
  },
]

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return 1
  }

  return Math.trunc(seed) >>> 0
}

function nextRandom(rng: number): readonly [number, number] {
  let value = (normalizeSeed(rng) + 0x6d2b79f5) >>> 0
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  const next = (value ^ (value >>> 14)) >>> 0
  return [next, next / UINT_RANGE]
}

function drawInteger(rng: number, minimum: number, maximum: number): readonly [number, number] {
  const [next, unit] = nextRandom(rng)
  return [next, minimum + Math.floor(unit * (maximum - minimum + 1))]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function deadlineFor(difficulty: number, expectation: number, elapsed: number): number {
  const safeExpectation = Math.max(MIN_EXPECTATION, Number.isFinite(expectation) ? expectation : 0.2)
  return elapsed + (1.5 * difficulty) / safeExpectation
}

function createTask(
  state: GameState,
  elapsed: number,
): readonly [WorkTask, number] {
  const [blueprintRng, blueprintIndex] = drawInteger(state.rng, 0, taskBlueprints.length - 1)
  const [nextRng, difficulty] = drawInteger(blueprintRng, 6, 12)
  const blueprint = taskBlueprints[blueprintIndex] ?? taskBlueprints[0]

  return [
    {
      id: state.completedTasks + 1,
      title: blueprint.title,
      description: blueprint.description,
      difficulty,
      deadlineAt: deadlineFor(difficulty, state.expectation, elapsed),
      startedAt: null,
      status: 'assigned',
      progress: 0,
      nextApprovalAt: 0,
      artifactName: blueprint.artifactName,
    },
    nextRng,
  ]
}

function createHiredState(state: GameState): GameState {
  const expectation = clamp(state.expectation, MIN_EXPECTATION, MAX_EXPECTATION)
  const [task, taskRng] = createTask({ ...state, task: null, expectation }, state.elapsed)
  const [nextRng, pingDelay] = drawInteger(taskRng, 90, 150)

  return {
    ...state,
    stage: 'hired',
    energy: MAX_ENERGY,
    task,
    nextTaskAt: state.elapsed + TASK_INTERVAL,
    nextPingAt: state.elapsed + pingDelay,
    pingDeadline: null,
    welcomeReacted: false,
    lastDelivery: null,
    failure: null,
    expectation: clamp(state.expectation, MIN_EXPECTATION, MAX_EXPECTATION),
    rng: nextRng,
  }
}

function lose(state: GameState, failure: string): GameState {
  return {
    ...state,
    stage: 'lost',
    pingDeadline: null,
    failure,
  }
}

export const initialGame: GameState = {
  stage: 'ready',
  submissions: 0,
  company: null,
  lastResult: null,
  energy: MAX_ENERGY,
  tokens: MAX_TOKENS,
  money: 0,
  elapsed: 0,
  task: null,
  completedTasks: 0,
  nextTaskAt: 0,
  nextPingAt: 0,
  pingDeadline: null,
  welcomeReacted: false,
  lastDelivery: null,
  failure: null,
  expectation: 0.2,
  rng: 1,
}

function tickHired(state: GameState, seconds: number): GameState {
  const wholeSeconds = Math.floor(seconds)
  if (state.stage !== 'hired' || !Number.isFinite(seconds) || wholeSeconds <= 0) {
    return state
  }

  let current = state

  for (let second = 0; second < wholeSeconds; second += 1) {
    current = {
      ...current,
      elapsed: current.elapsed + 1,
      money: current.money + 1,
      tokens: current.elapsed % 100 === 0 ? MAX_TOKENS : current.tokens,
    }

    if (current.task !== null && current.elapsed >= current.task.deadlineAt) {
      return lose(current, 'The task deadline was missed.')
    }

    if (current.pingDeadline !== null && current.elapsed >= current.pingDeadline) {
      return lose(current, 'The boss ping went unanswered.')
    }

    if (current.task?.status === 'working') {
      const progress = Math.min(current.task.difficulty, current.task.progress + 1)
      const task =
        progress >= current.task.difficulty
          ? { ...current.task, progress, status: 'artifact' as const, nextApprovalAt: 0 }
          : current.elapsed >= current.task.nextApprovalAt
            ? { ...current.task, progress, status: 'approval' as const }
            : { ...current.task, progress }
      current = { ...current, task }
    }

    if (current.task === null && current.nextTaskAt > 0 && current.elapsed >= current.nextTaskAt) {
      const [task, nextRng] = createTask(current, current.elapsed)
      current = {
        ...current,
        task,
        nextTaskAt: current.nextTaskAt + TASK_INTERVAL,
        rng: nextRng,
      }
    }

    if (current.pingDeadline === null && current.nextPingAt > 0 && current.elapsed >= current.nextPingAt) {
      const [nextRng, pingDelay] = drawInteger(current.rng, 90, 150)
      current = {
        ...current,
        pingDeadline: current.elapsed + 30,
        nextPingAt: current.elapsed + pingDelay,
        rng: nextRng,
      }
    }
  }

  return current
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start': {
      if (state.stage !== 'ready') {
        return state
      }

      return {
        ...initialGame,
        stage: 'applying',
        rng: normalizeSeed(action.seed),
      }
    }

    case 'submit': {
      if (state.stage !== 'applying' || state.energy < 3) {
        return state
      }

      const company =
        Number.isInteger(action.companyIndex) &&
        action.companyIndex >= 0 &&
        action.companyIndex < companies.length
          ? companies[action.companyIndex] ?? null
          : null
      if (company === null) {
        return state
      }

      const chance = Math.min(1, 0.01 * 2 ** Math.max(0, state.submissions - 24))
      const offered = Number.isFinite(action.roll) && action.roll < chance

      return {
        ...state,
        stage: offered ? 'offer' : 'applying',
        submissions: state.submissions + 1,
        company: offered ? company : null,
        lastResult: offered ? null : 'rejected',
        energy: state.energy - 3,
      }
    }

    case 'accept':
      return state.stage === 'offer' && state.company !== null
        ? createHiredState(state)
        : state

    case 'reset':
      return initialGame

    case 'dev-jump': {
      if (action.stage === 'ready') {
        return initialGame
      }

      if (action.stage === 'applying') {
        return {
          ...state,
          stage: 'applying',
          company: null,
          task: null,
          nextTaskAt: 0,
          nextPingAt: 0,
          pingDeadline: null,
          welcomeReacted: false,
          lastDelivery: null,
          failure: null,
        }
      }

      if (action.stage === 'offer') {
        return {
          ...state,
          stage: 'offer',
          company:
            state.company !== null && companies.includes(state.company)
              ? state.company
              : companies[0] ?? null,
          task: null,
          pingDeadline: null,
          failure: null,
        }
      }

      if (action.stage === 'hired') {
        return createHiredState({
          ...state,
          company:
            state.company !== null && companies.includes(state.company)
              ? state.company
              : companies[0] ?? null,
        })
      }

      return {
        ...state,
        stage: 'lost',
        company:
          state.company !== null && companies.includes(state.company)
            ? state.company
            : companies[0] ?? null,
        failure: 'The run ended in the developer preview.',
        pingDeadline: null,
      }
    }

    case 'tick':
      return tickHired(state, action.seconds)

    case 'welcome-react':
      return state.stage === 'hired'
        ? { ...state, welcomeReacted: !state.welcomeReacted }
        : state

    case 'acknowledge-ping':
      return state.stage === 'hired' &&
        state.pingDeadline !== null &&
        state.elapsed <= state.pingDeadline
        ? { ...state, pingDeadline: null }
        : state

    case 'start-task': {
      if (
        state.stage !== 'hired' ||
        state.task === null ||
        state.task.id !== action.id ||
        state.task.status !== 'assigned'
      ) {
        return state
      }

      const cost = TOKEN_TASK_COST * state.task.difficulty
      if (state.tokens < cost) {
        return state
      }

      const [nextRng, approvalDelay] = drawInteger(state.rng, 1, 5)
      return {
        ...state,
        tokens: state.tokens - cost,
        task: {
          ...state.task,
          startedAt: state.elapsed,
          status: 'working',
          nextApprovalAt: state.elapsed + approvalDelay,
        },
        rng: nextRng,
      }
    }

    case 'approve-task': {
      if (
        state.stage !== 'hired' ||
        state.task === null ||
        state.task.id !== action.id ||
        (state.task.status !== 'approval' && state.task.status !== 'blocked') ||
        typeof action.approved !== 'boolean'
      ) {
        return state
      }

      if (!action.approved) {
        return { ...state, task: { ...state.task, status: 'blocked' } }
      }

      const [nextRng, approvalDelay] = drawInteger(state.rng, 1, 5)
      return {
        ...state,
        task: {
          ...state.task,
          status: 'working',
          nextApprovalAt: state.elapsed + approvalDelay,
        },
        rng: nextRng,
      }
    }

    case 'deliver-task': {
      if (
        state.stage !== 'hired' ||
        state.task === null ||
        state.task.id !== action.id ||
        state.task.status !== 'artifact'
      ) {
        return state
      }

      const duration = Math.max(1, state.elapsed - (state.task.startedAt ?? state.elapsed))
      const observedSpeed = clamp(state.task.difficulty / duration, MIN_EXPECTATION, MAX_EXPECTATION)
      const expectation = clamp(
        state.expectation * 0.8 + observedSpeed * 0.2,
        MIN_EXPECTATION,
        MAX_EXPECTATION,
      )

      return {
        ...state,
        task: null,
        completedTasks: state.completedTasks + 1,
        lastDelivery: state.task.artifactName,
        expectation,
      }
    }

    case 'buy-tokens': {
      if (
        state.stage !== 'hired' ||
        state.money < TOKEN_PURCHASE_COST ||
        state.tokens >= MAX_TOKENS
      ) {
        return state
      }

      return {
        ...state,
        money: state.money - TOKEN_PURCHASE_COST,
        tokens: Math.min(MAX_TOKENS, state.tokens + TOKEN_PURCHASE_AMOUNT),
      }
    }
  }
}
