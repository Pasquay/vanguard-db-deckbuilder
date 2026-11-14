import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CardRecord, IndexMeta, SetInfo } from '../lib/types.ts'
import { thumbUrl } from '../lib/types.ts'
import CardImg from './CardImg.tsx'
import { IconChevronDown, IconChevronRight } from './icons.tsx'

const KIND_ORDER = ['Booster', 'Extra Booster', 'Character Booster', 'Comic Booster', 'Fighters Collection', 'Deck', 'Promo', 'Event Promo', 'Other']

type Section = 'sets' | 'meta' | 'stats'
type Scope = 'overall' | string
type WindowKey = 'all' | 'year' | 'banlist'
type Tier = 1 | 2 | 3

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'sets', label: 'Sets' },
  { id: 'meta', label: 'Meta' },
  { id: 'stats', label: 'Stats' },
]

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'year', label: 'Latest year' },
  { key: 'banlist', label: 'Since banlist' },
]

interface Props {
  meta: IndexMeta
  byNumber: Map<string, CardRecord>
  goSet: (era: string, set?: string) => void
  onZoom: (c: CardRecord) => void
  navCollapsed: boolean
}

// Shape of /card-images/Decks/set_impact.json (written by Scripts/build_set_impact.py)
interface ImpactArchetype { name: string; decks: number }
interface ImpactSet {
  code: string
  name: string
  kind: string
  era: string
  decks: number
  pct: number
  archetypes: ImpactArchetype[]
}
interface ImpactOther {
  set_count: number
  decks: number
  pct: number
  archetypes: ImpactArchetype[]
  sets: ImpactSet[]
}
interface ImpactArchetypeRow {
  name: string
  clan: string
  set_code: string
  set_name: string
  decks: number
  pct: number
  strength: number | null
  nation?: string
  rated?: number
}
interface ImpactShape {
  decks: number
  triggers: Record<string, { decks: number; copies: number }>
  grades: Record<string, number>
  staples: { name: string; trigger: string; decks: number; copies: number }[]
}
interface ImpactScope {
  decks: number
  low_sample: boolean
  sets: ImpactSet[]
  other: ImpactOther | null
  archetypes: ImpactArchetypeRow[]
  latest?: { year: number; decks: number; archetypes: Record<string, number> } | null
  card_usage?: Record<string, Record<string, { pool: number; rows: { name: string; clan?: string; decks: number; copies: number }[] }>>
  deck_shape?: Record<string, ImpactShape>
}
interface ImpactFile { generated: string; decks_total: number; scopes: Record<string, ImpactScope> }

// ── Sample data (placeholders, not real results) ───────────────────────────────
const PALETTE = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#f87171', '#facc15', '#60a5fa']

// Each clan / nation keeps the same colour everywhere. Change a hex here to re-colour it.
const CLAN_COLORS: Record<string, string> = {
  'Royal Paladin': '#1D4ED8',
  'Shadow Paladin': '#312E81', 
  'Gold Paladin': '#EAB308', 
  'Angel Feather': '#e5e7eb', 
  'Oracle Think Tank': '#D4AF37', 
  'Genesis': '#298be1', 
  'Kagero': '#DC2626', 
  'Narukami': '#F97316', 
  'Tachikaze': '#D97706',
  'Nubatama': '#141418', 
  'Murakumo': '#C81E2B', 
  'Dark Irregulars': '#581C87', 
  'Pale Moon': '#6A1B9A', 
  'Spike Brothers': '#8c35de', 
  'Nova Grappler': '#94a3b8', 
  'Dimension Police': '#8b9cb6', 
  'Link Joker': '#A8A29E', 
  'Neo Nectar': '#84CC16', 
  'Megacolony': '#65a30d', 
  'Great Nature': '#046A38', 
  'Granblue': '#7B68EE', 
  'Bermuda Triangle': '#f472b6', 
  'Aqua Force': '#0EA5E9', 
  'Cray Elemental': '#A8A29E',
  'Gear Chronicle': '#d27732', 
  'United Sanctuary': '#facc15', 
  'Dragon Empire': '#dc2626', 
  'Dark States': '#9333ea',
  'Brandt Gate': '#badbe0', 
  'Keter Sanctuary': '#facc15', 
  'Stoicheia': '#10b981',
  'Lyrical Monasterio': '#f472b6', 
  'Dark Zone': '#9333ea', 
  'Magallanica': '#3b4cc0', 
  'Zoo': '#84cc16',
  'Star Gate': '#94a3b8',
}

// Lighter / darker versions of a clan colour, for several archetypes of the same clan in one chart.
function shade(hex: string, k: number): string {
  if (k === 0) return hex
  const amt = [0, 0.3, -0.25, 0.5, -0.4][k % 5]
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')
}

function clanColor(clan: string, k = 0): string {
  let base = CLAN_COLORS[clan]
  if (!base) {
    let h = 0
    for (const c of clan) h = (h * 31 + c.charCodeAt(0)) >>> 0
    base = PALETTE[h % PALETTE.length]
  }
  return shade(base, k)
}
// Every clan can have a hatch colour. Popular clans use their own main colour here, so their hatching is invisible.
// To give a clan a visible second colour, change its hex below.
const CLAN_ACCENT: Record<string, string> = {
  // popular clans: same as the main colour (single colour)
  'Royal Paladin': '#1D4ED8', 
  'Shadow Paladin': '#312E81', 
  'Gold Paladin': '#EAB308',
  'Angel Feather': '#e5e7eb', 
  'Oracle Think Tank': '#2B124C', 
  'Genesis': '#F8FAFC',
  'Kagero': '#DC2626', 
  'Narukami': '#F97316', 
  'Nubatama': '#6B21A8',
  'Dimension Police': '#1B499F', 
  'Link Joker': '#DC2626',
  // less-played clans: visible second colour
  'Tachikaze': '#F8FAFC', 
  'Murakumo': '#240E36', 
  'Dark Irregulars': '#581C87',
  'Pale Moon': '#f78be5', 
  'Spike Brothers': '#d36efb', 
  'Nova Grappler': '#f59e0b',
  'Neo Nectar': '#f37fbb', 
  'Megacolony': '#f59e0b', 
  'Great Nature': '#046A38',
  'Granblue': '#0B192C', 
  'Bermuda Triangle': '#F472B6', 
  'Aqua Force': '#A4FF00',
  'Cray Elemental': '#A8A29E', 
  'Gear Chronicle': '#A4FF00', 
}

// Two-tone diagonal stripes: the clan colour plus its accent. `size` is the stripe width in px.
function clanPaint(clan: string, k = 0, size = 5): string {
  const main = clanColor(clan, k)
  const acc = CLAN_ACCENT[clan]
  if (!acc) return main
  return `repeating-linear-gradient(45deg, ${main} 0 ${size}px, ${shade(acc, k)} ${size}px ${size + 1}px)`
}

function relLum(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
}

