import { describe, expect, test } from 'bun:test'
import {
  companies,
  gameReducer,
  initialGame,
  MAX_TOKENS,
  taskReward,
  taskTokenCost,
  type EmploymentJob,
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
    state = gameReducer(state, { type: 'tick', seconds: 5 })
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
    const lost = gameReducer(hired, { type: 'tick', seconds: Math.ceil(task.deadlineAt) + 1 })
    expect(lost.stage).toBe('lost')
    expect(lost.tasks).toContainEqual(task)
    expect(lost.messages.at(-1)?.type).toBe('firing')
    expect(gameReducer(lost, { type: 'tick', seconds: 100 })).toEqual(lost)
  })
  test('task-free employment remains active during extended elapsed time', () => {
    const longRunning = gameReducer({
      ...hire(),
      tasks: [],
      taskQueue: [],
      nextTaskAt: 1_000_000,
    }, { type: 'tick', seconds: 10_000 })
    expect(longRunning.stage).toBe('hired')
    expect(longRunning.failure).toBeNull()
    expect(longRunning.elapsed).toBe(10_000)
    expect(longRunning.money).toBe(10_000)
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
    state = gameReducer(state, { type: 'tick', seconds: 18 })
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
      money: 1_000,
      tasks: state.tasks.map((task) => ({ ...task, deadlineAt: 1_000 })),
    }
    state = gameReducer(state, { type: 'buy-upgrade', upgrade: 'terminal', terminalId: 'terminal' })
    state = gameReducer(state, { type: 'tick', seconds: 18 })
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

  test('funded assignments arrive one at a time on the boss timer and reserve tokens', () => {
    let state = { ...hire(), money: 300 }
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
    const unfunded = gameReducer(underfunded, { type: 'tick', seconds: 18 })
    expect(unfunded.tasks).toHaveLength(1)
    const earlyPurchase = gameReducer(underfunded, { type: 'buy-tokens', packs: 1 })
    expect(earlyPurchase.tasks).toHaveLength(1)
    const duePurchase = gameReducer(unfunded, { type: 'buy-tokens', packs: 1 })
    expect(duePurchase.tasks).toHaveLength(2)
    const funded = gameReducer(
      { ...underfunded, tokens: requiredTokens },
      { type: 'tick', seconds: 18 },
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
    })
    expect(upgraded.tasks).toEqual(hired.tasks)
    expect(upgraded.taskQueue).toEqual(hired.taskQueue)
    expect(upgraded.nextTaskAt).toBe(hired.nextTaskAt)
    expect(upgraded.expectation).toBe(hired.expectation)

    const poor = gameReducer({ ...hired, money: 0 }, { type: 'tick', seconds: 18 })
    const rich = gameReducer({ ...hired, money: 100_000 }, { type: 'tick', seconds: 18 })
    expect(rich.tasks.map((task) => task.deadlineAt)).toEqual(poor.tasks.map((task) => task.deadlineAt))
    expect(poor.expectation).toBeGreaterThan(hired.expectation)
    expect(rich.expectation).toBe(poor.expectation)
    expect(rich.nextTaskAt).toBe(poor.nextTaskAt)
  })

  test('delivery advances a later offer without postponing an earlier or overdue offer', () => {
    for (const [scheduledAt, wait] of [[18, 1], [22, 2], [40, 5]] as const) {
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
    expect(taskReward(task, 19)).toBe(45)
    expect(taskReward(task, 20)).toBe(40.5)
    expect(taskReward(task, 29)).toBe(40.5)
    expect(taskReward(task, 30)).toBe(36)
    expect(taskReward(task, 109)).toBe(4.5)
    expect(taskReward(task, 110)).toBe(2.25)
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

  test('the one-time claim and five-second lottery preserve the refill schedule', () => {
    let state: GameState = {
      ...hire(), watercoolerUnlocked: true, tokens: 100,
      tasks: [], taskQueue: [], nextTaskAt: 1_000,
    }
    state = gameReducer(state, { type: 'install-social' })
    expect(gameReducer(state, { type: 'like-reset' })).toBe(state)
    state = gameReducer(state, { type: 'claim-token-reset' })
    expect(state.tokens).toBe(MAX_TOKENS)
    const spent = { ...state, tokens: 100 }
    expect(gameReducer(spent, { type: 'claim-token-reset' })).toBe(spent)
    state = gameReducer(spent, { type: 'tick', seconds: 4 })
    expect(state.socialPosts.some((post) => post.type === 'lottery')).toBe(false)
    state = gameReducer(state, { type: 'tick', seconds: 1 })
    expect(state.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(1)

    // Seeded draws immediately below and above the one-percent boundary.
    const missed = gameReducer({ ...state, rng: 1962 }, { type: 'like-reset' })
    expect(missed.tokens).toBe(100)
    const won = gameReducer({ ...missed, rng: 978 }, { type: 'like-reset' })
    expect(won.tokens).toBe(MAX_TOKENS)
    expect(won.socialPosts.filter((post) => post.type === 'reset')).toHaveLength(2)
    expect(won.socialPosts.find((post) => post.type === 'lottery')?.likes).toBe(2)
    const waiting = gameReducer({ ...won, tokens: 100 }, { type: 'tick', seconds: 94 })
    expect(waiting.tokens).toBe(100)
    const refilled = gameReducer(waiting, { type: 'tick', seconds: 1 })
    expect(refilled.tokens).toBe(MAX_TOKENS)
    expect(refilled.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(1)
  })

  test('architecture frequency rises by delivery count but remains capped at eighty percent', () => {
    const hired = hire()
    for (const [rng, completedArchitectureTasks, kind] of [
      [18, 0, 'standard'], [18, 1, 'architecture'],
      [69, 8, 'standard'], [69, 9, 'architecture'], [194, 100, 'standard'],
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
    state = gameReducer(state, { type: 'tick', seconds: 5 })
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
    state = gameReducer(state, { type: 'tick', seconds: 4 })
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
    state = gameReducer(state, { type: 'tick', seconds: 5 })
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
    expect(tiro.tokens).toBe(1_900_000)
    expect(tiro.money).toBe(1_000)
    expect(tiro.failure).toBeNull()
    expect(tiro.resetClaimed).toBe(false)
    expect(tiro.watercoolerUnlocked).toBe(true)
    expect(tiro.watercoolerRead).toBe(true)
    expect(tiro.completedTasks).toBe(0)
    expect(tiro.level).toBe(3)
    expect(tiro.reasoningUnlocked).toBe(false)
    expect(tiro.fastModeUnlocked).toBe(false)
    expect(tiro.socialInstalledAt).toBe(0)
    expect(tiro.socialPosts).toEqual([{ id: 'campaign', type: 'campaign', elapsed: 0, likes: 0 }])
    expect(tiro.tasks.every((task) => task.assignedAt === 0 && task.deadlineAt > 0)).toBe(true)
    const additionalSplit = gameReducer(tiro, { type: 'buy-upgrade', upgrade: 'split', terminalId: 'terminal' })
    expect(additionalSplit.money).toBe(600)
    expect(additionalSplit.terminals[0]?.slots).toBe(3)
    expect(gameReducer(tiro, { type: 'buy-upgrade', upgrade: 'yolo', terminalId: 'terminal' })).toBe(tiro)
    const additionalTerminal = gameReducer(tiro, {
      type: 'buy-upgrade',
      upgrade: 'terminal',
      terminalId: 'terminal',
    })
    expect(additionalTerminal.money).toBe(0)
    expect(additionalTerminal.terminals).toHaveLength(2)

    const claimed = gameReducer(tiro, { type: 'claim-token-reset' })
    expect(claimed.tokens).toBe(MAX_TOKENS)
    expect(claimed.resetClaimed).toBe(true)
    const beforeLottery = gameReducer(claimed, { type: 'tick', seconds: 4 })
    expect(beforeLottery.socialPosts.some((post) => post.type === 'lottery')).toBe(false)
    const lottery = gameReducer(beforeLottery, { type: 'tick', seconds: 1 })
    expect(lottery.socialPosts.filter((post) => post.type === 'lottery')).toHaveLength(1)
  })
})
 
describe('extended engine contracts', () => {
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
    expect(market.completedTasks).toBe(55)
    expect(market.completedArchitectureTasks).toBe(8)
    expect(market.terminals).toEqual([
      { id: 'terminal', slots: 4, yolo: true, fastMode: true, model: 'reasoning' },
      { id: 'terminal-2', slots: 4, yolo: true, fastMode: true, model: 'reasoning' },
    ])
    const spark = gameReducer(initialGame, { type: 'dev-jump', stage: 'spark' })
    expect(spark.terminals.find((terminal) => terminal.id === 'spark')).toMatchObject({ slots: 2, yolo: true, model: 'reasoning' })
    const mercury = gameReducer(initialGame, { type: 'dev-jump', stage: 'mercury' })
    expect(mercury.advancedModelUnlocked).toBe(true)
    expect(mercury.mercuryOwned).toBe(true)
    expect(mercury.mercuryEnabled).toBe(true)
    expect(mercury.terminals.filter((terminal) => terminal.id !== 'spark').every((terminal) => terminal.model === 'advanced')).toBe(true)
    const secondJob = gameReducer(initialGame, { type: 'dev-jump', stage: 'second-job' })
    expect(secondJob.completedTasks).toBe(100)
    expect(secondJob.secondJob).toMatchObject({ level: 3, completedTasks: 0 })
    const frontier = gameReducer(initialGame, { type: 'dev-jump', stage: 'frontier' })
    expect(frontier.completedTasks + (frontier.secondJob?.completedTasks ?? 0)).toBe(290)
    expect(frontier.terminals.find((terminal) => terminal.id === 'terminal')?.model).toBe('frontier')
    expect(frontier.terminals.find((terminal) => terminal.id === 'terminal-2')?.model).toBe('advanced')
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
      ...disabled,
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
    const restored = gameReducer(blocked, { type: 'tick', seconds: 1 })
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
    const ready = { ...base, tasks: [task], taskQueue: [], nextTaskAt: 1_000, tokens: 1_000_000 }
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
      tokens: 300_000,
      tasks: [...manuallyStarted.tasks, { ...assigned, id: 706 }],
    }, { type: 'tick', seconds: 1 })
    expect(taskWith(automaticallyStarted, 706).status).toBe('working')
    expect(automaticallyStarted.tokens).toBe(0)
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

  test('L5 promotion is unavailable until the second career stage unlocks', () => {
    const base = gameReducer(hire(), { type: 'dev-jump', stage: 'mercury' })
    const source = hire().tasks[0]!
    const artifact = (id: number): WorkTask => ({ ...source, id, status: 'artifact', progress: source.difficulty })
    const capped = gameReducer({
      ...base, level: 4, completedTasks: 79, secondJobUnlocked: false,
      tasks: [artifact(701)], nextTaskAt: 1_000,
    }, { type: 'deliver-task', id: 701 })
    expect(capped.level).toBe(4)
    expect(capped.secondJobUnlocked).toBe(false)
    const unlocked = gameReducer({
      ...capped, completedTasks: 99, tasks: [artifact(702)],
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
    }, { type: 'buy-upgrade', upgrade: 'terminal', terminalId: 'terminal' })
    const started = gameReducer(purchased, { type: 'start-task', id: task.id, terminalId: 'terminal-2', slot: 0 })
    expect(taskWith(started, task.id).model).toBe('advanced')
    expect(started.tokens).toBe(900_000)
  })
})
