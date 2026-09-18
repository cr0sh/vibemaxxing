import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const slotOffsets = [-2, -1, 0, 1, 2] as const
const centerSlot = 2
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

function positiveModulo(value: number, length: number): number {
  return ((value % length) + length) % length
}

function nearestSlot(feed: HTMLDivElement): number {
  if (feed.clientHeight <= 0) return centerSlot
  return Math.max(0, Math.min(lastSlot, Math.round(feed.scrollTop / feed.clientHeight)))
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
  const virtualPositionRef = useRef(0)
  const [virtualPosition, setVirtualPosition] = useState(0)
  const [viewingCount, setViewingCount] = useState(1)
  const pendingRecenterRef = useRef(false)
  const userGestureRef = useRef(false)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  const playbackActive = active && pageVisible && state.stage === 'hired'

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const recenterFeed = useCallback(() => {
    const feed = feedRef.current
    if (!feed || feed.clientHeight <= 0) return false
    // Direct assignment deliberately bypasses scroll-behavior and cannot look like
    // another user navigation. The card at the center slot is unchanged visually.
    feed.scrollTop = centerSlot * feed.clientHeight
    return true
  }, [])

  useLayoutEffect(() => {
    if (!pendingRecenterRef.current) return
    if (recenterFeed()) pendingRecenterRef.current = false
  }, [recenterFeed, virtualPosition])

  useLayoutEffect(() => {
    recenterFeed()
  }, [recenterFeed])

  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    const observer = new ResizeObserver(() => {
      // A resize can change card height while a touch or snap is in flight. Keep
      // the current logical clip and center its bounded window without rewarding it.
      userGestureRef.current = false
      pendingRecenterRef.current = false
      recenterFeed()
    })
    observer.observe(feed)
    return () => observer.disconnect()
  }, [recenterFeed])

  useEffect(() => {
    if (playbackActive) return
    userGestureRef.current = false
    pendingRecenterRef.current = false
    recenterFeed()
  }, [playbackActive, recenterFeed])

  const announceTransition = useCallback((delta: number) => {
    if (!playbackActive || delta === 0) return
    const nextPosition = virtualPositionRef.current + delta
    const transitionCount = Math.abs(delta)
    virtualPositionRef.current = nextPosition
    pendingRecenterRef.current = true
    setVirtualPosition(nextPosition)
    setViewingCount((count) => count + transitionCount)
    for (let transition = 0; transition < transitionCount; transition += 1) {
      dispatch({ type: 'scroll-short' })
    }
  }, [dispatch, playbackActive])

  const markUserGesture = useCallback(() => {
    if (!playbackActive) return
    userGestureRef.current = true
  }, [playbackActive])

  const handleScroll = useCallback(() => {
    const feed = feedRef.current
    if (!feed || !playbackActive || pendingRecenterRef.current) return
    const slot = nearestSlot(feed)
    if (slot === centerSlot || !userGestureRef.current) return

    userGestureRef.current = false
    announceTransition(slot - centerSlot)
  }, [announceTransition, playbackActive])

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
    <section className="shorts-content" aria-label="Shorts" data-playback-active={playbackActive ? 'true' : 'false'}>
      <header className="shorts-header">
        <div>
          <p className="shorts-eyebrow">Shorts / human reset</p>
          <h2>One more clip</h2>
        </div>
        <span className="shorts-count" aria-label={`Clip ${viewingCount}`}>{viewingCount}</span>
      </header>
      <p className="shorts-status" role="status" aria-live="polite">
        {!pageVisible ? 'Playback paused while this window is hidden.' : state.stage !== 'hired' ? 'Run ended · Shorts is read-only.' : !active ? 'Playback paused while Shorts is in the background.' : 'Doomscrolling gives you energy, right?'}
      </p>
      <div
        ref={feedRef}
        className="shorts-feed"
        role="feed"
        aria-label="Short videos"
        tabIndex={0}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onPointerDown={markUserGesture}
        onTouchMove={markUserGesture}
        onTouchEnd={markUserGesture}
        onKeyDown={handleKeyDown}
      >
        {slotOffsets.map((offset, slot) => {
          const position = virtualPosition + offset
          const index = positiveModulo(position, videos.length)
          const video = videos[index]!
          const isCurrent = slot === centerSlot
          return (
            <article
              className={`shorts-card${isCurrent ? ' is-current' : ''}`}
              key={`short-slot-${slot}`}
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
        <button type="button" onClick={() => navigateBy(-1)} disabled={!playbackActive} aria-label="Previous short">↑ <span>Previous</span></button>
        <button type="button" onClick={() => navigateBy(1)} disabled={!playbackActive} aria-label="Next short"><span>Next</span> ↓</button>
      </nav>
    </section>
  )
}