// Tag text on the dark page: the accent if readable, else a lightened main colour, else near-white.
function tagText(main: string, accent?: string): string {
  const page = relLum('#0f172a')
  const readable = (c: string) => {
    const l = relLum(c)
    return (Math.max(l, page) + 0.05) / (Math.min(l, page) + 0.05) >= 4.5
  }
  const options = [...(accent ? [accent] : []), shade(main, 1), shade(main, 3)]
  return options.find(readable) ?? '#f8fafc'
}
const DECKS = ['Deck A', 'Deck B', 'Deck C', 'Deck D', 'Deck E', 'Deck F', 'Deck G', 'Deck H']
const TRIGGER_ROWS = [
  { label: 'Critical', max: 8, avg: 7.7, pct: 100 },
  { label: 'Draw', max: 8, avg: 0.9, pct: 33 },
  { label: 'Front', max: 8, avg: 3.2, pct: 90 },
  { label: 'Stand', max: 8, avg: 0, pct: 0 },
  { label: 'Heal', max: 4, avg: 3.7, pct: 100 },
  { label: 'Over', max: 1, avg: 0.9, pct: 87 },
]
const TRIGGER_COLORS: Record<string, string> = {
  Critical: '#facc15',
  Draw: '#ef4444',
  Front: '#f472b6',
  Heal: '#22c55e',
  Stand: '#3b82f6',
  Over: 'linear-gradient(90deg, #ef4444, #f59e0b, #facc15, #22c55e, #3b82f6, #a855f7)',
}
const GRADE_CURVE = [
  { g: 'G0', v: 18.4 },
  { g: 'G1', v: 14.3 },
  { g: 'G2', v: 12.9 },
  { g: 'G3', v: 9 },
  { g: 'G4+', v: 0.5 },
]

/** Stable number per scope, so each era shows slightly different sample numbers. */
function seedOf(scope: Scope): number {
  let h = 7
  for (const ch of scope) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h
}

function vary(base: number, scope: Scope, salt: number, amt: number): number {
  const k = ((seedOf(scope) + salt * 13) % 5) - 2
  return Math.max(0, base + k * amt)
}

/** Exact odds of at least one trigger among n cards drawn from a deck of d cards with t triggers. */
function atLeastOne(t: number, d: number, n: number): number {
  let none = 1
  for (let i = 0; i < n; i++) none *= Math.max(0, d - t - i) / (d - i)
  return 1 - none
}

// ── Small building blocks ──────────────────────────────────────────────────────
let CARD_BY_NAME = new Map<string, CardRecord>()
let CARD_ZOOM: ((c: CardRecord) => void) | null = null

function CardPeek({ name, x, y }: { name: string; x: number; y: number }) {
  const card = CARD_BY_NAME.get(name)
  if (!card) return null
  const W = 208
  const H = Math.round((W * 73) / 50)
  const left = x + 24 + W > window.innerWidth ? x - 24 - W : x + 24
  const top = Math.min(Math.max(8, y - H / 2), window.innerHeight - H - 8)
  return (
    <span className="fixed z-50 pointer-events-none rounded-lg overflow-hidden border border-slate-600 shadow-2xl bg-black" style={{ left, top, width: W }}>
      <CardImg src={thumbUrl(card)} alt={card.name} className="w-full aspect-[50/73] object-contain" />
    </span>
  )
}

// Hover a card name to see the card. Does nothing if the name has no card in the library.
function CardPreview({ name, className, children }: { name: string; className?: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const card = CARD_BY_NAME.get(name)
  if (!card) return <span className={className}>{children}</span>
  const W = 208
  const H = Math.round((W * 73) / 50)
  const left = pos ? (pos.x + 24 + W > window.innerWidth ? pos.x - 24 - W : pos.x + 24) : 0
  const top = pos ? Math.min(Math.max(8, pos.y - H / 2), window.innerHeight - H - 8) : 0
  return (
    <span
      className={`${className ?? ''} cursor-zoom-in`}
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || !CARD_ZOOM) return
        e.stopPropagation()
        setPos(null)
        CARD_ZOOM(card)
      }}
    >
      {children}
      {pos && (
        <span className="fixed z-50 pointer-events-none rounded-lg overflow-hidden border border-slate-600 shadow-2xl bg-black" style={{ left, top, width: W }}>
          <CardImg src={thumbUrl(card)} alt={card.name} className="w-full aspect-[50/73] object-contain" />
        </span>
      )}
    </span>
  )
}

function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="h-2 rounded bg-slate-800 overflow-hidden">
      <div
        className="h-full rounded"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color ?? '#f59e0b' }}
      />
    </div>
  )
}

function Mock({ title, note, children, live, action }: { title: string; note: string; children: ReactNode; live?: boolean; action?: ReactNode }) {
  return (
    <section className="relative border border-slate-800 rounded-xl p-4 bg-slate-950/50 mb-5">
      {action && <div className="absolute top-4 right-4 z-10">{action}</div>}
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-base font-bold text-slate-100">{title}</h2>
        {!live && (
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-dashed border-amber-400/50 text-amber-300">
            Mockup
          </span>
        )}
      </div>
      <p className={`text-xs text-slate-500 mb-4 ${action ? 'pr-72' : ''}`}>{note}</p>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 min-w-[7rem] border border-slate-800 rounded-lg p-3 text-center">
      <div className="text-2xl font-bold tabular-nums text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Donut({ parts, center, onPeek, onPick }: { parts: { label: string; value: number; color?: string; accent?: string }[]; center?: string; onPeek?: (i: number | null, e?: { clientX: number; clientY: number }) => void; onPick?: (i: number) => void }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1
  const C = 2 * Math.PI * 40
  let acc = 0
  return (
    <svg viewBox="0 0 100 100" className="w-44 h-44 shrink-0">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="16" />
      <defs>
        {parts.map((p, i) =>
          p.accent ? (
            <pattern key={i} id={`hatch-${i}`} width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="3.5" height="3.5" fill={p.color} />
              <line x1="0" y1="0" x2="0" y2="3.5" stroke={p.accent} strokeWidth="2.0" />
            </pattern>
          ) : null,
        )}
      </defs>
      {parts.map((p, i) => {
        const len = (p.value / total) * C
        const offset = acc
        acc += len
        return (
          <g key={p.label} transform="rotate(-90 50 50)">
            {[
              { r: 40, w: 16, c: p.accent ? `url(#hatch-${i})` : (p.color ?? PALETTE[i % PALETTE.length]) },
            ].map((b) => {
              const Cb = 2 * Math.PI * b.r
              const l = Math.max(0, (len / C) * Cb - 1)
              return (
                <circle
                  key={b.r}
                  cx="50"
                  cy="50"
                  r={b.r}
                  fill="none"
                  stroke={b.c}
                  strokeWidth={b.w}
                  strokeDasharray={`${l} ${Cb - l}`}
                  strokeDashoffset={-(offset / C) * Cb}
                  style={{ cursor: onPick ? 'pointer' : undefined }}
                  onMouseEnter={(e) => onPeek?.(i, e)}
                  onMouseMove={(e) => onPeek?.(i, e)}
                  onMouseLeave={() => onPeek?.(null)}
                  onClick={() => onPick?.(i)}
                />
              )
            })}
          </g>
        )
      })}
      <text x="50" y="50" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 7 }}>
        {center ?? 'sample'}
      </text>
    </svg>
  )
}

// ── Meta ───────────────────────────────────────────────────────────────────────
// Tier cut-offs live here. Score = rating (0-10) weighted with deck share.
const TIER_CUTS = { t1: 0.85, t2: 0.65 } // share of the scope's best score
const PRIOR_DECKS = 5 // rated decks of average results blended into every rating, so a 3-deck fluke can't top the list

function ratingOf(a: ImpactArchetypeRow, mean: number): number {
  const n = a.strength == null ? 0 : (a.rated ?? a.decks)
  const s = ((a.strength ?? 0) * n + mean * PRIOR_DECKS) / (n + PRIOR_DECKS)
  return Math.min(10, (s * 10) / 8)
}

function scoreOf(a: ImpactArchetypeRow, mean: number, maxRating: number, maxPct: number): number {
  return (ratingOf(a, mean) / maxRating) * 0.6 + (a.pct / maxPct) * 0.4
}

