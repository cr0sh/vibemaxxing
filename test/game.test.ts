import { describe, expect, test } from 'bun:test'
import {
  BASE_SALARY,
  canFundMercuryRetry,
  energyDecayInterval,
  hasTokenDeficit,
  companies,
  gameNetWorth,
  gameReducer,
  initialGame,
  MAX_TOKENS,
  TOKEN_REFILL_INTERVAL_SECONDS,
  SOCIAL_LOTTERY_KEYS,
  MERCURY_FORWARD_COST,
  MERCURY_PRICE,
  MERCURY_RETRY_DELAY,
  SPARK_ULTRA_PRICE,
  WIN_NET_WORTH,
  mercuryReturnReservations,
  taskReward,
  taskTokenCost,
  type EmploymentJob,
  type GameState,
  type WorkTask,
  upgradePrice,
} from '../src/game'
import { createMarket } from '../src/trading'
function hire(seed = 12345): GameState {
  const started = gameReducer(initialGame, { type: 'start', seed })
  const offered = gameReducer(started, { type: 'submit', roll: 0, companyIndex: 0 })
  return gameReducer(offered, { type: 'accept' })
}

function taskWith(state: GameState, id: number): WorkTask {
  const task = state.tasks.find((candidate) => candidate.id === id)
  if (task === undefined) {
    throw new Error(`Task ${id} was not found`)
  }
  return task
}
function nextQueuedAssignment(state: GameState): readonly [GameState, WorkTask] {
  const next = gameReducer({ ...state, tasks: [], nextTaskAt: 0 }, { type: 'tick', seconds: 1 })
  const task = next.tasks[0]
  if (task === undefined) throw new Error('Expected a queued assignment')
  return [next, task]
}

function hireForApproval(): GameState {
  const state = hire()
  return { ...state, tasks: state.tasks.map((task) => ({ ...task, difficulty: 30, deadlineAt: 1_000 })) }
}

