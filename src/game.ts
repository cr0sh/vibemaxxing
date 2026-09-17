export type Application = {
  name: string
  email: string
  pitch: string
}

export type Stage = 'ready' | 'applying' | 'offer' | 'hired' | 'lost'

export type TaskStatus = 'assigned' | 'working' | 'approval' | 'blocked' | 'artifact'

export type TerminalId = 'terminal' | 'terminal-2'

export type TerminalUpgrade = 'split' | 'yolo' | 'terminal'

export const TOKEN_PACK_COUNTS = [1, 5, 10] as const
export type TokenPackCount = (typeof TOKEN_PACK_COUNTS)[number]

export type TerminalState = {
  id: TerminalId
  slots: number
  yolo: boolean
}

export type TaskDescriptor = {
  id: number
  title: string
  description: string
  difficulty: number
  artifactName: string
}

export type WorkTask = TaskDescriptor & {
  deadlineAt: number
  startedAt: number | null
  status: TaskStatus
  progress: number
  nextApprovalAt: number
  terminalId: TerminalId | null
  slot: number | null
  approvalPrompt: string | null
}
export type EmploymentTaskSnapshot = Pick<
  WorkTask,
  'id' | 'title' | 'description' | 'difficulty' | 'artifactName' | 'deadlineAt' | 'startedAt' | 'status' | 'progress'
>

export type EmploymentMessage =
  | { id: string; type: 'welcome'; elapsed: number }
  | { id: string; type: 'assignment'; elapsed: number; task: EmploymentTaskSnapshot }
  | { id: string; type: 'artifact'; elapsed: number; task: EmploymentTaskSnapshot }
  | {
      id: string
      type: 'delivery'
      elapsed: number
      task: EmploymentTaskSnapshot
      reward: number
      completedTasks: number
    }
  | { id: string; type: 'ping'; elapsed: number; deadlineAt: number; acknowledged: boolean }
  | { id: string; type: 'firing'; elapsed: number; failure: string }