function ArchetypeShare({ impact, scope }: { impact: ImpactFile | null; scope: Scope }) {
  const [peek, setPeek] = useState<{ name: string; x: number; y: number } | null>(null)
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  const sorted = [...sc.archetypes].sort((a, b) => b.decks - a.decks)
  const top = sorted.slice(0, 10)
  const listed = sorted.reduce((n, a) => n + a.decks, 0)
  const restDecks = listed - top.reduce((n, a) => n + a.decks, 0)
  const restPct = Math.max(0, Math.round((100 - top.reduce((n, a) => n + a.pct, 0)) * 10) / 10)
  const seen: Record<string, number> = {}
  const hidden = sc.decks - listed
  const rows = [
    ...top.map((a) => {
      const k = seen[a.clan] ?? 0
      seen[a.clan] = k + 1
      return { label: a.name, clan: a.clan, decks: a.decks, pct: a.pct, color: clanColor(a.clan, k), paint: clanPaint(a.clan, k, 3), accent: CLAN_ACCENT[a.clan] ? shade(CLAN_ACCENT[a.clan], k) : undefined }
    }),
    ...(restDecks > 0 ? [{ label: 'Other archetypes', clan: '', decks: restDecks, pct: restPct, color: '#64748b', paint: '#64748b', accent: undefined as string | undefined }] : []),
  ]
  return (
    <div className="flex flex-wrap gap-6 items-center">
      <Donut
        parts={rows.map((r) => ({ label: r.label, value: r.decks, color: r.color, accent: r.accent }))}
        center={`${listed} decks`}
        onPeek={(i, e) => setPeek(i == null || !e ? null : { name: rows[i].label, x: e.clientX, y: e.clientY })}
        onPick={(i) => {
          const c = CARD_BY_NAME.get(rows[i].label)
          if (c && CARD_ZOOM) {
            setPeek(null)
            CARD_ZOOM(c)
          }
        }}
      />
      {peek && <CardPeek name={peek.name} x={peek.x} y={peek.y} />}
      <div className="flex-1 min-w-[16rem] space-y-1.5">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex-1">Archetype</span>
          <span className="w-32 text-right">Clan</span>
          <span className="w-14 text-right">Share</span>
          <span className="w-20 text-right">Decks</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className="flex-1 min-w-0 flex items-center gap-2 text-slate-200">
              <CardPreview name={r.label} className="shrink-0 flex"><span className="block w-3.5 h-3.5 rounded-full" style={{ background: r.paint }} /></CardPreview>
              <CardPreview name={r.label} className="truncate">{r.label}</CardPreview>
            </span>
            <span className="w-32 text-right text-xs text-slate-500 truncate">{r.clan}</span>
            <span className="w-14 text-right font-semibold tabular-nums">{r.pct}%</span>
            <span className="w-20 text-right text-xs text-slate-500">{r.decks} decks</span>
          </div>
        ))}
        {hidden > 0 && (
          <div className="text-[11px] text-slate-500 pt-1">
            {hidden} more decks are in archetypes with fewer than 3 decks and are not shown.
          </div>
        )}
      </div>
    </div>
  )
}

