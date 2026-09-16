import { useEffect, useRef, useState } from 'react'
import type { DragEvent, Dispatch } from 'react'
import type { GameAction, GameState, WorkTask } from './game'
import './Employment.css'

type MessengerProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  onOpenTerminal: () => void
}

type TerminalProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
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
  if (task.status === 'assigned') return 'No assignment attached. Send one from Messenger.'
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

const taskCost = (task: WorkTask): number => 10_000 * task.difficulty

function TaskAttachment({
  task,
  elapsed,
  availableTokens,
  onSend,
}: {
  task: WorkTask
  elapsed: number
  availableTokens: number
  onSend: () => void
}) {
  const canSend = task.status === 'assigned'
  const canAfford = availableTokens >= taskCost(task)
  const canStart = canSend && canAfford
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
      {canSend ? (
        <div className="employment-attachment-action">
          <button className="employment-inline-button" type="button" onClick={onSend} disabled={!canStart}>
            Send to terminal <span aria-hidden="true">↗</span>
          </button>
          {!canAfford && <span className="employment-control-hint">Need {taskCost(task).toLocaleString()} tokens</span>}
        </div>
      ) : (
        <span className="employment-attachment-cost">{taskCost(task).toLocaleString()} tokens</span>
      )}
    </div>
  )
}

