import type { CardRecord } from './types.ts'

export type Region = 'EN' | 'JP'
export type Strictness = 'strict' | 'casual'

export interface FormatDef {
  id: string
  label: string
  mainSize: number // includes starter
  maxCopies: number // by card name
  triggersExact: number | null
  maxHeal: number
  starterMustBeGrade0: boolean
  /** Clan lock enforced from this set code onward (JP-set parity). Null = never. */
  clanLockFromSet: string | null
}

export const FORMATS: FormatDef[] = [
  {
    id: 'pre-lb',
    label: 'Pre-Limit Break',
    mainSize: 50,
    maxCopies: 4,
    triggersExact: 16,
    maxHeal: 4,
    starterMustBeGrade0: true,
    clanLockFromSet: 'BT11', // JP enforcement set parity; current pool (BT01-05/EB/TD) predates it
  },
  {
    id: 'limit-break',
    label: 'Limit Break (placeholder)',
    mainSize: 50,
    maxCopies: 4,
    triggersExact: 16,
    maxHeal: 4,
    starterMustBeGrade0: true,
    clanLockFromSet: 'BT11',
  },
]

export interface Restriction {
  /** match by lowercase card name (robust across reprints/rarities) */
  name: string
  region: Region
  /** ISO date from (inclusive) / to (exclusive, null = still active) */
  from: string
  to: string | null
  scope: 'forerunner-ban' | 'max-copies' | 'deck-condition'
  maxCopies?: number
  condition?: string
  note: string
}

// EN List-A (default table) — minimal OG hits.
export const EN_RESTRICTIONS: Restriction[] = [
  { name: 'barcgal', region: 'EN', from: '2012-08-01', to: '2018-06-01', scope: 'forerunner-ban', note: 'Restricted as forerunner (starter) Aug 2012; lifted Jun 2018.' },
  { name: 'lizard soldier, conroe', region: 'EN', from: '2014-08-01', to: '2017-01-30', scope: 'forerunner-ban', note: 'Restricted as forerunner Aug 2014; lifted Jan 2017.' },
  { name: 'flash ripple, odysseus', region: 'EN', from: '2016-02-01', to: null, scope: 'max-copies', maxCopies: 2, note: 'Limited to 2 (Feb 2016).' },
  { name: 'jewel knight, swordmy', region: 'EN', from: '2016-02-01', to: '2018-02-01', scope: 'deck-condition', condition: 'All G3s in deck must be Jewel Knights.', note: 'Deck condition Feb 2016; lifted Feb 2018.' },
  { name: 'doctoroid refros', region: 'EN', from: '2016-08-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 (Aug 2016).' },
  { name: 'tick tock worker', region: 'EN', from: '2017-01-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 + FV-restricted (Jan 2017).' },
  { name: 'tick tock worker', region: 'EN', from: '2017-01-01', to: null, scope: 'forerunner-ban', note: 'Restricted as forerunner (Jan 2017).' },
  { name: 'steam battler, ur-watar', region: 'EN', from: '2017-01-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 (Jan 2017).' },
  { name: 'seven seas apprentice, nightrunner', region: 'EN', from: '2017-01-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 + FV-restricted (Jan 2017).' },
  { name: 'seven seas apprentice, nightrunner', region: 'EN', from: '2017-01-01', to: null, scope: 'forerunner-ban', note: 'Restricted as forerunner (Jan 2017).' },
  { name: 'seven seas helmsman, nightcrow', region: 'EN', from: '2017-07-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 (Jul 2017).' },
  { name: 'mick the ghostie and family', region: 'EN', from: '2017-07-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 (Jul 2017).' },
  { name: 'heteroround dragon', region: 'EN', from: '2018-06-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 (Jun 2018).' },
  { name: 'cosmos pixy, lizbeth', region: 'EN', from: '2018-06-01', to: null, scope: 'max-copies', maxCopies: 1, note: 'Limited to 1 (Jun 2018).' },
]

