import { describe, expect, test } from 'bun:test'
import { gameReducer, initialGame, type GameState } from '../src/game'

function hire(seed = 12345): GameState {
  const started = gameReducer(initialGame, { type: 'start', seed })
  const offered = gameReducer(started, { type: 'submit', roll: 0, companyIndex: 0 })
  return gameReducer(offered, { type: 'accept' })
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
    const working = gameReducer(hired, { type: 'start-task', id: hired.task!.id })
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
    const id = state.task!.id
    const tokenCost = 10000 * state.task!.difficulty
    state = gameReducer(state, { type: 'start-task', id })
    state = gameReducer(state, { type: 'start-task', id })
    expect(state.tokens).toBe(1000000 - tokenCost)
    for (let second = 0; second < 60 && state.task?.status !== 'artifact'; second++) {
      if (state.task?.status === 'approval' || state.task?.status === 'blocked') {
        state = gameReducer(state, { type: 'approve-task', id, approved: true })
      }
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(state.task?.status).toBe('artifact')
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
    const id = state.task!.id
    state = gameReducer(state, { type: 'start-task', id })
    for (let second = 0; second < 6 && state.task?.status !== 'approval'; second++) {
      state = gameReducer(state, { type: 'tick', seconds: 1 })
    }
    expect(state.task?.status).toBe('approval')
    state = gameReducer(state, { type: 'approve-task', id, approved: false })
    expect(state.task?.status).toBe('blocked')
    const pausedProgress = state.task!.progress
    state = gameReducer(state, { type: 'tick', seconds: 2 })
    expect(state.task?.progress).toBe(pausedProgress)
    state = gameReducer(state, { type: 'approve-task', id, approved: true })
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(state.task!.progress).toBeGreaterThan(pausedProgress)
  })

  test('spent tokens remain spent until the hundred-second refill boundary', () => {
    const hired = hire()
    const working = gameReducer(hired, { type: 'start-task', id: hired.task!.id })
    expect(gameReducer(working, { type: 'tick', seconds: 1 }).tokens).toBe(working.tokens)
    const beforeRefill = { ...working, elapsed: 99, task: null, nextTaskAt: 120, nextPingAt: 150 }
    const refilled = gameReducer(beforeRefill, { type: 'tick', seconds: 1 })
    expect(refilled.tokens).toBe(1000000)
  })

  test('missing a task deadline ends employment and stops wages', () => {
    const hired = hire()
    const lost = gameReducer(hired, { type: 'tick', seconds: Math.ceil(hired.task!.deadlineAt) + 1 })
    expect(lost.stage).toBe('lost')
    expect(gameReducer(lost, { type: 'tick', seconds: 100 }).money).toBe(lost.money)
  })
})
