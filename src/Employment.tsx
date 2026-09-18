import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import {
  AGENT_MODELS,
  availableModels,
  canFundTaskAttempt,
  isLocalTerminal,
  MAX_TOKENS,
  TOKEN_REFILL_INTERVAL_SECONDS,
  taskReward,
  taskSuccessChance,
  taskTokenCost,
  terminalModel,
  type AgentModelId,
  type EmploymentMessage,
  type EmploymentTaskSnapshot,
  type GameAction,
  type GameState,
  type JobId,
  type TerminalId,
  type WorkTask,
  upgradePrice,
} from './game'
import { DragDropHint } from './DragDropHints'
import { useDragDropHints, useDragDropSource, useDragDropTarget } from './DragDropHintsContext'
import type { DragDropSource } from './DragDropHintsContext'
import { UnreadIndicator } from './UnreadIndicator'
import { useUnreadMessages } from './useUnreadMessages'
import { useI18n, type Translate } from './i18n'
import './Employment.css'

type MessengerProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  /** Opens the installed social app. The reducer action is dispatched first. */
  onOpenSocial: () => void
}

type TerminalProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  terminalId: TerminalId
}

type Channel = 'general' | 'watercooler'

const formatMoney = (amount: number, locale: string): string => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Math.max(0, Number.isFinite(amount) ? amount : 0))

const formatSeconds = (seconds: number, t: Translate): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return minutes > 0
    ? t('common.durationMinutes', { minutes, seconds: String(remainder).padStart(2, '0') })
    : t('common.durationSeconds', { seconds: remainder })
}

const compactTokens = (amount: number, locale: string): string => new Intl.NumberFormat(locale, {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Math.max(0, amount))

const employerName = (state: GameState, jobId: JobId, t: Translate): string => (
  jobId === 'secondary'
    ? state.secondJob?.company ?? t('employment.employer.fallbackSecondary')
    : state.company ?? t('employment.employer.fallbackPrimary')
)

const employerBoss = (jobId: JobId): string => jobId === 'secondary' ? 'boss.dmg' : 'boss.exe'
const terminalLabel = (terminalId: TerminalId, t: Translate): string => {
  if (terminalId === 'terminal-2') return t('employment.terminal.nameTwo')
  if (terminalId === 'spark-ultra') return t('employment.terminal.nameSparkUltra')
  if (terminalId === 'spark') return t('employment.terminal.nameSpark')
  return t('employment.terminal.name')
}

const employerLevel = (state: GameState, jobId: JobId): 3 | 4 | 5 => (
  jobId === 'secondary' ? state.secondJob?.level ?? 3 : state.level
)
const taskModel = (task: Pick<WorkTask, 'model' | 'local'>): AgentModelId => (
  task.model ?? (task.local ? 'reasoning' : 'basic')
)

const taskCost = (task: Pick<WorkTask, 'difficulty' | 'fastMode' | 'model' | 'local'>): number => (
  taskTokenCost(task, task.fastMode, taskModel(task), task.local)
)

const taskStatusLabel = (task: WorkTask, t: Translate): string => {
  switch (task.status) {
    case 'assigned': return t('employment.task.newAssignment')
    case 'working': return t('employment.task.agentWorking')
    case 'approval': return t('employment.task.reviewNeeded')
    case 'blocked': return t('employment.task.waitingApproval')
    case 'artifact': return t('employment.task.artifactReady')
    case 'failed': return t('employment.task.attemptFailed')
  }
}

const isForwardedTask = (task: Pick<WorkTask, 'status' | 'terminalId'>): boolean => (
  task.terminalId !== null && task.status !== 'assigned'
)

const isPendingActionTask = (task: WorkTask): boolean => (
  task.status === 'assigned' || task.status === 'artifact' || task.status === 'failed'
)

const pendingActionDescription = (task: WorkTask, t: Translate): string => {
  if (task.status === 'assigned') return t('employment.pending.start', { title: t(task.titleKey) })
  if (task.status === 'artifact') return t('employment.pending.deliver', { artifact: task.artifactName })
  return t('employment.pending.retry', { title: t(task.titleKey) })
}

type PendingActionItem = {
  task: WorkTask
  messageId: string | null
}

function pendingActionMessageId(messages: readonly EmploymentMessage[], task: WorkTask): string | null {
  const message = task.status === 'failed'
    ? messages.find((candidate) => (
      candidate.type === 'attempt-failed' &&
      candidate.task.id === task.id &&
      candidate.task.attempt === task.attempt
    ))
    : messages.find((candidate) => (
      candidate.type === 'assignment' && candidate.task.id === task.id
    ))
  return message?.id ?? messages.find((candidate) => (
    candidate.type === 'assignment' && candidate.task.id === task.id
  ))?.id ?? null
}

const scrollBehavior = (): ScrollBehavior => (
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'
)

const taskMessageId = (message: EmploymentMessage): string | undefined => (
  message.type === 'assignment' || message.type === 'attempt-failed' || message.type === 'delivery'
    ? String(message.task.id)
    : undefined
)

const pendingTargetClass = (highlightedTaskId: number | null, message: EmploymentMessage): string => (
  highlightedTaskId !== null && taskMessageId(message) === String(highlightedTaskId)
    ? ' employment-pending-target'
    : ''
)

const messageWrapperProps = (message: EmploymentMessage): {
  'data-employment-message-id': string
  'data-employment-task-id'?: string
} => {
  const taskId = taskMessageId(message)
  return {
    'data-employment-message-id': message.id,
    ...(taskId === undefined ? {} : { 'data-employment-task-id': taskId }),
  }
}

const taskProgressLabel = (task: WorkTask, t: Translate): string => {
  if (task.status === 'assigned') return t('employment.task.notStarted')
  if (task.status === 'approval') return t('employment.task.pausedReview')
  if (task.status === 'blocked') return t('employment.task.blocked')
  if (task.status === 'artifact') return t('employment.task.complete')
  if (task.status === 'failed') return t('employment.task.attemptFailed')
  return t('common.percentComplete', { percent: Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100) })
}

const taskDeadline = (task: WorkTask, elapsed: number, t: Translate): string => {
  const remaining = task.deadlineAt - elapsed
  return remaining <= 0 ? t('employment.task.deadlinePassed') : t('employment.task.deadline', { time: formatSeconds(remaining, t) })
}

function findIdleTerminalSlot(tasks: readonly WorkTask[], terminalId: TerminalId, slotCount: number): number | null {
  for (let slot = 0; slot < slotCount; slot += 1) {
    if (!tasks.some((task) => task.terminalId === terminalId && task.slot === slot)) return slot
  }
  return null
}
type DropErrorState = {
  error: string | null
  showError: (reason: string) => void
  clearError: () => void
}

