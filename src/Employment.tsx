import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import {
  AGENT_MODELS,
  availableModels,
  canFundTaskAttempt,
  isLocalTerminal,
  MAX_TOKENS,
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

const compactTokens = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatMoney = (amount: number): string => `$${moneyFormatter.format(Math.max(0, Number.isFinite(amount) ? amount : 0))}`

const formatSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return minutes > 0 ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${remainder}s`
}

const employerName = (state: GameState, jobId: JobId): string => (
  jobId === 'secondary' ? state.secondJob?.company ?? 'Second employer' : state.company ?? 'Primary employer'
)

const employerBoss = (jobId: JobId): string => jobId === 'secondary' ? 'boss.dmg' : 'boss.exe'

const employerLevel = (state: GameState, jobId: JobId): 3 | 4 | 5 => (
  jobId === 'secondary' ? state.secondJob?.level ?? 3 : state.level
)
const taskModel = (task: Pick<WorkTask, 'model' | 'local'>): AgentModelId => (
  task.model ?? (task.local ? 'reasoning' : 'basic')
)

const taskCost = (task: Pick<WorkTask, 'difficulty' | 'fastMode' | 'model' | 'local'>): number => (
  taskTokenCost(task, task.fastMode, taskModel(task), task.local)
)

const taskStatusLabel = (task: WorkTask): string => {
  switch (task.status) {
    case 'assigned':
      return 'New assignment'
    case 'working':
      return 'Agent working'
    case 'approval':
      return 'Review needed'
    case 'blocked':
      return 'Waiting on approval'
    case 'artifact':
      return 'Artifact ready'
    case 'failed':
      return 'Attempt failed'
  }
}
const isForwardedTask = (task: Pick<WorkTask, 'status' | 'terminalId'>): boolean => (
  task.terminalId !== null && task.status !== 'assigned'
)

const isPendingActionTask = (task: WorkTask): boolean => (
  task.status === 'assigned' || task.status === 'artifact' || task.status === 'failed'
)

const pendingActionDescription = (task: WorkTask): string => {
  if (task.status === 'assigned') return `Start “${task.title}”`
  if (task.status === 'artifact') return `Deliver “${task.artifactName}”`
  return `Retry “${task.title}”`
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

const taskProgressLabel = (task: WorkTask): string => {
  if (task.status === 'assigned') return 'Not started'
  if (task.status === 'approval') return 'Paused for review'
  if (task.status === 'blocked') return 'Blocked'
  if (task.status === 'artifact') return 'Complete'
  if (task.status === 'failed') return 'Attempt failed'
  return `${Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)}% complete`
}


const taskDeadline = (task: WorkTask, elapsed: number): string => {
  const remaining = task.deadlineAt - elapsed
  return remaining <= 0 ? 'Deadline passed' : `${formatSeconds(remaining)} left`
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

function useDropError(): DropErrorState {
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const clearError = useCallback(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
    setError(null)
  }, [])
  const showError = useCallback((reason: string) => {
    clearTimeout(timeoutRef.current)
    setError(reason)
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = undefined
      setError(null)
    }, 4000)
  }, [])
  useEffect(() => () => {
    clearTimeout(timeoutRef.current)
  }, [])
  return { error, showError, clearError }
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

function occupiedPaneReason(task: WorkTask): string {
  switch (task.status) {
    case 'working':
      return 'This pane is already running another task.'
    case 'approval':
      return 'This pane is waiting for approval.'
    case 'blocked':
      return 'This pane is blocked pending approval.'
    case 'failed':
      return 'This pane contains a failed attempt.'
    case 'artifact':
      return 'This pane already has an undelivered artifact.'
    case 'assigned':
      return 'This pane is already reserved for another task.'
  }
}

function taskForwardingReason(
  state: GameState,
  source: DragDropSource,
  terminalId: TerminalId,
  fastMode: boolean,
  targetTask?: WorkTask,
  targetHasIdleSlot = true,
): string | null {
  if (source.kind !== 'task') return null
  if (state.stage !== 'hired') return 'This run has ended; tasks can no longer be forwarded.'
  const taskId = Number(source.id)
  const task = Number.isInteger(taskId) ? state.tasks.find((candidate) => candidate.id === taskId) : undefined
  if (!task) return 'This task is no longer available to forward.'
  if (task.status !== 'assigned' || task.terminalId !== null || task.slot !== null) {
    return 'This task was already forwarded or is no longer available.'
  }
  if (targetTask !== undefined) return occupiedPaneReason(targetTask)
  if (!targetHasIdleSlot) return 'All terminal panes are occupied. Drop onto an empty pane.'
  if (!canFundTaskAttempt(state, task, fastMode, terminalId)) return 'Not enough tokens to start this task here.'
  return null
}

function artifactForwardingReason(state: GameState, source: DragDropSource): string | null {
  if (source.kind !== 'artifact') return null
  if (state.stage !== 'hired') return 'This run has ended; artifacts can no longer be forwarded.'
  const taskId = Number(source.id)
  const task = Number.isInteger(taskId) ? state.tasks.find((candidate) => candidate.id === taskId) : undefined
  if (!task || task.status !== 'artifact') return 'This artifact is no longer available.'
  return 'Artifacts can only be delivered in Messenger, not a terminal.'
}

function terminalDropReason(
  state: GameState,
  source: DragDropSource,
  terminalId: TerminalId,
  fastMode: boolean,
  targetTask?: WorkTask,
  targetHasIdleSlot = true,
): string | null {
  return source.kind === 'task'
    ? taskForwardingReason(state, source, terminalId, fastMode, targetTask, targetHasIdleSlot)
    : artifactForwardingReason(state, source)
}


function focusDropWindow(element: HTMLElement | null) {
  element?.closest<HTMLElement>('.window')?.focus({ preventScroll: true })
}

function taskModelLabel(task: Pick<WorkTask, 'model' | 'local'>): string {
  return AGENT_MODELS[taskModel(task)]?.label ?? taskModel(task)
}


function TaskDifficulty({ complexity }: { complexity: number }) {
  const stars = Math.max(1, Math.min(5, Number.isFinite(complexity) ? Math.round(complexity) : 1))
  return (
    <span className="employment-task-rating" role="img" aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'}`}>
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
      aria-label={`Task: ${task.title} for ${employerName(state, task.jobId)}`}
    >
      <div className="employment-attachment-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M8 8V5.5A2.5 2.5 0 1 0 5.5 8H18.5A2.5 2.5 0 1 0 16 5.5V18.5A2.5 2.5 0 1 0 18.5 16H5.5A2.5 2.5 0 1 0 8 18.5V8" />
        </svg>
      </div>
      <div className="employment-attachment-copy">
        <div className="employment-attachment-title-row">
          <strong>{task.title}</strong>
          <TaskDifficulty complexity={task.complexity} />
        </div>
        <span className="employment-employer-line">{employerName(state, task.jobId)}{task.local ? ' · Local terminal' : ''}</span>
        <span>{task.description}</span>
        {task.baseReward > 0 && (
        <span className="employment-reward-line">
          <span className="employment-reward-bag" aria-hidden="true">💰</span>
          {archived ? `${formatMoney(reward)} initial bonus` : `${formatMoney(reward)} reward now`}
          <span className="employment-reward-decay">{archived ? '' : ' · deliver sooner for more'}</span>
        </span>
        )}
        {isAssigned && !archived ? state.terminals.map((terminal) => {
          const local = isLocalTerminal(terminal.id)
          const model = terminalModel(state, terminal.id)
          const label = local ? terminal.id === 'spark-ultra' ? 'Spark Ultra' : 'Spark' : terminal.id === 'terminal-2' ? 'Terminal 2' : 'Terminal'
          return (
            <div className="employment-attachment-meta employment-task-economy" key={terminal.id}>
              {state.terminals.length > 1 && <span>{label}</span>}
              <span>Cost: {compactTokens.format(taskTokenCost(task, terminal.fastMode, model, local))} tokens</span>
              <span>Success odds: {Math.round(taskSuccessChance(task, model) * 100)}%</span>
            </div>
          )
        }) : (
          <span className="employment-attachment-meta employment-task-economy">
            <span>Cost: {compactTokens.format(taskCost(task))} tokens</span>
            {!archived && <span>Success odds: {Math.round(taskSuccessChance(task, taskModel(task)) * 100)}%</span>}
          </span>
        )}
        <div className="employment-attachment-meta">
          <span>{archived ? 'Delivered' : taskStatusLabel(task)}</span>
          <span>{archived ? 'Complete' : taskProgressLabel(task)}</span>
          {!archived && <span>{taskDeadline(task, elapsed)}</span>}
          {forwarded && <span className="employment-forwarded-cue">Forwarded to terminal</span>}
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
    approvalPrompt: null,
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
      aria-label={`Artifact ${task.artifactName} for ${employerName(state, task.jobId)}`}
    >
      <div className="employment-attachment-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" focusable="false">
          <path d="M12 3 21 12 12 21 3 12Z" />
        </svg>
      </div>
      <div className="employment-attachment-copy">
        <strong>{task.artifactName}</strong>
        <span className="employment-employer-line">{employerName(state, task.jobId)}{task.local ? ' · Local terminal' : ''}</span>
        {forwarded && <span className="employment-forwarded-cue">Forwarded to terminal</span>}
        {!compact && (
          <>
            <span>{archived ? 'Delivered artifact' : 'Ready for delivery'}</span>
            <div className="employment-attachment-meta">
              <span>{archived ? 'Delivered' : 'Artifact ready'}</span>
              <span>{archived ? 'Complete' : taskProgressLabel(task)}</span>
              {!archived && <span>{taskDeadline(task, elapsed)}</span>}
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
  return (
    <button
      className={`channel employment-channel-button ${active ? 'active-channel' : ''}`}
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <span aria-hidden="true">#</span> {channel}
      {unread && <span className="employment-channel-badge" aria-label="1 unread">1</span>}
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
  const canOpen = state.stage === 'hired' && state.watercoolerUnlocked
  const installed = state.socialInstalledAt !== null
  return (
    <div className="employment-watercooler-pane" role="region" aria-label="Watercooler channel">
      {state.watercoolerUnlocked ? (
      <div className="message-row employment-message-entry employment-watercooler-message">
        <div className="avatar" aria-hidden="true">M</div>
        <div className="message-body">
          <div className="message-meta"><strong>mira.from-product</strong><span>watercooler</span></div>
          <p>Running low on tokens? Tiro’s free usage-reset campaign on Vibemaxxers' Social Network applies the initial reset automatically when you install it. Like posts for another chance.</p>
          <button
            className="employment-social-open-button"
            type="button"
            onClick={onOpenSocial}
            disabled={!canOpen}
          >
            <span aria-hidden="true">↗</span> {installed ? 'Open Social Network' : 'Install Social Network and open it'}
          </button>
          {!installed && !canOpen && <span className="employment-control-hint">Keep working until this channel unlocks.</span>}
          {installed && state.stage !== 'hired' && <span className="employment-control-hint">The social network is read-only after the run ends.</span>}
        </div>
      </div>
      ) : <p className="employment-control-hint">No messages yet.</p>}
    </div>
  )
}

export function MessengerContent({ state, dispatch, onOpenSocial }: MessengerProps) {
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
    const owner = employerName(state, message.jobId)
    const boss = employerBoss(message.jobId)
    const targetClass = pendingTargetClass(activeHighlightedTaskId, message)
    if (message.type === 'welcome') {
      const welcomed = activeJob?.welcomeReacted ?? false
      return (
        <div {...messageWrapperProps(message)} key={message.id}>
          <div className="welcome-banner employment-message-entry">
            <span aria-hidden="true">🎉</span> Welcome to {owner}
          </div>
          <div className="message-row employment-message-entry">
            <div className="avatar boss-avatar" aria-hidden="true">B</div>
            <div className="message-body">
              <div className="message-meta"><strong>{boss}</strong><span>{owner} · just now</span></div>
              <p>Welcome aboard. Your workspace is ready.</p>
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
            <div className="message-meta"><strong>{boss}</strong><span>{owner} · assignment</span></div>
            <p>Next assignment.</p>
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
            <div className="message-meta"><strong>You</strong><span>{owner} · delivered</span></div>
            <p>Delivered <strong>{message.task.artifactName}</strong>. {message.completedTasks} assignment{message.completedTasks === 1 ? '' : 's'} complete.</p>
            {message.reward > 0 && <p className="employment-delivery-reward"><span aria-hidden="true">💰</span> Earned {formatMoney(message.reward)} completion bonus.</p>}
            <div className="employment-delivery-meta">
              <TaskDifficulty complexity={message.task.complexity} />
              <span>Cost {compactTokens.format(taskCost(message.task))} tokens</span>
              <span>{taskModelLabel(message.task)}</span>
              {message.task.local && <span>Local terminal</span>}
              {message.task.fastMode && <span>Fast mode</span>}
              <span>Attempt {Math.max(1, message.task.attempt)}</span>
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
            <div className="message-meta"><strong>{boss}</strong><span>{owner} · incentives · {formatSeconds(message.elapsed)}</span></div>
            <p>New assignments include a cash bonus. Deliver sooner to earn more; deadlines still apply.</p>
          </div>
        </div>
      )
    }

    if (message.type === 'promotion') {
      return (
        <div {...messageWrapperProps(message)} className={`message-row employment-message-entry employment-milestone-entry employment-promotion-entry${targetClass}`} key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>{boss}</strong><span>{owner} · promotion · {formatSeconds(message.elapsed)}</span></div>
            <p>You are promoted to <strong>Level {message.level}</strong>. Keep shipping.</p>
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
            <div className="message-meta"><strong>agent-shell</strong><span>{owner} · attempt failed · {formatSeconds(message.elapsed)}</span></div>
            <p><strong>{message.task.title}</strong> did not pass the completion check. No artifact or bonus was produced.</p>
            <div className="employment-failed-summary">
              <TaskDifficulty complexity={message.task.complexity} />
              <span>Cost {compactTokens.format(taskCost(message.task))} tokens</span>
              <span>{taskModelLabel(message.task)}</span>
              {message.task.local && <span>Local terminal</span>}
              <span>{message.task.fastMode ? 'Fast mode' : 'Standard pace'}</span>
              <span>Attempt {Math.max(1, message.task.attempt)}</span>
            </div>
            {currentFailure && <button
              className="employment-terminal-button employment-retry-button"
              type="button"
              onClick={() => dispatch({ type: 'retry-task', id: message.task.id })}
              disabled={!canRetry}
            >
              Retry attempt · {compactTokens.format(retryCost)} tokens
            </button>}
            {state.stage === 'hired' && currentFailure && !canFundTaskAttempt(state, currentTask.task, retryFastMode, retryTerminalId) && <span className="employment-control-hint">Need more tokens before this lane can retry.</span>}
          </div>
        </div>
      )
    }

    return (
      <div {...messageWrapperProps(message)} ref={firingRef} className={`message-row employment-message-entry employment-firing-entry${targetClass}`} key={message.id}>
        <div className="avatar boss-avatar" aria-hidden="true">B</div>
        <div className="message-body">
          <div className="message-meta"><strong>{boss}</strong><span>{owner} · now</span></div>
          <p>You are fired. {message.failure}</p>
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
        <div className="messenger-team">Employers</div>
        <div className="employment-employer-selector" role="tablist" aria-label="Employers">
          <button
            className={`employment-employer-option ${activeJobId === 'primary' ? 'active-employer' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeJobId === 'primary'}
            onClick={() => setActiveJobId('primary')}
          >
            <span className="employment-level-badge">L{employerLevel(state, 'primary')}</span>
            <span>{employerName(state, 'primary')}</span>
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
              <span>{employerName(state, 'secondary')}</span>
              {activeJobId === 'secondary' ? activeEmployerCue > 0 && <span className="employment-employer-cue">{activeEmployerCue}</span> : otherEmployerCue > 0 && <span className="employment-employer-cue">{otherEmployerCue}</span>}
            </button>
          )}
        </div>
        <p className="sidebar-heading">Channels</p>
        <ChannelButton channel="general" active={channel === 'general'} unread={unreadCount > 0} onSelect={() => selectChannel('general')} />
        <ChannelButton channel="watercooler" active={channel === 'watercooler'} unread={watercoolerUnread} onSelect={() => selectChannel('watercooler')} />
        <div className="channel employment-static-channel"><span className="online-dot" aria-hidden="true" /> {employerBoss(activeJobId)}</div>
      </div>
      <div className="chat-pane">
        <div className="chat-header">
          <div>
            <strong>#{channel}</strong>
            <span>{channel === 'general' ? 'Team chat' : 'Colleague chat'}</span>
          </div>
          <span className="employment-chat-state">{employerName(state, activeJobId)} · {state.stage === 'hired' ? 'online' : 'archived'}</span>
          {state.secondJob !== null && (
            <select
              className="employment-mobile-employer"
              aria-label="Employer"
              value={activeJobId}
              onChange={(event) => setActiveJobId(event.currentTarget.value as JobId)}
            >
              <option value="primary">L{employerLevel(state, 'primary')} · {employerName(state, 'primary')} ({activeJobId === 'primary' ? activeEmployerCue : otherEmployerCue})</option>
              <option value="secondary">L{employerLevel(state, 'secondary')} · {employerName(state, 'secondary')} ({activeJobId === 'secondary' ? activeEmployerCue : otherEmployerCue})</option>
            </select>
          )}
          <nav className="employment-mobile-channel-tabs" aria-label="Messenger channels">
            <ChannelButton channel="general" active={channel === 'general'} unread={unreadCount > 0} onSelect={() => selectChannel('general')} />
            <ChannelButton channel="watercooler" active={channel === 'watercooler'} unread={watercoolerUnread} onSelect={() => selectChannel('watercooler')} />
          </nav>
        </div>
        {channel === 'general' && currentPendingAction !== undefined && (
          <div className="employment-pending-reminder" role="status">
            <span className="employment-pending-reminder-copy">
              <strong>{pendingTaskCount} pending {pendingTaskCount === 1 ? 'action' : 'actions'}</strong>
              <span>{pendingActionDescription(currentPendingAction.task)}</span>
            </span>
            <button
              className="employment-pending-reminder-button"
              type="button"
              onClick={locatePendingAction}
              aria-label={`Locate pending work: ${pendingActionDescription(currentPendingAction.task)}. ${pendingTaskCount} pending ${pendingTaskCount === 1 ? 'action' : 'actions'}.`}
            >
              Locate {pendingActionItems.length > 1 ? `${pendingActionIndex + 1} of ${pendingActionItems.length}` : 'task'}
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
      <DragDropHint visible={artifactDropVisible}>Drop artifact here</DragDropHint>
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
}

function TerminalLane({ state, dispatch, terminalId, slot, task, yolo, fastMode }: TerminalLaneProps) {
  const laneRef = useRef<HTMLElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const { error, showError, clearError } = useDropError()
  const taskDropVisible = state.stage === 'hired' && !task && isSourceActive('task')

  useDragDropTarget(laneRef, {
    id: `terminal-lane-${terminalId}-${slot}`,
    priority: 3,
    accepts: (source) => terminalDropReason(state, source, terminalId, fastMode, task) === null && source.kind === 'task' && task === undefined,
    rejectionReason: (source) => terminalDropReason(state, source, terminalId, fastMode, task),
    onReject: showError,
    onDrop: (source) => {
      if (source.kind !== 'task') return
      const id = Number(source.id)
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (terminalDropReason(state, source, terminalId, fastMode, task) === null && Number.isInteger(id) && !task && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
        dispatch({ type: 'start-task', id, terminalId, slot })
        clearError()
      }
    },
    onHover: () => focusDropWindow(laneRef.current),
  })
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const source = nativeDragSource(event)
    if (!source) return
    if (source.kind === 'upgrade') {
      if (state.stage !== 'hired') return
      const upgrade = source.id
      if (upgrade !== 'split' && upgrade !== 'yolo' && upgrade !== 'terminal') return
      const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
      if (upgradePrice(state, upgrade, terminalTarget) === null) return
      event.preventDefault()
      event.stopPropagation()
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: terminalTarget, source: 'drag' })
      clearError()
      return
    }
    const reason = terminalDropReason(state, source, terminalId, fastMode, task)
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
      aria-label={`Terminal agent pane ${slot + 1}`}
      onDragOver={(event) => {
        const source = nativeDragSource(event)
        if (!source) return
        if (source.kind === 'upgrade') {
          const upgrade = source.id
          const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
          if (state.stage === 'hired' && (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') && upgradePrice(state, upgrade, terminalTarget) !== null) {
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'move'
          }
          return
        }
        const reason = terminalDropReason(state, source, terminalId, fastMode, task)
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={handleDrop}
    >
      <div className="employment-lane-heading">
        <span>{task ? taskStatusLabel(task).toLowerCase() : yolo ? 'YOLO' : 'idle'}</span>
        {task && <span>attempt {Math.max(1, task.attempt)}</span>}
      </div>
      {task && (
        <div className="employment-lane-task">
          <div className="employment-lane-title-row">
            <p><span className="terminal-prompt">~</span> task/{task.id} · {task.title}</p>
            <TaskDifficulty complexity={task.complexity} />
          </div>
          <p className="employment-terminal-employer" title={employerName(state, task.jobId)}>{employerName(state, task.jobId)}</p>
          <div className={`employment-progress-wrap ${task.status === 'failed' ? 'employment-progress-failed' : ''}`} aria-label={`${Math.round(progress)} percent complete`}>
            <div className="employment-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="employment-terminal-stats">
            <span>{taskProgressLabel(task)}</span>
            <span>deadline {taskDeadline(task, state.elapsed)}</span>
            <span>{task.local ? 'Local terminal' : taskModelLabel(task)}</span>
          </div>

          {task.status === 'approval' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              <p className="terminal-muted">{task.approvalPrompt}</p>
              <div className="employment-button-row">
                <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>Approve</button>
                <button className="employment-terminal-button employment-danger-button" type="button" onClick={() => approval(false)} disabled={state.stage !== 'hired'}>Deny</button>
              </div>
            </div>
          )}
          {task.status === 'blocked' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              <p className="terminal-muted">{task.approvalPrompt}</p>
              <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>Approve and resume</button>
            </div>
          )}

          {task.status === 'failed' && (
            <div className="employment-terminal-action-block employment-failed-block">
              <p className="terminal-muted">This attempt failed. Retry keeps the deadline.</p>
              <button className="employment-terminal-button employment-retry-button" type="button" onClick={() => dispatch({ type: 'retry-task', id: task.id })} disabled={state.stage !== 'hired' || !canFundTaskAttempt(state, task, fastMode, terminalId)}>
                Retry · {compactTokens.format(retryCost)} tokens
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
      {error !== null && (
        <p className="employment-drop-error" role="status" aria-live="polite">{error}</p>
      )}
    </section>
  )
}

export function TerminalContent({ state, dispatch, terminalId }: TerminalProps) {
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  const isLocal = isLocalTerminal(terminalId)
  const slots = isLocal ? 2 : terminal?.slots ?? 0
  const yolo = terminal?.yolo ?? false
  const fastMode = isLocal ? false : terminal?.fastMode ?? false
  const model = terminalModel(state, terminalId)
  const refillIn = 100 - (state.elapsed % 100 || 0)
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
      if (source.kind === 'task') return terminalDropReason(state, source, terminalId, fastMode, undefined, idleSlot !== null) === null
      return state.stage === 'hired' &&
        source.kind === 'upgrade' &&
        (source.id === 'split' || source.id === 'yolo' || source.id === 'terminal') &&
        upgradePrice(state, source.id, source.id === 'terminal' ? 'terminal' : terminalId) !== null
    },
    rejectionReason: (source) => terminalDropReason(state, source, terminalId, fastMode, undefined, idleSlot !== null),
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
      const reason = terminalDropReason(state, source, terminalId, fastMode, undefined, idleSlot !== null)
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
      if (state.stage !== 'hired') return
      const upgrade = source.id
      if (upgrade !== 'split' && upgrade !== 'yolo' && upgrade !== 'terminal') return
      const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
      if (upgradePrice(state, upgrade, terminalTarget) === null) return
      event.preventDefault()
      event.stopPropagation()
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: terminalTarget, source: 'drag' })
      clearError()
      return
    }
    const reason = terminalDropReason(state, source, terminalId, fastMode, undefined, idleSlot !== null)
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
    const source = nativeDragSource(event)
    if (!source) return
    if (source.kind === 'upgrade') {
      const upgrade = source.id
      const target = upgrade === 'terminal' ? 'terminal' : terminalId
      if (state.stage === 'hired' && (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') && upgradePrice(state, upgrade, target) !== null) {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }
      return
    }
    const reason = terminalDropReason(state, source, terminalId, fastMode, undefined, idleSlot !== null)
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = reason === null ? 'move' : 'none'
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
        <span>{terminalLabel} · {AGENT_MODELS[model].label}{yolo ? ' · YOLO' : ''}</span>
        {!isLocal && state.frontierModelUnlocked && (
          <label className="employment-model-selector">
            <span>Model</span>
            <select
              value={model}
              disabled={state.stage !== 'hired'}
              onChange={(event) => dispatch({ type: 'set-terminal-model', terminalId, model: event.target.value as AgentModelId })}
              aria-label={`${terminalId} model`}
            >
              {availableModels(state, terminalId).map((option) => (
                <option key={option} value={option}>{AGENT_MODELS[option].label}{AGENT_MODELS[option].tokenMultiplier > 1 ? ` · ${AGENT_MODELS[option].tokenMultiplier}× tokens` : ''}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={`terminal-output employment-terminal-lanes panes-${slots}`} aria-label={`${terminalId} status`}>
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
          />
        ))}
        <p className="terminal-prompt terminal-cursor">~ <span className="cursor-block" aria-hidden="true" /></p>
      </div>
      <div className="employment-terminal-footer">
        <div className="employment-token-line">
          <span><strong>{isLocal ? `${terminalLabel} local` : state.tokens.toLocaleString()}</strong>{isLocal ? ' · no task-token cost' : ' tokens available'}</span>
          <span className="employment-refill-countdown">
            {isLocal ? `${AGENT_MODELS[model].label} model` : state.tokens >= MAX_TOKENS ? 'Balance full' : `Refill in ${formatSeconds(refillIn)}`}
          </span>
        </div>
        {error !== null && (
          <p className="employment-drop-error" role="status" aria-live="polite">{error}</p>
        )}
      </div>
      <DragDropHint visible={taskDropVisible || upgradeDropVisible}>
        {taskDropVisible ? 'Drop task here' : 'Drop upgrade here'}
      </DragDropHint>
    </div>
  )
}
