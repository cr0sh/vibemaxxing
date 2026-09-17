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
    case 'campaign': return 'A free reset. Back to 10M.'
    case 'lottery': return 'Like for a free token reset'
    case 'reset': return 'Token reset applied'
    case 'model': return 'Tiro Reason is online'
    case 'fast-mode': return 'Fast mode unlocked'
  }
}

const postKicker = (post: SocialPost): string => {
  switch (post.type) {
    case 'campaign': return 'TIRO'
    case 'lottery': return 'TIRO'
    case 'reset': return 'TIRO'
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
          Running low? Reset your token balance to 10M right now, on us.
        </p>
        <p className="social-post-caption">One free reset per run. Applied immediately, not saved for later.</p>
        <button
          className="social-action social-claim-button"
          type="button"
          disabled={isLost || hasClaimedReset}
          onClick={() => dispatch({ type: 'claim-token-reset' })}
        >
          {hasClaimedReset ? 'Reset applied' : 'Reset to 10M now'}
        </button>
        {hasClaimedReset && <p className="social-action-note">Your balance was reset to 10M immediately.</p>}
      </>
    )
  }

  if (post.type === 'lottery') {
    return (
      <>
        <p className="social-post-copy">
          Out of tokens? Hit Like—we’re topping lucky builders back up to 10M.
          No luck? Like again. More Likes, more chances to get back to shipping.
        </p>
        <p className="social-post-caption">Each Like has a <strong>1% chance</strong> of resetting your balance to 10M immediately.</p>
        <div className="social-lottery-actions">
          <button
            className="social-heart-button"
            type="button"
            disabled={isLost}
            onClick={() => dispatch({ type: 'like-reset' })}
            aria-label={`Like Tiro’s post. ${post.likes.toLocaleString()} ${post.likes === 1 ? 'like' : 'likes'} so far.`}
          >
            <span aria-hidden="true">♥</span>
            <span>Like</span>
          </button>
          <span className="social-like-count" aria-live="polite">{post.likes.toLocaleString()} {post.likes === 1 ? 'like' : 'likes'}</span>
        </div>
        {isLost && <p className="social-action-note">The feed is archived after the run ends.</p>}
      </>
    )
  }

  if (post.type === 'reset') {
    return (
      <p className="social-post-copy social-success-copy">
        We reset your balance to 10M tokens immediately.
      </p>
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
              <p className="social-feed-subtitle">Token resets and product updates from Tiro.</p>
            </div>
            <UnreadIndicator count={unreadCount} onClick={scrollToLatest} />
          </div>
          <div className="social-feed" ref={scrollRef} role="log" aria-label="ZZZ timeline" aria-live="polite">
            {posts.map((post) => <SocialPostCard key={post.id} post={post} state={state} dispatch={dispatch} />)}
          </div>
    </section>
  )
}
