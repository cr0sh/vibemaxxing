import type { MessageKey } from './i18n/catalog'

export type ShortVideo = {
  readonly id: string
  readonly titleKey: MessageKey
  readonly creator: string
  readonly descriptionKey: MessageKey
  /** Public source and attribution for the hosted clip. */
  readonly sourceUrl: string
  readonly mediaUrl: string
}

// Remote MP4 meme loops; Shorts keeps a bounded three-card preload window.
export const SHORTS_CATALOG: readonly ShortVideo[] = [
  {
    id: 'typing-cat',
    titleKey: 'shorts.clip.typingCat.title',
    creator: 'GIPHY',
    descriptionKey: 'shorts.clip.typingCat.description',
    sourceUrl: 'https://giphy.com/gifs/JIX9t2j0ZTN9S',
    mediaUrl: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.mp4',
  },
  {
    id: 'reviewer-cat',
    titleKey: 'shorts.clip.reviewerCat.title',
    creator: 'GIPHY',
    descriptionKey: 'shorts.clip.reviewerCat.description',
    sourceUrl: 'https://giphy.com/gifs/VbnUQpnihPSIgIXuZv',
    mediaUrl: 'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.mp4',
  },
  {
    id: 'office-fire',
    titleKey: 'shorts.clip.officeFire.title',
    creator: 'GIPHY',
    descriptionKey: 'shorts.clip.officeFire.description',
    sourceUrl: 'https://giphy.com/gifs/13HgwGsXF0aiGY',
    mediaUrl: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.mp4',
  },
  {
    id: 'this-is-fine',
    titleKey: 'shorts.clip.thisIsFine.title',
    creator: 'GIPHY',
    descriptionKey: 'shorts.clip.thisIsFine.description',
    sourceUrl: 'https://giphy.com/gifs/QMHoU66sBXqqLqYvGO',
    mediaUrl: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.mp4',
  },
] as const
