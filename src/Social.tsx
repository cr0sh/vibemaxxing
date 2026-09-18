import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dispatch } from 'react'
import {
  ADVANCED_MODEL_PRICE,
  MERCURY_PRICE,
  SOCIAL_LOTTERY_KEYS,
  SPARK_PRICE,
  SPARK_ULTRA_PRICE,
  type GameAction,
  type GameState,
  type SocialPost,
} from './game'
import { UnreadIndicator } from './UnreadIndicator'
import { useUnreadMessages } from './useUnreadMessages'
import { Localized, useI18n } from './i18n'
import './Social.css'

const SOCIAL_HEART_BURST_DURATION = 860
const SOCIAL_HEART_BURST_REDUCED_DURATION = 520

type SocialHeartBurstState = {
  id: number
  left: number
  top: number
  reducedMotion: boolean
  likes: number
}

function SocialHeartBurst({ burst }: { burst: SocialHeartBurstState }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <span
      className={`social-heart-burst${burst.reducedMotion ? ' is-reduced' : ''}`}
      style={{ left: burst.left, top: burst.top }}
      aria-hidden="true"
    >
      <span className="social-heart-burst-heart">♥</span>
      <span className="social-heart-burst-sparkle social-heart-burst-sparkle-one">✦</span>
      <span className="social-heart-burst-sparkle social-heart-burst-sparkle-two">✦</span>
      <span className="social-heart-burst-sparkle social-heart-burst-sparkle-three">✧</span>
      <span className="social-heart-burst-sparkle social-heart-burst-sparkle-four">♥</span>
      <span className="social-heart-burst-sparkle social-heart-burst-sparkle-five">♥</span>
    </span>,
    document.body,
  )
}

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
  const { t, formatNumber, formatCurrency } = useI18n()
  const isReadOnly = state.stage !== 'hired'
  const likeButtonRef = useRef<HTMLButtonElement | null>(null)
  const burstSequence = useRef(0)
  const [likeBurst, setLikeBurst] = useState<SocialHeartBurstState | null>(null)

  useEffect(() => {
    if (likeBurst === null) return

    const clearBurst = window.setTimeout(() => {
      setLikeBurst((current) => current?.id === likeBurst.id ? null : current)
    }, likeBurst.reducedMotion ? SOCIAL_HEART_BURST_REDUCED_DURATION : SOCIAL_HEART_BURST_DURATION)

    return () => window.clearTimeout(clearBurst)
  }, [likeBurst])

  useEffect(() => {
    if (likeBurst === null || post.likes <= likeBurst.likes ||
      post.id !== activeLotteryId || likeBurst.reducedMotion) return
    const shake = likeButtonRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-in-out' },
    )
    return () => shake?.cancel()
  }, [activeLotteryId, likeBurst, post.id, post.likes])

  const handleLike = () => {
    if (isReadOnly) return

    const buttonRect = likeButtonRef.current?.getBoundingClientRect()
    if (buttonRect) {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      setLikeBurst({
        id: ++burstSequence.current,
        left: buttonRect.left + buttonRect.width / 2,
        top: buttonRect.top + buttonRect.height / 2,
        reducedMotion: prefersReducedMotion,
        likes: post.likes,
      })
    }

    dispatch({ type: 'like-reset', postId: post.id })
  }

  if (post.type === 'campaign') {
    return <p className="social-post-copy">{t('social.campaign')}</p>
  }

  if (post.type === 'lottery') {
    const isActive = post.id === activeLotteryId
    const lotteryKey = SOCIAL_LOTTERY_KEYS[post.lotteryVariant]!
    const formattedLikes = formatNumber(post.likes)
    const likeNoun = t(post.likes === 1 ? 'social.like.one' : 'social.like.many')
    return (
      <>
        <p className="social-post-copy">{t(lotteryKey)}</p>
        {isActive ? (
          <>
            <div className="social-lottery-actions">
              <button
                ref={likeButtonRef}
                className="social-heart-button"
                type="button"
                disabled={isReadOnly}
                onClick={handleLike}
                aria-label={t('social.likeAria', { count: formattedLikes, noun: likeNoun })}
              >
                <span aria-hidden="true">♥</span>
                <span>{t('social.like')}</span>
              </button>
              <span className="social-like-count" aria-live="polite">{formattedLikes} {likeNoun}</span>
            </div>
            {isReadOnly && <p className="social-action-note">{t('social.readOnlyNote')}</p>}
          </>
        ) : (
          <p className="social-action-note">
            {t('social.giveawayEnded', { count: formattedLikes, noun: likeNoun })}
          </p>
        )}
        {likeBurst && post.likes > likeBurst.likes && !isActive &&
          <SocialHeartBurst key={likeBurst.id} burst={likeBurst} />}
      </>
    )
  }

  if (post.type === 'reset') {
    return <p className="social-post-copy social-success-copy">{t('social.reset')}</p>
  }

  if (post.type === 'model') {
    return <p className="social-post-copy">{t('social.model')}</p>
  }

  if (post.type === 'fast-mode') {
    return (
      <p className="social-post-copy">
        {t('social.fastMode.lead')} <strong>{t('social.fastMode.emphasis')}</strong>. {t('social.fastMode.body')}
      </p>
    )
  }

  if (post.type === 'market') {
    return <p className="social-post-copy">{t('social.market')}</p>
  }

  if (post.type === 'spark') {
    return (
      <p className="social-post-copy">
        <Localized message="social.spark" values={{ price: <strong>{formatCurrency(SPARK_PRICE)}</strong> }} />
      </p>
    )
  }

  if (post.type === 'spark-delivered') {
    return <p className="social-post-copy">{t('social.sparkDelivered')}</p>
  }

  if (post.type === 'spark-ultra') {
    return (
      <p className="social-post-copy">
        <Localized message="social.sparkUltra" values={{ price: <strong>{formatCurrency(SPARK_ULTRA_PRICE)}</strong> }} />
      </p>
    )
  }

  if (post.type === 'spark-ultra-delivered') {
    return <p className="social-post-copy">{t('social.sparkUltraDelivered')}</p>
  }

  if (post.type === 'monopoly') {
    return (
      <p className="social-post-copy">
        <strong>{t('social.monopoly.lead')}</strong>{' '}{t('social.monopoly.body')}
      </p>
    )
  }

  if (post.type === 'shorts') {
    return <p className="social-post-copy">{t('social.shorts')}</p>
  }

  if (post.type === 'advanced-model') {
    return (
      <p className="social-post-copy">
        <Localized message="social.advancedModel" values={{ price: <strong>{formatCurrency(ADVANCED_MODEL_PRICE)}</strong> }} />
      </p>
    )
  }

  if (post.type === 'mercury') {
    return (
      <p className="social-post-copy">
        <Localized message="social.mercury" values={{ price: <strong>{formatCurrency(MERCURY_PRICE)}</strong> }} />
      </p>
    )
  }

  if (post.type === 'second-job') {
    return <p className="social-post-copy">{t('social.secondJob')}</p>
  }

  return <p className="social-post-copy">{t('social.frontier')}</p>
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
  const { t, formatNumber } = useI18n()
  const author = postAuthor(post)
  const time = elapsedLabel(post.elapsed)
  return (
    <article className={`social-post social-post-${post.type}`} aria-label={t('social.postAria', { author, time })}>
      <div className="social-post-rail" aria-hidden="true">
        <ProfileAvatar post={post} state={state} />
      </div>
      <div className="social-post-main">
        <header className="social-post-header">
          <p className="social-post-author">{author}</p>
          <time dateTime={`PT${Math.max(0, post.elapsed)}S`} title={t('social.elapsedTitle', { seconds: formatNumber(post.elapsed) })}>
            {time}
          </time>
        </header>
        <PostBody post={post} state={state} dispatch={dispatch} activeLotteryId={activeLotteryId} />
      </div>
    </article>
  )
}

