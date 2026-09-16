import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import type { DragEvent, FocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from 'react'

export type DragDropSourceKind = 'task' | 'artifact' | 'upgrade'

export type DragDropSource = Readonly<{
  kind: DragDropSourceKind
  id: string
}>

export type DragDropState = Readonly<{
  source: DragDropSource | null
  dragging: boolean
}>

export type DragDropContextValue = DragDropState & {
  beginSource: (source: DragDropSource) => void
  leaveSource: (source: DragDropSource) => void
  disposeSource: (source: DragDropSource) => void
  startDrag: (source: DragDropSource) => void
  endDrag: () => void
  clear: () => void
  isSourceActive: (kind: DragDropSourceKind, id?: string) => boolean
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

export function useDragDropSource(source: DragDropSource, enabled: boolean) {
  const { beginSource, leaveSource, disposeSource, startDrag, endDrag, clear } = useDragDropHints()
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
  return { onFocus, onBlur, onMouseEnter, onMouseLeave, onDragStart, onDragEnd, onKeyDown }
}