function ArtifactAttachment({ task, elapsed, onDeliver }: { task: WorkTask; elapsed: number; onDeliver: () => void }) {
  return (
    <div
      className="employment-attachment employment-artifact-attachment"
      draggable
      onDragStart={(event) => {
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
      <button className="employment-inline-button" type="button" onClick={onDeliver}>
        Deliver artifact <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}

export function MessengerContent({ state, dispatch, onOpenTerminal }: MessengerProps) {
  const [reactionBurst, setReactionBurst] = useState(0)
  const reactionTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
  }, [])
  const task = state.task
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

  const sendTask = () => {
    if (!task || task.status !== 'assigned') return
    dispatch({ type: 'start-task', id: task.id })
    onOpenTerminal()
  }


  const handleArtifactDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-artifact')
    const id = Number(kind)
    if (kind && Number.isInteger(id) && task?.id === id && task.status === 'artifact') {
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
            {reactionBurst > 0 && <span className="employment-emoji-pop" key={reactionBurst} aria-hidden="true">🎉</span>}
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
                aria-pressed={state.welcomeReacted}
                aria-label={state.welcomeReacted ? 'Remove your celebration reaction' : 'React to welcome message'}
              >
                🎉 {state.welcomeReacted ? 2 : 1}
              </button>
            </div>
          </div>

          {task && task.status !== 'artifact' && (
            <div className="message-row employment-message-entry" key={`task-${task.id}`}>
              <div className="avatar boss-avatar" aria-hidden="true">B</div>
              <div className="message-body">
                <div className="message-meta"><strong>boss.exe</strong><span>assignment</span></div>
                <p>Here is the next thing to ship. Drop it on Terminal when you are ready.</p>
                <TaskAttachment task={task} elapsed={state.elapsed} availableTokens={state.tokens} onSend={sendTask} />
              </div>
            </div>
          )}

          {task?.status === 'artifact' && (
            <div className="message-row employment-message-entry" key={`artifact-${task.id}`}>
              <div className="avatar boss-avatar" aria-hidden="true">B</div>
              <div className="message-body">
                <div className="message-meta"><strong>agent-shell</strong><span>just now</span></div>
                <p>Waiting for <strong>{task.artifactName}</strong> from Terminal.</p>
              </div>
            </div>
          )}

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
                  disabled={pingRemaining <= 0}
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
          {!task && (
            <p className="employment-next-task" role="status" aria-live="polite">
              Next assignment in <strong>{formatSeconds(nextTaskRemaining)}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function TerminalContent({ state, dispatch, onOpenMessenger }: TerminalProps) {
  const [dragActive, setDragActive] = useState(false)
  const task = state.task
  const tokenCost = task ? taskCost(task) : 0
  const canBuyTokens = state.money >= 10 && state.tokens < 1_000_000
  const refillIn = 100 - (state.elapsed % 100 || 0)

  const handleTaskDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    const kind = event.dataTransfer.getData('application/x-vibemaxxer-task')
    const id = Number(kind)
    if (kind && Number.isInteger(id) && task?.id === id && task.status === 'assigned') {
      dispatch({ type: 'start-task', id })
    }
  }

  const startTask = () => {
    if (!task || task.status !== 'assigned') return
    dispatch({ type: 'start-task', id: task.id })
  }

  const deliverArtifact = () => {
    if (!task || task.status !== 'artifact') return
    dispatch({ type: 'deliver-task', id: task.id })
    onOpenMessenger()
  }

  const approval = (approved: boolean) => {
    if (!task || (task.status !== 'approval' && task.status !== 'blocked')) return
    dispatch({ type: 'approve-task', id: task.id, approved })
  }

  return (
    <div
      className={`terminal-app employment-terminal ${dragActive ? 'employment-drop-active' : ''}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-vibemaxxer-task')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDragActive(true)
        }
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleTaskDrop}
    >
      <div className="terminal-topline">
        <span><span className="terminal-dot" aria-hidden="true" /> agent-shell</span>
        <span>{task ? taskStatusLabel(task).toLowerCase() : 'idle'}</span>
      </div>
      <div className="terminal-output" aria-label="Terminal status">
        {!task && (
          <>
            <p className="terminal-muted">No task assigned</p>
            <p className="terminal-muted">Open Messenger when the next assignment arrives.</p>
          </>
        )}
        {task && (
          <>
            <p><span className="terminal-prompt">~</span> task/{task.id} · {task.title}</p>
            <p className="terminal-muted">{workPhrase(task)}</p>
            <div className="employment-progress-wrap" aria-label={`${Math.round(Math.min(1, task.progress / Math.max(1, task.difficulty)) * 100)} percent complete`}>
              <div className="employment-progress-bar" style={{ width: `${Math.min(100, Math.max(0, (task.progress / Math.max(1, task.difficulty)) * 100))}%` }} />
            </div>
            <div className="employment-terminal-stats">
              <span>{taskProgressLabel(task)}</span>
              <span>deadline {taskDeadline(task, state.elapsed)}</span>
            </div>

            {task.status === 'assigned' && (
              <div className="employment-terminal-action-block">
                <p className="terminal-muted">Attachment waiting. Start it here or drag it from Messenger.</p>
                <button className="employment-terminal-button" type="button" onClick={startTask} disabled={state.tokens < tokenCost}>
                  Start task <span>({tokenCost.toLocaleString()} tokens)</span>
                </button>
                {state.tokens < tokenCost && <span className="employment-control-hint">Need {tokenCost.toLocaleString()} tokens</span>}
              </div>
            )}

            {task.status === 'approval' && (
              <div className="employment-terminal-action-block employment-approval-block">
                <p className="terminal-muted">Review the agent's checkpoint.</p>
                <div className="employment-button-row">
                  <button className="employment-terminal-button" type="button" onClick={() => approval(true)}>Yes — approve and resume</button>
                  <button className="employment-terminal-button employment-danger-button" type="button" onClick={() => approval(false)}>No — needs changes</button>
                </div>
              </div>
            )}

            {task.status === 'blocked' && (
              <div className="employment-terminal-action-block employment-approval-block">
                <p className="terminal-muted">The agent paused after your review. Approve the checkpoint to retry.</p>
                <button className="employment-terminal-button" type="button" onClick={() => approval(true)}>Retry and resume</button>
              </div>
            )}

            {task.status === 'artifact' && (
              <div className="employment-terminal-action-block">
                <ArtifactAttachment task={task} elapsed={state.elapsed} onDeliver={deliverArtifact} />
              </div>
            )}
          </>
        )}
        <p className="terminal-prompt terminal-cursor">~ <span className="cursor-block" aria-hidden="true" /></p>
      </div>

      <div className="employment-terminal-footer">
        <div className="employment-token-line">
          <span><strong>{state.tokens.toLocaleString()}</strong> tokens available</span>
          <span className="employment-refill-countdown">
            {state.tokens >= 1_000_000 ? 'Balance full' : `Refill in ${formatSeconds(refillIn)}`}
          </span>
        </div>
        <button className="employment-buy-button" type="button" onClick={() => dispatch({ type: 'buy-tokens' })} disabled={!canBuyTokens}>
          Buy 100K tokens · $10
        </button>
        {!canBuyTokens && (
          <span className="employment-control-hint">
            {state.tokens >= 1_000_000 ? 'Balance is full' : 'Need $10 to buy tokens'}
          </span>
        )}
      </div>
      {dragActive && <div className="employment-drop-hint" role="status">Release to start this task</div>}
    </div>
  )
}
