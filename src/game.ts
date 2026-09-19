import {
  advanceMarket,
  createMarket,
  tradeMarket,
  transferMarket,
  type MarketState,
} from './trading'
import type { MessageKey, MessageReference } from './i18n/catalog'

export type Application = {
  name: string
  email: string
  pitch: string
}

export type Stage = 'ready' | 'applying' | 'offer' | 'hired' | 'lost' | 'won'
export type DevJumpTarget = Stage | 'tiro' | 'market' | 'spark' | 'mercury' | 'second-job' | 'frontier' | 'monopoly' | 'spark-ultra' | 'shorts' | 'energy-loss'
export type JobId = 'primary' | 'secondary'
export type TaskStatus = 'assigned' | 'working' | 'approval' | 'blocked' | 'artifact' | 'failed'
export type TerminalId = 'terminal' | 'terminal-2' | 'spark' | 'spark-ultra'
export type TerminalUpgrade = 'split' | 'yolo' | 'terminal'

export type ShopItemId = 'split' | 'yolo' | 'terminal' | 'fast-mode' | 'spark' | 'spark-ultra' | 'advanced-model' | 'mercury' | 'mercury-upgrade'
export const SHOP_ITEM_IDS: readonly ShopItemId[] = ['split', 'yolo', 'terminal', 'fast-mode', 'spark', 'spark-ultra', 'advanced-model', 'mercury', 'mercury-upgrade']

export const TOKEN_PACK_COUNTS = [1, 5, 10, 100] as const
export type TokenPackCount = (typeof TOKEN_PACK_COUNTS)[number]

export type AgentModelId = 'basic' | 'reasoning' | 'advanced' | 'frontier'
export const AGENT_MODELS: Record<AgentModelId, {
  label: string
  intelligence: number
  speed: number
  tokenMultiplier: number
}> = {
  basic: { label: 'Basic', intelligence: 1, speed: 1, tokenMultiplier: 1 },
  reasoning: { label: 'ConvexLM Reasoning', intelligence: 2, speed: 0.6, tokenMultiplier: 1 },
  advanced: { label: 'ConvexLM Pro', intelligence: 3, speed: 0.6, tokenMultiplier: 1 },
  frontier: { label: 'Tiro Max', intelligence: 4, speed: 0.6, tokenMultiplier: 2 },
}

export type TerminalState = {
  id: TerminalId
  slots: number
  yolo: boolean
  fastMode: boolean
  model: AgentModelId
}

export type EmploymentJob = {
  company: string
  level: 3 | 4 | 5
  completedTasks: number
  completedArchitectureTasks: number
  nextTaskAt: number
  expectation: number
  welcomeReacted: boolean
  startedAt: number
}
export type TaskDescriptor = {
  id: number
  jobId: JobId
  titleKey: MessageKey
  descriptionKey: MessageKey
  difficulty: number
  artifactName: string
  kind: 'standard' | 'architecture'
  complexity: number
}

export type WorkTask = TaskDescriptor & {
  deadlineAt: number
  startedAt: number | null
  assignedAt: number
  baseReward: number
  model: AgentModelId | null
  fastMode: boolean
  local: boolean
  /**
   * Mercury keeps this task's return fee reserved while its automatic attempt
   * is still in flight (including a completed artifact waiting to be returned).
   */
  mercuryAuto?: boolean
  /** Elapsed time at which the latest attempt failed, waiting for a retry. */
  failedAt: number | null
  attempt: number
  status: TaskStatus
  progress: number
  nextApprovalAt: number
  terminalId: TerminalId | null
  slot: number | null
  approvalPromptKey: MessageKey | null
}
export type EmploymentTaskSnapshot = Pick<WorkTask,
  | 'id' | 'jobId' | 'titleKey' | 'descriptionKey' | 'difficulty' | 'artifactName' | 'kind' | 'complexity'
  | 'deadlineAt' | 'startedAt' | 'assignedAt' | 'baseReward' | 'model' | 'fastMode' | 'local'
  | 'attempt' | 'status' | 'progress' | 'failedAt'
>


type JobMessage = { jobId: JobId }
export type EmploymentMessage =
  | ({ id: string; type: 'welcome'; elapsed: number } & JobMessage)
  | ({ id: string; type: 'assignment'; elapsed: number; task: EmploymentTaskSnapshot; artifact: EmploymentTaskSnapshot | null } & JobMessage)
  | ({ id: string; type: 'delivery'; elapsed: number; task: EmploymentTaskSnapshot; reward: number; completedTasks: number } & JobMessage)
  | ({ id: string; type: 'incentives'; elapsed: number } & JobMessage)
  | ({ id: string; type: 'promotion'; elapsed: number; level: 4 | 5 } & JobMessage)
  | ({ id: string; type: 'attempt-failed'; elapsed: number; task: EmploymentTaskSnapshot } & JobMessage)
  | ({ id: string; type: 'firing'; elapsed: number; failure: MessageReference } & JobMessage)

type SocialPostType = 'campaign' | 'lottery' | 'reset' | 'model' | 'fast-mode' | 'market' | 'spark' | 'spark-delivered' |
  'advanced-model' | 'mercury' | 'mercury-upgrade' | 'second-job' | 'frontier-model' | 'monopoly' | 'spark-ultra' | 'spark-ultra-delivered' | 'shorts'
type SocialPostBase = {
  id: string
  elapsed: number
  likes: number
}
export type SocialPost =
  | (SocialPostBase & { type: 'lottery'; lotteryVariant: number })
  | (SocialPostBase & { type: Exclude<SocialPostType, 'lottery'> })

export const SOCIAL_LOTTERY_KEYS = [
  'social.lottery.0',
  'social.lottery.1',
  'social.lottery.2',
  'social.lottery.3',
  'social.lottery.4',
  'social.lottery.5',
  'social.lottery.6',
  'social.lottery.7',
] as const satisfies readonly MessageKey[]

export type GameState = {
  stage: Stage
  tiroAvatar: string
  submissions: number
  company: string | null
  lastResult: 'rejected' | null
  energy: number
  tokens: number
  money: number
  shopDiscoveries: ShopItemId[]
  elapsed: number
  wonAt: number | null
  tickRemainder: number
  tasks: WorkTask[]
  taskQueue: TaskDescriptor[]
  terminals: TerminalState[]
  completedTasks: number
  level: 3 | 4 | 5
  completedArchitectureTasks: number
  reasoningUnlocked: boolean
  fastModeUnlocked: boolean
  watercoolerUnlocked: boolean
  watercoolerRead: boolean
  socialInstalledAt: number | null
  socialPosts: SocialPost[]
  nextTaskId: number
  nextTaskAt: number
  welcomeReacted: boolean
  messages: EmploymentMessage[]
  failure: MessageReference | null
  expectation: number
  rng: number
  socialRng: number
  secondJob: EmploymentJob | null
  secondJobUnlocked: boolean
  secondJobApplications: number
  secondJobOffer: string | null
  advancedModelAnnouncedAt: number | null
  advancedModelUnlocked: boolean
  frontierModelUnlocked: boolean
  frontierUnlockedAt: number | null
  monopolyAnnouncedAt: number | null
  sparkAnnouncedAt: number | null
  sparkPurchasedAt: number | null
  sparkDeliveryAt: number | null
  sparkUltraAnnouncedAt: number | null
  sparkUltraPurchasedAt: number | null
  sparkUltraDeliveryAt: number | null
  shortsUnlocked: boolean
  inactivityElapsed: number
  inactivityDecay: number
  mercuryOwned: boolean
  mercuryEnabled: boolean
  mercuryUpgraded: boolean
  tokenAutoBuy: boolean
  tokenPacks: TokenPackCount
  market: MarketState | null
  taskBags: {
    standard: number[]
    architecture: number[]
  }
  lastTaskBlueprint: {
    standard: number | null
    architecture: number | null
  }
  lossReason: 'deadline' | 'energy' | null
}
export type GameAction =
  | { type: 'start'; seed: number }
  | { type: 'submit'; roll: number; companyIndex: number }
  | { type: 'accept' }
  | { type: 'continue-after-win' }
  | { type: 'reset' }
  | { type: 'dev-jump'; stage: DevJumpTarget }
  | { type: 'tick'; seconds: number }
  | { type: 'welcome-react'; jobId: JobId }
  | { type: 'start-task'; id: number; terminalId: TerminalId; slot: number }
  | { type: 'approve-task'; id: number; approved: boolean }
  | { type: 'deliver-task'; id: number }
  | { type: 'buy-tokens'; packs: TokenPackCount }
  | { type: 'set-token-auto-buy'; enabled: boolean }
  | { type: 'set-token-packs'; packs: TokenPackCount }
  | { type: 'buy-upgrade'; upgrade: TerminalUpgrade; terminalId: TerminalId; source: 'click' | 'drag' }
  | { type: 'read-watercooler' }
  | { type: 'install-social' }
  | { type: 'like-reset'; postId: string }
  | { type: 'set-fast-mode'; terminalId: TerminalId; enabled: boolean }
  | { type: 'retry-task'; id: number }
  | { type: 'retry-all' }
  | { type: 'buy-spark' }
  | { type: 'buy-spark-ultra' }
  | { type: 'buy-model'; model: 'advanced' }
  | { type: 'set-terminal-model'; terminalId: TerminalId; model: AgentModelId }
  | { type: 'buy-mercury-upgrade' }
  | { type: 'buy-mercury' }
  | { type: 'set-mercury'; enabled: boolean }
  | { type: 'submit-second-job'; roll: number; companyIndex: number }
  | { type: 'accept-second-job' }
  | { type: 'scroll-short' }
  | { type: 'market-transfer'; direction: 'deposit' | 'withdraw'; amount: number | 'max' }
  | { type: 'market-trade'; side: 'buy' | 'sell'; amount: number }


export const companies: readonly string[] = [
  'Prompt & Circumstance',
  'Ship It Labs',
  'The Merge Conflict',
  'Copilot & Chill',
  'Definitely Not a Startup',
]

const MAX_ENERGY = 100
export const SHORTS_ENERGY_GAIN = 5
export const MAX_TOKENS = 10_000_000
export const SPARK_ULTRA_PRICE = 100_000
export const WIN_NET_WORTH = 4_242_000
const TOKEN_TASK_COST = 100_000
export const TOKEN_PURCHASE_AMOUNT = 100_000
export const TOKEN_PURCHASE_COST = 100
// Three-times longer work windows preserve the existing model and fast-mode ratios.
const TASK_PACING_MULTIPLIER = 3
const TASK_REWARD_PER_DIFFICULTY = 15
export const BASE_SALARY = 15
// Keep gross-income projection aligned with the slower assignment cadence.
const BASELINE_TASK_CYCLE_SECONDS = 18
const OPENING_GRACE_SECONDS = 180
const OPENING_ASSIGNMENT_BONUS_SECONDS = 12
const OPENING_DEADLINE_BONUS = 0.5
const INITIAL_WAGE_ONLY_SECONDS = 90
const AVERAGE_TASK_DIFFICULTY = 9
const BOSS_BUDGET_ANCHOR = 620
const MIN_ASSIGNMENT_INTERVAL = 9
const MIN_EXPECTATION = 0.05
const MAX_EXPECTATION = 1
const UINT_RANGE = 4_294_967_296
const MAX_TERMINAL_SLOTS = 4
const MAX_CLOUD_TERMINALS = 2
const TASK_QUEUE_SIZE = 3
const SPLIT_PRICES: readonly number[] = [200, 400, 1_000]
const YOLO_PRICE = 2_222
const SECONDARY_PRICE_MULTIPLIER = 2
const ADDITIONAL_TERMINAL_PRICE = 1_000
const WATERCOOLER_THRESHOLD = MAX_TOKENS * 0.2
export const TOKEN_AUTO_BUY_THRESHOLD = 1_000_000
const SOCIAL_LOTTERY_DELAY = 5
const TIRO_PREVIEW_TOKENS = 1_900_000
export const MERCURY_RETRY_DELAY = 10
export const SPARK_PRICE = 15_000
export const ADVANCED_MODEL_PRICE = 5_000
export const MERCURY_PRICE = 8_000
export const MERCURY_UPGRADE_PRICE = 50_000
export const MERCURY_FORWARD_COST = 300_000
export const MERCURY_SUCCESS_BONUS = 0.1
// Rounded one-third checkpoints keep the progression readable without artificial waits.
const INCENTIVE_TASK_GATE = 2
const LEVEL_4_TASK_GATE = 17
const FAST_MODE_ARCHITECTURE_GATE = 2
const MARKET_TASK_GATE = 18
const MARKET_ARCHITECTURE_GATE = 3
const SECOND_JOB_TASK_GATE = 33
const LEVEL_5_TASK_GATE = 27
const FRONTIER_TASK_GATE = 65
// Bring Frontier forward without also bringing the monopoly cliff forward.
const MONOPOLY_DELAY_SECONDS = 360
const APPROVAL_DELAY_MIN_SECONDS = 3
const APPROVAL_DELAY_MAX_SECONDS = 6
const DELIVERY_ASSIGNMENT_ACCELERATION_SECONDS = 15
const REWARD_DECAY_INTERVAL_SECONDS = 30
// Slower task issuance needs a proportionally longer refill window to preserve scarcity.
export const TOKEN_REFILL_INTERVAL_SECONDS = 420
const INACTIVITY_MAX_DECAY = 16
const ENERGY_DECAY_EPSILON = 1e-9

