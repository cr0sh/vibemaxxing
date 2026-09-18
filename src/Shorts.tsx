import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, WheelEvent } from 'react'
import type { GameAction, GameState } from './game'
import { SHORTS_CATALOG, type ShortVideo } from './shortsCatalog'
import { useI18n } from './i18n'
import './Shorts.css'

type ShortsProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  /** True only while the Shorts app is frontmost and visible in the desktop. */
  active: boolean
}

// Three cards are enough to show the current clip and preload both directions.
// With four catalog entries, each of these three cards has a unique clip key.
const slotOffsets = [-1, 0, 1] as const
const centerSlot = 1
const lastSlot = slotOffsets.length - 1
const lastCatalogIndex = SHORTS_CATALOG.length - 1

function shuffledVideos(): ShortVideo[] {
  const videos = [...SHORTS_CATALOG]
  for (let index = videos.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    const previous = videos[index]!
    videos[index] = videos[other]!
    videos[other] = previous
  }
  return videos
}

const navigationKeys: Record<string, true> = {
  ArrowDown: true,
  ArrowRight: true,
  PageDown: true,
  j: true,
  ArrowUp: true,
  ArrowLeft: true,
  PageUp: true,
  k: true,
  Home: true,
  End: true,
}

type MediaStatus = 'loading' | 'ready' | 'error'

function positiveModulo(value: number, length: number): number {
  return ((value % length) + length) % length
}

function nearestSlot(feed: HTMLDivElement): number {
  if (feed.clientHeight <= 0) return centerSlot
  return Math.max(0, Math.min(lastSlot, Math.round(feed.scrollTop / feed.clientHeight)))
}

type VideoEmbedProps = {
  video: ShortVideo
  playbackActive: boolean
  isCurrent: boolean
  status: MediaStatus
  registerMedia: (id: string, media: HTMLVideoElement | null) => void
  setStatus: (id: string, status: MediaStatus) => void
}

function VideoEmbed({
  video,
  playbackActive,
  isCurrent,
  status,
  registerMedia,
  setStatus,
}: VideoEmbedProps) {
  const { t } = useI18n()
  const handleMediaRef = useCallback((media: HTMLVideoElement | null) => {
    registerMedia(video.id, media)
  }, [registerMedia, video.id])

  return (
    <div className="shorts-media-frame" data-media-state={status} aria-busy={status === 'loading'}>
      <video
        ref={handleMediaRef}
        className="shorts-media"
        src={video.mediaUrl}
        aria-label={t(video.titleKey)}
        tabIndex={-1}
        autoPlay={playbackActive && isCurrent}
        preload="auto"
        loop
        muted
        playsInline
        onLoadStart={() => setStatus(video.id, 'loading')}
        onLoadedData={() => setStatus(video.id, 'ready')}
        onCanPlay={() => setStatus(video.id, 'ready')}
        onError={() => setStatus(video.id, 'error')}
      />
      {status === 'loading' && (
        <p className="shorts-media-status" role="status">
          {t('shorts.loading')}
        </p>
      )}
      {status === 'error' && (
        <p className="shorts-media-status shorts-media-error" role="alert">
          {t('shorts.playbackError')} <a href={video.sourceUrl} target="_blank" rel="noreferrer noopener">{t('shorts.openSource')}</a>
        </p>
      )}
      <p className="shorts-media-note">
        {t('shorts.loop')} · <a href={video.sourceUrl} target="_blank" rel="noreferrer noopener">{t('shorts.viewGiphy')}</a>
      </p>
    </div>
  )
}