describe('shop product discovery', () => {
  test('reveals upgrades only at their affordability threshold', () => {
    const unavailable = gameReducer({ ...hire(), money: 199 }, { type: 'set-token-packs', packs: 1 })
    expect(unavailable.shopDiscoveries).not.toContain('split')

    const available = gameReducer({ ...hire(), money: 200 }, { type: 'set-token-packs', packs: 1 })
    expect(available.shopDiscoveries).toContain('split')
    expect(available.shopDiscoveries).not.toContain('yolo')
    expect(available.shopDiscoveries).not.toContain('terminal')
  })
  test('YOLO discovery and purchase honor the exact affordability boundary', () => {
    const belowThreshold = gameReducer({ ...hire(), money: 2_221 }, { type: 'set-token-packs', packs: 1 })
    expect(belowThreshold.shopDiscoveries).not.toContain('yolo')
    expect(gameReducer(belowThreshold, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal', source: 'click' })).toBe(belowThreshold)

    const atThreshold = gameReducer({ ...hire(), money: 2_222 }, { type: 'set-token-packs', packs: 1 })
    expect(atThreshold.shopDiscoveries).toContain('yolo')

    const purchased = gameReducer(atThreshold, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal', source: 'click' })
    expect(purchased.money).toBe(0)
    expect(purchased.terminals[0]?.yolo).toBe(true)
  })

  test('retains a discovery after the purchase spends below its threshold', () => {
    const state = gameReducer({ ...hire(), money: 200 }, { type: 'set-token-packs', packs: 1 })
    const purchased = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' })
    expect(purchased.money).toBe(0)
    expect(purchased.shopDiscoveries).toContain('split')
  })


  test('gated products stay hidden until their existing prerequisites and sale windows open', () => {
    const hired = hire()
    const beforeModel = gameReducer({ ...hired, money: 5_000 }, { type: 'set-token-packs', packs: 1 })
    expect(beforeModel.shopDiscoveries).not.toContain('advanced-model')
    expect(beforeModel.shopDiscoveries).not.toContain('mercury')

    const modelSale = gameReducer({
      ...beforeModel,
      advancedModelAnnouncedAt: 0,
      elapsed: 0,
    }, { type: 'set-token-packs', packs: 5 })
    expect(modelSale.shopDiscoveries).toContain('advanced-model')
    expect(modelSale.shopDiscoveries).not.toContain('mercury')

    const sparkBeforeSale = gameReducer({
      ...hired,
      money: 15_000,
      market: createMarket(hired.rng, 0),
      sparkAnnouncedAt: 0,
      elapsed: 9,
    }, { type: 'set-token-packs', packs: 1 })
    expect(sparkBeforeSale.shopDiscoveries).not.toContain('spark')
    const sparkOnSale = gameReducer({ ...sparkBeforeSale, elapsed: 10 }, { type: 'set-token-packs', packs: 5 })
    expect(sparkOnSale.shopDiscoveries).toContain('spark')
  })

  test('captures transient split affordability before automatic token spending in a batched tick', () => {
    const state = {
      ...hire(),
      money: 199,
      tokens: 0,
      tokenPacks: 1 as const,
      tokenAutoBuy: true,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    const ticked = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(ticked.money).toBe(199 + BASE_SALARY - 100)
    expect(ticked.tokens).toBe(100_000)
    expect(ticked.shopDiscoveries).toContain('split')
  })

  test('reset clears discoveries and dev previews include owned products', () => {
    const discovered = gameReducer({ ...hire(), money: 2_222 }, { type: 'set-token-packs', packs: 1 })
    expect(discovered.shopDiscoveries).toContain('yolo')
    expect(gameReducer(discovered, { type: 'reset' })).toBe(initialGame)

    const tiro = gameReducer(initialGame, { type: 'dev-jump', stage: 'tiro' })
    expect(tiro.shopDiscoveries).toEqual(expect.arrayContaining(['split', 'yolo', 'terminal']))
  })
  test('preserves identity for a genuine no-op with no newly eligible product', () => {
    const state = hire()
    expect(gameReducer(state, { type: 'set-token-packs', packs: 10 })).toBe(state)
  })
})

describe('job applications', () => {
  test('offer odds double after the ninth submission', () => {
    let state = gameReducer(initialGame, { type: 'start', seed: 12345 })
    for (let attempt = 1; attempt <= 9; attempt++) {
      state = gameReducer(state, { type: 'submit', roll: 0.03, companyIndex: 0 })
    }
    expect(state.stage).toBe('applying')
    expect(state.submissions).toBe(9)

    const tenth = gameReducer(state, { type: 'submit', roll: 0.039999, companyIndex: 0 })
    expect(tenth.stage).toBe('offer')
    expect(tenth.submissions).toBe(10)
  })

  test('offer odds use a strict exact-roll boundary', () => {
    const started = gameReducer(initialGame, { type: 'start', seed: 12345 })
    const atBoundary = gameReducer(started, { type: 'submit', roll: 0.02, companyIndex: 0 })
    expect(atBoundary.stage).toBe('applying')
    expect(atBoundary.submissions).toBe(1)

    const belowBoundary = gameReducer(started, {
      type: 'submit',
      roll: 0.019999,
      companyIndex: 0,
    })
    expect(belowBoundary.stage).toBe('offer')
  })

  test('offer odds follow the doubling progression through submission fourteen', () => {
    const thresholds = [
      [11, 0.079999],
      [12, 0.159999],
      [13, 0.319999],
      [14, 0.639999],
    ] as const

    for (const [attempt, roll] of thresholds) {
      let state = gameReducer(initialGame, { type: 'start', seed: 12345 })
      for (let previousAttempt = 1; previousAttempt < attempt; previousAttempt++) {
        state = gameReducer(state, { type: 'submit', roll: 0.999999, companyIndex: 0 })
      }
      const offered = gameReducer(state, { type: 'submit', roll, companyIndex: 0 })
      expect(offered.stage).toBe('offer')
      expect(offered.submissions).toBe(attempt)
    }
  })

  test('valid rolls are guaranteed an offer by submission fifteen and capped at twenty', () => {
    let state = gameReducer(initialGame, { type: 'start', seed: 12345 })
    for (let attempt = 1; attempt <= 15; attempt++) {
      state = gameReducer(state, { type: 'submit', roll: 0.999999, companyIndex: 0 })
      expect(state.energy).toBe(100 - 3 * attempt)
      expect(state.stage).toBe(attempt === 15 ? 'offer' : 'applying')
    }

    const atSubmissionTwenty = gameReducer(
      {
        ...gameReducer(initialGame, { type: 'start', seed: 12345 }),
        submissions: 19,
      },
      { type: 'submit', roll: 0.999999, companyIndex: 0 },
    )
    expect(atSubmissionTwenty.stage).toBe('offer')
    expect(atSubmissionTwenty.submissions).toBe(20)
  })
})

describe('employment transitions', () => {
  test('run avatars vary by seed and remain stable through hire and checkpoints', () => {
    const applying = gameReducer(initialGame, { type: 'start', seed: 4_242 })
    const hired = hire(4_242)
    const avatars = new Set(Array.from({ length: 32 }, (_, seed) => gameReducer(initialGame, { type: 'start', seed }).tiroAvatar))
    expect(avatars.size).toBeGreaterThan(1)
    expect(applying.tiroAvatar).toBe(hired.tiroAvatar)
    expect(gameReducer(hired, { type: 'dev-jump', stage: 'hired' }).tiroAvatar).toBe(hired.tiroAvatar)
  })

  test('background elapsed time behaves like individual ticks', () => {
    const hired = hire()
    const task = taskWith(hired, 1)
    const working = gameReducer(hired, {
      type: 'start-task',
      id: task.id,
      terminalId: 'terminal',
      slot: 0,
    })
    const batch = gameReducer(working, { type: 'tick', seconds: 20 })
    let individual = working
    for (let second = 0; second < 20; second++) {
      individual = gameReducer(individual, { type: 'tick', seconds: 1 })
    }
    expect(batch).toEqual(individual)
    expect(batch.money).toBe(20 * BASE_SALARY)
  })

  test('fractional ticks accumulate without double-paying or double-working', () => {
    let state = hire()
    state = {
      ...state,
      terminals: state.terminals.map((terminal) => ({ ...terminal, yolo: true })),
    }
    const id = taskWith(state, 1).id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    const half = gameReducer(state, { type: 'tick', seconds: 0.5 })
    expect(half.elapsed).toBe(0)
    expect(half.tickRemainder).toBe(0.5)
    expect(half.money).toBe(0)
    expect(taskWith(half, id).progress).toBe(0)
    const whole = gameReducer(half, { type: 'tick', seconds: 0.5 })
    expect(whole.elapsed).toBe(1)
    expect(whole.tickRemainder).toBe(0)
    expect(whole.money).toBe(BASE_SALARY)
    expect(whole).toEqual(gameReducer(state, { type: 'tick', seconds: 1 }))
  })

  test('token auto-buy uses the selected pack once per simulation second', () => {
    let state = { ...hire(), money: 199, tokens: 0 }
    state = gameReducer(state, { type: 'set-token-packs', packs: 1 })
    expect(state.tokenPacks).toBe(1)
    state = gameReducer(state, { type: 'set-token-auto-buy', enabled: true })
    expect(state.tokenAutoBuy).toBe(true)
    expect(state.tokens).toBe(100_000)
    expect(state.money).toBe(99)
    state = gameReducer(state, { type: 'tick', seconds: 0.5 })
    expect(state.tokens).toBe(100_000)
    expect(state.money).toBe(99)
    state = gameReducer(state, { type: 'tick', seconds: 0.5 })
    expect(state.tokens).toBe(200_000)
    expect(state.money).toBe(199 + BASE_SALARY - 200)
    const unaffordable = gameReducer({ ...state, tokens: 0 }, { type: 'tick', seconds: 1 })
    expect(unaffordable.money).toBe(state.money + BASE_SALARY)
    const off = gameReducer({ ...state, tokenAutoBuy: false, tokens: 0, money: 200 }, { type: 'tick', seconds: 1 })
    expect(off.tokens).toBe(0)
    const lost = gameReducer({ ...state, stage: 'lost', tokens: 0, money: 200 }, { type: 'tick', seconds: 1 })
    expect(lost).toEqual({ ...state, stage: 'lost', tokens: 0, money: 200 })
  })
  test('token auto-buy funds a Mercury assignment whose required reserve exceeds one million', () => {
    const base: GameState = { ...hire(), advancedModelUnlocked: true, mercuryOwned: true, mercuryEnabled: true }
    const pending: WorkTask = {
      ...hire().tasks[0]!,
      id: 990,
      difficulty: 5,
      deadlineAt: 100,
      status: 'assigned',
      terminalId: null,
      slot: null,
    }
    const state: GameState = {
      ...base,
      money: 100_000,
      tokens: 1_000_000,
      tokenAutoBuy: true,
      tokenPacks: 1,
      tasks: [pending],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
      terminals: [{ ...base.terminals[0]!, slots: 1, yolo: true, fastMode: false, model: 'advanced' }],
    }

    const started = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(started, pending.id)).toMatchObject({
      status: 'working',
      terminalId: 'terminal',
      slot: 0,
      model: 'advanced',
      mercuryAuto: true,
    })
    expect(started.tokens).toBe(300_000)
    expect(started.money).toBe(state.money + BASE_SALARY - 100)
  })

  test('token auto-buy waits for capacity before funding an assigned task', () => {
    const base: GameState = { ...hire(), advancedModelUnlocked: true, mercuryOwned: true, mercuryEnabled: true }
    const source = hire().tasks[0]!
    const occupied: WorkTask = {
      ...source,
      id: 991,
      difficulty: 5,
      deadlineAt: 100,
      status: 'working',
      startedAt: base.elapsed,
      terminalId: 'terminal',
      slot: 0,
      model: 'advanced',
      fastMode: false,
      local: false,
      mercuryAuto: false,
      failedAt: null,
      attempt: 1,
    }
    const pending: WorkTask = {
      ...source,
      id: 992,
      difficulty: 5,
      deadlineAt: 100,
      status: 'assigned',
      terminalId: null,
      slot: null,
    }
    const state: GameState = {
      ...base,
      money: 100_000,
      tokens: 1_000_000,
      tokenAutoBuy: true,
      tokenPacks: 1,
      tasks: [occupied, pending],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
      terminals: [{ ...base.terminals[0]!, slots: 1, yolo: true, fastMode: false, model: 'advanced' }],
    }

    const blocked = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(blocked, pending.id).status).toBe('assigned')
    expect(blocked.tokens).toBe(1_000_000)
    expect(blocked.money).toBe(state.money + BASE_SALARY)
  })

  test('token auto-buy funds a Mercury retry while preserving an in-flight return reserve', () => {
    const base: GameState = { ...hire(), advancedModelUnlocked: true, mercuryOwned: true, mercuryEnabled: true }
    const source = hire().tasks[0]!
    const active: WorkTask = {
      ...source,
      id: 993,
      difficulty: 5,
      deadlineAt: 100,
      status: 'working',
      startedAt: base.elapsed,
      terminalId: 'terminal-2',
      slot: 0,
      model: 'advanced',
      fastMode: false,
      local: false,
      mercuryAuto: true,
      failedAt: null,
      attempt: 1,
    }
    const failed: WorkTask = {
      ...source,
      id: 994,
      difficulty: 8,
      deadlineAt: 100,
      status: 'failed',
      startedAt: base.elapsed,
      terminalId: 'terminal',
      slot: 0,
      model: 'advanced',
      fastMode: false,
      local: false,
      mercuryAuto: true,
      failedAt: base.elapsed - MERCURY_RETRY_DELAY,
      attempt: 1,
    }
    const state: GameState = {
      ...base,
      money: 100_000,
      tokens: 1_000_000,
      tokenAutoBuy: true,
      tokenPacks: 5,
      tasks: [active, failed],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
      terminals: [
        { ...base.terminals[0]!, slots: 1, yolo: true, fastMode: false, model: 'advanced' },
        { ...base.terminals[0]!, id: 'terminal-2', slots: 1, yolo: true, fastMode: false, model: 'advanced' },
      ],
    }

    const retried = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(retried, failed.id)).toMatchObject({ status: 'working', attempt: 2, mercuryAuto: true })
    expect(taskWith(retried, active.id).status).toBe('working')
    expect(retried.tokens).toBe(700_000)
    expect(retried.money).toBe(state.money + BASE_SALARY - 500)
  })


  test('duplicate task starts and deliveries cannot spend or award twice', () => {
    let state = hire()
    const id = taskWith(state, 1).id
    const tokenCost = 100_000 * taskWith(state, id).difficulty
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    expect(state.tokens).toBe(MAX_TOKENS - tokenCost)
    for (let second = 0; second < 60 && taskWith(state, id).status !== 'artifact'; second++) {
      const task = taskWith(state, id)
      if (task.status === 'approval' || task.status === 'blocked') {
        state = gameReducer(state, { type: 'approve-task', id, approved: true })
      }
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(taskWith(state, id).status).toBe('artifact')
    const reward = taskReward(taskWith(state, id), state.elapsed)
    const moneyBeforeDelivery = state.money
    const assignmentMessage = state.messages.find((message) => message.type === 'assignment' && message.task.id === id)
    if (assignmentMessage === undefined || assignmentMessage.type !== 'assignment') {
      throw new Error('The completed assignment message was missing')
    }
    expect(assignmentMessage.artifact).toMatchObject({ id, status: 'artifact' })
    state = gameReducer(state, { type: 'deliver-task', id })
    expect(state.completedTasks).toBe(1)
    expect(state.money).toBe(moneyBeforeDelivery + reward)
    const delivered = state
    const deliveryMessages = delivered.messages.filter((message) => message.type === 'delivery')
    expect(deliveryMessages).toHaveLength(1)
    state = gameReducer(state, { type: 'deliver-task', id })
    expect(state.completedTasks).toBe(1)
    expect(state.money).toBe(delivered.money)
    expect(state.tokens).toBe(delivered.tokens)
    expect(state.messages).toEqual(delivered.messages)
  })

  test('employment messages keep assignment snapshots and attach completed artifacts in place', () => {
    let state = hire()
    const assignment = state.messages.find((message) => message.type === 'assignment')
    if (assignment === undefined || assignment.type !== 'assignment') {
      throw new Error('The initial assignment message was missing')
    }
    expect(assignment.artifact).toBeNull()
    const assignmentSnapshot = structuredClone(assignment.task)
    const id = assignment.task.id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    state = { ...state, nextTaskAt: 1_000 }
    for (let second = 0; second < 60 && taskWith(state, id).status !== 'artifact'; second++) {
      const task = taskWith(state, id)
      if (task.status === 'approval' || task.status === 'blocked') {
        state = gameReducer(state, { type: 'approve-task', id, approved: true })
      }
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    const readyAssignment = state.messages.find((message) => message.id === assignment.id)
    if (readyAssignment === undefined || readyAssignment.type !== 'assignment' || readyAssignment.artifact === null) {
      throw new Error('The completed assignment artifact was missing')
    }
    expect(state.messages.map((message) => message.type)).toEqual(['welcome', 'assignment'])
    expect(readyAssignment.task).toEqual(assignmentSnapshot)
    expect(readyAssignment.artifact).toMatchObject({
      id,
      artifactName: assignmentSnapshot.artifactName,
      status: 'artifact',
    })
    const completedTask = taskWith(state, id)
    state = gameReducer(state, { type: 'deliver-task', id })
    expect(state.messages.map((message) => message.type)).toEqual(['welcome', 'assignment', 'delivery'])
    const archivedAssignment = state.messages.find((message) => message.id === assignment.id)
    if (archivedAssignment === undefined || archivedAssignment.type !== 'assignment') {
      throw new Error('The archived assignment message was missing')
    }
    expect(archivedAssignment.task).toEqual(assignmentSnapshot)
    expect(archivedAssignment.artifact).toEqual(readyAssignment.artifact)
    const delivery = state.messages.find((message) => message.type === 'delivery')
    if (delivery === undefined || delivery.type !== 'delivery') {
      throw new Error('The delivery message was missing')
    }
    expect(delivery.reward).toBe(taskReward(completedTask, state.elapsed))
    const firstReward = delivery.reward
    const firstHistory = structuredClone(state.messages)
    state = gameReducer(state, { type: 'tick', seconds: Math.max(1, state.nextTaskAt - state.elapsed) })
    const next = state.tasks.find((task) => task.status === 'assigned')
    if (next === undefined) throw new Error('The next assignment was missing')
    state = gameReducer(state, { type: 'start-task', id: next.id, terminalId: 'terminal', slot: 0 })
    for (let second = 0; second < 60 && taskWith(state, next.id).status !== 'artifact'; second++) {
      if (taskWith(state, next.id).status === 'approval') {
        state = gameReducer(state, { type: 'approve-task', id: next.id, approved: true })
      }
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    state = gameReducer(state, { type: 'deliver-task', id: next.id })
    expect(state.messages.slice(0, firstHistory.length)).toEqual(firstHistory)
    expect(state.messages.filter((message) => message.type === 'delivery').map((message) => ({
      artifact: message.task.artifactName,
      reward: message.reward,
    }))).toEqual([
      { artifact: completedTask.artifactName, reward: firstReward },
      { artifact: next.artifactName, reward: taskReward(next, state.elapsed) },
    ])
  })

  test('declined commands pause work and can be explicitly resumed', () => {
    let state = hireForApproval()
    const id = taskWith(state, 1).id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    for (let second = 0; second < 30 && taskWith(state, id).status !== 'approval'; second++) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(taskWith(state, id).status).toBe('approval')
    state = gameReducer(state, { type: 'approve-task', id, approved: false })
    expect(taskWith(state, id).status).toBe('blocked')
    const pausedProgress = taskWith(state, id).progress
    state = gameReducer(state, { type: 'tick', seconds: 2 })
    expect(taskWith(state, id).progress).toBe(pausedProgress)
    state = gameReducer(state, { type: 'approve-task', id, approved: true })
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(state, id).progress).toBeGreaterThan(pausedProgress)
  })

  test('approval prompts stay stable at a checkpoint and reseed on resume', () => {
    let state = hireForApproval()
    const id = taskWith(state, 1).id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    const firstPrompt = taskWith(state, id).approvalPromptKey

    let ticks = 0
    while (taskWith(state, id).status !== 'approval' && ticks < 30) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
      ticks += 1
    }
    expect(taskWith(state, id).status).toBe('approval')
    expect(taskWith(state, id).approvalPromptKey).toBe(firstPrompt)

    const resumed = gameReducer(state, { type: 'approve-task', id, approved: true })

    let replay = hireForApproval()
    replay = gameReducer(replay, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    replay = gameReducer(replay, { type: 'tick', seconds: ticks })
    const replayed = gameReducer(replay, { type: 'approve-task', id, approved: true })
    expect(taskWith(replayed, id).approvalPromptKey).toBe(taskWith(resumed, id).approvalPromptKey)
  })

  test('non-YOLO work pauses at repeated approval checkpoints before completion', () => {
    let state = hireForApproval()
    const id = taskWith(state, 1).id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })

    for (let checkpoint = 0; checkpoint < 3; checkpoint += 1) {
      const resumedAt = state.elapsed
      let ticks = 0
      while (taskWith(state, id).status !== 'approval' && ticks < 7) {
        state = gameReducer(state, { type: 'tick', seconds: 1 })
        ticks += 1
      }
      const task = taskWith(state, id)
      expect(task.status).toBe('approval')
      expect(state.elapsed - resumedAt).toBeGreaterThanOrEqual(3)
      expect(state.elapsed - resumedAt).toBeLessThanOrEqual(6)
      expect(task.progress).toBeLessThan(task.difficulty)

      if (checkpoint < 2) {
        state = gameReducer(state, { type: 'approve-task', id, approved: true })
        expect(taskWith(state, id).status).toBe('working')
      }
    }
  })


  test('spent tokens remain spent until the scheduled refill boundary', () => {
    const hired = hire()
    const task = taskWith(hired, 1)
    const working = gameReducer(hired, {
      type: 'start-task',
      id: task.id,
      terminalId: 'terminal',
      slot: 0,
    })
    expect(gameReducer(working, { type: 'tick', seconds: 1 }).tokens).toBe(working.tokens)
    const beforeRefill = {
      ...working,
      elapsed: TOKEN_REFILL_INTERVAL_SECONDS - 1,
      tasks: [],
      nextTaskAt: TOKEN_REFILL_INTERVAL_SECONDS + 20,
    }
    const refilled = gameReducer(beforeRefill, { type: 'tick', seconds: 1 })
    expect(refilled.tokens).toBe(MAX_TOKENS)
  })

  test('even the shortest basic task leaves a reading window and completes without rounding drift', () => {
    const hired = hire()
    const task = { ...taskWith(hired, 1), difficulty: 3 }
    const started = gameReducer({
      ...hired,
      tasks: [task],
      nextTaskAt: 1_000,
      terminals: [{ ...hired.terminals[0]!, yolo: true }],
    }, { type: 'start-task', id: task.id, terminalId: 'terminal', slot: 0 })
    const reading = gameReducer(started, { type: 'tick', seconds: 8 })
    expect(taskWith(reading, task.id).status).toBe('working')
    const completed = gameReducer(reading, { type: 'tick', seconds: 1 })
    expect(taskWith(completed, task.id).status).toBe('artifact')
  })

  test('partial token packs charge only for received tokens and reject repeat purchases at cap', () => {
    const nearCap = { ...hire(), money: 50, tokens: MAX_TOKENS - 50_000 }
    const purchased = gameReducer(nearCap, { type: 'buy-tokens', packs: 10 })
    expect(purchased.money).toBe(0)
    expect(purchased.tokens).toBe(MAX_TOKENS)
    expect(gameReducer(purchased, { type: 'buy-tokens', packs: 10 })).toBe(purchased)
    const shortByACent = { ...nearCap, money: 49.99 }
    expect(gameReducer(shortByACent, { type: 'buy-tokens', packs: 10 })).toBe(shortByACent)
    const lastToken = gameReducer({ ...nearCap, money: 0.01, tokens: MAX_TOKENS - 1 }, { type: 'buy-tokens', packs: 1 })
    expect(lastToken.tokens).toBe(MAX_TOKENS)
    expect(lastToken.money).toBe(0)
  })
  test('missing a task deadline preserves firing evidence and stops wages', () => {
    const hired = hire()
    const task = { ...taskWith(hired, 1), deadlineAt: 5 }
    const lost = gameReducer({ ...hired, tasks: [task] }, { type: 'tick', seconds: 6 })
    expect(lost.stage).toBe('lost')
    expect(lost.tasks).toContainEqual(task)
    expect(lost.messages.at(-1)?.type).toBe('firing')
    const overdue = lost.tasks.find((candidate) => candidate.deadlineAt <= lost.elapsed)!
    expect(lost.failure).toEqual({
      key: 'ending.deadlineFailure',
      params: { title: { key: overdue.titleKey }, company: hired.company },
    })
    expect(gameReducer(lost, { type: 'tick', seconds: 100 })).toEqual(lost)
  })
  test('task-free employment remains active when the player keeps scrolling Shorts', () => {
    let longRunning: GameState = {
      ...hire(),
      mercuryOwned: true,
      mercuryEnabled: false,
      tasks: [],
      taskQueue: [],
      nextTaskAt: 1_000_000,
      shortsUnlocked: true,
    }
    for (let second = 0; second < 10_000; second += 2) {
      longRunning = gameReducer(longRunning, { type: 'tick', seconds: 2 })
      longRunning = gameReducer(longRunning, { type: 'scroll-short' })
    }
    expect(longRunning.stage).toBe('hired')
    expect(longRunning.failure).toBeNull()
    expect(longRunning.elapsed).toBe(10_000)
    expect(longRunning.money).toBe(10_000 * BASE_SALARY)
    expect(longRunning.tasks).toHaveLength(0)
  })

})

describe('terminal upgrades and concurrent work', () => {
  test('rejects an occupied slot without charging a second task', () => {
    let state = hire()
    state = {
      ...state,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
      money: 200,
    }
    state = gameReducer(state, { type: 'tick', seconds: state.nextTaskAt - state.elapsed })
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'drag' })
    const first = taskWith(state, 1)
    const second = taskWith(state, 2)
    state = gameReducer(state, {
      type: 'start-task',
      id: first.id,
      terminalId: 'terminal',
      slot: 0,
    })
    const before = state.tokens
    const occupied = gameReducer(state, {
      type: 'start-task',
      id: second.id,
      terminalId: 'terminal',
      slot: 0,
    })
    expect(occupied.tokens).toBe(before)
    expect(taskWith(occupied, second.id).status).toBe('assigned')
    expect(taskWith(occupied, second.id).terminalId).toBeNull()
  })

  test('upgrade purchases are atomic, affordable, and non-repeatable', () => {
    let state = hire()
    expect(upgradePrice(state, 'split', 'terminal')).toBe(200)
    expect(upgradePrice(state, 'yolo', 'terminal')).toBe(2_222)
    expect(upgradePrice(state, 'terminal', 'terminal')).toBe(1_000)
    expect(gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' })).toEqual(state)

    state = { ...state, money: 200 }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' })
    expect(state.money).toBe(0)
    expect(state.terminals[0]?.slots).toBe(2)
    expect(upgradePrice(state, 'split', 'terminal')).toBe(400)
    expect(gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' }).money).toBe(0)
  })

  test('YOLO resumes paused work and bypasses future approval prompts without another token charge', () => {
    let state = hireForApproval()
    const id = taskWith(state, 1).id
    state = {
      ...state,
      money: 2_222,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    const chargedTokens = state.tokens
    for (let second = 0; second < 30 && taskWith(state, id).status !== 'approval'; second++) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(taskWith(state, id).status).toBe('approval')
    const moneyBeforeYolo = state.money
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal', source: 'click' })
    expect(state.money).toBe(moneyBeforeYolo - 2_222)
    expect(state.terminals[0]?.yolo).toBe(true)
    expect(taskWith(state, id).status).toBe('working')
    expect(taskWith(state, id).approvalPromptKey).toBeNull()
    expect(state.tokens).toBe(chargedTokens)

    const paused = taskWith(state, id).progress
    state = gameReducer(state, { type: 'tick', seconds: 3 })
    expect(taskWith(state, id).progress).toBeGreaterThan(paused)
    expect(taskWith(state, id).status).not.toBe('approval')
  })

  test('jobs in separate terminals progress during the same tick', () => {
    let state = hire()
    state = {
      ...state,
      money: 1_000,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'terminal', terminalId: 'terminal', source: 'click' })
    state = gameReducer(state, { type: 'tick', seconds: state.nextTaskAt - state.elapsed })
    const first = taskWith(state, 1)
    const second = taskWith(state, 2)
    state = gameReducer(state, {
      type: 'start-task',
      id: first.id,
      terminalId: 'terminal',
      slot: 0,
    })
    state = gameReducer(state, {
      type: 'start-task',
      id: second.id,
      terminalId: 'terminal-2',
      slot: 0,
    })
    const before = state.tasks.map((task) => task.progress)
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(state.tasks.find((task) => task.id === first.id)?.progress).toBeGreaterThan(before[0]!)
    expect(state.tasks.find((task) => task.id === second.id)?.progress).toBeGreaterThan(before[1]!)
  })
})

describe('hidden boss assignment inventory', () => {
  test('seeds a hidden queue and starts only funded assignments with deadlines at issue time', () => {
    const state = hire()
    expect(state.tasks).toHaveLength(1)
    expect(state.taskQueue).toHaveLength(2)
    expect(state.taskQueue.every((task) => !('deadlineAt' in task))).toBe(true)
    expect(state.tasks[0]?.deadlineAt).toBeGreaterThan(state.elapsed)
    expect(new Set([
      ...state.tasks.map((task) => task.id),
      ...state.taskQueue.map((task) => task.id),
    ]).size).toBe(3)
  })
  test('standard assignments use every catalog entry once before refilling', () => {
    const collect = (seed: number) => {
      let state = hire(seed)
      const titleKeys: string[] = []
      const seen = new Set<number>()
      const appendNewDescriptors = () => {
        for (const task of [...state.tasks, ...state.taskQueue]) {
          if (seen.has(task.id)) continue
          seen.add(task.id)
          titleKeys.push(task.titleKey)
        }
      }
      appendNewDescriptors()
      while (titleKeys.length < 17) {
        const [next] = nextQueuedAssignment(state)
        state = next
        appendNewDescriptors()
      }
      expect(new Set(titleKeys.slice(0, 16)).size).toBe(16)
      expect(titleKeys[16]).not.toBe(titleKeys[15])
      return titleKeys
    }

    const first = collect(17)
    const replay = collect(17)
    expect(replay).toEqual(first)
  })

  test('architecture assignments have their own shared shuffle bag', () => {
    let state: GameState = {
      ...hire(17),
      level: 4,
      completedArchitectureTasks: 100,
      tasks: [],
      taskQueue: [],
      nextTaskAt: 0,
    }
    const architectureTitleKeys: string[] = []
    const seen = new Set<number>()
    for (let draw = 0; draw < 80 && architectureTitleKeys.length < 9; draw += 1) {
      const [next] = nextQueuedAssignment(state)
      state = next
      for (const task of [...state.tasks, ...state.taskQueue]) {
        if (seen.has(task.id)) continue
        seen.add(task.id)
        if (task.kind === 'architecture') architectureTitleKeys.push(task.titleKey)
      }
    }
    expect(architectureTitleKeys).toHaveLength(9)
    expect(new Set(architectureTitleKeys.slice(0, 8)).size).toBe(8)
    expect(architectureTitleKeys[8]).not.toBe(architectureTitleKeys[7])
  })
  test('opening grace eases assignment and deadline before normal pacing', () => {
    const hired = hire()
    const first = taskWith(hired, 1)
    expect(hired.nextTaskAt).toBeGreaterThan(6)
    const lateDescriptor = hired.taskQueue[0]
    if (lateDescriptor === undefined) throw new Error('The boss queue was empty')
    const late = gameReducer({
      ...hired,
      elapsed: 180,
      tasks: [],
      taskQueue: [lateDescriptor],
      nextTaskAt: 180,
    }, { type: 'tick', seconds: 1 })
    expect(first.deadlineAt - first.assignedAt).toBeGreaterThan(late.tasks[0]!.deadlineAt - late.tasks[0]!.assignedAt)
  })


  test('funded assignments arrive one at a time on the boss timer and reserve tokens', () => {
    let state = { ...hire(), money: 300 }
    const first = taskWith(state, 1)
    const next = state.taskQueue[0]
    if (next === undefined) throw new Error('The boss queue was empty')
    const requiredTokens = taskTokenCost(first) + taskTokenCost(next)
    state = gameReducer(
      { ...state, tokens: requiredTokens - 1 },
      { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' },
    )
    expect(state.tasks).toHaveLength(1)
    const underfunded = state
    const unfunded = gameReducer(underfunded, { type: 'tick', seconds: underfunded.nextTaskAt - underfunded.elapsed })
    expect(unfunded.tasks).toHaveLength(1)
    const earlyPurchase = gameReducer(underfunded, { type: 'buy-tokens', packs: 1 })
    expect(earlyPurchase.tasks).toHaveLength(1)
    const duePurchase = gameReducer(unfunded, { type: 'buy-tokens', packs: 1 })
    expect(duePurchase.tasks).toHaveLength(2)
    const funded = gameReducer(
      { ...underfunded, tokens: requiredTokens },
      { type: 'tick', seconds: underfunded.nextTaskAt - underfunded.elapsed },
    )
    expect(funded.tasks).toHaveLength(2)
    expect(funded.tasks.every((task) => task.deadlineAt > funded.elapsed)).toBe(true)
  })


  test('boss pacing follows elapsed projected earnings rather than cash or hardware purchases', () => {
    const hired = hire()
    const upgraded = gameReducer({ ...hired, money: 200 }, {
      type: 'buy-upgrade',
      upgrade: 'split',
      terminalId: 'terminal',
      source: 'click',
    })
    expect(upgraded.tasks).toEqual(hired.tasks)
    expect(upgraded.taskQueue).toEqual(hired.taskQueue)
    expect(upgraded.nextTaskAt).toBe(hired.nextTaskAt)
    expect(upgraded.expectation).toBe(hired.expectation)

    const poor = gameReducer({ ...hired, money: 0 }, { type: 'tick', seconds: hired.nextTaskAt - hired.elapsed })
    const rich = gameReducer({ ...hired, money: 100_000 }, { type: 'tick', seconds: hired.nextTaskAt - hired.elapsed })
    expect(rich.tasks.map((task) => task.deadlineAt)).toEqual(poor.tasks.map((task) => task.deadlineAt))
    expect(poor.expectation).toBeGreaterThan(hired.expectation)
    expect(rich.expectation).toBe(poor.expectation)
    expect(rich.nextTaskAt).toBe(poor.nextTaskAt)
  })

  test('delivery advances a later offer without postponing an earlier or overdue offer', () => {
    for (const [scheduledAt, wait] of [[18, 1], [22, 2], [40, 15]] as const) {
      const hired = hire()
      const task = taskWith(hired, 1)
      let state: GameState = {
        ...hired,
        tasks: [{ ...task, status: 'artifact', progress: task.difficulty, startedAt: 0 }],
        elapsed: 20,
        nextTaskAt: scheduledAt,
      }
      state = gameReducer(state, { type: 'deliver-task', id: task.id })
      state = gameReducer(state, { type: 'tick', seconds: wait - 1 })
      expect(state.tasks).toHaveLength(0)
      state = gameReducer(state, { type: 'tick', seconds: 1 })
      expect(state.tasks.map((assignment) => assignment.id)).toEqual([hired.taskQueue[0]?.id])
    }
  })

  test('replays backlog generation and issue timing deterministically for the same seed', () => {
    const first = hire(17)
    const second = hire(17)
    const batch = gameReducer(first, { type: 'tick', seconds: 40 })
    let replay = second
    for (let second = 0; second < 40; second++) {
      replay = gameReducer(replay, { type: 'tick', seconds: 1 })
    }
    expect(replay).toEqual(batch)
  })
})

describe('extended progression boundaries', () => {
  test('task rewards decay from assignment and stop at five percent', () => {
    const task = { baseReward: 45, assignedAt: 10 } as const
    expect(taskReward(task, 10)).toBe(45)
    expect(taskReward(task, 39)).toBe(45)
    expect(taskReward(task, 40)).toBe(40.5)
    expect(taskReward(task, 70)).toBe(36)
    expect(taskReward(task, 309)).toBe(4.5)
    expect(taskReward(task, 310)).toBe(2.25)
    expect(taskReward(task, 1_000)).toBe(2.25)
  })

  test('watercooler unlock uses a strict below-twenty-percent attempt boundary', () => {
    const hired = hire()
    const task = taskWith(hired, 1)
    const exact = gameReducer({
      ...hired,
      tokens: 2_100_000,
      tasks: [{ ...task, difficulty: 1, baseReward: 0 }],
      taskQueue: [],
      nextTaskAt: 1_000,
    }, { type: 'start-task', id: task.id, terminalId: 'terminal', slot: 0 })
    expect(exact.tokens).toBe(2_000_000)
    expect(exact.watercoolerUnlocked).toBe(false)

    const below = gameReducer({
      ...hired,
      tokens: 2_100_000,
      tasks: [{ ...task, difficulty: 2, baseReward: 0 }],
      taskQueue: [],
      nextTaskAt: 1_000,
    }, { type: 'start-task', id: task.id, terminalId: 'terminal', slot: 0 })
    expect(below.tokens).toBe(1_900_000)
    expect(below.watercoolerUnlocked).toBe(true)
  })

  test('campaign reset applies on install while lottery wins refresh the active post', () => {
    let state: GameState = {
      ...hire(), watercoolerUnlocked: true, tokens: 100,
      tasks: [], taskQueue: [], nextTaskAt: 1_000,
    }
    state = gameReducer(state, { type: 'install-social' })
    expect(state.tokens).toBe(MAX_TOKENS)
    expect(state.socialPosts.filter((post) => post.type === 'campaign')).toHaveLength(1)
    expect(state.socialPosts.filter((post) => post.type === 'reset')).toHaveLength(1)
    expect(gameReducer(state, { type: 'like-reset', postId: 'missing-lottery' })).toBe(state)
    state = gameReducer({ ...state, tokens: 100 }, { type: 'tick', seconds: 4 })
    expect(state.socialPosts.some((post) => post.type === 'lottery')).toBe(false)
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    const firstLottery = state.socialPosts.find((post) => post.type === 'lottery')
    if (firstLottery === undefined || firstLottery.type !== 'lottery') throw new Error('First lottery post was not appended')
    expect(state.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(1)

    // Seeded draws immediately below and above the one-percent boundary.
    const missed = gameReducer({ ...state, rng: 1962 }, { type: 'like-reset', postId: firstLottery.id })
    expect(missed.tokens).toBe(100)
    expect(missed.socialPosts.find((post) => post.id === firstLottery.id)?.likes).toBe(1)
    const won = gameReducer({ ...missed, rng: 978 }, { type: 'like-reset', postId: firstLottery.id })
    expect(won.tokens).toBe(MAX_TOKENS)
    expect(won.socialPosts.filter((post) => post.type === 'reset')).toHaveLength(2)
    expect(won.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(2)
    const refreshedLottery = won.socialPosts.findLast((post) => post.type === 'lottery')
    if (refreshedLottery === undefined || refreshedLottery.type !== 'lottery') throw new Error('Winning Like did not append a new lottery post')
    expect(refreshedLottery.id).not.toBe(firstLottery.id)
    expect(SOCIAL_LOTTERY_KEYS[refreshedLottery.lotteryVariant]).not.toBe(SOCIAL_LOTTERY_KEYS[firstLottery.lotteryVariant])
    expect(won.socialPosts.find((post) => post.id === firstLottery.id)?.likes).toBe(2)
    expect(refreshedLottery.likes).toBe(0)

    // Historical posts retain their likes but cannot trigger another attempt.
    expect(gameReducer(won, { type: 'like-reset', postId: firstLottery.id })).toBe(won)
    const activeMiss = gameReducer({ ...won, tokens: 100, rng: 1962 }, { type: 'like-reset', postId: refreshedLottery.id })
    expect(activeMiss.tokens).toBe(100)
    expect(activeMiss.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(2)
    expect(activeMiss.socialPosts.find((post) => post.id === refreshedLottery.id)?.likes).toBe(1)

    let waiting = { ...won, tokens: 100, shortsUnlocked: true }
    while (waiting.elapsed < TOKEN_REFILL_INTERVAL_SECONDS - 1) {
      waiting = gameReducer(waiting, { type: 'tick', seconds: Math.min(2, TOKEN_REFILL_INTERVAL_SECONDS - 1 - waiting.elapsed) })
      waiting = gameReducer(waiting, { type: 'scroll-short' })
    }
    expect(waiting.tokens).toBe(100)
    const refilled = gameReducer(waiting, { type: 'tick', seconds: 1 })
    expect(refilled.tokens).toBe(MAX_TOKENS)
    expect(refilled.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(2)
  })

  test('architecture frequency rises by delivery count but remains capped at eighty percent', () => {
    const hired = hire()
    for (const [rng, completedArchitectureTasks, kind] of [
      [18, 0, 'standard'], [18, 1, 'architecture'],
      [69, 3, 'standard'], [69, 4, 'architecture'], [194, 100, 'standard'],
    ] as const) {
      const issued = gameReducer({
        ...hired, rng, level: 4, completedArchitectureTasks,
        tasks: [], taskQueue: [], nextTaskAt: 0,
      }, { type: 'tick', seconds: 1 })
      expect(issued.tasks[0]?.kind).toBe(kind)
    }
  })

  test('architecture gets five times the standard deadline at the same difficulty', () => {
    const hired = hire()
    const descriptor = hired.taskQueue[0]!
    const issued = (architecture: boolean) => gameReducer({
      ...hired, level: 4, elapsed: 200, tasks: [], nextTaskAt: 0,
      taskQueue: [{ ...descriptor, kind: architecture ? 'architecture' : 'standard', complexity: architecture ? 2 : 1 }],
    }, { type: 'tick', seconds: 1 }).tasks[0]!
    const standard = issued(false)
    const architecture = issued(true)
    expect(architecture.deadlineAt - architecture.assignedAt).toBeCloseTo(5 * (standard.deadlineAt - standard.assignedAt), 10)
  })

  test('failed architecture retries charge again and snapshot the next attempt settings', () => {
    const hired = hire()
    const task: WorkTask = {
      ...taskWith(hired, 1),
      kind: 'architecture',
      complexity: 2,
      difficulty: 6,
      deadlineAt: 100,
    }
    let state: GameState = {
      ...hired,
      rng: 0x80000000,
      tokens: 2_000_000,
      tasks: [task],
      taskQueue: hired.taskQueue,
      nextTaskAt: 1_000,
      fastModeUnlocked: true,
      terminals: [{ ...hired.terminals[0]!, yolo: true }],
    }
    state = gameReducer(state, { type: 'start-task', id: task.id, terminalId: 'terminal', slot: 0 })
    state = gameReducer(state, { type: 'tick', seconds: 17 })
    state = gameReducer({ ...state, rng: 1 }, { type: 'tick', seconds: 1 })
    expect(taskWith(state, task.id).status).toBe('failed')
    expect(state.tokens).toBe(1_400_000)
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(state, task.id).status).toBe('failed')
    expect(state.tokens).toBe(1_400_000)

    state = gameReducer({
      ...state,
      tasks: [...state.tasks, { ...task, id: 99, status: 'artifact', model: 'basic', attempt: 1 }],
    }, { type: 'deliver-task', id: 99 })
    state = gameReducer(state, { type: 'set-fast-mode', terminalId: 'terminal', enabled: true })
    state = gameReducer(state, { type: 'retry-task', id: task.id })
    expect(state.tokens).toBe(200_000)
    expect(taskWith(state, task.id).deadlineAt).toBe(100)

    state = gameReducer(state, { type: 'set-fast-mode', terminalId: 'terminal', enabled: false })
    state = gameReducer(state, { type: 'tick', seconds: 14 })
    expect(taskWith(state, task.id).status).toBe('working')
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(state, task.id).status).toBe('artifact')
    expect(state.tokens).toBe(200_000)
    expect(state.messages.filter((message) => message.type === 'attempt-failed')).toHaveLength(1)
  })

  test('fast starts and failed retries cannot spend another assignment’s reserved tokens', () => {
    const hired = hire()
    const first: WorkTask = {
      ...taskWith(hired, 1), kind: 'architecture', complexity: 2, difficulty: 6, deadlineAt: 100,
    }
    let state: GameState = {
      ...hired,
      rng: 0x80000000,
      tokens: 1_200_000,
      tasks: [first, { ...first, id: 2 }],
      taskQueue: hired.taskQueue,
      nextTaskAt: 1_000,
      fastModeUnlocked: true,
      terminals: [{ ...hired.terminals[0]!, slots: 2, yolo: true, fastMode: true }],
    }
    expect(gameReducer(state, { type: 'start-task', id: 1, terminalId: 'terminal', slot: 0 })).toBe(state)
    state = gameReducer(state, { type: 'set-fast-mode', terminalId: 'terminal', enabled: false })
    state = gameReducer(state, { type: 'start-task', id: 1, terminalId: 'terminal', slot: 0 })
    state = gameReducer(state, { type: 'tick', seconds: 17 })
    state = gameReducer({ ...state, rng: 1 }, { type: 'tick', seconds: 1 })
    expect(taskWith(state, 1).status).toBe('failed')
    expect(gameReducer(state, { type: 'retry-task', id: 1 })).toBe(state)
    state = gameReducer(state, { type: 'start-task', id: 2, terminalId: 'terminal', slot: 1 })
    expect(taskWith(state, 2).status).toBe('working')
    expect(state.tokens).toBe(0)
  })
})
 
describe('developer previews', () => {

  test('Tiro replaces a stale loss with a usable campaign', () => {
    const hired = hire(91)
    const stale = gameReducer({
      ...hired,
      tasks: hired.tasks.map((task) => ({ ...task, deadlineAt: 1 })),
      nextTaskAt: 1_000,
    }, { type: 'tick', seconds: 1 })
    expect(stale.stage).toBe('lost')

    const tiro = gameReducer(stale, { type: 'dev-jump', stage: 'tiro' })
    expect(tiro.stage).toBe('hired')
    expect(tiro.company).toBe(hired.company)
    expect(tiro.elapsed).toBe(0)
    expect(tiro.energy).toBe(100)
    expect(tiro.tokens).toBe(MAX_TOKENS)
    expect(tiro.money).toBe(1_000)
    expect(tiro.tasks.every((task) => task.assignedAt === 0 && task.deadlineAt > 0)).toBe(true)
    expect(tiro.watercoolerUnlocked).toBe(true)
    expect(tiro.watercoolerRead).toBe(true)
    expect(tiro.completedTasks).toBe(0)
    expect(tiro.level).toBe(3)
    expect(tiro.reasoningUnlocked).toBe(false)
    expect(tiro.fastModeUnlocked).toBe(false)
    expect(tiro.socialInstalledAt).toBe(0)

    expect(tiro.socialPosts.map((post) => post.type)).toEqual(['campaign', 'reset'])
    const additionalSplit = gameReducer(tiro, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' })
    expect(additionalSplit.money).toBe(600)
    expect(additionalSplit.terminals[0]?.slots).toBe(3)
    expect(gameReducer(tiro, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal', source: 'click' })).toBe(tiro)
    const additionalTerminal = gameReducer(tiro, {
      type: 'buy-upgrade',
      upgrade: 'terminal',
      terminalId: 'terminal',
      source: 'click',
    })
    expect(additionalTerminal.money).toBe(0)
    expect(additionalTerminal.terminals).toHaveLength(2)

    const beforeLottery = gameReducer(tiro, { type: 'tick', seconds: 4 })
    expect(beforeLottery.socialPosts.some((post) => post.type === 'lottery')).toBe(false)
    const lottery = gameReducer(beforeLottery, { type: 'tick', seconds: 1 })
    expect(lottery.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(1)
  })

  test('won preview continues as a live run with its first victory recorded', () => {
    const won = gameReducer(initialGame, { type: 'dev-jump', stage: 'won' })
    expect(won.stage).toBe('won')
    expect(won.wonAt).toBe(won.elapsed)

    const continued = gameReducer(won, { type: 'continue-after-win' })
    expect(continued.stage).toBe('hired')
    expect(continued.wonAt).toBe(won.wonAt)
    const ticked = gameReducer(continued, { type: 'tick', seconds: 1 })
    expect(ticked.stage).toBe('hired')
    expect(ticked.elapsed).toBeGreaterThan(continued.elapsed)
    expect(ticked.wonAt).toBe(won.wonAt)
  })
})
 
describe('token deficit detection', () => {
  test('flags an above-threshold assignment blocked by its attempt cost and clears after funding', () => {
    const source = hire().tasks[0]!
    const pending: WorkTask = { ...source, id: 901, difficulty: 12, status: 'assigned', terminalId: null, slot: null }
    const state: GameState = { ...hire(), tokens: 1_100_000, tasks: [pending], taskQueue: [], nextTaskAt: 1_000 }

    expect(hasTokenDeficit(state)).toBe(true)
    expect(hasTokenDeficit({ ...state, tokens: 1_200_000 })).toBe(false)
  })

  test('does not confuse occupied slots, approval waits, or retry delays with token deficits', () => {
    const source = hire().tasks[0]!
    const working: WorkTask = {
      ...source,
      id: 902,
      difficulty: 12,
      status: 'working',
      terminalId: 'terminal',
      slot: 0,
      startedAt: 0,
      model: 'basic',
    }
    const pending: WorkTask = { ...source, id: 903, difficulty: 12, status: 'assigned', terminalId: null, slot: null }
    const full = { ...hire(), tokens: 1_100_000, tasks: [working, pending], taskQueue: [], nextTaskAt: 1_000 }
    expect(hasTokenDeficit(full)).toBe(false)

    const approval: WorkTask = { ...working, id: 904, status: 'approval', nextApprovalAt: 10, approvalPromptKey: 'task.approval.applyPatch' }
    expect(hasTokenDeficit({ ...full, tasks: [approval] })).toBe(false)

    const retry: WorkTask = { ...working, id: 905, status: 'failed', failedAt: 0 }
    const retryState = { ...full, mercuryOwned: true, mercuryEnabled: true, elapsed: MERCURY_RETRY_DELAY - 1, tasks: [retry] }
    expect(hasTokenDeficit(retryState)).toBe(false)
    expect(hasTokenDeficit({ ...retryState, elapsed: MERCURY_RETRY_DELAY })).toBe(true)
  })

  test('counts Mercury return reservations when they block otherwise eligible work', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const active: WorkTask = {
      ...source,
      id: 906,
      status: 'working',
      terminalId: 'terminal',
      slot: 0,
      startedAt: 0,
      model: 'advanced',
      mercuryAuto: true,
    }
    const pending: WorkTask = { ...source, id: 907, difficulty: 9, status: 'assigned', terminalId: null, slot: null }
    const terminals = base.terminals
      .filter((terminal) => terminal.id !== 'spark')
      .map((terminal) => ({ ...terminal, fastMode: false }))
    const state: GameState = {
      ...base,
      tokens: 1_700_000,
      tasks: [active, pending],
      taskQueue: [],
      terminals,
      nextTaskAt: 1_000,
    }

    expect(hasTokenDeficit(state)).toBe(true)
    expect(hasTokenDeficit({ ...state, tokens: 1_800_000 })).toBe(false)
  })

  test('warns when active return fees or a waiting handoff exceed available tokens', () => {
    const hired = hire()
    const tasks: WorkTask[] = Array.from({ length: 4 }, (_, slot) => ({
      ...hired.tasks[0]!,
      id: 910 + slot,
      status: 'working',
      terminalId: 'terminal',
      slot,
      mercuryAuto: true,
    }))
    const state = {
      ...hired, tokens: 1_100_000, mercuryOwned: true, mercuryEnabled: true, tasks,
      terminals: [{ ...hired.terminals[0]!, slots: 4 }],
    }
    expect(hasTokenDeficit(state)).toBe(true)
    expect(hasTokenDeficit({ ...state, tokens: 1_200_000 })).toBe(false)

    const handoff = { ...state, tasks: tasks.map((task, index): WorkTask =>
      index === 3 ? { ...task, status: 'artifact', mercuryAuto: false } : task) }
    expect(hasTokenDeficit(handoff)).toBe(true)
    expect(hasTokenDeficit({ ...handoff, tokens: 1_200_000 })).toBe(false)
    expect(hasTokenDeficit({ ...handoff, mercuryEnabled: false })).toBe(false)
  })
})

describe('extended engine contracts', () => {
  test('Mercury retries wait ten seconds, reserve return fees, and yield to manual retries', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const failed: WorkTask = {
      ...source,
      id: 901,
      difficulty: 3,
      complexity: 4,
      deadlineAt: 100,
      status: 'failed',
      terminalId: 'terminal',
      slot: 0,
      model: 'advanced',
      mercuryAuto: true,
      attempt: 1,
      failedAt: 0,
    }
    const retryCost = taskTokenCost(failed, base.terminals[0]!.fastMode, 'advanced')
    const waiting = {
      ...base,
      elapsed: 0,
      tokens: retryCost + MERCURY_FORWARD_COST - 1,
      tasks: [failed],
      taskQueue: [],
      nextTaskAt: 1_000,
    }
    expect(canFundMercuryRetry(waiting, failed)).toBe(false)
    const funded = { ...waiting, tokens: retryCost + MERCURY_FORWARD_COST }
    expect(canFundMercuryRetry(funded, failed)).toBe(true)
    const early = gameReducer(funded, { type: 'tick', seconds: MERCURY_RETRY_DELAY - 1 })
    expect(taskWith(early, failed.id)).toMatchObject({ status: 'failed', attempt: 1, failedAt: 0 })
    const automatic = gameReducer(early, { type: 'tick', seconds: 1 })
    expect(taskWith(automatic, failed.id)).toMatchObject({ status: 'working', attempt: 2, failedAt: null, deadlineAt: 100 })
    expect(automatic.tokens).toBe(300_000)

    const manual = gameReducer({ ...funded, elapsed: MERCURY_RETRY_DELAY - 1 }, { type: 'retry-task', id: failed.id })
    expect(taskWith(manual, failed.id)).toMatchObject({ status: 'working', attempt: 2, failedAt: null })
    expect(taskWith(gameReducer(manual, { type: 'tick', seconds: 1 }), failed.id).attempt).toBe(2)
    const disabled = gameReducer({ ...funded, mercuryEnabled: false }, { type: 'tick', seconds: 20 })
    expect(taskWith(disabled, failed.id)).toMatchObject({ status: 'failed', attempt: 1, failedAt: 0 })
  })

  test('Retry all uses current settings and leaves unaffordable failures untouched', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'frontier' })
    const failed: WorkTask = {
      ...hire().tasks[0]!,
      difficulty: 1,
      complexity: 1,
      deadlineAt: 100,
      status: 'failed',
      terminalId: 'terminal',
      slot: 0,
      model: 'frontier',
      fastMode: true,
      mercuryAuto: true,
      attempt: 1,
      failedAt: 0,
    }
    const state: GameState = {
      ...base,
      tokens: 150_000,
      tasks: [failed, { ...failed, id: failed.id + 1, slot: 1 }],
      taskQueue: [],
      nextTaskAt: 1_000,
      terminals: base.terminals.map((terminal) => terminal.id === 'terminal'
        ? { ...terminal, model: 'basic', fastMode: false }
        : terminal),
    }
    const retried = gameReducer(state, { type: 'retry-all' })
    expect(retried.tokens).toBe(50_000)
    expect(retried.tasks[0]).toMatchObject({ status: 'working', attempt: 2, model: 'basic', fastMode: false, deadlineAt: 100 })
    expect(retried.tasks[1]).toMatchObject({ status: 'failed', attempt: 1, failedAt: 0 })
    const repeated = gameReducer(retried, { type: 'retry-all' })
    expect(repeated.tokens).toBe(50_000)
    expect(repeated.tasks.map((task) => task.attempt)).toEqual([2, 1])
  })

  test('Spark purchase waits ten seconds and caps late delivery delay', () => {
    let state = gameReducer(hire(), { type: 'dev-jump', stage: 'market' })
    state = { ...state, tasks: [], taskQueue: [], nextTaskAt: 1_000 }
    expect(gameReducer(state, { type: 'buy-spark' })).toBe(state)
    state = gameReducer(state, { type: 'tick', seconds: 10 })
    const purchased = gameReducer(state, { type: 'buy-spark' })
    expect(purchased.sparkPurchasedAt).toBe(10)
    expect(purchased.sparkDeliveryAt).toBe(25)
    const late = gameReducer({ ...state, elapsed: 21, money: 20_000 }, { type: 'buy-spark' })
    expect(late.sparkDeliveryAt).toBe(81)
    const delivered = gameReducer(purchased, { type: 'tick', seconds: 15 })
    expect(delivered.terminals.find((terminal) => terminal.id === 'spark')).toMatchObject({
      id: 'spark',
      slots: 2,
      model: 'reasoning',
      fastMode: false,
    })
    expect(delivered.advancedModelAnnouncedAt).toBe(25)
  })
  test('developer previews carry the purchased progression assets for each checkpoint', () => {
    const market = gameReducer(initialGame, { type: 'dev-jump', stage: 'market' })
    expect(market.terminals).toEqual([
      { id: 'terminal', slots: 4, yolo: true, fastMode: true, model: 'reasoning' },
      { id: 'terminal-2', slots: 4, yolo: true, fastMode: true, model: 'reasoning' },
    ])
    const mercury = gameReducer(initialGame, { type: 'dev-jump', stage: 'mercury' })
    expect(mercury.advancedModelUnlocked).toBe(true)
    expect(mercury.mercuryOwned).toBe(true)
    expect(mercury.mercuryEnabled).toBe(true)
    expect(mercury.shortsUnlocked).toBe(true)
    expect(mercury.terminals.filter((terminal) => terminal.id !== 'spark').every((terminal) => terminal.model === 'advanced')).toBe(true)
    const secondJob = gameReducer(initialGame, { type: 'dev-jump', stage: 'second-job' })
    expect(secondJob.secondJob).toMatchObject({ level: 3, completedTasks: 0 })
    expect(secondJob.shortsUnlocked).toBe(true)
    const frontier = gameReducer(initialGame, { type: 'dev-jump', stage: 'frontier' })
    expect(frontier.shortsUnlocked).toBe(true)
    expect(frontier.terminals.find((terminal) => terminal.id === 'terminal')?.model).toBe('frontier')
    expect(frontier.terminals.find((terminal) => terminal.id === 'terminal-2')?.model).toBe('advanced')
    const shorts = gameReducer(initialGame, { type: 'dev-jump', stage: 'shorts' })
    expect(shorts.mercuryOwned).toBe(true)
    expect(shorts.mercuryEnabled).toBe(true)
    expect(shorts.shortsUnlocked).toBe(true)
  })
  test('Mercury purchase unlocks Shorts once while failed and repeated buys stay inert', () => {
    const spark = gameReducer(gameReducer(hire(), { type: 'dev-jump', stage: 'spark' }), { type: 'buy-model', model: 'advanced' })
    const unavailable = { ...spark, money: MERCURY_PRICE - 1 }
    expect(gameReducer(unavailable, { type: 'buy-mercury' })).toBe(unavailable)
    expect(unavailable.shortsUnlocked).toBe(false)

    const purchased = gameReducer({ ...spark, money: MERCURY_PRICE }, { type: 'buy-mercury' })
    expect(purchased.mercuryOwned).toBe(true)
    expect(purchased.mercuryEnabled).toBe(true)
    expect(purchased.shortsUnlocked).toBe(true)
    expect(purchased.money).toBe(0)
    expect(gameReducer(purchased, { type: 'buy-mercury' })).toBe(purchased)

    const locked = { ...spark, money: MERCURY_PRICE, advancedModelUnlocked: false }
    expect(gameReducer(locked, { type: 'buy-mercury' })).toBe(locked)
    expect(locked.shortsUnlocked).toBe(false)
  })

  test('local Spark attempts cost no cloud tokens and snapshot local settings', () => {
    let state = gameReducer(hire(), { type: 'dev-jump', stage: 'spark' })
    const source = hire().tasks[0]!
    const task: WorkTask = { ...source, id: 701, difficulty: 1, deadlineAt: 100, status: 'assigned' }
    state = { ...state, tokens: 0, tasks: [task, { ...task, id: 706 }], taskQueue: [], nextTaskAt: 1_000 }
    const started = gameReducer(state, { type: 'start-task', id: 701, terminalId: 'spark', slot: 0 })
    expect(started.tokens).toBe(0)
    expect(taskWith(started, 701)).toMatchObject({ local: true, model: 'reasoning', fastMode: false, attempt: 1 })
    const second = gameReducer(started, { type: 'start-task', id: 706, terminalId: 'spark', slot: 1 })
    expect(taskWith(second, 706).status).toBe('working')
    expect(second.tokens).toBe(0)
  })

  test('Mercury forwards only when the fee, attempt, and return reserve are fully funded', () => {
    const source = hire().tasks[0]!
    const assigned: WorkTask = { ...source, id: 702, difficulty: 1, deadlineAt: 100, status: 'assigned' }
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const underfunded = gameReducer({ ...base, tokens: 599_999, tasks: [assigned], taskQueue: [], nextTaskAt: 1_000 }, { type: 'tick', seconds: 1 })
    expect(taskWith(underfunded, 702).status).toBe('assigned')
    const funded = gameReducer({ ...base, tokens: 600_000, tasks: [assigned], taskQueue: [], nextTaskAt: 1_000 }, { type: 'tick', seconds: 1 })
    expect(taskWith(funded, 702)).toMatchObject({ status: 'working', attempt: 1, mercuryAuto: true })
    expect(funded.tokens).toBe(300_000)
  })

  test('Mercury drains simultaneous artifacts in deadline order before dispatching new work', () => {
    const hired = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const secondary: EmploymentJob = {
      company: companies[1]!,
      level: 3,
      completedTasks: 0,
      completedArchitectureTasks: 0,
      nextTaskAt: 1_000,
      expectation: hired.expectation,
      welcomeReacted: false,
      startedAt: 0,
    }
    const earlier: WorkTask = {
      ...source, id: 703, jobId: 'secondary', deadlineAt: 90, status: 'artifact', progress: source.difficulty,
      terminalId: 'spark', slot: 0, local: true, model: 'reasoning', mercuryAuto: true,
    }
    const later: WorkTask = {
      ...source, id: 704, deadlineAt: 100, status: 'artifact', progress: source.difficulty,
      terminalId: 'spark', slot: 1, local: true, model: 'reasoning', mercuryAuto: true,
    }
    const pending: WorkTask = { ...source, id: 705, deadlineAt: 200, status: 'assigned' }
    const state = {
      ...hired,
      secondJobUnlocked: true,
      secondJob: secondary,
      tokens: 600_000,
      tasks: [later, pending, earlier],
      taskQueue: [],
      nextTaskAt: 1_000,
    }
    const delivered = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(delivered.tasks.map((task) => task.id)).toEqual([pending.id])
    expect(delivered.tokens).toBe(0)
    expect(delivered.completedTasks).toBe(state.completedTasks + 1)
    expect(delivered.secondJob?.completedTasks).toBe(1)
    expect(delivered.messages.filter((message) => message.type === 'delivery').map((message) => message.task.id)).toEqual([earlier.id, later.id])
  })

  test('disabling Mercury releases reservations for manual work and restores safe dispatch when enabled', () => {
    const source = hire().tasks[0]!
    const assigned: WorkTask = { ...source, id: 705, difficulty: 1, deadlineAt: 100, status: 'assigned' }
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const autoStarted = gameReducer({ ...base, tokens: 600_000, tasks: [assigned], taskQueue: [], nextTaskAt: 1_000 }, { type: 'tick', seconds: 1 })
    expect(taskWith(autoStarted, assigned.id)).toMatchObject({ status: 'working', mercuryAuto: true })
    expect(autoStarted.tokens).toBe(300_000)
    const disabled = gameReducer(autoStarted, { type: 'set-mercury', enabled: false })
    const manualCandidate: WorkTask = { ...assigned, id: 706, deadlineAt: 200 }
    const manuallyStarted = gameReducer({
      ...gameReducer(disabled, { type: 'set-fast-mode', terminalId: 'terminal', enabled: false }),
      tokens: 300_000,
      tasks: [...disabled.tasks, manualCandidate],
    }, { type: 'start-task', id: manualCandidate.id, terminalId: 'terminal', slot: 0 })
    expect(taskWith(manuallyStarted, manualCandidate.id)).toMatchObject({ status: 'working', local: false, mercuryAuto: false })
    expect(manuallyStarted.tokens).toBe(200_000)
    const manualArtifact: WorkTask = { ...source, id: 707, status: 'artifact', progress: source.difficulty }
    const manuallyDelivered = gameReducer({
      ...manuallyStarted,
      tokens: 0,
      tasks: [...manuallyStarted.tasks, manualArtifact],
    }, { type: 'deliver-task', id: manualArtifact.id })
    expect(manuallyDelivered.tokens).toBe(0)
    const reenabled = gameReducer({
      ...disabled,
      tokens: 600_000,
      tasks: [...disabled.tasks, { ...assigned, id: 708, deadlineAt: 200 }],
    }, { type: 'set-mercury', enabled: true })
    const blocked = gameReducer(reenabled, { type: 'tick', seconds: 1 })
    expect(taskWith(blocked, 708).status).toBe('assigned')
    expect(blocked.tokens).toBe(600_000)
    const restored = gameReducer(blocked, { type: 'tick', seconds: 4 })
    expect(taskWith(restored, 708).status).toBe('assigned')
    expect(restored.tasks.some((task) => task.id === assigned.id)).toBe(false)
    expect(restored.tokens).toBe(300_000)
  })

  test('Mercury reserves an in-flight return fee instead of stranding its artifact', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const first: WorkTask = { ...source, id: 706, deadlineAt: 100, status: 'assigned' }
    const pending: WorkTask = { ...source, id: 707, deadlineAt: 200, status: 'assigned' }
    const started = gameReducer({ ...base, tokens: 600_000, tasks: [first, pending], taskQueue: [], nextTaskAt: 1_000 }, { type: 'tick', seconds: 1 })
    expect(taskWith(started, first.id)).toMatchObject({ status: 'working', mercuryAuto: true })
    expect(taskWith(started, pending.id).status).toBe('assigned')
    expect(started.tokens).toBe(300_000)
    const artifactState = {
      ...started,
      tasks: started.tasks.map((task) => task.id === first.id ? { ...task, status: 'artifact' as const, progress: task.difficulty } : task),
    }
    const returned = gameReducer(artifactState, { type: 'tick', seconds: 1 })
    expect(returned.tasks.map((task) => task.id)).toEqual([pending.id])
    expect(returned.completedTasks).toBe(base.completedTasks + 1)
    expect(returned.tokens).toBe(0)
  })

  test('secondary deliveries do not mutate primary employment progress', () => {
    const hired = hire()
    const source = hired.tasks[0]!
    const secondary: WorkTask = { ...source, id: 703, jobId: 'secondary', status: 'artifact', progress: source.difficulty, deadlineAt: 100 }
    const state: GameState = {
      ...hired,
      secondJobUnlocked: true,
      secondJob: {
        company: companies[1]!,
        level: 3,
        completedTasks: 0,
        completedArchitectureTasks: 0,
        nextTaskAt: 1_000,
        expectation: hired.expectation,
        welcomeReacted: false,
        startedAt: 0,
      },
      tasks: [...hired.tasks, secondary],
      nextTaskAt: 1_000,
    }
    const delivered = gameReducer(state, { type: 'deliver-task', id: 703 })
    expect(delivered.completedTasks).toBe(hired.completedTasks)
    expect(delivered.secondJob?.completedTasks).toBe(1)
    expect(delivered.messages.find((message) => message.type === 'delivery' && message.task.id === 703)).toMatchObject({ jobId: 'secondary', completedTasks: 1 })
  })
 
  test('cloud attempts retain their model snapshot after selector changes', () => {
    const source = hire().tasks[0]!
    const task: WorkTask = { ...source, id: 704, difficulty: 1, deadlineAt: 100, status: 'assigned' }
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'frontier' })
    const ready = { ...gameReducer(base, { type: 'set-fast-mode', terminalId: 'terminal', enabled: false }), tasks: [task], taskQueue: [], nextTaskAt: 1_000, tokens: 1_000_000 }
    const started = gameReducer(ready, { type: 'start-task', id: 704, terminalId: 'terminal', slot: 0 })
    expect(started.tokens).toBe(800_000)
    expect(taskWith(started, 704)).toMatchObject({ model: 'frontier', local: false })
    const changed = gameReducer(started, { type: 'set-terminal-model', terminalId: 'terminal', model: 'basic' })
    expect(taskWith(changed, 704).model).toBe('frontier')
  })

  test('disabling Mercury keeps manual forwarding free and resumes automatic forwarding when enabled', () => {
    const source = hire().tasks[0]!
    const assigned: WorkTask = { ...source, id: 705, difficulty: 1, deadlineAt: 100, status: 'assigned' }
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const disabled = gameReducer(base, { type: 'set-mercury', enabled: false })
    const waiting = gameReducer({ ...disabled, tokens: 0, tasks: [assigned], taskQueue: [], nextTaskAt: 1_000 }, { type: 'tick', seconds: 1 })
    expect(taskWith(waiting, 705).status).toBe('assigned')
    const resumed = gameReducer(waiting, { type: 'set-mercury', enabled: true })
    expect(taskWith(resumed, 705).status).toBe('assigned')
    const manuallyStarted = gameReducer(resumed, { type: 'start-task', id: 705, terminalId: 'spark', slot: 0 })
    expect(taskWith(manuallyStarted, 705).local).toBe(true)
    expect(manuallyStarted.tokens).toBe(0)
    const automaticallyStarted = gameReducer({
      ...manuallyStarted,
      tokens: 600_000,
      tasks: [...manuallyStarted.tasks, { ...assigned, id: 706 }],
    }, { type: 'tick', seconds: 1 })
    expect(taskWith(automaticallyStarted, 706).status).toBe('working')
    expect(automaticallyStarted.tokens).toBe(300_000)
  })

  test('Mercury tries an affordable cloud slot instead of stalling at an expensive one', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'frontier' })
    const task: WorkTask = { ...hire().tasks[0]!, difficulty: 5, complexity: 3, deadlineAt: 100 }
    const state: GameState = {
      ...base, tokens: 1_100_000, tasks: [task], taskQueue: [], nextTaskAt: 1_000,
      mercuryOwned: true, mercuryEnabled: true,
      terminals: [
        { id: 'terminal', slots: 1, model: 'frontier', fastMode: true, yolo: true },
        { id: 'terminal-2', slots: 1, model: 'advanced', fastMode: false, yolo: true },
      ],
    }
    const forwarded = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(forwarded, task.id)).toMatchObject({ status: 'working', terminalId: 'terminal-2' })
    expect(forwarded.tokens).toBe(300_000)
  })

  test('Mercury dispatches all affordable assignments across every terminal slot', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'frontier' })
    const source = hire().tasks[0]!
    const tasks = Array.from({ length: 6 }, (_, index) => ({
      ...source,
      id: 700 + index,
      difficulty: 1,
      deadlineAt: 100,
      status: 'assigned' as const,
      terminalId: null,
      slot: null,
    }))
    const state: GameState = {
      ...base,
      tokens: 10_000_000,
      tasks,
      taskQueue: [],
      nextTaskAt: 1_000,
      mercuryOwned: true,
      mercuryEnabled: true,
      terminals: [
        { id: 'terminal', slots: 2, model: 'advanced', fastMode: false, yolo: true },
        { id: 'terminal-2', slots: 2, model: 'advanced', fastMode: false, yolo: true },
        { id: 'spark', slots: 2, model: 'reasoning', fastMode: false, yolo: true },
      ],
    }
    const dispatched = gameReducer(state, { type: 'tick', seconds: 1 })
    const started = tasks.map((task) => taskWith(dispatched, task.id))
    expect(started.every((task) => task.status === 'working')).toBe(true)
    expect(new Set(started.map((task) => `${task.terminalId}:${task.slot}`)).size).toBe(6)
    for (const terminal of state.terminals) {
      expect(dispatched.tasks.filter((task) => task.terminalId === terminal.id)).toHaveLength(terminal.slots)
    }
  })

  test('Mercury ignores inactive assignment reservations for automatic dispatch without spending the return reserve', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const assigned = (id: number): WorkTask => ({
      ...source,
      id,
      difficulty: 1,
      deadlineAt: 100,
      status: 'assigned',
      terminalId: null,
      slot: null,
    })
    const state: GameState = {
      ...base,
      tokens: 700_000,
      tasks: [assigned(801), assigned(802)],
      taskQueue: [],
      nextTaskAt: 1_000,
      sparkDeliveryAt: null,
      terminals: [
        { id: 'terminal', slots: 1, model: 'advanced', fastMode: false, yolo: true },
        { id: 'terminal-2', slots: 1, model: 'advanced', fastMode: false, yolo: true },
      ],
    }
    const forwarded = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(taskWith(forwarded, 801)).toMatchObject({ status: 'working', terminalId: 'terminal', slot: 0, mercuryAuto: true })
    expect(taskWith(forwarded, 802).status).toBe('assigned')
    expect(forwarded.tokens).toBe(300_000)
    expect(mercuryReturnReservations(forwarded.tasks)).toBe(MERCURY_FORWARD_COST)
  })

  test('Mercury balances pending work across mixed-cost terminals before reusing the best lane', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'frontier' })
    const source = hire().tasks[0]!
    const tasks = Array.from({ length: 5 }, (_, index) => ({
      ...source,
      id: 810 + index,
      difficulty: 11,
      complexity: 4,
      deadlineAt: 1_000,
      status: 'assigned' as const,
      terminalId: null,
      slot: null,
    }))
    const state: GameState = {
      ...base,
      tokens: MAX_TOKENS,
      tasks,
      taskQueue: [],
      nextTaskAt: 1_000,
      secondJob: null,
      terminals: [
        { id: 'terminal', slots: 4, model: 'frontier', fastMode: true, yolo: true },
        { id: 'terminal-2', slots: 4, model: 'advanced', fastMode: false, yolo: true },
        { id: 'spark', slots: 2, model: 'reasoning', fastMode: false, yolo: true },
      ],
    }
    const dispatched = gameReducer(state, { type: 'tick', seconds: 1 })
    const started = tasks.map((task) => taskWith(dispatched, task.id))
    expect(started.every((task) => task.status === 'working')).toBe(true)
    expect(new Set(started.map((task) => task.terminalId))).toEqual(new Set(['terminal', 'terminal-2', 'spark']))
    expect(dispatched.tokens).toBe(1_900_000)
    expect(mercuryReturnReservations(dispatched.tasks)).toBe(5 * MERCURY_FORWARD_COST)
  })

  test('Mercury starts a newly issued assignment in the same simulation second', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const state: GameState = {
      ...base,
      tokens: 600_000,
      tasks: [],
      taskQueue: [],
      nextTaskAt: 0,
    }
    const forwarded = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(forwarded.tasks).toHaveLength(1)
    expect(forwarded.tasks[0]).toMatchObject({ status: 'working', terminalId: 'spark', slot: 0, mercuryAuto: true })
    expect(forwarded.tokens).toBe(MERCURY_FORWARD_COST)
  })

  test('Mercury delivers a ready artifact before spending the last forwarding fee', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const ready: WorkTask = { ...source, status: 'artifact', progress: source.difficulty, terminalId: 'spark', slot: 0, local: true, model: 'reasoning' }
    const pending: WorkTask = { ...source, id: 706 }
    const state = { ...base, tokens: 300_000, tasks: [ready, pending], taskQueue: [], nextTaskAt: 1_000 }
    const delivered = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(delivered.completedTasks).toBe(state.completedTasks + 1)
    expect(delivered.tasks.some((task) => task.id === ready.id)).toBe(false)
    expect(taskWith(delivered, pending.id).status).toBe('assigned')
    expect(delivered.tokens).toBe(0)
  })

  test('fewer deliveries preserve the promotion and architecture unlock sequence', () => {
    const hired = hire()
    const source = taskWith(hired, 1)
    const deliver = (state: GameState, id: number, architecture = false) => gameReducer({
      ...state,
      tasks: [{ ...source, id, status: 'artifact', kind: architecture ? 'architecture' : 'standard' }],
    }, { type: 'deliver-task', id })
    let state = deliver({ ...hired, completedTasks: 15 }, 1)
    expect(state.level).toBe(3)
    state = deliver(state, 2)
    expect(state.level).toBe(4)
    state = deliver(state, 3, true)
    expect(state.reasoningUnlocked).toBe(true)
    expect(state.fastModeUnlocked).toBe(false)
    state = deliver(state, 4, true)
    expect(state.fastModeUnlocked).toBe(true)
    expect(state.market).toBeNull()
    state = deliver(state, 5, true)
    expect(state.market).not.toBeNull()
  })

  test('L5 promotion is unavailable until the second career stage unlocks', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const artifact = (id: number): WorkTask => ({ ...source, id, status: 'artifact', progress: source.difficulty })
    const capped = gameReducer({
      ...base, level: 4, completedTasks: 26, secondJobUnlocked: false,
      tasks: [artifact(701)], nextTaskAt: 1_000,
    }, { type: 'deliver-task', id: 701 })
    expect(capped.level).toBe(4)
    expect(capped.secondJobUnlocked).toBe(false)
    const unlocked = gameReducer({
      ...capped, completedTasks: 32, tasks: [artifact(702)],
    }, { type: 'deliver-task', id: 702 })
    expect(unlocked.secondJobUnlocked).toBe(true)
    const promoted = gameReducer({
      ...unlocked, tasks: [artifact(703)],
    }, { type: 'deliver-task', id: 703 })
    expect(promoted.level).toBe(5)
  })

  test('a new cloud terminal does not inherit another window’s doubled token model', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'frontier' })
    const task: WorkTask = { ...hire().tasks[0]!, difficulty: 1, deadlineAt: 100 }
    const purchased = gameReducer({
      ...base, tasks: [task], tokens: 1_000_000,
      terminals: [{ id: 'terminal', slots: 1, model: 'frontier', fastMode: false, yolo: true }],
    }, { type: 'buy-upgrade', upgrade: 'terminal', terminalId: 'terminal', source: 'click' })
    const started = gameReducer(purchased, { type: 'start-task', id: task.id, terminalId: 'terminal-2', slot: 0 })
    expect(taskWith(started, task.id).model).toBe('advanced')
    expect(started.tokens).toBe(900_000)
  })
  test('energy decay intervals interpolate continuously across their anchors', () => {
    expect(energyDecayInterval({ elapsed: 0 })).toBe(20)
    expect(energyDecayInterval({ elapsed: 300 })).toBe(15)
    expect(energyDecayInterval({ elapsed: 600 })).toBe(10)
    expect(energyDecayInterval({ elapsed: 1_200 })).toBe(7.5)
    expect(energyDecayInterval({ elapsed: 1_800 })).toBe(5)
    expect(energyDecayInterval({ elapsed: 2_000 })).toBe(5)
  })


  test('energy stays untouched before Mercury across large and fractional ticks', () => {
    let state: GameState = {
      ...hire(),
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    for (const seconds of [0.25, 1_000, 0.75]) {
      state = gameReducer(state, { type: 'tick', seconds })
    }
    expect(state.stage).toBe('hired')
    expect(state.energy).toBe(100)
    expect(state.inactivityElapsed).toBe(0)
    expect(state.inactivityDecay).toBe(1)
  })

  test('deadlines still fire before Mercury is purchased', () => {
    const hired = hire()
    const overdue = { ...hired.tasks[0]!, deadlineAt: 1 }
    const state = {
      ...hired,
      tasks: [overdue],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    const lost = gameReducer(state, { type: 'tick', seconds: 2 })
    expect(lost.stage).toBe('lost')
    expect(lost.lossReason).toBe('deadline')
    expect(lost.energy).toBe(100)
    expect(lost.inactivityElapsed).toBe(0)
  })

  test('buying Mercury starts the decay timer without a pre-purchase penalty', () => {
    let state = gameReducer(hire(), { type: 'dev-jump', stage: 'spark' })
    state = gameReducer(state, { type: 'buy-model', model: 'advanced' })
    state = {
      ...state,
      energy: 80,
      money: MERCURY_PRICE,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    state = gameReducer(state, { type: 'tick', seconds: 100 })
    expect(state.energy).toBe(80)
    expect(state.inactivityElapsed).toBe(0)
    expect(state.inactivityDecay).toBe(1)
    const purchased = gameReducer(state, { type: 'buy-mercury' })
    expect(purchased.energy).toBe(81)
    expect(purchased.inactivityElapsed).toBe(0)
    expect(purchased.inactivityDecay).toBe(1)
    expect(gameReducer(purchased, { type: 'tick', seconds: 1 }).energy).toBe(81)
  })

  test('owned Mercury decays energy even when disabled', () => {
    const state: GameState = {
      ...hire(),
      mercuryOwned: true,
      mercuryEnabled: false,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    const decayed = gameReducer(state, { type: 'tick', seconds: 20 })
    expect(decayed.energy).toBe(99)
    expect(decayed.inactivityDecay).toBe(2)
  })

  test('fractional idle time crosses the dynamic decay boundary exactly once', () => {
    let state: GameState = {
      ...hire(),
      mercuryOwned: true,
      mercuryEnabled: false,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
      shortsUnlocked: true,
    }
    state = gameReducer(state, { type: 'tick', seconds: 10 })
    expect(state.energy).toBe(100)
    state = gameReducer(state, { type: 'tick', seconds: 9.6 })
    expect(state.energy).toBe(100)
    state = gameReducer(state, { type: 'tick', seconds: 0.4 })
    expect(state.energy).toBe(99)
    expect(state.inactivityDecay).toBe(2)
  })

  test('crossing a pacing anchor does not move the next energy penalty earlier', () => {
    for (const [elapsed, inactivityElapsed] of [[599, 9.7], [1_799, 4.7]] as const) {
      let state: GameState = {
        ...hire(), elapsed, tickRemainder: 0.8, inactivityElapsed,
        mercuryOwned: true,
        mercuryEnabled: false,
        tasks: [], taskQueue: [], nextTaskAt: Number.MAX_SAFE_INTEGER,
      }
      state = gameReducer(state, { type: 'tick', seconds: 0.15 })
      expect(state.energy).toBe(100)
      state = gameReducer(state, { type: 'tick', seconds: 0.2 })
      expect(state.energy).toBe(99)
    }
  })

  test('bulk idle ticks match one-second ticks across a shrinking interval boundary', () => {
    const start: GameState = {
      ...hire(),
      mercuryOwned: true,
      mercuryEnabled: false,
      elapsed: 590,
      energy: 1_000,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    const bulk = gameReducer(start, { type: 'tick', seconds: 30 })
    let individual = start
    for (let second = 0; second < 30; second += 1) {
      individual = gameReducer(individual, { type: 'tick', seconds: 1 })
    }
    expect(bulk).toEqual(individual)
  })

  test('idle decay ramps, while a genuine Shorts scroll resets the ramp and timer', () => {
    let state: GameState = {
      ...hire(),
      mercuryOwned: true,
      mercuryEnabled: false,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
      shortsUnlocked: true,
    }
    state = gameReducer(state, { type: 'tick', seconds: 20 })
    expect(state.energy).toBe(99)
    state = gameReducer(state, { type: 'tick', seconds: 20 })
    expect(state.energy).toBe(97)
    state = gameReducer(state, { type: 'scroll-short' })
    expect(state.energy).toBe(100)
    state = gameReducer(state, { type: 'tick', seconds: 20 })
    expect(state.energy).toBe(99)
  })


  test('token autopurchase does not count as human interaction', () => {
    let state: GameState = {
      ...hire(),
      mercuryOwned: true,
      mercuryEnabled: false,
      elapsed: 19,
      tickRemainder: 0.5,
      inactivityElapsed: 19.5,
      money: 100,
      tokens: 0,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
    }
    state = gameReducer(state, { type: 'set-token-packs', packs: 1 })
    state = gameReducer(state, { type: 'set-token-auto-buy', enabled: true })
    expect(state.tokens).toBe(100_000)
    state = gameReducer(state, { type: 'tick', seconds: 0.5 })
    expect(state.energy).toBe(99)
  })

  test('Spark Ultra delivers on schedule and completes advanced local work without tokens', () => {
    let state = gameReducer(hire(), { type: 'dev-jump', stage: 'spark-ultra' })
    state = { ...state, tasks: [], taskQueue: [], nextTaskAt: Number.MAX_SAFE_INTEGER, secondJob: null, mercuryEnabled: false }
    expect(gameReducer(state, { type: 'buy-spark-ultra' })).toBe(state)
    state = gameReducer(state, { type: 'tick', seconds: 10 })
    const moneyBefore = state.money
    state = gameReducer(state, { type: 'buy-spark-ultra' })
    expect(moneyBefore - state.money).toBe(SPARK_ULTRA_PRICE)
    state = gameReducer(state, { type: 'tick', seconds: 14.5 })
    expect(state.terminals.some((terminal) => terminal.id === 'spark-ultra')).toBe(false)
    state = gameReducer(state, { type: 'tick', seconds: 0.5 })
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'spark-ultra', source: 'click' })
    const task: WorkTask = { ...hire().tasks[0]!, difficulty: 1, complexity: 3, deadlineAt: 1_000 }
    state = gameReducer({ ...state, tasks: [task], tokens: 0 }, { type: 'start-task', id: task.id, terminalId: 'spark-ultra', slot: 0 })
    for (let second = 0; second < 30 && taskWith(state, task.id).status !== 'artifact'; second++) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(taskWith(state, task.id).status).toBe('artifact')
    expect(state.tokens).toBe(0)
  })

  test('win pauses for acknowledgment, then continues without retriggering', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'market' })
    const state = {
      ...base,
      tasks: [],
      taskQueue: [],
      nextTaskAt: Number.MAX_SAFE_INTEGER,
      money: WIN_NET_WORTH - 100,
      market: { ...base.market!, usd: 100 },
    }
    expect(gameNetWorth(state)).toBe(WIN_NET_WORTH)
    const won = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(won.stage).toBe('won')
    expect(won.wonAt).toBe(won.elapsed)
    expect(won.lossReason).toBeNull()
    expect(gameReducer(won, { type: 'tick', seconds: 100 })).toEqual(won)

    const continued = gameReducer(won, { type: 'continue-after-win' })
    expect(continued.stage).toBe('hired')
    expect(continued.wonAt).toBe(won.wonAt)
    expect(continued.money).toBe(won.money)
    expect(continued.tasks).toEqual(won.tasks)
    expect(gameReducer(continued, { type: 'continue-after-win' })).toBe(continued)

    const acted = gameReducer({ ...continued, tokens: 0 }, { type: 'buy-tokens', packs: 1 })
    expect(acted.stage).toBe('hired')
    expect(acted.wonAt).toBe(won.wonAt)

    const belowThreshold = { ...acted, money: 0, market: null }
    expect(gameNetWorth(belowThreshold)).toBe(0)
    const reCrossed = { ...belowThreshold, money: WIN_NET_WORTH }
    expect(gameNetWorth(reCrossed)).toBe(WIN_NET_WORTH)
    const running = gameReducer(reCrossed, { type: 'tick', seconds: 1 })
    expect(running.stage).toBe('hired')
    expect(running.wonAt).toBe(won.wonAt)

    const exhausted = gameReducer({ ...running, mercuryOwned: true, mercuryEnabled: false, energy: 1, inactivityElapsed: 19 }, { type: 'tick', seconds: 1 })
    expect(exhausted.stage).toBe('lost')
    expect(gameReducer(exhausted, { type: 'continue-after-win' })).toBe(exhausted)
    expect(gameReducer(exhausted, { type: 'reset' }).wonAt).toBeNull()
    expect(gameReducer(exhausted, { type: 'dev-jump', stage: 'hired' }).wonAt).toBeNull()
  })

  test('idle energy caps each penalty at sixteen and stops the run at zero', () => {
    let state = { ...hire(), mercuryOwned: true, mercuryEnabled: false, tasks: [], taskQueue: [], nextTaskAt: Number.MAX_SAFE_INTEGER } as GameState
    state = gameReducer(state, { type: 'tick', seconds: 100 })
    expect(state.energy).toBe(69)
    expect(state.inactivityDecay).toBe(16)
    expect(state.shortsUnlocked).toBe(false)
    state = gameReducer(state, { type: 'tick', seconds: 100 })
    expect(state.stage).toBe('lost')
    expect(state.lossReason).toBe('energy')
    expect(state.energy).toBe(0)
    expect(state.shortsUnlocked).toBe(false)
    expect(gameReducer(state, { type: 'scroll-short' })).toBe(state)
  })

  test('a clicked Shop upgrade resets inactivity but an equivalent drag purchase does not', () => {
    const state = { ...hire(), mercuryOwned: true, mercuryEnabled: false, money: 1_000, energy: 80, inactivityElapsed: 19.5, inactivityDecay: 16 }
    const clicked = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'click' })
    const dragged = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal', source: 'drag' })
    expect(clicked.money).toBe(dragged.money)
    expect(gameReducer(clicked, { type: 'tick', seconds: 0.5 }).energy).toBe(81)
    expect(gameReducer(dragged, { type: 'tick', seconds: 0.5 }).energy).toBe(64)
  })

  test('a profitable BTC sale restores energy even when lifetime realized profit remains negative', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'market' })
    const state = { ...base, energy: 80, market: { ...base.market!, btc: 1, btcCostBasis: 100, price: 120, realizedPnl: -100 } }
    const sold = gameReducer(state, { type: 'market-trade', side: 'sell', amount: 0.5 })
    expect(sold.market!.realizedPnl).toBe(-90)
    expect(sold.energy).toBe(81)
    const breakEven = gameReducer({ ...state, market: { ...state.market, price: 100 } }, { type: 'market-trade', side: 'sell', amount: 0.5 })
    expect(breakEven.energy).toBe(80)
  })

  test('monopoly purchases compound on five second boundaries without an extra rounding cent', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'monopoly' })
    for (const [seconds, price] of [[4, 100], [5, 110], [10, 121]] as const) {
      const state = { ...base, elapsed: base.monopolyAnnouncedAt! + seconds, tokens: 0 }
      const bought = gameReducer(state, { type: 'buy-tokens', packs: 1 })
      expect(state.money - bought.money).toBe(price)
      expect(bought.tokens).toBe(100_000)
    }
  })

  test('a transient BTC valuation victory is retained across a later market crash in the same tick', () => {
    const market = { ...createMarket(1, 0), btc: 42_000, btcCostBasis: 4_200_000 }
    const state: GameState = { ...hire(), money: 0, market, tasks: [], taskQueue: [], nextTaskAt: Number.MAX_SAFE_INTEGER }
    expect(gameNetWorth(state)).toBe(4_200_000)
    const won = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(won.stage).toBe('won')
    expect(gameNetWorth(won)).toBeGreaterThanOrEqual(WIN_NET_WORTH)
    expect(won.market!.history.at(-1)!.elapsed).toBe(0.5)
    expect(gameReducer(won, { type: 'market-trade', side: 'sell', amount: 1 })).toBe(won)
  })
})