export function taskTokenCost(
  task: Pick<WorkTask, 'difficulty'>,
  fastMode = false,
  model: AgentModelId = 'basic',
  local = false,
): number {
  if (!Number.isFinite(task.difficulty) || task.difficulty < 0) return Number.NaN
  if (local) return 0
  const modelConfig = AGENT_MODELS[model]
  if (modelConfig === undefined) return Number.NaN
  return TOKEN_TASK_COST * task.difficulty * (fastMode ? 2 : 1) * modelConfig.tokenMultiplier
}

export function taskSuccessChance(
  task: Pick<TaskDescriptor, 'complexity'>,
  model: AgentModelId,
  state: Pick<GameState, 'mercuryUpgraded'>,
): number {
  const modelConfig = AGENT_MODELS[model]
  if (modelConfig === undefined || !Number.isFinite(task.complexity) || task.complexity <= 0) return 0
  const bonus = state.mercuryUpgraded ? MERCURY_SUCCESS_BONUS : 0
  return Math.min(1, modelConfig.intelligence / task.complexity + bonus)
}

export function taskReward(task: Pick<WorkTask, 'baseReward' | 'assignedAt'>, elapsed: number): number {
  const initial = Number.isFinite(task.baseReward) ? Math.max(0, task.baseReward) : 0
  const safeElapsed = Number.isFinite(elapsed) ? elapsed : task.assignedAt
  const elapsedSinceAssignment = Math.max(0, safeElapsed - task.assignedAt)
  const retained = Math.max(0.05, 1 - 0.1 * Math.floor(elapsedSinceAssignment / REWARD_DECAY_INTERVAL_SECONDS))
  return Math.round(initial * retained * 100) / 100
}

export function tokenPurchaseAmount(tokens: number, packs: TokenPackCount): number {
  return Math.max(0, Math.min(TOKEN_PURCHASE_AMOUNT * packs, MAX_TOKENS - tokens))
}
export function tokenPriceMultiplier(state: Pick<GameState, 'elapsed' | 'monopolyAnnouncedAt'>): number {
  if (state.monopolyAnnouncedAt === null || !Number.isFinite(state.monopolyAnnouncedAt)) return 1
  const elapsed = Number.isFinite(state.elapsed) ? state.elapsed : state.monopolyAnnouncedAt
  const steps = Math.floor(Math.max(0, elapsed - state.monopolyAnnouncedAt) / 5 + Number.EPSILON * 8)
  return 1.1 ** steps
}

export function tokenPurchaseCost(amount: number, state: Pick<GameState, 'elapsed' | 'monopolyAnnouncedAt'>): number {
  const multiplier = tokenPriceMultiplier(state)
  const cents = amount * TOKEN_PURCHASE_COST * 100 * multiplier / TOKEN_PURCHASE_AMOUNT
  return Math.ceil(cents - Math.abs(cents) * Number.EPSILON * 2) / 100
}
function purchaseTokens(state: GameState, packs: TokenPackCount): GameState {
  if (!TOKEN_PACK_COUNTS.includes(packs) || state.stage !== 'hired') return state
  const amount = tokenPurchaseAmount(state.tokens, packs)
  const cost = tokenPurchaseCost(amount, state)
  if (!Number.isFinite(state.money) || !Number.isFinite(state.tokens) || !Number.isFinite(amount) || !Number.isFinite(cost) ||
    state.money < cost || amount <= 0) return state
  return issueAvailableAssignments({
    ...state,
    money: Math.max(0, Math.round((state.money - cost) * 100) / 100),
    tokens: Math.min(MAX_TOKENS, state.tokens + amount),
  })
}

const taskBlueprints: readonly Pick<TaskDescriptor, 'titleKey' | 'descriptionKey' | 'artifactName'>[] = [
  { titleKey: 'task.standard.0.title', descriptionKey: 'task.standard.0.description', artifactName: 'onboarding-checklist.patch' },
  { titleKey: 'task.standard.1.title', descriptionKey: 'task.standard.1.description', artifactName: 'timeout-fix.diff' },
  { titleKey: 'task.standard.2.title', descriptionKey: 'task.standard.2.description', artifactName: 'activity-feed-preview.png' },
  { titleKey: 'task.standard.3.title', descriptionKey: 'task.standard.3.description', artifactName: 'endpoint-notes.md' },
  { titleKey: 'task.standard.4.title', descriptionKey: 'task.standard.4.description', artifactName: 'import-guard.test.ts' },
  { titleKey: 'task.standard.5.title', descriptionKey: 'task.standard.5.description', artifactName: 'search-ranking.json' },
  { titleKey: 'task.standard.6.title', descriptionKey: 'task.standard.6.description', artifactName: 'empty-state-copy.txt' },
  { titleKey: 'task.standard.7.title', descriptionKey: 'task.standard.7.description', artifactName: 'release-notes.md' },
  { titleKey: 'task.standard.8.title', descriptionKey: 'task.standard.8.description', artifactName: 'webhook-retry.spec.ts' },
  { titleKey: 'task.standard.9.title', descriptionKey: 'task.standard.9.description', artifactName: 'billing-summary.sql' },
  { titleKey: 'task.standard.10.title', descriptionKey: 'task.standard.10.description', artifactName: 'upload-policy.ts' },
  { titleKey: 'task.standard.11.title', descriptionKey: 'task.standard.11.description', artifactName: 'notification-digest.json' },
  { titleKey: 'task.standard.12.title', descriptionKey: 'task.standard.12.description', artifactName: 'cache-invalidation.diff' },
  { titleKey: 'task.standard.13.title', descriptionKey: 'task.standard.13.description', artifactName: 'permission-prompt.copy' },
  { titleKey: 'task.standard.14.title', descriptionKey: 'task.standard.14.description', artifactName: 'queue-health.dashboard' },
  { titleKey: 'task.standard.15.title', descriptionKey: 'task.standard.15.description', artifactName: 'startup-profile.txt' },
]

const architectureBlueprints: readonly Pick<TaskDescriptor, 'titleKey' | 'descriptionKey' | 'artifactName'>[] = [
  { titleKey: 'task.architecture.0.title', descriptionKey: 'task.architecture.0.description', artifactName: 'failover-architecture.md' },
  { titleKey: 'task.architecture.1.title', descriptionKey: 'task.architecture.1.description', artifactName: 'event-backbone.md' },
  { titleKey: 'task.architecture.2.title', descriptionKey: 'task.architecture.2.description', artifactName: 'tenant-partition-plan.md' },
  { titleKey: 'task.architecture.3.title', descriptionKey: 'task.architecture.3.description', artifactName: 'service-boundaries.md' },
  { titleKey: 'task.architecture.4.title', descriptionKey: 'task.architecture.4.description', artifactName: 'regional-data-plane.md' },
  { titleKey: 'task.architecture.5.title', descriptionKey: 'task.architecture.5.description', artifactName: 'deployment-strategy.md' },
  { titleKey: 'task.architecture.6.title', descriptionKey: 'task.architecture.6.description', artifactName: 'identity-perimeter.md' },
  { titleKey: 'task.architecture.7.title', descriptionKey: 'task.architecture.7.description', artifactName: 'observability-contract.md' },
]

const APPROVAL_PROMPTS: readonly MessageKey[] = [
  'task.approval.applyPatch', 'task.approval.testSuite', 'task.approval.build', 'task.approval.lockfile',
  'task.approval.migration', 'task.approval.removeFiles', 'task.approval.retryCommand', 'task.approval.formatter',
  'task.approval.configuration', 'task.approval.commit',
]


function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1
}