// JP overlay — early combined caps + clan-mix exceptions (info-level unless region=JP).
export const JP_RESTRICTIONS: Restriction[] = [
  { name: '__combined:royal-majesty__', region: 'JP', from: '2012-02-20', to: '2013-05-11', scope: 'deck-condition', condition: 'Up to 2 total across Majesty Lord Blaster / Wingal Brave / Alfred lines + Kagero DOTE/Conroe + OTT Tsukuyomi pieces.', note: 'JP Feb 2012 combined cap.' },
  { name: '__clan-lock__', region: 'JP', from: '2013-05-11', to: null, scope: 'deck-condition', condition: 'Single-clan decks enforced (Royal/Shadow 14-card Majesty exception; later Royal 4x Blaster Dark; Link Joker may run all Reverse).', note: 'JP clan restriction window.' },
]

export interface BanPreset {
  id: string
  region: Region
  label: string
  /** Effective "as of" date for this preset. */
  date: string
}

// Era-end presets per region. Dates come from the restriction timeline
// (EN minimal list + JP overlay); Custom lets users pick their own date.
export const BAN_PRESETS: BanPreset[] = [
  { id: 'en-prelb', region: 'EN', label: 'Pre-LB · Sep 2012', date: '2012-09-01' },
  { id: 'en-lb', region: 'EN', label: 'Limit Break · Feb 2014', date: '2014-02-01' },
  { id: 'en-gstart', region: 'EN', label: 'G start · Mar 2015', date: '2015-03-01' },
  { id: 'en-latest', region: 'EN', label: 'Latest · Jun 2018', date: '2018-06-01' },
  { id: 'jp-early', region: 'JP', label: 'Early · Feb 2012', date: '2012-02-20' },
  { id: 'jp-clanlock', region: 'JP', label: 'Clan lock · May 2013', date: '2013-05-11' },
  { id: 'jp-gstart', region: 'JP', label: 'G start · Mar 2015', date: '2015-03-01' },
  { id: 'jp-latest', region: 'JP', label: 'Latest · Jun 2018', date: '2018-06-01' },
]

export function presetDate(region: Region, presetId: string | undefined, customDate: string): { date: string; label: string } {
  if (!presetId || presetId === 'custom') return { date: customDate, label: `Custom (${customDate})` }
  const p = BAN_PRESETS.find((x) => x.id === presetId && x.region === region)
  if (!p) {
    const fallback = BAN_PRESETS.filter((x) => x.region === region).at(-1)!
    return { date: fallback.date, label: fallback.label }
  }
  return { date: p.date, label: p.label }
}

export function latestPreset(region: Region): string {
  return BAN_PRESETS.filter((x) => x.region === region).at(-1)!.id
}

export interface DeckMap { [card_number: string]: number }

export interface ValidationIssue {
  level: 'error' | 'warn'
  text: string
}

function activeRestrictions(region: Region, asOf: string): Restriction[] {
  const pool = region === 'EN' ? EN_RESTRICTIONS : [...EN_RESTRICTIONS, ...JP_RESTRICTIONS]
  return pool.filter(r => r.from <= asOf && (r.to === null || asOf < r.to))
}

const SET_ORDER = ['BT01','BT02','BT03','BT04','BT05','BT06','BT07','BT08','BT09','BT10','BT11','BT12','EB01','EB02','EB03','TD01','TD02','TD03','TD04','PR']
function setAtLeast(a: string, b: string): boolean {
  const ia = SET_ORDER.indexOf(a); const ib = SET_ORDER.indexOf(b)
  if (ia === -1 || ib === -1) return a >= b
  return ia >= ib
}