export function SocialContent({ state, dispatch }: SocialProps) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const posts = state.socialPosts
  const activeLotteryId = posts.findLast((post) => post.type === 'lottery')?.id ?? null
  const { unreadCount, scrollToLatest } = useUnreadMessages(posts.map((post) => post.id), scrollRef)

  return (
    <section className="social-app" aria-label={t('social.aria')}>
      <header className="social-header">
        <div className="social-brand-lockup">
          <div className="social-brand-mark" aria-hidden="true">Z</div>
          <h1>{t('social.aria')}</h1>
        </div>
        <div className="social-status" aria-label={state.stage === 'hired' ? t('social.connected') : t('social.archive')}>
          <span className={`social-status-dot ${state.stage === 'hired' ? 'is-live' : ''}`} aria-hidden="true" />
          <span>{state.stage === 'hired' ? t('social.status.connected') : t('social.status.readOnly')}</span>
        </div>
      </header>

      <div className="social-feed-toolbar">
        <p className="social-feed-title">{t('social.timeline')}</p>
      </div>
      <div className="social-feed-shell">
        <div className="social-feed" ref={scrollRef} role="log" aria-label={t('social.timelineAria')} aria-live="polite">
          {posts.map((post) => <SocialPostCard key={post.id} post={post} state={state} dispatch={dispatch} activeLotteryId={activeLotteryId} />)}
        </div>
        <UnreadIndicator
          count={unreadCount}
          onClick={scrollToLatest}
          label={{ singular: t('social.update.one'), plural: t('social.update.many') }}
        />
      </div>
    </section>
  )
}

