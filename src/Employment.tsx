import { useEffect, useRef, useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import {
  AGENT_MODELS,
  canFundTaskAttempt,
  MAX_TOKENS,
  taskReward,
  taskTokenCost,
  type AgentModelId,
  type EmploymentMessage,
  type EmploymentTaskSnapshot,
  type GameAction,
  type GameState,
  type TerminalId,
  type WorkTask,
  upgradePrice,
} from './game'
import { DragDropHint } from './DragDropHints'
import { useDragDropHints, useDragDropSource, useDragDropTarget } from './DragDropHintsContext'
import { UnreadIndicator } from './UnreadIndicator'
import { useUnreadMessages } from './useUnreadMessages'
import './Employment.css'

type MessengerProps = {
  state: GameState
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

const taskProgressLabel = (task: WorkTask): string => {
  if (task.status === 'assigned') return 'Not started'
  if (task.status === 'approval') return 'Paused for review'
  if (task.status === 'blocked') return 'Blocked'
  if (task.status === 'artifact') return 'Complete'
  if (task.status === 'failed') return `${Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)}% retained`
  return `${Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)}% complete`
}

const workPhrase = (task: WorkTask): string => {
  const ratio = task.progress / Math.max(1, task.difficulty)
  if (task.status === 'assigned') return 'Assignment is ready. Drag it into Terminal to start.'
  if (task.status === 'approval') return 'The agent paused. Your review is required before it can continue.'
  if (task.status === 'blocked') return 'The agent is waiting on your review decision.'
  if (task.status === 'artifact') return 'The artifact is packaged and ready to deliver.'
  if (task.status === 'failed') return 'This attempt stopped, but its progress evidence is saved. Retry to continue.'
  if (ratio < 0.25) return 'Reading the brief and mapping a first approach…'
  if (ratio < 0.55) return 'Building the first useful pass…'
  if (ratio < 0.82) return 'Checking edge cases and tightening the result…'
  return 'Running the final checks before packaging…'
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

function focusDropWindow(element: HTMLElement | null) {
  element?.closest<HTMLElement>('.window')?.focus({ preventScroll: true })
}

function taskModelLabel(task: WorkTask): string {
  if (task.model === null) return 'Model selected at start'
  return AGENT_MODELS[task.model]?.label ?? task.model
}

function taskSpeedLabel(task: WorkTask): string {
  return task.fastMode ? 'Fast mode' : 'Standard pace'
}
function currentTerminalFastMode(state: GameState, task: WorkTask): boolean {
  if (task.terminalId === null) return task.fastMode
  return state.terminals.find((terminal) => terminal.id === task.terminalId)?.fastMode ?? task.fastMode
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
  const canAfford = canFundTaskAttempt(state, task, task.fastMode)
  const canStart = state.stage === 'hired' && !archived && isAssigned && canAfford
  const dragSource = useDragDropSource({ kind: 'task', id: String(task.id) }, canStart)
  const rewardAt = archived ? task.assignedAt : elapsed
  const reward = taskReward(task, rewardAt)
  const cost = taskTokenCost(task, task.fastMode)
  const kindLabel = task.kind === 'architecture' ? 'Architecture brief' : 'Standard brief'
  return (
    <div
      className={`employment-attachment employment-task-attachment employment-task-${task.status} ${task.kind === 'architecture' ? 'employment-architecture-attachment' : ''} ${archived ? 'employment-archived-attachment' : ''}`}
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
      aria-label={`${kindLabel}: ${task.title}`}
    >
      <div className="employment-attachment-icon" aria-hidden="true">⌘</div>
      <div className="employment-attachment-copy">
        <div className="employment-attachment-title-row">
          <strong>{task.title}</strong>
          <span className="employment-task-kind">{kindLabel}</span>
        </div>
        <span>{task.description}</span>
        <span className="employment-reward-line">
          <span className="employment-reward-bag" aria-hidden="true">💰</span>
          {archived ? `${formatMoney(reward)} initial bonus` : `${formatMoney(reward)} reward now`}
          <span className="employment-reward-decay">{archived ? '' : ' · depreciates while assigned'}</span>
        </span>
        <span className="employment-attachment-meta employment-task-economy">
          <span>{compactTokens.format(cost)} tokens{task.fastMode ? ' · 2×' : ''}</span>
          {task.model !== null && <span>{taskModelLabel(task)}</span>}
          {task.fastMode && <span>{taskSpeedLabel(task)}</span>}
        </span>
        <div className="employment-attachment-meta">
          <span>{archived ? 'Delivered' : taskStatusLabel(task)}</span>
          <span>{archived ? 'Complete' : taskProgressLabel(task)}</span>
          {!archived && <span>{taskDeadline(task, elapsed)}</span>}
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
  task,
  elapsed,
  disabled = false,
  archived = false,
}: {
  task: WorkTask
  elapsed: number
  disabled?: boolean
  archived?: boolean
}) {
  const dragSource = useDragDropSource({ kind: 'artifact', id: String(task.id) }, !disabled)
  return (
    <div
      className={`employment-attachment employment-artifact-attachment ${task.kind === 'architecture' ? 'employment-architecture-attachment' : ''} ${archived ? 'employment-archived-attachment' : ''}`}
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
      aria-label={`Artifact ${task.artifactName}`}
    >
      <div className="employment-attachment-icon" aria-hidden="true">◇</div>
      <div className="employment-attachment-copy">
        <strong>{task.artifactName}</strong>
        <span>{archived ? 'Delivered artifact' : 'Ready for delivery'}</span>
        <div className="employment-attachment-meta">
          <span>{archived ? 'Delivered' : 'Artifact ready'}</span>
          <span>{archived ? 'Complete' : taskProgressLabel(task)}</span>
          {!archived && <span>{taskDeadline(task, elapsed)}</span>}
          {task.model !== null && <span>{taskModelLabel(task)}</span>}
          {task.fastMode && <span>{taskSpeedLabel(task)}</span>}
        </div>
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
      <div className="employment-watercooler-intro">
        <span className="employment-watercooler-icon" aria-hidden="true">☕</span>
        <div>
          <strong>A quieter corner of vibecorp</strong>
          <p>Colleagues share the useful stuff here. No boss pings, just a little context between attempts.</p>
        </div>
      </div>
      <div className="message-row employment-message-entry employment-watercooler-message">
        <div className="avatar" aria-hidden="true">M</div>
        <div className="message-body">
          <div className="message-meta"><strong>mira.from-product</strong><span>watercooler</span></div>
          <p>Someone made a tiny social app for the team. The ZZZ feed is where the good launch notes are hiding.</p>
          <button
            className="employment-social-open-button"
            type="button"
            onClick={onOpenSocial}
            disabled={!canOpen}
          >
            <span aria-hidden="true">↗</span> {installed ? 'Open ZZZ' : 'Install ZZZ and open it'}
          </button>
          {!installed && !canOpen && <span className="employment-control-hint">Keep working until this channel unlocks.</span>}
          {installed && state.stage === 'lost' && <span className="employment-control-hint">ZZZ is read-only after the run ends.</span>}
        </div>
      </div>
    </div>
  )
}

export function MessengerContent({ state, dispatch, onOpenSocial }: MessengerProps) {
  const [reactionBurst, setReactionBurst] = useState(0)
  const [channel, setChannel] = useState<Channel>('general')
  const reactionTimer = useRef<number | null>(null)
  const firingRef = useRef<HTMLDivElement>(null)
  const chatPaneRef = useRef<HTMLDivElement>(null)
  const messengerRef = useRef<HTMLDivElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  useEffect(() => () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
  }, [])
  useEffect(() => {
    if (state.stage === 'lost') firingRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.stage])

  const messageIds = state.messages.map((message) => message.id)
  const { unreadCount, scrollToLatest } = useUnreadMessages(messageIds, chatPaneRef, channel === 'general')
  const watercoolerUnread = state.watercoolerUnlocked && !state.watercoolerRead
  const artifactDropVisible = state.stage === 'hired' && isSourceActive('artifact')
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
  const nextPingRemaining = Math.max(0, state.nextPingAt - state.elapsed)

  const reactToWelcome = () => {
    dispatch({ type: 'welcome-react' })
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
    if (message.type === 'welcome') {
      return (
        <div key={message.id}>
          <div className="welcome-banner employment-message-entry">
            <span aria-hidden="true">🎉</span> Welcome to the team
          </div>
          <div className="message-row employment-message-entry">
            <div className="avatar boss-avatar" aria-hidden="true">B</div>
            <div className="message-body">
              <div className="message-meta"><strong>boss.exe</strong><span>just now</span></div>
              <p>Welcome aboard. Your workspace is ready.</p>
              <button
                className={`message-reaction employment-reaction-button ${state.welcomeReacted ? 'employment-reaction-active' : ''}`}
                type="button"
                onClick={reactToWelcome}
                disabled={state.stage !== 'hired'}
                aria-pressed={state.welcomeReacted}
              >
                🎉 {state.welcomeReacted ? 2 : 1}
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
        <div className="message-row employment-message-entry" key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>boss.exe</strong><span>assignment</span></div>
            <p>Here is the next thing to ship. Drag this task into Terminal to start.</p>
            <TaskAttachment state={state} task={currentTask.task} elapsed={state.elapsed} archived={currentTask.archived} />
          </div>
        </div>
      )
    }

    if (message.type === 'artifact') {
      const currentTask = taskForMessage(state, message.task)
      return (
        <div className="message-row employment-message-entry" key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>agent-shell</strong><span>artifact ready</span></div>
            <p>Waiting for <strong>{message.task.artifactName}</strong> in Terminal.</p>
            <ArtifactAttachment task={currentTask.task} elapsed={state.elapsed} disabled={currentTask.archived || state.stage !== 'hired'} archived={currentTask.archived} />
          </div>
        </div>
      )
    }

    if (message.type === 'delivery') {
      return (
        <div className="message-row employment-message-entry employment-delivery-entry" key={message.id}>
          <div className="avatar self-avatar" aria-hidden="true">Y</div>
          <div className="message-body">
            <div className="message-meta"><strong>You</strong><span>delivered</span></div>
            <p>Delivered <strong>{message.task.artifactName}</strong>. Nice work — {message.completedTasks} assignment{message.completedTasks === 1 ? '' : 's'} complete.</p>
            <p className="employment-delivery-reward"><span aria-hidden="true">💰</span> Earned {formatMoney(message.reward)} completion bonus.</p>
            <div className="employment-delivery-meta">
              <span>{message.task.kind === 'architecture' ? 'Architecture milestone' : 'Standard assignment'}</span>
              {message.task.model !== null && <span>{taskModelLabel(taskFromSnapshot(message.task))}</span>}
              {message.task.fastMode && <span>Fast mode</span>}
              <span>Attempt {Math.max(1, message.task.attempt)}</span>
            </div>
          </div>
        </div>
      )
    }

    if (message.type === 'incentives') {
      return (
        <div className="message-row employment-message-entry employment-milestone-entry employment-incentives-entry" key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>boss.exe</strong><span>incentives · {formatSeconds(message.elapsed)}</span></div>
            <p>Five deliveries in. Keep the quality steady and the completion bonuses will keep compounding.</p>
            <span className="employment-milestone-label">Performance incentives enabled</span>
          </div>
        </div>
      )
    }

    if (message.type === 'promotion') {
      return (
        <div className="message-row employment-message-entry employment-milestone-entry employment-promotion-entry" key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>boss.exe</strong><span>promotion · {formatSeconds(message.elapsed)}</span></div>
            <p>Fifty deliveries is a real milestone. You are promoted to <strong>Level 4</strong>; architecture briefs are now entering the queue.</p>
            <span className="employment-milestone-label">Architecture lane unlocked</span>
          </div>
        </div>
      )
    }

    if (message.type === 'attempt-failed') {
      const currentTask = taskForMessage(state, message.task)
      const retryFastMode = currentTerminalFastMode(state, currentTask.task)
      const retryCost = taskTokenCost(currentTask.task, retryFastMode)
      const canRetry = state.stage === 'hired' && !currentTask.archived && canFundTaskAttempt(state, currentTask.task, retryFastMode)
      return (
        <div className="message-row employment-message-entry employment-attempt-failed-entry" key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>agent-shell</strong><span>attempt failed · {formatSeconds(message.elapsed)}</span></div>
            <p><strong>{message.task.title}</strong> did not pass the completion check. The lane evidence is preserved; no artifact or bonus was created.</p>
            <div className="employment-failed-summary">
              <span>{message.task.kind === 'architecture' ? 'Architecture brief' : 'Standard brief'}</span>
              <span>{message.task.model === null ? 'Basic model' : taskModelLabel(taskFromSnapshot(message.task))}</span>
              <span>{message.task.fastMode ? 'Fast mode' : 'Standard pace'}</span>
              <span>Attempt {Math.max(1, message.task.attempt)}</span>
            </div>
            <button
              className="employment-terminal-button employment-retry-button"
              type="button"
              onClick={() => dispatch({ type: 'retry-task', id: message.task.id })}
              disabled={!canRetry}
            >
              Retry attempt · {compactTokens.format(retryCost)} tokens
            </button>
            {state.stage === 'hired' && !currentTask.archived && !canFundTaskAttempt(state, currentTask.task, retryFastMode) && <span className="employment-control-hint">Need more tokens before this lane can retry.</span>}
          </div>
        </div>
      )
    }

    if (message.type === 'ping') {
      const active = state.stage === 'hired' && state.pingDeadline === message.deadlineAt
      const remaining = active ? message.deadlineAt - state.elapsed : 0
      return (
        <div className="message-row employment-message-entry employment-ping-entry" key={message.id}>
          <div className="avatar boss-avatar" aria-hidden="true">B</div>
          <div className="message-body">
            <div className="message-meta"><strong>boss.exe</strong><span>check-in</span></div>
            <p>Quick check-in: are you still on this? Please acknowledge before the timer runs out.</p>
            <button
              className="employment-check-button"
              type="button"
              onClick={() => dispatch({ type: 'acknowledge-ping' })}
              disabled={!active || remaining <= 0}
            >
              <span aria-hidden="true">✅</span> {active ? 'Check in' : message.acknowledged ? 'Acknowledged' : 'No response'} <span className="employment-countdown">{active ? formatSeconds(remaining) : ''}</span>
            </button>
          </div>
        </div>
      )
    }

    return (
      <div ref={firingRef} className="message-row employment-message-entry employment-firing-entry" key={message.id}>
        <div className="avatar boss-avatar" aria-hidden="true">B</div>
        <div className="message-body">
          <div className="message-meta"><strong>boss.exe</strong><span>now</span></div>
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
        <div className="messenger-team">vibe<span>corp</span></div>
        <div className="employment-team-status">
          <span className="employment-level-badge">L{state.level}</span>
          <span>{state.level === 4 ? 'Architecture track' : 'Delivery track'}</span>
        </div>
        <p className="sidebar-heading">Channels</p>
        <ChannelButton channel="general" active={channel === 'general'} unread={unreadCount > 0} onSelect={() => selectChannel('general')} />
        <ChannelButton channel="watercooler" active={channel === 'watercooler'} unread={watercoolerUnread} onSelect={() => selectChannel('watercooler')} />
        <p className="sidebar-heading sidebar-heading-spaced">Direct messages</p>
        <div className="channel employment-static-channel"><span className="online-dot" aria-hidden="true" /> boss.exe</div>
      </div>
      <div className="chat-pane">
        <div className="chat-header">
          <div>
            <strong>#{channel}</strong>
            <span>{channel === 'general' ? 'Team chat' : 'Colleague chat'}</span>
          </div>
          <span className="employment-chat-state">{state.company ?? 'vibecorp'} · {state.stage === 'lost' ? 'archived' : 'online'}</span>
          <nav className="employment-mobile-channel-tabs" aria-label="Messenger channels">
            <ChannelButton channel="general" active={channel === 'general'} unread={unreadCount > 0} onSelect={() => selectChannel('general')} />
            <ChannelButton channel="watercooler" active={channel === 'watercooler'} unread={watercoolerUnread} onSelect={() => selectChannel('watercooler')} />
          </nav>
        </div>
        <div ref={chatPaneRef} className="chat-scroll-region">
          <div className="chat-messages">
            <div hidden={channel !== 'general'} aria-hidden={channel !== 'general'} className="employment-general-pane">
              {state.messages.map(renderGeneralMessage)}
              {state.stage === 'hired' && state.pingDeadline === null && (
                <p className="employment-next-ping" role="status" aria-live="polite">
                  Next boss check-in in <strong>{formatSeconds(nextPingRemaining)}</strong>
                </p>
              )}
            </div>
            <div hidden={channel !== 'watercooler'} aria-hidden={channel !== 'watercooler'} className="employment-watercooler-wrapper">
              <WatercoolerPane state={state} onOpenSocial={handleOpenSocial} />
            </div>
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
  const taskDropVisible = state.stage === 'hired' && !task && isSourceActive('task')

  useDragDropTarget(laneRef, {
    id: `terminal-lane-${terminalId}-${slot}`,
    priority: 3,
    accepts: (source) => source.kind === 'task' && state.stage === 'hired' && task === undefined && state.tasks.some((candidate) => candidate.status === 'assigned' && candidate.terminalId === null && candidate.slot === null && canFundTaskAttempt(state, candidate, fastMode)),
    onDrop: (source) => {
      const id = Number(source.id)
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (source.kind === 'task' && Number.isInteger(id) && !task && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null && canFundTaskAttempt(state, dropped, fastMode)) {
        dispatch({ type: 'start-task', id, terminalId, slot })
      }
    },
    onHover: () => focusDropWindow(laneRef.current),
  })
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (state.stage !== 'hired') return
    const upgrade = event.dataTransfer.getData('application/x-vibemaxxer-upgrade')
    if (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') {
      const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
      if (upgradePrice(state, upgrade, terminalTarget) === null) return
      event.preventDefault()
      event.stopPropagation()
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: terminalTarget })
      clear()
      return
    }
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-task')
    const id = Number(kind)
    if (kind && Number.isInteger(id) && !task) {
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null && canFundTaskAttempt(state, dropped, fastMode)) {
        event.preventDefault()
        event.stopPropagation()
        dispatch({ type: 'start-task', id, terminalId, slot })
        clear()
      }
    }
  }

  const approval = (approved: boolean) => {
    if (state.stage !== 'hired' || !task || (task.status !== 'approval' && task.status !== 'blocked')) return
    dispatch({ type: 'approve-task', id: task.id, approved })
  }
  const progress = task ? Math.min(100, Math.max(0, (task.progress / Math.max(1, task.difficulty)) * 100)) : 0
  const retryCost = task ? taskTokenCost(task, fastMode) : 0
  const modelLabel = task?.model === null || task === undefined ? 'Basic model' : taskModelLabel(task)

  return (
    <section
      ref={laneRef}
      className={`employment-terminal-lane ${taskDropVisible ? 'employment-drop-active' : ''} ${task?.status === 'failed' ? 'employment-lane-failed' : ''}`}
      aria-label={`Terminal agent pane ${slot + 1}`}
      onDragOver={(event) => {
        const hasTask = event.dataTransfer.types.includes('application/x-vibemaxxer-task')
        const hasUpgrade = event.dataTransfer.types.includes('application/x-vibemaxxer-upgrade')
        const upgrade = hasUpgrade ? event.dataTransfer.getData('application/x-vibemaxxer-upgrade') : ''
        const taskId = hasTask ? Number(event.dataTransfer.getData('application/x-vibemaxxer-task')) : NaN
        const droppedTask = state.tasks.find((candidate) => candidate.id === taskId)
        const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
        const canDropTask = hasTask && !task && droppedTask?.status === 'assigned' && droppedTask.terminalId === null && droppedTask.slot === null && canFundTaskAttempt(state, droppedTask, fastMode)
        if (canDropTask || (hasUpgrade && (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') && upgradePrice(state, upgrade, terminalTarget) !== null)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={handleDrop}
    >
      <div className="employment-lane-heading">
        <span>{yolo ? 'YOLO' : task ? taskStatusLabel(task).toLowerCase() : 'idle'}</span>
        {task && <span>attempt {Math.max(1, task.attempt)}</span>}
      </div>
      {task && (
        <div className="employment-lane-task">
          <div className="employment-lane-title-row">
            <p><span className="terminal-prompt">~</span> task/{task.id} · {task.title}</p>
            <span className="employment-task-kind">{task.kind === 'architecture' ? 'Architecture' : 'Standard'}</span>
          </div>
          <p className="terminal-muted">{workPhrase(task)}</p>
          <div className={`employment-progress-wrap ${task.status === 'failed' ? 'employment-progress-failed' : ''}`} aria-label={`${Math.round(progress)} percent complete`}>
            <div className="employment-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="employment-terminal-stats">
            <span>{taskProgressLabel(task)}</span>
            <span>deadline {taskDeadline(task, state.elapsed)}</span>
          </div>
          <div className="employment-attempt-meta">
            <span>{modelLabel}</span>
            <span>{taskSpeedLabel(task)}</span>
            {task.status !== 'failed' && <span><span aria-hidden="true">💰</span> {formatMoney(taskReward(task, state.elapsed))} now</span>}
          </div>

          {task.status === 'approval' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              <p className="terminal-muted">{task.approvalPrompt}</p>
              <div className="employment-button-row">
                <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>Yes — approve and resume</button>
                <button className="employment-terminal-button employment-danger-button" type="button" onClick={() => approval(false)} disabled={state.stage !== 'hired'}>No — needs changes</button>
              </div>
            </div>
          )}
          {task.status === 'blocked' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              <p className="terminal-muted">{task.approvalPrompt}</p>
              <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>Retry and resume</button>
            </div>
          )}

          {task.status === 'failed' && (
            <div className="employment-terminal-action-block employment-failed-block">
              <p className="terminal-muted">No artifact was produced. Retry charges the lane's token cost and preserves this deadline.</p>
              <button className="employment-terminal-button employment-retry-button" type="button" onClick={() => dispatch({ type: 'retry-task', id: task.id })} disabled={state.stage !== 'hired' || !canFundTaskAttempt(state, task, fastMode)}>
                Retry this attempt · {compactTokens.format(retryCost)} tokens
              </button>
            </div>
          )}

          {task.status === 'artifact' && (
            <div className="employment-terminal-action-block">
              <ArtifactAttachment task={task} elapsed={state.elapsed} disabled={state.stage !== 'hired'} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function TerminalContent({ state, dispatch, terminalId }: TerminalProps) {
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  const slots = terminal?.slots ?? 0
  const yolo = terminal?.yolo ?? false
  const selectedModel: AgentModelId = terminal?.model ?? 'basic'
  const refillIn = 100 - (state.elapsed % 100 || 0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const idleSlot = findIdleTerminalSlot(state.tasks, terminalId, slots)
  const taskDropVisible = state.stage === 'hired' && idleSlot !== null && isSourceActive('task')
  const upgradeDropVisible = state.stage === 'hired' && (['split', 'yolo', 'terminal'] as const).some((upgrade) => (
    isSourceActive('upgrade', upgrade) && upgradePrice(state, upgrade, upgrade === 'terminal' ? 'terminal' : terminalId) !== null
  ))

  useDragDropTarget(terminalRef, {
    id: `terminal-${terminalId}`,
    priority: 1,
    accepts: (source) => {
      if (state.stage !== 'hired') return false
      if (source.kind === 'task') return idleSlot !== null && state.tasks.some((candidate) => candidate.status === 'assigned' && candidate.terminalId === null && candidate.slot === null && canFundTaskAttempt(state, candidate, terminal?.fastMode ?? false))
      return source.kind === 'upgrade' &&
        (source.id === 'split' || source.id === 'yolo' || source.id === 'terminal') &&
        upgradePrice(state, source.id, source.id === 'terminal' ? 'terminal' : terminalId) !== null
    },
    onDrop: (source) => {
      if (state.stage !== 'hired') return
      if (source.kind === 'upgrade' && (source.id === 'split' || source.id === 'yolo' || source.id === 'terminal')) {
        const target = source.id === 'terminal' ? 'terminal' : terminalId
        if (upgradePrice(state, source.id, target) !== null) dispatch({ type: 'buy-upgrade', upgrade: source.id, terminalId: target })
        return
      }
      if (source.kind === 'task' && idleSlot !== null) {
        const id = Number(source.id)
        const dropped = state.tasks.find((candidate) => candidate.id === id)
        if (Number.isInteger(id) && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null && canFundTaskAttempt(state, dropped, terminal?.fastMode ?? false)) dispatch({ type: 'start-task', id, terminalId, slot: idleSlot })
      }
    },
    onHover: () => focusDropWindow(terminalRef.current),
  })
  const handleTerminalDrop = (event: DragEvent<HTMLDivElement>) => {
    if (state.stage !== 'hired') return
    const upgrade = event.dataTransfer.getData('application/x-vibemaxxer-upgrade')
    if (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') {
      const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
      if (upgradePrice(state, upgrade, terminalTarget) === null) return
      event.preventDefault()
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: terminalTarget })
      clear()
      return
    }
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-task')
    const id = Number(kind)
    const dropped = state.tasks.find((candidate) => candidate.id === id)
    if (idleSlot !== null && kind && Number.isInteger(id) && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null && canFundTaskAttempt(state, dropped, terminal?.fastMode ?? false)) {
      event.preventDefault()
      dispatch({ type: 'start-task', id, terminalId, slot: idleSlot })
      clear()
    }
  }

  const handleTerminalDragOver = (event: DragEvent<HTMLDivElement>) => {
    const hasTask = event.dataTransfer.types.includes('application/x-vibemaxxer-task')
    const hasUpgrade = event.dataTransfer.types.includes('application/x-vibemaxxer-upgrade')
    const taskId = hasTask ? Number(event.dataTransfer.getData('application/x-vibemaxxer-task')) : NaN
    const droppedTask = state.tasks.find((candidate) => candidate.id === taskId)
    const canDropTask = hasTask && idleSlot !== null && droppedTask?.status === 'assigned' && droppedTask.terminalId === null && droppedTask.slot === null && canFundTaskAttempt(state, droppedTask, terminal?.fastMode ?? false)
    if (state.stage === 'hired' && (canDropTask || (hasUpgrade && (['split', 'yolo', 'terminal'] as const).some((upgrade) => upgradePrice(state, upgrade, upgrade === 'terminal' ? 'terminal' : terminalId) !== null)))) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  }

  return (
    <div
      ref={terminalRef}
      className={`terminal-app employment-terminal ${yolo ? 'employment-terminal-yolo' : ''} ${taskDropVisible || upgradeDropVisible ? 'employment-drop-active' : ''}`}
      onDragOver={handleTerminalDragOver}
      onDrop={handleTerminalDrop}
    >
      <div className="terminal-topline">
        <span><span className="terminal-dot" aria-hidden="true" /> agent-shell</span>
        <span>{terminalId}{yolo ? ' · YOLO' : ''}</span>
      </div>
      <div className="employment-terminal-banner">
        <div>
          <span className="employment-terminal-level">Level {state.level}</span>
          <strong>{state.level === 4 ? 'Architecture track' : 'Delivery track'}</strong>
        </div>
        <span className="employment-terminal-banner-note">{terminal?.fastMode ? 'Fast mode on' : 'Standard pace'}</span>
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
            fastMode={terminal?.fastMode ?? false}
          />
        ))}
        <p className="terminal-prompt terminal-cursor">~ <span className="cursor-block" aria-hidden="true" /></p>
      </div>
      <div className="employment-terminal-footer">
        <div className="employment-terminal-model-row">
          <label htmlFor={`model-${terminalId}`}>Agent model</label>
          <select
            id={`model-${terminalId}`}
            value={selectedModel}
            onChange={(event) => dispatch({ type: 'set-model', terminalId, model: event.currentTarget.value as AgentModelId })}
            disabled={state.stage !== 'hired' || !state.reasoningUnlocked}
          >
            {(Object.keys(AGENT_MODELS) as AgentModelId[]).map((model) => (
              <option key={model} value={model}>{AGENT_MODELS[model].label}{model === 'reasoning' && !state.reasoningUnlocked ? ' (locked)' : ''}</option>
            ))}
          </select>
          {!state.reasoningUnlocked && <span className="employment-control-hint">Reasoning unlocks after the first milestone.</span>}
        </div>
        <div className="employment-token-line">
          <span><strong>{state.tokens.toLocaleString()}</strong> tokens available</span>
          <span className="employment-refill-countdown">
            {state.tokens >= MAX_TOKENS ? 'Balance full' : `Refill in ${formatSeconds(refillIn)}`}
          </span>
        </div>
      </div>
      <DragDropHint visible={taskDropVisible || upgradeDropVisible}>
        {taskDropVisible ? 'Drop task here' : 'Drop upgrade here'}
      </DragDropHint>
    </div>
  )
}
