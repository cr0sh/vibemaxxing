import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const NEAR_BOTTOM_TOLERANCE = 24

type PendingWork = {
  messages: boolean
  scroll: boolean
  layout: boolean
}

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_TOLERANCE
}

function hasSameMessageIds(current: ReadonlySet<string>, next: readonly string[]): boolean {
  if (current.size !== next.length) return false
  for (const id of next) {
    if (!current.has(id)) return false
  }
  return true
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 'auto'
  }
  return 'smooth'
}

function scrollToBottom(element: HTMLElement, behavior: ScrollBehavior = 'auto'): void {
  const top = Math.max(0, element.scrollHeight - element.clientHeight)
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top, behavior })
  } else {
    element.scrollTop = top
  }
}

export function useUnreadMessages(
  messageIds: readonly string[],
  scrollRef: RefObject<HTMLElement | null>,
): { unreadCount: number; scrollToLatest: () => void } {
  const [unreadCount, setUnreadCount] = useState(0)
  const currentMessageIds = useRef<Set<string> | null>(null)
  const seenMessageIds = useRef<Set<string> | null>(null)
  const unreadMessageIds = useRef<Set<string> | null>(null)
  const publishedCount = useRef(0)
  const mounted = useRef(false)
  const frame = useRef<number | null>(null)
  const atBottom = useRef<boolean | null>(null)
  const following = useRef(false)
  const pending = useRef<PendingWork | null>(null)

  const publishCount = useCallback(() => {
    const nextCount = unreadMessageIds.current?.size ?? 0
    if (publishedCount.current === nextCount) return
    publishedCount.current = nextCount
    setUnreadCount(nextCount)
  }, [])

  const scheduleFrame = useCallback(() => {
    if (!mounted.current || frame.current !== null || typeof window === 'undefined') return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null
      if (!mounted.current) return

      const element = scrollRef.current
      const work = pending.current
      const ids = currentMessageIds.current
      const seenIds = seenMessageIds.current
      const unreadIds = unreadMessageIds.current
      if (!element || !work || !ids || !seenIds || !unreadIds) return
      pending.current = null

      // A removed message must not leave stale state behind. Pruning seen IDs also
      // keeps this bookkeeping bounded and treats a later reappearance as new.
      for (const id of unreadIds) {
        if (!ids.has(id)) unreadIds.delete(id)
      }
      if (work.messages) {
        for (const id of seenIds) {
          if (!ids.has(id)) seenIds.delete(id)
        }
      }

      // Scroll events are sampled in a frame so bursts of wheel/touch events cannot
      // fight message reconciliation or cause a render for every DOM event.
      if (work.scroll) {
        const nearBottom = isNearBottom(element)
        if (following.current && !nearBottom) {
          // Smooth programmatic scrolling emits intermediate events. Keep following
          // the intended bottom until it arrives, unless user input cancels it.
          atBottom.current = true
        } else {
          following.current = false
          atBottom.current = nearBottom
          if (nearBottom) unreadIds.clear()
        }
      }

      // A resize or content reflow should preserve the user's position. If they were
      // already at the bottom, follow the new bottom; otherwise never steal their scroll.
      if (work.layout) {
        const nearBottom = isNearBottom(element)
        if (atBottom.current === null) {
          atBottom.current = nearBottom
        } else if (atBottom.current) {
          if (!nearBottom) scrollToBottom(element)
          atBottom.current = true
        } else if (nearBottom) {
          atBottom.current = true
          unreadIds.clear()
        }
      }

      if (work.messages) {
        const newlyAdded: string[] = []
        for (const id of ids) {
          if (seenIds.has(id)) continue
          seenIds.add(id)
          newlyAdded.push(id)
        }

        if (newlyAdded.length > 0) {
          if (atBottom.current === null) atBottom.current = isNearBottom(element)
          if (atBottom.current) {
            scrollToBottom(element)
          } else {
            for (const id of newlyAdded) unreadIds.add(id)
          }
        }
      }

      publishCount()
    })
  }, [publishCount, scrollRef])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    mounted.current = true
    atBottom.current = null
    following.current = false
    pending.current = { messages: false, scroll: false, layout: true }

    const onScroll = () => {
      if (!pending.current) pending.current = { messages: false, scroll: false, layout: false }
      pending.current.scroll = true
      scheduleFrame()
    }
    const cancelFollowing = () => {
      following.current = false
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    element.addEventListener('wheel', cancelFollowing, { passive: true })
    element.addEventListener('touchstart', cancelFollowing, { passive: true })
    element.addEventListener('pointerdown', cancelFollowing, { passive: true })
    element.addEventListener('keydown', cancelFollowing)

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (!pending.current) pending.current = { messages: false, scroll: false, layout: false }
          pending.current.layout = true
          scheduleFrame()
        })
    resizeObserver?.observe(element)

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          if (!pending.current) pending.current = { messages: false, scroll: false, layout: false }
          pending.current.layout = true
          scheduleFrame()
        })
    mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true })

    scheduleFrame()

    return () => {
      mounted.current = false
      element.removeEventListener('scroll', onScroll)
      element.removeEventListener('wheel', cancelFollowing)
      element.removeEventListener('touchstart', cancelFollowing)
      element.removeEventListener('pointerdown', cancelFollowing)
      element.removeEventListener('keydown', cancelFollowing)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
        frame.current = null
      }
      pending.current = null
      atBottom.current = null
      following.current = false
    }
  }, [scheduleFrame, scrollRef])

  useEffect(() => {
    const currentIds = currentMessageIds.current
    if (currentIds === null) {
      const initialIds = new Set(messageIds)
      currentMessageIds.current = initialIds
      seenMessageIds.current = new Set(initialIds)
      unreadMessageIds.current = new Set()
      return
    }
    if (hasSameMessageIds(currentIds, messageIds)) return

    currentMessageIds.current = new Set(messageIds)
    if (!pending.current) pending.current = { messages: false, scroll: false, layout: false }
    pending.current.messages = true
    scheduleFrame()
  })

  const scrollToLatest = useCallback(() => {
    const element = scrollRef.current
    const unreadIds = unreadMessageIds.current
    if (!mounted.current || !element || !unreadIds) return

    atBottom.current = true
    unreadIds.clear()
    publishCount()
    const behavior = scrollBehavior()
    following.current = behavior === 'smooth'
    scrollToBottom(element, behavior)
  }, [publishCount, scrollRef])

  return { unreadCount, scrollToLatest }
}
