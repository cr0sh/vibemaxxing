import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { DragDropHintsProvider } from './DragDropHints'
import './DesktopWindows.css'

type Point = { x: number; y: number }
type Size = { width: number; height: number }
type Bounds = Size & Point
type WorkspaceState = {
  size: Size
  bounds: Bounds
  order: string[]
  focusRequest: number
  register: (id: string) => void
  unregister: (id: string) => void
  raise: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)
const windowDefaults: Record<string, Size & Point> = {
  apply: { width: 812.5, height: 540, x: 0.5, y: 0.17 },
  offer: { width: 930, height: 440, x: 0.5, y: 0.22 },
  messenger: { width: 855, height: 560, x: 0.12, y: 0.1 },
  terminal: { width: 900, height: 760, x: 0.72, y: 0.3 },
  'terminal-2': { width: 900, height: 760, x: 0.26, y: 0.28 },
  spark: { width: 705, height: 500, x: 0.8, y: 0.18 },
  market: { width: 960, height: 600, x: 0.5, y: 0.1 },
  shop: { width: 546, height: 686.4, x: 0.5, y: 0.14 },
  social: { width: 468, height: 600, x: 0.76, y: 0.12 },
  mercury: { width: 960, height: 600, x: 0.5, y: 0.12 },
  defeat: { width: 645, height: 330, x: 0.5, y: 0.28 },
}
const defaultWindow = { width: 780, height: 380, x: 0.5, y: 0.16 }
const arrowDirections: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}
const minimumWindowSize: Size = { width: 280, height: 180 }
const minimumWindowSizes: Record<string, Size> = {
  terminal: { width: 280, height: 320 },
  'terminal-2': { width: 280, height: 320 },
  spark: { width: 280, height: 320 },
}

function clampSize(candidate: Size, workspace: Size, minimum = minimumWindowSize): Size {
  const widthLimit = Math.max(0, workspace.width)
  const heightLimit = Math.max(0, workspace.height)
  return {
    width: widthLimit === 0 ? 0 : Math.min(widthLimit, Math.max(Math.min(minimum.width, widthLimit), Math.max(0, candidate.width))),
    height: heightLimit === 0 ? 0 : Math.min(heightLimit, Math.max(Math.min(minimum.height, heightLimit), Math.max(0, candidate.height))),
  }
}

function clampPosition(point: Point, size: Size, bounds: Bounds): Point {
  return {
    x: Math.max(bounds.x, Math.min(point.x, bounds.x + bounds.width - size.width)),
    y: Math.max(bounds.y, Math.min(point.y, bounds.y + bounds.height - size.height)),
  }
}

