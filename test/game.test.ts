import { describe, expect, test } from 'bun:test'
import {
  gameReducer,
  initialGame,
  MAX_TOKENS,
  TOKEN_PURCHASE_AMOUNT,
  TOKEN_PURCHASE_COST,
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
  test('offer odds double only after the twenty-fifth rejection', () => {
    let state = gameReducer(initialGame, { type: 'start', seed: 12345 })
    for (let attempt = 0; attempt < 24; attempt++) {
      state = gameReducer(state, { type: 'submit', roll: 0.999, companyIndex: 0 })
    }
    state = gameReducer(state, { type: 'submit', roll: 0.015, companyIndex: 0 })
    expect(state.stage).toBe('applying')
    expect(state.submissions).toBe(25)
    expect(gameReducer(state, { type: 'submit', roll: 0.019, companyIndex: 0 }).stage).toBe('offer')
    const rejectedAgain = gameReducer(state, { type: 'submit', roll: 0.021, companyIndex: 0 })
    expect(rejectedAgain.stage).toBe('applying')
    expect(gameReducer(rejectedAgain, { type: 'submit', roll: 0.039, companyIndex: 0 }).stage).toBe('offer')
  })

  test('even worst-case valid rolls get an offer before energy is exhausted', () => {
    let state = gameReducer(initialGame, { type: 'start', seed: 12345 })
    for (let attempt = 1; attempt <= 32; attempt++) {
      state = gameReducer(state, { type: 'submit', roll: 0.999999, companyIndex: 0 })
      expect(state.energy).toBe(100 - 3 * attempt)
      expect(state.stage).toBe(attempt === 32 ? 'offer' : 'applying')
    }
    state = gameReducer(state, { type: 'accept' })
    expect(state.stage).toBe('hired')
    expect(state.energy).toBe(100)
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
    const tokenCost = 10000 * taskWith(state, id).difficulty
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
    state = gameReducer(state, { type: 'deliver-task', id })
    expect(state.completedTasks).toBe(1)
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
    expect(firstPrompt).toBeString()

    let ticks = 0
    while (taskWith(state, id).status !== 'approval' && ticks < 6) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
      ticks += 1
    }
    expect(taskWith(state, id).approvalPrompt).toBe(firstPrompt)

    const resumed = gameReducer(state, { type: 'approve-task', id, approved: true })
    expect(taskWith(resumed, id).approvalPrompt).toBeString()

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

  test('starts at the ten-million token cap and token purchases remain capped', () => {
    const hired = hire()
    expect(hired.tokens).toBe(MAX_TOKENS)
    const nearCap = {
      ...hired,
      money: TOKEN_PURCHASE_COST,
      tokens: MAX_TOKENS - TOKEN_PURCHASE_AMOUNT + 1,
      tasks: [],
      nextTaskAt: 120,
      nextPingAt: 0,
    }
    const purchased = gameReducer(nearCap, { type: 'buy-tokens' })
    expect(purchased.money).toBe(0)
    expect(purchased.tokens).toBe(MAX_TOKENS)

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
      money: 100,
    }
    state = gameReducer(state, { type: 'tick', seconds: 120 })
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
    expect(upgradePrice(state, 'split', 'terminal')).toBe(20)
    expect(upgradePrice(state, 'yolo', 'terminal')).toBe(42)
    expect(upgradePrice(state, 'terminal', 'terminal')).toBe(100)
    expect(gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' })).toEqual(state)

    state = { ...state, money: 20 }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' })
    expect(state.money).toBe(0)
    expect(state.terminals[0]?.slots).toBe(2)
    expect(upgradePrice(state, 'split', 'terminal')).toBe(40)
    expect(gameReducer(state, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' }).money).toBe(0)
  })

  test('YOLO resumes paused work and bypasses future approval prompts without another token charge', () => {
    let state = hire()
    const id = taskWith(state, 1).id
    state = {
      ...state,
      money: 42,
      nextPingAt: 0,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'start-task', id, terminalId: 'terminal', slot: 0 })
    const chargedTokens = state.tokens
    for (let second = 0; second < 6 && taskWith(state, id).status !== 'approval'; second++) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(taskWith(state, id).status).toBe('approval')
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal' })
    expect(state.money).toBe(0)
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
      money: 100,
      nextPingAt: 0,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'tick', seconds: 120 })
    const first = taskWith(state, 1)
    const second = taskWith(state, 2)
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'terminal', terminalId: 'terminal' })
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
