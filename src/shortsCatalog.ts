export type ShortVideo = {
  readonly id: string
  readonly title: string
  readonly creator: string
  readonly description: string
  /** The original page a player can open when an embed is blocked. */
  readonly sourceUrl: string
  /** A native YouTube embed URL; query parameters are added by ShortsContent. */
  readonly embedUrl: string
}

/**
 * A deliberately small catalog of durable, publicly embeddable originals.
 *
 * These are links, not downloaded media: YouTube remains responsible for
 * playback, rights, availability, captions, and any regional restrictions.
 */
export const SHORTS_CATALOG: readonly ShortVideo[] = [
  {
    id: 'nyan-cat-original',
    title: 'Nyan Cat [original]',
    creator: 'saraj00n',
    description: 'The looping pixel-art cat and its unmistakable space-rainbow soundtrack.',
    sourceUrl: 'https://www.youtube.com/watch?v=QH2-TGUlwu4',
    embedUrl: 'https://www.youtube-nocookie.com/embed/QH2-TGUlwu4',
  },
  {
    id: 'keyboard-cat-original',
    title: 'Keyboard Cat',
    creator: 'Charlie Schmidt',
    description: 'A classic internet performance from the original Keyboard Cat upload.',
    sourceUrl: 'https://www.youtube.com/watch?v=J---aiyznGQ',
    embedUrl: 'https://www.youtube-nocookie.com/embed/J---aiyznGQ',
  },
  {
    id: 'gangnam-style-official',
    title: 'Gangnam Style (강남스타일)',
    creator: 'official PSY video',
    description: 'PSY’s official music video and one of the web’s defining dance moments.',
    sourceUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
    embedUrl: 'https://www.youtube-nocookie.com/embed/9bZkp7q19f0',
  },
  {
    id: 'rick-astley-official',
    title: 'Never Gonna Give You Up',
    creator: 'Rick Astley',
    description: 'The official music video behind the enduring rickroll internet meme.',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  },
] as const
