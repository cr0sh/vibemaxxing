import { useEffect, useReducer, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent } from 'react'
import {
  companies,
  gameReducer,
  initialGame,
  sampleApplication,
  type Application,
  type GameAction,
  type GameState,
  type Stage,
} from './game'
import { WindowFrame, WindowWorkspace } from './DesktopWindows'
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

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGame)

  return <Desktop key={state.stage} state={state} dispatch={dispatch} />
}

function Desktop({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [application, setApplication] = useState<Application>(emptyApplication)
  const [windows, setWindows] = useState<WindowState>(() => ({
    apply: state.stage === 'applying',
    offer: state.stage === 'offer',
    messenger: state.stage === 'hired',
    terminal: state.stage === 'hired',
  }))
  const [activeWindow, setActiveWindow] = useState<WindowId>(
    state.stage === 'hired' ? 'messenger' : state.stage === 'offer' ? 'offer' : 'apply',
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(clock)
  }, [])

  const currentCompany = state.company ?? companies[0] ?? 'Prompt & Circumstance'
  const stageWindows: WindowId[] =
    state.stage === 'applying'
      ? ['apply']
      : state.stage === 'offer'
        ? ['offer']
        : ['messenger', 'terminal']
  const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const dateLabel = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const monthLabel = now.toLocaleDateString([], { month: 'short' }).toUpperCase()
  const weekdayLabel = now.toLocaleDateString([], { weekday: 'short' }).toUpperCase()

  const openWindow = (id: WindowId) => {
    setWindows((current) => ({ ...current, [id]: true }))
    setActiveWindow(id)
    requestAnimationFrame(() => {
      document.getElementById(`window-${id}`)?.focus({ preventScroll: true })
    })
  }

  const minimizeWindow = (id: WindowId) => {
    setWindows((current) => ({ ...current, [id]: false }))
    if (activeWindow === id) {
      const remaining = stageWindows.find((windowId) => windowId !== id && windows[windowId])
      if (remaining) setActiveWindow(remaining)
    }
  }

  const resetGame = () => {
    setApplication(emptyApplication())
    setWindows(initialWindows)
    setActiveWindow('apply')
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
      const value = event.currentTarget.value
      setApplication((current) => ({ ...current, [field]: value }))
    }

  const fillSample = () => setApplication({ ...sampleApplication })

  const handleDevJump = (stage: Stage) => {
    setApplication(emptyApplication())
    dispatch({ type: 'dev-jump', stage })
  }

  return (
    <div className={`app-shell stage-${state.stage}`}>
      <main className="desktop-area">
        <div className="desktop-orbit desktop-orbit-one" aria-hidden="true" />
        <div className="desktop-orbit desktop-orbit-two" aria-hidden="true" />
        <div className="desktop-grid" aria-hidden="true" />

        <section className="widget-band" aria-label="Desktop widgets">
          <div className="widget-cluster">
            <div className="resource-widget" aria-label="Starting inventory">
              <span className="resource-widget-icon" aria-hidden="true">🎒</span>
              <div>
                <span className="widget-label">Inventory</span>
                <span className="resource-values">
                  <strong>Energy 100</strong>
                  <strong>Tokens 1M</strong>
                  <strong>Money $0</strong>
                </span>
              </div>
            </div>
            <time className="clock-widget" dateTime={now.toISOString()} aria-label={`Local time ${timeLabel}`}>
              <span className="clock-icon" aria-hidden="true">◷</span>
              <span>{timeLabel}</span>
            </time>
            <time className="date-widget" dateTime={now.toISOString()} aria-label={dateLabel}>
              <span className="calendar-icon" aria-hidden="true">📅</span>
              <span className="calendar-month">{monthLabel}</span>
              <strong>{now.getDate()}</strong>
              <span className="calendar-weekday">{weekdayLabel}</span>
            </time>
          </div>
          <button className="new-game-button" type="button" onClick={resetGame}>New game</button>
        </section>

        <div className="workspace-area">
        <WindowWorkspace className={`windows-${state.stage}`}>
          {state.stage === 'applying' && (
            <WindowFrame
              id="apply"
              icon="📨"
              title="Applications"
              active={activeWindow === 'apply'}
              className="application-window"
              hidden={!windows.apply}
              onFocus={() => setActiveWindow('apply')}
              onMinimize={() => minimizeWindow('apply')}
            >
              <div className="window-heading-row">
                <div>
                  <p className="window-eyebrow">Application</p>
                  <h2>Job application</h2>
                </div>
                <div className="submission-stamp" aria-label={`${state.submissions} submissions`}>
                  <strong>{String(state.submissions).padStart(2, '0')}</strong>
                  <span>sent</span>
                </div>
              </div>
              <p className="window-intro">Tell us about your work.</p>
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
                      placeholder="Your name"
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
                      placeholder="you@example.com"
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
                    placeholder="A short description of your work"
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
                <span>{state.submissions} submissions</span>
              </div>
              {state.lastResult === 'rejected' && (
                <p className="feedback feedback-rejected" role="status" aria-live="polite" key={state.submissions}>
                  <span aria-hidden="true">⊘</span> Application not selected. Try again.
                </p>
              )}
            </WindowFrame>
          )}

          {state.stage === 'offer' && (
            <WindowFrame
              id="offer"
              icon="📬"
              title="Incoming offer"
              active={activeWindow === 'offer'}
              className="offer-window"
              hidden={!windows.offer}
              onFocus={() => setActiveWindow('offer')}
              onMinimize={() => minimizeWindow('offer')}
            >
              <p className="window-eyebrow">Offer</p>
              <div className="offer-hero">
                <span className="offer-spark" aria-hidden="true">✦</span>
                <div>
                  <h2>Offer received</h2>
                  <p>A team would like to hire you.</p>
                </div>
              </div>
              <div className="company-card">
                <div className="company-icon" aria-hidden="true">🏢</div>
                <div>
                  <p className="company-label">Company</p>
                  <h3>{currentCompany}</h3>
                  <p>Role: Vibe Engineer · Remote</p>
                </div>
              </div>
              <div className="offer-copy">
                <p>Review the offer, then choose whether to join the team.</p>
              </div>
              <button className="primary-button offer-accept" type="button" onClick={() => dispatch({ type: 'accept' })}>
                Accept offer <span aria-hidden="true">→</span>
              </button>
            </WindowFrame>
          )}

          {state.stage === 'hired' && (
            <>
              <WindowFrame
                id="messenger"
                icon="💬"
                title="Messenger"
                active={activeWindow === 'messenger'}
                className="messenger-window-frame"
                hidden={!windows.messenger}
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
                        <span>Team chat</span>
                      </div>
                    </div>
                    <div className="chat-messages">
                      <div className="welcome-banner"><span aria-hidden="true">🎉</span> Welcome to the team</div>
                      <div className="message-row">
                        <div className="avatar boss-avatar" aria-hidden="true">B</div>
                        <div className="message-body">
                          <div className="message-meta"><strong>boss.exe</strong><span>just now</span></div>
                          <p>Welcome aboard. Your workspace is ready.</p>
                          <div className="message-reaction" aria-label="One celebration reaction">🎉 1</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </WindowFrame>

              <WindowFrame
                id="terminal"
                icon="🖥️"
                title="Terminal"
                active={activeWindow === 'terminal'}
                className="terminal-window-frame"
                hidden={!windows.terminal}
                onFocus={() => setActiveWindow('terminal')}
                onMinimize={() => minimizeWindow('terminal')}
              >
                <div className="terminal-app">
                  <div className="terminal-topline">
                    <span><span className="terminal-dot" aria-hidden="true" /> agent-shell</span>
                    <span>zsh · idle</span>
                  </div>
                  <div className="terminal-output" aria-label="Terminal status">
                    <p className="terminal-muted">No task assigned</p>
                    <p className="terminal-cursor"><span className="terminal-prompt">~</span> <span className="cursor-block" aria-hidden="true" /></p>
                  </div>
                  <div className="terminal-scope">
                    <button className="terminal-replay" type="button" onClick={resetGame}>New game</button>
                  </div>
                </div>
              </WindowFrame>
            </>
          )}
        </WindowWorkspace>
        </div>

        {import.meta.env.DEV && (
          <details className="dev-tools">
            <summary>Dev</summary>
            <div className="dev-controls">
              <button type="button" onClick={() => handleDevJump('offer')}>Offer</button>
              <button type="button" onClick={() => handleDevJump('hired')}>Hired</button>
              <button type="button" onClick={resetGame}>Reset</button>
            </div>
          </details>
        )}
      </main>

      <footer className="dock-area">
        <nav className="dock" aria-label="Desktop windows">
          {stageWindows.map((id) => {
            const item = {
              apply: { icon: '📨', label: 'Applications' },
              offer: { icon: '📬', label: 'Offer' },
              messenger: { icon: '💬', label: 'Messenger' },
              terminal: { icon: '🖥️', label: 'Terminal' },
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
      </footer>
    </div>
  )
}

export default App
