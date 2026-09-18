import { useI18n } from './i18n'
import './UnreadIndicator.css'

type UnreadIndicatorProps = {
  count: number
  onClick: () => void
  label?: {
    singular: string
    plural: string
  }
}

export function UnreadIndicator({ count, onClick, label }: UnreadIndicatorProps) {
  const { t, formatNumber } = useI18n()
  if (count <= 0) return null

  const formattedCount = formatNumber(count)
  const text = label === undefined
    ? t('unread.new', { count: formattedCount })
    : t('unread.withLabel', { count: formattedCount, noun: count === 1 ? label.singular : label.plural })

  return (
    <button
      type="button"
      className="unread-indicator"
      aria-label={label === undefined ? t('unread.jump') : t('unread.jumpTo', { text: text.toLowerCase() })}
      onClick={onClick}
    >
      {text}
    </button>
  )
}