const TIRO_AVATARS: readonly string[] = ['🧑🏻‍💻', '👩🏼‍💻', '👨🏽‍💻', '🧑🏾‍💻', '👩🏿‍💻', '👨🏻‍💻']
function avatarForSeed(seed: number): string {
  const normalized = normalizeSeed(seed)
  const mixed = Math.imul(normalized ^ (normalized >>> 16), 0x45d9f3b) >>> 0
  return TIRO_AVATARS[mixed % TIRO_AVATARS.length] ?? TIRO_AVATARS[0]!
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
function drawBlueprintIndex(
  rng: number,
  kind: TaskDescriptor['kind'],
  bags: GameState['taskBags'],
  previousIndex: number | null,
): readonly [number, number[], number] {
  const blueprints = kind === 'architecture' ? architectureBlueprints : taskBlueprints
  let nextRng = rng
  let bag = [...bags[kind]]
  if (bag.length === 0) {
    bag = Array.from({ length: blueprints.length }, (_, index) => index)
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const [shuffledRng, otherIndex] = drawInteger(nextRng, 0, index)
      nextRng = shuffledRng
      const current = bag[index]!
      bag[index] = bag[otherIndex]!
      bag[otherIndex] = current
    }
  }
  let pickedIndex = bag[bag.length - 1] ?? 0
  if (bag.length > 1 && pickedIndex === previousIndex) {
    const first = bag[0] ?? pickedIndex
    bag[0] = pickedIndex
    bag[bag.length - 1] = first
    pickedIndex = first
  }
  bag.pop()
  return [nextRng, bag, pickedIndex]
}
function drawLotteryVariant(rng: number, previousVariant: number | undefined): readonly [number, number] {
  const [candidateRng, candidate] = drawInteger(rng, 0, SOCIAL_LOTTERY_KEYS.length - 1)
  if (previousVariant === undefined || candidate !== previousVariant) return [candidateRng, candidate]
  const [nextRng, alternative] = drawInteger(candidateRng, 0, SOCIAL_LOTTERY_KEYS.length - 2)
  return [nextRng, alternative >= previousVariant ? alternative + 1 : alternative]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
export function energyDecayInterval(state: Pick<GameState, 'elapsed'>): number {
  const elapsed = Number.isNaN(state.elapsed) ? 0 : Math.max(0, state.elapsed)
  if (elapsed <= 600) return 20 - elapsed / 60
  if (elapsed <= 1_800) return 10 - (elapsed - 600) / 240
  return 5
}

function timeUntilEnergyDecay(elapsed: number, inactivityElapsed: number): number {
  const start = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  let cursor = start
  let timer = Number.isFinite(inactivityElapsed) ? Math.max(0, inactivityElapsed) : 0
  while (true) {
    const interval = energyDecayInterval({ elapsed: cursor })
    if (timer >= interval - ENERGY_DECAY_EPSILON) return cursor - start
    const slope = cursor < 600 ? -1 / 60 : cursor < 1_800 ? -1 / 240 : 0
    const nextBoundary = cursor < 600 ? 600 : cursor < 1_800 ? 1_800 : Number.POSITIVE_INFINITY
    const untilBoundary = nextBoundary - cursor
    const candidate = (interval - timer) / (1 - slope)
    if (candidate <= untilBoundary + ENERGY_DECAY_EPSILON) return cursor - start + Math.max(0, candidate)
    timer += untilBoundary
    cursor = nextBoundary
  }
}

function openingGraceAt(elapsed: number): number {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  return 1 - clamp(safeElapsed / OPENING_GRACE_SECONDS, 0, 1)
}
function drawApprovalCheckpoint(rng: number): readonly [number, number, MessageKey] {
  const [delayRng, approvalDelay] = drawInteger(rng, APPROVAL_DELAY_MIN_SECONDS, APPROVAL_DELAY_MAX_SECONDS)
  const [nextRng, promptIndex] = drawInteger(delayRng, 0, APPROVAL_PROMPTS.length - 1)
  return [nextRng, approvalDelay, APPROVAL_PROMPTS[promptIndex] ?? APPROVAL_PROMPTS[0]!]
}
function projectedGrossAt(elapsed: number): number {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  const averageTaskReward = TASK_REWARD_PER_DIFFICULTY * AVERAGE_TASK_DIFFICULTY
  const rewardElapsed = Math.max(0, safeElapsed - INITIAL_WAGE_ONLY_SECONDS)
  return BASE_SALARY * safeElapsed + rewardElapsed * (averageTaskReward * 0.9 / BASELINE_TASK_CYCLE_SECONDS)
}
function bossExpectationAt(elapsed: number): number {
  const ratio = projectedGrossAt(elapsed) / BOSS_BUDGET_ANCHOR
  const target = 0.2 + 0.8 * ratio / (1 + ratio)
  return clamp(target * (1 - 0.35 * openingGraceAt(elapsed)), MIN_EXPECTATION, MAX_EXPECTATION)
}
function assignmentIntervalAt(elapsed: number, expanded = false, activeTasks = 0): number {
  const ratio = projectedGrossAt(elapsed) / BOSS_BUDGET_ANCHOR
  const minimum = expanded ? MIN_ASSIGNMENT_INTERVAL + 6 : MIN_ASSIGNMENT_INTERVAL
  const target = Math.max(minimum, Math.ceil(BASELINE_TASK_CYCLE_SECONDS / (1 + ratio)))
  const overload = Math.max(0, activeTasks - (expanded ? 2 : 1)) * 6
  return Math.max(minimum, Math.ceil(target + OPENING_ASSIGNMENT_BONUS_SECONDS * openingGraceAt(elapsed) + overload))
}
function deadlineFor(difficulty: number, expectation: number, elapsed: number, complexity: number): number {
  const safeExpectation = Math.max(MIN_EXPECTATION, Number.isFinite(expectation) ? expectation : 0.2)
  const executionBudget = (difficulty / AGENT_MODELS.reasoning.speed * Math.max(2, complexity) + 8) * TASK_PACING_MULTIPLIER
  const graceMultiplier = 1 + OPENING_DEADLINE_BONUS * openingGraceAt(elapsed)
  return elapsed + Math.max((1.5 * difficulty * TASK_PACING_MULTIPLIER) / safeExpectation, executionBudget) * graceMultiplier
}
function roundedProgress(value: number): number {
  // Keep thirds and other paced speeds from accumulating a visible one-tick deficit.
  return Math.round(value * 1_000_000_000) / 1_000_000_000
}

function jobFromState(state: GameState, jobId: JobId): EmploymentJob | null {
  if (jobId === 'secondary') return state.secondJob
  if (state.company === null) return null
  return {
    company: state.company,
    level: state.level,
    completedTasks: state.completedTasks,
    completedArchitectureTasks: state.completedArchitectureTasks,
    nextTaskAt: state.nextTaskAt,
    expectation: state.expectation,
    welcomeReacted: state.welcomeReacted,
    startedAt: 0,
  }
}

function withJob(state: GameState, jobId: JobId, update: (job: EmploymentJob) => EmploymentJob): GameState {
  const current = jobFromState(state, jobId)
  if (current === null) return state
  const next = update(current)
  if (jobId === 'secondary') return { ...state, secondJob: next }
  return {
    ...state,
    company: next.company,
    level: next.level,
    completedTasks: next.completedTasks,
    completedArchitectureTasks: next.completedArchitectureTasks,
    nextTaskAt: next.nextTaskAt,
    expectation: next.expectation,
    welcomeReacted: next.welcomeReacted,
  }
}

function createDescriptor(
  state: Pick<GameState, 'rng' | 'nextTaskId' | 'secondJobUnlocked' | 'taskBags' | 'lastTaskBlueprint'>,
  jobId: JobId,
  job: EmploymentJob,
): readonly [TaskDescriptor, number, number, GameState['taskBags'], GameState['lastTaskBlueprint']] {
  let rng = state.rng
  let kind: TaskDescriptor['kind'] = 'standard'
  if (job.level >= 4) {
    const [architectureRng, architectureRoll] = nextRandom(rng)
    rng = architectureRng
    const architectureChance = Math.min(0.8, 0.35 + 0.125 * job.completedArchitectureTasks)
    kind = architectureRoll < architectureChance ? 'architecture' : 'standard'
  }
  const blueprints = kind === 'architecture' ? architectureBlueprints : taskBlueprints
  const [blueprintRng, bag, blueprintIndex] = drawBlueprintIndex(rng, kind, state.taskBags, state.lastTaskBlueprint[kind])
  rng = blueprintRng
  const expanded = state.secondJobUnlocked
  const complexityRange = expanded
    ? [Math.max(1, job.level - 2), job.level] as const
    : kind === 'architecture' ? [2, 2] as const : [1, 1] as const
  const [complexityRng, complexity] = drawInteger(rng, complexityRange[0], complexityRange[1])
  const difficultyMinimum = expanded ? (job.level === 5 ? 6 : job.level === 4 ? 4 : 3) : (job.level === 4 ? 4 : 3)
  const difficultyMaximum = expanded ? (job.level === 5 ? 12 : job.level === 4 ? 9 : 6) : (job.level === 4 ? 8 : 6)
  const [finalRng, difficulty] = drawInteger(complexityRng, difficultyMinimum, difficultyMaximum)
  const blueprint = blueprints[blueprintIndex] ?? blueprints[0]
  const taskBags = kind === 'standard'
    ? { standard: bag, architecture: state.taskBags.architecture }
    : { standard: state.taskBags.standard, architecture: bag }
  const lastTaskBlueprint = {
    ...state.lastTaskBlueprint,
    [kind]: blueprintIndex,
  }
  return [{
    id: state.nextTaskId,
    jobId,
    titleKey: blueprint.titleKey,
    descriptionKey: blueprint.descriptionKey,
    difficulty,
    artifactName: blueprint.artifactName,
    kind,
    complexity,
  }, finalRng, state.nextTaskId + 1, taskBags, lastTaskBlueprint]
}

function refillTaskQueue(state: GameState): GameState {
  let current = state
  if (current.secondJob !== null && current.taskQueue.length === TASK_QUEUE_SIZE && !current.taskQueue.some((task) => task.jobId === 'secondary')) {
    const [secondaryDescriptor, rng, nextTaskId, taskBags, lastTaskBlueprint] = createDescriptor(current, 'secondary', current.secondJob)
    current = {
      ...current,
      taskQueue: [...current.taskQueue.slice(0, TASK_QUEUE_SIZE - 1), secondaryDescriptor],
      rng,
      nextTaskId,
      taskBags,
      lastTaskBlueprint,
    }
  }
  while (current.taskQueue.length < TASK_QUEUE_SIZE) {
    const primary = jobFromState(current, 'primary')
    if (primary === null) break
    let jobId: JobId = 'primary'
    if (current.secondJob !== null) {
      const primaryQueued = current.taskQueue.filter((task) => task.jobId === 'primary').length
      const secondaryQueued = current.taskQueue.filter((task) => task.jobId === 'secondary').length
      jobId = secondaryQueued < 1 && primaryQueued >= 2 ? 'secondary' : 'primary'
    }
    const job = jobFromState(current, jobId)
    if (job === null) break
    const [descriptor, rng, nextTaskId, taskBags, lastTaskBlueprint] = createDescriptor(current, jobId, job)
    current = { ...current, taskQueue: [...current.taskQueue, descriptor], rng, nextTaskId, taskBags, lastTaskBlueprint }
  }
  return current
}

function snapshotTask(task: WorkTask): EmploymentTaskSnapshot {
  return {
    id: task.id,
    jobId: task.jobId,
    titleKey: task.titleKey,
    descriptionKey: task.descriptionKey,
    difficulty: task.difficulty,
    artifactName: task.artifactName,
    kind: task.kind,
    complexity: task.complexity,
    deadlineAt: task.deadlineAt,
    startedAt: task.startedAt,
    assignedAt: task.assignedAt,
    baseReward: task.baseReward,
    model: task.model,
    fastMode: task.fastMode,
    local: task.local,
    attempt: task.attempt,
    status: task.status,
    progress: task.progress,
    failedAt: task.failedAt,
  }
}

function appendMessage(state: GameState, message: EmploymentMessage): GameState {
  return state.messages.some((candidate) => candidate.id === message.id)
    ? state
    : { ...state, messages: [...state.messages, message] }
}
function appendSocialPost(state: GameState, post: SocialPost): GameState {
  return state.socialPosts.some((candidate) => candidate.id === post.id)
    ? state
    : { ...state, socialPosts: [...state.socialPosts, post] }
}
function appendLotteryPost(state: GameState, elapsed: number, previousVariant?: number): GameState {
  const lotteryCount = state.socialPosts.reduce((count, post) => count + Number(post.type === 'lottery'), 0)
  const id = lotteryCount === 0 ? 'lottery' : `lottery-${lotteryCount}`
  const [socialRng, lotteryVariant] = drawLotteryVariant(state.socialRng, previousVariant)
  return appendSocialPost(
    { ...state, socialRng },
    { id, type: 'lottery', elapsed, likes: 0, lotteryVariant },
  )
}
function updateAssignmentArtifact(state: GameState, task: WorkTask): GameState {
  return {
    ...state,
    messages: state.messages.map((message) => message.type === 'assignment' && message.task.id === task.id
      ? { ...message, artifact: snapshotTask(task) }
      : message),
  }
}

const PRIMARY_TERMINAL: TerminalState = { id: 'terminal', slots: 1, yolo: false, fastMode: false, model: 'basic' }
export function mercuryReturnReservations(tasks: readonly WorkTask[], enabled = true): number {
  if (!enabled) return 0
  return tasks.reduce((total, task) => total + (
    task.mercuryAuto === true && task.status !== 'assigned' && task.status !== 'failed'
      ? MERCURY_FORWARD_COST
      : 0
  ), 0)
}
function reservedAssignmentTokens(tasks: readonly WorkTask[], localAvailable = false): number {
  if (localAvailable) return 0
  return tasks.reduce((total, task) => total + (task.status === 'assigned' ? taskTokenCost(task, false, 'basic', false) : 0), 0)
}

export function completedTaskCount(state: GameState): number {
  return state.completedTasks + (state.secondJob?.completedTasks ?? 0)
}

function availableCloudModels(state: GameState): AgentModelId[] {
  const result: AgentModelId[] = ['basic']
  if (state.reasoningUnlocked) result.push('reasoning')
  if (state.advancedModelUnlocked) result.push('advanced')
  if (state.frontierModelUnlocked) result.push('frontier')
  return result
}
export function availableModels(state: GameState, terminalId: TerminalId): AgentModelId[] {
  if (!isTerminalId(terminalId) || getTerminal(state, terminalId) === undefined) return []
  if (isLocalTerminal(terminalId)) return [terminalId === 'spark-ultra' ? 'advanced' : 'reasoning']
  return availableCloudModels(state)
}
export function terminalModel(state: GameState, terminalId: TerminalId): AgentModelId {
  if (terminalId === 'spark') return 'reasoning'
  if (terminalId === 'spark-ultra') return 'advanced'
  const terminal = getTerminal(state, terminalId)
  if (terminal === undefined) return 'basic'
  const best: AgentModelId = state.advancedModelUnlocked ? 'advanced' : state.reasoningUnlocked ? 'reasoning' : 'basic'
  if (!state.frontierModelUnlocked) return best
  switch (terminal.model) {
    case 'basic':
    case 'frontier':
      return terminal.model
    case 'reasoning':
      return state.reasoningUnlocked ? 'reasoning' : best
    case 'advanced':
      return state.advancedModelUnlocked ? 'advanced' : best
  }
}

function assignedTaskReservations(
  state: Pick<GameState, 'tasks'> & Partial<Pick<GameState, 'terminals'>>,
  task: WorkTask,
): number {
  if (state.terminals?.some((terminal) => isLocalTerminal(terminal.id))) return 0
  return state.tasks.reduce((total, candidate) => total + (
    candidate.id !== task.id && candidate.status === 'assigned'
      ? taskTokenCost(candidate, false, 'basic', candidate.local)
      : 0
  ), 0)
}

export function canFundTaskAttempt(
  state: Pick<GameState, 'tasks' | 'tokens'> & Partial<Pick<GameState, 'terminals' | 'reasoningUnlocked' | 'advancedModelUnlocked' | 'frontierModelUnlocked' | 'mercuryEnabled'>>,
  task: WorkTask,
  fastMode: boolean,
  terminalId?: TerminalId,
  preserveAssignedReservations = true,
): boolean {
  if (terminalId !== undefined && state.terminals !== undefined && state.terminals.every((terminal) => terminal.id !== terminalId)) return false
  const local = terminalId !== undefined && isLocalTerminal(terminalId)
  let model: AgentModelId = 'basic'
  if (local) {
    model = terminalId === 'spark-ultra' ? 'advanced' : 'reasoning'
  } else if (state.frontierModelUnlocked && terminalId !== undefined) {
    const selected = state.terminals?.find((terminal) => terminal.id === terminalId)?.model
    if (selected !== undefined) model = selected
  } else if (state.advancedModelUnlocked) {
    model = 'advanced'
  } else if (state.reasoningUnlocked) {
    model = 'reasoning'
  }
  const assigned = preserveAssignedReservations ? assignedTaskReservations(state, task) : 0
  const otherReservations = assigned + mercuryReturnReservations(state.tasks, state.mercuryEnabled !== false)
  const cost = taskTokenCost(task, local ? false : fastMode, model, local)
  return Number.isFinite(cost) && cost >= 0 && Number.isFinite(otherReservations) &&
    Number.isFinite(state.tokens) && state.tokens >= 0 && (local || state.tokens >= cost + otherReservations)
}

export function canFundMercuryAttempt(state: GameState, task: WorkTask, terminalId: TerminalId): boolean {
  if (!state.mercuryOwned || !state.mercuryEnabled || task.status !== 'assigned') return false
  const terminal = getTerminal(state, terminalId)
  if (terminal === undefined) return false
  const local = isLocalTerminal(terminalId)
  const fastMode = local ? false : terminal.fastMode === true
  const model = terminalModel(state, terminalId)
  const attemptCost = taskTokenCost(task, fastMode, model, local)
  const reserved = mercuryReturnReservations(state.tasks)
  const required = MERCURY_FORWARD_COST + attemptCost + MERCURY_FORWARD_COST + reserved
  return Number.isFinite(attemptCost) && attemptCost >= 0 && Number.isFinite(required) &&
    Number.isFinite(state.tokens) && state.tokens >= required
}
function canFundMercuryRetryAt(state: GameState, task: WorkTask, terminalId: TerminalId, slot: number): boolean {
  if (!state.mercuryOwned || !state.mercuryEnabled || task.status !== 'failed' || task.failedAt === null) return false
  const terminal = getTerminal(state, terminalId)
  if (terminal === undefined || slot < 0 || slot >= terminal.slots || !taskSlotFree(state, terminalId, slot, task.id)) return false
  const local = isLocalTerminal(terminalId)
  const fastMode = local ? false : terminal.fastMode === true
  const model = terminalModel(state, terminalId)
  const attemptCost = taskTokenCost(task, fastMode, model, local)
  const required = attemptCost + MERCURY_FORWARD_COST + mercuryReturnReservations(state.tasks)
  return Number.isFinite(attemptCost) && attemptCost >= 0 && Number.isFinite(required) &&
    Number.isFinite(state.tokens) && state.tokens >= required
}
export function canFundMercuryRetry(
  state: GameState,
  task: WorkTask,
  terminalId?: TerminalId,
  slot?: number,
): boolean {
  if (state.mercuryUpgraded && terminalId === undefined && slot === undefined) {
    return bestMercuryPlacement(state, task, true) !== null
  }
  const selectedTerminal = terminalId ?? task.terminalId
  const selectedSlot = slot ?? task.slot
  return selectedTerminal !== null && selectedTerminal !== undefined &&
    selectedSlot !== null && selectedSlot !== undefined &&
    canFundMercuryRetryAt(state, task, selectedTerminal, selectedSlot)
}



function issueAvailableAssignments(state: GameState): GameState {
  if (state.stage !== 'hired') return state
  const current = refillTaskQueue(state)
  const dueIndex = current.taskQueue.findIndex((descriptor) => {
    const job = jobFromState(current, descriptor.jobId)
    return job !== null && job.nextTaskAt <= current.elapsed
  })
  if (dueIndex < 0) return current
  const descriptor = current.taskQueue[dueIndex]
  if (descriptor === undefined) return current
  const reserved = reservedAssignmentTokens(current.tasks, current.terminals.some((terminal) => isLocalTerminal(terminal.id)))
  const cost = taskTokenCost(descriptor)
  const hasLocalTerminal = current.terminals.some((terminal) => isLocalTerminal(terminal.id))
  if (!Number.isFinite(cost) || (!hasLocalTerminal && current.tokens < reserved + cost) || (hasLocalTerminal && current.tokens < reserved && reserved > 0)) return current
  const job = jobFromState(current, descriptor.jobId)
  if (job === null) return current
  const normalDeadline = deadlineFor(descriptor.difficulty, job.expectation, current.elapsed, descriptor.complexity)
  const task: WorkTask = {
    ...descriptor,
    deadlineAt: descriptor.kind === 'architecture' ? current.elapsed + (normalDeadline - current.elapsed) * 5 : normalDeadline,
    startedAt: null,
    assignedAt: current.elapsed,
    baseReward: job.completedTasks >= INCENTIVE_TASK_GATE
      ? TASK_REWARD_PER_DIFFICULTY * descriptor.difficulty * (job.level === 5 ? 600 : job.level === 4 ? 100 : 1)
      : 0,
    model: null,
    fastMode: false,
    local: false,
    failedAt: null,
    attempt: 0,
    status: 'assigned',
    progress: 0,
    nextApprovalAt: 0,
    terminalId: null,
    slot: null,
    approvalPromptKey: null,
  }
  const next = withJob({
    ...current,
    tasks: [...current.tasks, task],
    taskQueue: current.taskQueue.filter((_, index) => index !== dueIndex),
  }, descriptor.jobId, (jobState) => ({
    ...jobState,
    nextTaskAt: current.elapsed + assignmentIntervalAt(
      current.elapsed,
      current.secondJobUnlocked,
      current.tasks.filter((candidate) => candidate.jobId === descriptor.jobId && candidate.status !== 'artifact').length + 1,
    ),
  }))
  return appendMessage(next, {
    id: `assignment-${task.id}`,
    type: 'assignment',
    jobId: task.jobId,
    elapsed: current.elapsed,
    task: snapshotTask(task),
    artifact: null,
  })
}

function createHiredState(state: GameState): GameState {
  const hired: GameState = {
    ...state,
    stage: 'hired',
    energy: MAX_ENERGY,
    shopDiscoveries: [],
    tickRemainder: 0,
    wonAt: null,
    tasks: [],
    taskQueue: [],
    terminals: [{ ...PRIMARY_TERMINAL }],
    level: 3,
    completedArchitectureTasks: 0,
    reasoningUnlocked: false,
    fastModeUnlocked: false,
    watercoolerUnlocked: false,
    watercoolerRead: false,
    socialInstalledAt: null,
    socialPosts: [],
    nextTaskId: 1,
    nextTaskAt: 0,
    welcomeReacted: false,
    messages: [],
    failure: null,
    expectation: bossExpectationAt(state.elapsed),
    secondJob: null,
    secondJobUnlocked: false,
    secondJobApplications: 0,
    secondJobOffer: null,
    advancedModelAnnouncedAt: null,
    advancedModelUnlocked: false,
    frontierModelUnlocked: false,
    frontierUnlockedAt: null,
    monopolyAnnouncedAt: null,
    sparkAnnouncedAt: null,
    sparkPurchasedAt: null,
    sparkDeliveryAt: null,
    sparkUltraAnnouncedAt: null,
    sparkUltraPurchasedAt: null,
    sparkUltraDeliveryAt: null,
    shortsUnlocked: false,
    inactivityElapsed: 0,
    inactivityDecay: 1,
    mercuryOwned: false,
    mercuryEnabled: false,
    mercuryUpgraded: false,
    tokenAutoBuy: false,
    tokenPacks: 10,
    market: null,
    taskBags: { standard: [], architecture: [] },
    lastTaskBlueprint: { standard: null, architecture: null },
    lossReason: null,
  }
  const welcomed = appendMessage(hired, { id: 'welcome', type: 'welcome', jobId: 'primary', elapsed: hired.elapsed })
  return issueAvailableAssignments(welcomed)
}

function appendLotteryIfDue(state: GameState): GameState {
  if (state.socialInstalledAt === null || state.socialPosts.some((post) => post.type === 'lottery') || state.elapsed < state.socialInstalledAt + SOCIAL_LOTTERY_DELAY) return state
  return appendLotteryPost(state, state.socialInstalledAt + SOCIAL_LOTTERY_DELAY)
}

function appendFeatureAnnouncements(state: GameState): GameState {
  let current = state
  if (current.socialInstalledAt !== null && current.reasoningUnlocked && !current.socialPosts.some((post) => post.type === 'model')) {
    current = appendSocialPost(current, { id: 'model-unlocked', type: 'model', elapsed: current.elapsed, likes: 0 })
  }
  if (current.socialInstalledAt !== null && current.fastModeUnlocked && !current.socialPosts.some((post) => post.type === 'fast-mode')) {
    current = appendSocialPost(current, { id: 'fast-mode-unlocked', type: 'fast-mode', elapsed: current.elapsed, likes: 0 })
  }
  if (current.frontierUnlockedAt !== null && current.monopolyAnnouncedAt === null &&
    current.elapsed >= current.frontierUnlockedAt + MONOPOLY_DELAY_SECONDS) {
    const announcedAt = current.frontierUnlockedAt + MONOPOLY_DELAY_SECONDS
    current = { ...current, monopolyAnnouncedAt: announcedAt }
    current = appendSocialPost(current, { id: 'monopoly-announced', type: 'monopoly', elapsed: announcedAt, likes: 0 })
  }
  if (current.monopolyAnnouncedAt !== null && current.sparkUltraAnnouncedAt === null &&
    current.elapsed >= current.monopolyAnnouncedAt + 60) {
    const announcedAt = current.monopolyAnnouncedAt + 60
    current = { ...current, sparkUltraAnnouncedAt: announcedAt }
    current = appendSocialPost(current, { id: 'spark-ultra-announced', type: 'spark-ultra', elapsed: announcedAt, likes: 0 })
  }
  if (current.socialInstalledAt !== null && current.mercuryOwned && current.secondJob !== null &&
    !current.socialPosts.some((post) => post.type === 'mercury-upgrade')) {
    current = appendSocialPost(current, { id: 'mercury-upgrade-available', type: 'mercury-upgrade', elapsed: current.elapsed, likes: 0 })
  }
  return current
}

function maybeUnlockProgression(state: GameState): GameState {
  let current = appendFeatureAnnouncements(state)
  if (current.market === null && current.fastModeUnlocked && current.completedTasks >= MARKET_TASK_GATE && current.completedArchitectureTasks >= MARKET_ARCHITECTURE_GATE) {
    current = {
      ...current,
      market: createMarket(current.rng, current.elapsed),
      sparkAnnouncedAt: current.elapsed,
    }
    current = appendSocialPost(current, { id: 'market-unlocked', type: 'market', elapsed: current.elapsed, likes: 0 })
    current = appendSocialPost(current, { id: 'spark-announced', type: 'spark', elapsed: current.elapsed, likes: 0 })
  }
  if (current.secondJobUnlocked === false && current.advancedModelUnlocked && completedTaskCount(current) >= SECOND_JOB_TASK_GATE) {
    current = { ...current, secondJobUnlocked: true }
    current = appendSocialPost(current, { id: 'second-job-unlocked', type: 'second-job', elapsed: current.elapsed, likes: 0 })
  }
  if (current.frontierModelUnlocked === false && current.secondJob !== null && completedTaskCount(current) >= FRONTIER_TASK_GATE) {
    current = {
      ...current,
      frontierModelUnlocked: true,
      frontierUnlockedAt: current.elapsed,
    }
    current = appendSocialPost(current, { id: 'frontier-model-unlocked', type: 'frontier-model', elapsed: current.elapsed, likes: 0 })
  }
  return discoverShopProducts(appendFeatureAnnouncements(current))
}

function lose(state: GameState, failure: MessageReference, reason: 'deadline' | 'energy', jobId: JobId = 'primary'): GameState {
  const lost = { ...state, stage: 'lost' as const, failure, lossReason: reason }
  return reason === 'deadline'
    ? appendMessage(lost, { id: 'firing', type: 'firing', jobId, elapsed: state.elapsed, failure })
    : lost
}

export const initialGame: GameState = {
  stage: 'ready', tiroAvatar: TIRO_AVATARS[0]!, submissions: 0, company: null, lastResult: null, energy: MAX_ENERGY,
  tokens: MAX_TOKENS, money: 0, shopDiscoveries: [], elapsed: 0, wonAt: null, tickRemainder: 0, tasks: [], taskQueue: [], terminals: [{ ...PRIMARY_TERMINAL }],
  completedTasks: 0, level: 3, completedArchitectureTasks: 0, reasoningUnlocked: false, fastModeUnlocked: false,
  mercuryOwned: false, mercuryEnabled: false, mercuryUpgraded: false, tokenAutoBuy: false, tokenPacks: 10, market: null,
  socialPosts: [], nextTaskId: 1, nextTaskAt: 0, welcomeReacted: false, messages: [], failure: null,
  expectation: 0.2, rng: 1, socialRng: 1, secondJob: null, secondJobUnlocked: false, secondJobApplications: 0,
  secondJobOffer: null, advancedModelAnnouncedAt: null, advancedModelUnlocked: false, frontierModelUnlocked: false,
  frontierUnlockedAt: null, monopolyAnnouncedAt: null,
  sparkAnnouncedAt: null, sparkPurchasedAt: null, sparkDeliveryAt: null,
  sparkUltraAnnouncedAt: null, sparkUltraPurchasedAt: null, sparkUltraDeliveryAt: null,
  taskBags: { standard: [], architecture: [] }, lastTaskBlueprint: { standard: null, architecture: null },
  shortsUnlocked: false, inactivityElapsed: 0, inactivityDecay: 1,
  lossReason: null,
}

function getTerminal(state: Pick<GameState, 'terminals'>, terminalId: TerminalId): TerminalState | undefined {
  return state.terminals.find((terminal) => terminal.id === terminalId)
}
function isTerminalId(value: string): value is TerminalId {
  return value === 'terminal' || value === 'terminal-2' || value === 'spark' || value === 'spark-ultra'
}
export function isLocalTerminal(id: TerminalId): boolean {
  return id === 'spark' || id === 'spark-ultra'
}
function cloudTerminalId(value: string): value is 'terminal' | 'terminal-2' {
  return value === 'terminal' || value === 'terminal-2'
}
function advanceTask(
  task: WorkTask,
  elapsed: number,
  terminals: readonly TerminalState[],
  rng: number,
  mercuryState: Pick<GameState, 'mercuryUpgraded'>,
): readonly [WorkTask, number] {
  if (task.status !== 'working') return [task, rng]
  const model = task.model ?? 'basic'
  const speed = AGENT_MODELS[model].speed * (task.fastMode ? 2 : 1) / TASK_PACING_MULTIPLIER
  const progress = Math.min(task.difficulty, roundedProgress(task.progress + speed))
  if (progress >= task.difficulty - 0.000001) {
    const completed = { ...task, progress: task.difficulty, nextApprovalAt: 0, approvalPromptKey: null }
    const successChance = taskSuccessChance(task, model, mercuryState)
    if (successChance === 1) return [{ ...completed, status: 'artifact', failedAt: null }, rng]
    const [nextRng, successRoll] = nextRandom(rng)
    return [{ ...completed, status: successRoll < successChance ? 'artifact' : 'failed', failedAt: successRoll < successChance ? null : elapsed }, nextRng]
  }
  const yolo = task.terminalId !== null && terminals.some((terminal) => terminal.id === task.terminalId && terminal.yolo)
  if (yolo) return [{ ...task, progress, nextApprovalAt: 0 }, rng]
  return [elapsed >= task.nextApprovalAt ? { ...task, progress, status: 'approval' } : { ...task, progress }, rng]
}

function updateSparkDelivery(state: GameState): GameState {
  let next = state
  if (next.sparkDeliveryAt !== null && next.sparkPurchasedAt !== null && next.elapsed >= next.sparkDeliveryAt && getTerminal(next, 'spark') === undefined) {
    next = {
      ...next,
      terminals: [...next.terminals, { id: 'spark', slots: 2, yolo: false, fastMode: false, model: 'reasoning' }],
      advancedModelAnnouncedAt: next.advancedModelAnnouncedAt ?? next.elapsed,
    }
    next = appendSocialPost(next, { id: 'spark-delivered', type: 'spark-delivered', elapsed: next.elapsed, likes: 0 })
    if (!next.socialPosts.some((post) => post.type === 'advanced-model')) {
      next = appendSocialPost(next, { id: 'advanced-model-announced', type: 'advanced-model', elapsed: next.advancedModelAnnouncedAt ?? next.elapsed, likes: 0 })
    }
  }
  if (next.sparkUltraDeliveryAt !== null && next.sparkUltraPurchasedAt !== null &&
    next.elapsed >= next.sparkUltraDeliveryAt && getTerminal(next, 'spark-ultra') === undefined) {
    next = {
      ...next,
      terminals: [...next.terminals, { id: 'spark-ultra', slots: 2, yolo: false, fastMode: false, model: 'advanced' }],
    }
    next = appendSocialPost(next, { id: 'spark-ultra-delivered', type: 'spark-ultra-delivered', elapsed: next.elapsed, likes: 0 })
  }
  return discoverShopProducts(next)
}

function taskSlotFree(state: GameState, terminalId: TerminalId, slot: number, ignoreTaskId?: number): boolean {
  return state.tasks.every((task) => task.id === ignoreTaskId || task.terminalId !== terminalId || task.slot !== slot || task.status === 'assigned')
}
function firstFreeSlot(state: GameState, terminal: TerminalState): number | null {
  for (let slot = 0; slot < terminal.slots; slot += 1) if (taskSlotFree(state, terminal.id, slot)) return slot
  return null
}
function canFundAssignedTask(state: GameState, task: WorkTask): boolean {
  if (state.mercuryOwned && state.mercuryEnabled) {
    if (state.mercuryUpgraded) return bestMercuryPlacement(state, task, false) !== null
    return state.terminals.some((terminal) => {
      const slot = firstFreeSlot(state, terminal)
      const fastMode = isLocalTerminal(terminal.id) ? false : terminal.fastMode
      return slot !== null && canFundMercuryAttempt(state, task, terminal.id)
    })
  }
  return state.terminals.some((terminal) => {
    const slot = firstFreeSlot(state, terminal)
    const fastMode = isLocalTerminal(terminal.id) ? false : terminal.fastMode
    return slot !== null && canFundTaskAttempt(state, task, fastMode, terminal.id)
  })
}
function canFundRetryTask(state: GameState, task: WorkTask): boolean {
  if (state.mercuryOwned && state.mercuryEnabled) {
    if (task.failedAt === null || state.elapsed < task.failedAt + MERCURY_RETRY_DELAY) return false
    if (state.mercuryUpgraded) return bestMercuryPlacement(state, task, true) !== null
    return task.terminalId !== null && task.slot !== null && canFundMercuryRetry(state, task)
  }
  if (task.terminalId === null || task.slot === null) return false
  const terminal = getTerminal(state, task.terminalId)
  if (terminal === undefined || task.slot < 0 || task.slot >= terminal.slots || !taskSlotFree(state, task.terminalId, task.slot, task.id)) return false
  const fastMode = isLocalTerminal(terminal.id) ? false : terminal.fastMode
  return canFundTaskAttempt(state, task, fastMode, terminal.id)
}

export function hasTokenDeficit(state: GameState): boolean {
  if (state.stage !== 'hired') return false
  if (state.tokens < TOKEN_AUTO_BUY_THRESHOLD) return true

  if (state.mercuryOwned && state.mercuryEnabled) {
    const reserved = mercuryReturnReservations(state.tasks)
    if (state.tokens < reserved) return true
    if (state.tokens - reserved < MERCURY_FORWARD_COST &&
      state.tasks.some((task) => task.status === 'artifact' && !task.mercuryAuto)) return true
  }

  let fundedState: GameState | undefined
  return state.tasks.some((task) => {
    if (task.status === 'assigned' && task.terminalId === null && task.slot === null) {
      return !canFundAssignedTask(state, task) &&
        canFundAssignedTask(fundedState ??= { ...state, tokens: Number.MAX_VALUE }, task)
    }
    if (task.status === 'failed') {
      return !canFundRetryTask(state, task) &&
        canFundRetryTask(fundedState ??= { ...state, tokens: Number.MAX_VALUE }, task)
    }
    return false
  })
}


function startTaskAttempt(state: GameState, taskIndex: number, terminalId: TerminalId, slot: number, automatic = false): GameState {
  const terminal = getTerminal(state, terminalId)
  const task = state.tasks[taskIndex]
  if (terminal === undefined || task === undefined) return state
  const local = isLocalTerminal(terminalId)
  const fastMode = local ? false : terminal.fastMode === true
  const model = terminalModel(state, terminalId)
  const cost = taskTokenCost(task, fastMode, model, local)
  const preserveAssignedReservations = !automatic
  if (!canFundTaskAttempt(state, task, fastMode, terminalId, preserveAssignedReservations) || !Number.isFinite(cost) || state.tokens < cost) return state
  let nextRng = state.rng
  let nextApprovalAt = 0
  let nextApprovalPromptKey: MessageKey | null = null
  if (!terminal.yolo) {
    const drawn = drawApprovalCheckpoint(state.rng)
    nextRng = drawn[0]
    nextApprovalAt = state.elapsed + drawn[1]
    nextApprovalPromptKey = drawn[2]
  }
  const nextTokens = state.tokens - cost
  return {
    ...state,
    tokens: nextTokens,
    watercoolerUnlocked: state.watercoolerUnlocked || nextTokens < WATERCOOLER_THRESHOLD,
    tasks: state.tasks.map((candidate, index) => index === taskIndex ? {
      ...candidate,
      terminalId,
      slot,
      startedAt: state.elapsed,
      model,
      fastMode,
      local,
      mercuryAuto: automatic,
      failedAt: null,
      attempt: candidate.attempt + 1,
      status: 'working',
      progress: candidate.status === 'failed' ? 0 : candidate.progress,
      nextApprovalAt,
      approvalPromptKey: nextApprovalPromptKey,
    } : candidate),
    rng: nextRng,
  }
}

function completeDelivery(state: GameState, task: WorkTask, forwardingCost: number): GameState {
  const job = jobFromState(state, task.jobId)
  if (job === null) return state
  const reward = taskReward(task, state.elapsed)
  const nextCompleted = job.completedTasks + 1
  const nextArchitecture = job.completedArchitectureTasks + (task.kind === 'architecture' ? 1 : 0)
  let nextLevel = job.level
  if (nextCompleted >= LEVEL_4_TASK_GATE && nextLevel < 4) nextLevel = 4
  if (state.secondJobUnlocked && nextCompleted >= LEVEL_5_TASK_GATE && nextLevel < 5) nextLevel = 5
  const remainingTasks = state.tasks.filter((candidate) => candidate.id !== task.id)
  const updated = withJob({
    ...state,
    tasks: remainingTasks,
    money: Math.round((state.money + reward) * 100) / 100,
    tokens: state.tokens - forwardingCost,
  }, task.jobId, (current) => ({
    ...current,
    completedTasks: nextCompleted,
    completedArchitectureTasks: nextArchitecture,
    level: nextLevel,
    expectation: bossExpectationAt(state.elapsed),
    nextTaskAt: remainingTasks.length === 0
      ? Math.min(current.nextTaskAt, state.elapsed + DELIVERY_ASSIGNMENT_ACCELERATION_SECONDS)
      : current.nextTaskAt,
  }))
  let delivered = appendMessage(updated, {
    id: `delivery-${task.id}`,
    type: 'delivery',
    jobId: task.jobId,
    elapsed: state.elapsed,
    task: snapshotTask(task),
    reward,
    completedTasks: nextCompleted,
  })
  if (nextCompleted === INCENTIVE_TASK_GATE) delivered = appendMessage(delivered, { id: `${task.jobId}-incentives`, type: 'incentives', jobId: task.jobId, elapsed: state.elapsed })
  if (nextLevel !== job.level && nextLevel !== 3) {
    delivered = appendMessage(delivered, { id: `${task.jobId}-promotion-${nextLevel}`, type: 'promotion', jobId: task.jobId, elapsed: state.elapsed, level: nextLevel })
  }
  if (task.jobId === 'primary') {
    delivered = {
      ...delivered,
      reasoningUnlocked: delivered.reasoningUnlocked || nextArchitecture >= 1,
      fastModeUnlocked: delivered.fastModeUnlocked || nextArchitecture >= FAST_MODE_ARCHITECTURE_GATE,
    }
  }
  return discoverShopProducts(maybeUnlockProgression(delivered))
}
function terminalWorkload(state: GameState, terminalId: TerminalId): number {
  return state.tasks.reduce((total, task) => total + Number(
    task.terminalId === terminalId && task.status !== 'assigned',
  ), 0)
}

function mercuryTerminalOrder(state: GameState, task: WorkTask): TerminalState[] {
  return [...state.terminals].sort((a, b) => {
    const workload = terminalWorkload(state, a.id) - terminalWorkload(state, b.id)
    if (workload !== 0) return workload
    const quality = taskSuccessChance(task, terminalModel(state, b.id), state) - taskSuccessChance(task, terminalModel(state, a.id), state)
    return quality !== 0 ? quality : a.id.localeCompare(b.id)
  })
}

type MercuryPlacement = {
  terminal: TerminalState
  slot: number
  model: AgentModelId
  fastMode: boolean
  local: boolean
  cost: number
  duration: number
  attempts: number
  deadlineSuccess: number
  expectedCompletion: number
  overuse: number
  load: number
}

function mercuryExecutionDuration(task: WorkTask, model: AgentModelId, fastMode: boolean): number {
  const speed = AGENT_MODELS[model].speed * (fastMode ? 2 : 1) / TASK_PACING_MULTIPLIER
  return speed > 0 && Number.isFinite(task.difficulty) ? Math.max(0, task.difficulty / speed) : Number.POSITIVE_INFINITY
}

function mercuryAttemptsUntilDeadline(duration: number, remaining: number): number {
  if (!Number.isFinite(duration) || !Number.isFinite(remaining) || duration <= 0 || remaining < duration - ENERGY_DECAY_EPSILON) return 0
  return Math.max(0, Math.floor((remaining + MERCURY_RETRY_DELAY + ENERGY_DECAY_EPSILON) / (duration + MERCURY_RETRY_DELAY)))
}

function mercuryExpectedCompletion(duration: number, chance: number, attempts: number): number {
  if (!Number.isFinite(duration) || attempts <= 0) return duration
  let survival = 1
  let expected = 0
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const completion = attempt * duration + (attempt - 1) * MERCURY_RETRY_DELAY
    expected += survival * chance * completion
    survival *= 1 - chance
  }
  const finalCompletion = attempts * duration + (attempts - 1) * MERCURY_RETRY_DELAY
  return expected + survival * finalCompletion
}