export function ShortsContent({ state, dispatch, active }: ShortsProps) {
  const { t, formatNumber } = useI18n()
  const [videos] = useState(shuffledVideos)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const mediaRefs = useRef(new Map<string, HTMLVideoElement>())
  const virtualPositionRef = useRef(0)
  const [virtualPosition, setVirtualPosition] = useState(0)
  const [viewingCount, setViewingCount] = useState(1)
  const [mediaStatuses, setMediaStatuses] = useState<Record<string, MediaStatus>>({})
  const userGestureRef = useRef(false)
  const programmaticScrollRef = useRef(false)
  const recenterSequenceRef = useRef(0)
  const scrollSettleTimerRef = useRef(0)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  const playbackActive = active && pageVisible && state.stage === 'hired'
  const currentVideo = videos[positiveModulo(virtualPosition, videos.length)]!

  const setMediaStatus = useCallback((id: string, status: MediaStatus) => {
    setMediaStatuses((previous) => previous[id] === status ? previous : { ...previous, [id]: status })
  }, [])

  const registerMedia = useCallback((id: string, media: HTMLVideoElement | null) => {
    if (media === null) {
      mediaRefs.current.delete(id)
    } else {
      mediaRefs.current.set(id, media)
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const recenterFeed = useCallback(() => {
    const feed = feedRef.current
    if (!feed || feed.clientHeight <= 0) return false
    if (scrollSettleTimerRef.current !== 0) {
      window.clearTimeout(scrollSettleTimerRef.current)
      scrollSettleTimerRef.current = 0
    }
    userGestureRef.current = false
    const target = centerSlot * feed.clientHeight
    const sequence = recenterSequenceRef.current + 1
    recenterSequenceRef.current = sequence
    programmaticScrollRef.current = true
    // Assigning scrollTop avoids CSS smooth scrolling and is synchronous. Keep
    // the guard for two frames so a native momentum event cannot be rewarded.
    feed.scrollTop = target
    const release = () => {
      if (recenterSequenceRef.current !== sequence || feedRef.current !== feed) return
      feed.scrollTop = target
      programmaticScrollRef.current = false
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(release))
    return true
  }, [])

  useLayoutEffect(() => {
    recenterFeed()
  }, [recenterFeed])

  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    const observer = new ResizeObserver(() => {
      // A resize can change card height while a touch or snap is in flight.
      // Preserve the logical clip, center the bounded window, and never
      // dispatch a gameplay action for this programmatic correction.
      recenterFeed()
    })
    observer.observe(feed)
    return () => observer.disconnect()
  }, [recenterFeed])

  useEffect(() => {
    if (playbackActive) return
    recenterFeed()
  }, [playbackActive, recenterFeed])

  useEffect(() => {
    let cancelled = false
    for (const [id, media] of mediaRefs.current) {
      if (playbackActive && id === currentVideo.id) {
        void media.play().catch((error: unknown) => {
          if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
            setMediaStatus(id, 'error')
          }
        })
      } else {
        media.pause()
      }
    }
    return () => { cancelled = true }
  }, [currentVideo.id, playbackActive, setMediaStatus])

  useEffect(() => {
    return () => {
      window.clearTimeout(scrollSettleTimerRef.current)
      scrollSettleTimerRef.current = 0
    }
  }, [])

  const announceTransition = useCallback((delta: number) => {
    if (!playbackActive || delta === 0) return
    const nextPosition = positiveModulo(virtualPositionRef.current + delta, videos.length)
    virtualPositionRef.current = nextPosition
    userGestureRef.current = false
    setVirtualPosition(nextPosition)
    setViewingCount((count) => count + 1)
    dispatch({ type: 'scroll-short' })
    recenterFeed()
  }, [dispatch, playbackActive, recenterFeed, videos.length])

  const scheduleNativeTransition = useCallback(() => {
    window.clearTimeout(scrollSettleTimerRef.current)
    scrollSettleTimerRef.current = window.setTimeout(() => {
      scrollSettleTimerRef.current = 0
      const feed = feedRef.current
      if (!feed || !playbackActive || programmaticScrollRef.current || !userGestureRef.current) return
      const slot = nearestSlot(feed)
      const target = slot * feed.clientHeight
      if (slot === centerSlot) return
      if (Math.abs(feed.scrollTop - target) > 3) {
        scheduleNativeTransition()
        return
      }
      const delta = slot - centerSlot
      userGestureRef.current = false
      announceTransition(delta)
    }, 90)
  }, [announceTransition, playbackActive])

  const markUserGesture = useCallback(() => {
    if (!playbackActive || programmaticScrollRef.current) return
    userGestureRef.current = true
  }, [playbackActive])

  const handleScroll = useCallback(() => {
    const feed = feedRef.current
    if (!feed || !playbackActive || programmaticScrollRef.current || !userGestureRef.current) return
    scheduleNativeTransition()
  }, [playbackActive, scheduleNativeTransition])

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!playbackActive || Math.abs(event.deltaY) < 1) return
    markUserGesture()
  }, [markUserGesture, playbackActive])

  const navigateBy = useCallback((delta: number) => {
    if (!playbackActive || delta === 0) return
    userGestureRef.current = false
    announceTransition(delta)
  }, [announceTransition, playbackActive])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || !navigationKeys[event.key]) return
    const currentIndex = positiveModulo(virtualPositionRef.current, videos.length)
    let delta: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === 'j') delta = 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'k') delta = -1
    else if (event.key === 'Home') delta = -currentIndex
    else if (event.key === 'End') delta = lastCatalogIndex - currentIndex
    if (delta === null || delta === 0) return
    event.preventDefault()
    navigateBy(delta)
  }, [navigateBy, videos.length])
  return (
    <section className="shorts-content" aria-label={t('shorts.aria')} data-playback-active={playbackActive ? 'true' : 'false'}>
      <header className="shorts-header">
        <div>
          <p className="shorts-eyebrow">{t('shorts.eyebrow')}</p>
          <h2>{t('shorts.title')}</h2>
        </div>
        <span className="shorts-count" aria-label={t('shorts.clip', { count: formatNumber(viewingCount) })}>{formatNumber(viewingCount)}</span>
      </header>
      <p className="shorts-status" role="status" aria-live="polite">
        {!pageVisible
          ? t('shorts.status.hidden')
          : state.stage !== 'hired'
            ? t('shorts.status.ended')
            : !active
              ? t('shorts.status.background')
              : t('shorts.status.active')}
      </p>
      <div
        ref={feedRef}
        className="shorts-feed"
        role="feed"
        aria-label={t('shorts.feed')}
        tabIndex={0}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onPointerDown={markUserGesture}
        onTouchStart={markUserGesture}
        onTouchMove={markUserGesture}
        onTouchEnd={markUserGesture}
        onKeyDown={handleKeyDown}
      >
        {slotOffsets.map((offset, slot) => {
          const position = virtualPosition + offset
          const index = positiveModulo(position, videos.length)
          const video = videos[index]!
          const isCurrent = slot === centerSlot
          const status = mediaStatuses[video.id] ?? 'loading'
          return (
            <article
              className={`shorts-card${isCurrent ? ' is-current' : ''}`}
              key={video.id}
              aria-label={`${t(video.titleKey)}, ${video.creator}`}
              aria-current={isCurrent ? 'true' : undefined}
              tabIndex={-1}
            >
              <div className="shorts-card-topline">
                <span className="shorts-card-source">{video.creator}</span>
              </div>
              <VideoEmbed
                video={video}
                playbackActive={playbackActive}
                isCurrent={isCurrent}
                status={status}
                registerMedia={registerMedia}
                setStatus={setMediaStatus}
              />
              <div className="shorts-card-copy">
                <h3>{t(video.titleKey)}</h3>
                <p>{t(video.descriptionKey)}</p>
                <a className="shorts-source-link" href={video.sourceUrl} target="_blank" rel="noreferrer noopener">{t('shorts.openSource')}</a>
              </div>
            </article>
          )
        })}
      </div>
      <nav className="shorts-controls" aria-label={t('shorts.navigation')}>
        <button type="button" onClick={() => navigateBy(-1)} disabled={!playbackActive} aria-label={t('shorts.previous')}>↑ <span>{t('shorts.previous')}</span></button>
        <button type="button" onClick={() => navigateBy(1)} disabled={!playbackActive} aria-label={t('shorts.next')}><span>{t('shorts.next')}</span> ↓</button>
      </nav>
    </section>
  )
}
