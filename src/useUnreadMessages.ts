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

function scrollBehavior(): ScrollBehavior {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 'auto'
  }
  return 'smooth'
}

function scrollToBottom(element: HTMLElement): void {
  const top = Math.max(0, element.scrollHeight - element.clientHeight)
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top, behavior: scrollBehavior() })
  } else {
    element.scrollTop = top
  }
}

export function useUnreadMessages(
  messageIds: readonly string[],
  scrollRef: RefObject<HTMLElement | null>,
): { unreadCount: number; scrollToLatest: () => void } {
  const [unreadCount, setUnreadCount] = useState(0)
  const currentMessageIds = useRef(new Set(messageIds))
  const seenMessageIds = useRef(new Set(messageIds))
  const unreadMessageIds = useRef(new Set<string>())
  const publishedCount = useRef(0)
  const mounted = useRef(false)
  const frame = useRef<number | null>(null)
  const atBottom = useRef<boolean | null>(null)
  const pending = useRef<PendingWork>({ messages: false, scroll: false, layout: false })

  // Keep identity-independent message state available to the frame that reconciles the DOM.
  currentMessageIds.current = new Set(messageIds)

  const publishCount = useCallback(() => {
    const nextCount = unreadMessageIds.current.size
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
      if (!element) return

      const work = pending.current
      pending.current = { messages: false, scroll: false, layout: false }
      const ids = currentMessageIds.current

      // A removed message must not leave a stale unread badge behind.
      for (const id of unreadMessageIds.current) {
        if (!ids.has(id)) unreadMessageIds.current.delete(id)
      }

      // Scroll events are sampled in a frame so bursts of wheel/touch events cannot
      // fight message reconciliation or cause a render for every DOM event.
      if (work.scroll) {
        const nearBottom = isNearBottom(element)
        atBottom.current = nearBottom
        if (nearBottom) unreadMessageIds.current.clear()
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
          unreadMessageIds.current.clear()
        }
      }

      if (work.messages) {
        const newlyAdded: string[] = []
        for (const id of ids) {
          if (seenMessageIds.current.has(id)) continue
          seenMessageIds.current.add(id)
          newlyAdded.push(id)
        }

        if (newlyAdded.length > 0) {
          if (atBottom.current === null) atBottom.current = isNearBottom(element)
          if (atBottom.current) {
            scrollToBottom(element)
          } else {
            for (const id of newlyAdded) unreadMessageIds.current.add(id)
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
    pending.current.layout = true

    const onScroll = () => {
      pending.current.scroll = true
      scheduleFrame()
    }
    element.addEventListener('scroll', onScroll, { passive: true })

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          pending.current.layout = true
          scheduleFrame()
        })
    resizeObserver?.observe(element)

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          pending.current.layout = true
          scheduleFrame()
        })
    mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true })

    scheduleFrame()

    return () => {
      mounted.current = false
      element.removeEventListener('scroll', onScroll)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
        frame.current = null
      }
      pending.current = { messages: false, scroll: false, layout: false }
      atBottom.current = null
    }
  }, [scheduleFrame, scrollRef])

  useEffect(() => {
    pending.current.messages = true
    scheduleFrame()
  })

  const scrollToLatest = useCallback(() => {
    const element = scrollRef.current
    if (!mounted.current || !element) return

    atBottom.current = true
    unreadMessageIds.current.clear()
    publishCount()
    scrollToBottom(element)
  }, [publishCount, scrollRef])

  return { unreadCount, scrollToLatest }
}