function mercuryPlacement(
  state: GameState,
  task: WorkTask,
  terminal: TerminalState,
  slot: number,
): MercuryPlacement | null {
  const local = isLocalTerminal(terminal.id)
  const fastMode = local ? false : terminal.fastMode === true
  const model = terminalModel(state, terminal.id)
  const cost = taskTokenCost(task, fastMode, model, local)
  const duration = mercuryExecutionDuration(task, model, fastMode)
  const attempts = mercuryAttemptsUntilDeadline(duration, Math.max(0, task.deadlineAt - state.elapsed))
  const chance = taskSuccessChance(task, model, state)
  const deadlineSuccess = attempts <= 0 ? 0 : 1 - (1 - chance) ** attempts
  return Number.isFinite(cost) && cost >= 0 && Number.isFinite(duration) && Number.isFinite(deadlineSuccess)
    ? {
      terminal,
      slot,
      model,
      fastMode,
      local,
      cost,
      duration,
      attempts,
      deadlineSuccess,
      expectedCompletion: mercuryExpectedCompletion(duration, chance, attempts),
      overuse: Math.max(0, AGENT_MODELS[model].intelligence - task.complexity),
      load: terminalWorkload(state, terminal.id),
    }
    : null
}

function mercuryPlacementCandidates(state: GameState, task: WorkTask, retry: boolean): MercuryPlacement[] {
  const candidates: MercuryPlacement[] = []
  for (const terminal of state.terminals) {
    for (let slot = 0; slot < terminal.slots; slot += 1) {
      if (!taskSlotFree(state, terminal.id, slot, retry ? task.id : undefined)) continue
      const placement = mercuryPlacement(state, task, terminal, slot)
      if (placement === null) continue
      const fundable = retry
        ? canFundMercuryRetryAt(state, task, terminal.id, slot)
        : canFundMercuryAttempt(state, task, terminal.id)
      if (fundable) candidates.push(placement)
    }
  }
  return candidates
}

