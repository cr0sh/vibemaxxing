import { useEffect, useReducer, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent } from 'react'
import {
  completedTaskCount,
  companies,
  gameNetWorth,
  gameReducer,
  initialGame,
  isLocalTerminal,
  WIN_NET_WORTH,
  type Application,
  type DevJumpTarget,
  type GameAction,
  type GameState,
  type TerminalId,
  hasTokenDeficit,
} from './game'
import { getSoundsMuted, playSound, setSoundsMuted } from './sounds'
import { useInteractionSounds } from './useInteractionSounds'
import { applicationSamples } from './applicationSamples'
import { MessengerContent, TerminalContent } from './Employment'
import { MarketContent } from './Market'
import { ShopContent } from './Shop'
import { SocialContent } from './Social'
import { ShortsContent } from './Shorts'
import { MercuryContent } from './Mercury'
import { WindowFrame, WindowWorkspace } from './DesktopWindows'
import { ResourceCounter } from './ResourceCounter'
import './App.css'

type WindowId = 'apply' | 'offer' | 'messenger' | 'terminal' | 'terminal-2' | 'spark' | 'spark-ultra' | 'shop' | 'social' | 'market' | 'mercury' | 'shorts' | 'defeat'

type WindowState = Record<WindowId, boolean>
type RevisionMap = Partial<Record<WindowId, string | Set<string>>>

