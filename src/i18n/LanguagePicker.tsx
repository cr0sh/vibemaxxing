import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { englishCatalog, SUPPORTED_LOCALES } from './catalog'
import { useI18n } from './I18nContext'
import './LanguagePicker.css'

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // The top layer keeps the menu above desktop windows and their stacking contexts.
    menuRef.current?.showPopover()
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [open])

  function closeAndRestoreFocus() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function navigateMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeAndRestoreFocus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div
      className="language-picker"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="language-picker-trigger"
        title={t('language.picker.label')}
        aria-label={t('language.picker.aria')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className="language-picker-globe" aria-hidden="true">🌐</span>
      </button>
      {open && (
        <div id={menuId} ref={menuRef} popover="manual" className="language-picker-menu" role="menu" aria-label={t('language.picker.aria')} onKeyDown={navigateMenu}>
          <div className="language-picker-heading" aria-hidden="true">{t('language.picker.label')}</div>
          {SUPPORTED_LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={locale === option}
              tabIndex={-1}
              lang={option}
              className="language-picker-option"
              onClick={() => {
                setLocale(option)
                closeAndRestoreFocus()
              }}
            >
              <span>{englishCatalog[`language.name.${option}`]}</span>
              <span className="language-picker-check" aria-hidden="true">{locale === option ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
