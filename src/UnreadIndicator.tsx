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
  if (count <= 0) return null

  const text = label === undefined
    ? `↓ ${count} new`
    : `New ${count} ${count === 1 ? label.singular : label.plural}`

  return (
    <button
      type="button"
      className="unread-indicator"
      aria-label={label === undefined ? 'Jump to unread messages' : `Jump to ${text.toLowerCase()}`}
      onClick={onClick}
    >
      {text}
    </button>
  )
}
