import { useEffect, useRef, useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import { MAX_TOKENS, type GameAction, type GameState, type TerminalId, type WorkTask } from './game'
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

const workPhrase = (task: WorkTask | null): string => {
  if (!task) return 'No task assigned. Drag an assignment here when one arrives.'
  const ratio = task.progress / Math.max(1, task.difficulty)
  if (task.status === 'assigned') return 'No assignment attached. Drag one from Messenger.'
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
  const canAfford = availableTokens >= taskCost(task)
  const canStart = state.stage === 'hired' && isAssigned && canAfford
  return (
    <div
      className={`employment-attachment employment-task-attachment employment-task-${task.status}`}
      draggable={canStart}
      onDragStart={(event) => {
        if (!canStart) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-vibemaxxer-task', String(task.id))
        event.dataTransfer.setData('text/plain', String(task.id))
      }}
    >
      <div className="employment-attachment-icon" aria-hidden="true">⌘</div>
      <div className="employment-attachment-copy">
        <strong>{task.title}</strong>
        <span>{task.description}</span>
        <div className="employment-attachment-meta">
          <span>{taskStatusLabel(task)}</span>
          <span>{taskProgressLabel(task)}</span>
          <span>{taskDeadline(task, elapsed)}</span>
        </div>
      </div>
      <span className="employment-attachment-cost">
        {isAssigned && !canAfford ? `Need ${taskCost(task).toLocaleString()} tokens` : task.terminalId
          ? `${task.terminalId}${task.slot === null ? '' : ` · lane ${task.slot + 1}`}`
          : `${taskCost(task).toLocaleString()} tokens`}
      </span>
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
  return (
    <div
      className="employment-attachment employment-artifact-attachment"
      draggable={!disabled}
      onDragStart={(event) => {
        if (disabled) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-vibemaxxer-artifact', String(task.id))
        event.dataTransfer.setData('text/plain', String(task.id))
      }}
    >
      <div className="employment-attachment-icon" aria-hidden="true">◇</div>
      <div className="employment-attachment-copy">
        <strong>{task.artifactName}</strong>
        <span>Generated artifact · ready for delivery</span>
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

  useEffect(() => () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
  }, [])
  useEffect(() => {
    if (state.stage === 'lost') firingRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.stage])


  const hasPing = state.pingDeadline !== null
  const pingRemaining = hasPing ? (state.pingDeadline ?? state.elapsed) - state.elapsed : 0
  const nextPingRemaining = Math.max(0, state.nextPingAt - state.elapsed)
  const nextTaskRemaining = Math.max(0, state.nextTaskAt - state.elapsed)

  const reactToWelcome = () => {
    dispatch({ type: 'welcome-react' })
    setReactionBurst((burst) => burst + 1)
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    reactionTimer.current = window.setTimeout(() => setReactionBurst(0), 750)
  }

  const handleArtifactDrop = (event: DragEvent<HTMLDivElement>) => {
    if (state.stage !== 'hired') return
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-artifact')
    const id = Number(kind)
    const task = state.tasks.find((candidate) => candidate.id === id)
    if (kind && Number.isInteger(id) && task?.status === 'artifact') {
      dispatch({ type: 'deliver-task', id })
    }
  }

  return (
    <div
      className="messenger-app employment-messenger"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-vibemaxxer-artifact')) event.preventDefault()
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

          {state.stage === 'lost' && (
            <div ref={firingRef} className="message-row employment-message-entry employment-firing-entry" key={`firing-${state.failure}`}>
              <div className="avatar boss-avatar" aria-hidden="true">B</div>
              <div className="message-body">
                <div className="message-meta"><strong>boss.exe</strong><span>now</span></div>
                <p>You are fired. {state.failure ?? 'The run ended.'}</p>
              </div>
            </div>
          )}

          {state.tasks.map((task) => (
            <div className="message-row employment-message-entry" key={`task-${task.id}`}>
              <div className="avatar boss-avatar" aria-hidden="true">B</div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{task.status === 'artifact' ? 'agent-shell' : 'boss.exe'}</strong>
                  <span>{task.status === 'artifact' ? 'just now' : 'assignment'}</span>
                </div>
                {task.status === 'artifact'
                  ? <p>Waiting for <strong>{task.artifactName}</strong> from Terminal.</p>
                  : <p>Here is the next thing to ship. Drag this task into Terminal to start.</p>}
                {task.status === 'artifact'
                  ? <ArtifactAttachment task={task} elapsed={state.elapsed} disabled={state.stage !== 'hired'} onDeliver={() => dispatch({ type: 'deliver-task', id: task.id })} />
                  : <TaskAttachment
                      state={state}
                      task={task}
                      elapsed={state.elapsed}
                      availableTokens={state.tokens}
                    />}
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
              </div>
            </div>
          )}

          {!hasPing && (
            <p className="employment-next-ping" role="status" aria-live="polite">
              Next boss check-in in <strong>{formatSeconds(nextPingRemaining)}</strong>
            </p>
          )}
          {state.tasks.length === 0 && (
            <p className="employment-next-task" role="status" aria-live="polite">
              Next assignment in <strong>{formatSeconds(nextTaskRemaining)}</strong>
            </p>
          )}
        </div>
      </div>
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
  const [dragActive, setDragActive] = useState(false)
  const tokenCost = task ? taskCost(task) : 0

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (state.stage !== 'hired') return
    event.preventDefault()
    setDragActive(false)
    const upgrade = event.dataTransfer.getData('application/x-vibemaxxer-upgrade')
    if (upgrade === 'split' || upgrade === 'yolo' || upgrade === 'terminal') {
      event.stopPropagation()
      dispatch({ type: 'buy-upgrade', upgrade, terminalId: upgrade === 'terminal' ? 'terminal' : terminalId })
      return
    }
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-task')
    const id = Number(kind)
    if (kind && Number.isInteger(id) && !task) {
      const dropped = state.tasks.find((candidate) => candidate.id === id)
      if (dropped?.status === 'assigned' && dropped.terminalId === null && dropped.slot === null) {
        dispatch({ type: 'start-task', id, terminalId, slot })
      }
    }
  }

  const startTask = () => {
    if (state.stage !== 'hired' || !task || task.status !== 'assigned' || task.terminalId !== terminalId || task.slot !== slot) return
    dispatch({ type: 'start-task', id: task.id, terminalId, slot })
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
      className={`employment-terminal-lane ${dragActive ? 'employment-drop-active' : ''}`}
      aria-label={`Terminal lane ${slot + 1}`}
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes('application/x-vibemaxxer-task') ||
          event.dataTransfer.types.includes('application/x-vibemaxxer-upgrade')
        ) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDragActive(true)
        }
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <div className="employment-lane-heading">
        <span>Lane {slot + 1}</span>
        <span>{yolo ? 'YOLO' : task ? taskStatusLabel(task).toLowerCase() : 'idle'}</span>
      </div>
      {!task && (
        <div className="employment-lane-empty">
          <span aria-hidden="true">⌁</span>
          <span>Drop an assignment here</span>
        </div>
      )}
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

          {task.status === 'assigned' && (
            <div className="employment-terminal-action-block">
              <button className="employment-terminal-button" type="button" onClick={startTask} disabled={state.stage !== 'hired' || state.tokens < tokenCost}>
                Start task <span>({tokenCost.toLocaleString()} tokens)</span>
              </button>
              {state.tokens < tokenCost && <span className="employment-control-hint">Need {tokenCost.toLocaleString()} tokens</span>}
            </div>
          )}

          {task.status === 'approval' && !yolo && (
            <div className="employment-terminal-action-block employment-approval-block">
              <p className="terminal-muted">{task.approvalPrompt}</p>
              <div className="employment-button-row">
                <button className="employment-terminal-button" type="button" onClick={() => approval(true)} disabled={state.stage !== 'hired'}>Yes — approve and resume</button>
                <button className="employment-terminal-button employment-danger-button" type="button" onClick={() => approval(false)} disabled={state.stage !== 'hired'}>No — needs changes</button>
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
      {dragActive && <div className="employment-drop-hint" role="status">Release to use this lane</div>}
    </section>
  )
}

export function TerminalContent({ state, dispatch, terminalId, onOpenMessenger }: TerminalProps) {
  const terminal = state.terminals.find((candidate) => candidate.id === terminalId)
  const slots = terminal?.slots ?? 0
  const yolo = terminal?.yolo ?? false
  const refillIn = 100 - (state.elapsed % 100 || 0)
  const handleUpgradeDrop = (event: DragEvent<HTMLDivElement>) => {
    const upgrade = event.dataTransfer.getData('application/x-vibemaxxer-upgrade')
    if (upgrade !== 'split' && upgrade !== 'yolo' && upgrade !== 'terminal') return
    if (state.stage !== 'hired') return
    event.preventDefault()
    dispatch({ type: 'buy-upgrade', upgrade, terminalId: upgrade === 'terminal' ? 'terminal' : terminalId })
  }

  const handleUpgradeDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('application/x-vibemaxxer-upgrade')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  return (
    <div
      className={`terminal-app employment-terminal ${yolo ? 'employment-terminal-yolo' : ''}`}
      onDragOver={handleUpgradeDragOver}
      onDrop={handleUpgradeDrop}
    >
      <div className="terminal-topline">
        <span><span className="terminal-dot" aria-hidden="true" /> agent-shell</span>
        <span>{terminalId}{yolo ? ' · YOLO' : ''}</span>
      </div>
      <div className="terminal-output employment-terminal-lanes" aria-label={`${terminalId} status`}>
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
    </div>
  )
}
