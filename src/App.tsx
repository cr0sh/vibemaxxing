import { useEffect, useReducer, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent } from 'react'
import {
  companies,
  gameReducer,
  initialGame,
  type Application,
  type GameAction,
  type GameState,
  type Stage,
  type TerminalId,
} from './game'
import { applicationSamples } from './applicationSamples'
import { MessengerContent, TerminalContent } from './Employment'
import { ShopContent } from './Shop'
import { WindowFrame, WindowWorkspace } from './DesktopWindows'
import { ResourceCounter } from './ResourceCounter'
import './App.css'

type WindowId = 'apply' | 'offer' | 'messenger' | 'terminal' | 'terminal-2' | 'shop' | 'defeat'
type WindowState = Record<WindowId, boolean>

const emptyApplication = (): Application => ({
  name: '',
  email: '',
  pitch: '',
})

const fillCharacterIntervals = {
  name: 34 / 3,
  email: 34 / 3,
  pitch: 14 / 3,
} as const

const fillFrameDelay = 16

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGame)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let lastTickAt = Date.now()
    const timer = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(new Date(currentTime))
      const elapsedSeconds = Math.floor((currentTime - lastTickAt) / 1000)
      if (elapsedSeconds > 0) {
        lastTickAt += elapsedSeconds * 1000
        if (state.stage === 'hired') {
          dispatch({ type: 'tick', seconds: elapsedSeconds })
        }
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [state.stage])

  return (
    <div className={`app-shell stage-${state.stage}`}>
      <DesktopWidgets state={state} now={now} />
      <Desktop key={state.stage === 'hired' || state.stage === 'lost' ? 'employment' : state.stage} state={state} dispatch={dispatch} />
    </div>
  )
}
function Desktop({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [application, setApplication] = useState<Application>(emptyApplication)
  const hasEmployment =
    state.stage === 'hired' ||
    (state.stage === 'lost' && (state.tasks.length > 0 || state.completedTasks > 0 || state.elapsed > 0 || state.lastDelivery !== null))
  const [windows, setWindows] = useState<WindowState>(() => ({
    apply: state.stage === 'applying',
    offer: state.stage === 'offer',
    messenger: state.stage === 'hired',
    terminal: state.stage === 'hired',
    'terminal-2': false,
    shop: false,
    defeat: state.stage === 'lost',
  }))
  const [activeWindow, setActiveWindow] = useState<WindowId>(
    state.stage === 'lost' ? 'defeat' : state.stage === 'hired' ? 'messenger' : state.stage === 'offer' ? 'offer' : 'apply',
  )
  const [isAutofilling, setIsAutofilling] = useState(false)
  const [defeatDismissed, setDefeatDismissed] = useState(false)
  const [defeatClaimed, setDefeatClaimed] = useState(false)
  const defeatAutoFront = state.stage === 'lost' && !defeatDismissed && !defeatClaimed
  const isWindowActive = (id: WindowId): boolean => defeatAutoFront ? id === 'defeat' : activeWindow === id
  const fillTimer = useRef<number | null>(null)
  const fillRun = useRef(0)
  const lastSample = useRef<number | null>(null)
  const cancelAutofill = () => {
    if (fillTimer.current !== null) {
      window.clearTimeout(fillTimer.current)
      fillTimer.current = null
    }
    fillRun.current += 1
    setIsAutofilling(false)
  }

  useEffect(() => {
    return () => {
      if (fillTimer.current !== null) window.clearTimeout(fillTimer.current)
      fillRun.current += 1
    }
  }, [state.stage])


  const currentCompany = state.company ?? companies[0] ?? 'Prompt & Circumstance'
  const terminalIds: TerminalId[] = hasEmployment ? state.terminals.map((terminal) => terminal.id) : []
  const stageWindows: WindowId[] =
    state.stage === 'applying'
      ? ['apply']
      : state.stage === 'offer'
        ? ['offer']
        : hasEmployment
          ? ['messenger', ...terminalIds, 'shop', ...(state.stage === 'lost' ? ['defeat' as const] : [])]
          : state.stage === 'lost'
            ? ['defeat']
            : []
  const openWindow = (id: WindowId) => {
    setWindows((current) => ({ ...current, [id]: true }))
    if (id === 'defeat') {
      setDefeatDismissed(false)
      setDefeatClaimed(true)
    } else if (defeatAutoFront) {
      setDefeatClaimed(true)
    }
    setActiveWindow(id)
  }

  const focusDefeat = () => {
    setDefeatClaimed(true)
    setActiveWindow('defeat')
    if (hasEmployment) setWindows((current) => ({ ...current, messenger: true }))
  }

  const minimizeWindow = (id: WindowId) => {
    setWindows((current) => ({
      ...current,
      [id]: false,
      ...(id === 'defeat' && hasEmployment ? { messenger: true } : {}),
    }))
    if (id === 'defeat') {
      setDefeatDismissed(true)
      setDefeatClaimed(true)
    }
    if (activeWindow === id) {
      const remaining = stageWindows.find((windowId) => windowId !== id && windows[windowId])
      if (remaining) setActiveWindow(remaining)
    }
  }


  const beginGame = () => {
    cancelAutofill()
    setApplication(emptyApplication())
    dispatch({ type: 'start', seed: Math.floor(Math.random() * 0x7fffffff) })
  }

  const retryGame = () => {
    cancelAutofill()
    setApplication(emptyApplication())
    dispatch({ type: 'reset' })
  }

  const submitApplication = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    if (state.energy < 3 || isAutofilling) return

    cancelAutofill()
    dispatch({
      type: 'submit',
      roll: Math.random(),
      companyIndex: Math.floor(Math.random() * companies.length),
    })
    setApplication(emptyApplication())
  }

  const updateApplication = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    cancelAutofill()
    const { name, value } = event.currentTarget
    setApplication((current) => ({ ...current, [name]: value }))
  }

  const fillSample = () => {
    if (state.stage !== 'applying' || state.submissions < 5 || applicationSamples.length === 0) return

    cancelAutofill()
    const poolSize = applicationSamples.length
    let index = Math.floor(Math.random() * (poolSize - (lastSample.current === null ? 0 : 1)))
    if (lastSample.current !== null && index >= lastSample.current) index += 1
    const picked = { sample: applicationSamples[index], index }
    lastSample.current = picked.index
    const sample = picked.sample
    const run = fillRun.current
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    if (prefersReducedMotion) {
      setIsAutofilling(false)
      setApplication({ ...sample })
      return
    }

    setIsAutofilling(true)
    setApplication(emptyApplication())
    const startedAt = performance.now()
    const completionDuration = Math.max(
      sample.name.length * fillCharacterIntervals.name,
      sample.email.length * fillCharacterIntervals.email,
      sample.pitch.length * fillCharacterIntervals.pitch,
    )

    const advance = () => {
      if (run !== fillRun.current) return

      const elapsed = performance.now() - startedAt
      const visibleName = sample.name.slice(0, Math.min(sample.name.length, Math.floor(elapsed / fillCharacterIntervals.name)))
      const visibleEmail = sample.email.slice(0, Math.min(sample.email.length, Math.floor(elapsed / fillCharacterIntervals.email)))
      const visiblePitch = sample.pitch.slice(0, Math.min(sample.pitch.length, Math.floor(elapsed / fillCharacterIntervals.pitch)))

      setApplication((current) => {
        if (current.name === visibleName && current.email === visibleEmail && current.pitch === visiblePitch) return current
        return { ...current, name: visibleName, email: visibleEmail, pitch: visiblePitch }
      })

      if (elapsed >= completionDuration) {
        fillTimer.current = null
        setIsAutofilling(false)
        return
      }
      fillTimer.current = window.setTimeout(advance, Math.min(fillFrameDelay, completionDuration - elapsed))
    }

    advance()

  }

  const handleDevJump = (stage: Stage) => {
    cancelAutofill()
    setApplication(emptyApplication())
    dispatch({ type: 'dev-jump', stage })
  }

  return (
    <>
      <main className="desktop-area">
        <div className="desktop-orbit desktop-orbit-one" aria-hidden="true" />
        <div className="desktop-orbit desktop-orbit-two" aria-hidden="true" />
        <div className="desktop-grid" aria-hidden="true" />



        {state.stage === 'ready' ? (
          <section className="ready-screen" aria-label="Start game">
            <button className="new-game-button ready-start" type="button" onClick={beginGame}>New game</button>
          </section>
        ) : (
          <div className="workspace-area">
            <WindowWorkspace className={`windows-${state.stage}`}>
              {state.stage === 'applying' && (
                <WindowFrame
                  id="apply"
                  icon="📨"
                  title="Applications"
                  active={isWindowActive('apply')}
                  className="application-window"
                  hidden={!windows.apply}
                  onFocus={() => setActiveWindow('apply')}
                  onMinimize={() => minimizeWindow('apply')}
                >
                  <div className="window-heading-row">
                    <div>
                      <h2>Job application</h2>
                    </div>
                    <div className="submission-stamp" aria-label={`${state.submissions} submissions`}>
                      <strong>{String(state.submissions).padStart(2, '0')}</strong>
                      <span>sent</span>
                    </div>
                  </div>
                  <form className="application-form" onSubmit={submitApplication}>
                    <div className="field-grid">
                      <label className="field-label">
                        <span>Your name</span>
                        <input name="name" value={application.name} onChange={updateApplication} required autoComplete="name" placeholder="Your name" />
                      </label>
                      <label className="field-label">
                        <span>Email address</span>
                        <input name="email" type="email" value={application.email} onChange={updateApplication} required autoComplete="email" placeholder="you@example.com" />
                      </label>
                    </div>
                    <label className="field-label">
                      <span>One-paragraph pitch</span>
                      <textarea name="pitch" value={application.pitch} onChange={updateApplication} required rows={4} placeholder="A short description of your work" />
                    </label>
                    <div className="form-actions">
                      <button className="primary-button" type="submit" disabled={state.energy < 3 || isAutofilling}>
                        Submit application <span aria-hidden="true">↗</span>
                      </button>
                      {state.submissions >= 5 && (
                        <button className="secondary-button" type="button" onClick={fillSample}>
                          <span aria-hidden="true">✦</span> Auto-fill application
                        </button>
                      )}
                    </div>
                  </form>
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
                  active={isWindowActive('offer')}
                  className="offer-window"
                  hidden={!windows.offer}
                  onFocus={() => setActiveWindow('offer')}
                  onMinimize={() => minimizeWindow('offer')}
                >
                  <div className="offer-hero">
                    <span className="offer-spark" aria-hidden="true">✦</span>
                    <div>
                      <h2>Offer received</h2>
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
                  <button className="primary-button offer-accept" type="button" onClick={() => dispatch({ type: 'accept' })}>
                    Accept offer <span aria-hidden="true">→</span>
                  </button>
                </WindowFrame>
              )}


              {hasEmployment && (
                <>
                  <WindowFrame
                    id="messenger"
                    icon="💬"
                    title="Messenger"
                    active={isWindowActive('messenger')}
                    className="messenger-window-frame"
                    contentLayout="fill"
                    hidden={!windows.messenger && !defeatAutoFront}
                    onFocus={() => setActiveWindow('messenger')}
                    onMinimize={() => minimizeWindow('messenger')}
                  >
                    <MessengerContent state={state} dispatch={dispatch} />
                  </WindowFrame>

                  {state.terminals.map((terminal) => (
                    <WindowFrame
                      key={terminal.id}
                      id={terminal.id}
                      icon="🖥️"
                      title={terminal.id === 'terminal' ? 'Terminal' : 'Terminal 2'}
                      active={isWindowActive(terminal.id)}
                      className={`terminal-window-frame ${terminal.yolo ? 'terminal-window-yolo' : ''}`}
                      contentLayout="fill"
                      hidden={!windows[terminal.id]}
                      onFocus={() => setActiveWindow(terminal.id)}
                      onMinimize={() => minimizeWindow(terminal.id)}
                    >
                      <TerminalContent
                        state={state}
                        dispatch={dispatch}
                        terminalId={terminal.id}
                        onOpenMessenger={() => openWindow('messenger')}
                      />
                    </WindowFrame>
                  ))}

                  <WindowFrame
                    id="shop"
                    icon="🛍️"
                    title="Shop"
                    active={isWindowActive('shop')}
                    className="shop-window-frame"
                    contentLayout="fill"
                    hidden={!windows.shop}
                    onFocus={() => setActiveWindow('shop')}
                    onMinimize={() => minimizeWindow('shop')}
                  >
                    <ShopContent state={state} dispatch={dispatch} />
                  </WindowFrame>
                </>
              )}
              {state.stage === 'lost' && (
                <WindowFrame
                  id="defeat"
                  icon="⚠️"
                  title="Run ended"
                  active={isWindowActive('defeat')}
                  className="loss-window"
                  hidden={state.stage !== 'lost' || defeatDismissed}
                  onFocus={focusDefeat}
                  onMinimize={() => minimizeWindow('defeat')}
                >
                  <div className="loss-card">
                    <span className="loss-icon" aria-hidden="true">⌁</span>
                    <h2>Run ended</h2>
                    <p>{state.failure ?? 'The deadline passed before the artifact arrived.'}</p>
                    <button className="primary-button" type="button" onClick={retryGame}>Retry</button>
                  </div>
                </WindowFrame>
              )}
            </WindowWorkspace>
          </div>
        )}

        {import.meta.env.DEV && state.stage !== 'ready' && (
          <details className="dev-tools">
            <summary>Dev</summary>
            <div className="dev-controls">
              <button type="button" onClick={() => handleDevJump('offer')}>Offer</button>
              <button type="button" onClick={() => handleDevJump('hired')}>Hired</button>
              <button type="button" onClick={() => dispatch({ type: 'tick', seconds: 30 })}>Advance 30s</button>
              <button type="button" onClick={retryGame}>Reset</button>
            </div>
          </details>
        )}
      </main>

      {state.stage !== 'ready' && (
        <footer className="dock-area">
          <nav className="dock" aria-label="Desktop windows">
            {stageWindows.map((id) => {
              const item =
                id === 'apply'
                  ? { icon: '📨', label: 'Applications' }
                  : id === 'offer'
                    ? { icon: '📬', label: 'Offer' }
                    : id === 'messenger'
                      ? { icon: '💬', label: 'Messenger' }
                      : id === 'shop'
                        ? { icon: '🛍️', label: 'Shop' }
                        : id === 'defeat'
                          ? { icon: '⚠️', label: 'Run ended' }
                          : { icon: '🖥️', label: id === 'terminal' ? 'Terminal' : 'Terminal 2' }
              const isOpen = id === 'defeat'
                ? state.stage === 'lost' && !defeatDismissed
                : windows[id] || (id === 'messenger' && defeatAutoFront)
              return (
                <button
                  className={`dock-item ${isWindowActive(id) ? 'dock-item-active' : ''} ${!isOpen ? 'dock-item-minimized' : ''}`}
                  type="button"
                  key={id}
                  onClick={() => openWindow(id)}
                  aria-label={`${isOpen ? 'Focus' : 'Open'} ${item.label} window`}
                  aria-pressed={isWindowActive(id) && isOpen}
                >
                  <span className="dock-icon" aria-hidden="true">{item.icon}</span>
                  <span className="dock-label">{item.label}</span>
                  <span className="dock-indicator" aria-hidden="true" />
                </button>
              )
            })}
          </nav>
        </footer>
      )}
    </>
  )
}

