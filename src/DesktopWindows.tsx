import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { DragDropHintsProvider } from './DragDropHints'
import './DesktopWindows.css'

type Point = { x: number; y: number }
type Size = { width: number; height: number }
type WorkspaceState = {
  size: Size
  order: string[]
  register: (id: string) => void
  unregister: (id: string) => void
  raise: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)
const windowDefaults: Record<string, Size & Point> = {
  apply: { width: 650, height: 540, x: 0.5, y: 0.17 },
  offer: { width: 620, height: 440, x: 0.5, y: 0.22 },
  messenger: { width: 570, height: 560, x: 0.12, y: 0.1 },
  terminal: { width: 470, height: 500, x: 0.72, y: 0.3 },
  'terminal-2': { width: 470, height: 500, x: 0.26, y: 0.28 },
  shop: { width: 520, height: 440, x: 0.5, y: 0.14 },
  defeat: { width: 430, height: 330, x: 0.5, y: 0.28 },
}
const defaultWindow = { width: 520, height: 380, x: 0.5, y: 0.16 }
const arrowDirections: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

function clampPosition(point: Point, size: Size, workspace: Size): Point {
  return {
    x: Math.max(0, Math.min(point.x, workspace.width - size.width)),
    y: Math.max(0, Math.min(point.y, workspace.height - size.height)),
  }
}

export function WindowWorkspace({ className = '', children }: { className?: string; children: ReactNode }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [order, setOrder] = useState<string[]>([])

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      setSize((current) => current.width === width && current.height === height ? current : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const register = useCallback((id: string) => {
    setOrder((current) => current.includes(id) ? current : [...current, id])
  }, [])
  const unregister = useCallback((id: string) => {
    setOrder((current) => current.filter((item) => item !== id))
  }, [])
  const raise = useCallback((id: string) => {
    setOrder((current) => current.at(-1) === id ? current : [...current.filter((item) => item !== id), id])
  }, [])

  return (
    <DragDropHintsProvider>
      <WorkspaceContext.Provider value={{ size, order, register, unregister, raise }}>
        <div ref={elementRef} className={`windows ${className}`}>{children}</div>
      </WorkspaceContext.Provider>
    </DragDropHintsProvider>
  )
}

interface WindowFrameProps {
  id: string
  icon: string
  title: string
  active: boolean
  className?: string
  contentLayout?: 'padded' | 'fill'
  onFocus: () => void
  onMinimize: () => void
  children: ReactNode
  hidden?: boolean
}

type Drag = { pointerId: number; origin: Point; start: Point }

export function WindowFrame({ id, icon, title, active, className = '', contentLayout = 'padded', onFocus, onMinimize, children, hidden = false }: WindowFrameProps) {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('WindowFrame requires a WindowWorkspace')
  const { size: bounds, order, register, unregister, raise } = workspace
  const defaults = windowDefaults[id] ?? defaultWindow
  const size = { width: Math.min(defaults.width, bounds.width), height: Math.min(defaults.height, bounds.height) }
  const [savedPosition, setSavedPosition] = useState<Point | null>(null)
  // Derive bounds on resize rather than synchronizing a second copy in an effect.
  const position = clampPosition(savedPosition ?? {
    x: (bounds.width - size.width) * defaults.x,
    y: (bounds.height - size.height) * defaults.y,
  }, size, bounds)
  const windowRef = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  useLayoutEffect(() => {
    register(id)
    return () => unregister(id)
  }, [id, register, unregister])

  useLayoutEffect(() => {
    if (hidden || !active) return
    raise(id)
    if (!windowRef.current?.contains(document.activeElement)) {
      windowRef.current?.focus({ preventScroll: true })
    }
  }, [active, hidden, id, raise])

  const focus = () => {
    raise(id)
    onFocus()
  }
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    event.preventDefault()
    focus()
    event.currentTarget.focus({ preventScroll: true })
    drag.current = { pointerId: event.pointerId, origin: position, start: { x: event.clientX, y: event.clientY } }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    setSavedPosition(clampPosition({
      x: current.origin.x + event.clientX - current.start.x,
      y: current.origin.y + event.clientY - current.start.y,
    }, size, bounds))
  }
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const moveWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = arrowDirections[event.key]
    if (!direction) return
    event.preventDefault()
    const step = event.shiftKey ? 32 : 8
    focus()
    setSavedPosition(clampPosition({ x: position.x + direction.x * step, y: position.y + direction.y * step }, size, bounds))
  }

  return (
    <section
      id={`window-${id}`}
      ref={windowRef}
      tabIndex={-1}
      className={`window ${active ? 'window-active' : ''} ${className}`}
      style={{ width: size.width, height: size.height, left: position.x, top: position.y, zIndex: order.indexOf(id) + 1, visibility: bounds.width && bounds.height ? undefined : 'hidden' }}
      aria-labelledby={`window-heading-${id}`}
      hidden={hidden}
      data-dragging={dragging || undefined}
      onPointerDown={focus}
      onFocusCapture={focus}
    >
      <div className="window-chrome">
        <div className="window-lights" aria-hidden="true">
          <span className="window-light window-light-close" />
          <span className="window-light window-light-minimize" />
          <span className="window-light window-light-expand" />
        </div>
        <div
          className="window-title"
          id={`window-heading-${id}`}
          role="button"
          tabIndex={0}
          aria-label={`${title} window title bar`}
          aria-describedby={`window-instructions-${id}`}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onKeyDown={moveWithKeys}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <span aria-hidden="true">{icon}</span>
          <span>{title}</span>
          <span id={`window-instructions-${id}`} className="window-drag-instructions">
            Drag to move. Use arrow keys to move this window; hold Shift for larger steps.
          </span>
        </div>
        <button
          className="window-minimize"
          type="button"
          aria-label={`Minimize ${title} window`}
          onClick={(event) => { event.stopPropagation(); onMinimize() }}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>
      <div className={`window-content window-content-${contentLayout}`}>{children}</div>
    </section>
  )
}
