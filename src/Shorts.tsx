import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, WheelEvent } from 'react'
import type { GameAction, GameState } from './game'
import { SHORTS_CATALOG, type ShortVideo } from './shortsCatalog'
import './Shorts.css'

type ShortsProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
  /** True only while the Shorts app is frontmost and visible in the desktop. */
  active: boolean
}

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

function clampIndex(index: number): number {
  return Math.max(0, Math.min(lastCatalogIndex, index))
}

function nearestCardIndex(feed: HTMLDivElement): number {
  if (feed.clientHeight <= 0) return 0
  return clampIndex(Math.round(feed.scrollTop / feed.clientHeight))
}

function VideoEmbed({ video }: { video: ShortVideo }) {
  return (
    <div className="shorts-media-frame">
      <video
        className="shorts-media"
        src={video.mediaUrl}
        aria-label={video.title}
        tabIndex={-1}
        autoPlay
        loop
        muted
        playsInline
      />
      <p className="shorts-media-note">
        Looping meme clip · <a href={video.sourceUrl} target="_blank" rel="noreferrer noopener">View on GIPHY</a>
      </p>
    </div>
  )
}

export function ShortsContent({ state, dispatch, active }: ShortsProps) {
  const [videos] = useState(shuffledVideos)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const activeIndexRef = useRef(0)
  const programmaticTargetRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const gestureTimerRef = useRef<number | null>(null)
  const programmaticResetTimerRef = useRef<number | null>(null)
  const userGestureRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  const playbackActive = active && pageVisible && state.stage === 'hired'

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    if (gestureTimerRef.current !== null) window.clearTimeout(gestureTimerRef.current)
    if (programmaticResetTimerRef.current !== null) window.clearTimeout(programmaticResetTimerRef.current)
  }, [])

  useEffect(() => {
    if (playbackActive) return
    userGestureRef.current = false
    programmaticTargetRef.current = null
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
  }, [playbackActive])

  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    const observer = new ResizeObserver(() => {
      userGestureRef.current = false
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      feed.scrollTo({ top: activeIndexRef.current * feed.clientHeight, behavior: 'instant' })
    })
    observer.observe(feed)
    return () => observer.disconnect()
  }, [])

  const clearGestureTimer = useCallback(() => {
    if (gestureTimerRef.current === null) return
    window.clearTimeout(gestureTimerRef.current)
    gestureTimerRef.current = null
  }, [])

  const markUserGesture = useCallback(() => {
    if (!playbackActive) return
    programmaticTargetRef.current = null
    if (programmaticResetTimerRef.current !== null) {
      window.clearTimeout(programmaticResetTimerRef.current)
      programmaticResetTimerRef.current = null
    }
    userGestureRef.current = true
    clearGestureTimer()
    // A touch fling can keep scrolling after touchend. This only arms the
    // settle detector; it never dispatches by itself.
    gestureTimerRef.current = window.setTimeout(() => {
      userGestureRef.current = false
      gestureTimerRef.current = null
    }, 1500)
  }, [clearGestureTimer, playbackActive])

  const announceUserNavigation = useCallback((index: number) => {
    if (!playbackActive) return
    const nextIndex = clampIndex(index)
    if (nextIndex === activeIndexRef.current) return
    activeIndexRef.current = nextIndex
    setActiveIndex(nextIndex)
    if (state.stage === 'hired') dispatch({ type: 'scroll-short' })
  }, [dispatch, state.stage, playbackActive])

  const scrollToIndex = useCallback((index: number) => {
    if (!playbackActive) return
    const feed = feedRef.current
    if (!feed) return
    const nextIndex = clampIndex(index)
    if (nextIndex === activeIndexRef.current) return
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    userGestureRef.current = false
    clearGestureTimer()
    programmaticTargetRef.current = nextIndex
    if (programmaticResetTimerRef.current !== null) window.clearTimeout(programmaticResetTimerRef.current)
    programmaticResetTimerRef.current = window.setTimeout(() => {
      programmaticTargetRef.current = null
      programmaticResetTimerRef.current = null
    }, 1200)
    announceUserNavigation(nextIndex)
    feed.scrollTo({
      top: nextIndex * feed.clientHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [playbackActive, announceUserNavigation, clearGestureTimer])

  const settleUserScroll = useCallback(() => {
    settleTimerRef.current = null
    if (!userGestureRef.current || programmaticTargetRef.current !== null) return
    const feed = feedRef.current
    if (!feed) return
    userGestureRef.current = false
    clearGestureTimer()
    announceUserNavigation(nearestCardIndex(feed))
  }, [announceUserNavigation, clearGestureTimer])

  const handleScroll = useCallback(() => {
    if (programmaticTargetRef.current !== null || !userGestureRef.current) return
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(settleUserScroll, 100)
  }, [settleUserScroll])

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!playbackActive || Math.abs(event.deltaY) < 1) return
    markUserGesture()
    if (activeIndexRef.current === lastCatalogIndex && event.deltaY > 0) {
      scrollToIndex(0)
      return
    }
    if (activeIndexRef.current === 0 && event.deltaY < 0) {
      scrollToIndex(lastCatalogIndex)
    }
  }, [markUserGesture, playbackActive, scrollToIndex])

  const handlePointerDown = useCallback(() => {
    markUserGesture()
  }, [markUserGesture])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || !navigationKeys[event.key]) return
    const current = activeIndexRef.current
    let target: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === 'j') target = current + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'k') target = current - 1
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = lastCatalogIndex
    if (target === null) return
    if (target > lastCatalogIndex) target = 0
    if (target < 0) target = lastCatalogIndex
    if (target === current) return
    event.preventDefault()
    scrollToIndex(target)
  }, [scrollToIndex])


  return (
    <section className="shorts-content" aria-label="Shorts" data-playback-active={playbackActive ? 'true' : 'false'}>
      <header className="shorts-header">
        <div>
          <p className="shorts-eyebrow">Shorts / human reset</p>
          <h2>One more clip</h2>
        </div>
        <span className="shorts-count" aria-label={`Short ${activeIndex + 1} of ${SHORTS_CATALOG.length}`}>
          {activeIndex + 1} / {SHORTS_CATALOG.length}
        </span>
      </header>
      <p className="shorts-status" role="status" aria-live="polite">
        {!pageVisible ? 'Playback paused while this window is hidden.' : state.stage !== 'hired' ? 'Run ended · Shorts is read-only.' : !active ? 'Playback paused while Shorts is in the background.' : 'Scroll to a new clip: +1 energy and reset the 3-second inactivity timer.'}
      </p>
      <div
        ref={feedRef}
        className="shorts-feed"
        role="feed"
        aria-label="Short videos"
        tabIndex={0}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onTouchMove={markUserGesture}
        onTouchEnd={markUserGesture}
        onKeyDown={handleKeyDown}
      >
        {videos.map((video, index) => {
          const isCurrent = index === activeIndex
          return (
            <article
              className={`shorts-card${isCurrent ? ' is-current' : ''}`}
              key={video.id}
              aria-label={`${video.title}, ${video.creator}`}
              aria-current={isCurrent ? 'true' : undefined}
              tabIndex={-1}
            >
              <div className="shorts-card-topline">
                <span className="shorts-card-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="shorts-card-source">{video.creator}</span>
              </div>
              {isCurrent && playbackActive ? <VideoEmbed video={video} /> : <div className="shorts-media-frame shorts-media-unloaded" aria-label="Video unloaded until this short is active"><span>Scroll here to load this clip</span></div>}
              <div className="shorts-card-copy">
                <h3>{video.title}</h3>
                <p>{video.description}</p>
                <a className="shorts-source-link" href={video.sourceUrl} target="_blank" rel="noreferrer noopener">Open original source</a>
              </div>
            </article>
          )
        })}
      </div>
      <nav className="shorts-controls" aria-label="Short navigation">
        <button type="button" onClick={() => scrollToIndex((activeIndex + videos.length - 1) % videos.length)} disabled={!playbackActive} aria-label="Previous short">↑ <span>Previous</span></button>
        <button type="button" onClick={() => scrollToIndex((activeIndex + 1) % videos.length)} disabled={!playbackActive} aria-label="Next short"><span>Next</span> ↓</button>
      </nav>
    </section>
  )
}