function DesktopWidgets({ state, now }: { state: GameState; now: Date }) {
  const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const dateLabel = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const monthLabel = now.toLocaleDateString([], { month: 'short' }).toUpperCase()
  const weekdayLabel = now.toLocaleDateString([], { weekday: 'short' }).toUpperCase()
  const showPaidResources = state.stage === 'hired' || (state.stage === 'lost' && state.company !== null)
  return (
        <section className={`widget-band ${showPaidResources ? 'widget-band-paid' : ''}`} aria-label="Desktop widgets">
          <div className="widget-cluster">
            <div className={`paid-resources ${showPaidResources ? 'paid-resources-visible' : ''}`} aria-hidden={!showPaidResources}>
              <div className="paid-resources-inner">
                <div className="resource-widget resource-widget-money" aria-label={`Money ${state.money} dollars`}>
                  <span className="resource-widget-icon" aria-hidden="true">$</span>
                  <div>
                    <span className="widget-label">Money</span>
                    <span className="resource-values"><ResourceCounter value={state.money} prefix="$" /></span>
                  </div>
                </div>
                <div className="resource-widget resource-widget-tokens" aria-label={`Tokens ${state.tokens}`}>
                  <span className="resource-widget-icon" aria-hidden="true">◇</span>
                  <div>
                    <span className="widget-label">Tokens</span>
                    <span className="resource-values"><ResourceCounter value={state.tokens} /></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="resource-widget resource-widget-energy" aria-label={`Energy ${state.energy}`}>
              <span className="resource-widget-icon" aria-hidden="true">⚡</span>
              <div>
                <span className="widget-label">Energy</span>
                <span className="resource-values"><ResourceCounter value={state.energy} /></span>
              </div>
            </div>
            <time className="clock-widget" dateTime={now.toISOString()} aria-label={`Local time ${timeLabel}`}>
              <span className="clock-icon" aria-hidden="true">◷</span>
              <span>{timeLabel}</span>
            </time>
            <time className="date-widget" dateTime={now.toISOString()} aria-label={dateLabel}>
              <span className="calendar-month">{monthLabel}</span>
              <strong>{now.getDate()}</strong>
              <span className="calendar-weekday">{weekdayLabel}</span>
            </time>
          </div>
        </section>
  )
}

export default App
