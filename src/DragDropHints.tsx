import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { DragEvent, FocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from 'react'
import './DragDropHints.css'

export type DragDropSourceKind = 'task' | 'artifact' | 'upgrade'

export type DragDropSource = Readonly<{
  kind: DragDropSourceKind
  id: string
}>

type DragDropState = Readonly<{
  source: DragDropSource | null
  dragging: boolean
}>

type DragDropContextValue = DragDropState & {
  beginSource: (source: DragDropSource) => void
  leaveSource: (source: DragDropSource) => void
  disposeSource: (source: DragDropSource) => void
  startDrag: (source: DragDropSource) => void
  endDrag: () => void
  clear: () => void
  isSourceActive: (kind: DragDropSourceKind, id?: string) => boolean
}

const DragDropContext = createContext<DragDropContextValue | null>(null)

const sameSource = (left: DragDropSource | null, right: DragDropSource): boolean => (
  left?.kind === right.kind && left.id === right.id
)

export function DragDropHintsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DragDropState>({ source: null, dragging: false })

  const clear = useCallback(() => setState({ source: null, dragging: false }), [])
  const beginSource = useCallback((source: DragDropSource) => {
    setState({ source, dragging: false })
  }, [])
  const leaveSource = useCallback((source: DragDropSource) => {
    setState((current) => current.dragging || !sameSource(current.source, source) ? current : { source: null, dragging: false })
  }, [])
  const disposeSource = useCallback((source: DragDropSource) => {
    setState((current) => sameSource(current.source, source) ? { source: null, dragging: false } : current)
  }, [])
  const startDrag = useCallback((source: DragDropSource) => {
    setState({ source, dragging: true })
  }, [])
  const endDrag = useCallback(() => setState({ source: null, dragging: false }), [])
  const isSourceActive = useCallback((kind: DragDropSourceKind, id?: string) => (
    state.source?.kind === kind && (id === undefined || state.source.id === id)
  ), [state.source])

  useEffect(() => {
    const clearOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') clear()
    }
    const clearOnNativeEnd = () => clear()
    window.addEventListener('keydown', clearOnEscape)
    window.addEventListener('dragend', clearOnNativeEnd, true)
    window.addEventListener('drop', clearOnNativeEnd, true)
    return () => {
      window.removeEventListener('keydown', clearOnEscape)
      window.removeEventListener('dragend', clearOnNativeEnd, true)
      window.removeEventListener('drop', clearOnNativeEnd, true)
    }
  }, [clear])

  const value = useMemo<DragDropContextValue>(() => ({
    ...state,
    beginSource,
    leaveSource,
    disposeSource,
    startDrag,
    endDrag,
    clear,
    isSourceActive,
  }), [beginSource, clear, disposeSource, endDrag, isSourceActive, leaveSource, startDrag, state])

  return <DragDropContext.Provider value={value}>{children}</DragDropContext.Provider>
}

export function useDragDropHints(): DragDropContextValue {
  const context = useContext(DragDropContext)
  if (!context) throw new Error('useDragDropHints requires a DragDropHintsProvider')
  return context
}

export function useDragDropSource(source: DragDropSource, enabled: boolean) {
  const { beginSource, leaveSource, disposeSource, startDrag, endDrag, clear } = useDragDropHints()

  useEffect(() => {
    if (!enabled) leaveSource(source)
    return () => disposeSource(source)
  }, [disposeSource, enabled, leaveSource, source.kind, source.id])

  const begin = useCallback(() => {
    if (enabled) beginSource(source)
  }, [beginSource, enabled, source])
  const leave = useCallback(() => {
    if (enabled) leaveSource(source)
  }, [enabled, leaveSource, source])
  const onFocus = useCallback(() => begin(), [begin])
  const onMouseEnter = useCallback(() => begin(), [begin])
  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leave()
  }, [leave])
  const onMouseLeave = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leave()
  }, [leave])
  const onDragStart = useCallback((_event: DragEvent<HTMLElement>) => {
    if (enabled) startDrag(source)
  }, [enabled, source, startDrag])
  const onDragEnd = useCallback(() => {
    if (enabled) endDrag()
  }, [enabled, endDrag])
  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') clear()
  }, [clear])
  return { onFocus, onBlur, onMouseEnter, onMouseLeave, onDragStart, onDragEnd, onKeyDown }
}

export function DragDropHint({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null
  return <div className="drag-drop-hint" role="status" aria-live="polite" aria-hidden="true">{children}</div>
}
