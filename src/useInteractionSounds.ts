import { useEffect } from 'react'
import { playSound, unlockAudio } from './sounds'

const INTERACTIVE_SELECTOR = 'button, a[href], summary, input:not([type="hidden"]), select, textarea, [role="button"]'

function interactiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null

  const candidate = target.closest(INTERACTIVE_SELECTOR)
  if (!candidate) return null
  if (candidate.matches(':disabled') || candidate.closest('[aria-disabled="true"], [inert]')) return null
  return candidate
}


export function useInteractionSounds(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted || !interactiveTarget(event.target)) return
      unlockAudio()
      playSound('click')
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isTrusted || event.button !== 0 || !(event.target instanceof Element)) return
      // Drops need an unlocked context before their successful state transition.
      if (event.target.closest('[draggable="true"]')) unlockAudio()
    }

    // Native click already unifies mouse, touch, and keyboard activation.
    document.addEventListener('click', onClick, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [])
}
