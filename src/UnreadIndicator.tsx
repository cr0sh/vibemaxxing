import './UnreadIndicator.css'

export function UnreadIndicator({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null

  return (
    <button
      type="button"
      className="unread-indicator"
      aria-label="Jump to unread messages"
      onClick={onClick}
    >
      ↓ {count} new
    </button>
  )
}
