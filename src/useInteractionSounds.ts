import { useEffect } from 'react'
import { playSound, unlockAudio } from './sounds'

const INTERACTIVE_SELECTOR = 'button, a[href], summary, input:not([type="hidden"]), select, textarea, [role="button"]'
const CLICK_DEDUPE_WINDOW_MS = 2_000

function interactiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null

  const candidate = target.closest(INTERACTIVE_SELECTOR)
  if (!candidate) return null
  if (candidate.matches(':disabled')) return null
  if (candidate.hasAttribute('disabled')) return null
  if (candidate.getAttribute('aria-disabled')?.toLowerCase() === 'true') return null
  if (candidate.closest('fieldset[disabled]')) return null
  return candidate
}

function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'
}

function isKeyboardActivationTarget(element: Element, key: string): boolean {
  if (element.matches('a[href]')) return key === 'Enter'
  if (element.matches('button, summary, select, [role="button"]')) return true
  if (!element.matches('input:not([type="hidden"])')) return false

  const type = element.getAttribute('type')?.toLowerCase() ?? 'text'
  return type === 'button'
    || type === 'submit'
    || type === 'reset'
    || type === 'checkbox'
    || type === 'radio'
    || type === 'file'
    || type === 'image'
    || type === 'range'
}

function canPrimeFromPointer(event: PointerEvent): boolean {
  if (!('button' in event)) return true
  return event.button === 0
}

export function useInteractionSounds(): void {
  useEffect(() => {
    const primedTargets = new WeakMap<Element, number>()

    const primeInteractive = (target: EventTarget | null) => {
      const element = interactiveTarget(target)
      if (!element) return

      const now = Date.now()
      const primedAt = primedTargets.get(element)
      if (primedAt !== undefined && now - primedAt <= CLICK_DEDUPE_WINDOW_MS) return

      primedTargets.set(element, now)
      unlockAudio()
      playSound('click')
    }

    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return

      const element = interactiveTarget(event.target)
      if (!element) return

      const now = Date.now()
      const primedAt = primedTargets.get(element)
      if (primedAt !== undefined && now - primedAt <= CLICK_DEDUPE_WINDOW_MS) {
        primedTargets.delete(element)
        return
      }

      primedTargets.delete(element)
      unlockAudio()
      playSound('click')
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isTrusted || !canPrimeFromPointer(event)) return
      primeInteractive(event.target)

      // Draggable task and artifact attachments are intentionally not included
      // in the click affordance, but their pointer gesture must still unlock
      // Web Audio before a successful drop is reported by React state.
      if (interactiveTarget(event.target)) return
      const draggable = event.target instanceof Element
        ? event.target.closest('[draggable=\"true\"]')
        : null
      if (draggable) unlockAudio()
    }

    const onTouchStart = (event: TouchEvent) => {
      if (!event.isTrusted) return
      primeInteractive(event.target)
      if (interactiveTarget(event.target)) return
      const draggable = event.target instanceof Element
        ? event.target.closest('[draggable=\"true\"]')
        : null
      if (draggable) unlockAudio()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted || event.repeat || event.isComposing || !isActivationKey(event)) return
      const element = interactiveTarget(event.target)
      if (!element || !isKeyboardActivationTarget(element, event.key)) return

      const now = Date.now()
      const primedAt = primedTargets.get(element)
      if (primedAt !== undefined && now - primedAt <= CLICK_DEDUPE_WINDOW_MS) return

      primedTargets.set(element, now)
      unlockAudio()
      // Keyboard activation can dispatch click later (Space, in particular),
      // so prime in the key event and deduplicate the eventual click.
      playSound('click')
    }

    // Capture keeps this universal affordance working even when a component
    // stops propagation in its own bubble-phase handler.
    document.addEventListener('click', onClick, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('touchstart', onTouchStart, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])
}