function bestMercuryPlacement(state: GameState, task: WorkTask, retry: boolean): MercuryPlacement | null {
  const candidates = mercuryPlacementCandidates(state, task, retry)
  if (candidates.length === 0) return null
  const anyAttemptFits = candidates.some((candidate) => candidate.attempts > 0)
  candidates.sort((a, b) => {
    if (anyAttemptFits) {
      if (a.deadlineSuccess !== b.deadlineSuccess) return b.deadlineSuccess - a.deadlineSuccess
      if (a.attempts > 0 && b.attempts === 0) return -1
      if (a.attempts === 0 && b.attempts > 0) return 1
      if (a.overuse !== b.overuse) return a.overuse - b.overuse
    } else if (a.expectedCompletion !== b.expectedCompletion) {
      return a.expectedCompletion - b.expectedCompletion
    }
    if (a.expectedCompletion !== b.expectedCompletion) return a.expectedCompletion - b.expectedCompletion
    if (a.cost !== b.cost) return a.cost - b.cost
    if (a.load !== b.load) return a.load - b.load
    const terminalOrder = a.terminal.id.localeCompare(b.terminal.id)
    return terminalOrder !== 0 ? terminalOrder : a.slot - b.slot
  })
  return candidates[0] ?? null
}

function processMercuryArtifacts(state: GameState): GameState {
  let current = state
  const artifacts = current.tasks
    .filter((task) => task.status === 'artifact')
    .sort((a, b) => a.deadlineAt - b.deadlineAt || a.id - b.id)
  let reserved = mercuryReturnReservations(current.tasks)
  for (const artifact of artifacts) {
    if (current.tokens < MERCURY_FORWARD_COST) break
    if (!artifact.mercuryAuto && current.tokens - reserved < MERCURY_FORWARD_COST) continue
    const delivered = completeDelivery(current, artifact, MERCURY_FORWARD_COST)
    if (delivered === current) continue
    if (artifact.mercuryAuto) reserved -= MERCURY_FORWARD_COST
    current = delivered
  }
  return current
}

