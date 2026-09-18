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

const postAuthor = (post: SocialPost): string => {
  switch (post.type) {
    case 'campaign':
    case 'lottery':
    case 'reset':
      return 'Tiro'
    case 'model':
    case 'fast-mode':
    case 'advanced-model':
    case 'frontier-model':
      return 'Tiro Labs'
    case 'market':
    case 'spark':
    case 'spark-delivered':
    case 'mercury':
    case 'second-job':
      return 'Tiro'
  }
}

function ProfileAvatar({ post, state }: { post: SocialPost; state: GameState }) {
  const laboratory = postAuthor(post) === 'Tiro Labs'
  return (
    <span className={`social-avatar ${laboratory ? 'social-avatar-lab' : 'social-avatar-tiro'}`} aria-hidden="true">
      {laboratory ? '🧪' : state.tiroAvatar}
    </span>
  )
}

function PostBody({ post, state, dispatch }: { post: SocialPost; state: GameState; dispatch: Dispatch<GameAction> }) {
  const isLost = state.stage === 'lost'

  if (post.type === 'campaign') {
    return (
      <p className="social-post-copy">
        I reset your token balance to 10M when you installed this network. That automatic reset happens once per run.
      </p>
    )
  }

  if (post.type === 'lottery') {
    return (
      <>
        <p className="social-post-copy">
          I’ll refill your balance to 10M if your Like hits my one-percent lottery. Missed it? You can like this post again.
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
        I reset your balance to 10M tokens right away.
      </p>
    )
  }

  if (post.type === 'model') {
    return (
      <p className="social-post-copy">
        I unlocked ConvexLM Reasoning for your new cloud attempts.
      </p>
    )
  }

  if (post.type === 'fast-mode') {
    return (
      <p className="social-post-copy">
        I added Fast mode: new attempts run at <strong>2× speed and spend 2× tokens</strong>. Turn it on in Shop for a cloud terminal.
      </p>
    )
  }

  if (post.type === 'market') {
    return (
      <p className="social-post-copy">
        I just opened BTC trading. You can trade from Market using your USD balance.
      </p>
    )
  }

  if (post.type === 'spark') {
    return (
      <p className="social-post-copy">
        I’m opening Mapple Spark in Shop 10 seconds after this post for <strong>$15,000</strong>. Its local ConvexLM Reasoning panes don’t use cloud task tokens.
      </p>
    )
  }

  if (post.type === 'spark-delivered') {
    return (
      <p className="social-post-copy">
        I delivered Mapple Spark with two fixed ConvexLM Reasoning panes. Install YOLO if you’d rather skip approvals.
      </p>
    )
  }

  if (post.type === 'advanced-model') {
    return (
      <p className="social-post-copy">
        I put ConvexLM Pro in Shop for <strong>$5,000</strong>. Buy it to use Pro on new cloud attempts.
      </p>
    )
  }

  if (post.type === 'mercury') {
    return (
      <p className="social-post-copy">
        I put Mercury in Shop for <strong>$8,000</strong>. Turn on automatic retries and I’ll start one 10 seconds after a failure; manual retries stay immediate. Approvals stay manual, and each automatic handoff costs 300K tokens each way.
      </p>
    )
  }

  if (post.type === 'second-job') {
    return (
      <p className="social-post-copy">
        I’m opening a second job. Open Applications and submit the form if you want it.
      </p>
    )
  }

  return (
    <p className="social-post-copy">
      I added Tiro Max to each cloud terminal’s model menu. It uses <strong>2× tokens</strong>.
    </p>
  )
}

function SocialPostCard({ post, state, dispatch }: { post: SocialPost; state: GameState; dispatch: Dispatch<GameAction> }) {
  return (
    <article className={`social-post social-post-${post.type}`} aria-label={`${postAuthor(post)} post at ${elapsedLabel(post.elapsed)}`}>
      <div className="social-post-rail" aria-hidden="true">
        <ProfileAvatar post={post} state={state} />
      </div>
      <div className="social-post-main">
        <header className="social-post-header">
          <p className="social-post-author">{postAuthor(post)}</p>
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
    <section className="social-app" aria-label="Vibemaxxers' Social Network">
      <header className="social-header">
        <div className="social-brand-lockup">
          <div className="social-brand-mark" aria-hidden="true">Z</div>
          <h1>Vibemaxxers' Social Network</h1>
        </div>
        <div className="social-status" aria-label={state.stage === 'hired' ? 'Social network connected' : 'Social network archive'}>
          <span className={`social-status-dot ${state.stage === 'hired' ? 'is-live' : ''}`} aria-hidden="true" />
          <span>{state.stage === 'hired' ? 'Connected' : 'Read only'}</span>
        </div>
      </header>

      <div className="social-feed-toolbar">
        <p className="social-feed-title">Your timeline</p>
        <UnreadIndicator count={unreadCount} onClick={scrollToLatest} />
      </div>
      <div className="social-feed" ref={scrollRef} role="log" aria-label="Vibemaxxers' Social Network timeline" aria-live="polite">
        {posts.map((post) => <SocialPostCard key={post.id} post={post} state={state} dispatch={dispatch} />)}
      </div>
    </section>
  )
}

