import { memo, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import './ResourceCounter.css'

const duration = 650
const minimumParticles = 3
const maximumParticles = 20

type CounterFrame = {
  value: number
  active: boolean
}

type Particle = {
  kind: 'direction' | 'sparkle'
  x: number
  y: number
  travelX: number
  travelY: number
  startTravelX: number
  startTravelY: number
  delay: number
  duration: number
  rotation: number
  endRotation: number
  scale: number
}

type Burst = {
  id: number
  direction: 'up' | 'down'
  left: number
  top: number
  width: number
  height: number
  particles: Particle[]
}

function particleCount(delta: number) {
  if (!(delta > 0)) return 0
  if (!Number.isFinite(delta)) return maximumParticles

  return Math.min(maximumParticles, Math.max(minimumParticles, 3 + Math.ceil(Math.log10(delta + 1) * 3.4)))
}

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function createParticles(count: number, width: number, height: number, id: number) {
  const perimeter = 2 * (width + height)
  const directionParticles = Math.max(1, Math.round(count * 0.25))

  return Array.from({ length: count }, (_, index): Particle => {
    const distance = ((index + 0.5) / count) * perimeter
    let x = 0
    let y = 0
    let normalX = 0
    let normalY = 0

    if (distance < width) {
      x = distance
      normalY = -1
    } else if (distance < width + height) {
      x = width
      y = distance - width
      normalX = 1
    } else if (distance < 2 * width + height) {
      x = width - (distance - width - height)
      y = height
      normalY = 1
    } else {
      y = height - (distance - 2 * width - height)
      normalX = -1
    }

    const variation = noise(id * 23 + index * 17)
    const tangent = (variation - 0.5) * 0.35
    const travel = 18 + variation * 19
    const isDirection = index < directionParticles
    const rotation = isDirection ? 0 : Math.round((variation - 0.5) * 40)

    return {
      kind: isDirection ? 'direction' : 'sparkle',
      x: (x / width) * 100,
      y: (y / height) * 100,
      travelX: Math.round((normalX + (normalY === 0 ? 0 : tangent)) * travel),
      travelY: Math.round((normalY + (normalX === 0 ? tangent : 0)) * travel),
      startTravelX: Math.round((normalX + (normalY === 0 ? 0 : tangent)) * travel * 0.18),
      startTravelY: Math.round((normalY + (normalX === 0 ? tangent : 0)) * travel * 0.18),
      delay: Math.round(variation * 90),
      duration: duration - Math.round(variation * 90),
      rotation,
      endRotation: rotation + (isDirection ? Math.round((variation - 0.5) * 18) : Math.round((variation - 0.5) * 100)),
      scale: isDirection ? 0.95 + variation * 0.25 : 0.72 + variation * 0.42,
    }
  })
}

function ResourceBurst({ burst, overlayRef }: { burst: Burst; overlayRef: RefObject<HTMLSpanElement | null> }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <span
      ref={overlayRef}
      key={burst.id}
      className={`resource-counter-burst resource-counter-${burst.direction}`}
      style={{ left: burst.left, top: burst.top, width: burst.width, height: burst.height, transform: 'none' }}
      aria-hidden="true"
    >
      {burst.particles.map((particle, index) => {
        const style = {
          '--particle-x': `${particle.x}%`,
          '--particle-y': `${particle.y}%`,
          '--travel-x': `${particle.travelX}px`,
          '--travel-y': `${particle.travelY}px`,
          '--start-travel-x': `${particle.startTravelX}px`,
          '--start-travel-y': `${particle.startTravelY}px`,
          '--particle-delay': `${particle.delay}ms`,
          '--particle-duration': `${particle.duration}ms`,
          '--particle-rotation': `${particle.rotation}deg`,
          '--particle-end-rotation': `${particle.endRotation}deg`,
          '--particle-scale': `${particle.scale}`,
        } as CSSProperties

        return (
          <span className={`resource-counter-particle resource-counter-particle-${particle.kind}`} style={style} key={index}>
            {particle.kind === 'direction' ? (burst.direction === 'up' ? '🔺' : '🔻') : '✨'}
          </span>
        )
      })}
    </span>,
    document.body,
  )
}

