import { useRef } from 'react'
import type { Dispatch } from 'react'
import {
  ADVANCED_MODEL_PRICE,
  MERCURY_PRICE,
  SOCIAL_LOTTERY_COPY,
  SPARK_PRICE,
  SPARK_ULTRA_PRICE,
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

const moneyLabel = (amount: number): string => `$${amount.toLocaleString()}`

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
    case 'spark-ultra':
    case 'spark-ultra-delivered':
      return 'Mapple'
    case 'market':
    case 'spark':
    case 'spark-delivered':
    case 'monopoly':
    case 'shorts':
    case 'mercury':
    case 'second-job':
      return 'Tiro'
  }
}

function ProfileAvatar({ post, state }: { post: SocialPost; state: GameState }) {
  const author = postAuthor(post)
  const laboratory = author === 'Tiro Labs'
  return (
    <span className={`social-avatar ${laboratory ? 'social-avatar-lab' : 'social-avatar-tiro'}`} aria-hidden="true">
      {laboratory ? '🧪' : author === 'Mapple' ? 'M' : state.tiroAvatar}
    </span>
  )
}

function PostBody({
  post,
  state,
  dispatch,
  activeLotteryId,
}: {
  post: SocialPost
  state: GameState
  dispatch: Dispatch<GameAction>
  activeLotteryId: string | null
}) {
  const isReadOnly = state.stage !== 'hired'
  if (post.type === 'campaign') {
    return (
      <p className="social-post-copy">
        Hey, you made it. I topped your tokens back up to 10M. Consider it a welcome gift.
      </p>
    )
  }

  if (post.type === 'lottery') {
    const isActive = post.id === activeLotteryId
    const copy = SOCIAL_LOTTERY_COPY[post.lotteryVariant] ?? SOCIAL_LOTTERY_COPY[0]
    return (
      <>
        <p className="social-post-copy">{copy}</p>
        {isActive ? (
          <>
            <div className="social-lottery-actions">
              <button
                className="social-heart-button"
                type="button"
                disabled={isReadOnly}
                onClick={() => dispatch({ type: 'like-reset', postId: post.id })}
                aria-label={`Like Tiro’s post. ${post.likes.toLocaleString()} ${post.likes === 1 ? 'like' : 'likes'} so far.`}
              >
                <span aria-hidden="true">♥</span>
                <span>Like</span>
              </button>
              <span className="social-like-count" aria-live="polite">{post.likes.toLocaleString()} {post.likes === 1 ? 'like' : 'likes'}</span>
            </div>
            {isReadOnly && <p className="social-action-note">Your work account is read-only now.</p>}
          </>
        ) : (
          <p className="social-action-note">{post.likes.toLocaleString()} {post.likes === 1 ? 'like' : 'likes'} · This giveaway has ended.</p>
        )}
      </>
    )
  }

  if (post.type === 'reset') {
    return (
      <p className="social-post-copy social-success-copy">
        You’re back to 10M tokens. Go make something good.
      </p>
    )
  }

  if (post.type === 'model') {
    return (
      <p className="social-post-copy">
        We’ve been working on a smarter model. Meet ConvexLM Reasoning — your cloud agents can use it now.
      </p>
    )
  }

  if (post.type === 'fast-mode') {
    return (
      <p className="social-post-copy">
        Need it done sooner? We just shipped Fast mode: <strong>twice the speed, twice the tokens</strong>. You’ll find the switch in Shop.
      </p>
    )
  }

  if (post.type === 'market') {
    return (
      <p className="social-post-copy">
        Couldn’t resist adding a BTC market. Move some cash into your trading wallet if you feel like taking a risk.
      </p>
    )
  }

  if (post.type === 'spark') {
    return (
      <p className="social-post-copy">
        Finally got the Mapple Spark ready: two local ConvexLM Reasoning agents, no cloud-token bill. It’ll be in Shop in 10 seconds for <strong>{moneyLabel(SPARK_PRICE)}</strong>.
      </p>
    )
  }

  if (post.type === 'spark-delivered') {
    return (
      <p className="social-post-copy">
        I dropped off your Mapple Spark. Two local agents, ready to go. Grab YOLO from Shop if you’re tired of approving every command.
      </p>
    )
  }

  if (post.type === 'spark-ultra') {
    return (
      <p className="social-post-copy">
        Mapple Spark Ultra is on the way: two local ConvexLM Pro agents with no cloud-token bill. Shop opens in 10 seconds for <strong>{moneyLabel(SPARK_ULTRA_PRICE)}</strong>.
      </p>
    )
  }

  if (post.type === 'spark-ultra-delivered') {
    return (
      <p className="social-post-copy">
        Mapple Spark Ultra has arrived. Two fixed local ConvexLM Pro panes are ready for token-free work, with no Fast mode or cloud bill.
      </p>
    )
  }

  if (post.type === 'monopoly') {
    return (
      <p className="social-post-copy">
        <strong>WE MONOPOLIZED THE FRONTIERS</strong>. Token refills now rise 10% every five seconds. Keep earning, or trade your way out.
      </p>
    )
  }

  if (post.type === 'shorts') {
    return (
      <p className="social-post-copy">
        Your energy is taking a hit. Shorts is now in the dock: scroll through a short to recover a little energy and keep going.
      </p>
    )
  }

  if (post.type === 'advanced-model') {
    return (
      <p className="social-post-copy">
        We’ve got something for the harder jobs: ConvexLM Pro. Same speed as ConvexLM Reasoning, smarter answers. It’s <strong>{moneyLabel(ADVANCED_MODEL_PRICE)}</strong> in Shop.
      </p>
    )
  }

  if (post.type === 'mercury') {
    return (
      <p className="social-post-copy">
        I got tired of dragging files around, so I built Mercury. <strong>{moneyLabel(MERCURY_PRICE)}</strong> in Shop. It handles both handoffs for 300K tokens each and retries failures after 10 seconds. You’ll still need to approve commands.
      </p>
    )
  }

  if (post.type === 'second-job') {
    return (
      <p className="social-post-copy">
        A friend of mine is hiring. If one boss wasn’t enough, check Applications — there’s another job waiting for you.
      </p>
    )
  }

  return (
    <p className="social-post-copy">
      Tiro Max is ready. Pick it from a cloud terminal’s model menu when you need our smartest model. It uses <strong>2× tokens</strong>, so keep an eye on the bill.
    </p>
  )
}

function SocialPostCard({
  post,
  state,
  dispatch,
  activeLotteryId,
}: {
  post: SocialPost
  state: GameState
  dispatch: Dispatch<GameAction>
  activeLotteryId: string | null
}) {
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
        <PostBody post={post} state={state} dispatch={dispatch} activeLotteryId={activeLotteryId} />
      </div>
    </article>
  )
}

export function SocialContent({ state, dispatch }: SocialProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const posts = state.socialPosts
  const activeLotteryId = posts.findLast((post) => post.type === 'lottery')?.id ?? null
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
      </div>
      <div className="social-feed-shell">
        <div className="social-feed" ref={scrollRef} role="log" aria-label="Vibemaxxers' Social Network timeline" aria-live="polite">
          {posts.map((post) => <SocialPostCard key={post.id} post={post} state={state} dispatch={dispatch} activeLotteryId={activeLotteryId} />)}
        </div>
        <UnreadIndicator
          count={unreadCount}
          onClick={scrollToLatest}
          label={{ singular: 'update', plural: 'updates' }}
        />
      </div>
    </section>
  )
}

