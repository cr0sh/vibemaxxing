import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent } from 'react'
import {
  completedTaskCount,
  companies,
  gameNetWorth,
  gameReducer,
  initialGame,
  isLocalTerminal,
  tokenPriceMultiplier,
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
import { LanguagePicker, useI18n, type MessageKey } from './i18n'
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
  const { t, formatCurrency, formatNumber } = useI18n()
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

  const continueAfterWin = () => {
    dispatch({ type: 'continue-after-win' })
    openWindow('terminal')
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
    const sample: Application = { name: picked.sample.name, email: picked.sample.email, pitch: t(picked.sample.pitchKey) }
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
  const applicationTitle = t(secondApplicationAvailable ? 'app.secondJobApplication' : 'app.jobApplication')
  const offerCompany = secondOfferAvailable ? state.secondJobOffer : currentCompany
  const endingIsVictory = state.stage === 'won'
  const endingIsEnergyLoss = state.lossReason === 'energy'
  const endingTitle = t(endingIsVictory ? 'ending.victory.title' : endingIsEnergyLoss ? 'ending.energy.title' : 'ending.fired.title')
  const endingHeading = t(endingIsVictory ? 'ending.victory.heading' : endingIsEnergyLoss ? 'ending.energy.heading' : 'ending.fired.heading')
  const endingBody = endingIsVictory
    ? t('ending.victory.body', { worth: formatCurrency(gameNetWorth(state)), target: formatCurrency(WIN_NET_WORTH) })
    : endingIsEnergyLoss
      ? t('ending.energy.body')
      : state.failure ? t(state.failure) : t('ending.fired.body')
  const endingIcon = endingIsVictory ? '🏆' : endingIsEnergyLoss ? '🫥' : '⚠️'

  return (
    <>
      <main className="desktop-area">
        <div className="desktop-orbit desktop-orbit-one" aria-hidden="true" />
        <div className="desktop-orbit desktop-orbit-two" aria-hidden="true" />
        <div className="desktop-grid" aria-hidden="true" />

        {state.stage === 'ready' ? (
          <section className="ready-screen" aria-label={t('app.startGame')}>
            <button className="new-game-button ready-start" type="button" onClick={beginGame}>{t('app.startGame')}</button>
          </section>
        ) : (
          <div className="workspace-area">
            <WindowWorkspace className={`windows-${state.stage}`} focusRequest={focusRequest}>
              {showApplication && (
                <WindowFrame
                  id="apply"
                  icon="📨"
                  title={t('app.applications')}
                  active={isWindowActive('apply')}
                  className="application-window"
                  hidden={!windows.apply}
                  onFocus={() => focusWindow('apply')}
                  onMinimize={() => minimizeWindow('apply')}
                >
                  <div className="window-heading-row">
                    <div><h2>{applicationTitle}</h2></div>
                    <div className="submission-stamp" aria-label={t('app.submissionCount', { count: formatNumber(applicationCount) })}>
                      <strong>{formatNumber(applicationCount, { minimumIntegerDigits: 2, useGrouping: false })}</strong>
                      <span>{t('app.sent')}</span>
                    </div>
                  </div>
                  <form className="application-form" onSubmit={submitApplication}>
                    <div className="field-grid">
                      <label className="field-label">
                        <span>{t('app.field.name')}</span>
                        <input name="name" value={application.name} onChange={updateApplication} required autoComplete="name" placeholder={t('app.field.name')} />
                      </label>
                      <label className="field-label">
                        <span>{t('app.field.email')}</span>
                        <input name="email" type="email" value={application.email} onChange={updateApplication} required autoComplete="email" placeholder="you@example.com" />
                      </label>
                    </div>
                    <label className="field-label">
                      <span>{t('app.field.pitch')}</span>
                      <textarea name="pitch" value={application.pitch} onChange={updateApplication} required rows={4} placeholder={t('app.field.pitchPlaceholder')} />
                    </label>
                    <div className="form-actions">
                      <button className="primary-button" type="submit" disabled={state.energy < 3 || isAutofilling}>
                        {t('app.submitApplication')} <span aria-hidden="true">↗</span>
                      </button>
                      {(secondApplicationAvailable || state.submissions >= 3) && (
                        <button className="secondary-button" type="button" onClick={fillSample} disabled={isAutofilling}>
                          <span aria-hidden="true">✦</span> {t('app.autoFill')}
                        </button>
                      )}
                    </div>
                  </form>
                  {state.lastResult === 'rejected' && (
                    <p className="feedback feedback-rejected" role="status" aria-live="polite" key={`${state.submissions}-${state.secondJobApplications}`}>
                      <span aria-hidden="true">⊘</span> {t('app.applicationRejected')}
                    </p>
                  )}
                </WindowFrame>
              )}

              {showOffer && (
                <WindowFrame
                  id="offer"
                  icon="📬"
                  title={t(secondOfferAvailable ? 'app.secondJobOffer' : 'app.incomingOffer')}
                  active={isWindowActive('offer')}
                  className="offer-window"
                  hidden={!windows.offer}
                  onFocus={() => focusWindow('offer')}
                  onMinimize={() => minimizeWindow('offer')}
                >
                  <div className="offer-hero">
                    <span className="offer-spark" aria-hidden="true">✦</span>
                    <div><h2>{t(secondOfferAvailable ? 'app.secondJobOffer' : 'app.offerReceived')}</h2></div>
                  </div>
                  <div className="company-card">
                    <div className="company-icon" aria-hidden="true">🏢</div>
                    <div>
                      <p className="company-label">{t('app.company')}</p>
                      <h3>{offerCompany}</h3>
                      <p>{t('app.offerRole')}</p>
                    </div>
                  </div>
                  <button className="primary-button offer-accept" type="button" onClick={() => dispatch(secondOfferAvailable ? { type: 'accept-second-job' } : { type: 'accept' })}>
                    {t(secondOfferAvailable ? 'app.acceptSecondJob' : 'app.acceptOffer')} <span aria-hidden="true">→</span>
                  </button>
                </WindowFrame>
              )}

              {hasEmployment && (
                <>
                  <WindowFrame
                    id="messenger"
                    icon="💬"
                    title={t('app.messenger')}
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
                          : terminal.id === 'terminal' ? t('app.terminal') : t('app.terminalNumber', { number: 2 })
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
                    title={t('app.shop')}
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
                      title={t('app.market')}
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
                    <button className="primary-button" type="button" onClick={endingIsVictory ? continueAfterWin : retryGame}>
                      {t(endingIsVictory ? 'ending.keepPlaying' : 'ending.tryAgain')}
                    </button>
                  </div>
                </WindowFrame>
              )}
            </WindowWorkspace>
          </div>
        )}

        {import.meta.env.DEV && state.stage !== 'ready' && (
          <details className="dev-tools">
            <summary>{t('app.dev')}</summary>
            <div className="dev-controls">
              <button type="button" aria-pressed={isDevPaused} onClick={() => onDevPauseChange(!isDevPaused)}>
                {t(isDevPaused ? 'app.resumeTimer' : 'app.pauseTimer')}
              </button>
              <button type="button" onClick={() => dispatch({ type: 'tick', seconds: 10 })}>{t('app.advanceTen')}</button>
              <button type="button" onClick={() => runDevJump('offer')}>{t('app.offer')}</button>
              <button type="button" onClick={() => runDevJump('tiro')}>Tiro</button>
              <button type="button" onClick={() => runDevJump('hired')}>{t('app.dev.hired')}</button>
              <button type="button" onClick={() => runDevJump('market')}>{t('app.market')}</button>
              <button type="button" onClick={() => runDevJump('spark')}>Spark</button>
              <button type="button" onClick={() => runDevJump('mercury')}>Mercury</button>
              <button type="button" onClick={() => runDevJump('second-job')}>{t('app.dev.secondJob')}</button>
              <button type="button" onClick={() => runDevJump('frontier')}>{t('app.dev.frontier')}</button>
              <button type="button" onClick={() => runDevJump('monopoly')}>{t('app.dev.monopoly')}</button>
              <button type="button" onClick={() => runDevJump('spark-ultra')}>Spark Ultra</button>
              <button type="button" onClick={() => runDevJump('shorts')}>Shorts</button>
              <button type="button" onClick={() => runDevJump('energy-loss')}>{t('app.dev.energyLoss')}</button>
              <button type="button" onClick={() => runDevJump('won')}>{t('app.dev.won')}</button>
              <button type="button" onClick={retryGame}>{t('app.dev.reset')}</button>
            </div>
          </details>
        )}
      </main>

      {state.stage !== 'ready' && (
        <footer className="dock-area">
          <nav className="dock" aria-label={t('app.desktopWindows')}>
            {stageWindows.map((id) => {
              const item = id === 'apply'
                ? { icon: '📨', label: t('app.applications') }
                : id === 'offer'
                  ? { icon: '📬', label: t('app.offer') }
                  : id === 'messenger'
                    ? { icon: '💬', label: t('app.messenger') }
                    : id === 'shop'
                      ? { icon: '🛍️', label: t('app.shop') }
                      : id === 'mercury'
                        ? { icon: '☿', label: 'Mercury' }
                        : id === 'market'
                          ? { icon: '📈', label: t('app.market') }
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
                                    : { icon: '🖥️', label: id === 'terminal' ? t('app.terminal') : t('app.terminalNumber', { number: 2 }) }
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
                  aria-label={t(isFrontmost ? 'window.aria.minimize' : isOpen ? 'app.dock.focus' : 'app.dock.open', { title: item.label })}
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
  const { locale, t, formatCurrency, formatNumber } = useI18n()
  const dateFormatters = useMemo(() => ({
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    date: new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    month: new Intl.DateTimeFormat(locale, { month: 'short' }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
  }), [locale])
  const tokenFormatter = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }), [locale])
  const compactMoney = state.money >= 100_000
  const moneyFormatter = useMemo(() => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'USD', notation: compactMoney ? 'compact' : 'standard', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }), [locale, compactMoney])
  const timeLabel = dateFormatters.time.format(now)
  const dateLabel = dateFormatters.date.format(now)
  const monthLabel = dateFormatters.month.format(now).toLocaleUpperCase(locale)
  const weekdayLabel = dateFormatters.weekday.format(now).toLocaleUpperCase(locale)
  const showPaidResources = state.stage === 'hired' || ((state.stage === 'lost' || state.stage === 'won') && state.company !== null)
  const tokenDeficit = hasTokenDeficit(state)
  const previousTokenDeficitRef = useRef(tokenDeficit)
  const [tokenDeficitAnnouncement, setTokenDeficitAnnouncement] = useState<MessageKey | null>(null)

  useEffect(() => {
    const previousTokenDeficit = previousTokenDeficitRef.current
    previousTokenDeficitRef.current = tokenDeficit
    if (tokenDeficit && !previousTokenDeficit) {
      setTokenDeficitAnnouncement('app.tokenLow')
    } else if (!tokenDeficit && previousTokenDeficit) {
      setTokenDeficitAnnouncement(state.stage === 'hired' ? 'app.tokenRestored' : null)
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
      <section className={`widget-band ${showPaidResources ? 'widget-band-paid' : ''}`} aria-label={t('app.widgets')}>
      <div className="widget-cluster">
        <div className={`paid-resources ${showPaidResources ? 'paid-resources-visible' : ''}`} aria-hidden={!showPaidResources}>
          <div className="paid-resources-inner">
            <div className="resource-widget resource-widget-money" aria-label={t('app.moneyAria', { amount: formatNumber(state.money) })} title={formatCurrency(state.money)}>
              <span className="resource-widget-icon" aria-hidden="true">$</span>
              <div>
                <span className="widget-label">{t(state.wonAt !== null ? 'app.moneyWon' : 'app.money')}</span>
                <span className="resource-values"><ResourceCounter value={state.money} formatter={moneyFormatter} /></span>
              </div>
            </div>
            <div className={`resource-widget resource-widget-tokens${tokenDeficit ? ' resource-widget-token-deficit' : ''}`} aria-label={t('app.tokenAria', { amount: formatNumber(state.tokens) })} aria-describedby="tokens-deficit-status">
              <span className="resource-widget-icon" aria-hidden="true">◇</span>
              <div>
                <span className="widget-label">{t('app.tokens')}</span>
                <span className="resource-values"><ResourceCounter value={state.tokens} formatter={tokenFormatter} /></span>
              </div>
            </div>
          </div>
        </div>
        {showPaidResources && state.monopolyAnnouncedAt !== null && (
          <div className="resource-widget token-price-widget" title={t('app.tokenPriceTitle')}>
            <strong>{t('app.tokenPrice', { multiplier: formatNumber(tokenPriceMultiplier(state), { notation: 'compact', maximumFractionDigits: 2 }) })}</strong>
          </div>
        )}
        <div className="resource-widget resource-widget-energy" aria-label={t('app.energyAria', { amount: formatNumber(state.energy) })}>
          <span className="resource-widget-icon" aria-hidden="true">⚡</span>
          <div>
            <span className="widget-label">{t('app.energy')}</span>
            <span className="resource-values"><ResourceCounter value={state.energy} /></span>
          </div>
        </div>
        <time className="clock-widget" dateTime={now.toISOString()} aria-label={t('app.localTime', { time: timeLabel })}>
          <span className="clock-icon" aria-hidden="true">◷</span>
          <span>{timeLabel}</span>
        </time>
        <time className="date-widget" dateTime={now.toISOString()} aria-label={dateLabel}>
          <span className="calendar-month">{monthLabel}</span>
          <strong>{formatNumber(now.getDate())}</strong>
          <span className="calendar-weekday">{weekdayLabel}</span>
        </time>
        <button
          className="sound-toggle"
          type="button"
          onClick={toggleSounds}
          aria-label={t(soundsMuted ? 'app.unmuteSounds' : 'app.muteSounds')}
          aria-pressed={soundsMuted}
          title={t(soundsMuted ? 'app.unmuteSounds' : 'app.muteSounds')}
        >
          <SpeakerIcon muted={soundsMuted} />
        </button>
      </div>
      <LanguagePicker />
      </section>
      <span id="tokens-deficit-status" className="token-deficit-status" role="status" aria-live="polite" aria-atomic="true">
        {tokenDeficitAnnouncement === null ? '' : t(tokenDeficitAnnouncement)}
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
