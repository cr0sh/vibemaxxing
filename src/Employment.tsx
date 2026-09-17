import { useEffect, useRef, useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import { MAX_TOKENS, taskReward, taskTokenCost, type GameAction, type GameState, type TerminalId, type WorkTask, upgradePrice } from './game'
import { DragDropHint } from './DragDropHints'
import { useDragDropHints, useDragDropSource, useDragDropTarget } from './DragDropHintsContext'
import { UnreadIndicator } from './UnreadIndicator'
import { useUnreadMessages } from './useUnreadMessages'
import './Employment.css'

type MessengerProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

type TerminalProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  terminalId: TerminalId
  onOpenMessenger: () => void
}

const compactTokens = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

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
  }
}

const taskProgressLabel = (task: WorkTask): string => {
  if (task.status === 'assigned') return 'Not started'
  if (task.status === 'approval') return 'Paused for review'
  if (task.status === 'blocked') return 'Blocked'
  if (task.status === 'artifact') return 'Complete'
  return `${Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)}% complete`
}

const workPhrase = (task: WorkTask): string => {
  const ratio = task.progress / Math.max(1, task.difficulty)
  if (task.status === 'assigned') return 'Assignment is ready. Drag it into Terminal to start.'
  if (task.status === 'approval') return 'The agent paused. Your review is required before it can continue.'
  if (task.status === 'blocked') return 'The agent is waiting on your review decision.'
  if (task.status === 'artifact') return 'The artifact is packaged and ready to deliver.'
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

function TaskAttachment({
  state,
  task,
  elapsed,
  availableTokens,
}: {
  state: GameState
  task: WorkTask
  elapsed: number
  availableTokens: number
}) {
  const isAssigned = task.status === 'assigned' && task.terminalId === null && task.slot === null
  const canAfford = availableTokens >= taskTokenCost(task)
  const canStart = state.stage === 'hired' && isAssigned && canAfford
  const dragSource = useDragDropSource({ kind: 'task', id: String(task.id) }, canStart)
  return (
    <div
      className={`employment-attachment employment-task-attachment employment-task-${task.status}`}
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
    >
      <div className="employment-attachment-icon" aria-hidden="true">⌘</div>
      <div className="employment-attachment-copy">
        <strong>{task.title}</strong>
        <span>{task.description}</span>
        <span>${taskReward(task)} bonus · {compactTokens.format(taskTokenCost(task))} tokens</span>
        <div className="employment-attachment-meta">
          <span>{taskStatusLabel(task)}</span>
          <span>{taskProgressLabel(task)}</span>
          <span>{taskDeadline(task, elapsed)}</span>
        </div>
      </div>
    </div>
  )
}

function ArtifactAttachment({
  task,
  elapsed,
  onDeliver,
  disabled = false,
}: {
  task: WorkTask
  elapsed: number
  onDeliver: () => void
  disabled?: boolean
}) {
  const dragSource = useDragDropSource({ kind: 'artifact', id: String(task.id) }, !disabled)
  return (
    <div
      className="employment-attachment employment-artifact-attachment"
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
    >
      <div className="employment-attachment-icon" aria-hidden="true">◇</div>
      <div className="employment-attachment-copy">
        <strong>{task.artifactName}</strong>
        <span>Ready for delivery · ${taskReward(task)} bonus</span>
        <div className="employment-attachment-meta">
          <span>Artifact ready</span>
          <span>{taskProgressLabel(task)}</span>
          <span>{taskDeadline(task, elapsed)}</span>
        </div>
      </div>
      <button className="employment-inline-button" type="button" onClick={onDeliver} disabled={disabled}>
        Deliver artifact <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}


export function MessengerContent({ state, dispatch }: MessengerProps) {
  const [reactionBurst, setReactionBurst] = useState(0)
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

  const hasPing = state.pingDeadline !== null
  const messageIds: readonly string[] = [
    'welcome',
    ...state.tasks.map((task) => `task-${task.id}`),
    ...(hasPing ? [`ping-${state.pingDeadline}`] : []),
    ...(state.lastDelivery ? [`delivery-${state.completedTasks}`] : []),
    ...(state.stage === 'lost' ? [`firing-${state.failure ?? 'run-ended'}`] : []),
  ]
  const { unreadCount, scrollToLatest } = useUnreadMessages(messageIds, chatPaneRef)
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
  const pingRemaining = hasPing ? (state.pingDeadline ?? state.elapsed) - state.elapsed : 0
  const nextPingRemaining = Math.max(0, state.nextPingAt - state.elapsed)

  const reactToWelcome = () => {
    dispatch({ type: 'welcome-react' })
    setReactionBurst((burst) => burst + 1)
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    reactionTimer.current = window.setTimeout(() => setReactionBurst(0), 750)
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
        <p className="sidebar-heading">Channels</p>
        <div className="channel active-channel"><span aria-hidden="true">#</span> general</div>
        <div className="channel"><span aria-hidden="true">#</span> watercooler</div>
        <p className="sidebar-heading sidebar-heading-spaced">Direct messages</p>
        <div className="channel"><span className="online-dot" aria-hidden="true" /> boss.exe</div>
      </div>
      <div className="chat-pane">
        <div className="chat-header">
          <div>
            <strong># general</strong>
            <span>Team chat</span>
          </div>
          <span className="employment-chat-state">{state.company ?? 'vibecorp'} · online</span>
        </div>
        <div ref={chatPaneRef} className="chat-scroll-region">
          <div className="chat-messages">
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

            {state.tasks.map((task) => (
              <div className="message-row employment-message-entry" key={`task-${task.id}`}>
                <div className="avatar boss-avatar" aria-hidden="true">B</div>
                <div className="message-body">
                  <div className="message-meta">
                    <strong>{task.status === 'artifact' ? 'agent-shell' : 'boss.exe'}</strong>
                    <span>{task.status === 'artifact' ? 'just now' : 'assignment'}</span>
                  </div>
                  {task.status === 'artifact'
                    ? <p>Waiting for <strong>{task.artifactName}</strong> in Terminal.</p>
                    : <p>Here is the next thing to ship. Drag this task into Terminal to start.</p>}
                  {task.status !== 'artifact' && (
                    <TaskAttachment
                      state={state}
                      task={task}
                      elapsed={state.elapsed}
                      availableTokens={state.tokens}
                    />
                  )}
                </div>
              </div>
            ))}

            {hasPing && (
              <div className="message-row employment-message-entry employment-ping-entry" key={`ping-${state.pingDeadline}`}>
                <div className="avatar boss-avatar" aria-hidden="true">B</div>
                <div className="message-body">
                  <div className="message-meta"><strong>boss.exe</strong><span>check-in</span></div>
                  <p>Quick check-in: are you still on this? Please acknowledge before the timer runs out.</p>
                  <button
                    className="employment-check-button"
                    type="button"
                    onClick={() => dispatch({ type: 'acknowledge-ping' })}
                    disabled={state.stage !== 'hired' || pingRemaining <= 0}
                  >
                    <span aria-hidden="true">✅</span> Check in <span className="employment-countdown">{formatSeconds(pingRemaining)}</span>
                  </button>
                </div>
              </div>
            )}

            {state.lastDelivery && (
              <div className="message-row employment-message-entry employment-delivery-entry" key={`delivery-${state.completedTasks}-${state.lastDelivery}`}>
                <div className="avatar self-avatar" aria-hidden="true">Y</div>
                <div className="message-body">
                  <div className="message-meta"><strong>You</strong><span>delivered</span></div>
                  <p>Delivered <strong>{state.lastDelivery}</strong>. Nice work — {state.completedTasks} assignment{state.completedTasks === 1 ? '' : 's'} complete.</p>
                  <p className="employment-delivery-reward">Earned ${state.lastReward} completion bonus.</p>
                </div>
              </div>
            )}

            {!hasPing && (
              <p className="employment-next-ping" role="status" aria-live="polite">
                Next boss check-in in <strong>{formatSeconds(nextPingRemaining)}</strong>
              </p>
            )}

            {state.stage === 'lost' && (
              <div ref={firingRef} className="message-row employment-message-entry employment-firing-entry" key={`firing-${state.failure}`}>
                <div className="avatar boss-avatar" aria-hidden="true">B</div>
                <div className="message-body">
                  <div className="message-meta"><strong>boss.exe</strong><span>now</span></div>
                  <p>You are fired. {state.failure ?? 'The run ended.'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <UnreadIndicator count={unreadCount} onClick={scrollToLatest} />
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
  onOpenMessenger: () => void
}

function TerminalLane({ state, dispatch, terminalId, slot, task, yolo, onOpenMessenger }: TerminalLaneProps) {
  const laneRef = useRef<HTMLElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const taskDropVisible = state.stage === 'hired' && !task && isSourceActive('task')

  useDragDropTarget(laneRef, {
    id: `terminal-lane-${terminalId}-${slot}`,
    priority: 3,
    accepts: (source) => source.kind === 'task' && state.stage === 'hired' && task === undefined,
    onDrop: (source) => {
      const id = Number(source.id)
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (source.kind === 'task' && Number.isInteger(id) && !task && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
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
      if (dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
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
  const deliverArtifact = () => {
    if (state.stage !== 'hired' || !task || task.status !== 'artifact') return
    dispatch({ type: 'deliver-task', id: task.id })
    onOpenMessenger()
  }
  const progress = task ? Math.min(100, Math.max(0, (task.progress / Math.max(1, task.difficulty)) * 100)) : 0

  return (
    <section
      ref={laneRef}
      className={`employment-terminal-lane ${taskDropVisible ? 'employment-drop-active' : ''}`}
      aria-label={`Terminal agent pane ${slot + 1}`}
      onDragOver={(event) => {
        const hasTask = event.dataTransfer.types.includes('application/x-vibemaxxer-task')
        const hasUpgrade = event.dataTransfer.types.includes('application/x-vibemaxxer-upgrade')
        const upgrade = hasUpgrade ? event.dataTransfer.getData('application/x-vibemaxxer-upgrade') : ''
        const terminalTarget = upgrade === 'terminal' ? 'terminal' : terminalId
        if ((hasTask && !task) || (hasUpgrade && (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') && upgradePrice(state, upgrade, terminalTarget) !== null)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={handleDrop}
    >
      <div className="employment-lane-heading">
        <span>{yolo ? 'YOLO' : task ? taskStatusLabel(task).toLowerCase() : 'idle'}</span>
      </div>
      {task && (
        <div className="employment-lane-task">
          <p><span className="terminal-prompt">~</span> task/{task.id} · {task.title}</p>
          <p className="terminal-muted">{workPhrase(task)}</p>
          <div className="employment-progress-wrap" aria-label={`${Math.round(progress)} percent complete`}>
            <div className="employment-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="employment-terminal-stats">
            <span>{taskProgressLabel(task)}</span>
            <span>deadline {taskDeadline(task, state.elapsed)}</span>
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

          {task.status === 'artifact' && (
            <div className="employment-terminal-action-block">
              <ArtifactAttachment task={task} elapsed={state.elapsed} disabled={state.stage !== 'hired'} onDeliver={deliverArtifact} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function TerminalContent({ state, dispatch, terminalId, onOpenMessenger }: TerminalProps) {
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  const slots = terminal?.slots ?? 0
  const yolo = terminal?.yolo ?? false
  const refillIn = 100 - (state.elapsed % 100 || 0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const { isSourceActive, clear } = useDragDropHints()
  const idleSlot = findIdleTerminalSlot(state.tasks, terminalId, slots)
  const taskDropVisible = state.stage === 'hired' && idleSlot !== null && isSourceActive('task')
  const upgradeDropVisible = state.stage === 'hired' && (['split', 'yolo', 'terminal'] as const).some((upgrade) => (
    isSourceActive('upgrade', upgrade) &&
    upgradePrice(state, upgrade, upgrade === 'terminal' ? 'terminal' : terminalId) !== null
  ))

  useDragDropTarget(terminalRef, {
    id: `terminal-${terminalId}`,
    priority: 1,
    accepts: (source) => {
      if (state.stage !== 'hired') return false
      if (source.kind === 'task') return idleSlot !== null
      return source.kind === 'upgrade' &&
        (source.id === 'split' || source.id === 'yolo' || source.id === 'terminal') &&
        upgradePrice(state, source.id, source.id === 'terminal' ? 'terminal' : terminalId) !== null
    },
    onDrop: (source) => {
      if (state.stage !== 'hired') return
      if (source.kind === 'upgrade' && (source.id === 'split' || source.id === 'yolo' || source.id === 'terminal')) {
        const target = source.id === 'terminal' ? 'terminal' : terminalId
        if (upgradePrice(state, source.id, target) !== null) {
          dispatch({ type: 'buy-upgrade', upgrade: source.id, terminalId: target })
        }
        return
      }
      if (source.kind === 'task' && idleSlot !== null) {
        const id = Number(source.id)
        const dropped = state.tasks.find((candidate) => candidate.id === id)
        if (Number.isInteger(id) && dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
          dispatch({ type: 'start-task', id, terminalId, slot: idleSlot })
        }
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
    if (
      idleSlot !== null &&
      kind &&
      Number.isInteger(id) &&
      dropped?.status === 'assigned' &&
      dropped.terminalId === null &&
      dropped.slot === null
    ) {
      event.preventDefault()
      dispatch({ type: 'start-task', id, terminalId, slot: idleSlot })
      clear()
    }
  }

  const handleTerminalDragOver = (event: DragEvent<HTMLDivElement>) => {
    const hasTask = event.dataTransfer.types.includes('application/x-vibemaxxer-task')
    const hasUpgrade = event.dataTransfer.types.includes('application/x-vibemaxxer-upgrade')
    if (
      state.stage === 'hired' &&
      ((hasTask && idleSlot !== null) ||
        (hasUpgrade && (['split', 'yolo', 'terminal'] as const).some((upgrade) => upgradePrice(state, upgrade, upgrade === 'terminal' ? 'terminal' : terminalId) !== null)))
    ) {
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
            onOpenMessenger={onOpenMessenger}
          />
        ))}
        <p className="terminal-prompt terminal-cursor">~ <span className="cursor-block" aria-hidden="true" /></p>
      </div>
      <div className="employment-terminal-footer">
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