function TierRanking({ impact, scope }: { impact: ImpactFile | null; scope: Scope }) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  const TIER_LABEL: Record<Tier, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }
  const tiers: Tier[] = [1, 2, 3]
  const shown = sc.archetypes.filter((a) => a.name !== 'Unlisted' && a.name !== a.clan)
  const ratedRows = shown.filter((a) => a.strength != null)
  const ratedDecks = ratedRows.reduce((n, a) => n + (a.rated ?? a.decks), 0)
  const mean = ratedDecks ? ratedRows.reduce((n, a) => n + (a.strength as number) * (a.rated ?? a.decks), 0) / ratedDecks : 4
  const maxPct = Math.max(1, ...shown.map((a) => a.pct))
  const maxRating = Math.max(1, ...shown.map((a) => ratingOf(a, mean)))
  const scored = shown.map((a) => ({ a, score: scoreOf(a, mean, maxRating, maxPct) }))
  const best = Math.max(0.01, ...scored.map((r) => r.score))
  const rows = scored.map((r) => ({ ...r, tier: (r.score >= best * TIER_CUTS.t1 ? 1 : r.score >= best * TIER_CUTS.t2 ? 2 : 3) as Tier }))
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Tiers are relative to this scope: placement rating (small samples pulled toward average) weighted with deck share. Cut-offs are TIER_CUTS in this file.
      </p>
      {tiers.map((t) => {
        const inTier = rows.filter((r) => r.tier === t).sort((x, y) => y.score - x.score)
        return (
          <div key={t}>
            <div className="text-sm font-semibold text-amber-200 mb-2">{TIER_LABEL[t]}</div>
            {inTier.length === 0 ? (
              <div className="text-xs text-slate-500">None</div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {inTier.map(({ a }) => (
                  <div key={a.name} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <CardPreview name={a.name} className="font-semibold text-slate-100 truncate">{a.name}</CardPreview>
                      <span className="text-xs text-slate-400 tabular-nums shrink-0">{a.strength == null ? 'Unrated' : `Rating ${ratingOf(a, mean).toFixed(1)}`}</span>
                    </div>
                    <Bar pct={(a.pct / maxPct) * 100} color={clanPaint(a.clan, 0, 6)} />
                    <div className="text-[11px] text-slate-500 mt-2 tabular-nums">
                      {a.decks} decks · {a.pct}% share{a.clan ? ` · ${a.clan}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TimeWindow({ impact, scope, windowKey, onChange }: { impact: ImpactFile | null; scope: Scope; windowKey: WindowKey; onChange: (w: WindowKey) => void }) {
  const sc = impact?.scopes[scope]
  const latest = sc?.latest
  const rows = (sc?.archetypes ?? [])
    .filter((a) => a.name !== 'Unlisted' && a.name !== a.clan)
    .map((a) => ({ a, yr: latest && latest.decks ? ((latest.archetypes[a.name] ?? 0) / latest.decks) * 100 : 0 }))
    .sort((x, y) => (windowKey === 'year' ? y.yr - x.yr : y.a.decks - x.a.decks))
    .slice(0, 10)
  return (
    <div>
      <div className="inline-flex rounded overflow-hidden border border-slate-700 text-sm mb-4">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            onClick={() => onChange(w.key)}
            className={`px-3 py-1 ${windowKey === w.key ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            {w.label}
          </button>
        ))}
      </div>
      {!impact || !sc ? (
        <ScopeNote impact={impact} scope={scope} />
      ) : windowKey === 'banlist' ? (
        <div className="text-sm text-slate-500 py-6">Under construction. This needs a banlist date table first.</div>
      ) : windowKey === 'year' && !latest ? (
        <div className="text-sm text-slate-500 py-6">No dated decks in this scope.</div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex-1">Archetype</span>
            <span className="w-24 text-right">All time</span>
            {windowKey === 'year' && latest && <span className="w-24 text-right">{latest.year}</span>}
            {windowKey === 'year' && <span className="w-20 text-right">Change</span>}
          </div>
          {rows.map(({ a, yr }) => {
            const change = yr - a.pct
            return (
              <div key={a.name} className="flex items-center gap-3 text-sm">
                <CardPreview name={a.name} className="shrink-0 flex"><span className="block w-3.5 h-3.5 rounded-full" style={{ background: clanPaint(a.clan, 0, 3) }} /></CardPreview>
                <CardPreview name={a.name} className="flex-1 truncate text-slate-200">{a.name}</CardPreview>
                <span className={`w-24 text-right tabular-nums ${windowKey === 'year' ? 'text-slate-500' : 'font-semibold'}`}>{a.pct.toFixed(1)}%</span>
                {windowKey === 'year' && <span className="w-24 text-right tabular-nums font-semibold">{yr.toFixed(1)}%</span>}
                {windowKey === 'year' && (
                  <span className={`w-20 text-right tabular-nums text-xs ${change > 0.05 ? 'text-emerald-400' : change < -0.05 ? 'text-rose-400' : 'text-slate-500'}`}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}
                  </span>
                )}
              </div>
            )
          })}
          {windowKey === 'year' && latest && (
            <div className="text-[11px] text-slate-500 pt-2">
              {latest.decks} decks from {latest.year}, the newest year in this scope.{latest.decks < 15 ? ' Small sample, so treat the changes with caution.' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ClanShare({ impact, scope }: { impact: ImpactFile | null; scope: Scope }) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  const byClan: Record<string, { decks: number; archetypes: number }> = {}
  for (const a of sc.archetypes) {
    if (!a.clan) continue
    const c = byClan[a.clan] ?? { decks: 0, archetypes: 0 }
    c.decks += a.decks
    c.archetypes += 1
    byClan[a.clan] = c
  }
  const rows = Object.entries(byClan)
    .map(([clan, v]) => ({ clan, ...v, pct: sc.decks ? (v.decks / sc.decks) * 100 : 0 }))
    .sort((a, b) => b.decks - a.decks)
  const maxPct = Math.max(1, ...rows.map((r) => r.pct))
  const hidden = sc.decks - rows.reduce((n, r) => n + r.decks, 0)
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.clan} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 truncate text-slate-200" title={r.clan}>{r.clan}</span>
          <div className="flex-1">
            <Bar pct={(r.pct / maxPct) * 100} color={clanPaint(r.clan, 0, 6)} />
          </div>
          <span className="w-14 text-right tabular-nums font-semibold">{r.pct.toFixed(1)}%</span>
          <span className="w-36 text-right text-xs text-slate-500">{r.decks} decks · {r.archetypes} {r.archetypes === 1 ? 'archetype' : 'archetypes'}</span>
        </div>
      ))}
      {hidden > 0 && (
        <div className="text-[11px] text-slate-500 pt-1">
          {hidden} more decks are in archetypes with fewer than 3 decks and are not counted.
        </div>
      )}
    </div>
  )
}

// Same tier maths as TierRanking, as a list, so other cards can count tiers.
function tierRows(sc: ImpactScope) {
  const shown = sc.archetypes.filter((a) => a.name !== 'Unlisted' && a.name !== a.clan)
  const ratedRows = shown.filter((a) => a.strength != null)
  const ratedDecks = ratedRows.reduce((n, a) => n + (a.rated ?? a.decks), 0)
  const mean = ratedDecks ? ratedRows.reduce((n, a) => n + (a.strength as number) * (a.rated ?? a.decks), 0) / ratedDecks : 4
  const maxPct = Math.max(1, ...shown.map((a) => a.pct))
  const maxRating = Math.max(1, ...shown.map((a) => ratingOf(a, mean)))
  const scored = shown.map((a) => ({ a, score: scoreOf(a, mean, maxRating, maxPct) }))
  const best = Math.max(0.01, ...scored.map((r) => r.score))
  return scored.map((r) => ({ a: r.a, tier: (r.score >= best * TIER_CUTS.t1 ? 1 : r.score >= best * TIER_CUTS.t2 ? 2 : 3) as Tier }))
}

const NATION_OF_CLAN: Record<string, string> = {
  'Royal Paladin': 'United Sanctuary', 'Shadow Paladin': 'United Sanctuary', 'Gold Paladin': 'United Sanctuary',
  'Angel Feather': 'United Sanctuary', 'Genesis': 'United Sanctuary', 'Oracle Think Tank': 'United Sanctuary',
  'Kagero': 'Dragon Empire', 'Narukami': 'Dragon Empire', 'Murakumo': 'Dragon Empire',
  'Nubatama': 'Dragon Empire', 'Tachikaze': 'Dragon Empire',
  'Pale Moon': 'Dark Zone', 'Dark Irregulars': 'Dark Zone', 'Gear Chronicle': 'Dark Zone', 'Spike Brothers': 'Dark Zone',
  'Aqua Force': 'Magallanica', 'Bermuda Triangle': 'Magallanica', 'Granblue': 'Magallanica',
  'Neo Nectar': 'Zoo', 'Great Nature': 'Zoo', 'Megacolony': 'Zoo',
  'Nova Grappler': 'Star Gate', 'Dimension Police': 'Star Gate', 'Link Joker': 'Star Gate',
}
const nationOf = (clan: string) => NATION_OF_CLAN[clan] ?? 'Other'

function NationShare({ impact, scope }: { impact: ImpactFile | null; scope: Scope }) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  const byNation: Record<string, { decks: number; t1: number; t2: number }> = {}
  for (const a of sc.archetypes) {
    const key = nationOf(a.clan)
    const v = byNation[key] ?? { decks: 0, t1: 0, t2: 0 }
    v.decks += a.decks
    byNation[key] = v
  }
  for (const r of tierRows(sc)) {
    const v = byNation[nationOf(r.a.clan)]
    if (!v) continue
    if (r.tier === 1) v.t1 += 1
    else if (r.tier === 2) v.t2 += 1
  }
  const rows = Object.entries(byNation)
    .map(([nation, v]) => ({ nation, ...v, pct: sc.decks ? (v.decks / sc.decks) * 100 : 0 }))
    .sort((a, b) => b.decks - a.decks)
  const maxPct = Math.max(1, ...rows.map((r) => r.pct))
  const hidden = sc.decks - rows.reduce((n, r) => n + r.decks, 0)
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.nation} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 truncate text-slate-200" title={r.nation}>{r.nation}</span>
          <div className="flex-1">
            <Bar pct={(r.pct / maxPct) * 100} color={clanColor(r.nation)} />
          </div>
          <span className="w-14 text-right tabular-nums font-semibold">{r.pct.toFixed(1)}%</span>
          <span className="w-36 text-right text-xs text-slate-500">{r.decks} decks · T1 {r.t1} · T2 {r.t2}</span>
        </div>
      ))}
      {hidden > 0 && (
        <div className="text-[11px] text-slate-500 pt-1">
          {hidden} more decks are in archetypes with fewer than 3 decks and are not counted.
        </div>
      )}
    </div>
  )
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function archetypeOptions(impact: ImpactFile | null, scope: Scope): ImpactArchetypeRow[] {
  return [...(impact?.scopes[scope]?.archetypes ?? [])]
    .filter((a) => a.name !== 'Unlisted' && a.name !== a.clan)
    .sort((a, b) => b.decks - a.decks)
}

function ArchetypePicker({ options, value, onChange }: { options: ImpactArchetypeRow[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const needle = q.trim().toLowerCase()
  const shown = options.filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.clan.toLowerCase().includes(needle))
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQ('')
  }
  return (
        <div ref={box} className="relative w-64 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded border border-slate-700 bg-slate-900 text-sm text-slate-200 hover:border-slate-500"
      >
        <span className="truncate">{value || 'All decks'}</span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded border border-slate-700 bg-slate-950 shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter' && shown[0]) pick(shown[0].name)
            }}
            placeholder="Search archetypes or clans…"
            className="w-full px-3 py-1.5 text-sm bg-transparent border-b border-slate-800 outline-none text-slate-100 placeholder:text-slate-500"
          />
          <div className="sets-scroll max-h-64 overflow-y-auto">
            {!needle && (
              <button type="button" onClick={() => pick('')} className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800">
                All decks
              </button>
            )}
            {shown.map((a) => (
              <button
                key={a.name}
                type="button"
                onClick={() => pick(a.name)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                <CardPreview name={a.name} className="shrink-0 flex"><span className="block w-3.5 h-3.5 rounded-full" style={{ background: clanPaint(a.clan, 0, 3) }} /></CardPreview>
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-xs text-slate-500 tabular-nums">{a.decks}</span>
              </button>
            ))}
            {shown.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function CardUsageCard({ impact, scope, arch }: { impact: ImpactFile | null; scope: Scope; arch: string }) {
  const sc = impact?.scopes[scope]
  return (
    <Mock
      live
      title="1. Card usage"
      note="Most-played cards in the selected scope, or in one archetype's decks. Triggers are left out."
    >
      {(() => {
        const secs = sc?.card_usage?.[arch] ?? {}
        const labels: [string, string][] = [['vanguard', 'Starting vanguard'], ['main', 'Main deck'], ['stride', 'Stride deck']]
        const shown = labels.filter(([k]) => secs[k])
        const clan = arch ? sc?.archetypes.find((a) => a.name === arch)?.clan : ''
        const color = clan ? clanPaint(clan, 0, 6) : undefined
        if (shown.length === 0) return <p className="text-sm text-slate-500">No card data yet. Re-run build_set_impact.py.</p>
        return shown.map(([k, label]) => (
          <div key={k} className="mb-6 last:mb-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold text-slate-200">{label}</h3>
              <div className="flex-1 border-t border-slate-800" />
            </div>
            <CardUsage impact={impact} scope={scope} arch={arch} section={k} color={color} />
          </div>
        ))
      })()}
    </Mock>
  )
}

function CardUsage({ impact, scope, arch, section, color }: { impact: ImpactFile | null; scope: Scope; arch: string; section: string; color?: string }) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  const data = sc.card_usage?.[arch]?.[section]
  const rows = data?.rows ?? []
  const pool = data?.pool ?? 0
  const maxPct = Math.max(1, ...rows.map((x) => (pool ? (x.decks / pool) * 100 : 0)))
  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No card data yet. Re-run build_set_impact.py.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_8rem_1fr] gap-3 text-xs text-slate-500 px-1">
            <span>Card</span>
            <span className="text-right">Avg copies</span>
            <span>Decks running it</span>
          </div>
          {rows.map((r) => {
            const pct = pool ? (r.decks / pool) * 100 : 0
            const copies = r.decks ? r.copies / r.decks : 0
            const barColor = color ?? (r.clan ? clanPaint(r.clan, 0, 6) : undefined)
            return (
              <div key={r.name} className="grid grid-cols-[1fr_8rem_1fr] gap-3 items-center text-sm">
                <CardPreview name={r.name} className="truncate text-slate-200">{r.name}</CardPreview>
                <span className="flex items-center justify-end gap-2">
                  <span className="flex gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="w-2 h-3 rounded-sm bg-slate-800 overflow-hidden">
                        <span className="block h-full" style={{ width: `${Math.min(1, Math.max(0, copies - i)) * 100}%`, background: barColor ?? '#f59e0b' }} />
                      </span>
                    ))}
                  </span>
                  <span className="w-7 text-right tabular-nums">{copies.toFixed(1)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Bar pct={(pct / maxPct) * 100} color={barColor} />
                  </div>
                  <span className="shrink-0 flex items-baseline justify-end gap-1.5 text-xs tabular-nums">
                    <span className="text-right" style={{ width: `${String(pool).length * 2 + 1}ch` }}>{r.decks}/{pool}</span>
                    <span>·</span>
                    <span className="w-9 text-right">{pct.toFixed(0)}%</span>
                  </span>
                </div>
              </div>
            )
          })}
          <div className="text-[11px] text-slate-500 pt-2">
            Out of {pool} {arch ? `${arch} ` : ''}decks that list this section. Bars are scaled to the most-played card. Reprints count as one card.
          </div>
        </div>
      )}
    </div>
  )
}

