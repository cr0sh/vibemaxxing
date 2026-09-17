import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type {
  DragEvent,
  FocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent,
  RefObject,
} from 'react'

export type DragDropSourceKind = 'task' | 'artifact' | 'upgrade'

export type DragDropSource = Readonly<{
  kind: DragDropSourceKind
  id: string
}>

export type DragDropState = Readonly<{
  source: DragDropSource | null
  dragging: boolean
}>

type DragDropTargetDefinition = Readonly<{
  id: string
  priority?: number
  accepts: (source: DragDropSource) => boolean
  onDrop: (source: DragDropSource) => void
  onHover?: () => void
}>

type DragDropTarget = DragDropTargetDefinition & {
  element: HTMLElement
}


export type DragDropContextValue = DragDropState & {
  beginSource: (source: DragDropSource) => void
  leaveSource: (source: DragDropSource) => void
  disposeSource: (source: DragDropSource) => void
  startDrag: (source: DragDropSource) => void
  endDrag: () => void
  clear: () => void
  isSourceActive: (kind: DragDropSourceKind, id?: string) => boolean
  beginPointerDrag: (source: DragDropSource, pointerId: number, x: number, y: number, element: HTMLElement) => void
  cancelPointerDrag: (pointerId?: number) => void
  registerDropTarget: (target: DragDropTarget) => () => void
}

export const DragDropHintsContext = createContext<DragDropContextValue | null>(null)

export function isSameDragDropSource(left: DragDropSource | null, right: DragDropSource): boolean {
  return left?.kind === right.kind && left.id === right.id
}

export function useDragDropHints(): DragDropContextValue {
  const context = useContext(DragDropHintsContext)
  if (!context) throw new Error('useDragDropHints requires a DragDropHintsProvider')
  return context
}

export function useDragDropTarget<T extends HTMLElement>(
  ref: RefObject<T | null>,
  target: DragDropTargetDefinition,
): void {
  const { registerDropTarget } = useDragDropHints()
  const targetRef = useRef(target)
  useLayoutEffect(() => {
    targetRef.current = target
  })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    return registerDropTarget({
      id: target.id,
      priority: target.priority,
      element,
      accepts: (source) => targetRef.current.accepts(source),
      onDrop: (source) => targetRef.current.onDrop(source),
      onHover: () => targetRef.current.onHover?.(),
    })
  }, [ref, registerDropTarget, target.id, target.priority])
}

export function useDragDropSource(source: DragDropSource, enabled: boolean) {
  const {
    beginSource,
    leaveSource,
    disposeSource,
    startDrag,
    endDrag,
    clear,
    beginPointerDrag,
    cancelPointerDrag,
  } = useDragDropHints()
  const stableSource = useMemo(() => ({ kind: source.kind, id: source.id }), [source.kind, source.id])

  useEffect(() => {
    if (!enabled) leaveSource(stableSource)
    return () => disposeSource(stableSource)
  }, [disposeSource, enabled, leaveSource, stableSource])

  const begin = useCallback(() => {
    if (enabled) beginSource(stableSource)
  }, [beginSource, enabled, stableSource])
  const leave = useCallback(() => {
    if (enabled) leaveSource(stableSource)
  }, [enabled, leaveSource, stableSource])
  const onFocus = useCallback(() => begin(), [begin])
  const onMouseEnter = useCallback(() => begin(), [begin])
  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leave()
  }, [leave])
  const onMouseLeave = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leave()
  }, [leave])
  const onDragStart = useCallback((_event: DragEvent<HTMLElement>) => {
    if (enabled) startDrag(stableSource)
  }, [enabled, stableSource, startDrag])
  const onDragEnd = useCallback(() => {
    if (enabled) endDrag()
  }, [enabled, endDrag])
  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') clear()
  }, [clear])
  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (
      !enabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.pointerType === 'mouse' ||
      (event.target instanceof HTMLElement && event.target.closest('button, a, input, textarea, select'))
    ) return
    beginPointerDrag(stableSource, event.pointerId, event.clientX, event.clientY, event.currentTarget)
  }, [beginPointerDrag, enabled, stableSource])
  const onPointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    cancelPointerDrag(event.pointerId)
  }, [cancelPointerDrag])
  const onLostPointerCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      cancelPointerDrag(event.pointerId)
    }
  }, [cancelPointerDrag])
  return {
    onFocus,
    onBlur,
    onMouseEnter,
    onMouseLeave,
    onKeyDown,
    onDragStart,
    onDragEnd,
    onPointerDown,
    onPointerCancel,
    onLostPointerCapture,
  }
}
