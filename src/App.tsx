import { useEffect, useReducer, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  companies,
  gameReducer,
  initialGame,
  sampleApplication,
  type Application,
  type Stage,
} from './game'
import './App.css'

type WindowId = 'apply' | 'offer' | 'messenger' | 'terminal'
type WindowState = Record<WindowId, boolean>

const emptyApplication = (): Application => ({
  name: '',
  email: '',
  pitch: '',
})

const initialWindows: WindowState = {
  apply: true,
  offer: false,
  messenger: false,
  terminal: false,
}

const stageLabels: Record<Stage, string> = {
  applying: 'Applying',
  offer: 'Offer incoming',
  hired: 'Hired',
}

interface WindowFrameProps {
  id: WindowId
  icon: string
  title: string
  active: boolean
  className?: string
  onFocus: () => void
  onMinimize: () => void
  children: ReactNode
}

function WindowFrame({
  id,
  icon,
  title,
  active,
  className = '',
  onFocus,
  onMinimize,
  children,
}: WindowFrameProps) {
  const headingId = `window-heading-${id}`

  return (
    <section
      className={`window ${active ? 'window-active' : ''} ${className}`}
      aria-labelledby={headingId}
      onClick={onFocus}
    >
      <div className="window-chrome">
        <div className="window-lights" aria-hidden="true">
          <span className="window-light window-light-close" />
          <span className="window-light window-light-minimize" />
          <span className="window-light window-light-expand" />
        </div>
        <div className="window-title" id={headingId}>
          <span aria-hidden="true">{icon}</span>
          <span>{title}</span>
        </div>
        <button
          className="window-minimize"
          type="button"
          aria-label={`Minimize ${title} window`}
          onClick={(event) => {
            event.stopPropagation()
            onMinimize()
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>
      <div className="window-content">{children}</div>
    </section>
  )
}

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGame)
  const [application, setApplication] = useState<Application>(emptyApplication)
  const [windows, setWindows] = useState<WindowState>(initialWindows)
  const [activeWindow, setActiveWindow] = useState<WindowId>('apply')

  useEffect(() => {
    if (state.stage === 'applying') {
      setWindows({ apply: true, offer: false, messenger: false, terminal: false })
      setActiveWindow('apply')
    } else if (state.stage === 'offer') {
      setWindows({ apply: false, offer: true, messenger: false, terminal: false })
      setActiveWindow('offer')
    } else {
      setWindows({ apply: false, offer: false, messenger: true, terminal: true })
      setActiveWindow('messenger')
    }
  }, [state.stage])

  const currentCompany = state.company ?? companies[0] ?? 'A Very Real Startup'
  const stageWindows: WindowId[] =
    state.stage === 'applying'
      ? ['apply']
      : state.stage === 'offer'
        ? ['offer']
        : ['messenger', 'terminal']

  const openWindow = (id: WindowId) => {
    setWindows((current) => ({ ...current, [id]: true }))
    setActiveWindow(id)
  }

  const minimizeWindow = (id: WindowId) => {
    setWindows((current) => ({ ...current, [id]: false }))
    if (activeWindow === id) {
      const remaining = stageWindows.find((windowId) => windowId !== id && windows[windowId])
      if (remaining) setActiveWindow(remaining)
    }
  }

  const resetSlice = () => {
    setApplication(emptyApplication())
    dispatch({ type: 'reset' })
  }

  const submitApplication = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }

    dispatch({
      type: 'submit',
      roll: Math.random(),
      companyIndex: Math.floor(Math.random() * companies.length),
    })
    setApplication(emptyApplication())
  }

  const updateApplication =
    (field: keyof Application) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setApplication((current) => ({ ...current, [field]: event.currentTarget.value }))
    }

  const fillSample = () => setApplication({ ...sampleApplication })

  const handleDevJump = (stage: Stage) => {
    setApplication(emptyApplication())
    dispatch({ type: 'dev-jump', stage })
  }

  return (
    <div className={`app-shell stage-${state.stage}`}>
      <header className="menu-bar">
        <div className="menu-brand" aria-label="Vibemaxxer Career OS">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span className="brand-name">vibemaxxer</span>
          <span className="brand-divider" aria-hidden="true">/</span>
          <span className="brand-product">Career OS</span>
        </div>
        <nav className="menu-links" aria-label="Application menu">
          <span>File</span>
          <span>Edit</span>
          <span>Window</span>
          <span>Help</span>
        </nav>
        <div className="resource-bar" aria-label="Inactive resource placeholders">
          <span className="resource-pill" title="Energy is inactive in this slice">
            <span aria-hidden="true">⚡</span> Energy <strong>100</strong><span className="resource-state">inactive</span>
          </span>
          <span className="resource-pill" title="Tokens are inactive in this slice">
            <span aria-hidden="true">◈</span> Tokens <strong>1M</strong><span className="resource-state">inactive</span>
          </span>
          <span className="resource-pill" title="Money is inactive in this slice">
            <span aria-hidden="true">$</span> Money <strong>$0</strong><span className="resource-state">inactive</span>
          </span>
        </div>
        <div className="menu-date" aria-label="Current mode">WED 09:16</div>
      </header>

      <main className="desktop-area">
        <div className="desktop-orbit desktop-orbit-one" aria-hidden="true" />
        <div className="desktop-orbit desktop-orbit-two" aria-hidden="true" />
        <div className="desktop-grid" aria-hidden="true" />

        <section className="workspace-intro" aria-labelledby="workspace-title" key={state.stage}>
          <div>
            <p className="stage-kicker">
              <span className="status-pip" aria-hidden="true" />
              FIRST SLICE / 01 · {stageLabels[state.stage].toUpperCase()}
            </p>
            <h1 id="workspace-title">
              {state.stage === 'applying' && 'Career OS, apparently.'}
              {state.stage === 'offer' && 'The algorithm blinked green.'}
              {state.stage === 'hired' && 'Welcome to the workforce.'}
            </h1>
            <p className="workspace-subtitle">
              {state.stage === 'applying' && 'A tiny job hunt with a statistically meaningful amount of rejection.'}
              {state.stage === 'offer' && 'Against every sensible probability, someone wants to meet you.'}
              {state.stage === 'hired' && 'Your inbox is ready. Your terminal is waiting. Nothing else is playable yet.'}
            </p>
          </div>
          {state.stage === 'hired' && (
            <button className="replay-button" type="button" onClick={resetSlice}>
              <span aria-hidden="true">↺</span> Replay application slice
            </button>
          )}
        </section>

        <div className={`windows windows-${state.stage}`}>
          {state.stage === 'applying' && windows.apply && (
            <WindowFrame
              id="apply"
              icon="📨"
              title="Applications"
              active={activeWindow === 'apply'}
              className="application-window"
              onFocus={() => setActiveWindow('apply')}
              onMinimize={() => minimizeWindow('apply')}
            >
              <div className="window-heading-row">
                <div>
                  <p className="window-eyebrow">TALENT ACQUISITION DEPT. · FORM 001</p>
                  <h2>Apply to become someone else&apos;s leverage.</h2>
                </div>
                <div className="submission-stamp" aria-label={`${state.submissions} submissions`}>
                  <strong>{String(state.submissions).padStart(2, '0')}</strong>
                  <span>sent</span>
                </div>
              </div>
              <p className="window-intro">
                Tell a company who you are, what you can ship, and why your browser history is not relevant.
              </p>
              <form className="application-form" onSubmit={submitApplication}>
                <div className="field-grid">
                  <label className="field-label">
                    <span>Your name</span>
                    <input
                      name="name"
                      value={application.name}
                      onChange={updateApplication('name')}
                      required
                      autoComplete="name"
                      placeholder="Ada Lovelace (or equivalent)"
                    />
                  </label>
                  <label className="field-label">
                    <span>Email address</span>
                    <input
                      name="email"
                      type="email"
                      value={application.email}
                      onChange={updateApplication('email')}
                      required
                      autoComplete="email"
                      placeholder="you@the-internet.com"
                    />
                  </label>
                </div>
                <label className="field-label">
                  <span>One-paragraph pitch</span>
                  <textarea
                    name="pitch"
                    value={application.pitch}
                    onChange={updateApplication('pitch')}
                    required
                    rows={4}
                    placeholder="I make computers do things. Here is an unnecessarily compelling example..."
                  />
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    Submit application <span aria-hidden="true">↗</span>
                  </button>
                  {state.submissions >= 8 && (
                    <button className="secondary-button" type="button" onClick={fillSample}>
                      <span aria-hidden="true">✨</span> Fill sample
                    </button>
                  )}
                </div>
              </form>
              <div className="application-footnote">
                <span className="chance-badge">1% chance / submission</span>
                <span>Fields clear after every send. The friction is intentional.</span>
              </div>
              {state.lastResult === 'rejected' && (
                <p className="feedback feedback-rejected" role="status" aria-live="polite" key={state.submissions}>
                  <span aria-hidden="true">⊘</span> No offer this time. The hiring committee has chosen mystery.
                </p>
              )}
            </WindowFrame>
          )}

          {state.stage === 'offer' && windows.offer && (
            <WindowFrame
              id="offer"
              icon="📬"
              title="Incoming offer"
              active={activeWindow === 'offer'}
              className="offer-window"
              onFocus={() => setActiveWindow('offer')}
              onMinimize={() => minimizeWindow('offer')}
            >
              <p className="window-eyebrow">INCOMING OFFER · PRIORITY HIGH · PROBABLY REAL</p>
              <div className="offer-hero">
                <span className="offer-spark" aria-hidden="true">✦</span>
                <div>
                  <h2>They said yes.</h2>
                  <p>One percent finally did what one percent does once in a while.</p>
                </div>
              </div>
              <div className="company-card">
                <div className="company-icon" aria-hidden="true">🏢</div>
                <div>
                  <p className="company-label">YOUR NEW PROBLEM</p>
                  <h3>{currentCompany}</h3>
                  <p>Vibe Engineering · Remote-ish · Status: optimistic</p>
                </div>
              </div>
              <div className="offer-copy">
                <p>
                  This offer unlocks the hired desktop preview: a messenger welcome and an idle terminal waiting for the next slice.
                </p>
                <p className="muted-copy">No tasks, timers, rewards, or upgrades are active yet. We are being honest about the roadmap.</p>
              </div>
              <button className="primary-button offer-accept" type="button" onClick={() => dispatch({ type: 'accept' })}>
                Accept the suspiciously good news <span aria-hidden="true">→</span>
              </button>
            </WindowFrame>
          )}

          {state.stage === 'hired' && windows.messenger && (
            <WindowFrame
              id="messenger"
              icon="🟣"
              title="Pigeon Messenger"
              active={activeWindow === 'messenger'}
              className="messenger-window-frame"
              onFocus={() => setActiveWindow('messenger')}
              onMinimize={() => minimizeWindow('messenger')}
            >
              <div className="messenger-app">
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
                      <span>the place where announcements become culture</span>
                    </div>
                    <span className="chat-members">◉ 14</span>
                  </div>
                  <div className="chat-messages">
                    <div className="welcome-banner"><span aria-hidden="true">🎉</span> Welcome to the team</div>
                    <div className="message-row">
                      <div className="avatar boss-avatar" aria-hidden="true">B</div>
                      <div className="message-body">
                        <div className="message-meta"><strong>boss.exe</strong><span>just now</span></div>
                        <p>Welcome aboard! Your access is provisioned and your expectations are intentionally vague.</p>
                        <div className="message-reaction" aria-label="One celebration reaction">🎉 1</div>
                      </div>
                    </div>
                    <p className="chat-note">This messenger is a welcome preview. Boss pings and task attachments arrive in a future slice.</p>
                  </div>
                </div>
              </div>
            </WindowFrame>
          )}

          {state.stage === 'hired' && windows.terminal && (
            <WindowFrame
              id="terminal"
              icon="⌘"
              title="Terminal · idle"
              active={activeWindow === 'terminal'}
              className="terminal-window-frame"
              onFocus={() => setActiveWindow('terminal')}
              onMinimize={() => minimizeWindow('terminal')}
            >
              <div className="terminal-app">
                <div className="terminal-topline">
                  <span><span className="terminal-dot" aria-hidden="true" /> agent-shell</span>
                  <span>zsh · idle</span>
                </div>
                <div className="terminal-output" aria-label="Idle terminal preview">
                  <p><span className="terminal-prompt">~</span> vibemaxxer --status</p>
                  <p className="terminal-muted">checking employment status...</p>
                  <p className="terminal-success">status: employed (apparently)</p>
                  <p className="terminal-muted">agent: standing by for a task attachment</p>
                  <p className="terminal-muted">next slice: task loop · not playable yet</p>
                  <p className="terminal-cursor"><span className="terminal-prompt">~</span> <span className="cursor-block" aria-hidden="true" /></p>
                </div>
                <div className="terminal-scope">
                  <span className="scope-label">FIRST SLICE COMPLETE</span>
                  <p>There is nothing to run yet. Drag-and-drop, timers, upgrades, and rewards arrive later.</p>
                  <button className="terminal-replay" type="button" onClick={resetSlice}>↺ Replay the job hunt</button>
                </div>
              </div>
            </WindowFrame>
          )}
        </div>

        {import.meta.env.DEV && (
          <details className="dev-tools">
            <summary>Developer shortcuts</summary>
            <div className="dev-controls">
              <span>Skip the statistically unlikely parts:</span>
              <button type="button" onClick={() => handleDevJump('offer')}>Jump to offer</button>
              <button type="button" onClick={() => handleDevJump('hired')}>Jump to hired</button>
              <button type="button" onClick={resetSlice}>Reset slice</button>
            </div>
          </details>
        )}
      </main>

      <footer className="dock-area">
        <div className="dock-caption">WINDOWS <span aria-hidden="true">·</span> {stageLabels[state.stage].toUpperCase()}</div>
        <nav className="dock" aria-label="Desktop windows">
          {stageWindows.map((id) => {
            const item = {
              apply: { icon: '📨', label: 'Applications' },
              offer: { icon: '📬', label: 'Offer' },
              messenger: { icon: '🟣', label: 'Messenger' },
              terminal: { icon: '⌘', label: 'Terminal' },
            }[id]
            const isOpen = windows[id]
            return (
              <button
                className={`dock-item ${activeWindow === id ? 'dock-item-active' : ''} ${!isOpen ? 'dock-item-minimized' : ''}`}
                type="button"
                key={id}
                onClick={() => openWindow(id)}
                aria-label={`${isOpen ? 'Focus' : 'Open'} ${item.label} window`}
                aria-pressed={activeWindow === id && isOpen}
              >
                <span className="dock-icon" aria-hidden="true">{item.icon}</span>
                <span className="dock-label">{item.label}</span>
                <span className="dock-indicator" aria-hidden="true" />
              </button>
            )
          })}
        </nav>
        <p className="dock-note">Click a window to focus it · − minimizes</p>
      </footer>
    </div>
  )
}

export default App