function DeckShape({ impact, scope, arch }: { impact: ImpactFile | null; scope: Scope; arch: string }) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  const shape = sc.deck_shape?.[arch]
  if (!shape) return <p className="text-sm text-slate-500">No deck data for this selection yet. Re-run build_set_impact.py.</p>
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Trigger composition (avg per deck, {shape.decks} decks)</div>
        {TRIGGER_ROWS.map((t) => {
          const tv = shape.triggers[t.label]
          const avg = tv ? tv.copies / shape.decks : 0
          const pctDecks = tv ? Math.round((tv.decks / shape.decks) * 100) : 0
          return (
            <div key={t.label} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-20 flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TRIGGER_COLORS[t.label] }} />
                {t.label}
              </span>
              <div className="flex-1">
                <Bar pct={(avg / t.max) * 100} color={TRIGGER_COLORS[t.label]} />
              </div>
              <span className="w-32 text-right text-xs tabular-nums text-slate-400">
                {avg.toFixed(1)} · {pctDecks}% of decks
              </span>
            </div>
          )
        })}
        </div>
      <div className="md:col-span-2 md:row-start-2">
        <div className="text-xs font-semibold text-slate-400 mb-2">Staple triggers</div>
        <div className="flex flex-wrap gap-1.5">
          {shape.staples.map((s) => (
            <span key={s.name} className="px-2 py-0.5 rounded border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TRIGGER_COLORS[s.trigger] ?? '#64748b' }} />
              <CardPreview name={s.name}>{s.name}</CardPreview>
              <span className="text-slate-500 tabular-nums">{Math.round((s.decks / shape.decks) * 100)}%</span>
            </span>
          ))}
        </div>
      </div>
      <div className="md:col-start-2 md:row-start-1">
        <div className="text-xs font-semibold text-slate-400 mb-2">Grade curve (avg units per grade)</div>
        <div className="flex items-end h-48 gap-3">
          {GRADE_CURVE.map((g) => {
            const v = (shape.grades[g.g.replace('G', '').replace('+', '')] ?? 0) / shape.decks
            return (
              <div key={g.g} className="flex-1 h-full flex flex-col justify-end items-center">
                <span className="text-xs tabular-nums mb-1">{v.toFixed(1)}</span>
                <div className="w-full rounded-t bg-slate-500" style={{ height: `${Math.min(100, (v / 20) * 100)}%` }} />
                <span className="text-xs text-slate-400 mt-1">{g.g}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DriveOdds() {
  const [triggers, setTriggers] = useState(16)
  const [cards, setCards] = useState(50)
  const twin = atLeastOne(triggers, cards, 2)
  const triple = atLeastOne(triggers, cards, 3)
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-4 mb-4 text-sm">
        <label className="block">
          <span className="text-slate-400">Triggers in deck: <b className="text-slate-100">{triggers}</b></span>
          <input type="range" min={8} max={20} value={triggers} onChange={(e) => setTriggers(Number(e.target.value))} className="w-full accent-amber-400" />
        </label>
        <label className="block">
          <span className="text-slate-400">Cards in deck: <b className="text-slate-100">{cards}</b></span>
          <input type="range" min={40} max={50} value={cards} onChange={(e) => setCards(Number(e.target.value))} className="w-full accent-amber-400" />
        </label>
      </div>
      <div className="space-y-2 text-sm">
        {[
          { label: 'Twin drive (2 cards)', p: twin },
          { label: 'Triple drive (3 cards)', p: triple },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-48 text-slate-300">{r.label}</span>
            <div className="flex-1">
              <Bar pct={r.p * 100} color="#34d399" />
            </div>
            <span className="w-16 text-right tabular-nums font-semibold">{(r.p * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">These odds are real math, not sample data.</p>
    </div>
  )
}

function RideLines({ scope }: { scope: Scope }) {
  const seed = seedOf(scope)
  return (
    <div className="space-y-2">
      {DECKS.slice(0, 4).map((d, i) => (
        <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 font-semibold text-slate-200">{d}</span>
          {['G0', 'G1', 'G2', 'G3'].map((g, j) => (
            <span key={g} className="flex items-center gap-2">
              <span className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-xs">
                {g} · Unit {String.fromCharCode(65 + ((i + j + seed) % 6))}
                {j + 1}
              </span>
              {j < 3 && <span className="text-slate-600">→</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function DeckCompare({ scope }: { scope: Scope }) {
  const [a, setA] = useState(0)
  const [b, setB] = useState(1)
  const shared = Math.round(vary(12 + ((a * 3 + b * 5) % 9), scope, 70, 1))
  const select = (v: number, on: (n: number) => void) => (
    <select value={v} onChange={(e) => on(Number(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
      {DECKS.map((d, i) => (
        <option key={d} value={i}>
          {d}
        </option>
      ))}
    </select>
  )
  const rows = [
    ['Grade 0 units', 12, 10],
    ['Grade 1 units', 10, 11],
    ['Grade 2 units', 8, 9],
    ['Grade 3 units', 9, 8],
    ['Triggers', 16, 16],
  ] as const
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        {select(a, setA)}
        <span className="text-slate-500">vs</span>
        {select(b, setB)}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Stat label="Shared cards" value={shared} />
        <Stat label={`Only in ${DECKS[a]}`} value={50 - shared} />
        <Stat label={`Only in ${DECKS[b]}`} value={50 - shared} />
      </div>
      <div className="space-y-1 text-sm">
        <div className="grid grid-cols-[1fr_6rem_6rem] gap-3 text-xs text-slate-500">
          <span>Breakdown</span>
          <span className="text-right">{DECKS[a]}</span>
          <span className="text-right">{DECKS[b]}</span>
        </div>
        {rows.map(([label, x, y]) => (
          <div key={label} className="grid grid-cols-[1fr_6rem_6rem] gap-3 tabular-nums">
            <span className="text-slate-300">{label}</span>
            <span className="text-right">{x}</span>
            <span className="text-right">{y}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sets: set impact and archetypes ────────────────────────────────────────────
function ScopeNote({ impact, scope }: { impact: ImpactFile | null; scope: Scope }) {
  if (!impact) return <p className="text-sm text-slate-500">Loading tournament data…</p>
  if (!impact.scopes[scope]) return <p className="text-sm text-slate-500">No tournament decks for this era yet.</p>
  return null
}

function SetImpact({ impact, scope, otherOpen, onToggleOther }: {
  impact: ImpactFile | null; scope: Scope; otherOpen: boolean; onToggleOther: () => void
}) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  return (
    <div>
      <div className="sets-scroll overflow-y-auto pr-2 space-y-2 max-h-[24.5rem]">
        {sc.sets.map((s) => (
          <div key={s.code} className="h-8 flex items-center gap-3 text-sm">
            <span className="w-64 shrink-0 truncate text-slate-200" title={`[${s.code}] ${s.name}`}>
              [{s.code}] {s.name}
            </span>
            <div className="flex-1 min-w-0">
              <Bar pct={s.pct} />
            </div>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums whitespace-nowrap">
              {s.decks} · {s.pct}%
            </span>
          </div>
        ))}
      </div>
      {sc.other && (
        <div className="mt-2">
          <div className="sets-scroll overflow-hidden pr-2 h-8 flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={onToggleOther}
              className="w-64 shrink-0 flex items-center gap-2 text-left text-slate-200 hover:text-amber-200"
            >
              {otherOpen ? <IconChevronDown className="w-3.5 h-3.5 shrink-0" /> : <IconChevronRight className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">Other · {sc.other.set_count} {sc.other.set_count === 1 ? 'set' : 'sets'}</span>
            </button>
            <div className="flex-1 min-w-0">
              <Bar pct={sc.other.pct} color="#64748b" />
            </div>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums whitespace-nowrap">
              {sc.other.decks} · {sc.other.pct}%
            </span>
          </div>
          {otherOpen && (
            <div className="sets-scroll overflow-y-auto pr-2 space-y-2 mt-2 max-h-[24.5rem]">
              {sc.other.sets.map((s) => (
                <div key={s.code} className="h-8 flex items-center gap-3 text-sm">
                  <span className="w-64 shrink-0 truncate pl-5 text-slate-400" title={`[${s.code}] ${s.name}`}>
                    [{s.code}] {s.name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Bar pct={s.pct} color="#64748b" />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs tabular-nums whitespace-nowrap">
                    {s.decks} · {s.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TAG = 'px-2 py-0.5 rounded-full border border-sky-500/50 text-sky-300 text-xs tabular-nums'

const ARCH_GRID = 'grid grid-cols-[minmax(0,1fr)_9rem_3.75rem_5.25rem_4rem] items-center gap-x-2'

function ArchetypeList({ impact, scope }: { impact: ImpactFile | null; scope: Scope }) {
  const sc = impact?.scopes[scope]
  if (!impact || !sc) return <ScopeNote impact={impact} scope={scope} />
  return (
    <div>
      <div className="sets-scroll overflow-y-auto pr-2 space-y-2 max-h-[24.5rem]">
        {sc.archetypes.map((a) => (
          <div key={a.name} className={`${ARCH_GRID} h-8 text-sm`}>
            <CardPreview name={a.name} className="truncate font-semibold text-slate-100">{a.name}</CardPreview>
            <span className="min-w-0 flex justify-end">
              {a.clan && (
                <span
                  className="px-2 py-0.5 rounded-full border text-xs font-semibold inline-block max-w-full truncate align-middle"
                  style={{ background: `${clanColor(a.clan)}38`, borderColor: `${clanColor(a.clan)}99`, color: tagText(clanColor(a.clan), CLAN_ACCENT[a.clan]) }}
                  title={a.clan}
                >
                  {a.clan}
                </span>
              )}
            </span>
            <span className="flex justify-end">
              {a.set_code && (
                <span className={TAG} title={a.set_name}>{a.set_code}</span>
              )}
            </span>
            <span className="text-right text-xs tabular-nums text-slate-400 whitespace-nowrap">
              {a.decks} · {a.pct}%
            </span>
            <span className="flex justify-end">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-sky-500/50 text-sky-300 text-xs font-semibold tabular-nums"
                title="Placement rating, out of 10"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3" aria-hidden="true">
                  <path d="M3.75 13.5 14.25 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
                {a.strength == null ? '–' : (a.strength * 10 / 8).toFixed(1)}
              </span>
            </span>
          </div>
        ))}
      </div>
      {/* Footer row matches the height of the Other row on the left, so both columns line up */}
      <div className="mt-2 h-8 flex items-center text-xs text-slate-500">
        {sc.archetypes.length} archetypes with at least 3 decks
      </div>
    </div>
  )
}

// ── Sets browser helpers (unchanged) ───────────────────────────────────────────
function featuredCards(s: SetInfo, byNumber: Map<string, CardRecord>, n = 8): CardRecord[] {
  return (s.featured ?? []).map((x) => byNumber.get(x)).filter((c): c is CardRecord => !!c).slice(0, n)
}

function clanLine(cs: CardRecord[]): string {
  return cs.map((c) => c.clan).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ')
}

function SetCard({ set: s, era, byNumber, goSet, onZoom }: {
  set: SetInfo; era: string; byNumber: Map<string, CardRecord>;
  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void
}) {
  const feat = featuredCards(s, byNumber, 5)
  return (
    <button
      onClick={() => goSet(era, s.code)}
      className="text-left border border-slate-800 rounded-xl p-3 bg-slate-950/50 hover:border-amber-400/60 flex flex-col"
    >
      <div className="text-[15px] font-bold truncate" title={`[${s.code}] ${s.name}`}>[{s.code}] {s.name}</div>
      <div className="text-xs text-slate-500 mb-2">{s.kind} · {s.count} cards</div>
      <div className="grid grid-cols-5 gap-1.5 content-start">
        {feat.map((c) => (
          <span
            key={c.card_number}
            role="button"
            tabIndex={0}
            title={`${c.name} — click to zoom`}
            onClick={(e) => { e.stopPropagation(); onZoom(c) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onZoom(c) } }}
            className="block w-full rounded overflow-hidden border border-slate-800 hover:border-amber-300 bg-black cursor-zoom-in"
          >
            <CardImg src={thumbUrl(c)} alt={c.name} className="w-full aspect-[50/73] object-contain" />
          </span>
        ))}
      </div>
      <div className="text-xs text-slate-500 mt-2 line-clamp-2 leading-snug" title={clanLine(feat)}>{clanLine(feat)}</div>
    </button>
  )
}

function SetRow({ set: s, era, byNumber, goSet, onZoom, navCollapsed }: {
  set: SetInfo; era: string; byNumber: Map<string, CardRecord>;
  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void; navCollapsed: boolean
}) {
  const feat = featuredCards(s, byNumber, navCollapsed ? 8 : 6)
  return (
    <div className="flex items-center gap-4 border border-slate-800 rounded-xl px-5 py-4 bg-slate-950/50">
      <button onClick={() => goSet(era, s.code)} className="w-72 shrink-0 text-left">
        <div className="text-[15px] font-bold leading-snug">[{s.code}] {s.name}</div>
        <div className="text-xs text-slate-500 mt-1">{s.kind} · {s.count} cards → browse</div>
        <div className="text-xs text-slate-400 mt-1.5 leading-snug" title={clanLine(feat)}>{clanLine(feat)}</div>
      </button>
      <div className="flex-1 min-w-0">
        <div className="grid gap-2 overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fill, 112px)' }}>
          {feat.map((c) => (
            <span
              key={c.card_number}
              role="button"
              tabIndex={0}
              title={`${c.name} — click to zoom`}
              onClick={() => onZoom(c)}
              onKeyDown={(e) => { if (e.key === 'Enter') onZoom(c) }}
              className="cursor-zoom-in"
            >
              <span className="block rounded overflow-hidden border border-slate-800 hover:border-amber-300 bg-black">
                <CardImg src={thumbUrl(c)} alt={c.name} className="w-full aspect-[50/73] object-contain" />
              </span>
              <span className="block text-[11px] truncate text-slate-300 mt-0.5">{c.name}</span>
              <span className="block text-[10px] truncate text-slate-500">{c.clan ?? ''}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Scope picker (Overall or one era) ──────────────────────────────────────────
function ScopePicker({ eras, scope, onChange }: {
  eras: IndexMeta['eras']; scope: Scope; onChange: (s: Scope) => void
}) {
  const options: Scope[] = ['overall', ...eras.map((e) => e.name)]
  const setCode = scope.startsWith('set:') ? scope.slice(4) : ''
  const ownerEra = setCode ? eras.find((e) => e.sets.some((s) => s.code === setCode))?.name : undefined
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`text-sm px-2.5 py-1 rounded-full border ${scope === o ? 'bg-amber-400 border-amber-400 text-white font-semibold' : ownerEra === o ? 'bg-sky-900/60 border-sky-600 text-sky-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
        >
          {o === 'overall' ? 'Overall' : o}
        </button>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
function SetPicker({ eras, impact, scope, onChange }: {
  eras: IndexMeta['eras']; impact: ImpactFile | null; scope: Scope; onChange: (s: Scope) => void
}) {
  const code = scope.startsWith('set:') ? scope.slice(4) : ''
  const era = eras.find((e) => e.name === scope || (code !== '' && e.sets.some((s) => s.code === code)))
  if (!era || !impact) return null
  const sets = era.sets.filter((s) => impact.scopes[`set:${s.code}`])
  if (sets.length === 0) return null
  const chip = (on: boolean) =>
    `text-xs px-2 py-0.5 rounded-full border ${on ? 'bg-amber-400 border-amber-400 text-white font-semibold' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`
  return (
    <div className="flex flex-wrap gap-1.5 mb-4 items-center">
      <span className="text-xs text-slate-500 mr-1">By newest set:</span>
      <button onClick={() => onChange(era.name)} className={chip(scope === era.name)}>All of era</button>
      {sets.map((s) => (
        <button
          key={s.code}
          onClick={() => onChange(`set:${s.code}`)}
          className={chip(scope === `set:${s.code}`)}
          title={`${s.name} · ${impact.scopes[`set:${s.code}`].decks} decks`}
        >
          {s.code}
        </button>
      ))}
    </div>
  )
}

export default function SetsPage({ meta, byNumber, goSet, onZoom, navCollapsed }: Props) {
  const [section, setSection] = useState<Section>('sets')
  const [metaScope, setMetaScope] = useState<Scope>('overall')
  const [statsScope, setStatsScope] = useState<Scope>('overall')
  const [statsArch, setStatsArch] = useState('')
  const [windowKey, setWindowKey] = useState<WindowKey>('all')
  const [view, setView] = useState<'cards' | 'rows'>('cards')
  const [setsScope, setSetsScope] = useState<Scope>('overall')
  const [impactOpen, setImpactOpen] = useState(true)
  const [otherOpen, setOtherOpen] = useState(false)
  const [openEras, setOpenEras] = useState<Set<string>>(new Set(meta.eras.map((e) => e.name)))
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set(meta.eras.flatMap((e) => e.sets.map((s) => `${e.name}::${s.kind}`))))

  useMemo(() => {
    const m = new Map<string, CardRecord>()
    for (const c of byNumber.values()) if (!m.has(c.name)) m.set(c.name, c)
    CARD_BY_NAME = m
    CARD_ZOOM = onZoom
  }, [byNumber, onZoom])

  const [impact, setImpact] = useState<ImpactFile | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/card-images/Decks/set_impact.json')
      .then((r) => (r.ok ? (r.json() as Promise<ImpactFile>) : null))
      .then((j) => {
        if (alive) setImpact(j)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const impactScope = impact?.scopes[setsScope]

  const toggle = (set: Set<string>, v: string, apply: (n: Set<string>) => void) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    apply(n)
  }

  const anyOpen = impactOpen || openEras.size > 0
  const toggleAll = () => {
    if (anyOpen) {
      setImpactOpen(false)
      setOtherOpen(false)
      setOpenEras(new Set())
      setOpenKinds(new Set())
    } else {
      setImpactOpen(true)
      setOpenEras(new Set(meta.eras.map((e) => e.name)))
      setOpenKinds(new Set(meta.eras.flatMap((e) => e.sets.map((s) => `${e.name}::${s.kind}`))))
    }
  }

  return (
    <div className="sets-scroll flex-1 overflow-y-auto p-4 min-h-0">
      <style>{`
        .sets-scroll { scrollbar-width: thin; scrollbar-color: #475569 transparent; scrollbar-gutter: stable; }
        .sets-scroll::-webkit-scrollbar { width: 6px; }
        .sets-scroll::-webkit-scrollbar-track { background: transparent; }
        .sets-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 999px; }
        .sets-scroll::-webkit-scrollbar-button { display: none; }
      `}</style>
      <h1 className="text-2xl font-bold text-slate-100 mb-4">Sets &amp; Stats</h1>

      {/* Sub-tabs (same style as the Decks page) */}
      <div className="flex gap-1 mb-6 border-b border-slate-800">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t ${section === s.id ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'sets' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
              {(['cards', 'rows'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1 ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  {v === 'cards' ? 'Grid' : 'Rows'}
                </button>
              ))}
            </div>
            <button
              onClick={toggleAll}
              className="text-sm px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {anyOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          <section className="border border-slate-700 rounded-xl bg-slate-950/50 mb-6">
            <button
              type="button"
              onClick={() => setImpactOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 p-4 text-left"
            >
              <span className="flex items-center gap-2">
                {impactOpen ? <IconChevronDown className="w-4 h-4" /> : <IconChevronRight className="w-4 h-4" />}
                <span className="text-lg font-bold text-slate-100">Set impact &amp; archetypes</span>
              </span>
            </button>
            {impactOpen && (
              <div className="px-4 pb-5">
                <ScopePicker eras={meta.eras} scope={setsScope} onChange={setSetsScope} />
                <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">Set impact</h3>
                    <div className="flex items-center justify-between gap-4 mb-3 min-h-[2rem]">
                      <p className="min-w-0 flex-1 text-xs text-slate-500">Tournament decks that run at least one card from each set</p>
                      {impactScope && (
                        <div className="shrink-0 h-6 flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                          <span>{impactScope.decks} tournament decks</span>
                          {impactScope.low_sample && (
                            <span className="px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-300">low sample</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="sets-scroll overflow-hidden pr-2 flex items-center gap-3 text-xs text-slate-500 mb-1">
                      <span className="w-64 shrink-0">Set</span>
                      <span className="flex-1" />
                      <span className="w-28 shrink-0 text-right">Decks · Share</span>
                    </div>
                    <SetImpact impact={impact} scope={setsScope} otherOpen={otherOpen} onToggleOther={() => setOtherOpen((o) => !o)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">Archetypes using these sets</h3>
                    <p className="text-xs text-slate-500 mb-3 min-h-[2rem]">
                      Rating is based on placements, out of 10. Clicks not wired yet.
                    </p>
                    <div className={`${ARCH_GRID} sets-scroll overflow-hidden text-xs text-slate-500 mb-1 pr-2`}>
                      <span>Archetype</span>
                      <span className="text-right">Clan</span>
                      <span className="text-right">Set</span>
                      <span className="text-right">Decks · Share</span>
                      <span className="text-right">Rating</span>
                    </div>
                    <ArchetypeList impact={impact} scope={setsScope} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {meta.eras.map((e) => {
            const eraOpen = openEras.has(e.name)
            return (
              <div key={e.name} className="mb-5">
                <button onClick={() => toggle(openEras, e.name, setOpenEras)} className="flex items-center gap-2 text-base font-semibold text-amber-200 mb-2 hover:text-amber-100">
                  {eraOpen ? <IconChevronDown className="w-4 h-4" /> : <IconChevronRight className="w-4 h-4" />}
                  {e.name} <span className="text-slate-500 font-normal text-sm">({e.sets.length} sets)</span>
                </button>
                {eraOpen && KIND_ORDER.filter((k) => e.sets.some((s) => s.kind === k)).map((k) => {
                  const sets = e.sets.filter((s) => s.kind === k)
                  const kindKey = `${e.name}::${k}`
                  const kindOpen = openKinds.has(kindKey)
                  return (
                    <div key={k} className="mb-3">
                      <button onClick={() => toggle(openKinds, kindKey, setOpenKinds)} className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 hover:text-slate-300">
                        {kindOpen ? <IconChevronDown /> : <IconChevronRight />}
                        {k}s <span className="font-normal">({sets.length})</span>
                      </button>
                      {kindOpen && (view === 'cards' ? (
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                          {sets.map((s) => (
                            <SetCard key={s.code} set={s} era={e.name} byNumber={byNumber} goSet={goSet} onZoom={onZoom} />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {sets.map((s) => (
                            <SetRow key={s.code} set={s} era={e.name} byNumber={byNumber} goSet={goSet} onZoom={onZoom} navCollapsed={navCollapsed} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}

      {section === 'meta' && (
        <>
          <div className="sticky -top-4 z-30 -mx-4 px-4 pt-4 pb-2 bg-black">
          <ScopePicker eras={meta.eras} scope={metaScope} onChange={setMetaScope} />
          <SetPicker eras={meta.eras} impact={impact} scope={metaScope} onChange={setMetaScope} />
          </div>
                    <Mock live title="1. Archetype share" note="Share of tournament decks by archetype for the selected scope.">
            <ArchetypeShare impact={impact} scope={metaScope} />
          </Mock>
          <Mock live title="2. Tier ranking" note="Archetypes grouped by tier, with placement rating and deck share.">
            <TierRanking impact={impact} scope={metaScope} />
          </Mock>
          <Mock live title="3. Time window" note="How each archetype's share moves between all time and the newest tournament year in the scope. Change is shown in points.">            
            <TimeWindow impact={impact} scope={metaScope} windowKey={windowKey} onChange={setWindowKey} />
          </Mock>
          <Mock live title="4. Clan distribution" note="Share of tournament decks by clan for the selected scope.">
            <ClanShare impact={impact} scope={metaScope} />
          </Mock>
          <Mock live title="5. Nation distribution" note="Share of tournament decks by nation for the selected scope, with tier counts.">
            <NationShare impact={impact} scope={metaScope} />
          </Mock>
        </>
      )}

      {section === 'stats' && (
        <>
          <div className="sticky -top-4 z-30 -mx-4 px-4 pt-4 pb-2 bg-black">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <ScopePicker eras={meta.eras} scope={statsScope} onChange={(s) => { setStatsScope(s); setStatsArch('') }} />
              </div>
              <ArchetypePicker options={archetypeOptions(impact, statsScope)} value={statsArch} onChange={setStatsArch} />
            </div>
            <SetPicker eras={meta.eras} impact={impact} scope={statsScope} onChange={(s) => { setStatsScope(s); setStatsArch('') }} />
          </div>
          <CardUsageCard impact={impact} scope={statsScope} arch={statsArch} />
          <Mock live title="2. Deck shape" note="Trigger composition, staple triggers, and grade curve for the selected scope or archetype.">
            <DeckShape impact={impact} scope={statsScope} arch={statsArch} />
          </Mock>
          <Mock title="3. Drive check odds" note="Chance of hitting at least one trigger on a drive check. Interactive.">
            <DriveOdds />
          </Mock>
          <Mock title="4. Ride lines" note="Most-run unit at each grade for each archetype.">
            <RideLines scope={statsScope + '|' + statsArch} />
          </Mock>
          <Mock title="5. Deck compare" note="Pick two archetypes to compare shared and unique cards.">
            <DeckCompare scope={statsScope} />
          </Mock>
        </>
      )}
    </div>
  )
}