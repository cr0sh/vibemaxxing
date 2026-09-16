import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DragDropHintsContext,
  isSameDragDropSource,
} from './DragDropHintsContext'
import type { DragDropContextValue, DragDropSource, DragDropState } from './DragDropHintsContext'
import './DragDropHints.css'

export function DragDropHintsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DragDropState>({ source: null, dragging: false })

  const clear = useCallback(() => setState({ source: null, dragging: false }), [])
  const beginSource = useCallback((source: DragDropSource) => {
    setState({ source, dragging: false })
  }, [])
  const leaveSource = useCallback((source: DragDropSource) => {
    setState((current) => current.dragging || !isSameDragDropSource(current.source, source) ? current : { source: null, dragging: false })
  }, [])
  const disposeSource = useCallback((source: DragDropSource) => {
    setState((current) => isSameDragDropSource(current.source, source) ? { source: null, dragging: false } : current)
  }, [])
  const startDrag = useCallback((source: DragDropSource) => {
    setState({ source, dragging: true })
  }, [])
  const endDrag = useCallback(() => setState({ source: null, dragging: false }), [])
  const isSourceActive = useCallback((kind: DragDropSource['kind'], id?: string) => (
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

  return <DragDropHintsContext.Provider value={value}>{children}</DragDropHintsContext.Provider>
}

export function DragDropHint({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null
  return <div className="drag-drop-hint" role="status" aria-live="polite" aria-hidden="true">{children}</div>
}
