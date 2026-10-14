export interface CardRecord {
  schema_version: string
  card_number: string
  file: string | null
  set_code: string
  name: string
  card_type: string | null
  clan: string | null
  nation: string | null
  nation_era: string | null
  race: string | null
  grade: number | null
  power: number | null
  critical: number | null
  shield: number | null
  skill_icons_raw: string | null
  drive: number | null
  can_boost: boolean
  can_intercept: boolean
  persona_ride: boolean
  extra_icons: string[]
  gift: string | null
  trigger_type: string | null
  trigger_power: number | null
  skill_text: string
  flavor_text: string | null
  regulation: string | null
  rarity: string | null
  illustrator: string | null
  source_url: string | null
  // derived by indexer
  era: string
  era_order: number
  set_name: string
  set_kind: string
  image_raw: string | null
  image_upscaled: string | null
}

export interface SetInfo {
  code: string
  name: string
  kind: string
  count: number
  featured: string[]
}

export interface IndexMeta {
  eras: { name: string; order: number; sets: SetInfo[] }[]
  clans: string[]
  nations: string[]
  races: string[]
  card_types: string[]
  trigger_types: string[]
  rarities: string[]
  total: number
}

export type ViewMode = 'table' | 'compressed' | 'grid' | 'stacked'
export type GroupBy = 'none' | 'grade' | 'card_type' | 'clan' | 'nation' | 'set_code' | 'trigger_type'

export interface Filters {
  query: string
  clans: string[]
  nations: string[]
  grades: number[]
  card_types: string[]
  trigger_types: string[]
  sets: string[]
  rarities: string[]
  eras: string[]
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  clans: [],
  nations: [],
  grades: [],
  card_types: [],
  trigger_types: [],
  sets: [],
  rarities: [],
  eras: [],
}

/** Effective trigger kind: scraped value, Heal backfill, else Unknown. */
export function triggerKind(c: CardRecord): string {
  if (c.trigger_type) return c.trigger_type
  if (c.card_type === 'Trigger Unit') return 'Unknown'
  return ''
}

/** Max cards per stacked column before wrapping to a new column. */
export const STACK_CHUNK = 12

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/** Split items into exactly N columns as evenly as possible; the remainder
    goes to the earlier columns. Trailing columns may be empty (kept, so card
    sizes stay uniform across groups). */
export function distribute<T>(arr: T[], n: number): T[][] {
  const cols = Math.max(1, Math.min(12, Math.floor(n) || 1))
  const base = Math.floor(arr.length / cols)
  const rem = arr.length % cols
  const out: T[][] = []
  let k = 0
  for (let c = 0; c < cols; c++) {
    const take = base + (c < rem ? 1 : 0)
    out.push(arr.slice(k, k + take))
    k += take
  }
  return out
}
export function thumbUrl(c: CardRecord): string {
  return c.image_raw ?? c.image_upscaled ?? ''
}
export function fullUrl(c: CardRecord): string {
  return c.image_upscaled ?? c.image_raw ?? ''
}

/** Normalize [Token] search so "counter blast" matches "[Counter-Blast 1]". */
export function normText(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[\[\]-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function cardMatches(c: CardRecord, f: Filters): boolean {
  if (f.eras.length && !f.eras.includes(c.era)) return false
  if (f.sets.length && !f.sets.includes(c.set_code)) return false
  if (f.clans.length && !(c.clan && f.clans.includes(c.clan))) return false
  if (f.nations.length && !(c.nation && f.nations.includes(c.nation))) return false
  if (f.grades.length && !(c.grade !== null && f.grades.includes(c.grade))) return false
  if (f.card_types.length && !(c.card_type && f.card_types.includes(c.card_type))) return false
  if (f.trigger_types.length && !(c.trigger_type && f.trigger_types.includes(c.trigger_type))) return false
  if (f.rarities.length && !(c.rarity && f.rarities.includes(c.rarity))) return false
  const q = f.query.trim().toLowerCase()
  if (q) {
    const hay = [
      c.name, c.skill_text, c.flavor_text, c.clan, c.nation, c.race,
      c.card_number, c.set_code, c.set_name, c.illustrator, c.skill_icons_raw,
      c.card_type, c.trigger_type, c.rarity, c.regulation,
    ]
      .map(normText)
      .join(' | ')
    for (const tok of q.split(/\s+/)) {
      if (!hay.includes(normText(tok))) return false
    }
  }
  return true
}

export function groupKey(c: CardRecord, g: GroupBy): string {
  switch (g) {
    case 'grade': return c.grade === null ? 'No grade' : `Grade ${c.grade}`
    case 'card_type': return c.card_type ?? 'Unknown type'
    case 'clan': return c.clan ?? 'No clan'
    case 'nation': return c.nation ?? 'No nation'
    case 'set_code': return `${c.set_code} — ${c.set_name}`
    case 'trigger_type': return c.trigger_type ? `${c.trigger_type} Trigger` : (c.card_type === 'Trigger Unit' ? 'Trigger (other)' : 'Non-trigger')
    default: return ''
  }
}

/** Effective trigger kind: scraped value, Heal backfill, else Unknown. */
