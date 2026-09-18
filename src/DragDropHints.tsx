import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DragDropHintsContext,
  isSameDragDropSource,
} from './DragDropHintsContext'
import type { DragDropContextValue, DragDropSource, DragDropState } from './DragDropHintsContext'
import './DragDropHints.css'

type PointerGesture = {
  source: DragDropSource
  pointerId: number
  startX: number
  startY: number
  element: HTMLElement
  dragging: boolean
  targetId: string | null
}

type RegisteredTarget = {
  id: string
  priority?: number
  element: HTMLElement
  accepts: (source: DragDropSource) => boolean
  rejectionReason?: (source: DragDropSource) => string | null
  onDrop: (source: DragDropSource) => void
  onReject?: (reason: string) => void
  onHover?: () => void
}

const pointerDragThreshold = 8

export function DragDropHintsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DragDropState>({ source: null, dragging: false })
  const pointerRef = useRef<PointerGesture | null>(null)
  const targetsRef = useRef(new Map<string, RegisteredTarget>())

  const clear = useCallback(() => {
    const pointer = pointerRef.current
    pointerRef.current = null
    if (pointer?.dragging && pointer.element.hasPointerCapture(pointer.pointerId)) {
      pointer.element.releasePointerCapture(pointer.pointerId)
    }
    setState({ source: null, dragging: false })
  }, [])
  const beginSource = useCallback((source: DragDropSource) => {
    setState({ source, dragging: false })
  }, [])
  const leaveSource = useCallback((source: DragDropSource) => {
    setState((current) => current.dragging || !isSameDragDropSource(current.source, source) ? current : { source: null, dragging: false })
  }, [])
  const disposeSource = useCallback((source: DragDropSource) => {
    if (isSameDragDropSource(pointerRef.current?.source ?? null, source)) {
      clear()
      return
    }
    setState((current) => isSameDragDropSource(current.source, source) ? { source: null, dragging: false } : current)
  }, [clear])
  const startDrag = useCallback((source: DragDropSource) => {
    setState({ source, dragging: true })
  }, [])
  const endDrag = useCallback(() => clear(), [clear])
  const isSourceActive = useCallback((kind: DragDropSource['kind'], id?: string) => (
    state.source?.kind === kind && (id === undefined || state.source.id === id)
  ), [state.source])
  const registerDropTarget = useCallback((target: RegisteredTarget) => {
    targetsRef.current.set(target.id, target)
    return () => {
      if (targetsRef.current.get(target.id) === target) targetsRef.current.delete(target.id)
    }
  }, [])
  const findTarget = useCallback((source: DragDropSource, x: number, y: number): RegisteredTarget | null => {
    let best: RegisteredTarget | null = null
    let bestZIndex = -Infinity
    let bestPriority = -Infinity
    let bestArea = Infinity
    const hitElements = document.elementsFromPoint(x, y)
    for (const target of targetsRef.current.values()) {
      if (!target.element.isConnected || !hitElements.includes(target.element)) continue
      const accepted = target.accepts(source)
      const rejectionReason = accepted ? null : target.rejectionReason?.(source) ?? null
      if (!accepted && (!target.onReject || rejectionReason === null)) continue
      const bounds = target.element.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0 || x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue
      const computedZIndex = Number.parseInt(window.getComputedStyle(target.element.closest('.window') ?? target.element).zIndex, 10)
      const zIndex = Number.isFinite(computedZIndex) ? computedZIndex : 0
      const priority = target.priority ?? 0
      const area = bounds.width * bounds.height
      if (
        zIndex > bestZIndex ||
        (zIndex === bestZIndex && priority > bestPriority) ||
        (zIndex === bestZIndex && priority === bestPriority && area < bestArea)
      ) {
        best = target
        bestZIndex = zIndex
        bestPriority = priority
        bestArea = area
      }
    }
    return best
  }, [])
  const updateTarget = useCallback((pointer: PointerGesture, x: number, y: number) => {
    const target = findTarget(pointer.source, x, y)
    if (target?.id === pointer.targetId) return
    pointer.targetId = target?.id ?? null
    target?.onHover?.()
  }, [findTarget])
  const beginPointerDrag = useCallback((source: DragDropSource, pointerId: number, x: number, y: number, element: HTMLElement) => {
    if (pointerRef.current) return
    pointerRef.current = { source, pointerId, startX: x, startY: y, element, dragging: false, targetId: null }
  }, [])
  const cancelPointerDrag = useCallback((pointerId?: number) => {
    if (pointerId !== undefined && pointerRef.current?.pointerId !== pointerId) return
    clear()
  }, [clear])

  useEffect(() => {
    const clearOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') clear()
    }
    const clearOnNativeEnd = () => clear()
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const pointer = pointerRef.current
      if (!pointer || pointer.pointerId !== event.pointerId) return
      if (!pointer.dragging) {
        const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
        if (distance < pointerDragThreshold) return
        pointer.dragging = true
        event.preventDefault()
        pointer.element.setPointerCapture(pointer.pointerId)
        startDrag(pointer.source)
      } else {
        event.preventDefault()
      }
      updateTarget(pointer, event.clientX, event.clientY)
    }
    const finishPointer = (event: globalThis.PointerEvent, cancelled: boolean) => {
      const pointer = pointerRef.current
      if (!pointer || pointer.pointerId !== event.pointerId) return
      if (!cancelled && pointer.dragging) {
        updateTarget(pointer, event.clientX, event.clientY)
        const target = pointer.targetId ? targetsRef.current.get(pointer.targetId) : null
        if (target?.accepts(pointer.source)) {
          target.onDrop(pointer.source)
        } else {
          const reason = target?.rejectionReason?.(pointer.source)
          if (reason !== null && reason !== undefined) target?.onReject?.(reason)
        }
      }
      clear()
    }
    const handlePointerUp = (event: globalThis.PointerEvent) => finishPointer(event, false)
    const handlePointerCancel = (event: globalThis.PointerEvent) => finishPointer(event, true)
    const handleLostPointerCapture = (event: globalThis.PointerEvent) => {
      const pointer = pointerRef.current
      if (pointer && event.target === pointer.element && !pointer.element.hasPointerCapture(event.pointerId)) {
        finishPointer(event, true)
      }
    }
    window.addEventListener('keydown', clearOnEscape)
    window.addEventListener('dragend', clearOnNativeEnd, true)
    window.addEventListener('drop', clearOnNativeEnd, true)
    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', handlePointerUp, true)
    window.addEventListener('pointercancel', handlePointerCancel, true)
    window.addEventListener('lostpointercapture', handleLostPointerCapture, true)
    return () => {
      window.removeEventListener('keydown', clearOnEscape)
      window.removeEventListener('dragend', clearOnNativeEnd, true)
      window.removeEventListener('drop', clearOnNativeEnd, true)
      window.removeEventListener('pointermove', handlePointerMove, true)
      window.removeEventListener('pointerup', handlePointerUp, true)
      window.removeEventListener('pointercancel', handlePointerCancel, true)
      window.removeEventListener('lostpointercapture', handleLostPointerCapture, true)
      clear()
    }
  }, [clear, startDrag, updateTarget])

  const value = useMemo<DragDropContextValue>(() => ({
    ...state,
    beginSource,
    leaveSource,
    disposeSource,
    startDrag,
    endDrag,
    clear,
    isSourceActive,
    beginPointerDrag,
    cancelPointerDrag,
    registerDropTarget,
  }), [beginPointerDrag, beginSource, cancelPointerDrag, clear, disposeSource, endDrag, isSourceActive, leaveSource, registerDropTarget, startDrag, state])

  return <DragDropHintsContext.Provider value={value}>{children}</DragDropHintsContext.Provider>
}

export function DragDropHint({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null
  return <div className="drag-drop-hint" role="status" aria-live="polite" aria-hidden="true">{children}</div>
}
