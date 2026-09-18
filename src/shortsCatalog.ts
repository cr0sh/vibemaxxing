export type ShortVideo = {
  readonly id: string
  readonly title: string
  readonly creator: string
  readonly description: string
  /** Public source and attribution for the hosted clip. */
  readonly sourceUrl: string
  readonly mediaUrl: string
}

// Remote MP4 meme loops: only the foreground clip is loaded.
export const SHORTS_CATALOG: readonly ShortVideo[] = [
  {
    id: 'typing-cat',
    title: 'Shipping before the deadline',
    creator: 'GIPHY',
    description: 'The original keyboard-driven development workflow.',
    sourceUrl: 'https://giphy.com/gifs/JIX9t2j0ZTN9S',
    mediaUrl: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.mp4',
  },
  {
    id: 'reviewer-cat',
    title: 'Your code reviewer',
    creator: 'GIPHY',
    description: 'One small comment. Then another small comment.',
    sourceUrl: 'https://giphy.com/gifs/VbnUQpnihPSIgIXuZv',
    mediaUrl: 'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.mp4',
  },
  {
    id: 'office-fire',
    title: 'Production is warming up',
    creator: 'GIPHY',
    description: 'A completely normal day in IT.',
    sourceUrl: 'https://giphy.com/gifs/13HgwGsXF0aiGY',
    mediaUrl: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.mp4',
  },
  {
    id: 'this-is-fine',
    title: 'This is fine',
    creator: 'GIPHY',
    description: 'The deployment dashboard says everything is fine.',
    sourceUrl: 'https://giphy.com/gifs/QMHoU66sBXqqLqYvGO',
    mediaUrl: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.mp4',
  },
] as const