function processLegacyMercury(state: GameState): GameState {
  let current = processMercuryArtifacts(state)
  const retries = current.tasks
    .filter((task) => task.status === 'failed' && task.failedAt !== null && current.elapsed >= task.failedAt + MERCURY_RETRY_DELAY)
    .sort((a, b) => a.deadlineAt - b.deadlineAt || a.id - b.id)
  for (const task of retries) {
    if (task.terminalId === null || task.slot === null || !canFundMercuryRetry(current, task)) continue
    const taskIndex = current.tasks.findIndex((candidate) => candidate.id === task.id)
    const started = startTaskAttempt(current, taskIndex, task.terminalId, task.slot, true)
    if (started !== current) current = started
  }
  const candidates = current.tasks
    .filter((task) => task.status === 'assigned')
    .sort((a, b) => a.deadlineAt - b.deadlineAt || a.id - b.id)
  for (const task of candidates) {
    const taskIndex = current.tasks.findIndex((candidate) => candidate.id === task.id)
    const terminals = mercuryTerminalOrder(current, task)
    for (const terminal of terminals) {
      const slot = firstFreeSlot(current, terminal)
      if (slot === null || !canFundMercuryAttempt(current, task, terminal.id)) continue
      const funded = { ...current, tokens: current.tokens - MERCURY_FORWARD_COST }
      const started = startTaskAttempt(funded, taskIndex, terminal.id, slot, true)
      if (started !== funded) {
        current = started
        break
      }
    }
  }
  return current
}

function processUpgradedMercury(state: GameState): GameState {
  let current = processMercuryArtifacts(state)
  const retries = current.tasks
    .filter((task) => task.status === 'failed' && task.failedAt !== null && current.elapsed >= task.failedAt + MERCURY_RETRY_DELAY)
    .sort((a, b) => a.deadlineAt - b.deadlineAt || a.id - b.id)
  for (const task of retries) {
    const currentTask = current.tasks.find((candidate) => candidate.id === task.id)
    if (currentTask === undefined) continue
    const placement = bestMercuryPlacement(current, currentTask, true)
    if (placement === null) continue
    const taskIndex = current.tasks.findIndex((candidate) => candidate.id === task.id)
    const started = startTaskAttempt(current, taskIndex, placement.terminal.id, placement.slot, true)
    if (started !== current) current = started
  }
  const assignments = current.tasks
    .filter((task) => task.status === 'assigned')
    .sort((a, b) => a.deadlineAt - b.deadlineAt || a.id - b.id)
  for (const task of assignments) {
    const currentTask = current.tasks.find((candidate) => candidate.id === task.id)
    if (currentTask === undefined) continue
    const placement = bestMercuryPlacement(current, currentTask, false)
    if (placement === null) continue
    const taskIndex = current.tasks.findIndex((candidate) => candidate.id === task.id)
    const funded = { ...current, tokens: current.tokens - MERCURY_FORWARD_COST }
    const started = startTaskAttempt(funded, taskIndex, placement.terminal.id, placement.slot, true)
    if (started !== funded) current = started
  }
  return current
}

function processMercury(state: GameState): GameState {
  if (!state.mercuryOwned || !state.mercuryEnabled) return state
  return state.mercuryUpgraded ? processUpgradedMercury(state) : processLegacyMercury(state)
}
function autoBuyTokens(state: GameState): GameState {
  return state.stage === 'hired' && state.tokenAutoBuy && hasTokenDeficit(state)
    ? purchaseTokens(state, state.tokenPacks)
    : state
}

function deadlineFailure(state: GameState, task: WorkTask): MessageReference {
  const company = task.jobId === 'secondary' ? state.secondJob?.company : state.company
  return {
    key: 'ending.deadlineFailure',
    params: {
      title: { key: task.titleKey },
      company: company ?? { key: 'app.yourCompany' },
    },
  }
}
function unlockShorts(state: GameState): GameState {
  if (state.stage !== 'hired' || !state.mercuryOwned || state.shortsUnlocked) return state
  const unlocked = { ...state, shortsUnlocked: true }
  return state.socialInstalledAt === null ? unlocked :
    appendSocialPost(unlocked, { id: 'shorts-unlocked', type: 'shorts', elapsed: state.elapsed, likes: 0 })
}

function humanInteraction(state: GameState, energyGain = 1): GameState {
  if (state.stage !== 'hired') return state
  return {
    ...state,
    energy: Math.min(MAX_ENERGY, state.energy + energyGain),
    inactivityElapsed: 0,
    inactivityDecay: 1,
  }
}

function applyIdleTime(
  state: GameState,
  seconds: number,
  startElapsed = state.elapsed + state.tickRemainder - seconds,
): GameState {
  if (state.stage !== 'hired' || !state.mercuryOwned || !Number.isFinite(seconds) || seconds < 0) return state
  let cursor = Number.isFinite(startElapsed) ? Math.max(0, startElapsed) : Math.max(0, state.elapsed)
  let inactivityElapsed = Number.isFinite(state.inactivityElapsed) ? Math.max(0, state.inactivityElapsed) : 0
  let inactivityDecay = Number.isFinite(state.inactivityDecay) ? clamp(state.inactivityDecay, 1, INACTIVITY_MAX_DECAY) : 1
  let energy = state.energy
  let remaining = seconds
  while (remaining > ENERGY_DECAY_EPSILON || timeUntilEnergyDecay(cursor, inactivityElapsed) <= ENERGY_DECAY_EPSILON) {
    const untilDecay = timeUntilEnergyDecay(cursor, inactivityElapsed)
    if (untilDecay <= ENERGY_DECAY_EPSILON) {
      inactivityElapsed = 0
      energy = Math.max(0, energy - inactivityDecay)
      inactivityDecay = Math.min(INACTIVITY_MAX_DECAY, inactivityDecay * 2)
      if (energy <= 0) break
      continue
    }
    if (remaining <= ENERGY_DECAY_EPSILON) break
    const step = Math.min(remaining, untilDecay)
    remaining = Math.max(0, remaining - step)
    cursor += step
    inactivityElapsed += step
    if (step + ENERGY_DECAY_EPSILON >= untilDecay) {
      inactivityElapsed = 0
      energy = Math.max(0, energy - inactivityDecay)
      inactivityDecay = Math.min(INACTIVITY_MAX_DECAY, inactivityDecay * 2)
      if (energy <= 0) break
    }
  }
  const next: GameState = { ...state, energy, inactivityElapsed, inactivityDecay }
  return energy <= 0 ? lose(next, { key: 'ending.energy.body' }, 'energy') : next
}

function maybeWin(state: GameState): GameState {
  return state.stage === 'hired' && state.wonAt === null && gameNetWorth(state) >= WIN_NET_WORTH
    ? { ...state, stage: 'won', wonAt: state.elapsed, failure: null, lossReason: null }
    : state
}


function tickHired(state: GameState, seconds: number): GameState {
  if (state.stage !== 'hired' || !Number.isFinite(seconds) || seconds <= 0) return state
  let current = state
  let remaining = seconds
  while (remaining > ENERGY_DECAY_EPSILON) {
    const fraction = Number.isFinite(current.tickRemainder) ? clamp(current.tickRemainder, 0, 0.999999999) : 0
    const currentElapsed = current.elapsed + fraction
    const untilSecond = 1 - fraction
    const untilMarket = current.market === null ? untilSecond : fraction < 0.5 - ENERGY_DECAY_EPSILON ? 0.5 - fraction : untilSecond
    const untilDecay = current.mercuryOwned ? timeUntilEnergyDecay(currentElapsed, current.inactivityElapsed) : Number.POSITIVE_INFINITY
    if (untilDecay <= ENERGY_DECAY_EPSILON) {
      current = applyIdleTime(current, 0, currentElapsed)
      if (current.stage !== 'hired') return current
      continue
    }
    const step = Math.min(remaining, untilSecond, untilMarket, untilDecay)
    const wholeSecond = fraction + step >= 1 - ENERGY_DECAY_EPSILON
    remaining = Math.max(0, remaining - step)
    current = {
      ...current,
      elapsed: current.elapsed + Number(wholeSecond),
      tickRemainder: wholeSecond ? 0 : fraction + step,
    }
    if (wholeSecond) {
      current = {
        ...current,
        money: current.money + BASE_SALARY * (current.secondJob === null ? 1 : 2),
        tokens: current.elapsed % TOKEN_REFILL_INTERVAL_SECONDS === 0 ? MAX_TOKENS : current.tokens,
        expectation: bossExpectationAt(current.elapsed),
      }
      if (current.secondJob !== null) current = withJob(current, 'secondary', (job) => ({ ...job, expectation: bossExpectationAt(current.elapsed) }))
      current = discoverShopProducts(current)
      current = autoBuyTokens(current)
      current = updateSparkDelivery(current)
      const overdue = current.tasks.find((task) => current.elapsed >= task.deadlineAt)
      if (overdue !== undefined) return lose(current, deadlineFailure(current, overdue), 'deadline', overdue.jobId)
    }
    current = applyIdleTime(current, step, currentElapsed)
    if (current.stage !== 'hired') return current
    if (wholeSecond) {
      const previousTasks = current.tasks
      let nextRng = current.rng
      const advancedTasks: WorkTask[] = []
      for (const task of previousTasks) {
        const [advanced, taskRng] = advanceTask(task, current.elapsed, current.terminals, nextRng, current)
        advancedTasks.push(advanced)
        nextRng = taskRng
      }
      current = { ...current, tasks: advancedTasks, rng: nextRng }
      for (let index = 0; index < advancedTasks.length; index += 1) {
        const before = previousTasks[index]
        const after = advancedTasks[index]
        if (before?.status !== 'artifact' && after?.status === 'artifact') current = updateAssignmentArtifact(current, after)
        if (before?.status !== 'failed' && after?.status === 'failed') current = appendMessage(current, {
          id: `attempt-failed-${after.id}-${after.attempt}`, type: 'attempt-failed', jobId: after.jobId, elapsed: current.elapsed, task: snapshotTask(after),
        })
      }
      current = appendLotteryIfDue(current)
      current = maybeUnlockProgression(current)
      current = issueAvailableAssignments(current)
      current = processMercury(current)
    }
    if (current.market !== null) {
      const market = advanceMarket(current.market, current.elapsed + current.tickRemainder)
      if (market !== current.market) current = { ...current, market }
    }
    current = maybeWin(current)
    if (current.stage !== 'hired') return current
  }
  return current
}

export function upgradePrice(state: GameState, upgrade: TerminalUpgrade, terminalId: TerminalId): number | null {
  if (state.stage !== 'hired' || !isTerminalId(terminalId)) return null
  if (upgrade === 'terminal') return terminalId === 'terminal' && state.terminals.filter((terminal) => cloudTerminalId(terminal.id)).length < MAX_CLOUD_TERMINALS && getTerminal(state, 'terminal-2') === undefined ? ADDITIONAL_TERMINAL_PRICE : null
  const terminal = getTerminal(state, terminalId)
  if (terminal === undefined) return null
  if (upgrade === 'yolo') return terminal.yolo ? null : YOLO_PRICE
  if (upgrade !== 'split' || isLocalTerminal(terminalId) || terminal.slots < 1 || terminal.slots >= MAX_TERMINAL_SLOTS) return null
  const basePrice = SPLIT_PRICES[terminal.slots - 1]
  return basePrice === undefined ? null : terminalId === 'terminal-2' ? basePrice * SECONDARY_PRICE_MULTIPLIER : basePrice
}
function affordableUpgrade(state: GameState, upgrade: Exclude<TerminalUpgrade, 'terminal'>): boolean {
  if (state.stage !== 'hired' || !Number.isFinite(state.money)) return false
  return state.terminals.some((terminal) => {
    if (upgrade === 'split' && !cloudTerminalId(terminal.id)) return false
    const price = upgradePrice(state, upgrade, terminal.id)
    return price !== null && Number.isFinite(price) && state.money >= price
  })
}


function shopItemEligible(state: GameState, item: ShopItemId): boolean {
  const affordableMoney = (price: number): boolean => state.stage === 'hired' && Number.isFinite(state.money) && state.money >= price
  switch (item) {
    case 'split':
      return state.terminals.some((terminal) => cloudTerminalId(terminal.id) && terminal.slots > 1) ||
        affordableUpgrade(state, 'split')
    case 'yolo':
      return state.terminals.some((terminal) => terminal.yolo) || affordableUpgrade(state, 'yolo')
    case 'terminal': {
      const price = upgradePrice(state, 'terminal', 'terminal')
      return getTerminal(state, 'terminal-2') !== undefined || (price !== null && affordableMoney(price))
    }
    case 'fast-mode':
      return state.stage === 'hired' && state.fastModeUnlocked
    case 'spark':
      return state.sparkPurchasedAt !== null || getTerminal(state, 'spark') !== undefined || (
        state.stage === 'hired' &&
        state.market !== null &&
        state.sparkAnnouncedAt !== null &&
        state.sparkPurchasedAt === null &&
        state.elapsed >= state.sparkAnnouncedAt + 10 &&
        affordableMoney(SPARK_PRICE)
      )
    case 'spark-ultra':
      return state.sparkUltraPurchasedAt !== null || getTerminal(state, 'spark-ultra') !== undefined || (
        state.stage === 'hired' &&
        state.market !== null &&
        state.sparkUltraAnnouncedAt !== null &&
        state.sparkUltraPurchasedAt === null &&
        state.elapsed >= state.sparkUltraAnnouncedAt + 10 &&
        affordableMoney(SPARK_ULTRA_PRICE)
      )
    case 'advanced-model':
      return state.advancedModelUnlocked || (
        state.stage === 'hired' &&
        state.advancedModelAnnouncedAt !== null &&
        affordableMoney(ADVANCED_MODEL_PRICE)
      )
    case 'mercury':
      return state.mercuryOwned || (
        state.stage === 'hired' &&
        state.advancedModelUnlocked &&
        affordableMoney(MERCURY_PRICE)
      )
    case 'mercury-upgrade':
      return state.mercuryUpgraded || (
        state.stage === 'hired' &&
        state.mercuryOwned &&
        state.secondJob !== null
      )
  }
}

