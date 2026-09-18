import { useState, type Dispatch } from 'react'
import {
  AGENT_MODELS,
  canFundMercuryAttempt,
  mercuryReturnReservations,
  MERCURY_FORWARD_COST,
  taskReward,
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
  task.mercuryAuto === true
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
  const location = task.terminalId === 'spark' ? 'Spark' : task.terminalId === 'terminal-2' ? 'Terminal 2' : 'Terminal'
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
      {task.status !== 'assigned' && (
        <div className="mercury-task-progress" aria-label={`${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="mercury-task-meta">
        {task.status !== 'assigned' && <span>{progress}% complete</span>}
        <span>{remaining <= 0 ? 'Deadline passed' : `${formatTime(remaining)} left`}</span>
        <span>{formatMoney(taskReward(task, state.elapsed))} reward now</span>
      </div>
      {task.status !== 'assigned' && (
        <div className="mercury-task-tags">
          <span>{location} · pane {(task.slot ?? 0) + 1}</span>
          <span>Attempt {task.attempt}</span>
          <span>{model.label}</span>
          {isMercuryAutoTask(task) && <span>Mercury</span>}
          {task.fastMode && <span>Fast mode</span>}
        </div>
      )}
      {task.status === 'approval' && <p className="mercury-task-note">Approve or deny in the terminal.</p>}
      {task.status === 'blocked' && <p className="mercury-task-note">Resume this attempt in the terminal.</p>}
      {task.status === 'failed' && <p className="mercury-task-note">Retry in the terminal. Mercury does not retry.</p>}
      {task.status === 'artifact' && <p className="mercury-task-note">Automatic return: {formatTokens(MERCURY_FORWARD_COST)}. Manual delivery is free.</p>}
    </article>
  )
}


function TaskGroup({ state, title, tasks, empty }: {
  state: GameState
  title: string
  tasks: readonly WorkTask[]
  empty: string
}) {
  return (
    <section className="mercury-task-group">
      <div className="mercury-section-heading">
        <div>
          <h3>{title}</h3>
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
  const tokenMultiplier = local ? 0 : model.tokenMultiplier * (terminal.fastMode ? 2 : 1)
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
        <strong>Next model: {model.label}</strong>
      </div>
      <div className="mercury-terminal-facts">
        <span><b>Intelligence</b> {model.intelligence}/4</span>
        <span><b>Effective speed</b> {effectiveSpeed.toFixed(1)}×</span>
        <span><b>Token multiplier</b> {tokenMultiplier}×</span>
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
              <strong title={task?.title}>{task?.title ?? 'Idle'}</strong>
              {task && <small>{task.status === 'working' ? `${taskProgress(task)}% · ` : ''}{taskStatus(task)}</small>}
            </div>
          )
        })}
      </div>
      {activeTasks.length > 0 && (
        <p className="mercury-terminal-costs">
          Task tokens paid: {activeTasks.map((task) => formatTokens(taskTokenCost(task, task.fastMode, taskSnapshotModel(task), task.local))).join(' · ')}
        </p>
      )}
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
  let reason: string | null = null
  if (state.stage !== 'hired') {
    reason = 'Run ended. Automatic handoffs are stopped.'
  } else if (!state.mercuryEnabled) {
    reason = 'Automatic handoffs are off. Manual handoffs remain free.'
  } else if (state.tokens < reservedReturnTokens) {
    reason = `Return fees need ${formatTokens(reservedReturnTokens - state.tokens)} more.`
  } else if (artifacts.some((task) => !isMercuryAutoTask(task)) && unreservedTokens < MERCURY_FORWARD_COST) {
    reason = `A return is waiting for ${formatTokens(MERCURY_FORWARD_COST - unreservedTokens)} more. You can also deliver it manually for free.`
  } else if (pausedTasks.length > 0) {
    reason = `${pausedTasks.length} paused task${pausedTasks.length === 1 ? '' : 's'} need${pausedTasks.length === 1 ? 's' : ''} attention in the terminal.`
  } else if (failedTasks.length > 0) {
    reason = `${failedTasks.length} failed attempt${failedTasks.length === 1 ? '' : 's'} need${failedTasks.length === 1 ? 's' : ''} a manual retry.`
  } else if (queuedTasks.length > 0) {
    const freeTerminals = state.terminals.filter((terminal) => (
      state.tasks.filter((task) => task.terminalId === terminal.id && task.slot !== null && task.status !== 'assigned').length < terminal.slots
    ))
    if (freeTerminals.length === 0) reason = 'Queued assignments are waiting for a free pane.'
    else if (!queuedTasks.some((task) => freeTerminals.some((terminal) => canFundMercuryAttempt(state, task, terminal.id)))) {
      reason = 'Queued assignments need task tokens plus 300K for each handoff, including the return.'
    }
  }
  return reason === null ? null : <p className="mercury-waiting" role="status">{reason}</p>
}

export function MercuryContent({ state, dispatch }: MercuryProps) {
  const [view, setView] = useState<'active' | 'queued' | 'terminals'>('active')
  const runningTasks = state.tasks.filter((task) => task.status === 'working')
  const pausedTasks = state.tasks.filter((task) => task.status === 'approval' || task.status === 'blocked')
  const failedTasks = state.tasks.filter((task) => task.status === 'failed')
  const artifacts = state.tasks.filter((task) => task.status === 'artifact')
  const queuedTasks = state.tasks.filter((task) => task.status === 'assigned')
  const reservedReturnTokens = mercuryReturnReservations(state.tasks, state.mercuryEnabled)
  const reservedReturnCount = reservedReturnTokens / MERCURY_FORWARD_COST
  return (
    <div className="mercury-app">
      <header className="mercury-header">
        <h2>Task dashboard</h2>
        <label className="mercury-switch">
          <input
            type="checkbox"
            checked={state.mercuryEnabled}
            disabled={state.stage !== 'hired'}
            onChange={(event) => dispatch({ type: 'set-mercury', enabled: event.currentTarget.checked })}
          />
          <span className="mercury-switch-track" aria-hidden="true"><span /></span>
          <span>{state.mercuryEnabled ? 'Mercury on' : 'Mercury off'}</span>
        </label>
      </header>
      <div className="mercury-summary" aria-label="Mercury token balance">
        <div><span>Balance</span><strong>{formatTokens(state.tokens)}</strong><small>300K per handoff</small></div>
        <div><span>Reserved returns</span><strong>{formatTokens(reservedReturnTokens)}</strong><small>{reservedReturnCount} automatic task{reservedReturnCount === 1 ? '' : 's'}</small></div>
      </div>
      <WaitingReason state={state} queuedTasks={queuedTasks} pausedTasks={pausedTasks} failedTasks={failedTasks} artifacts={artifacts} reservedReturnTokens={reservedReturnTokens} />
      <nav className="mercury-views" aria-label="Mercury views">
        <button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>Active tasks · {state.tasks.length - queuedTasks.length}</button>
        <button type="button" aria-pressed={view === 'queued'} onClick={() => setView('queued')}>Queue · {queuedTasks.length}</button>
        <button type="button" aria-pressed={view === 'terminals'} onClick={() => setView('terminals')}>Terminals · {state.terminals.length}</button>
      </nav>
      <div className="mercury-panel" key={view}>
        {view === 'active' && (
          <>
            {artifacts.length > 0 && <TaskGroup state={state} title="Ready for delivery" tasks={artifacts} empty="" />}
            {pausedTasks.length > 0 && <TaskGroup state={state} title="Paused" tasks={pausedTasks} empty="" />}
            {failedTasks.length > 0 && <TaskGroup state={state} title="Failed" tasks={failedTasks} empty="" />}
            <TaskGroup state={state} title="Running" tasks={runningTasks} empty="No tasks are running." />
          </>
        )}
        {view === 'queued' && <TaskGroup state={state} title="Boss-assigned queue" tasks={queuedTasks} empty="No assignments are waiting." />}
        {view === 'terminals' && (
          <div className="mercury-terminal-grid">
            {state.terminals.map((terminal) => <TerminalCard key={terminal.id} state={state} terminalId={terminal.id} />)}
          </div>
        )}
      </div>
    </div>
  )
}
