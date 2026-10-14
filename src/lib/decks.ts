import type { CardRecord } from './types.ts'
import type { SavedDeck } from '../components/DeckBuilder.tsx'

// Era folder name -> filename tag. Extend as new eras are added; unknown eras
// fall back to word initials.
export const ERA_TAGS: Record<string, string> = {
  'Original Era': 'OG',
  'Limit Break': 'LB',
  'Legion': 'LG',
}

export function eraTag(era: string | null | undefined): string {
  if (!era) return 'OG'
  if (ERA_TAGS[era]) return ERA_TAGS[era]
  const initials = era.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3)
  return initials || 'OG'
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 120) || 'Untitled'
}

/** The deck's Vanguard: cover ace, else starter, else first card. */
export function deckVanguard(deck: SavedDeck, byNumber: Map<string, CardRecord>): CardRecord | undefined {
  if (deck.cover && byNumber.get(deck.cover)) return byNumber.get(deck.cover)
  if (deck.starter && byNumber.get(deck.starter)) return byNumber.get(deck.starter)
  const first = Object.keys(deck.main)[0]
  return first ? byNumber.get(first) : undefined
}

/** e.g. "[OG] King of Knights Alfred" (+ .json appended by the server). */
export function deckFileName(deck: SavedDeck, byNumber: Map<string, CardRecord>): string {
  const vg = deckVanguard(deck, byNumber)
  if (!vg) return sanitize(`[OG] ${deck.name || 'Untitled'}`)
  return sanitize(`[${eraTag(vg.era)}] ${vg.name}`)
}
