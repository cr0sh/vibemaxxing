import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import './DesktopWindows.css'

type WindowPoint = { x: number; y: number }
type WindowSize = { width: number; height: number }
type WorkspaceSize = WindowSize

type WindowDefaults = WindowSize

type WindowLayout = {
  position: WindowPoint | null
  size: WindowSize | null
}

type WorkspaceContextValue = {
  size: WorkspaceSize
  getZIndex: (id: string) => number
  register: (id: string) => void
  unregister: (id: string) => void
  raise: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const DEFAULT_WINDOW: WindowDefaults = { width: 520, height: 380 }
const WINDOW_DEFAULTS: Record<string, WindowDefaults> = {
  apply: { width: 650, height: 540 },
  offer: { width: 620, height: 440 },
  messenger: { width: 570, height: 440 },
  terminal: { width: 470, height: 320 },
}

const WINDOW_OFFSETS: Record<string, WindowPoint> = {
  apply: { x: 0.5, y: 0.17 },
  offer: { x: 0.5, y: 0.22 },
  messenger: { x: 0.12, y: 0.1 },
  terminal: { x: 0.58, y: 0.22 },
}

function getWindowDefaults(id: string): WindowDefaults {
  return WINDOW_DEFAULTS[id] ?? DEFAULT_WINDOW
}

const KEYBOARD_MOVEMENT: Record<string, WindowPoint> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

function fitWindowSize(defaults: WindowDefaults, workspace: WorkspaceSize): WindowSize {
  return {
    width: Math.max(0, Math.min(defaults.width, workspace.width)),
    height: Math.max(0, Math.min(defaults.height, workspace.height)),
  }
}

function clampWindowPosition(position: WindowPoint, size: WindowSize, workspace: WorkspaceSize): WindowPoint {
  return {
    x: clamp(position.x, 0, workspace.width - size.width),
    y: clamp(position.y, 0, workspace.height - size.height),
  }
}

function getInitialPosition(id: string, size: WindowSize, workspace: WorkspaceSize): WindowPoint {
  const offset = WINDOW_OFFSETS[id] ?? { x: 0.5, y: 0.16 }
  const availableX = Math.max(0, workspace.width - size.width)
  const availableY = Math.max(0, workspace.height - size.height)
  return clampWindowPosition(
    {
      x: availableX * offset.x,
      y: availableY * offset.y,
    },
    size,
    workspace,
  )
}

function samePoint(first: WindowPoint, second: WindowPoint) {
  return first.x === second.x && first.y === second.y
}

function sameSize(first: WindowSize, second: WindowSize) {
  return first.width === second.width && first.height === second.height
}

function isInteractiveTarget(target: EventTarget | null, currentTarget: EventTarget) {
  if (!(target instanceof Element)) return false
  const interactive = target.closest(
    'button, a, input, textarea, select, option, summary, [contenteditable="true"], [data-window-no-drag]',
  )
  return Boolean(interactive && interactive !== currentTarget)
}

function useWorkspaceContext() {
  return useContext(WorkspaceContext)
}


export function WindowWorkspace({ className, children }: { className?: string; children: ReactNode }) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<WorkspaceSize>({ width: 0, height: 0 })
  const zOrder = useRef(new Map<string, number>())
  const nextZIndex = useRef(1)
  const [stackVersion, setStackVersion] = useState(0)

  useLayoutEffect(() => {
    const element = workspaceRef.current
    if (!element) return

    const updateSize = () => {
      const nextSize = { width: element.clientWidth, height: element.clientHeight }
      setSize((current) => (sameSize(current, nextSize) ? current : nextSize))
    }

    updateSize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const register = useCallback((id: string) => {
    if (zOrder.current.has(id)) return
    zOrder.current.set(id, nextZIndex.current)
    nextZIndex.current += 1
    setStackVersion((version) => version + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    if (!zOrder.current.delete(id)) return
    setStackVersion((version) => version + 1)
  }, [])

  const raise = useCallback((id: string) => {
    const current = zOrder.current.get(id)
    if (current === undefined) return
    const highest = Math.max(...zOrder.current.values(), 0)
    if (current === highest) return
    zOrder.current.set(id, nextZIndex.current)
    nextZIndex.current += 1
    setStackVersion((version) => version + 1)
  }, [])

  const getZIndex = useCallback(
    (id: string) => zOrder.current.get(id) ?? 1,
    // Reading the version makes this callback change when a window is raised,
    // which gives frames a render with their new stacking order.
    [stackVersion],
  )

  const contextValue = useMemo(
    () => ({ size, getZIndex, register, unregister, raise }),
    [getZIndex, raise, register, size, unregister],
  )

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div ref={workspaceRef} className={className ? `windows ${className}` : 'windows'}>
        {children}
      </div>
    </WorkspaceContext.Provider>
  )
}

export interface WindowFrameProps {
  id: string
  icon: string
  title: string
  active: boolean
  className?: string
  onFocus: () => void
  onMinimize: () => void
  children: ReactNode
  hidden?: boolean
}

type DragState = {
  pointerId: number
  origin: WindowPoint
  startX: number
  startY: number
}

export function WindowFrame({
  id,
  icon,
  title,
  active,
  className = '',
  onFocus,
  onMinimize,
  children,
  hidden = false,
}: WindowFrameProps) {
  const workspace = useWorkspaceContext()
  const workspaceSize = workspace?.size
  const register = workspace?.register
  const unregister = workspace?.unregister
  const raise = workspace?.raise
  const headingId = `window-heading-${id}`
  const instructionsId = `window-instructions-${id}`
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [layout, setLayout] = useState<WindowLayout>({ position: null, size: null })
  const defaults = getWindowDefaults(id)

  useEffect(() => {
    register?.(id)
    return () => {
      unregister?.(id)
    }
  }, [id, register, unregister])

  useEffect(() => {
    if (active) raise?.(id)
  }, [active, id, raise])

  useLayoutEffect(() => {
    if (!workspaceSize || workspaceSize.width <= 0 || workspaceSize.height <= 0) return

    const nextSize = fitWindowSize(defaults, workspaceSize)
    setLayout((current) => {
      const nextPosition = clampWindowPosition(
        current.position ?? getInitialPosition(id, nextSize, workspaceSize),
        nextSize,
        workspaceSize,
      )
      if (
        current.size &&
        current.position &&
        sameSize(current.size, nextSize) &&
        samePoint(current.position, nextPosition)
      ) {
        return current
      }
      return { size: nextSize, position: nextPosition }
    })
  }, [defaults, id, workspaceSize?.height, workspaceSize?.width])

  const focusWindow = useCallback(() => {
    raise?.(id)
    onFocus()
  }, [id, onFocus, raise])

  const setPosition = useCallback(
    (nextPosition: WindowPoint) => {
      if (!workspaceSize) return
      setLayout((current) => {
        const size = current.size ?? fitWindowSize(defaults, workspaceSize)
        return {
          ...current,
          size,
          position: clampWindowPosition(nextPosition, size, workspaceSize),
        }
      })
    },
    [defaults, workspaceSize?.height, workspaceSize?.width],
  )

  const moveByKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const movement = KEYBOARD_MOVEMENT[event.key]
      if (!movement) return

      event.preventDefault()
      const step = event.shiftKey ? 32 : 8
      const current =
        layout.position ??
        (workspaceSize
          ? getInitialPosition(id, layout.size ?? fitWindowSize(defaults, workspaceSize), workspaceSize)
          : { x: 0, y: 0 })
      focusWindow()
      setPosition({ x: current.x + movement.x * step, y: current.y + movement.y * step })
    },
    [
      defaults,
      focusWindow,
      id,
      layout.position,
      layout.size,
      setPosition,
      workspaceSize?.height,
      workspaceSize?.width,
    ],
  )

  const finishPointerDrag = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || (event && event.pointerId !== drag.pointerId)) return
    dragRef.current = null
    setDragging(false)
    if (event?.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId)
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
      if (isInteractiveTarget(event.target, event.currentTarget)) return

      event.preventDefault()
      focusWindow()
      event.currentTarget.focus({ preventScroll: true })
      const origin =
        layout.position ??
        (workspaceSize
          ? getInitialPosition(id, layout.size ?? fitWindowSize(defaults, workspaceSize), workspaceSize)
          : { x: 0, y: 0 })
      dragRef.current = {
        pointerId: event.pointerId,
        origin,
        startX: event.clientX,
        startY: event.clientY,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
    },
    [defaults, focusWindow, id, layout.position, layout.size, workspaceSize?.height, workspaceSize?.width],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      event.preventDefault()
      setPosition({
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      })
    },
    [setPosition],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => finishPointerDrag(event),
    [finishPointerDrag],
  )

  const handleTitleFocus = useCallback(() => focusWindow(), [focusWindow])

  const position = layout.position
  const style: CSSProperties = {
    ...(layout.size ? { width: `${layout.size.width}px`, height: `${layout.size.height}px` } : {}),
    ...(position ? { left: `${position.x}px`, top: `${position.y}px` } : {}),
    zIndex: workspace?.getZIndex(id) ?? 1,
  }
  return (
    <section
      id={`window-${id}`}
      tabIndex={-1}
      className={`window ${active ? 'window-active' : ''} ${className}`}
      style={style}
      aria-labelledby={headingId}
      aria-hidden={hidden || undefined}
      hidden={hidden}
      data-dragging={dragging || undefined}
      onPointerDown={focusWindow}
      onFocusCapture={handleTitleFocus}
    >
      <div className="window-chrome">
        <div className="window-lights" aria-hidden="true">
          <span className="window-light window-light-close" />
          <span className="window-light window-light-minimize" />
          <span className="window-light window-light-expand" />
        </div>
        <div
          className="window-title"
          id={headingId}
          role="button"
          tabIndex={0}
          aria-label={`${title} window title bar`}
          aria-describedby={instructionsId}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onKeyDown={moveByKeyboard}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          <span aria-hidden="true">{icon}</span>
          <span>{title}</span>
          <span id={instructionsId} className="window-drag-instructions">
            Drag to move. Use arrow keys to move this window; hold Shift for larger steps.
          </span>
        </div>
        <button
          className="window-minimize"
          type="button"
          aria-label={`Minimize ${title} window`}
          data-window-no-drag="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onMinimize()
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>
      <div className="window-content">{children}</div>
    </section>
  )
}