export type GameState = {
  stage: Stage
  submissions: number
  company: string | null
  lastResult: 'rejected' | null
  energy: number
  tokens: number
  money: number
  elapsed: number
  tasks: WorkTask[]
  taskQueue: TaskDescriptor[]
  terminals: TerminalState[]
  completedTasks: number
  nextTaskId: number
  nextTaskAt: number
  nextPingAt: number
  pingDeadline: number | null
  welcomeReacted: boolean
  messages: EmploymentMessage[]
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
  | { type: 'start-task'; id: number; terminalId: TerminalId; slot: number }
  | { type: 'approve-task'; id: number; approved: boolean }
  | { type: 'deliver-task'; id: number }
  | { type: 'buy-tokens'; packs: TokenPackCount }
  | { type: 'buy-upgrade'; upgrade: TerminalUpgrade; terminalId: TerminalId }

export const companies: readonly string[] = [
  'Prompt & Circumstance',
  'Ship It Labs',
  'The Merge Conflict',
  'Copilot & Chill',
  'Definitely Not a Startup',
]

const MAX_ENERGY = 100
export const MAX_TOKENS = 10_000_000
const TOKEN_TASK_COST = 100_000
export const TOKEN_PURCHASE_AMOUNT = 100_000
export const TOKEN_PURCHASE_COST = 100
const MAX_TASK_DIFFICULTY = 12
const TASK_REWARD_PER_DIFFICULTY = 5
const BASELINE_TASK_CYCLE_SECONDS = 18
const AVERAGE_TASK_DIFFICULTY = 9
const BOSS_BUDGET_ANCHOR = 620
const MIN_ASSIGNMENT_INTERVAL = 2
const MIN_EXPECTATION = 0.05
const MAX_EXPECTATION = 1
const UINT_RANGE = 4_294_967_296
const MAX_TERMINAL_SLOTS = 4
const MAX_TERMINALS = 2
const TASK_QUEUE_SIZE = 3
const SPLIT_PRICES: readonly number[] = [200, 400, 1_000]
const YOLO_PRICE = 420
const SECONDARY_PRICE_MULTIPLIER = 2
const ADDITIONAL_TERMINAL_PRICE = 1_000

export function taskTokenCost(task: Pick<WorkTask, 'difficulty'>): number {
  return TOKEN_TASK_COST * task.difficulty
}

export function taskReward(task: Pick<WorkTask, 'difficulty'>): number {
  return TASK_REWARD_PER_DIFFICULTY * task.difficulty
}

export function tokenPurchaseAmount(tokens: number, packs: TokenPackCount): number {
  return Math.max(0, Math.min(TOKEN_PURCHASE_AMOUNT * packs, MAX_TOKENS - tokens))
}

export function tokenPurchaseCost(amount: number): number {
  return Math.ceil(amount * TOKEN_PURCHASE_COST * 100 / TOKEN_PURCHASE_AMOUNT) / 100
}

const taskBlueprints: readonly Pick<TaskDescriptor, 'title' | 'description' | 'artifactName'>[] = [
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

const APPROVAL_PROMPTS: readonly string[] = [
  'Apply the generated patch?',
  'Run the test suite?',
  'Execute the build?',
  'Update the lockfile?',
  'Run the migration?',
  'Remove unused files?',
  'Retry the failed command?',
  'Run the formatter?',
  'Update the configuration?',
  'Commit the changes?',
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

function drawApprovalCheckpoint(rng: number): readonly [number, number, string] {
  const [delayRng, approvalDelay] = drawInteger(rng, 1, 5)
  const [nextRng, promptIndex] = drawInteger(delayRng, 0, APPROVAL_PROMPTS.length - 1)
  return [nextRng, approvalDelay, APPROVAL_PROMPTS[promptIndex] ?? APPROVAL_PROMPTS[0] ?? '']
}


function projectedGrossAt(elapsed: number): number {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  const averageTaskReward = TASK_REWARD_PER_DIFFICULTY * AVERAGE_TASK_DIFFICULTY
  return safeElapsed * (1 + averageTaskReward / BASELINE_TASK_CYCLE_SECONDS)
}

function bossExpectationAt(elapsed: number): number {
  const ratio = projectedGrossAt(elapsed) / BOSS_BUDGET_ANCHOR
  return clamp(0.2 + 0.8 * ratio / (1 + ratio), MIN_EXPECTATION, MAX_EXPECTATION)
}

function assignmentIntervalAt(elapsed: number): number {
  const ratio = projectedGrossAt(elapsed) / BOSS_BUDGET_ANCHOR
  return Math.max(MIN_ASSIGNMENT_INTERVAL, Math.ceil(BASELINE_TASK_CYCLE_SECONDS / (1 + ratio)))
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function deadlineFor(difficulty: number, expectation: number, elapsed: number): number {
  const safeExpectation = Math.max(MIN_EXPECTATION, Number.isFinite(expectation) ? expectation : 0.2)
  return elapsed + (1.5 * difficulty) / safeExpectation
}

function createDescriptor(state: Pick<GameState, 'rng' | 'nextTaskId'>): readonly [TaskDescriptor, number, number] {
  const [blueprintRng, blueprintIndex] = drawInteger(state.rng, 0, taskBlueprints.length - 1)
  const [nextRng, difficulty] = drawInteger(blueprintRng, 6, MAX_TASK_DIFFICULTY)
  const blueprint = taskBlueprints[blueprintIndex] ?? taskBlueprints[0]
  return [
    {
      id: state.nextTaskId,
      title: blueprint.title,
      description: blueprint.description,
      difficulty,
      artifactName: blueprint.artifactName,
    },
    nextRng,
    state.nextTaskId + 1,
  ]
}

function refillTaskQueue(state: GameState): GameState {
  let current = state
  while (current.taskQueue.length < TASK_QUEUE_SIZE) {
    const [descriptor, rng, nextTaskId] = createDescriptor(current)
    current = {
      ...current,
      taskQueue: [...current.taskQueue, descriptor],
      rng,
      nextTaskId,
    }
  }
  return current
}
function snapshotTask(task: WorkTask): EmploymentTaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    difficulty: task.difficulty,
    artifactName: task.artifactName,
    deadlineAt: task.deadlineAt,
    startedAt: task.startedAt,
    status: task.status,
    progress: task.progress,
  }
}

function appendMessage(state: GameState, message: EmploymentMessage): GameState {
  if (state.messages.some((candidate) => candidate.id === message.id)) {
    return state
  }
  return { ...state, messages: [...state.messages, message] }
}


const PRIMARY_TERMINAL: TerminalState = { id: 'terminal', slots: 1, yolo: false }


function reservedAssignmentTokens(tasks: readonly WorkTask[]): number {
  return tasks.reduce(
    (total, task) => total + (task.status === 'assigned' ? taskTokenCost(task) : 0),
    0,
  )
}

function issueAvailableAssignments(state: GameState): GameState {
  if (state.stage !== 'hired' || (state.nextTaskAt > 0 && state.elapsed < state.nextTaskAt)) {
    return state
  }

  const current = refillTaskQueue(state)
  const descriptor = current.taskQueue[0]
  if (descriptor === undefined) {
    return current
  }

  const reserved = reservedAssignmentTokens(current.tasks)
  const cost = taskTokenCost(descriptor)
  if (!Number.isFinite(cost) || current.tokens < reserved + cost) {
    return current
  }

  const task: WorkTask = {
    ...descriptor,
    deadlineAt: deadlineFor(descriptor.difficulty, bossExpectationAt(current.elapsed), current.elapsed),
    startedAt: null,
    status: 'assigned',
    progress: 0,
    nextApprovalAt: 0,
    terminalId: null,
    slot: null,
    approvalPrompt: null,
  }
  return appendMessage({
    ...current,
    tasks: [...current.tasks, task],
    taskQueue: current.taskQueue.slice(1),
    nextTaskAt: current.elapsed + assignmentIntervalAt(current.elapsed),
  }, {
    id: `assignment-${task.id}`,
    type: 'assignment',
    elapsed: current.elapsed,
    task: snapshotTask(task),
  })
}

function createHiredState(state: GameState): GameState {
  const hired: GameState = {
    ...state,
    stage: 'hired',
    energy: MAX_ENERGY,
    tasks: [],
    taskQueue: [],
    terminals: [{ ...PRIMARY_TERMINAL }],
    completedTasks: state.completedTasks,
    nextTaskId: Math.max(state.nextTaskId, state.completedTasks + 1),
    nextTaskAt: 0,
    nextPingAt: state.elapsed,
    pingDeadline: null,
    welcomeReacted: false,
    messages: [],
    failure: null,
    expectation: bossExpectationAt(state.elapsed),
  }
  const welcomed = appendMessage(hired, {
    id: 'welcome',
    type: 'welcome',
    elapsed: hired.elapsed,
  })
  const withQueue = refillTaskQueue(welcomed)
  const [nextRng, pingDelay] = drawInteger(withQueue.rng, 90, 150)
  return issueAvailableAssignments({
    ...withQueue,
    nextPingAt: withQueue.elapsed + pingDelay,
    rng: nextRng,
  })
}

function lose(state: GameState, failure: string): GameState {
  const lost = {
    ...state,
    stage: 'lost' as const,
    failure,
  }
  return appendMessage(lost, {
    id: 'firing',
    type: 'firing',
    elapsed: state.elapsed,
    failure,
  })
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
  tasks: [],
  taskQueue: [],
  terminals: [{ ...PRIMARY_TERMINAL }],
  completedTasks: 0,
  nextTaskId: 1,
  nextTaskAt: 0,
  nextPingAt: 0,
  pingDeadline: null,
  welcomeReacted: false,
  messages: [],
  failure: null,
  expectation: 0.2,
  rng: 1,
}

function getTerminal(state: GameState, terminalId: TerminalId): TerminalState | undefined {
  return state.terminals.find((terminal) => terminal.id === terminalId)
}

function isTerminalId(value: string): value is TerminalId {
  return value === 'terminal' || value === 'terminal-2'
}

function advanceTask(task: WorkTask, elapsed: number, terminals: readonly TerminalState[]): WorkTask {
  if (task.status !== 'working') {
    return task
  }

  const progress = Math.min(task.difficulty, task.progress + 1)
  if (progress >= task.difficulty) {
    return { ...task, progress, status: 'artifact', nextApprovalAt: 0, approvalPrompt: null }
  }

  const yolo = task.terminalId !== null && terminals.some(
    (terminal) => terminal.id === task.terminalId && terminal.yolo,
  )
  if (yolo) {
    return { ...task, progress, nextApprovalAt: 0 }
  }

  return elapsed >= task.nextApprovalAt
    ? { ...task, progress, status: 'approval' }
    : { ...task, progress }
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
      tokens: (current.elapsed + 1) % 100 === 0 ? MAX_TOKENS : current.tokens,
      expectation: bossExpectationAt(current.elapsed + 1),
    }

    if (current.tasks.some((task) => current.elapsed >= task.deadlineAt)) {
      return lose(current, 'The task deadline was missed.')
    }

    if (current.pingDeadline !== null && current.elapsed >= current.pingDeadline) {
      return lose(current, 'The boss ping went unanswered.')
    }

    const previousTasks = current.tasks
    const advancedTasks = previousTasks.map((task) => advanceTask(task, current.elapsed, current.terminals))
    current = { ...current, tasks: advancedTasks }
    for (let index = 0; index < advancedTasks.length; index += 1) {
      const before = previousTasks[index]
      const after = advancedTasks[index]
      if (before?.status !== 'artifact' && after?.status === 'artifact') {
        current = appendMessage(current, {
          id: `artifact-${after.id}`,
          type: 'artifact',
          elapsed: current.elapsed,
          task: snapshotTask(after),
        })
      }
    }

    current = issueAvailableAssignments(current)

    if (current.pingDeadline === null && current.nextPingAt > 0 && current.elapsed >= current.nextPingAt) {
      const [nextRng, pingDelay] = drawInteger(current.rng, 90, 150)
      const pingDeadline = current.elapsed + 30
      current = appendMessage({
        ...current,
        pingDeadline,
        nextPingAt: current.elapsed + pingDelay,
        rng: nextRng,
      }, {
        id: `ping-${pingDeadline}`,
        type: 'ping',
        elapsed: current.elapsed,
        deadlineAt: pingDeadline,
        acknowledged: false,
      })
    }
  }

  return current
}

