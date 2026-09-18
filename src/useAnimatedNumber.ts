import { useEffect, useRef, useState } from 'react'

const duration = 650

type Direction = 'up' | 'down' | null

type AnimationState = {
  value: number | undefined
  active: boolean
  direction: Direction
}

function finiteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value)
}
export function useAnimatedNumber(target: number | undefined): AnimationState {
  const normalizedTarget = finiteNumber(target) ? target : undefined
  const displayed = useRef<number | undefined>(normalizedTarget)
  const previousTarget = useRef<number | undefined>(normalizedTarget)
  const initialized = useRef(false)
  const mounted = useRef(true)
  const frame = useRef<number | null>(null)
  const animation = useRef(0)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  )
  const [state, setState] = useState<AnimationState>(() => ({
    value: normalizedTarget,
    active: false,
    direction: null,
  }))

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    if (media.addEventListener) {
      media.addEventListener('change', handleChange)
    } else {
      media.addListener(handleChange)
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handleChange)
      } else {
        media.removeListener(handleChange)
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const cancel = () => {
      animation.current += 1
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
        frame.current = null
      }
    }

    cancel()

    if (!initialized.current) {
      initialized.current = true
      previousTarget.current = normalizedTarget
      displayed.current = normalizedTarget
      return () => {
        mounted.current = false
        cancel()
      }
    }

    const oldTarget = previousTarget.current
    previousTarget.current = normalizedTarget

    if (
      !finiteNumber(normalizedTarget) ||
      !finiteNumber(oldTarget) ||
      oldTarget === normalizedTarget ||
      !finiteNumber(displayed.current) ||
      reducedMotion
    ) {
      displayed.current = normalizedTarget
      setState((current) => {
        if (current.value === normalizedTarget && !current.active && current.direction === null) return current
        return { value: normalizedTarget, active: false, direction: null }
      })
      return () => {
        mounted.current = false
        cancel()
      }
    }

    const from = displayed.current
    const direction: Exclude<Direction, null> = normalizedTarget > oldTarget ? 'up' : 'down'
    const run = ++animation.current
    let startedAt: number | null = null

    setState((current) => {
      if (current.value === from && current.active && current.direction === direction) return current
      return { value: from, active: true, direction }
    })

    const advance = (now: number) => {
      if (!mounted.current || animation.current !== run) return
      if (startedAt === null) startedAt = now

      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      const nextValue = progress === 1 ? normalizedTarget : from + (normalizedTarget - from) * eased
      const active = progress < 1
      displayed.current = nextValue
      setState((current) => {
        if (!mounted.current || animation.current !== run) return current
        return { value: nextValue, active, direction: active ? direction : null }
      })

      if (active) {
        frame.current = window.requestAnimationFrame(advance)
      } else {
        frame.current = null
      }
    }

    frame.current = window.requestAnimationFrame(advance)

    return () => {
      mounted.current = false
      cancel()
    }
  }, [normalizedTarget, reducedMotion])

  return state
}
