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
    case 'campaign': return 'Token reset available'
    case 'lottery': return 'Like to reset tokens'
    case 'reset': return 'Tokens reset'
    case 'model': return 'Tiro Reason online'
    case 'fast-mode': return 'Fast mode unlocked'
    case 'market': return 'BTC market is open'
    case 'spark': return 'Mapple Spark announced'
    case 'spark-delivered': return 'Mapple Spark delivered'
    case 'advanced-model': return 'Tiro Pro available'
    case 'mercury': return 'Mercury available'
    case 'second-job': return 'Second job open'
    case 'frontier-model': return 'Tiro Max unlocked'
  }
}

const postKicker = (post: SocialPost): string => {
  switch (post.type) {
    case 'campaign':
    case 'lottery':
    case 'reset':
      return 'TIRO'
    case 'model':
    case 'fast-mode':
    case 'advanced-model':
    case 'frontier-model':
      return 'TIRO LABS'
    case 'market':
    case 'spark':
    case 'spark-delivered':
    case 'mercury':
    case 'second-job':
      return 'TIRO'
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
          Reset your token balance to 10M now. One reset per run.
        </p>
        <button
          className="social-action social-claim-button"
          type="button"
          disabled={isLost || hasClaimedReset}
          onClick={() => dispatch({ type: 'claim-token-reset' })}
        >
          {hasClaimedReset ? 'Reset applied' : 'Reset to 10M now'}
        </button>
      </>
    )
  }

  if (post.type === 'lottery') {
    return (
      <>
        <p className="social-post-copy">
          Like for a chance to refill to 10M. No luck? Like again.
        </p>
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
      <p className="social-post-copy">
        Tiro Reason is unlocked. New cloud attempts use it.
      </p>
    )
  }

  if (post.type === 'fast-mode') {
    return (
      <p className="social-post-copy">
        Fast mode: <strong>2× speed · 2× tokens</strong>. Applies to new attempts while enabled.
        Turn it on in Shop for a cloud terminal.
      </p>
    )
  }

  if (post.type === 'market') {
    return (
      <p className="social-post-copy">
        BTC trading is live. Open Market to trade with your USD balance.
      </p>
    )
  }

  if (post.type === 'spark') {
    return (
      <p className="social-post-copy">
        Mapple Spark opens in Shop 10 seconds after this post · <strong>$15,000</strong>.
        Local Reason panes use no cloud task tokens.
      </p>
    )
  }

  if (post.type === 'spark-delivered') {
    return (
      <p className="social-post-copy">
        Mapple Spark delivered: two fixed Reason panes. Install YOLO if you want to skip approvals.
      </p>
    )
  }

  if (post.type === 'advanced-model') {
    return (
      <p className="social-post-copy">
        Tiro Pro is in Shop for <strong>$5,000</strong>. New cloud attempts default to Pro.
      </p>
    )
  }

  if (post.type === 'mercury') {
    return (
      <p className="social-post-copy">
        Mercury is in Shop for <strong>$8,000</strong>. Automatic handoffs cost 300K tokens each way;
        manual approvals and retries remain available.
      </p>
    )
  }

  if (post.type === 'second-job') {
    return (
      <p className="social-post-copy">
        A second job is open. Open Applications and submit its form.
      </p>
    )
  }

  return (
    <p className="social-post-copy">
      Tiro Max is available in each cloud terminal’s model menu. It uses <strong>2× tokens</strong>.
    </p>
  )
}

function SocialPostCard({ post, state, dispatch }: { post: SocialPost; state: GameState; dispatch: Dispatch<GameAction> }) {
  const variant = post.type === 'reset'
    ? 'win'
    : post.type === 'model' ||
        post.type === 'fast-mode' ||
        post.type === 'advanced-model' ||
        post.type === 'frontier-model' ||
        post.type === 'spark-delivered'
      ? 'spark'
      : 'default'
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
        <p className="social-feed-title">Your timeline</p>
        <UnreadIndicator count={unreadCount} onClick={scrollToLatest} />
      </div>
      <div className="social-feed" ref={scrollRef} role="log" aria-label="ZZZ timeline" aria-live="polite">
        {posts.map((post) => <SocialPostCard key={post.id} post={post} state={state} dispatch={dispatch} />)}
      </div>
    </section>
  )
}