export function validateDeck(
  main: DeckMap,
  starterCardNumber: string | null,
  byNumber: Map<string, CardRecord>,
  format: FormatDef,
  opts: { strictness: Strictness; region: Region; asOf: string },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const err = (text: string) => issues.push({ level: opts.strictness === 'strict' ? 'error' : 'warn', text })
  const info = (text: string) => issues.push({ level: 'warn', text })

  const entries = Object.entries(main)
  const total = entries.reduce((s, [, n]) => s + n, 0)
  if (total !== format.mainSize) {
    err(`Main deck is ${total}/${format.mainSize} cards (starter counts toward the 50).`)
  }

  // 4x by name
  const byName = new Map<string, { count: number; display: string }>()
  for (const [num, n] of entries) {
    const c = byNumber.get(num)
    const key = (c?.name ?? num).toLowerCase()
    const prev = byName.get(key) ?? { count: 0, display: c?.name ?? num }
    byName.set(key, { count: prev.count + n, display: prev.display })
  }
  for (const [, v] of byName) {
    if (v.count > format.maxCopies) err(`"${v.display}" ×${v.count} exceeds max ${format.maxCopies} copies (by name).`)
  }

  // Triggers
  let trig = 0, heal = 0
  const trigDetail = new Map<string, number>()
  for (const [num, n] of entries) {
    const c = byNumber.get(num)
    if (c?.card_type === 'Trigger Unit') {
      trig += n
      trigDetail.set(c.trigger_type ?? 'Unknown', (trigDetail.get(c.trigger_type ?? 'Unknown') ?? 0) + n)
      if ((c.trigger_type ?? '').toLowerCase() === 'heal') heal += n
    }
  }
  if (format.triggersExact !== null && trig !== format.triggersExact) {
    err(`Trigger lineup is ${trig}/${format.triggersExact} (Heal ${heal}/max ${format.maxHeal}).`)
  }
  if (heal > format.maxHeal) err(`Heal triggers ×${heal} exceed max ${format.maxHeal}.`)

  // Starter
  if (format.starterMustBeGrade0) {
    if (!starterCardNumber) {
      err('No starting Vanguard selected.')
    } else {
      const s = byNumber.get(starterCardNumber)
      if (!s) err('Starting Vanguard not found in card pool.')
      else {
        if (s.grade !== 0) err(`Starter "${s.name}" must be Grade 0 (is Grade ${s.grade}).`)
        if (!main[starterCardNumber]) err(`Starter "${s.name}" must be included in the 50.`)
      }
    }
  }

  // Active restrictions (name-based)
  for (const r of activeRestrictions(opts.region, opts.asOf)) {
    if (r.name.startsWith('__')) continue // handled below
    let count = 0; let display = r.name
    for (const [key, v] of byName) {
      if (key === r.name || key.includes(r.name)) { count = v.count; display = v.display; break }
    }
    if (count === 0) continue
    if (r.scope === 'max-copies' && r.maxCopies !== undefined && count > r.maxCopies) {
      err(`"${display}" ×${count} exceeds limited ${r.maxCopies} (${r.note})`)
    } else if (r.scope === 'forerunner-ban' && starterCardNumber) {
      const s = byNumber.get(starterCardNumber)
      if (s && (s.name.toLowerCase() === r.name || s.name.toLowerCase().includes(r.name))) {
        err(`"${display}" cannot be the starting Vanguard (${r.note})`)
      }
    } else if (r.scope === 'deck-condition' && r.name === 'jewel knight, swordmy' && count > 0) {
      const badG3: string[] = []
      for (const [num, n] of entries) {
        const c = byNumber.get(num)
        if (c && c.grade === 3 && n > 0 && !c.name.toLowerCase().includes('jewel knight')) badG3.push(c.name)
      }
      if (badG3.length) err(`Swordmy condition violated: non-Jewel Knight G3s present (${[...new Set(badG3)].slice(0, 3).join(', ')}…).`)
    }
  }

  // Clan lock (set-parity gated)
  if (format.clanLockFromSet) {
    const poolSets = new Set<string>()
    for (const [num] of entries) {
      const c = byNumber.get(num)
      if (c) poolSets.add(c.set_code)
    }
    const reached = [...poolSets].some(s => setAtLeast(s, format.clanLockFromSet!))
    const jpClanActive = opts.region === 'JP' && opts.asOf >= '2013-05-11'
    if (reached || jpClanActive) {
      const clans = new Set<string>()
      for (const [num, n] of entries) {
        const c = byNumber.get(num)
        if (c?.clan && n > 0) clans.add(c.clan)
      }
      if (clans.size > 1) {
        info(`Mixed clans (${[...clans].join(' / ')}) — illegal under clan lock (exceptions: Royal/Shadow Majesty-era, Royal 4x Blaster Dark, LJ Reverse).`)
      }
    }
  }

  if (opts.region === 'JP') {
    const jp = JP_RESTRICTIONS.filter(r => r.from <= opts.asOf && (r.to === null || opts.asOf < r.to))
    for (const r of jp) info(`[JP overlay] ${r.condition ?? r.note}`)
  }

  return issues
}
