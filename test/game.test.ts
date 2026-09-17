import { describe, expect, test } from 'bun:test'
import {
  gameReducer,
  initialGame,
  MAX_TOKENS,
  taskTokenCost,
  type GameState,
  type WorkTask,
  upgradePrice,
} from '../src/game'

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
    expect(batch.money).toBe(20)
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
    const reward = 5 * taskWith(state, id).difficulty
    const moneyBeforeDelivery = state.money
    state = gameReducer(state, { type: 'deliver-task', id })
    expect(state.completedTasks).toBe(1)
    expect(state.money).toBe(moneyBeforeDelivery + reward)
    const delivered = state
    state = gameReducer(state, { type: 'deliver-task', id })
    expect(state.completedTasks).toBe(1)
    expect(state.money).toBe(delivered.money)
    expect(state.tokens).toBe(delivered.tokens)
  })

  test('declined commands pause work and can be explicitly resumed', () => {
    let state = hire()
    const id = taskWith(state, 1).id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    for (let second = 0; second < 6 && taskWith(state, id).status !== 'approval'; second++) {
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
    let state = hire()
    const id = taskWith(state, 1).id
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    const firstPrompt = taskWith(state, id).approvalPrompt

    let ticks = 0
    while (taskWith(state, id).status !== 'approval' && ticks < 6) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
      ticks += 1
    }
    expect(taskWith(state, id).approvalPrompt).toBe(firstPrompt)

    const resumed = gameReducer(state, { type: 'approve-task', id, approved: true })

    let replay = hire()
    replay = gameReducer(replay, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    replay = gameReducer(replay, { type: 'tick', seconds: ticks })
    const replayed = gameReducer(replay, { type: 'approve-task', id, approved: true })
    expect(taskWith(replayed, id).approvalPrompt).toBe(taskWith(resumed, id).approvalPrompt)
  })

  test('spent tokens remain spent until the hundred-second refill boundary', () => {
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
      elapsed: 99,
      tasks: [],
      nextTaskAt: 120,
      nextPingAt: 150,
    }
    const refilled = gameReducer(beforeRefill, { type: 'tick', seconds: 1 })
    expect(refilled.tokens).toBe(MAX_TOKENS)
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
    const task = taskWith(hired, 1)
    const pingDeadline = task.deadlineAt + 50
    const context = { ...hired, pingDeadline }
    const lost = gameReducer(context, { type: 'tick', seconds: Math.ceil(task.deadlineAt) + 1 })
    expect(lost.stage).toBe('lost')
    expect(lost.failure).toBe('The task deadline was missed.')
    expect(lost.tasks).toEqual(context.tasks)
    expect(lost.pingDeadline).toBe(pingDeadline)
    expect(gameReducer(lost, { type: 'tick', seconds: 100 })).toEqual(lost)
  })
})

describe('terminal upgrades and concurrent work', () => {
  test('rejects an occupied slot without charging a second task', () => {
    let state = hire()
    state = {
      ...state,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
      nextPingAt: 0,
      money: 200,
    }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' })
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
    expect(upgradePrice(state, 'yolo', 'terminal')).toBe(420)
    expect(upgradePrice(state, 'terminal', 'terminal')).toBe(1_000)
    expect(gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' })).toEqual(state)

    state = { ...state, money: 200 }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' })
    expect(state.money).toBe(0)
    expect(state.terminals[0]?.slots).toBe(2)
    expect(upgradePrice(state, 'split', 'terminal')).toBe(400)
    expect(gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' }).money).toBe(0)
  })

  test('YOLO resumes paused work and bypasses future approval prompts without another token charge', () => {
    let state = hire()
    const id = taskWith(state, 1).id
    state = {
      ...state,
      money: 420,
      nextPingAt: 0,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    const chargedTokens = state.tokens
    for (let second = 0; second < 6 && taskWith(state, id).status !== 'approval'; second++) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(taskWith(state, id).status).toBe('approval')
    const moneyBeforeYolo = state.money
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal' })
    expect(state.money).toBe(moneyBeforeYolo - 420)
    expect(state.terminals[0]?.yolo).toBe(true)
    expect(taskWith(state, id).status).toBe('working')
    expect(taskWith(state, id).approvalPrompt).toBeNull()
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
      nextPingAt: 0,
      money: 1_000,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'terminal', terminalId: 'terminal' })
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
    expect(state.tasks.find((task) => task.id === first.id)?.progress).toBe(before[0]! + 1)
    expect(state.tasks.find((task) => task.id === second.id)?.progress).toBe(before[1]! + 1)
  })
})

describe('hidden boss assignment inventory', () => {
  test('keeps three undisclosed descriptors and starts deadlines only when issued', () => {
    const state = hire()
    expect(state.tasks).toHaveLength(1)
    expect(state.taskQueue).toHaveLength(3)
    expect(state.taskQueue.every((task) => !('deadlineAt' in task))).toBe(true)
    expect(state.tasks[0]?.deadlineAt).toBeGreaterThan(state.elapsed)
    expect(new Set([
      ...state.tasks.map((task) => task.id),
      ...state.taskQueue.map((task) => task.id),
    ]).size).toBe(4)
  })

  test('fills real capacity automatically and reserves tokens for issued work', () => {
    let state = { ...hire(), money: 200 }
    const first = taskWith(state, 1)
    const next = state.taskQueue[0]
    if (next === undefined) throw new Error('The boss queue was empty')
    const requiredTokens = taskTokenCost(first) + taskTokenCost(next)
    state = gameReducer(
      { ...state, tokens: requiredTokens - 1 },
      { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' },
    )
    expect(state.tasks).toHaveLength(1)
    const underfunded = state
    const funded = gameReducer(
      { ...underfunded, tokens: requiredTokens },
      { type: 'tick', seconds: 1 },
    )
    expect(funded.tasks).toHaveLength(2)
    expect(funded.tasks.every((task) => task.deadlineAt > funded.elapsed)).toBe(true)
  })

  test('waits five seconds after delivery before replenishing an available slot', () => {
    let state = hire()
    const delivered = taskWith(state, 1)
    state = {
      ...state,
      tasks: [{ ...delivered, status: 'artifact', progress: delivered.difficulty, startedAt: 0 }],
      elapsed: 20,
      nextTaskAt: 0,
    }
    state = gameReducer(state, { type: 'deliver-task', id: delivered.id })
    expect(state.tasks).toHaveLength(0)
    expect(state.nextTaskAt).toBe(25)
    state = gameReducer(state, { type: 'tick', seconds: 4 })
    expect(state.tasks).toHaveLength(0)
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]?.id).toBe(2)
    expect(state.taskQueue).toHaveLength(3)
  })

  test('replays backlog generation and issue timing deterministically for the same seed', () => {
    const first = hire(17)
    const second = hire(17)
    expect(second).toEqual(first)
    expect(gameReducer(first, { type: 'tick', seconds: 1 })).toEqual(
      gameReducer(second, { type: 'tick', seconds: 1 }),
    )
  })
})