function discoverShopProducts(state: GameState): GameState {
  let discoveries = state.shopDiscoveries
  for (const item of SHOP_ITEM_IDS) {
    if (discoveries.includes(item) || !shopItemEligible(state, item)) continue
    if (discoveries === state.shopDiscoveries) discoveries = [...discoveries]
    discoveries.push(item)
  }
  return discoveries === state.shopDiscoveries ? state : { ...state, shopDiscoveries: discoveries }
}


function resetEmploymentPreview(state: GameState, stage: 'applying' | 'offer'): GameState {
  return {
    ...state,
    stage,
    company: stage === 'offer' ? (state.company !== null && companies.includes(state.company) ? state.company : companies[0] ?? null) : null,
    tickRemainder: 0,
    wonAt: null,
    tasks: [], taskQueue: [], terminals: [{ ...PRIMARY_TERMINAL }], completedTasks: 0, level: 3, completedArchitectureTasks: 0,
    reasoningUnlocked: false, fastModeUnlocked: false, watercoolerUnlocked: false, watercoolerRead: false, socialInstalledAt: null,
    shopDiscoveries: [],
    socialPosts: [], nextTaskAt: 0, welcomeReacted: false, messages: [], failure: null,
    secondJob: null, secondJobUnlocked: false, secondJobApplications: 0, secondJobOffer: null, advancedModelAnnouncedAt: null,
    advancedModelUnlocked: false, frontierModelUnlocked: false, frontierUnlockedAt: null, monopolyAnnouncedAt: null,
    sparkAnnouncedAt: null, sparkPurchasedAt: null, sparkDeliveryAt: null, sparkUltraAnnouncedAt: null,
    sparkUltraPurchasedAt: null, sparkUltraDeliveryAt: null, shortsUnlocked: false, inactivityElapsed: 0, inactivityDecay: 1,
    mercuryOwned: false, mercuryEnabled: false, mercuryUpgraded: false, tokenAutoBuy: false, tokenPacks: 10, market: null, lossReason: null,
    taskBags: { standard: [], architecture: [] }, lastTaskBlueprint: { standard: null, architecture: null },
  }
}

function previewHired(state: GameState): GameState {
  const company = state.company !== null && companies.includes(state.company) ? state.company : companies[0] ?? null
  return createHiredState({
    ...initialGame,
    tiroAvatar: state.tiroAvatar,
    company,
    elapsed: 0,
    rng: normalizeSeed(state.rng),
    socialRng: normalizeSeed(state.socialRng),
  })
}

