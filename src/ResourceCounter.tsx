import { memo, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAnimatedNumber } from './useAnimatedNumber'
import { useI18n } from './i18n'
import './ResourceCounter.css'

const duration = 650
const minimumParticles = 3
const maximumParticles = 20

type Particle = {
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

  return Math.min(maximumParticles, Math.max(minimumParticles, 3 + Math.ceil(Math.log10(delta + 1) * 3.3)))
}

function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function createParticles(count: number, width: number, height: number, id: number) {
  const perimeter = 2 * (width + height)

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
    const rotation = Math.round((variation - 0.5) * 40)

    return {
      x: (x / width) * 100,
      y: (y / height) * 100,
      travelX: Math.round((normalX + (normalY === 0 ? 0 : tangent)) * travel),
      travelY: Math.round((normalY + (normalX === 0 ? tangent : 0)) * travel),
      startTravelX: Math.round((normalX + (normalY === 0 ? 0 : tangent)) * travel * 0.18),
      startTravelY: Math.round((normalY + (normalX === 0 ? tangent : 0)) * travel * 0.18),
      delay: Math.round(variation * 90),
      duration: duration - Math.round(variation * 90),
      rotation,
      endRotation: rotation + Math.round((variation - 0.5) * 100),
      scale: 0.72 + variation * 0.42,
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
          <span className="resource-counter-particle resource-counter-particle-sparkle" style={style} key={index}>
            ✨
          </span>
        )
      })}
    </span>,
    document.body,
  )
}

const MemoizedResourceBurst = memo(ResourceBurst)

export function ResourceCounter({
  value,
  prefix = '',
  formatter,
}: {
  value: number
  prefix?: string
  formatter?: Intl.NumberFormat
}) {
  const { formatNumber } = useI18n()
  const animated = useAnimatedNumber(value)
  const previousTarget = useRef(value)
  const sequence = useRef(0)
  const widgetRef = useRef<HTMLElement | null>(null)
  const burstRef = useRef<HTMLSpanElement | null>(null)
  const [burst, setBurst] = useState<Burst | null>(null)

  useEffect(() => {
    const oldTarget = previousTarget.current
    const delta = Math.abs(value - oldTarget)
    const direction = value >= oldTarget ? 'up' : 'down'
    const animation = ++sequence.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let setupRequest = 0
    let followRequest = 0
    let burstTimer = 0

    previousTarget.current = value

    const setupBurst = () => {
      if (sequence.current !== animation) return

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
    }

    setupRequest = window.requestAnimationFrame(setupBurst)
    return () => {
      window.cancelAnimationFrame(setupRequest)
      window.cancelAnimationFrame(followRequest)
      window.clearTimeout(burstTimer)
    }
  }, [value])

  const renderedValue = animated.value === undefined ? value :
    animated.active ? Math.round(animated.value) : animated.value
  const directionIcon = animated.active && animated.direction === 'up' ? '▲' :
    animated.active && animated.direction === 'down' ? '▼' : ''

  return (
    <>
      <strong ref={widgetRef} className={`resource-count ${animated.active ? 'resource-count-changing' : ''}`} aria-label={`${prefix}${formatNumber(value)}`}>
        <span aria-hidden="true">{prefix}{formatter ? formatter.format(renderedValue) : formatNumber(renderedValue)}</span>
        <span className="resource-count-direction" aria-hidden="true">{directionIcon}</span>
      </strong>
      {burst && <MemoizedResourceBurst burst={burst} overlayRef={burstRef} />}
    </>
  )
}