function sameRevision(previous: RevisionMap[WindowId], current: RevisionMap[WindowId]): boolean {
  if (previous === current) return true
  if (!(previous instanceof Set) || !(current instanceof Set) || previous.size !== current.size) return false
  for (const event of current) if (!previous.has(event)) return false
  return true
}

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
const tokenFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGame)
  useInteractionSounds()
  const [now, setNow] = useState(() => new Date())
  const [isDevPaused, setIsDevPaused] = useState(false)
  const [devRemount, setDevRemount] = useState(0)
  const [devOpenTarget, setDevOpenTarget] = useState<DevJumpTarget | null>(null)
  const previousStateRef = useRef(state)
  const suppressEventSoundsRef = useRef(false)

  useEffect(() => {
    const previousState = previousStateRef.current
    previousStateRef.current = state

    const primaryHired = previousState.stage !== 'hired' && state.stage === 'hired'
    const secondaryHired = previousState.secondJob === null && state.secondJob !== null
    const wasPromoted = state.messages.some((message) =>
      message.type === 'promotion' && !previousState.messages.some((previousMessage) => previousMessage.id === message.id),
    )
    if (primaryHired || secondaryHired || wasPromoted) {
      playSound('milestone')
    }

    if (previousState.stage === 'hired' && state.stage === 'hired') {
      const taskStarted = state.tasks.some((task) => {
        if (task.status !== 'working' || task.terminalId === null || task.slot === null) return false
        const previousTask = previousState.tasks.find((candidate) => candidate.id === task.id)
        return previousTask?.status === 'assigned' && previousTask.terminalId === null && previousTask.slot === null
      })
      if (taskStarted) playSound('task-transfer')

      const artifactDelivered =
        completedTaskCount(state) > completedTaskCount(previousState) &&
        previousState.tasks.some((task) => task.status === 'artifact' && !state.tasks.some((candidate) => candidate.id === task.id))
      if (artifactDelivered) playSound('artifact-transfer')
    }

    if (suppressEventSoundsRef.current) {
      suppressEventSoundsRef.current = false
      return
    }
    if (previousState.stage !== 'hired' || state.stage !== 'hired') return

    if (state.messages !== previousState.messages) {
      const previousMessageIds = new Set(previousState.messages.map((message) => message.id))
      if (state.messages.some((message) => !previousMessageIds.has(message.id))) {
        playSound('messenger-message')
      }
    }

    if (state.socialPosts !== previousState.socialPosts) {
      const previousPostIds = new Set(previousState.socialPosts.map((post) => post.id))
      if (state.socialPosts.some((post) => !previousPostIds.has(post.id))) {
        playSound('social-post')
      }
    }
  }, [state])

  useEffect(() => {
    let lastTickAt = Date.now()
    const timer = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(new Date(currentTime))
      const elapsedHalfSeconds = Math.floor((currentTime - lastTickAt) / 500)
      if (elapsedHalfSeconds > 0) {
        lastTickAt += elapsedHalfSeconds * 500
        if (state.stage === 'hired' && !isDevPaused) {
          dispatch({ type: 'tick', seconds: elapsedHalfSeconds * 0.5 })
        }
      }
    }, 500)

    return () => window.clearInterval(timer)
  }, [state.stage, isDevPaused])

  const handleDevJump = (target: DevJumpTarget) => {
    suppressEventSoundsRef.current = true
    setDevOpenTarget(target)
    setDevRemount((current) => current + 1)
  }

  const devOpenWindow: WindowId | null =
    devOpenTarget === 'ready' ? null :
      devOpenTarget === 'applying' ? 'apply' :
        devOpenTarget === 'offer' ? 'offer' :
          devOpenTarget === 'hired' ? 'messenger' :
            devOpenTarget === 'lost' || devOpenTarget === 'energy-loss' || devOpenTarget === 'won' ? 'defeat' :
              devOpenTarget === 'tiro' ? 'social' :
                devOpenTarget === 'market' ? 'market' :
                  devOpenTarget === 'spark' ? 'spark' :
                    devOpenTarget === 'spark-ultra' ? 'shop' :
                      devOpenTarget === 'mercury' ? 'mercury' :
                        devOpenTarget === 'second-job' ? 'messenger' :
                          devOpenTarget === 'monopoly' ? 'social' :
                            devOpenTarget === 'frontier' ? 'terminal' :
                              devOpenTarget === 'shorts' ? 'shorts' : null
  return (
    <div className={`app-shell stage-${state.stage}`}>
      <DesktopWidgets state={state} now={now} />
      <Desktop
        key={`${state.stage === 'hired' || state.stage === 'lost' || state.stage === 'won' ? 'employment' : state.stage}-${devRemount}`}
        state={state}
        dispatch={dispatch}
        isDevPaused={isDevPaused}
        onDevPauseChange={setIsDevPaused}
        openWindowOnMount={devOpenWindow}
        onDevJump={handleDevJump}
        onDevWindowOpened={() => setDevOpenTarget(null)}
      />
    </div>
  )
}
function Desktop({
  state,
  dispatch,
  isDevPaused,
  onDevPauseChange,
  openWindowOnMount,
  onDevJump,
  onDevWindowOpened,
}: {
  state: GameState
  dispatch: Dispatch<GameAction>
  isDevPaused: boolean
  onDevPauseChange: (paused: boolean) => void
  openWindowOnMount: WindowId | null
  onDevJump: (target: DevJumpTarget) => void
  onDevWindowOpened: () => void
}) {
  const [application, setApplication] = useState<Application>(emptyApplication)
  const isEnding = state.stage === 'lost' || state.stage === 'won'
  const hasEmployment = state.stage === 'hired' || isEnding
  const secondApplicationAvailable =
    state.stage === 'hired' && state.secondJobUnlocked && state.secondJob === null && state.secondJobOffer === null
  const secondOfferAvailable = state.stage === 'hired' && state.secondJobOffer !== null
  const showApplication = state.stage === 'applying' || secondApplicationAvailable
  const showOffer = state.stage === 'offer' || secondOfferAvailable
  const [windows, setWindows] = useState<WindowState>(() => ({
    apply: state.stage === 'applying' || secondApplicationAvailable || openWindowOnMount === 'apply',
    offer: state.stage === 'offer' || secondOfferAvailable || openWindowOnMount === 'offer',
    messenger: state.stage === 'hired' || openWindowOnMount === 'messenger',
    terminal: state.stage === 'hired' || openWindowOnMount === 'terminal',
    'terminal-2': openWindowOnMount === 'terminal-2',
    spark: openWindowOnMount === 'spark',
    'spark-ultra': openWindowOnMount === 'spark-ultra',
    shop: openWindowOnMount === 'shop',
    mercury: state.mercuryOwned || openWindowOnMount === 'mercury',
    social: openWindowOnMount === 'social',
    market: openWindowOnMount === 'market',
    shorts: openWindowOnMount === 'shorts',
    defeat: isEnding,
  }))
  const [acknowledgedDockWindows, setAcknowledgedDockWindows] = useState<Set<WindowId>>(
    () => new Set((Object.keys(windows) as WindowId[]).filter((id) => windows[id])),
  )
  const [requestedActiveWindow, setActiveWindow] = useState<WindowId>(() => {
    if (openWindowOnMount) return openWindowOnMount
    if (isEnding) return 'defeat'
    if (state.stage === 'hired') return 'messenger'
    if (state.stage === 'offer') return 'offer'
    return 'apply'
  })
  const [focusRequest, setFocusRequest] = useState(0)
  const [isAutofilling, setIsAutofilling] = useState(false)
  const [defeatDismissed, setDefeatDismissed] = useState(false)
  const [defeatClaimed, setDefeatClaimed] = useState(false)
  const defeatAutoFront = isEnding && !defeatDismissed && !defeatClaimed
  const fillTimer = useRef<number | null>(null)
  const fillRun = useRef(0)
  const lastSample = useRef<number | null>(null)
  const [previousRevisions, setPreviousRevisions] = useState<RevisionMap>({})
  const [previousMercuryOwned, setPreviousMercuryOwned] = useState(state.mercuryOwned)
  const [previousShortsUnlocked, setPreviousShortsUnlocked] = useState(state.shortsUnlocked)
  const devWindowOpenedRef = useRef(false)

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
  const stageWindows: WindowId[] = state.stage === 'applying'
    ? ['apply']
    : state.stage === 'offer'
      ? ['offer']
      : hasEmployment
        ? [
            ...(secondApplicationAvailable ? ['apply' as const] : secondOfferAvailable ? ['offer' as const] : []),
            'messenger',
            ...terminalIds,
            'shop',
            ...(state.mercuryOwned ? ['mercury' as const] : []),
            ...(state.market !== null ? ['market' as const] : []),
            ...(state.socialInstalledAt !== null ? ['social' as const] : []),
            ...(state.shortsUnlocked ? ['shorts' as const] : []),
            ...(isEnding ? ['defeat' as const] : []),
          ]
        : isEnding ? ['defeat'] : []
  const activeWindow = stageWindows.includes(requestedActiveWindow)
    ? requestedActiveWindow
    : stageWindows.find((id) => windows[id]) ?? stageWindows[0] ?? requestedActiveWindow
  const isWindowActive = (id: WindowId): boolean => defeatAutoFront ? id === 'defeat' : activeWindow === id

  const revisions: RevisionMap = {
    ...(hasEmployment ? { messenger: new Set(state.messages.map((message) => message.id)) } : {}),
    ...(state.socialInstalledAt !== null ? { social: new Set(state.socialPosts.map((post) => post.id)) } : {}),
    ...(hasEmployment ? {
      shop: new Set<string>(state.shopDiscoveries),
    } : {}),
    ...(showApplication ? { apply: `${state.stage === 'applying'}|${secondApplicationAvailable}` } : {}),
    ...(showOffer ? { offer: `${state.stage === 'offer'}|${secondOfferAvailable}` } : {}),
    ...(state.market !== null ? { market: 'available' } : {}),
    ...(state.mercuryOwned ? {
      mercury: new Set([
        `enabled:${state.mercuryEnabled}`,
        ...state.tasks.map((task) => `task:${task.id}:${task.status}:${task.attempt}:${task.terminalId ?? ''}:${task.mercuryAuto === true ? 'auto' : 'manual'}`),
        ...state.terminals.map((terminal) => `terminal:${terminal.id}:${terminal.slots}:${terminal.yolo}:${terminal.fastMode}:${terminal.model}`),
      ]),
    } : {}),
  }
  for (const terminal of state.terminals) {
    const revision = new Set([
      `setup:${terminal.slots}:${terminal.yolo}:${terminal.model}:${terminal.fastMode}:${!isLocalTerminal(terminal.id) && state.frontierModelUnlocked}`,
    ])
    for (const task of state.tasks) {
      if (task.terminalId === terminal.id && (task.status === 'approval' || task.status === 'failed' || task.status === 'artifact')) {
        revision.add(`${task.id}:${task.attempt}:${task.status}`)
      }
    }
    revisions[terminal.id] = revision
  }
  if ((Object.keys(revisions) as WindowId[]).some((id) => !sameRevision(previousRevisions[id], revisions[id]))) {
    setPreviousRevisions(revisions)
    setAcknowledgedDockWindows((current) => {
      const next = new Set(current)
      let changed = false
      for (const id of stageWindows) {
        const revision = revisions[id]
        if (revision === undefined) continue
        const previousRevision = previousRevisions[id]
        const isOpen = windows[id] || (id === 'messenger' && defeatAutoFront)
        if (previousRevision === undefined) {
          if (isOpen && !next.has(id)) {
            next.add(id)
            changed = true
          }
          continue
        }
        let hasUpdate = previousRevision !== revision
        if (revision instanceof Set && previousRevision instanceof Set) {
          hasUpdate = false
          for (const event of revision) {
            if (!previousRevision.has(event)) {
              hasUpdate = true
              break
            }
          }
        }
        if (hasUpdate) {
          if (isWindowActive(id) && isOpen) {
            if (!next.has(id)) {
              next.add(id)
              changed = true
            }
          } else if (next.has(id)) {
            next.delete(id)
            changed = true
          }
        }
      }
      return changed ? next : current
    })
  }

  const devWindowAvailable = openWindowOnMount !== null && stageWindows.includes(openWindowOnMount)
  useEffect(() => {
    if (!openWindowOnMount || devWindowOpenedRef.current || !devWindowAvailable) return
    devWindowOpenedRef.current = true
    setWindows((current) => ({ ...current, [openWindowOnMount]: true }))
    setActiveWindow(openWindowOnMount)
    setAcknowledgedDockWindows((current) => new Set(current).add(openWindowOnMount))
    setFocusRequest((request) => request + 1)
    onDevWindowOpened()
  }, [openWindowOnMount, devWindowAvailable, onDevWindowOpened])

  const acknowledgeDockWindow = (id: WindowId) => {
    setAcknowledgedDockWindows((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
  }
  const focusWindow = (id: WindowId) => {
    acknowledgeDockWindow(id)
    setActiveWindow(id)
  }
  const openWindow = (id: WindowId) => {
    acknowledgeDockWindow(id)
    setWindows((current) => ({ ...current, [id]: true }))
    if (id === 'defeat') {
      setDefeatDismissed(false)
      setDefeatClaimed(true)
    } else if (defeatAutoFront) {
      setDefeatClaimed(true)
    }
    setFocusRequest((request) => request + 1)
    setActiveWindow(id)
  }
  if (previousMercuryOwned !== state.mercuryOwned) {
    setPreviousMercuryOwned(state.mercuryOwned)
    if (state.mercuryOwned) openWindow('mercury')
  }
  if (previousShortsUnlocked !== state.shortsUnlocked) {
    setPreviousShortsUnlocked(state.shortsUnlocked)
    if (state.shortsUnlocked && state.stage === 'hired') openWindow('shorts')
  }
  const focusDefeat = () => {
    acknowledgeDockWindow('defeat')
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
      if (remaining) focusWindow(remaining)
    }
  }

  const beginGame = () => {
    cancelAutofill()
    onDevPauseChange(false)
    setApplication(emptyApplication())
    dispatch({ type: 'start', seed: Math.floor(Math.random() * 0x7fffffff) })
  }

  const retryGame = () => {
    cancelAutofill()
    onDevPauseChange(false)
    setApplication(emptyApplication())
    dispatch({ type: 'reset' })
  }

  const submitApplication = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    if (state.energy < 3 || isAutofilling || (!showApplication && state.stage !== 'applying')) return

    cancelAutofill()
    const action: GameAction = secondApplicationAvailable
      ? {
          type: 'submit-second-job',
          roll: Math.random(),
          companyIndex: Math.floor(Math.random() * companies.length),
        }
      : {
          type: 'submit',
          roll: Math.random(),
          companyIndex: Math.floor(Math.random() * companies.length),
        }
    dispatch(action)
    setApplication(emptyApplication())
  }

  const updateApplication = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    cancelAutofill()
    const { name, value } = event.currentTarget
    setApplication((current) => ({ ...current, [name]: value }))
  }

  const fillSample = () => {
    const canAutofill = state.stage === 'applying'
      ? state.submissions >= 3
      : secondApplicationAvailable
    if (!canAutofill || applicationSamples.length === 0) return

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

  const runDevJump = (stage: DevJumpTarget) => {
    cancelAutofill()
    onDevPauseChange(false)
    setApplication(emptyApplication())
    onDevJump(stage)
    dispatch({ type: 'dev-jump', stage })
  }

  const applicationCount = secondApplicationAvailable ? state.secondJobApplications : state.submissions
  const applicationTitle = secondApplicationAvailable ? 'Second job application' : 'Job application'
  const offerCompany = secondOfferAvailable ? state.secondJobOffer : currentCompany
  const endingIsVictory = state.stage === 'won'
  const endingIsEnergyLoss = state.lossReason === 'energy'
  const endingTitle = endingIsVictory ? 'You won' : endingIsEnergyLoss ? 'Energy depleted' : 'You are fired'
  const endingHeading = endingIsVictory
    ? 'You are now a multimillionaire'
    : endingIsEnergyLoss
      ? 'Your energy ran out'
      : 'You are fired'
  const endingBody = endingIsVictory
    ? `Your liquid net worth is $${Math.round(gameNetWorth(state)).toLocaleString('en-US')}, meeting the $${WIN_NET_WORTH.toLocaleString('en-US')} finish line. You do not need to work anymore.`
    : endingIsEnergyLoss
      ? 'Your energy reached zero and you fell into depression. This run is over. Take a real break before trying again.'
      : state.failure ?? 'The work ended before the artifact arrived. You can try again.'
  const endingIcon = endingIsVictory ? '🏆' : endingIsEnergyLoss ? '🫥' : '⚠️'

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
            <WindowWorkspace className={`windows-${state.stage}`} focusRequest={focusRequest}>
              {showApplication && (
                <WindowFrame
                  id="apply"
                  icon="📨"
                  title="Applications"
                  active={isWindowActive('apply')}
                  className="application-window"
                  hidden={!windows.apply}
                  onFocus={() => focusWindow('apply')}
                  onMinimize={() => minimizeWindow('apply')}
                >
                  <div className="window-heading-row">
                    <div><h2>{applicationTitle}</h2></div>
                    <div className="submission-stamp" aria-label={`${applicationCount} submissions`}>
                      <strong>{String(applicationCount).padStart(2, '0')}</strong>
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
                      {(secondApplicationAvailable || state.submissions >= 3) && (
                        <button className="secondary-button" type="button" onClick={fillSample} disabled={isAutofilling}>
                          <span aria-hidden="true">✦</span> Auto-fill application
                        </button>
                      )}
                    </div>
                  </form>
                  {state.lastResult === 'rejected' && (
                    <p className="feedback feedback-rejected" role="status" aria-live="polite" key={`${state.submissions}-${state.secondJobApplications}`}>
                      <span aria-hidden="true">⊘</span> Application not selected. Try again.
                    </p>
                  )}
                </WindowFrame>
              )}

              {showOffer && (
                <WindowFrame
                  id="offer"
                  icon="📬"
                  title={secondOfferAvailable ? 'Second job offer' : 'Incoming offer'}
                  active={isWindowActive('offer')}
                  className="offer-window"
                  hidden={!windows.offer}
                  onFocus={() => focusWindow('offer')}
                  onMinimize={() => minimizeWindow('offer')}
                >
                  <div className="offer-hero">
                    <span className="offer-spark" aria-hidden="true">✦</span>
                    <div><h2>{secondOfferAvailable ? 'Second job offer' : 'Offer received'}</h2></div>
                  </div>
                  <div className="company-card">
                    <div className="company-icon" aria-hidden="true">🏢</div>
                    <div>
                      <p className="company-label">Company</p>
                      <h3>{offerCompany}</h3>
                      <p>Role: Vibe Engineer · Remote</p>
                    </div>
                  </div>
                  <button className="primary-button offer-accept" type="button" onClick={() => dispatch(secondOfferAvailable ? { type: 'accept-second-job' } : { type: 'accept' })}>
                    {secondOfferAvailable ? 'Accept second job' : 'Accept offer'} <span aria-hidden="true">→</span>
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
                    onFocus={() => focusWindow('messenger')}
                    onMinimize={() => minimizeWindow('messenger')}
                  >
                    <MessengerContent state={state} dispatch={dispatch} onOpenSocial={() => openWindow('social')} />
                  </WindowFrame>

                  {state.terminals.map((terminal) => (
                    <WindowFrame
                      id={terminal.id}
                      key={terminal.id}
                      icon="🖥️"
                      title={
                        isLocalTerminal(terminal.id)
                          ? terminal.id === 'spark-ultra' ? 'Mapple Spark Ultra' : 'Mapple Spark'
                          : terminal.id === 'terminal' ? 'Terminal' : 'Terminal 2'
                      }
                      active={isWindowActive(terminal.id)}
                      className={`terminal-window-frame terminal-window-${terminal.id} ${terminal.yolo ? 'terminal-window-yolo' : ''}`}
                      contentLayout="fill"
                      hidden={!windows[terminal.id]}
                      onFocus={() => focusWindow(terminal.id)}
                      onMinimize={() => minimizeWindow(terminal.id)}
                    >
                      <TerminalContent state={state} dispatch={dispatch} terminalId={terminal.id} />
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
                    onFocus={() => focusWindow('shop')}
                    onMinimize={() => minimizeWindow('shop')}
                  >
                    <ShopContent state={state} dispatch={dispatch} active={windows.shop && isWindowActive('shop')} />
                  </WindowFrame>
                  {state.mercuryOwned && (
                    <WindowFrame
                      id="mercury"
                      icon="☿"
                      title="Mercury"
                      active={isWindowActive('mercury')}
                      className="mercury-window-frame"
                      contentLayout="fill"
                      hidden={!windows.mercury}
                      onFocus={() => focusWindow('mercury')}
                      onMinimize={() => minimizeWindow('mercury')}
                    >
                      <MercuryContent state={state} dispatch={dispatch} />
                    </WindowFrame>
                  )}
                  {state.market !== null && (
                    <WindowFrame
                      id="market"
                      icon="📈"
                      title="Market"
                      active={isWindowActive('market')}
                      className="market-window-frame"
                      contentLayout="fill"
                      hidden={!windows.market}
                      onFocus={() => focusWindow('market')}
                      onMinimize={() => minimizeWindow('market')}
                    >
                      <MarketContent state={state} dispatch={dispatch} />
                    </WindowFrame>
                  )}
                  {state.socialInstalledAt !== null && (
                    <WindowFrame
                      id="social"
                      icon="Z"
                      title="ZZZ"
                      active={isWindowActive('social')}
                      className="social-window-frame"
                      contentLayout="fill"
                      hidden={!windows.social}
                      onFocus={() => focusWindow('social')}
                      onMinimize={() => minimizeWindow('social')}
                    >
                      <SocialContent state={state} dispatch={dispatch} />
                    </WindowFrame>
                  )}
                  {state.shortsUnlocked && (
                    <WindowFrame
                      id="shorts"
                      icon="🎬"
                      title="Shorts"
                      active={state.stage === 'hired' && windows.shorts && isWindowActive('shorts')}
                      className="shorts-window-frame"
                      contentLayout="fill"
                      hidden={!windows.shorts}
                      onFocus={() => focusWindow('shorts')}
                      onMinimize={() => minimizeWindow('shorts')}
                    >
                      <ShortsContent state={state} dispatch={dispatch} active={state.stage === 'hired' && windows.shorts && isWindowActive('shorts')} />
                    </WindowFrame>
                  )}
                </>
              )}
              {isEnding && (
                <WindowFrame
                  id="defeat"
                  icon={endingIcon}
                  title={endingTitle}
                  active={isWindowActive('defeat')}
                  className={`loss-window ${endingIsVictory ? 'victory-window' : endingIsEnergyLoss ? 'energy-loss-window' : ''}`}
                  hidden={!isEnding || defeatDismissed}
                  onFocus={focusDefeat}
                  onMinimize={() => minimizeWindow('defeat')}
                >
                  <div className="loss-card">
                    <span className="loss-icon" aria-hidden="true">{endingIcon}</span>
                    <h2>{endingHeading}</h2>
                    <p>{endingBody}</p>
                    <button className="primary-button" type="button" onClick={retryGame}>Try again</button>
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
              <button type="button" aria-pressed={isDevPaused} onClick={() => onDevPauseChange(!isDevPaused)}>
                {isDevPaused ? 'Resume timer' : 'Pause timer'}
              </button>
              <button type="button" onClick={() => dispatch({ type: 'tick', seconds: 10 })}>Advance 10s</button>
              <button type="button" onClick={() => runDevJump('offer')}>Offer</button>
              <button type="button" onClick={() => runDevJump('tiro')}>Tiro</button>
              <button type="button" onClick={() => runDevJump('hired')}>Hired</button>
              <button type="button" onClick={() => runDevJump('market')}>Market</button>
              <button type="button" onClick={() => runDevJump('spark')}>Spark</button>
              <button type="button" onClick={() => runDevJump('mercury')}>Mercury</button>
              <button type="button" onClick={() => runDevJump('second-job')}>Second job</button>
              <button type="button" onClick={() => runDevJump('frontier')}>Frontier</button>
              <button type="button" onClick={() => runDevJump('monopoly')}>Monopoly</button>
              <button type="button" onClick={() => runDevJump('spark-ultra')}>Spark Ultra</button>
              <button type="button" onClick={() => runDevJump('shorts')}>Shorts</button>
              <button type="button" onClick={() => runDevJump('energy-loss')}>Energy loss</button>
              <button type="button" onClick={() => runDevJump('won')}>Won</button>
              <button type="button" onClick={retryGame}>Reset</button>
            </div>
          </details>
        )}
      </main>

      {state.stage !== 'ready' && (
        <footer className="dock-area">
          <nav className="dock" aria-label="Desktop windows">
            {stageWindows.map((id) => {
              const item = id === 'apply'
                ? { icon: '📨', label: 'Applications' }
                : id === 'offer'
                  ? { icon: '📬', label: 'Offer' }
                  : id === 'messenger'
                    ? { icon: '💬', label: 'Messenger' }
                    : id === 'shop'
                      ? { icon: '🛍️', label: 'Shop' }
                      : id === 'mercury'
                        ? { icon: '☿', label: 'Mercury' }
                        : id === 'market'
                          ? { icon: '📈', label: 'Market' }
                          : id === 'social'
                            ? { icon: 'Z', label: 'ZZZ' }
                            : id === 'shorts'
                              ? { icon: '🎬', label: 'Shorts' }
                              : id === 'defeat'
                                ? { icon: endingIcon, label: endingTitle }
                                : id === 'spark-ultra'
                                  ? { icon: '🖥️', label: 'Mapple Spark Ultra' }
                                  : id === 'spark'
                                    ? { icon: '🖥️', label: 'Mapple Spark' }
                                    : { icon: '🖥️', label: id === 'terminal' ? 'Terminal' : 'Terminal 2' }
              const isOpen = id === 'defeat'
                ? isEnding && !defeatDismissed
                : windows[id] || (id === 'messenger' && defeatAutoFront)
              const isFrontmost = isOpen && isWindowActive(id)
              const dockAcknowledged = isFrontmost || acknowledgedDockWindows.has(id) ||
                (id === 'shop' && state.shopDiscoveries.length === 0) || (isEnding && id === 'defeat')
              return (
                <button
                  className={`dock-item dock-item-${id} ${isFrontmost ? 'dock-item-active' : ''} ${!isOpen ? 'dock-item-minimized' : ''} ${!dockAcknowledged ? 'dock-item-attention' : ''}`}
                  type="button"
                  key={id}
                  onClick={() => isFrontmost ? minimizeWindow(id) : openWindow(id)}
                  aria-label={`${isFrontmost ? 'Minimize' : isOpen ? 'Focus' : 'Open'} ${item.label} window`}
                  aria-pressed={isFrontmost}
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
  const showPaidResources = state.stage === 'hired' || ((state.stage === 'lost' || state.stage === 'won') && state.company !== null)
  const tokenDeficit = hasTokenDeficit(state)
  const previousTokenDeficitRef = useRef(tokenDeficit)
  const [tokenDeficitAnnouncement, setTokenDeficitAnnouncement] = useState('')

  useEffect(() => {
    const previousTokenDeficit = previousTokenDeficitRef.current
    previousTokenDeficitRef.current = tokenDeficit
    if (tokenDeficit && !previousTokenDeficit) {
      setTokenDeficitAnnouncement('Token balance is low or insufficient for pending work.')
    } else if (!tokenDeficit && previousTokenDeficit) {
      setTokenDeficitAnnouncement(state.stage === 'hired' ? 'Token balance restored.' : '')
    }
  }, [state.stage, tokenDeficit])

  const [soundsMuted, setSoundsMutedState] = useState(() => getSoundsMuted())

  const toggleSounds = () => {
    const nextMuted = !soundsMuted
    setSoundsMuted(nextMuted)
    setSoundsMutedState(nextMuted)
  }

  return (
    <>
      <section className={`widget-band ${showPaidResources ? 'widget-band-paid' : ''}`} aria-label="Desktop widgets">
      <div className="widget-cluster">
        <div className={`paid-resources ${showPaidResources ? 'paid-resources-visible' : ''}`} aria-hidden={!showPaidResources}>
          <div className="paid-resources-inner">
            <div className="resource-widget resource-widget-money" aria-label={`Money ${state.money} dollars`} title={state.money.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}>
              <span className="resource-widget-icon" aria-hidden="true">$</span>
              <div>
                <span className="widget-label">Money</span>
                <span className="resource-values"><ResourceCounter value={state.money} prefix="$" formatter={state.money >= 100_000 ? tokenFormatter : undefined} /></span>
              </div>
            </div>
            <div className={`resource-widget resource-widget-tokens${tokenDeficit ? ' resource-widget-token-deficit' : ''}`} aria-label={`Tokens ${state.tokens}`} aria-describedby="tokens-deficit-status">
              <span className="resource-widget-icon" aria-hidden="true">◇</span>
              <div>
                <span className="widget-label">Tokens</span>
                <span className="resource-values"><ResourceCounter value={state.tokens} formatter={tokenFormatter} /></span>
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
        <button
          className="sound-toggle"
          type="button"
          onClick={toggleSounds}
          aria-label={soundsMuted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={soundsMuted}
          title={soundsMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          <SpeakerIcon muted={soundsMuted} />
        </button>
      </div>
      </section>
      <span id="tokens-deficit-status" className="token-deficit-status" role="status" aria-live="polite" aria-atomic="true">
        {tokenDeficitAnnouncement}
      </span>
    </>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="sound-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4h4l5 4V6l-5 4H4Z" fill="currentColor" stroke="none" />
      {muted ? <><path d="m16 9 5 6" /><path d="m21 9-5 6" /></> : <><path d="M16 9.5a4.5 4.5 0 0 1 0 5" /><path d="M18.5 7a8 8 0 0 1 0 10" /></>}
    </svg>
  )
}

export default App
