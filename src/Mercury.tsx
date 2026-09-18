import { useState, type Dispatch } from 'react'
import {
  AGENT_MODELS,
  canFundMercuryAttempt,
  canFundMercuryRetry,
  canFundTaskAttempt,
  isLocalTerminal,
  mercuryReturnReservations,
  MERCURY_FORWARD_COST,
  MERCURY_RETRY_DELAY,
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
import { useI18n, type I18nValue, type Translate } from './i18n'
import './Mercury.css'

type MercuryProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

const formatTokens = (amount: number, t: Translate, formatNumber: I18nValue['formatNumber']): string => (
  t('common.tokens', { amount: formatNumber(Math.max(0, amount), { notation: 'compact', maximumFractionDigits: 1 }) })
)

const formatMoney = (amount: number, formatCurrency: I18nValue['formatCurrency']): string => (
  formatCurrency(Math.max(0, Number.isFinite(amount) ? amount : 0), 'USD')
)

const formatTime = (seconds: number, t: Translate, formatNumber: I18nValue['formatNumber']): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  const localizedSeconds = formatNumber(remainder, { minimumIntegerDigits: minutes > 0 ? 2 : 1 })
  return minutes > 0
    ? t('common.durationMinutes', { minutes: formatNumber(minutes), seconds: localizedSeconds })
    : t('common.durationSeconds', { seconds: localizedSeconds })
}

const employerName = (state: GameState, jobId: JobId, t: Translate): string => (
  jobId === 'secondary' ? state.secondJob?.company ?? t('employment.employer.fallbackSecondary') : state.company ?? t('employment.employer.fallbackPrimary')
)

const taskSnapshotModel = (task: Pick<WorkTask, 'model' | 'local'>): AgentModelId => task.model ?? (task.local ? 'reasoning' : 'basic')

const isMercuryAutoTask = (task: WorkTask): boolean => (
  task.mercuryAuto === true
)

const taskStatus = (task: WorkTask, t: Translate): string => {
  switch (task.status) {
    case 'working': return t('mercury.running')
    case 'approval': return t('mercury.pausedApproval')
    case 'blocked': return t('mercury.pausedWaiting')
    case 'failed': return t('mercury.failedRetry')
    case 'artifact': return t('mercury.readyDelivery')
    case 'assigned': return t('mercury.queued')
  }
}

const canFundFailedRetry = (state: GameState, task: WorkTask): boolean => {
  const terminal = state.terminals.find((candidate) => candidate.id === task.terminalId)
  return state.stage === 'hired' &&
    task.status === 'failed' &&
    terminal !== undefined &&
    task.slot !== null &&
    canFundTaskAttempt(state, task, terminal.fastMode, terminal.id)
}

const failedRetryNote = (
  state: GameState,
  task: WorkTask,
  t: Translate,
  formatNumber: I18nValue['formatNumber'],
): string => {
  if (state.stage !== 'hired' || !state.mercuryOwned) return t('mercury.retryUnavailable')
  if (!state.mercuryEnabled) return t('mercury.retryOff')
  if (task.failedAt === null) return t('mercury.retryTimingUnavailable')
  const retryIn = task.failedAt + MERCURY_RETRY_DELAY - state.elapsed
  if (retryIn > 0) return t('mercury.retryIn', { time: formatTime(retryIn, t, formatNumber) })
  return canFundMercuryRetry(state, task) ? t('mercury.retryReady') : t('mercury.retryFunds')
}

const taskProgress = (task: WorkTask): number => Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)

function failedTaskLabel(count: number, t: Translate, formatNumber: I18nValue['formatNumber']): string {
  return t(count === 1 ? 'mercury.failedAttempt' : 'mercury.failedAttempts', { count: formatNumber(count) })
}

function FailedRetryNotice({ state, failedTasks, dispatch }: {
  state: GameState
  failedTasks: readonly WorkTask[]
  dispatch: Dispatch<GameAction>
}) {
  const { t, formatNumber } = useI18n()
  if (failedTasks.length === 0) return null
  const canRetry = state.stage === 'hired' && failedTasks.some((task) => canFundFailedRetry(state, task))
  const automatic = state.stage === 'hired' && state.mercuryOwned && state.mercuryEnabled
  const attempts = failedTaskLabel(failedTasks.length, t, formatNumber)
  const message = automatic
    ? t('mercury.failedNoticeAutomatic', {
      attempts,
      seconds: formatNumber(MERCURY_RETRY_DELAY),
    })
    : t('mercury.failedNoticeManual', { attempts })
  return (
    <div className="mercury-waiting mercury-failed-notice" role="status">
      <span>{message}</span>
      <button type="button" onClick={() => dispatch({ type: 'retry-all' })} disabled={state.stage !== 'hired' || !canRetry}>
        {t('mercury.retryAll')}
      </button>
    </div>
  )
}

