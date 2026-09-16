import { useEffect, useRef, useState } from 'react'
import './ResourceCounter.css'

const duration = 650

type CounterFrame = {
  value: number
  direction: 'up' | 'down'
  burst: number
  active: boolean
}

export function ResourceCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const displayed = useRef(value)
  const sequence = useRef(0)
  const [frame, setFrame] = useState<CounterFrame>({ value, direction: 'up', burst: 0, active: false })

  useEffect(() => {
    const from = displayed.current
    const direction = value > from ? 'up' : 'down'
    const burst = ++sequence.current
    const startedAt = performance.now()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0

    const advance = (now: number) => {
      const progress = motion.matches || from === value ? 1 : Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      const nextValue = progress === 1 ? value : Math.round(from + (value - from) * eased)
      const active = progress < 1
      displayed.current = nextValue
      setFrame((current) => {
        if (current.value === nextValue && current.active === active && (!active || current.burst === burst)) return current
        return { value: nextValue, direction, burst, active }
      })
      if (active) request = window.requestAnimationFrame(advance)
    }

    request = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(request)
  }, [value])

  return (
    <strong
      className={`resource-count ${frame.active ? 'resource-count-changing' : ''}`}
      aria-label={`${prefix}${value.toLocaleString()}`}
    >
      <span aria-hidden="true">{prefix}{frame.value.toLocaleString()}</span>
      {frame.active && (
        <span className={`resource-count-burst resource-count-${frame.direction}`} key={frame.burst} aria-hidden="true">
          <span className="resource-change-direction">{frame.direction === 'up' ? '🔺' : '🔻'}</span>
          <span className="resource-sparkle resource-sparkle-left">✨</span>
          <span className="resource-sparkle resource-sparkle-right">✨</span>
        </span>
      )}
    </strong>
  )
}