function reduceGame(state: GameState, action: GameAction): GameState {
  if ((state.stage === 'lost' || state.stage === 'won') &&
    action.type !== 'reset' &&
    action.type !== 'dev-jump' &&
    !(state.stage === 'won' && action.type === 'continue-after-win')) return state
  switch (action.type) {
    case 'continue-after-win':
      return state.stage === 'won' ? { ...state, stage: 'hired' } : state
    case 'start':
      return state.stage === 'ready'
        ? { ...initialGame, stage: 'applying', tiroAvatar: avatarForSeed(action.seed), rng: normalizeSeed(action.seed), socialRng: normalizeSeed(normalizeSeed(action.seed) ^ 0x9e3779b9) }
        : state
    case 'submit': {
      if (state.stage !== 'applying' || state.energy < 3) return state
      const company = Number.isInteger(action.companyIndex) && action.companyIndex >= 0 && action.companyIndex < companies.length ? companies[action.companyIndex] ?? null : null
      if (company === null) return state
      const attempt = state.submissions + 1
      const chance = attempt >= 20 ? 1 : Math.min(1, 0.02 * 2 ** Math.max(0, attempt - 9))
      const offered = Number.isFinite(action.roll) && action.roll < chance
      return { ...state, stage: offered ? 'offer' : 'applying', submissions: attempt, company: offered ? company : null, lastResult: offered ? null : 'rejected', energy: state.energy - 3 }
    }
    case 'accept':
      return state.stage === 'offer' && state.company !== null ? createHiredState(state) : state
    case 'reset':
      return initialGame
    case 'dev-jump': {
      if (action.stage === 'ready') return initialGame
      if (action.stage === 'tiro') {
        const base = createHiredState({
          ...initialGame,
          tiroAvatar: state.tiroAvatar,
          company: state.company !== null && companies.includes(state.company) ? state.company : companies[0] ?? null,
          tokens: TIRO_PREVIEW_TOKENS,
          money: 1_000,
          rng: normalizeSeed(state.rng),
          socialRng: normalizeSeed(state.socialRng),
        })
        const tiro = { ...base, terminals: [{ ...base.terminals[0]!, slots: 2, yolo: true }] }
        return gameReducer({ ...tiro, watercoolerUnlocked: true, watercoolerRead: true }, { type: 'install-social' })
      }
      if (action.stage === 'applying') return resetEmploymentPreview(state, 'applying')
      if (action.stage === 'offer') return resetEmploymentPreview(state, 'offer')
      if (action.stage === 'shorts') {
        const preview = previewHired(state)
        const owned = appendSocialPost({
          ...preview,
          energy: 79,
          mercuryOwned: true,
          mercuryEnabled: true,
          shortsUnlocked: true,
          tasks: [],
          taskQueue: [],
          nextTaskAt: Number.MAX_SAFE_INTEGER,
        }, { id: 'mercury-owned', type: 'mercury', elapsed: 0, likes: 0 })
        return appendSocialPost(owned, { id: 'shorts-unlocked', type: 'shorts', elapsed: 0, likes: 0 })
      }
      if (action.stage === 'energy-loss') {
        const preview = previewHired(state)
        return { ...preview, stage: 'lost', energy: 0, shortsUnlocked: true, tasks: [], taskQueue: [], nextTaskAt: Number.MAX_SAFE_INTEGER, failure: { key: 'ending.energy.body' }, lossReason: 'energy' }
      }
      if (action.stage === 'won') {
        const preview = previewHired(state)
        return { ...preview, stage: 'won', wonAt: preview.elapsed, money: WIN_NET_WORTH, failure: null, lossReason: null }
      }
      if (action.stage === 'hired' ) return createHiredState({ ...state, company: state.company !== null && companies.includes(state.company) ? state.company : companies[0] ?? null })
      if (action.stage === 'market' || action.stage === 'spark' || action.stage === 'mercury' || action.stage === 'second-job' || action.stage === 'frontier' || action.stage === 'monopoly' || action.stage === 'spark-ultra') {
        let preview = previewHired(state)
        preview = {
          ...preview,
          tasks: [],
          taskQueue: [],
          messages: preview.messages.filter((message) => message.type === 'welcome'),
          nextTaskId: 1,
          nextTaskAt: 0,
          completedTasks: MARKET_TASK_GATE + 2,
          completedArchitectureTasks: MARKET_ARCHITECTURE_GATE,
          level: 4,
          reasoningUnlocked: true,
          fastModeUnlocked: true,
          market: createMarket(preview.rng, preview.elapsed),
          sparkAnnouncedAt: 0,
          money: 30_000,
          terminals: [
            { id: 'terminal', slots: 4, yolo: true, fastMode: true, model: 'reasoning' },
            { id: 'terminal-2', slots: 4, yolo: true, fastMode: true, model: 'reasoning' },
          ],
        }
        preview = gameReducer({ ...preview, watercoolerUnlocked: true, watercoolerRead: true }, { type: 'install-social' })
        preview = appendSocialPost(appendSocialPost(preview, { id: 'market-unlocked', type: 'market', elapsed: 0, likes: 0 }), { id: 'spark-announced', type: 'spark', elapsed: 0, likes: 0 })
        if (action.stage === 'market') return issueAvailableAssignments(preview)
        preview = {
          ...preview,
          elapsed: 30,
          sparkPurchasedAt: 10,
          sparkDeliveryAt: 25,
          terminals: [...preview.terminals, { id: 'spark', slots: 2, yolo: true, fastMode: false, model: 'reasoning' }],
          advancedModelAnnouncedAt: 30,
        }
        preview = appendSocialPost(appendSocialPost(preview, { id: 'spark-delivered', type: 'spark-delivered', elapsed: 30, likes: 0 }), { id: 'advanced-model-announced', type: 'advanced-model', elapsed: 30, likes: 0 })
        if (action.stage === 'spark') return issueAvailableAssignments(preview)
        preview = {
          ...preview,
          advancedModelUnlocked: true,
          mercuryOwned: true,
          mercuryEnabled: true,
          terminals: preview.terminals.map((terminal) => isLocalTerminal(terminal.id) ? terminal : { ...terminal, model: 'advanced' }),
          money: 30_000,
        }
        preview = unlockShorts(appendSocialPost(preview, { id: 'mercury-owned', type: 'mercury', elapsed: preview.elapsed, likes: 0 }))
        if (action.stage === 'mercury') return issueAvailableAssignments(preview)
        const secondary: EmploymentJob = {
          company: companies[1] ?? 'Ship It Labs',
          level: 3,
          completedTasks: 0,
          completedArchitectureTasks: 0,
          nextTaskAt: 30,
          expectation: bossExpectationAt(30),
          welcomeReacted: false,
          startedAt: 30,
        }
        preview = {
          ...preview,
          completedTasks: SECOND_JOB_TASK_GATE,
          level: 4,
          secondJob: secondary,
          secondJobUnlocked: true,
          secondJobOffer: null,
          taskQueue: [],
          tasks: [],
          nextTaskId: 1,
          nextTaskAt: 30,
        }
        preview = appendSocialPost(preview, { id: 'second-job-unlocked', type: 'second-job', elapsed: 30, likes: 0 })
        preview = appendMessage(preview, { id: 'welcome-secondary', type: 'welcome', jobId: 'secondary', elapsed: 30 })
        preview = appendFeatureAnnouncements(preview)
        if (action.stage === 'second-job') return issueAvailableAssignments(preview)
        preview = {
          ...preview,
          completedTasks: FRONTIER_TASK_GATE - 30,
          level: 5,
          tasks: [],
          taskQueue: [],
          nextTaskId: 1,
          nextTaskAt: 30,
          completedArchitectureTasks: 6,
          secondJob: {
            ...secondary,
            level: 5,
            completedTasks: 30,
            completedArchitectureTasks: 3,
          },
          frontierModelUnlocked: true,
          frontierUnlockedAt: 30,
          terminals: preview.terminals.map((terminal) => terminal.id === 'terminal' ? { ...terminal, model: 'frontier' } : terminal),
        }
        let frontierPreview = appendSocialPost(issueAvailableAssignments(preview), { id: 'frontier-model-unlocked', type: 'frontier-model', elapsed: 30, likes: 0 })
        if (action.stage === 'frontier') return frontierPreview
        const monopolyAt = frontierPreview.elapsed + MONOPOLY_DELAY_SECONDS
        frontierPreview = {
          ...frontierPreview,
          elapsed: monopolyAt,
          nextTaskAt: monopolyAt,
          secondJob: frontierPreview.secondJob === null ? null : { ...frontierPreview.secondJob, nextTaskAt: monopolyAt },
        }
        frontierPreview = appendSocialPost(frontierPreview, { id: 'monopoly-announced', type: 'monopoly', elapsed: monopolyAt, likes: 0 })
        if (action.stage === 'monopoly') return issueAvailableAssignments(frontierPreview)
        const sparkUltraAt = monopolyAt + 60
        frontierPreview = {
          ...frontierPreview,
          elapsed: sparkUltraAt,
          sparkUltraAnnouncedAt: sparkUltraAt,
          nextTaskAt: sparkUltraAt,
          secondJob: frontierPreview.secondJob === null ? null : { ...frontierPreview.secondJob, nextTaskAt: sparkUltraAt },
        }
        frontierPreview = appendSocialPost(frontierPreview, { id: 'spark-ultra-announced', type: 'spark-ultra', elapsed: sparkUltraAt, likes: 0 })
        return issueAvailableAssignments(frontierPreview)
      }
      const company = state.company !== null && companies.includes(state.company) ? state.company : companies[0]
      return lose({ ...state, company }, { key: 'ending.previewFailure', params: { company } }, 'deadline')
    }
    case 'tick':
      return tickHired(state, action.seconds)
    case 'welcome-react':
      if (state.stage !== 'hired') return state
      return withJob(state, action.jobId, (job) => ({ ...job, welcomeReacted: !job.welcomeReacted }))
    case 'start-task': {
      if (state.stage !== 'hired' || !isTerminalId(action.terminalId) || !Number.isInteger(action.slot) || action.slot < 0) return state
      const terminal = getTerminal(state, action.terminalId)
      const taskIndex = state.tasks.findIndex((task) => task.id === action.id)
      const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined
      if (terminal === undefined || action.slot >= terminal.slots || task === undefined || task.status !== 'assigned' || task.terminalId !== null || task.slot !== null || !taskSlotFree(state, action.terminalId, action.slot)) return state
      return startTaskAttempt(state, taskIndex, action.terminalId, action.slot)
    }
    case 'approve-task': {
      if (state.stage !== 'hired' || typeof action.approved !== 'boolean') return state
      const taskIndex = state.tasks.findIndex((task) => task.id === action.id)
      const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined
      if (task === undefined || (task.status !== 'approval' && task.status !== 'blocked')) return state
      if (!action.approved) {
        return { ...state, tasks: state.tasks.map((candidate, index) => index === taskIndex ? { ...candidate, status: 'blocked' } : candidate) }
      }
      if (task.terminalId !== null && state.terminals.some((terminal) => terminal.id === task.terminalId && terminal.yolo)) {
        return { ...state, tasks: state.tasks.map((candidate, index) => index === taskIndex ? { ...candidate, status: 'working', nextApprovalAt: 0, approvalPromptKey: null } : candidate) }
      }
      const [nextRng, approvalDelay, approvalPromptKey] = drawApprovalCheckpoint(state.rng)
      return {
        ...state,
        tasks: state.tasks.map((candidate, index) => index === taskIndex
          ? { ...candidate, status: 'working', nextApprovalAt: state.elapsed + approvalDelay, approvalPromptKey }
          : candidate),
        rng: nextRng,
      }
    }
    case 'deliver-task': {
      if (state.stage !== 'hired') return state
      const task = state.tasks.find((candidate) => candidate.id === action.id)
      return task === undefined || task.status !== 'artifact' ? state : maybeWin(completeDelivery(state, task, 0))
    }
    case 'buy-tokens': {
      const purchased = purchaseTokens(state, action.packs)
      return purchased === state ? state : maybeWin(humanInteraction(purchased))
    }
    case 'set-token-packs':
      return TOKEN_PACK_COUNTS.includes(action.packs) && state.tokenPacks !== action.packs
        ? { ...state, tokenPacks: action.packs }
        : state
    case 'set-token-auto-buy': {
      if (state.stage !== 'hired' || typeof action.enabled !== 'boolean' || state.tokenAutoBuy === action.enabled) return state
      const next = { ...state, tokenAutoBuy: action.enabled }
      return action.enabled ? autoBuyTokens(next) : next
    }
    case 'read-watercooler':
      return state.stage === 'hired' && state.watercoolerUnlocked && !state.watercoolerRead ? { ...state, watercoolerRead: true } : state
    case 'install-social': {
      if (state.stage !== 'hired' || !state.watercoolerUnlocked || state.socialInstalledAt !== null) return state
      const installed = { ...state, socialInstalledAt: state.elapsed, tokens: MAX_TOKENS }
      const resetCount = state.socialPosts.reduce((count, post) => count + Number(post.type === 'reset'), 1)
      const campaign = appendSocialPost(installed, { id: 'campaign', type: 'campaign', elapsed: state.elapsed, likes: 0 })
      return appendFeatureAnnouncements(appendSocialPost(campaign, { id: `reset-${resetCount}`, type: 'reset', elapsed: state.elapsed, likes: 0 }))
    }
    case 'like-reset': {
      const activeLottery = state.socialPosts.findLast((post) => post.type === 'lottery')
      if (state.stage !== 'hired' || activeLottery?.type !== 'lottery' || action.postId !== activeLottery.id) return state
      const [nextRng, successRoll] = nextRandom(state.rng)
      let liked: GameState = {
        ...state,
        rng: nextRng,
        socialPosts: state.socialPosts.map((post) => post.id === activeLottery.id ? { ...post, likes: post.likes + 1 } : post),
      }
      if (successRoll < 0.01) {
        const resetCount = state.socialPosts.reduce((count, post) => count + Number(post.type === 'reset'), 1)
        liked = appendSocialPost({ ...liked, tokens: MAX_TOKENS }, { id: `reset-${resetCount}`, type: 'reset', elapsed: state.elapsed, likes: 0 })
        liked = appendLotteryPost(liked, state.elapsed, activeLottery.lotteryVariant)
      }
      return liked
    }
    case 'set-fast-mode': {
      if (state.stage !== 'hired' || !cloudTerminalId(action.terminalId) || typeof action.enabled !== 'boolean' || !state.fastModeUnlocked) return state
      const terminal = getTerminal(state, action.terminalId)
      return terminal === undefined || terminal.fastMode === action.enabled ? state : { ...state, terminals: state.terminals.map((candidate) => candidate.id === action.terminalId ? { ...candidate, fastMode: action.enabled } : candidate) }
    }
    case 'retry-task': {
      if (state.stage !== 'hired') return state
      const taskIndex = state.tasks.findIndex((candidate) => candidate.id === action.id)
      const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined
      if (task === undefined || task.status !== 'failed' || task.terminalId === null || task.slot === null) return state
      const terminal = getTerminal(state, task.terminalId)
      if (terminal === undefined || task.slot < 0 || task.slot >= terminal.slots || !taskSlotFree(state, task.terminalId, task.slot, task.id)) return state
      return startTaskAttempt(state, taskIndex, task.terminalId, task.slot)
    }
    case 'retry-all': {
      if (state.stage !== 'hired') return state
      let current = state
      const failed = state.tasks
        .filter((task) => task.status === 'failed')
        .sort((a, b) => a.deadlineAt - b.deadlineAt || a.id - b.id)
      for (const task of failed) {
        const taskIndex = current.tasks.findIndex((candidate) => candidate.id === task.id)
        const currentTask = taskIndex >= 0 ? current.tasks[taskIndex] : undefined
        if (currentTask === undefined || currentTask.status !== 'failed' || currentTask.terminalId === null || currentTask.slot === null) continue
        const terminal = getTerminal(current, currentTask.terminalId)
        if (terminal === undefined || currentTask.slot < 0 || currentTask.slot >= terminal.slots || !taskSlotFree(current, currentTask.terminalId, currentTask.slot, currentTask.id)) continue
        const started = startTaskAttempt(current, taskIndex, currentTask.terminalId, currentTask.slot)
        if (started !== current) current = started
      }
      return current
    }
    case 'buy-upgrade': {
      const price = upgradePrice(state, action.upgrade, action.terminalId)
      if (action.source !== 'click' && action.source !== 'drag') return state
      if (price === null || !Number.isFinite(state.money) || state.money < price) return state
      let purchased: GameState
      if (action.upgrade === 'terminal') {
        purchased = {
          ...state,
          money: state.money - price,
          terminals: [...state.terminals, { id: 'terminal-2', slots: 1, yolo: false, fastMode: false, model: state.advancedModelUnlocked ? 'advanced' : state.reasoningUnlocked ? 'reasoning' : 'basic' }],
        }
      } else if (action.upgrade === 'split') {
        purchased = {
          ...state,
          money: state.money - price,
          terminals: state.terminals.map((terminal) => terminal.id === action.terminalId ? { ...terminal, slots: Math.min(MAX_TERMINAL_SLOTS, terminal.slots + 1) } : terminal),
        }
      } else {
        purchased = {
          ...state,
          money: state.money - price,
          terminals: state.terminals.map((terminal) => terminal.id === action.terminalId ? { ...terminal, yolo: true } : terminal),
          tasks: state.tasks.map((task) => task.terminalId === action.terminalId
            ? { ...task, status: task.status === 'approval' || task.status === 'blocked' ? 'working' : task.status, nextApprovalAt: 0, approvalPromptKey: null }
            : task),
        }
      }
      return maybeWin(action.source === 'click' ? humanInteraction(purchased) : purchased)
    }
    case 'buy-spark': {
      if (state.stage !== 'hired' || !Number.isFinite(state.money) || state.market === null || state.sparkAnnouncedAt === null || state.sparkPurchasedAt !== null || state.elapsed < state.sparkAnnouncedAt + 10 || state.money < SPARK_PRICE) return state
      const purchaseElapsed = state.elapsed - (state.sparkAnnouncedAt + 10)
      const delay = Math.min(60, 15 + 5 * Math.max(0, purchaseElapsed))
      return maybeWin(humanInteraction({ ...state, money: state.money - SPARK_PRICE, sparkPurchasedAt: state.elapsed, sparkDeliveryAt: state.elapsed + delay }))
    }
    case 'buy-spark-ultra': {
      if (state.stage !== 'hired' || !Number.isFinite(state.money) || state.sparkUltraAnnouncedAt === null || state.sparkUltraPurchasedAt !== null ||
        state.elapsed < state.sparkUltraAnnouncedAt + 10 || state.money < SPARK_ULTRA_PRICE) return state
      const purchaseElapsed = state.elapsed - (state.sparkUltraAnnouncedAt + 10)
      const delay = Math.min(60, 15 + 5 * Math.max(0, purchaseElapsed))
      return maybeWin(humanInteraction({ ...state, money: state.money - SPARK_ULTRA_PRICE, sparkUltraPurchasedAt: state.elapsed, sparkUltraDeliveryAt: state.elapsed + delay }))
    }
    case 'buy-model': {
      if (state.stage !== 'hired' || action.model !== 'advanced' || state.advancedModelUnlocked || state.advancedModelAnnouncedAt === null || !Number.isFinite(state.money) || state.money < ADVANCED_MODEL_PRICE) return state
      const purchased = { ...state, money: state.money - ADVANCED_MODEL_PRICE, advancedModelUnlocked: true, terminals: state.terminals.map((terminal) => isLocalTerminal(terminal.id) ? terminal : { ...terminal, model: 'advanced' as const }) }
      return maybeWin(humanInteraction(purchased))
    }
    case 'set-terminal-model':
      if (state.stage !== 'hired' || !cloudTerminalId(action.terminalId) || !state.frontierModelUnlocked || !availableModels(state, action.terminalId).includes(action.model)) return state
      return { ...state, terminals: state.terminals.map((terminal) => terminal.id === action.terminalId ? { ...terminal, model: action.model } : terminal) }
    case 'buy-mercury-upgrade': {
      if (state.stage !== 'hired' || !state.mercuryOwned || state.secondJob === null || state.mercuryUpgraded ||
        !Number.isFinite(state.money) || state.money < MERCURY_UPGRADE_PRICE) return state
      return maybeWin(humanInteraction({
        ...state,
        money: state.money - MERCURY_UPGRADE_PRICE,
        mercuryUpgraded: true,
      }))
    }
    case 'buy-mercury': {
      if (state.stage !== 'hired' || !state.advancedModelUnlocked || state.mercuryOwned || !Number.isFinite(state.money) || state.money < MERCURY_PRICE) return state
      const purchased = unlockShorts(appendSocialPost({ ...state, money: state.money - MERCURY_PRICE, mercuryOwned: true, mercuryEnabled: true }, { id: 'mercury-owned', type: 'mercury', elapsed: state.elapsed, likes: 0 }))
      return maybeWin(appendFeatureAnnouncements(humanInteraction(purchased)))
    }
    case 'set-mercury':
      return state.stage === 'hired' && state.mercuryOwned && typeof action.enabled === 'boolean' && state.mercuryEnabled !== action.enabled ? { ...state, mercuryEnabled: action.enabled } : state
    case 'submit-second-job': {
      if (state.stage !== 'hired' || !state.secondJobUnlocked || state.secondJob !== null || state.secondJobOffer !== null || state.energy < 3) return state
      const company = Number.isInteger(action.companyIndex) && action.companyIndex >= 0 && action.companyIndex < companies.length ? companies[action.companyIndex] ?? null : null
      if (company === null) return state
      const attempt = state.secondJobApplications + 1
      const chance = attempt >= 15 ? 1 : Math.min(1, 0.02 * 2 ** Math.max(0, attempt - 9))
      const offered = Number.isFinite(action.roll) && action.roll < chance
      const next = { ...state, secondJobApplications: attempt, secondJobOffer: offered ? company : null, energy: state.energy - 3 }
      return next.energy <= 0 ? lose(next, { key: 'ending.energy.body' }, 'energy') : next
    }
    case 'accept-second-job': {
      if (state.stage !== 'hired' || !state.secondJobUnlocked || state.secondJob !== null) return state
      const company = state.secondJobOffer
      if (company === null) return state
      const job: EmploymentJob = { company, level: 3, completedTasks: 0, completedArchitectureTasks: 0, nextTaskAt: state.elapsed, expectation: bossExpectationAt(state.elapsed), welcomeReacted: false, startedAt: state.elapsed }
      const accepted = appendMessage({ ...state, secondJob: job, secondJobOffer: null }, { id: 'welcome-secondary', type: 'welcome', jobId: 'secondary', elapsed: state.elapsed })
      return appendFeatureAnnouncements(issueAvailableAssignments(refillTaskQueue(accepted)))
    }
    case 'scroll-short':
      return state.stage === 'hired' && state.shortsUnlocked ? maybeWin(humanInteraction(state, SHORTS_ENERGY_GAIN)) : state
    case 'market-transfer': {
      if (state.stage !== 'hired' || state.market === null) return state
      const amount = action.amount === 'max'
        ? action.direction === 'deposit' ? state.money : state.market.usd
        : action.amount
      const result = transferMarket(state.market, state.money, action.direction, amount)
      return result.market === state.market && result.money === state.money ? state : { ...state, market: result.market, money: result.money }
    }
    case 'market-trade': {
      if (state.stage !== 'hired' || state.market === null) return state
      const nextMarket = tradeMarket(state.market, action.side, action.amount)
      if (nextMarket === state.market) return state
      const soldProfit = action.side === 'sell' && nextMarket.realizedPnl > state.market.realizedPnl
      const next = { ...state, market: nextMarket }
      return maybeWin(soldProfit ? humanInteraction(next) : next)
    }
    default:
      return state
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const discovered = discoverShopProducts(state)
  const next = reduceGame(discovered, action)
  return next === discovered ? state : discoverShopProducts(next)
}