function useDropError(taskId?: number): DropErrorState {
  const [error, setError] = useState<{ reason: string; taskId?: number } | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const clearError = useCallback(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
    setError(null)
  }, [])
  const showError = useCallback((reason: string) => {
    clearTimeout(timeoutRef.current)
    setError({ reason, taskId })
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = undefined
      setError(null)
    }, 4000)
  }, [taskId])
  useEffect(() => () => {
    clearTimeout(timeoutRef.current)
  }, [])
  return { error: error?.taskId === taskId ? error?.reason ?? null : null, showError, clearError }
}
function nativeDragSource(event: DragEvent<HTMLElement>): DragDropSource | null {
  const types = event.dataTransfer.types
  if (types.includes('application/x-vibemaxxer-task')) {
    return { kind: 'task', id: event.dataTransfer.getData('application/x-vibemaxxer-task') }
  }
  if (types.includes('application/x-vibemaxxer-artifact')) {
    return { kind: 'artifact', id: event.dataTransfer.getData('application/x-vibemaxxer-artifact') }
  }
  if (types.includes('application/x-vibemaxxer-upgrade')) {
    return { kind: 'upgrade', id: event.dataTransfer.getData('application/x-vibemaxxer-upgrade') }
  }
  return null
}

function occupiedPaneReason(task: WorkTask, t: Translate): string {
  switch (task.status) {
    case 'working': return t('employment.drag.occupiedWorking')
    case 'approval': return t('employment.drag.occupiedApproval')
    case 'blocked': return t('employment.drag.occupiedBlocked')
    case 'failed': return t('employment.drag.occupiedFailed')
    case 'artifact': return t('employment.drag.occupiedArtifact')
    case 'assigned': return t('employment.drag.occupiedAssigned')
  }
}

function taskForwardingReason(
  state: GameState,
  source: DragDropSource,
  terminalId: TerminalId,
  fastMode: boolean,
  t: Translate,
  targetTask?: WorkTask,
  targetHasIdleSlot = true,
): string | null {
  if (source.kind !== 'task') return null
  if (state.stage !== 'hired') return t('employment.drag.endedTask')
  const taskId = Number(source.id)
  const task = Number.isInteger(taskId) ? state.tasks.find((candidate) => candidate.id === taskId) : undefined
  if (!task) return t('employment.drag.missingTask')
  if (task.status !== 'assigned' || task.terminalId !== null || task.slot !== null) return t('employment.drag.forwardedTask')
  if (targetTask !== undefined) return occupiedPaneReason(targetTask, t)
  if (!targetHasIdleSlot) return t('employment.drag.occupiedPanes')
  if (!canFundTaskAttempt(state, task, fastMode, terminalId)) return t('employment.drag.notEnoughTokens')
  return null
}

function artifactForwardingReason(state: GameState, source: DragDropSource, t: Translate): string | null {
  if (source.kind !== 'artifact') return null
  if (state.stage !== 'hired') return t('employment.drag.endedArtifact')
  const taskId = Number(source.id)
  const task = Number.isInteger(taskId) ? state.tasks.find((candidate) => candidate.id === taskId) : undefined
  if (!task || task.status !== 'artifact') return t('employment.drag.missingArtifact')
  return t('employment.drag.artifactMessenger')
}

function terminalDropReason(
  state: GameState,
  source: DragDropSource,
  terminalId: TerminalId,
  fastMode: boolean,
  t: Translate,
  targetTask?: WorkTask,
  targetHasIdleSlot = true,
): string | null {
  if (source.kind === 'upgrade') {
    if (source.id !== 'split' && source.id !== 'yolo' && source.id !== 'terminal') return null
    if (state.stage !== 'hired') return t('employment.drag.endedUpgrade')
    const target = source.id === 'terminal' ? 'terminal' : terminalId
    const price = upgradePrice(state, source.id, target)
    if (price === null) return t('employment.drag.unavailableUpgrade')
    return state.money < price ? t('employment.drag.notEnoughMoney') : null
  }
  return source.kind === 'task'
    ? taskForwardingReason(state, source, terminalId, fastMode, t, targetTask, targetHasIdleSlot)
    : artifactForwardingReason(state, source, t)
}


function focusDropWindow(element: HTMLElement | null) {
  element?.closest<HTMLElement>('.window')?.focus({ preventScroll: true })
}

function taskModelLabel(task: Pick<WorkTask, 'model' | 'local'>): string {
  return AGENT_MODELS[taskModel(task)]?.label ?? taskModel(task)
}


