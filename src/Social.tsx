import { useRef } from 'react'
import type { Dispatch } from 'react'
import {
  type GameAction,
  type GameState,
  type SocialPost,
} from './game'
import { UnreadIndicator } from './UnreadIndicator'
import { useUnreadMessages } from './useUnreadMessages'
import './Social.css'

type SocialProps = {
  state: GameState
  dispatch: Dispatch<GameAction>
}

const elapsedLabel = (elapsed: number): string => {
  const safeElapsed = Math.max(0, Math.floor(elapsed))
  const minutes = Math.floor(safeElapsed / 60)
  const seconds = safeElapsed % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const postHeading = (post: SocialPost): string => {
  switch (post.type) {
    case 'campaign': return 'Your usage reset is here'
    case 'lottery': return 'The Tiro Token Lottery'
    case 'reset': return 'A token miracle'
    case 'model': return 'Tiro Reason is online'
    case 'fast-mode': return 'Fast mode unlocked'
  }
}

const postKicker = (post: SocialPost): string => {
  switch (post.type) {
    case 'campaign': return 'TIRO / ZZZ'
    case 'lottery': return 'TIRO COMMUNITY'
    case 'reset': return 'TIRO SYSTEMS'
    case 'model': return 'TIRO LABS'
    case 'fast-mode': return 'TIRO LABS'
  }
}

function TiroAvatar({ variant = 'default' }: { variant?: 'default' | 'spark' | 'win' }) {
  return (
    <span className={`social-avatar social-avatar-${variant}`} aria-hidden="true">
      <span>t</span>
    </span>
  )
}

function PostBody({ post, state, dispatch }: { post: SocialPost; state: GameState; dispatch: Dispatch<GameAction> }) {
  const isLost = state.stage === 'lost'
  const hasClaimedReset = state.resetClaimed

  if (post.type === 'campaign') {
    return (
      <>
        <p className="social-post-copy">
          Tiro here. Running low? Claim a free, one-time reset to the full 10M token balance.
          Keep an eye on this feed — there may be another reset in your future.
        </p>
        <p className="social-post-caption">A tiny social network for a very serious workplace.</p>
        <button
          className="social-action social-claim-button"
          type="button"
          disabled={isLost || hasClaimedReset}
          onClick={() => dispatch({ type: 'claim-token-reset' })}
        >
          {hasClaimedReset ? '10M token reset claimed' : 'Claim your 10M token reset'}
        </button>
        {hasClaimedReset && <p className="social-action-note">Claim recorded. The reset is yours once per run.</p>}
      </>
    )
  }

  if (post.type === 'lottery') {
    return (
      <>
        <p className="social-post-copy">
          Heart this post for a chance at a full token reset. Every heart is one draw, and every draw
          has an explicit <strong>1% chance</strong> to refill the token balance.
        </p>
        <p className="social-post-caption">No cooldown. No hidden catch. Please heart responsibly.</p>
        <div className="social-lottery-actions">
          <button
            className="social-heart-button"
            type="button"
            disabled={isLost}
            onClick={() => dispatch({ type: 'like-reset' })}
            aria-label={`Heart the token lottery post. ${post.likes.toLocaleString()} hearts so far.`}
          >
            <span aria-hidden="true">♥</span>
            <span>Heart</span>
          </button>
          <span className="social-like-count" aria-live="polite">{post.likes.toLocaleString()} hearts</span>
        </div>
        {isLost && <p className="social-action-note">The feed is archived after the run ends.</p>}
      </>
    )
  }

  if (post.type === 'reset') {
    return (
      <>
        <p className="social-post-copy social-success-copy">
          Your token inventory is back at 10M. Time to ship something ambitious.
        </p>
        <p className="social-post-caption">Keep shipping. Keep hearting.</p>
      </>
    )
  }

  if (post.type === 'model') {
    return (
      <>
        <p className="social-post-copy">
          Tiro Reason is more reliable, but runs 40% slower than Basic.
          Your workspace has been upgraded automatically. All new attempts use Tiro Reason.
        </p>
        <p className="social-post-caption">More thought. Fewer retries.</p>
      </>
    )
  }

  return (
    <>
      <p className="social-post-copy">
        Fast mode is unlocked. A terminal set to fast mode spends <strong>2× tokens</strong> for the
        next attempt and completes it at <strong>2× speed</strong>. The setting applies to the next
        task attempt you start.
      </p>
      <p className="social-post-caption">Open Shop to select a terminal and turn it on.</p>
    </>
  )
}

function SocialPostCard({ post, state, dispatch }: { post: SocialPost; state: GameState; dispatch: Dispatch<GameAction> }) {
  const variant = post.type === 'reset' ? 'win' : post.type === 'model' || post.type === 'fast-mode' ? 'spark' : 'default'
  return (
    <article className={`social-post social-post-${post.type}`} aria-labelledby={`social-post-title-${post.id}`}>
      <div className="social-post-rail" aria-hidden="true">
        <TiroAvatar variant={variant} />
      </div>
      <div className="social-post-main">
        <header className="social-post-header">
          <div>
            <p className="social-post-kicker">{postKicker(post)}</p>
            <h2 id={`social-post-title-${post.id}`}>{postHeading(post)}</h2>
          </div>
          <time dateTime={`PT${Math.max(0, post.elapsed)}S`} title={`${post.elapsed} seconds since the run began`}>
            {elapsedLabel(post.elapsed)}
          </time>
        </header>
        <PostBody post={post} state={state} dispatch={dispatch} />
      </div>
    </article>
  )
}

export function SocialContent({ state, dispatch }: SocialProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const posts = state.socialPosts
  const { unreadCount, scrollToLatest } = useUnreadMessages(posts.map((post) => post.id), scrollRef)

  return (
    <section className="social-app" aria-label="ZZZ social feed">
      <header className="social-header">
        <div className="social-brand-lockup">
          <div className="social-brand-mark" aria-hidden="true">zzz</div>
          <div>
            <p className="social-eyebrow">TIRO SOCIAL</p>
            <h1>ZZZ</h1>
          </div>
        </div>
        <div className="social-status" aria-label={state.stage === 'hired' ? 'ZZZ connected' : 'ZZZ archive'}>
          <span className={`social-status-dot ${state.stage === 'hired' ? 'is-live' : ''}`} aria-hidden="true" />
          <span>{state.stage === 'hired' ? 'Connected' : 'Read only'}</span>
        </div>
      </header>

          <div className="social-feed-toolbar">
            <div>
              <p className="social-feed-title">Your timeline</p>
              <p className="social-feed-subtitle">Tiro, updates, and extremely questionable incentives.</p>
            </div>
            <UnreadIndicator count={unreadCount} onClick={scrollToLatest} />
          </div>
          <div className="social-feed" ref={scrollRef} role="log" aria-label="ZZZ timeline" aria-live="polite">
            {posts.map((post) => <SocialPostCard key={post.id} post={post} state={state} dispatch={dispatch} />)}
          </div>
    </section>
  )
}