export function upgradePrice(
  state: GameState,
  upgrade: TerminalUpgrade,
  terminalId: TerminalId,
): number | null {
  if (
    state.stage !== 'hired' ||
    !isTerminalId(terminalId) ||
    (upgrade !== 'split' && upgrade !== 'yolo' && upgrade !== 'terminal')
  ) {
    return null
  }

  if (upgrade === 'terminal') {
    return terminalId === 'terminal' &&
      state.terminals.length < MAX_TERMINALS &&
      getTerminal(state, 'terminal-2') === undefined
      ? ADDITIONAL_TERMINAL_PRICE
      : null
  }

  const terminal = getTerminal(state, terminalId)
  if (terminal === undefined) {
    return null
  }

  if (upgrade === 'yolo') {
    return terminal.yolo ? null : YOLO_PRICE
  }

  if (terminal.slots < 1 || terminal.slots >= MAX_TERMINAL_SLOTS) {
    return null
  }

  const basePrice = SPLIT_PRICES[terminal.slots - 1]
  return basePrice === undefined
    ? null
    : terminalId === 'terminal-2'
      ? basePrice * SECONDARY_PRICE_MULTIPLIER
      : basePrice
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

      const attempt = state.submissions + 1
      const chance =
        attempt >= 20
          ? 1
          : Math.min(1, 0.02 * 2 ** Math.max(0, attempt - 9))
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
          tasks: [],
          taskQueue: [],
          terminals: [{ ...PRIMARY_TERMINAL }],
          nextTaskAt: 0,
          nextPingAt: 0,
          pingDeadline: null,
          welcomeReacted: false,
          messages: [],
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
          tasks: [],
          taskQueue: [],
          terminals: [{ ...PRIMARY_TERMINAL }],
          pingDeadline: null,
          messages: [],
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

      const failure = 'The run ended in the developer preview.'
      return appendMessage({
        ...state,
        stage: 'lost',
        company:
          state.company !== null && companies.includes(state.company)
            ? state.company
            : companies[0] ?? null,
        failure,
        pingDeadline: null,
      }, {
        id: 'firing',
        type: 'firing',
        elapsed: state.elapsed,
        failure,
      })
    }

    case 'tick':
      return tickHired(state, action.seconds)

    case 'welcome-react':
      return state.stage === 'hired'
        ? { ...state, welcomeReacted: !state.welcomeReacted }
        : state

    case 'acknowledge-ping': {
      if (
        state.stage !== 'hired' ||
        state.pingDeadline === null ||
        state.elapsed > state.pingDeadline
      ) {
        return state
      }

      const pingDeadline = state.pingDeadline
      return {
        ...state,
        pingDeadline: null,
        messages: state.messages.map((message) => (
          message.type === 'ping' && message.deadlineAt === pingDeadline
            ? { ...message, acknowledged: true }
            : message
        )),
      }
    }


    case 'start-task': {
      if (
        state.stage !== 'hired' ||
        !isTerminalId(action.terminalId) ||
        !Number.isInteger(action.slot) ||
        action.slot < 0
      ) {
        return state
      }

      const terminal = getTerminal(state, action.terminalId)
      const taskIndex = state.tasks.findIndex((task) => task.id === action.id)
      const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined
      if (
        terminal === undefined ||
        action.slot >= terminal.slots ||
        task === undefined ||
        task.status !== 'assigned' ||
        task.terminalId !== null ||
        task.slot !== null ||
        state.tasks.some((candidate) => candidate.terminalId === action.terminalId && candidate.slot === action.slot && candidate.status !== 'assigned')
      ) {
        return state
      }

      const cost = taskTokenCost(task)
      if (!Number.isFinite(cost) || cost < 0 || state.tokens < cost) {
        return state
      }

      const yolo = terminal.yolo
      let nextRng = state.rng
      let nextApprovalAt = 0
      let nextApprovalPrompt: string | null = null
      if (!yolo) {
        const drawn = drawApprovalCheckpoint(state.rng)
        nextRng = drawn[0]
        nextApprovalAt = state.elapsed + drawn[1]
        nextApprovalPrompt = drawn[2]
      }

      return {
        ...state,
        tokens: state.tokens - cost,
        tasks: state.tasks.map((candidate, index) => index === taskIndex
          ? {
              ...candidate,
              terminalId: action.terminalId,
              slot: action.slot,
              startedAt: state.elapsed,
              status: 'working',
              nextApprovalAt,
              approvalPrompt: nextApprovalPrompt,
            }
          : candidate),
        rng: nextRng,
      }
    }

    case 'approve-task': {
      if (
        state.stage !== 'hired' ||
        typeof action.approved !== 'boolean'
      ) {
        return state
      }

      const taskIndex = state.tasks.findIndex((task) => task.id === action.id)
      const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined
      if (
        task === undefined ||
        (task.status !== 'approval' && task.status !== 'blocked')
      ) {
        return state
      }

      if (!action.approved) {
        return {
          ...state,
          tasks: state.tasks.map((candidate, index) => index === taskIndex
            ? { ...candidate, status: 'blocked' }
            : candidate),
        }
      }

      if (
        task.terminalId !== null &&
        state.terminals.some((terminal) => terminal.id === task.terminalId && terminal.yolo)
      ) {
        return {
          ...state,
          tasks: state.tasks.map((candidate, index) => index === taskIndex
            ? { ...candidate, status: 'working', nextApprovalAt: 0, approvalPrompt: null }
            : candidate),
        }
      }

      const [nextRng, approvalDelay, approvalPrompt] = drawApprovalCheckpoint(state.rng)
      return {
        ...state,
        tasks: state.tasks.map((candidate, index) => index === taskIndex
          ? {
              ...candidate,
              status: 'working',
              nextApprovalAt: state.elapsed + approvalDelay,
              approvalPrompt,
            }
          : candidate),
        rng: nextRng,
      }
    }

    case 'deliver-task': {
      if (state.stage !== 'hired') {
        return state
      }

      const task = state.tasks.find((candidate) => candidate.id === action.id)
      if (task === undefined || task.status !== 'artifact') {
        return state
      }

      const reward = taskReward(task)
      const completedTasks = state.completedTasks + 1
      const remainingTasks = state.tasks.filter((candidate) => candidate.id !== action.id)
      const nextTaskAt = remainingTasks.length === 0
        ? Math.min(state.nextTaskAt, state.elapsed + 5)
        : state.nextTaskAt

      return appendMessage({
        ...state,
        tasks: remainingTasks,
        completedTasks,
        money: state.money + reward,
        nextTaskAt,
        expectation: bossExpectationAt(state.elapsed),
      }, {
        id: `delivery-${task.id}`,
        type: 'delivery',
        elapsed: state.elapsed,
        task: snapshotTask(task),
        reward,
        completedTasks,
      })
    }

    case 'buy-tokens': {
      if (!TOKEN_PACK_COUNTS.includes(action.packs)) return state
      const amount = tokenPurchaseAmount(state.tokens, action.packs)
      const cost = tokenPurchaseCost(amount)
      if (state.stage !== 'hired' || state.money < cost || amount === 0) {
        return state
      }

      return issueAvailableAssignments({
        ...state,
        money: Math.round((state.money - cost) * 100) / 100,
        tokens: state.tokens + amount,
      })
    }

    case 'buy-upgrade': {
      const price = upgradePrice(state, action.upgrade, action.terminalId)
      if (price === null || state.money < price) {
        return state
      }

      if (action.upgrade === 'terminal') {
        return {
          ...state,
          money: state.money - price,
          terminals: [...state.terminals, { id: 'terminal-2', slots: 1, yolo: false }],
        }
      }

      if (action.upgrade === 'split') {
        return {
          ...state,
          money: state.money - price,
          terminals: state.terminals.map((terminal) => terminal.id === action.terminalId
            ? { ...terminal, slots: Math.min(MAX_TERMINAL_SLOTS, terminal.slots + 1) }
            : terminal),
        }
      }

      return {
        ...state,
        money: state.money - price,
        terminals: state.terminals.map((terminal) => terminal.id === action.terminalId
          ? { ...terminal, yolo: true }
          : terminal),
        tasks: state.tasks.map((task) => task.terminalId === action.terminalId
          ? {
              ...task,
              status: task.status === 'approval' || task.status === 'blocked' ? 'working' : task.status,
              nextApprovalAt: 0,
              approvalPrompt: null,
            }
          : task),
      }
    }
  }
}
