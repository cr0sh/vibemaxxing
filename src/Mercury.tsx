import type { Dispatch } from 'react'
import {
  AGENT_MODELS,
  canFundTaskAttempt,
  taskReward,
  taskSuccessChance,
  taskTokenCost,
  terminalModel,
  type AgentModelId,
  type GameAction,
  type GameState,
  type JobId,
  type TerminalId,
  type WorkTask,
} from './game'
import './Mercury.css'

type MercuryProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

const FORWARDING_COST = 300_000
const compactTokens = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

const formatTokens = (amount: number): string => `${compactTokens.format(Math.max(0, amount))} tokens`
const formatMoney = (amount: number): string => moneyFormatter.format(Math.max(0, Number.isFinite(amount) ? amount : 0))
const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return minutes > 0 ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${remainder}s`
}

const employerName = (state: GameState, jobId: JobId): string => (
  jobId === 'secondary' ? state.secondJob?.company ?? 'Second employer' : state.company ?? 'Primary employer'
)

const taskSnapshotModel = (task: Pick<WorkTask, 'model' | 'local'>): AgentModelId => task.local ? 'reasoning' : task.model ?? 'basic'

const isMercuryAutoTask = (task: WorkTask): boolean => (
  (task as WorkTask & { mercuryAuto?: boolean }).mercuryAuto === true
)

const taskStatus = (task: WorkTask): string => {
  switch (task.status) {
    case 'working': return 'Running'
    case 'approval': return 'Paused · approval'
    case 'blocked': return 'Paused · waiting'
    case 'failed': return 'Failed · retry needed'
    case 'artifact': return 'Ready for delivery'
    case 'assigned': return 'Queued'
  }
}

const taskProgress = (task: WorkTask): number => Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)

function TaskCard({ state, task }: { state: GameState; task: WorkTask }) {
  const modelId = taskSnapshotModel(task)
  const model = AGENT_MODELS[modelId]
  const remaining = task.deadlineAt - state.elapsed
  const location = task.status === 'assigned' ? 'Not dispatched' : task.local ? 'Spark · local' : `Cloud · ${model.label}`
  const progress = task.status === 'artifact' ? 100 : taskProgress(task)
  return (
    <article className={`mercury-task-card mercury-task-${task.status}`}>
      <div className="mercury-task-card-heading">
        <div>
          <span className="mercury-eyebrow">{employerName(state, task.jobId)} · task {task.id}</span>
          <h4>{task.title}</h4>
        </div>
        <span className="mercury-status-badge">{taskStatus(task)}</span>
      </div>
      <p className="mercury-task-description">{task.description}</p>
      <div className="mercury-task-progress" aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="mercury-task-meta">
        <span>{progress}% complete</span>
        <span>{remaining <= 0 ? 'Deadline passed' : `${formatTime(remaining)} left`}</span>
        <span>{formatMoney(taskReward(task, state.elapsed))} reward now</span>
      </div>
      <div className="mercury-task-tags">
        <span>{location}</span>
        <span>Attempt {Math.max(1, task.attempt)}</span>
        <span>{task.status === 'assigned' ? 'No model snapshot yet' : `Snapshot: ${model.label}`}</span>
        {isMercuryAutoTask(task) && <span>Mercury auto</span>}
        {task.fastMode && <span>Fast mode</span>}
      </div>
      {task.status === 'approval' && <p className="mercury-task-note">Mercury cannot approve this checkpoint. Review it in the terminal.</p>}
      {task.status === 'blocked' && <p className="mercury-task-note">This attempt is paused until manual approval resumes it.</p>}
      {task.status === 'failed' && <p className="mercury-task-note">Mercury will not retry failed attempts. Retry it manually when ready.</p>}
      {task.status === 'artifact' && <p className="mercury-task-note">Forwarding this return costs {formatTokens(FORWARDING_COST)}.</p>}
    </article>
  )
}


function TaskGroup({ state, title, description, tasks, empty }: {
  state: GameState
  title: string
  description: string
  tasks: readonly WorkTask[]
  empty: string
}) {
  return (
    <section className="mercury-task-group">
      <div className="mercury-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="mercury-count">{tasks.length}</span>
      </div>
      {tasks.length > 0 ? (
        <div className="mercury-task-list">{tasks.map((task) => <TaskCard key={task.id} state={state} task={task} />)}</div>
      ) : (
        <p className="mercury-empty">{empty}</p>
      )}
    </section>
  )
}

function TerminalCard({ state, terminalId }: { state: GameState; terminalId: TerminalId }) {
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  if (terminal === undefined) return null
  const local = terminalId === 'spark'
  const modelId = local ? 'reasoning' : terminalModel(state, terminalId)
  const model = AGENT_MODELS[modelId]
  const paneCount = local ? 2 : terminal.slots
  const activeTasks = state.tasks.filter((task) => task.terminalId === terminalId && task.slot !== null && task.status !== 'assigned')
  const effectiveSpeed = model.speed * (terminal.fastMode ? 2 : 1)
  const levelOneCost = taskTokenCost({ difficulty: 1 }, terminal.fastMode, modelId, local)
  const label = local ? 'Mapple Spark' : terminalId === 'terminal-2' ? 'Terminal 2' : 'Terminal'
  return (
    <article className="mercury-terminal-card">
      <div className="mercury-terminal-heading">
        <div>
          <span className="mercury-eyebrow">{local ? 'Local lane' : 'Cloud lane'}</span>
          <h4>{label}</h4>
        </div>
        <span className={`mercury-terminal-state ${activeTasks.length > 0 ? 'is-busy' : ''}`}>{activeTasks.length > 0 ? `${activeTasks.length}/${paneCount} busy` : 'Idle'}</span>
      </div>
      <div className="mercury-terminal-model">
        <strong>Future attempts use {model.label}</strong>
        <span>Running tasks keep their snapshot model in the task card.</span>
      </div>
      <div className="mercury-terminal-facts">
        <span><b>Intelligence</b> {model.intelligence}/4</span>
        <span><b>Effective speed</b> {effectiveSpeed.toFixed(1)}×</span>
        <span><b>Token cost</b> {model.tokenMultiplier}× · from {formatTokens(levelOneCost)}</span>
        <span><b>Location</b> {local ? 'Local · no task-token charge' : 'Cloud · shared balance'}</span>
      </div>
      <div className="mercury-terminal-tags">
        <span>{paneCount} {paneCount === 1 ? 'pane' : 'panes'}</span>
        <span>{terminal.yolo ? 'YOLO on' : 'YOLO off'}</span>
        <span>{local ? 'Fast mode n/a' : terminal.fastMode ? 'Fast mode on' : 'Fast mode off'}</span>
      </div>
      <div className="mercury-pane-list" aria-label={`${label} panes`}>
        {Array.from({ length: paneCount }, (_, slot) => {
          const task = state.tasks.find((candidate) => candidate.terminalId === terminalId && candidate.slot === slot && candidate.status !== 'assigned')
          return (
            <div className={`mercury-pane ${task ? 'is-occupied' : ''}`} key={`${terminalId}-${slot}`}>
              <span>Pane {slot + 1}</span>
              <strong>{task?.title ?? 'Idle'}</strong>
              {task && <small>{task.status === 'working' ? `${taskProgress(task)}% · ` : ''}{taskStatus(task)}</small>}
            </div>
          )
        })}
      </div>
      {activeTasks.length > 0 && (
        <p className="mercury-terminal-costs">
          Active attempt costs: {activeTasks.map((task) => formatTokens(taskTokenCost(task, task.fastMode, taskSnapshotModel(task), task.local))).join(' · ')}
        </p>
      )}
      <p className="mercury-terminal-chance">Success odds vary by task difficulty; current model tops out at {Math.round(taskSuccessChance({ complexity: 5 }, modelId) * 100)}% on a five-star task.</p>
    </article>
  )
}

function WaitingReason({ state, queuedTasks, pausedTasks, failedTasks, artifacts, reservedReturnTokens }: {
  state: GameState
  queuedTasks: readonly WorkTask[]
  pausedTasks: readonly WorkTask[]
  failedTasks: readonly WorkTask[]
  artifacts: readonly WorkTask[]
  reservedReturnTokens: number
}) {
  const unreservedTokens = Math.max(0, state.tokens - reservedReturnTokens)
  const manualArtifacts = artifacts.filter((task) => !isMercuryAutoTask(task))
  let reason = 'No Mercury work is waiting right now.'
  if (!state.mercuryEnabled) {
    reason = 'Mercury is off. Queued work stays queued until you turn it on.'
  } else if (reservedReturnTokens > 0 && state.tokens < reservedReturnTokens) {
    reason = `Mercury has ${formatTokens(reservedReturnTokens)} reserved for active auto returns, but the balance is ${formatTokens(state.tokens)}.`
  } else if (manualArtifacts.length > 0 && unreservedTokens < FORWARDING_COST) {
    reason = `Mercury is waiting for ${formatTokens(FORWARDING_COST - unreservedTokens)} more unreserved: forwarding a return costs ${formatTokens(FORWARDING_COST)}.`
  } else if (pausedTasks.length > 0) {
    reason = `${pausedTasks.length} task${pausedTasks.length === 1 ? '' : 's'} require manual approval. Mercury will not choose for you.`
  } else if (failedTasks.length > 0) {
    reason = `${failedTasks.length} failed attempt${failedTasks.length === 1 ? '' : 's'} require a manual retry. Mercury does not retry them.`
  } else if (queuedTasks.length > 0) {
    const dispatchState = { ...state, tokens: Math.max(0, unreservedTokens - FORWARDING_COST) }
    const hasFreePane = queuedTasks.some((task) => dispatchState.terminals.some((terminal) => (
      canFundTaskAttempt(dispatchState, task, terminal.fastMode, terminal.id) &&
      Array.from({ length: terminal.id === 'spark' ? 2 : terminal.slots }, (_, slot) => slot).some((slot) => !state.tasks.some((candidate) => candidate.id !== task.id && candidate.terminalId === terminal.id && candidate.slot === slot && candidate.status !== 'assigned'))
    )))
    if (unreservedTokens < FORWARDING_COST) reason = `Queued work is waiting: Mercury needs ${formatTokens(FORWARDING_COST)} unreserved to dispatch and forward each direction.`
    else if (!hasFreePane) reason = 'Queued work is waiting: every eligible pane is occupied or cannot fund this attempt after return fees are reserved.'
    else reason = 'Queued work is waiting for Mercury’s next dispatch check; queued does not mean dispatched.'
  }
  return <p className="mercury-waiting" role="status"><strong>Waiting reason</strong> {reason}</p>
}

export function MercuryContent({ state, dispatch }: MercuryProps) {
  const runningTasks = state.tasks.filter((task) => task.status === 'working')
  const pausedTasks = state.tasks.filter((task) => task.status === 'approval' || task.status === 'blocked')
  const failedTasks = state.tasks.filter((task) => task.status === 'failed')
  const artifacts = state.tasks.filter((task) => task.status === 'artifact')
  const queuedTasks = state.tasks.filter((task) => task.status === 'assigned' && task.terminalId === null && task.slot === null)
  const reservedReturnCount = state.tasks.filter((task) => isMercuryAutoTask(task) && task.status !== 'assigned' && task.status !== 'failed').length
  const reservedReturnTokens = reservedReturnCount * FORWARDING_COST
  const jobs = [
    {
      id: 'primary' as const,
      company: state.company ?? 'Primary employer',
      level: state.level,
      completed: state.completedTasks,
      expectation: state.expectation,
      taskCount: state.tasks.filter((task) => task.jobId === 'primary').length,
    },
    ...(state.secondJob === null ? [] : [{
      id: 'secondary' as const,
      company: state.secondJob.company,
      level: state.secondJob.level,
      completed: state.secondJob.completedTasks,
      expectation: state.secondJob.expectation,
      taskCount: state.tasks.filter((task) => task.jobId === 'secondary').length,
    }]),
  ]
  return (
    <div className="mercury-app">
      <header className="mercury-header">
        <div>
          <span className="mercury-eyebrow">Mercury operations dashboard</span>
          <h2>Keep the work moving</h2>
          <p>One view of boss assignments, terminal lanes, and returns. Mercury forwards artifacts and starts eligible queued tasks; approvals and retries stay manual.</p>
        </div>
        <label className="mercury-switch">
          <input
            type="checkbox"
            checked={state.mercuryEnabled}
            onChange={(event) => dispatch({ type: 'set-mercury', enabled: event.currentTarget.checked })}
          />
          <span className="mercury-switch-track" aria-hidden="true"><span /></span>
          <span>{state.mercuryEnabled ? 'Mercury on' : 'Mercury off'}</span>
        </label>
      </header>

      <div className="mercury-summary" aria-label="Mercury summary">
        <div><span>Balance</span><strong>{formatTokens(state.tokens)}</strong><small>300K forwarding fee each direction</small></div>
        <div><span>Reserved returns</span><strong>{formatTokens(reservedReturnTokens)}</strong><small>{reservedReturnCount} auto task{reservedReturnCount === 1 ? '' : 's'} holding a fee</small></div>
        <div><span>Running</span><strong>{runningTasks.length}</strong><small>active task snapshots</small></div>
        <div><span>Queued</span><strong>{queuedTasks.length}</strong><small>boss-assigned, not dispatched</small></div>
        <div><span>Returns</span><strong>{artifacts.length}</strong><small>ready for delivery</small></div>
      </div>

      <WaitingReason state={state} queuedTasks={queuedTasks} pausedTasks={pausedTasks} failedTasks={failedTasks} artifacts={artifacts} reservedReturnTokens={reservedReturnTokens} />


      <section className="mercury-section mercury-employers">
        <div className="mercury-section-heading">
          <div><h3>Employers</h3><p>Ownership and deadline pressure for every workstream.</p></div>
          <span className="mercury-count">{jobs.length}</span>
        </div>
        <div className="mercury-employer-grid">
          {jobs.map((job) => (
            <article className="mercury-employer-card" key={job.id}>
              <div className="mercury-employer-heading"><strong>{job.company}</strong><span>Level {job.level}</span></div>
              <div className="mercury-employer-facts"><span>{job.completed} delivered</span><span>{job.taskCount} active or queued</span><span>{Math.round(job.expectation * 100)}% expectation</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mercury-section mercury-tasks">
        <div className="mercury-section-heading mercury-section-heading-main"><div><h3>Task board</h3><p>Active task records retain the model and mode used at start; queued assignments have no attempt yet.</p></div><span className="mercury-count">{state.tasks.length}</span></div>
        <TaskGroup state={state} title="Running" description="Tasks currently consuming a pane." tasks={runningTasks} empty="No tasks are running." />
        <TaskGroup state={state} title="Paused" description="Approval checkpoints remain a human decision." tasks={pausedTasks} empty="No tasks are paused." />
        <TaskGroup state={state} title="Failed" description="Failed attempts stay put until you retry them from a terminal." tasks={failedTasks} empty="No failed attempts." />
        <TaskGroup state={state} title="Ready for delivery" description="Artifacts can be delivered manually or forwarded by Mercury for 300K tokens." tasks={artifacts} empty="No artifacts are waiting for delivery." />
        <TaskGroup state={state} title="Boss-assigned queue" description="Assignments from employers. Queue membership does not guarantee an immediate dispatch." tasks={queuedTasks} empty="No boss-assigned tasks are waiting." />
      </section>

      <section className="mercury-section mercury-terminals">
        <div className="mercury-section-heading mercury-section-heading-main"><div><h3>Terminals</h3><p>Future attempt settings are separate from running task snapshots.</p></div><span className="mercury-count">{state.terminals.length}</span></div>
        <div className="mercury-terminal-grid">{state.terminals.map((terminal) => <TerminalCard key={terminal.id} state={state} terminalId={terminal.id} />)}</div>
      </section>
    </div>
  )
}