export function WindowWorkspace({ className = '', focusRequest = 0, children }: { className?: string; focusRequest?: number; children: ReactNode }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [{ size, bounds }, setGeometry] = useState<{ size: Size; bounds: Bounds }>({
    size: { width: 0, height: 0 },
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  })
  const [order, setOrder] = useState<string[]>([])
  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const width = element.clientWidth
      const height = element.clientHeight
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = window.innerHeight
      setGeometry((current) => (
        current.size.width === width && current.size.height === height &&
        current.bounds.x === -rect.left && current.bounds.y === -rect.top &&
        current.bounds.width === viewportWidth && current.bounds.height === viewportHeight
      ) ? current : {
        size: { width, height },
        bounds: { x: -rect.left, y: -rect.top, width: viewportWidth, height: viewportHeight },
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
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
      <WorkspaceContext.Provider value={{ size, bounds, order, focusRequest, register, unregister, raise }}>
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
type Resize = { pointerId: number; origin: Size; position: Point; start: Point }

export function WindowFrame({ id, icon, title, active, className = '', contentLayout = 'padded', onFocus, onMinimize, children, hidden = false }: WindowFrameProps) {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('WindowFrame requires a WindowWorkspace')
  const { size: workspaceSize, bounds, order, focusRequest, register, unregister, raise } = workspace
  const defaults = windowDefaults[id] ?? defaultWindow
  const minimumSize = minimumWindowSizes[id] ?? minimumWindowSize
  const [savedSize, setSavedSize] = useState<Size | null>(null)
  const size = clampSize(
    savedSize ?? defaults,
    savedSize || !workspaceSize.width || !workspaceSize.height ? bounds : workspaceSize,
    minimumSize,
  )
  const [savedPosition, setSavedPosition] = useState<Point | null>(null)
  // Derive bounds on resize rather than synchronizing a second copy in an effect.
  const position = clampPosition(savedPosition ?? {
    x: (workspaceSize.width - size.width) * defaults.x,
    y: (workspaceSize.height - size.height) * defaults.y,
  }, size, bounds)
  const windowRef = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const resize = useRef<Resize | null>(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [entering, setEntering] = useState(true)

  useLayoutEffect(() => {
    register(id)
    return () => unregister(id)
  }, [id, register, unregister])

  useLayoutEffect(() => {
    if (hidden) return
    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setEntering(false)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [hidden])

  useLayoutEffect(() => {
    if (hidden || !active) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      raise(id)
      if (!windowRef.current?.contains(document.activeElement)) {
        windowRef.current?.focus({ preventScroll: true })
      }
    })
    return () => {
      cancelled = true
    }
  }, [active, focusRequest, hidden, id, raise])

  const focus = () => {
    raise(id)
    onFocus()
  }
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current || resize.current) return
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
    if ((event.type === 'lostpointercapture' && event.target !== event.currentTarget) || drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current || resize.current) return
    event.preventDefault()
    event.stopPropagation()
    focus()
    event.currentTarget.focus({ preventScroll: true })
    setSavedPosition(position)
    resize.current = { pointerId: event.pointerId, origin: size, position, start: { x: event.clientX, y: event.clientY } }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
  }
  const moveResize = (event: PointerEvent<HTMLButtonElement>) => {
    const current = resize.current
    if (!current || current.pointerId !== event.pointerId) return
    setSavedSize(clampSize({
      width: current.origin.width + event.clientX - current.start.x,
      height: current.origin.height + event.clientY - current.start.y,
    }, {
      width: bounds.x + bounds.width - current.position.x,
      height: bounds.y + bounds.height - current.position.y,
    }, minimumSize))
  }
  const endResize = (event: PointerEvent<HTMLButtonElement>) => {
    if ((event.type === 'lostpointercapture' && event.target !== event.currentTarget) || resize.current?.pointerId !== event.pointerId) return
    resize.current = null
    setResizing(false)
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
  const resizeWithKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = arrowDirections[event.key]
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    const step = event.shiftKey ? 32 : 8
    focus()
    setSavedPosition(position)
    setSavedSize(clampSize(
      { width: size.width + direction.x * step, height: size.height + direction.y * step },
      { width: bounds.x + bounds.width - position.x, height: bounds.y + bounds.height - position.y },
      minimumSize,
    ))
  }

  return (
    <section
      id={`window-${id}`}
      ref={windowRef}
      tabIndex={-1}
      className={`window ${active ? 'window-active' : ''} ${entering ? 'window-entering' : ''} ${className}`}
      style={{ width: size.width, height: size.height, left: position.x, top: position.y, zIndex: order.indexOf(id) + 1, visibility: bounds.width && bounds.height ? undefined : 'hidden' }}
      aria-labelledby={`window-heading-${id}`}
      hidden={hidden}
      data-dragging={dragging || undefined}
      data-resizing={resizing || undefined}
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
          onClick={(event) => { event.stopPropagation(); setEntering(true); onMinimize() }}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>
      <div className={`window-content window-content-${contentLayout}`}>{children}</div>
      <button
        className="window-resize-handle"
        type="button"
        aria-label={`Resize ${title} window`}
        aria-describedby={`window-resize-instructions-${id}`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        onKeyDown={resizeWithKeys}
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onLostPointerCapture={endResize}
      >
        <span aria-hidden="true" />
      </button>
      <span id={`window-resize-instructions-${id}`} className="window-drag-instructions">
        Drag the lower-right corner to resize. Use arrow keys to resize this window; hold Shift for larger steps.
      </span>
    </section>
  )
}