function TaskDifficulty({ complexity }: { complexity: number }) {
  const { t, formatNumber } = useI18n()
  const stars = Math.max(1, Math.min(5, Number.isFinite(complexity) ? Math.round(complexity) : 1))
  return (
    <span className="employment-task-rating" role="img" aria-label={`${formatNumber(stars)} ${stars === 1 ? t('employment.task.rating.star') : t('employment.task.rating.stars')}`}>
      {'★'.repeat(stars)}
    </span>
  )
}
function TaskAttachment({
  state,
  task,
  elapsed,
  archived = false,
}: {
  state: GameState
  task: WorkTask
  elapsed: number
  archived?: boolean
}) {
  const { t, locale, formatNumber } = useI18n()
  const isAssigned = task.status === 'assigned' && task.terminalId === null && task.slot === null
  const forwarded = !archived && isForwardedTask(task)
  const canStart = state.stage === 'hired' && !archived && isAssigned && state.terminals.some((terminal) => (
    canFundTaskAttempt(state, task, terminal.fastMode, terminal.id)
  ))
  const dragSource = useDragDropSource({ kind: 'task', id: String(task.id) }, canStart)
  const rewardAt = archived ? task.assignedAt : elapsed
  const reward = taskReward(task, rewardAt)
  return (
    <div
      className={`employment-attachment employment-task-attachment employment-task-${task.status} ${task.kind === 'architecture' ? 'employment-architecture-attachment' : ''} ${archived ? 'employment-archived-attachment' : ''} ${forwarded ? 'employment-forwarded-attachment' : ''}`}
      draggable={canStart}
      tabIndex={canStart ? 0 : undefined}
      onFocus={dragSource.onFocus}
      onBlur={dragSource.onBlur}
      onMouseEnter={dragSource.onMouseEnter}
      onMouseLeave={dragSource.onMouseLeave}
      onKeyDown={dragSource.onKeyDown}
      onPointerDown={dragSource.onPointerDown}
      onPointerCancel={dragSource.onPointerCancel}
      onLostPointerCapture={dragSource.onLostPointerCapture}
      onDragStart={(event) => {
        if (!canStart) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-vibemaxxer-task', String(task.id))
        event.dataTransfer.setData('text/plain', String(task.id))
        dragSource.onDragStart(event)
      }}
      onDragEnd={dragSource.onDragEnd}
      aria-label={t('employment.task.aria', { title: t(task.titleKey), company: employerName(state, task.jobId, t) })}
    >
      <div className="employment-attachment-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M8 8V5.5A2.5 2.5 0 1 0 5.5 8H18.5A2.5 2.5 0 1 0 16 5.5V18.5A2.5 2.5 0 1 0 18.5 16H5.5A2.5 2.5 0 1 0 8 18.5V8" />
        </svg>
      </div>
      <div className="employment-attachment-copy">
        <div className="employment-attachment-title-row">
          <strong>{t(task.titleKey)}</strong>
          <TaskDifficulty complexity={task.complexity} />
        </div>
        <span className="employment-employer-line">{employerName(state, task.jobId, t)}{task.local ? t('employment.task.local') : ''}</span>
        <span>{t(task.descriptionKey)}</span>
        {task.baseReward > 0 && (
        <span className="employment-reward-line">
          {archived
            ? t('employment.task.initialBonus', { amount: formatMoney(reward, locale) })
            : t('employment.task.rewardNow', { amount: formatMoney(reward, locale) })}
          <span className="employment-reward-decay">{archived ? '' : t('employment.task.deliverSooner')}</span>
        </span>
        )}
        {isAssigned && !archived ? state.terminals.map((terminal) => {
          const local = isLocalTerminal(terminal.id)
          const model = terminalModel(state, terminal.id)
          const label = terminalLabel(terminal.id, t)
          return (
            <div className="employment-attachment-meta employment-task-economy" key={terminal.id}>
              {state.terminals.length > 1 && <span>{label}</span>}
              <span>{t('employment.task.cost', { amount: compactTokens(taskTokenCost(task, terminal.fastMode, model, local), locale) })}</span>
              <span>{t('employment.task.successOdds', { percent: Math.round(taskSuccessChance(task, model) * 100) })}</span>
            </div>
          )
        }) : (
          <span className="employment-attachment-meta employment-task-economy">
            <span>{t('employment.task.cost', { amount: compactTokens(taskCost(task), locale) })}</span>
            {!archived && <span>{t('employment.task.successOdds', { percent: Math.round(taskSuccessChance(task, taskModel(task)) * 100) })}</span>}
          </span>
        )}
        <div className="employment-attachment-meta">
          <span>{archived ? t('employment.task.delivered') : taskStatusLabel(task, t)}</span>
          <span>{archived ? t('employment.task.complete') : taskProgressLabel(task, t)}</span>
          {!archived && <span>{taskDeadline(task, elapsed, t)}</span>}
          {forwarded && <span className="employment-forwarded-cue">{t('employment.task.forwarded')}</span>}
        </div>
      </div>
    </div>
  )
}

function taskFromSnapshot(snapshot: EmploymentTaskSnapshot): WorkTask {
  return {
    ...snapshot,
    nextApprovalAt: 0,
    terminalId: null,
    slot: null,
    approvalPromptKey: null,
  }
}

function taskForMessage(state: GameState, snapshot: EmploymentTaskSnapshot): { task: WorkTask; archived: boolean } {
  const active = state.tasks.find((candidate) => candidate.id === snapshot.id)
  return {
    task: active ?? taskFromSnapshot(snapshot),
    archived: active === undefined,
  }
}