const MemoizedResourceBurst = memo(ResourceBurst)

export function ResourceCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const displayed = useRef(value)
  const previousTarget = useRef(value)
  const sequence = useRef(0)
  const widgetRef = useRef<HTMLElement | null>(null)
  const burstRef = useRef<HTMLSpanElement | null>(null)
  const [frame, setFrame] = useState<CounterFrame>({ value, active: false })
  const [burst, setBurst] = useState<Burst | null>(null)

  useEffect(() => {
    const from = displayed.current
    const oldTarget = previousTarget.current
    const delta = Math.abs(value - oldTarget)
    const direction = value >= oldTarget ? 'up' : 'down'
    const animation = ++sequence.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0
    let followRequest = 0
    let burstTimer = 0

    previousTarget.current = value
    setBurst(null)

    if (!motion.matches && delta > 0) {
      const widget = widgetRef.current?.closest<HTMLElement>('.resource-widget') ?? widgetRef.current
      const rect = widget?.getBoundingClientRect()

      if (rect && rect.width > 0 && rect.height > 0) {
        const initialLeft = rect.left
        const initialTop = rect.top
        const initialWidth = rect.width
        const initialHeight = rect.height

        setBurst({
          id: animation,
          direction,
          left: initialLeft,
          top: initialTop,
          width: initialWidth,
          height: initialHeight,
          particles: createParticles(particleCount(delta), initialWidth, initialHeight, animation),
        })

        let lastLeft = initialLeft
        let lastTop = initialTop
        let lastWidth = initialWidth
        let lastHeight = initialHeight
        const followStartedAt = performance.now()
        const followWidget = (now: number) => {
          if (sequence.current !== animation) return

          const currentWidget = widgetRef.current?.closest<HTMLElement>('.resource-widget') ?? widgetRef.current
          const currentRect = currentWidget?.getBoundingClientRect()
          const overlay = burstRef.current

          if (overlay && currentRect && currentRect.width > 0 && currentRect.height > 0) {
            if (currentRect.left !== lastLeft || currentRect.top !== lastTop) {
              overlay.style.transform = `translate3d(${currentRect.left - initialLeft}px, ${currentRect.top - initialTop}px, 0)`
              lastLeft = currentRect.left
              lastTop = currentRect.top
            }
            if (currentRect.width !== lastWidth) {
              overlay.style.width = `${currentRect.width}px`
              lastWidth = currentRect.width
            }
            if (currentRect.height !== lastHeight) {
              overlay.style.height = `${currentRect.height}px`
              lastHeight = currentRect.height
            }
          }

          if (now - followStartedAt < duration) followRequest = window.requestAnimationFrame(followWidget)
        }

        followRequest = window.requestAnimationFrame(followWidget)
        burstTimer = window.setTimeout(() => {
          setBurst((current) => (current?.id === animation ? null : current))
        }, duration)
      }
    }

    if (motion.matches || from === value) {
      displayed.current = value
      setFrame((current) => (current.value === value && !current.active ? current : { value, active: false }))
      return () => {
        window.cancelAnimationFrame(followRequest)
        window.clearTimeout(burstTimer)
      }
    }

    const startedAt = performance.now()
    const advance = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      const nextValue = progress === 1 ? value : Math.round(from + (value - from) * eased)
      const active = progress < 1
      displayed.current = nextValue
      setFrame((current) => {
        if (sequence.current !== animation || (current.value === nextValue && current.active === active)) return current
        return { value: nextValue, active }
      })
      if (active) request = window.requestAnimationFrame(advance)
    }

    request = window.requestAnimationFrame(advance)
    return () => {
      window.cancelAnimationFrame(request)
      window.cancelAnimationFrame(followRequest)
      window.clearTimeout(burstTimer)
    }
  }, [value])

  return (
    <>
      <strong ref={widgetRef} className={`resource-count ${frame.active ? 'resource-count-changing' : ''}`} aria-label={`${prefix}${value.toLocaleString()}`}>
        <span aria-hidden="true">{prefix}{frame.value.toLocaleString()}</span>
      </strong>
      {burst && <MemoizedResourceBurst burst={burst} overlayRef={burstRef} />}
    </>
  )
}