function TaskCard({ state, task }: { state: GameState; task: WorkTask }) {
  const { t, formatNumber, formatCurrency } = useI18n()
  const modelId = taskSnapshotModel(task)
  const model = AGENT_MODELS[modelId]
  const location = isLocalTerminal(task.terminalId ?? 'terminal')
    ? task.terminalId === 'spark-ultra' ? 'Mapple Spark Ultra' : 'Mapple Spark'
    : task.terminalId === 'terminal-2' ? t('mercury.terminalTwo') : t('mercury.terminal')
  const remaining = task.deadlineAt - state.elapsed
  const progress = task.status === 'artifact' ? 100 : taskProgress(task)
  const formatTaskTokens = (amount: number): string => formatTokens(amount, t, formatNumber)
  return (
    <article className={`mercury-task-card mercury-task-${task.status}`}>
      <div className="mercury-task-card-heading">
        <div>
          <span className="mercury-eyebrow">{employerName(state, task.jobId, t)} · {t('mercury.task', { id: task.id })}</span>
          <h4>{t(task.titleKey)}</h4>
        </div>
        <span className="mercury-status-badge">{taskStatus(task, t)}</span>
      </div>
      <p className="mercury-task-description">{t(task.descriptionKey)}</p>
      {task.status !== 'assigned' && (
        <div className="mercury-task-progress" aria-label={t('common.percentComplete', { percent: formatNumber(progress) })}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="mercury-task-meta">
        {task.status !== 'assigned' && <span>{t('common.percentComplete', { percent: formatNumber(progress) })}</span>}
        <span>{remaining <= 0 ? t('mercury.deadlinePassed') : t('common.secondsLeft', { time: formatTime(remaining, t, formatNumber) })}</span>
        <span>{formatMoney(taskReward(task, state.elapsed), formatCurrency)} {t('mercury.rewardNow')}</span>
      </div>
      {task.status !== 'assigned' && (
        <div className="mercury-task-tags">
          <span>{location} · {t('mercury.pane', { count: formatNumber((task.slot ?? 0) + 1) })}</span>
          <span>{t('common.attempt', { count: formatNumber(task.attempt) })}</span>
          <span>{model.label}</span>
          {isMercuryAutoTask(task) && <span>Mercury</span>}
          {task.fastMode && <span>{t('mercury.fastModeOn')}</span>}
        </div>
      )}
      {task.status === 'approval' && <p className="mercury-task-note">{t('mercury.approveDeny')}</p>}
      {task.status === 'blocked' && <p className="mercury-task-note">{t('mercury.resume')}</p>}
      {task.status === 'failed' && (
        <p className="mercury-task-note mercury-task-retry-note">
          {failedRetryNote(state, task, t, formatNumber)}
        </p>
      )}
      {task.status === 'artifact' && (
        <p className="mercury-task-note">
          {t('mercury.automaticReturn', { amount: formatTaskTokens(MERCURY_FORWARD_COST) })}
        </p>
      )}
    </article>
  )
}

function TaskGroup({ state, title, tasks, empty, count }: {
  state: GameState
  title: string
  tasks: readonly WorkTask[]
  empty: string
  count: string
}) {
  return (
    <section className="mercury-task-group">
      <div className="mercury-section-heading">
        <h3>{title}</h3>
        <span className="mercury-count">{count}</span>
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
  const { t, formatNumber } = useI18n()
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  if (terminal === undefined) return null
  const local = isLocalTerminal(terminalId)
  const modelId = terminalModel(state, terminalId)
  const model = AGENT_MODELS[modelId]
  const paneCount = local ? 2 : terminal.slots
  const activeTasks = state.tasks.filter((task) => task.terminalId === terminalId && task.slot !== null && task.status !== 'assigned')
  const effectiveSpeed = model.speed * (local ? 1 : terminal.fastMode ? 2 : 1)
  const tokenMultiplier = local ? 0 : model.tokenMultiplier * (terminal.fastMode ? 2 : 1)
  const label = local
    ? terminalId === 'spark-ultra' ? 'Mapple Spark Ultra' : 'Mapple Spark'
    : terminalId === 'terminal-2' ? t('mercury.terminalTwo') : t('mercury.terminal')
  const formatTaskTokens = (amount: number): string => formatTokens(amount, t, formatNumber)
  return (
    <article className="mercury-terminal-card">
      <div className="mercury-terminal-heading">
        <div>
          <span className="mercury-eyebrow">{local ? t('mercury.localLane') : t('mercury.cloudLane')}</span>
          <h4>{label}</h4>
        </div>
        <span className={`mercury-terminal-state ${activeTasks.length > 0 ? 'is-busy' : ''}`}>
          {activeTasks.length > 0
            ? t('mercury.busy', { active: formatNumber(activeTasks.length), total: formatNumber(paneCount) })
            : t('common.idle')}
        </span>
      </div>
      <div className="mercury-terminal-model">
        <strong>{t('mercury.nextModel', { model: model.label })}</strong>
      </div>
      <div className="mercury-terminal-facts">
        <span><b>{t('mercury.intelligence')}</b> {formatNumber(model.intelligence)}/{formatNumber(4)}</span>
        <span><b>{t('mercury.effectiveSpeed')}</b> {formatNumber(effectiveSpeed, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×</span>
        <span><b>{t('mercury.tokenMultiplier')}</b> {formatNumber(tokenMultiplier)}×</span>
        <span><b>{t('mercury.location')}</b> {local ? t('mercury.localNoCharge') : t('mercury.cloudShared')}</span>
      </div>
      <div className="mercury-terminal-tags">
        <span>{paneCount === 1 ? t('common.pane', { count: formatNumber(paneCount) }) : t('common.panes', { count: formatNumber(paneCount) })}</span>
        <span>{terminal.yolo ? t('mercury.yoloOn') : t('mercury.yoloOff')}</span>
        <span>{local ? t('mercury.fastModeNA') : terminal.fastMode ? t('mercury.fastModeOn') : t('mercury.fastModeOff')}</span>
      </div>
      <div className="mercury-pane-list" aria-label={t('mercury.panesAria', { label })}>
        {Array.from({ length: paneCount }, (_, slot) => {
          const task = state.tasks.find((candidate) => candidate.terminalId === terminalId && candidate.slot === slot && candidate.status !== 'assigned')
          return (
            <div className={`mercury-pane ${task ? 'is-occupied' : ''}`} key={`${terminalId}-${slot}`}>
              <span>{t('mercury.pane', { count: formatNumber(slot + 1) })}</span>
              <strong title={task ? t(task.titleKey) : undefined}>{task ? t(task.titleKey) : t('common.idle')}</strong>
              {task && (
                <small>
                  {task.status === 'working' ? `${t('common.percentComplete', { percent: formatNumber(taskProgress(task)) })} · ` : ''}
                  {taskStatus(task, t)}
                </small>
              )}
            </div>
          )
        })}
      </div>
      {activeTasks.length > 0 && (
        <p className="mercury-terminal-costs">
          {t('mercury.taskTokensPaid', {
            amount: activeTasks.map((task) => formatTaskTokens(taskTokenCost(task, task.fastMode, taskSnapshotModel(task), task.local))).join(' · '),
          })}
        </p>
      )}
    </article>
  )
}

function WaitingReason({ state, queuedTasks, pausedTasks, artifacts, reservedReturnTokens }: {
  state: GameState
  queuedTasks: readonly WorkTask[]
  pausedTasks: readonly WorkTask[]
  artifacts: readonly WorkTask[]
  reservedReturnTokens: number
}) {
  const { t, formatNumber } = useI18n()
  const unreservedTokens = Math.max(0, state.tokens - reservedReturnTokens)
  let reason: string | null = null
  if (state.stage !== 'hired') {
    reason = t('mercury.endedReadOnly')
  } else if (!state.mercuryEnabled) {
    reason = t('mercury.handoffsOff')
  } else if (state.tokens < reservedReturnTokens) {
    reason = t('mercury.returnFeesNeed', { amount: formatTokens(reservedReturnTokens - state.tokens, t, formatNumber) })
  } else if (artifacts.some((task) => !isMercuryAutoTask(task)) && unreservedTokens < MERCURY_FORWARD_COST) {
    reason = t('mercury.returnWaiting', { amount: formatTokens(MERCURY_FORWARD_COST - unreservedTokens, t, formatNumber) })
  } else if (pausedTasks.length > 0) {
    reason = pausedTasks.length === 1
      ? t('mercury.pausedAttention', { count: formatNumber(pausedTasks.length) })
      : t('mercury.pausedAttentions', { count: formatNumber(pausedTasks.length) })
  } else if (queuedTasks.length > 0) {
    const freeTerminals = state.terminals.filter((terminal) => (
      state.tasks.filter((task) => task.terminalId === terminal.id && task.slot !== null && task.status !== 'assigned').length < terminal.slots
    ))
    if (freeTerminals.length === 0) reason = t('mercury.queueFreePane')
    else if (!queuedTasks.some((task) => freeTerminals.some((terminal) => canFundMercuryAttempt(state, task, terminal.id)))) {
      reason = t('mercury.queueFunds')
    }
  }
  return reason === null ? null : <p className="mercury-waiting" role="status">{reason}</p>
}

export function MercuryContent({ state, dispatch }: MercuryProps) {
  const { t, formatNumber } = useI18n()
  const [view, setView] = useState<'active' | 'queued' | 'terminals'>('active')
  const runningTasks = state.tasks.filter((task) => task.status === 'working')
  const pausedTasks = state.tasks.filter((task) => task.status === 'approval' || task.status === 'blocked')
  const failedTasks = state.tasks.filter((task) => task.status === 'failed')
  const artifacts = state.tasks.filter((task) => task.status === 'artifact')
  const queuedTasks = state.tasks.filter((task) => task.status === 'assigned')
  const reservedReturnTokens = mercuryReturnReservations(state.tasks, state.mercuryEnabled)
  const reservedReturnCount = reservedReturnTokens / MERCURY_FORWARD_COST
  const activeCount = state.tasks.length - queuedTasks.length
  return (
    <div className="mercury-app">
      <header className="mercury-header">
        <h2>{t('mercury.dashboard')}</h2>
        <label className="mercury-switch">
          <input
            type="checkbox"
            checked={state.mercuryEnabled}
            disabled={state.stage !== 'hired'}
            onChange={(event) => dispatch({ type: 'set-mercury', enabled: event.currentTarget.checked })}
          />
          <span className="mercury-switch-track" aria-hidden="true"><span /></span>
          <span>{state.mercuryEnabled ? t('mercury.mercuryOn') : t('mercury.mercuryOff')}</span>
        </label>
      </header>
      <div className="mercury-summary" aria-label={t('mercury.tokenBalanceAria')}>
        <div>
          <span>{t('mercury.balance')}</span>
          <strong>{formatTokens(state.tokens, t, formatNumber)}</strong>
          <small>{t('mercury.perHandoff')}</small>
        </div>
        <div>
          <span>{t('mercury.reservedReturns')}</span>
          <strong>{formatTokens(reservedReturnTokens, t, formatNumber)}</strong>
          <small>
            {reservedReturnCount === 1
              ? t('mercury.automaticTask', { count: formatNumber(reservedReturnCount) })
              : t('mercury.automaticTasks', { count: formatNumber(reservedReturnCount) })}
          </small>
        </div>
      </div>
      <FailedRetryNotice state={state} failedTasks={failedTasks} dispatch={dispatch} />
      <WaitingReason state={state} queuedTasks={queuedTasks} pausedTasks={pausedTasks} artifacts={artifacts} reservedReturnTokens={reservedReturnTokens} />
      <nav className="mercury-views" aria-label={t('mercury.viewsAria')}>
        <button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>{t('mercury.activeTasks', { count: formatNumber(activeCount) })}</button>
        <button type="button" aria-pressed={view === 'queued'} onClick={() => setView('queued')}>{t('mercury.queue', { count: formatNumber(queuedTasks.length) })}</button>
        <button type="button" aria-pressed={view === 'terminals'} onClick={() => setView('terminals')}>{t('mercury.terminals', { count: formatNumber(state.terminals.length) })}</button>
      </nav>
      <div className="mercury-panel" key={view}>
        {view === 'active' && (
          <>
            {artifacts.length > 0 && <TaskGroup state={state} title={t('mercury.readyDelivery')} tasks={artifacts} count={formatNumber(artifacts.length)} empty="" />}
            {pausedTasks.length > 0 && <TaskGroup state={state} title={t('mercury.paused')} tasks={pausedTasks} count={formatNumber(pausedTasks.length)} empty="" />}
            {failedTasks.length > 0 && <TaskGroup state={state} title={t('mercury.failed')} tasks={failedTasks} count={formatNumber(failedTasks.length)} empty="" />}
            <TaskGroup state={state} title={t('mercury.running')} tasks={runningTasks} count={formatNumber(runningTasks.length)} empty={t('mercury.noRunning')} />
          </>
        )}
        {view === 'queued' && (
          <TaskGroup
            state={state}
            title={t('mercury.assignmentQueue')}
            tasks={queuedTasks}
            count={formatNumber(queuedTasks.length)}
            empty={t('mercury.noAssignments')}
          />
        )}
        {view === 'terminals' && (
          <div className="mercury-terminal-grid">
            {state.terminals.map((terminal) => <TerminalCard key={terminal.id} state={state} terminalId={terminal.id} />)}
          </div>
        )}
      </div>
    </div>
  )
}