function ArtifactAttachment({
  state,
  task,
  elapsed,
  disabled = false,
  archived = false,
  compact = false,
  messenger = false,
}: {
  state: GameState
  task: WorkTask
  elapsed: number
  disabled?: boolean
  archived?: boolean
  compact?: boolean
  messenger?: boolean
}) {
  const { t } = useI18n()
  const forwarded = messenger && !archived && isForwardedTask(task)
  const dragSource = useDragDropSource({ kind: 'artifact', id: String(task.id) }, !disabled)
  return (
    <div
      className={`employment-attachment employment-artifact-attachment ${task.kind === 'architecture' ? 'employment-architecture-attachment' : ''} ${archived ? 'employment-archived-attachment' : ''} ${forwarded ? 'employment-forwarded-attachment' : ''} ${compact ? 'employment-compact-attachment' : ''}`}
      draggable={!disabled}
      tabIndex={!disabled ? 0 : undefined}
      onFocus={dragSource.onFocus}
      onBlur={dragSource.onBlur}
      onMouseEnter={dragSource.onMouseEnter}
      onMouseLeave={dragSource.onMouseLeave}
      onKeyDown={dragSource.onKeyDown}
      onPointerDown={dragSource.onPointerDown}
      onPointerCancel={dragSource.onPointerCancel}
      onLostPointerCapture={dragSource.onLostPointerCapture}
      onDragStart={(event) => {
        if (disabled) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-vibemaxxer-artifact', String(task.id))
        event.dataTransfer.setData('text/plain', String(task.id))
        dragSource.onDragStart(event)
      }}
      onDragEnd={dragSource.onDragEnd}
      aria-label={t('employment.artifact.aria', { artifact: task.artifactName, company: employerName(state, task.jobId, t) })}
    >
      <div className="employment-attachment-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" focusable="false">
          <path d="M12 3 21 12 12 21 3 12Z" />
        </svg>
      </div>
      <div className="employment-attachment-copy">
        <strong>{task.artifactName}</strong>
        <span className="employment-employer-line">{employerName(state, task.jobId, t)}{task.local ? t('employment.task.local') : ''}</span>
        {forwarded && <span className="employment-forwarded-cue">{t('employment.task.forwarded')}</span>}
        {!compact && (
          <>
            <span>{archived ? t('employment.task.deliveredArtifact') : t('employment.task.readyDelivery')}</span>
            <div className="employment-attachment-meta">
              <span>{archived ? t('employment.task.delivered') : t('employment.task.artifactReady')}</span>
              <span>{archived ? t('employment.task.complete') : taskProgressLabel(task, t)}</span>
              {!archived && <span>{taskDeadline(task, elapsed, t)}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ChannelButton({
  channel,
  active,
  unread,
  onSelect,
}: {
  channel: Channel
  active: boolean
  unread: boolean
  onSelect: () => void
}) {
  const { t } = useI18n()
  return (
    <button
      className={`channel employment-channel-button ${active ? 'active-channel' : ''}`}
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <span aria-hidden="true">#</span> {t(`employment.channel.${channel}` as 'employment.channel.general' | 'employment.channel.watercooler')}
      {unread && <span className="employment-channel-badge" aria-label={t('employment.unread')}>1</span>}
    </button>
  )
}
function WatercoolerPane({
  state,
  onOpenSocial,
}: {
  state: GameState
  onOpenSocial: () => void
}) {
  const { t } = useI18n()
  const canOpen = state.stage === 'hired' && state.watercoolerUnlocked
  const installed = state.socialInstalledAt !== null
  return (
    <div className="employment-watercooler-pane" role="region" aria-label={t('employment.watercooler.aria')}>
      {state.watercoolerUnlocked ? (
      <div className="message-row employment-message-entry employment-watercooler-message">
        <div className="avatar" aria-hidden="true">M</div>
        <div className="message-body">
          <div className="message-meta"><strong>mira.from-product</strong><span>{t('employment.channel.watercooler')}</span></div>
          <p>{t('employment.watercooler.copy')}</p>
          <button
            className="employment-social-open-button"
            type="button"
            onClick={onOpenSocial}
            disabled={!canOpen}
          >
            <span aria-hidden="true">↗</span> {installed ? t('employment.watercooler.open') : t('employment.watercooler.install')}
          </button>
          {!installed && !canOpen && <span className="employment-control-hint">{t('employment.watercooler.keepWorking')}</span>}
          {installed && state.stage !== 'hired' && <span className="employment-control-hint">{t('employment.watercooler.readOnly')}</span>}
        </div>
      </div>
      ) : <p className="employment-control-hint">{t('employment.watercooler.empty')}</p>}
    </div>
  )
}

export function MessengerContent({ state, dispatch, onOpenSocial }: MessengerProps) {
  const { t, locale, formatNumber } = useI18n()
  const [reactionBurst, setReactionBurst] = useState(0)
  const [channel, setChannel] = useState<Channel>('general')
  const [selectedJobId, setActiveJobId] = useState<JobId>('primary')
  const [pendingActionIndex, setPendingActionIndex] = useState(0)
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null)
  const activeJobId = selectedJobId === 'secondary' && state.secondJob === null ? 'primary' : selectedJobId
  const reactionTimer = useRef<number | null>(null)
  const highlightTimer = useRef<number | null>(null)
  const firingRef = useRef<HTMLDivElement>(null)
  const chatPaneRef = useRef<HTMLDivElement>(null)
  const messengerRef = useRef<HTMLDivElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const [seenMessageIdsByJob, setSeenMessageIdsByJob] = useState<Record<JobId, Set<string>>>(() => ({
    primary: new Set(state.messages.filter((message) => message.jobId === 'primary').map((message) => message.id)),
    secondary: new Set(state.messages.filter((message) => message.jobId === 'secondary').map((message) => message.id)),
  }))
  useEffect(() => () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current)
  }, [])
  useEffect(() => {
    if (state.stage === 'lost') firingRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.stage])
  const seen = seenMessageIdsByJob[activeJobId]
  if (channel === 'general' && state.messages.some((message) => message.jobId === activeJobId && !seen.has(message.id))) {
    const nextSeen = new Set(seen)
    for (const message of state.messages) {
      if (message.jobId === activeJobId) nextSeen.add(message.id)
    }
    setSeenMessageIdsByJob({ ...seenMessageIdsByJob, [activeJobId]: nextSeen })
  }

  const activeJob = activeJobId === 'secondary' ? state.secondJob : state
  const visibleMessages = state.messages.filter((message) => message.jobId === activeJobId)
  const pendingActionItems: PendingActionItem[] = state.stage !== 'hired'
    ? []
    : state.tasks
      .filter((task) => task.jobId === activeJobId && isPendingActionTask(task))
      .map((task) => ({ task, messageId: pendingActionMessageId(visibleMessages, task) }))
  const unseenMessageCount = state.messages.reduce((count, message) => (
    message.jobId === activeJobId && !seenMessageIdsByJob[activeJobId].has(message.id) ? count + 1 : count
  ), 0)
  const pendingTaskCount = pendingActionItems.length
  const activeEmployerCue = unseenMessageCount + pendingTaskCount
  const otherEmployerId: JobId = activeJobId === 'primary' ? 'secondary' : 'primary'
  const otherEmployerPendingCount = state.stage !== 'hired' || (state.secondJob === null && otherEmployerId === 'secondary')
    ? 0
    : state.tasks.reduce((count, task) => (
      task.jobId === otherEmployerId && isPendingActionTask(task) ? count + 1 : count
    ), 0)
  const otherEmployerCue = state.secondJob === null && otherEmployerId === 'secondary'
    ? 0
    : state.messages.reduce((count, message) => (
      message.jobId === otherEmployerId && !seenMessageIdsByJob[otherEmployerId].has(message.id) ? count + 1 : count
    ), 0) + otherEmployerPendingCount
  const messageIds = visibleMessages.map((message) => message.id)
  const { unreadCount, scrollToLatest } = useUnreadMessages(messageIds, chatPaneRef, channel === 'general')
  const watercoolerUnread = state.watercoolerUnlocked && !state.watercoolerRead
  const artifactDropVisible = state.stage === 'hired' && isSourceActive('artifact')

  const currentPendingIndex = Math.min(pendingActionIndex, Math.max(0, pendingActionItems.length - 1))
  const currentPendingAction = pendingActionItems[currentPendingIndex]
  const activeHighlightedTaskId = pendingActionItems.some(({ task }) => task.id === highlightedTaskId)
    ? highlightedTaskId
    : null

  useDragDropTarget(messengerRef, {
    id: 'messenger-artifact',
    priority: 1,
    accepts: (source) => (
      source.kind === 'artifact' &&
      state.stage === 'hired' &&
      state.tasks.some((task) => String(task.id) === source.id && task.status === 'artifact')
    ),
    onDrop: (source) => {
      const id = Number(source.id)
      const task = state.tasks.find((candidate) => candidate.id === id)
      if (source.kind === 'artifact' && Number.isInteger(id) && task?.status === 'artifact') {
        dispatch({ type: 'deliver-task', id })
      }
    },
    onHover: () => focusDropWindow(messengerRef.current),
  })
  const reactToWelcome = () => {
    dispatch({ type: 'welcome-react', jobId: activeJobId })
    setReactionBurst((burst) => burst + 1)
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    reactionTimer.current = window.setTimeout(() => setReactionBurst(0), 750)
  }

  const selectChannel = (nextChannel: Channel) => {
    setChannel(nextChannel)
    if (nextChannel === 'watercooler' && state.watercoolerUnlocked && !state.watercoolerRead) {
      dispatch({ type: 'read-watercooler' })
    }
  }
  const locatePendingAction = () => {
    const item = currentPendingAction
    if (item === undefined) return
    const nextIndex = pendingActionItems.length > 1
      ? (currentPendingIndex + 1) % pendingActionItems.length
      : 0
    setPendingActionIndex(nextIndex)
    setChannel('general')
    setHighlightedTaskId(item.task.id)
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current)

    const messageTarget = item.messageId === null
      ? null
      : chatPaneRef.current?.querySelector<HTMLElement>(`[data-employment-message-id="${CSS.escape(item.messageId)}"]`)
    const target = messageTarget ?? chatPaneRef.current?.querySelector<HTMLElement>(`[data-employment-task-id="${item.task.id}"]`)
    if (target) {
      target.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
      highlightTimer.current = window.setTimeout(() => setHighlightedTaskId(null), 2200)
    }
  }


  const handleOpenSocial = () => {
    if (state.stage !== 'hired' || !state.watercoolerUnlocked) return
    dispatch({ type: 'install-social' })
    onOpenSocial()
  }

  const handleArtifactDrop = (event: DragEvent<HTMLDivElement>) => {
    if (state.stage !== 'hired') return
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-artifact')
    if (!kind) return
    event.preventDefault()
    const id = Number(kind)
    const task = state.tasks.find((candidate) => candidate.id === id)
    if (Number.isInteger(id) && task?.status === 'artifact') {
      dispatch({ type: 'deliver-task', id })
      clear()
    }
  }

  const renderGeneralMessage = (message: EmploymentMessage) => {
    const owner = employerName(state, message.jobId, t)
    const boss = employerBoss(message.jobId)
    const targetClass = pendingTargetClass(activeHighlightedTaskId, message)
    if (message.type === 'welcome') {
      const welcomed = activeJob?.welcomeReacted ?? false
      return (
        <div {...messageWrapperProps(message)} key={message.id}>
          <div className="welcome-banner employment-message-entry">
            <span aria-hidden="true">🎉</span> {t('employment.welcome.banner', { company: owner })}
          </div>
          <div className="message-row employment-message-entry">
            <div className="avatar boss-avatar" aria-hidden="true">B</div>
            <div className="message-body">
              <div className="message-meta"><strong>{boss}</strong><span>{owner} · {t('employment.message.justNow')}</span></div>
              <p>{t('employment.welcome.copy')}</p>
              <button
                className={`message-reaction employment-reaction-button ${welcomed ? 'employment-reaction-active' : ''}`}
                type="button"
                onClick={reactToWelcome}
                disabled={state.stage !== 'hired'}
                aria-pressed={welcomed}
              >
                🎉 {welcomed ? 2 : 1}
                {reactionBurst > 0 && <span className="employment-emoji-pop" key={reactionBurst} aria-hidden="true">🎉</span>}
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (message.type === 'assignment') {
      const currentTask = taskForMessage(state, message.task)
      return (
        <div {...messageWrapperProps(message)} className={`message-row employment-message-entry${targetClass}`} key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>{boss}</strong><span>{owner} · {t('employment.message.assignment')}</span></div>
            <p>{t('employment.message.nextAssignment')}</p>
            <TaskAttachment state={state} task={currentTask.task} elapsed={state.elapsed} archived={currentTask.archived} />
            {message.artifact !== null && (
              <ArtifactAttachment
                state={state}
                task={taskFromSnapshot(message.artifact)}
                elapsed={state.elapsed}
                disabled={currentTask.archived || state.stage !== 'hired'}
                archived={currentTask.archived}
                compact
                messenger
              />
            )}
          </div>
        </div>
      )
    }

    if (message.type === 'delivery') {
      return (
        <div {...messageWrapperProps(message)} className={`message-row employment-message-entry employment-delivery-entry${targetClass}`} key={message.id}>
          <div className="avatar self-avatar" aria-hidden="true">Y</div>
          <div className="message-body">
            <div className="message-meta"><strong>{t('employment.message.you')}</strong><span>{owner} · {t('employment.message.delivered')}</span></div>
            <p>{t(message.completedTasks === 1 ? 'employment.message.deliveryCopy' : 'employment.message.deliveriesCopy', {
              artifact: message.task.artifactName,
              count: formatNumber(message.completedTasks),
            })}</p>
            {message.reward > 0 && <p className="employment-delivery-reward"><span aria-hidden="true">💰</span> {t('employment.message.earnedBonus', { amount: formatMoney(message.reward, locale) })}</p>}
            <div className="employment-delivery-meta">
              <TaskDifficulty complexity={message.task.complexity} />
              <span>{t('employment.message.cost', { amount: compactTokens(taskCost(message.task), locale) })}</span>
              <span>{taskModelLabel(message.task)}</span>
              {message.task.local && <span>{t('employment.message.localTerminal')}</span>}
              {message.task.fastMode && <span>{t('employment.message.fastMode')}</span>}
              <span>{t('common.attempt', { count: Math.max(1, message.task.attempt) })}</span>
            </div>
          </div>
        </div>
      )
    }

    if (message.type === 'incentives') {
      return (
        <div {...messageWrapperProps(message)} className={`message-row employment-message-entry employment-milestone-entry employment-incentives-entry${targetClass}`} key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>{boss}</strong><span>{owner} · {t('employment.message.incentives')} · {formatSeconds(message.elapsed, t)}</span></div>
            <p>{t('employment.message.incentivesCopy')}</p>
          </div>
        </div>
      )
    }

    if (message.type === 'promotion') {
      return (
        <div {...messageWrapperProps(message)} className={`message-row employment-message-entry employment-milestone-entry employment-promotion-entry${targetClass}`} key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>{boss}</strong><span>{owner} · {t('employment.message.promotion')} · {formatSeconds(message.elapsed, t)}</span></div>
            <p>{t('employment.message.promotionCopy', { level: message.level })}</p>
          </div>
        </div>
      )
    }

    if (message.type === 'attempt-failed') {
      const currentTask = taskForMessage(state, message.task)
      const retryTerminalId = currentTask.task.terminalId ?? undefined
      const retryTerminal = state.terminals.find((terminal) => terminal.id === retryTerminalId)
      const retryFastMode = retryTerminal?.fastMode ?? false
      const retryCost = retryTerminal
        ? taskTokenCost(currentTask.task, retryFastMode, terminalModel(state, retryTerminal.id), isLocalTerminal(retryTerminal.id))
        : taskCost(currentTask.task)
      const currentFailure = !currentTask.archived && currentTask.task.status === 'failed' && currentTask.task.attempt === message.task.attempt
      const canRetry = state.stage === 'hired' && currentFailure && retryTerminal !== undefined && canFundTaskAttempt(state, currentTask.task, retryFastMode, retryTerminalId)
      return (
        <div {...messageWrapperProps(message)} className={`message-row employment-message-entry employment-attempt-failed-entry${targetClass}`} key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>agent-shell</strong><span>{owner} · {t('employment.message.attemptFailed')} · {formatSeconds(message.elapsed, t)}</span></div>
            <p>{t('employment.message.attemptFailedCopy', { title: t(message.task.titleKey) })}</p>
            <div className="employment-failed-summary">
              <TaskDifficulty complexity={message.task.complexity} />
              <span>{t('employment.message.cost', { amount: compactTokens(taskCost(message.task), locale) })}</span>
              <span>{taskModelLabel(message.task)}</span>
              {message.task.local && <span>{t('employment.message.localTerminal')}</span>}
              <span>{message.task.fastMode ? t('employment.message.fastMode') : t('employment.message.standardPace')}</span>
              <span>{t('common.attempt', { count: Math.max(1, message.task.attempt) })}</span>
            </div>
            {currentFailure && <button
              className="employment-terminal-button employment-retry-button"
              type="button"
              onClick={() => dispatch({ type: 'retry-task', id: message.task.id })}
              disabled={!canRetry}
            >
              {t('employment.message.retryAttempt', { amount: compactTokens(retryCost, locale) })}
            </button>}
            {state.stage === 'hired' && currentFailure && !canFundTaskAttempt(state, currentTask.task, retryFastMode, retryTerminalId) && <span className="employment-control-hint">{t('employment.message.needMoreTokens')}</span>}
          </div>
        </div>
      )
    }

    return (
      <div {...messageWrapperProps(message)} ref={firingRef} className={`message-row employment-message-entry employment-firing-entry${targetClass}`} key={message.id}>
        <div className="avatar boss-avatar" aria-hidden="true">B</div>
        <div className="message-body">
          <div className="message-meta"><strong>{boss}</strong><span>{owner} · {t('employment.message.now')}</span></div>
          <p>{t('employment.message.fired', { reason: t(message.failure) })}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={messengerRef}
      className={`messenger-app employment-messenger ${artifactDropVisible ? 'employment-drop-active' : ''}`}
      onDragOver={(event) => {
        if (state.stage === 'hired' && event.dataTransfer.types.includes('application/x-vibemaxxer-artifact')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={handleArtifactDrop}
    >
      <div className="messenger-sidebar">
        <div className="messenger-team">{t('employment.employers')}</div>
        <div className="employment-employer-selector" role="tablist" aria-label={t('employment.employer.aria')}>
          <button
            className={`employment-employer-option ${activeJobId === 'primary' ? 'active-employer' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeJobId === 'primary'}
            onClick={() => setActiveJobId('primary')}
          >
            <span className="employment-level-badge">L{employerLevel(state, 'primary')}</span>
            <span>{employerName(state, 'primary', t)}</span>
            {activeJobId === 'primary' ? activeEmployerCue > 0 && <span className="employment-employer-cue">{activeEmployerCue}</span> : otherEmployerCue > 0 && <span className="employment-employer-cue">{otherEmployerCue}</span>}
          </button>
          {state.secondJob !== null && (
            <button
              className={`employment-employer-option ${activeJobId === 'secondary' ? 'active-employer' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeJobId === 'secondary'}
              onClick={() => setActiveJobId('secondary')}
            >
              <span className="employment-level-badge">L{employerLevel(state, 'secondary')}</span>
              <span>{employerName(state, 'secondary', t)}</span>
              {activeJobId === 'secondary' ? activeEmployerCue > 0 && <span className="employment-employer-cue">{activeEmployerCue}</span> : otherEmployerCue > 0 && <span className="employment-employer-cue">{otherEmployerCue}</span>}
            </button>
          )}
        </div>
        <p className="sidebar-heading">{t('employment.channels')}</p>
        <ChannelButton channel="general" active={channel === 'general'} unread={unreadCount > 0} onSelect={() => selectChannel('general')} />
        <ChannelButton channel="watercooler" active={channel === 'watercooler'} unread={watercoolerUnread} onSelect={() => selectChannel('watercooler')} />
        <div className="channel employment-static-channel"><span className="online-dot" aria-hidden="true" /> {employerBoss(activeJobId)}</div>
      </div>
      <div className="chat-pane">
        <div className="chat-header">
          <div>
            <strong>#{t(`employment.channel.${channel}` as 'employment.channel.general' | 'employment.channel.watercooler')}</strong>
            <span>{channel === 'general' ? t('employment.channel.teamChat') : t('employment.channel.colleagueChat')}</span>
          </div>
          <span className="employment-chat-state">{employerName(state, activeJobId, t)} · {state.stage === 'hired' ? t('employment.status.online') : t('employment.status.archived')}</span>
          {state.secondJob !== null && (
            <select
              className="employment-mobile-employer"
              aria-label={t('employment.employer.aria')}
              value={activeJobId}
              onChange={(event) => setActiveJobId(event.currentTarget.value as JobId)}
            >
              <option value="primary">L{employerLevel(state, 'primary')} · {employerName(state, 'primary', t)} ({activeJobId === 'primary' ? activeEmployerCue : otherEmployerCue})</option>
              <option value="secondary">L{employerLevel(state, 'secondary')} · {employerName(state, 'secondary', t)} ({activeJobId === 'secondary' ? activeEmployerCue : otherEmployerCue})</option>
            </select>
          )}
          <nav className="employment-mobile-channel-tabs" aria-label={t('employment.channel.aria')}>
            <ChannelButton channel="general" active={channel === 'general'} unread={unreadCount > 0} onSelect={() => selectChannel('general')} />
            <ChannelButton channel="watercooler" active={channel === 'watercooler'} unread={watercoolerUnread} onSelect={() => selectChannel('watercooler')} />
          </nav>
        </div>
        {channel === 'general' && currentPendingAction !== undefined && (
          <div className="employment-pending-reminder" role="status">
            <span className="employment-pending-reminder-copy">
              <strong>{t(pendingTaskCount === 1 ? 'employment.pending.action' : 'employment.pending.actions', { count: pendingTaskCount })}</strong>
              <span>{pendingActionDescription(currentPendingAction.task, t)}</span>
            </span>
            <button
              className="employment-pending-reminder-button"
              type="button"
              onClick={locatePendingAction}
              aria-label={t('employment.pending.locateWork', {
                description: pendingActionDescription(currentPendingAction.task, t),
                count: pendingTaskCount,
                noun: pendingTaskCount === 1 ? 'action' : 'actions',
              })}
            >
              {t(pendingActionItems.length > 1 ? 'employment.pending.locateMany' : 'employment.pending.locateTask', {
                position: pendingActionItems.length > 1 ? `${pendingActionIndex + 1}` : '',
                count: pendingActionItems.length,
              })}
            </button>
          </div>
        )}
        <div ref={chatPaneRef} className="chat-scroll-region employment-general-pane" hidden={channel !== 'general'}>
          <div className="chat-messages">
            {visibleMessages.map(renderGeneralMessage)}
          </div>
        </div>
        <div className="chat-scroll-region employment-watercooler-wrapper" hidden={channel !== 'watercooler'}>
          <div className="chat-messages">
            <WatercoolerPane state={state} onOpenSocial={handleOpenSocial} />
          </div>
        </div>
        <UnreadIndicator count={channel === 'general' ? unreadCount : 0} onClick={scrollToLatest} />
      </div>
      <DragDropHint visible={artifactDropVisible}>{t('employment.drop.artifact')}</DragDropHint>
    </div>
  )
}
type TerminalLaneProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  terminalId: TerminalId
  slot: number
  task: WorkTask | undefined
  yolo: boolean
  fastMode: boolean
  windowError: string | null
  clearWindowError: () => void
}

function TerminalLane({ state, dispatch, terminalId, slot, task, yolo, fastMode, windowError, clearWindowError }: TerminalLaneProps) {
  const { t, locale } = useI18n()
  const laneRef = useRef<HTMLElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const { error, showError, clearError } = useDropError(task?.id)
  const visibleError = error ?? windowError
  const taskDropVisible = state.stage === 'hired' && !task && isSourceActive('task')

  useDragDropTarget(laneRef, {
    id: `terminal-lane-${terminalId}-${slot}`,
    priority: 3,
    accepts: (source) => terminalDropReason(state, source, terminalId, fastMode, t, task) === null && source.kind === 'task' && task === undefined,
    rejectionReason: (source) => terminalDropReason(state, source, terminalId, fastMode, t, task),
    onReject: showError,
    onDrop: (source) => {
      if (source.kind !== 'task') return
      const id = Number(source.id)
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (terminalDropReason(state, source, terminalId, fastMode, t, task) === null && Number.isInteger(id) && !task && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
        dispatch({ type: 'start-task', id, terminalId, slot })
        clearError()
        clearWindowError()
      }
    },
    onHover: () => focusDropWindow(laneRef.current),
  })
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const source = nativeDragSource(event)
    if (!source) return
    if (source.kind === 'upgrade') {
      const upgrade = source.id
      if (upgrade !== 'split' && upgrade !== 'yolo' && upgrade !== 'terminal') return
      const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
      event.preventDefault()
      event.stopPropagation()
      const reason = terminalDropReason(state, source, terminalId, fastMode, t, task)
      if (reason !== null) {
        showError(reason)
        return
      }
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: terminalTarget, source: 'drag' })
      clearError()
      clearWindowError()
      return
    }
    const reason = terminalDropReason(state, source, terminalId, fastMode, t, task)
    event.preventDefault()
    event.stopPropagation()
    if (reason !== null) {
      showError(reason)
      return
    }
    if (source.kind !== 'task') return
    const id = Number(source.id)
    const dropped = state.tasks.find((candidate) => candidate.id === id)
    if (Number.isInteger(id) && !task && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
      dispatch({ type: 'start-task', id, terminalId, slot })
      clear()
      clearError()
      clearWindowError()
    }
  }

  const approval = (approved: boolean) => {
    if (state.stage !== 'hired' || !task || (task.status !== 'approval' && task.status !== 'blocked')) return
    dispatch({ type: 'approve-task', id: task.id, approved })
  }
  const progress = task ? Math.min(100, Math.max(0, (task.progress / Math.max(1, task.difficulty)) * 100)) : 0
  const retryCost = task ? taskTokenCost(task, fastMode, terminalModel(state, terminalId), isLocalTerminal(terminalId)) : 0
  return (
    <section
      ref={laneRef}
      className={`employment-terminal-lane ${taskDropVisible ? 'employment-drop-active' : ''} ${task?.status === 'failed' ? 'employment-lane-failed' : ''}`}
      aria-label={t('employment.terminal.pane', { slot: slot + 1 })}
      onDragOver={(event) => {
        // Native dragover hides payload values; validate the item on drop.
        if (!nativeDragSource(event)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={handleDrop}
    >
      <div className="employment-lane-heading">
        <span>{task ? taskStatusLabel(task, t).toLowerCase() : yolo ? t('employment.terminal.yolo') : t('employment.terminal.idle')}</span>
        {task && <span>{t('employment.terminal.attempt', { count: Math.max(1, task.attempt) })}</span>}
      </div>
      {task && (
        <div className="employment-lane-task">
          <div className="employment-lane-title-row">
            <p><span className="terminal-prompt">~</span> {t('employment.terminal.task', { id: task.id, title: t(task.titleKey) })}</p>
            <TaskDifficulty complexity={task.complexity} />
          </div>
          <p className="employment-terminal-employer" title={employerName(state, task.jobId, t)}>{employerName(state, task.jobId, t)}</p>
          <div className={`employment-progress-wrap ${task.status === 'failed' ? 'employment-progress-failed' : ''}`} aria-label={t('employment.terminal.percentComplete', { percent: Math.round(progress) })}>
            <div className="employment-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="employment-terminal-stats">
            <span>{taskProgressLabel(task, t)}</span>
            <span>{t('employment.terminal.deadline', { time: taskDeadline(task, state.elapsed, t) })}</span>
            <span>{task.local ? t('employment.message.localTerminal') : taskModelLabel(task)}</span>
          </div>

          {task.status === 'approval' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              {task.approvalPromptKey !== null && <p className="terminal-muted">{t(task.approvalPromptKey)}</p>}
              <div className="employment-button-row">
                <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>{t('employment.terminal.approve')}</button>
                <button className="employment-terminal-button employment-danger-button" type="button" onClick={() => approval(false)} disabled={state.stage !== 'hired'}>{t('employment.terminal.deny')}</button>
              </div>
            </div>
          )}
          {task.status === 'blocked' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              {task.approvalPromptKey !== null && <p className="terminal-muted">{t(task.approvalPromptKey)}</p>}
              <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>{t('employment.terminal.approveResume')}</button>
            </div>
          )}

          {task.status === 'failed' && (
            <div className="employment-terminal-action-block employment-failed-block">
              <p className="terminal-muted">{t('employment.terminal.failedCopy')}</p>
              <button className="employment-terminal-button employment-retry-button" type="button" onClick={() => dispatch({ type: 'retry-task', id: task.id })} disabled={state.stage !== 'hired' || !canFundTaskAttempt(state, task, fastMode, terminalId)}>
                {t('employment.terminal.retry', { amount: compactTokens(retryCost, locale) })}
              </button>
            </div>
          )}

          {task.status === 'artifact' && (
            <div className="employment-terminal-action-block">
              <ArtifactAttachment state={state} task={task} elapsed={state.elapsed} disabled={state.stage !== 'hired'} compact />
            </div>
          )}
        </div>
      )}
      {visibleError !== null && (
        <p className="employment-drop-error" role="status" aria-live="polite">{visibleError}</p>
      )}
    </section>
  )
}

export function TerminalContent({ state, dispatch, terminalId }: TerminalProps) {
  const { t, locale } = useI18n()
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  const isLocal = isLocalTerminal(terminalId)
  const slots = isLocal ? 2 : terminal?.slots ?? 0
  const yolo = terminal?.yolo ?? false
  const fastMode = isLocal ? false : terminal?.fastMode ?? false
  const model = terminalModel(state, terminalId)
  const refillIn = TOKEN_REFILL_INTERVAL_SECONDS - state.elapsed % TOKEN_REFILL_INTERVAL_SECONDS
  const terminalRef = useRef<HTMLDivElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const { error, showError, clearError } = useDropError()
  const idleSlot = findIdleTerminalSlot(state.tasks, terminalId, slots)
  const taskDropVisible = state.stage === 'hired' && idleSlot !== null && isSourceActive('task')
  const upgradeDropVisible = state.stage === 'hired' && (['split', 'yolo', 'terminal'] as const).some((upgrade) => (
    isSourceActive('upgrade', upgrade) && upgradePrice(state, upgrade, upgrade === 'terminal' ? 'terminal' : terminalId) !== null
  ))
  useDragDropTarget(terminalRef, {
    id: `terminal-${terminalId}`,
    priority: 1,
    accepts: (source) => {
      if (source.kind === 'task') return terminalDropReason(state, source, terminalId, fastMode, t, undefined, idleSlot !== null) === null
      return source.kind === 'upgrade' &&
        (source.id === 'split' || source.id === 'yolo' || source.id === 'terminal') &&
        terminalDropReason(state, source, terminalId, fastMode, t) === null
    },
    rejectionReason: (source) => terminalDropReason(state, source, terminalId, fastMode, t, undefined, idleSlot !== null),
    onReject: showError,
    onDrop: (source) => {
      if (source.kind === 'upgrade') {
        if (state.stage !== 'hired' || (source.id !== 'split' && source.id !== 'yolo' && source.id !== 'terminal')) return
        const target = source.id === 'terminal' ? 'terminal' : terminalId
        if (upgradePrice(state, source.id, target) !== null) {
          dispatch({ type: 'buy-upgrade', upgrade: source.id, terminalId: target, source: 'drag' })
          clearError()
        }
        return
      }
      const reason = terminalDropReason(state, source, terminalId, fastMode, t, undefined, idleSlot !== null)
      if (reason !== null || source.kind !== 'task' || idleSlot === null) return
      const id = Number(source.id)
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (Number.isInteger(id) && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
        dispatch({ type: 'start-task', id, terminalId, slot: idleSlot })
        clearError()
      }
    },
    onHover: () => focusDropWindow(terminalRef.current),
  })
  const handleTerminalDrop = (event: DragEvent<HTMLDivElement>) => {
    const source = nativeDragSource(event)
    if (!source) return
    if (source.kind === 'upgrade') {
      const upgrade = source.id
      if (upgrade !== 'split' && upgrade !== 'yolo' && upgrade !== 'terminal') return
      const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
      event.preventDefault()
      event.stopPropagation()
      const reason = terminalDropReason(state, source, terminalId, fastMode, t)
      if (reason !== null) {
        showError(reason)
        return
      }
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: terminalTarget, source: 'drag' })
      clearError()
      return
    }
    const reason = terminalDropReason(state, source, terminalId, fastMode, t, undefined, idleSlot !== null)
    event.preventDefault()
    event.stopPropagation()
    if (reason !== null) {
      showError(reason)
      return
    }
    if (source.kind !== 'task' || idleSlot === null) return
    const id = Number(source.id)
    const dropped = state.tasks.find((candidate) => candidate.id === id)
    if (Number.isInteger(id) && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
      dispatch({ type: 'start-task', id, terminalId, slot: idleSlot })
      clear()
      clearError()
    }
  }

  const handleTerminalDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!nativeDragSource(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
  }

  const terminalLabel = isLocal ? terminalId === 'spark-ultra' ? 'Mapple Spark Ultra' : 'Mapple Spark' : terminalId === 'terminal-2' ? 'Terminal 2' : 'Terminal'
  return (
    <div
      ref={terminalRef}
      className={`terminal-app employment-terminal ${yolo ? 'employment-terminal-yolo' : ''} ${taskDropVisible || upgradeDropVisible ? 'employment-drop-active' : ''}`}
      onDragOver={handleTerminalDragOver}
      onDrop={handleTerminalDrop}
    >
      <div className="terminal-topline">
        <span>{terminalLabel} · {AGENT_MODELS[model].label}{yolo ? ` · ${t('employment.terminal.yolo')}` : ''}</span>
        {!isLocal && state.frontierModelUnlocked && (
          <label className="employment-model-selector">
            <span>{t('employment.terminal.model')}</span>
            <select
              value={model}
              disabled={state.stage !== 'hired'}
              onChange={(event) => dispatch({ type: 'set-terminal-model', terminalId, model: event.target.value as AgentModelId })}
              aria-label={t('employment.terminal.modelAria', { terminal: terminalId })}
            >
              {availableModels(state, terminalId).map((option) => (
                <option key={option} value={option}>{AGENT_MODELS[option].label}{AGENT_MODELS[option].tokenMultiplier > 1 ? ` · ${AGENT_MODELS[option].tokenMultiplier}× ${t('common.tokens', { amount: '' }).trim()}` : ''}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={`terminal-output employment-terminal-lanes panes-${slots}`} aria-label={t('employment.terminal.statusAria', { terminal: terminalId })}>
        {Array.from({ length: slots }, (_, slot) => (
          <TerminalLane
            key={`${terminalId}-${slot}`}
            state={state}
            dispatch={dispatch}
            terminalId={terminalId}
            slot={slot}
            task={state.tasks.find((candidate) => candidate.terminalId === terminalId && candidate.slot === slot)}
            yolo={yolo}
            fastMode={fastMode}
            windowError={error}
            clearWindowError={clearError}
          />
        ))}
        <p className="terminal-prompt terminal-cursor">~ <span className="cursor-block" aria-hidden="true" /></p>
      </div>
      <div className="employment-terminal-footer">
        <div className="employment-token-line">
          <span><strong>{isLocal ? `${terminalLabel} ${t('employment.terminal.localTokens')}` : formatNumber(state.tokens)}</strong>{isLocal ? t('employment.terminal.noTaskTokens') : t('employment.terminal.tokensAvailable')}</span>
          <span className="employment-refill-countdown">
            {isLocal ? t('employment.terminal.modelLabel', { model: AGENT_MODELS[model].label }) : state.tokens >= MAX_TOKENS ? t('employment.terminal.balanceFull') : t('employment.terminal.refillIn', { time: formatSeconds(refillIn, t) })}
          </span>
        </div>
      </div>
      <DragDropHint visible={taskDropVisible || upgradeDropVisible}>
        {taskDropVisible ? t('employment.terminal.dropTask') : t('employment.terminal.dropUpgrade')}
      </DragDropHint>
    </div>
  )
}
