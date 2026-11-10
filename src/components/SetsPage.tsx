import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CardRecord, IndexMeta, SetInfo } from '../lib/types.ts'
import { thumbUrl } from '../lib/types.ts'
import CardImg from './CardImg.tsx'
import { IconChevronDown, IconChevronRight } from './icons.tsx'

const KIND_ORDER = ['Booster', 'Extra Booster', 'Character Booster', 'Comic Booster', 'Fighters Collection', 'Deck', 'Promo', 'Event Promo', 'Other']

type Section = 'sets' | 'meta' | 'stats'
type Scope = 'overall' | string
type WindowKey = 'all' | '30d' | 'banlist'
type Tier = 1 | 2 | 3

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'sets', label: 'Sets' },
  { id: 'meta', label: 'Meta' },
  { id: 'stats', label: 'Stats' },
]

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: 'Last 30 days' },
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
  strength: number
}
interface ImpactScope {
  decks: number
  low_sample: boolean
  sets: ImpactSet[]
  other: ImpactOther | null
  archetypes: ImpactArchetypeRow[]
}
interface ImpactFile { generated: string; decks_total: number; scopes: Record<string, ImpactScope> }

// ── Sample data (placeholders, not real results) ───────────────────────────────
const PALETTE = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#f87171', '#facc15', '#60a5fa']
const DECKS = ['Deck A', 'Deck B', 'Deck C', 'Deck D', 'Deck E', 'Deck F', 'Deck G', 'Deck H']
const DECK_TIER: Tier[] = [1, 1, 1, 2, 2, 2, 3, 3]
const DECK_SHARE = [20, 14, 10, 9, 8, 6, 4, 3]
const NATIONS = ['Nation A', 'Nation B', 'Nation C', 'Nation D', 'Nation E', 'Nation F']
const NATION_SHARE = [30, 22, 18, 14, 10, 6]
const CARDS = Array.from({ length: 10 }, (_, i) => `Card ${String(i + 1).padStart(2, '0')}`)
const CARD_COPIES = [3.9, 3.7, 3.4, 3.0, 2.6, 2.2, 2.0, 1.5, 1.0, 0.8]
const CARD_PCT = [92, 85, 80, 70, 62, 55, 48, 40, 33, 25]
const TRIGGER_ROWS = [
  { label: 'Critical', max: 8, avg: 7.7, pct: 100 },
  { label: 'Draw', max: 8, avg: 0.9, pct: 33 },
  { label: 'Front', max: 8, avg: 3.2, pct: 90 },
  { label: 'Heal', max: 4, avg: 3.7, pct: 100 },
  { label: 'Over', max: 1, avg: 0.9, pct: 87 },
]
const STAPLE_TRIGGERS = ['Trigger A', 'Trigger B', 'Trigger C', 'Trigger D', 'Trigger E', 'Trigger F']
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

interface SampleDeck {
  name: string
  tier: Tier
  share: number
  delta: number
}

function sampleDecks(scope: Scope): SampleDeck[] {
  return DECKS.map((name, i) => ({
    name,
    tier: DECK_TIER[i],
    share: Math.round(vary(DECK_SHARE[i], scope, i, 1)),
    delta: Math.round(vary(0, scope, i + 20, 2)),
  }))
}

function windowShare(d: SampleDeck, w: WindowKey): number {
  if (w === '30d') return Math.max(0, d.share + d.delta)
  if (w === 'banlist') return Math.max(0, d.share - d.delta)
  return d.share
}

/** Exact odds of at least one trigger among n cards drawn from a deck of d cards with t triggers. */
function atLeastOne(t: number, d: number, n: number): number {
  let none = 1
  for (let i = 0; i < n; i++) none *= Math.max(0, d - t - i) / (d - i)
  return 1 - none
}

// ── Small building blocks ──────────────────────────────────────────────────────
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

function Mock({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 mb-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-base font-bold text-slate-100">{title}</h2>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-dashed border-amber-400/50 text-amber-300">
          Mockup
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4">{note}</p>
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

function Donut({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1
  const C = 2 * Math.PI * 40
  let acc = 0
  return (
    <svg viewBox="0 0 100 100" className="w-44 h-44 shrink-0">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="16" />
      {parts.map((p, i) => {
        const len = (p.value / total) * C
        const offset = acc
        acc += len
        return (
          <circle
            key={p.label}
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth="16"
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        )
      })}
      <text x="50" y="50" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 7 }}>
        sample
      </text>
    </svg>
  )
}

// ── Meta ───────────────────────────────────────────────────────────────────────
function ArchetypeShare({ decks }: { decks: SampleDeck[] }) {
  return (
    <div className="flex flex-wrap gap-6 items-center">
      <Donut parts={decks.map((d) => ({ label: d.name, value: d.share }))} />
      <div className="flex-1 min-w-[16rem] space-y-1.5">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex-1">Deck</span>
          <span className="w-10">Tier</span>
          <span className="w-14 text-right">Share</span>
          <span className="w-20 text-right">Decks</span>
        </div>
        {decks.map((d, i) => (
          <div key={d.name} className="flex items-center gap-3 text-sm">
            <span className="flex-1 flex items-center gap-2 text-slate-200">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              {d.name}
            </span>
            <span className="w-10 text-xs text-slate-500">T{d.tier}</span>
            <span className="w-14 text-right font-semibold tabular-nums">{d.share}%</span>
            <span className="w-20 text-right text-xs text-slate-500">{Math.round(d.share * 3)} decks</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TierRanking({ decks }: { decks: SampleDeck[] }) {
  const TIER_LABEL: Record<Tier, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }
  const tiers: Tier[] = [1, 2, 3]
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Tier rule is a placeholder. Final thresholds will live in one config file.
      </p>
      {tiers.map((t) => (
        <div key={t}>
          <div className="text-sm font-semibold text-amber-200 mb-2">{TIER_LABEL[t]}</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {decks.filter((d) => d.tier === t).map((d) => (
              <div key={d.name} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-100">{d.name}</span>
                  <span className="text-xs text-slate-400 tabular-nums">Power {(d.share * 0.9).toFixed(1)}</span>
                </div>
                <Bar pct={d.share * 3} />
                <div className="text-[11px] text-slate-500 mt-2 tabular-nums">
                  1st {Math.round(d.share * 0.5)} · 2nd {Math.round(d.share * 0.35)} · 3rd {Math.round(d.share * 0.6)} · 4th {Math.round(d.share * 0.8)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TimeWindow({ decks, windowKey, onChange }: { decks: SampleDeck[]; windowKey: WindowKey; onChange: (w: WindowKey) => void }) {
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
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex-1">Deck</span>
          <span className="w-24 text-right">All time</span>
          <span className="w-24 text-right">Window</span>
          <span className="w-20 text-right">Change</span>
        </div>
        {decks.map((d) => {
          const w = windowShare(d, windowKey)
          const change = w - d.share
          return (
            <div key={d.name} className="flex items-center gap-3 text-sm">
              <span className="flex-1 text-slate-200">{d.name}</span>
              <span className="w-24 text-right tabular-nums text-slate-500">{d.share}%</span>
              <span className="w-24 text-right tabular-nums font-semibold">{w}%</span>
              <span
                className={`w-20 text-right tabular-nums text-xs ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-rose-400' : 'text-slate-500'}`}
              >
                {change > 0 ? `+${change}` : change}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NationShare({ scope }: { scope: Scope }) {
  return (
    <div className="space-y-2">
      {NATIONS.map((n, i) => {
        const share = Math.round(vary(NATION_SHARE[i], scope, i + 60, 2))
        return (
          <div key={n} className="flex items-center gap-3 text-sm">
            <span className="w-24 text-slate-200">{n}</span>
            <div className="flex-1">
              <Bar pct={share * 2} color={PALETTE[i % PALETTE.length]} />
            </div>
            <span className="w-12 text-right tabular-nums font-semibold">{share}%</span>
            <span className="w-28 text-right text-xs text-slate-500">
              T1 {Math.max(0, 2 - i)} · T2 {Math.max(0, 3 - i)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function CardUsage({ scope }: { scope: Scope }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_5rem_1fr] gap-3 text-xs text-slate-500 px-1">
        <span>Card</span>
        <span className="text-right">Copies/deck</span>
        <span>Decks running it</span>
      </div>
      {CARDS.map((c, i) => {
        const pct = Math.min(100, Math.round(vary(CARD_PCT[i], scope, i + 30, 3)))
        const copies = vary(CARD_COPIES[i], scope, i + 30, 0.3).toFixed(1)
        return (
          <div key={c} className="grid grid-cols-[1fr_5rem_1fr] gap-3 items-center text-sm">
            <span className="text-slate-200">{c}</span>
            <span className="text-right tabular-nums">{copies}</span>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Bar pct={pct} />
              </div>
              <span className="w-10 text-right text-xs tabular-nums">{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DeckShape({ scope }: { scope: Scope }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Trigger composition (avg per deck)</div>
        {TRIGGER_ROWS.map((t, i) => {
          const avg = vary(t.avg, scope, i + 40, 0.2)
          return (
            <div key={t.label} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-16 text-slate-300">{t.label}</span>
              <div className="flex-1">
                <Bar pct={(avg / t.max) * 100} />
              </div>
              <span className="w-32 text-right text-xs tabular-nums text-slate-400">
                {avg.toFixed(1)} · {t.pct}% of decks
              </span>
            </div>
          )
        })}
        <div className="text-xs font-semibold text-slate-400 mt-4 mb-2">Staple triggers</div>
        <div className="flex flex-wrap gap-1.5">
          {STAPLE_TRIGGERS.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded border border-slate-700 text-xs text-slate-300">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Grade curve (avg units per grade)</div>
        <div className="flex items-end h-48 gap-3">
          {GRADE_CURVE.map((g, i) => {
            const v = vary(g.v, scope, i + 50, 1)
            return (
              <div key={g.g} className="flex-1 h-full flex flex-col justify-end items-center">
                <span className="text-xs tabular-nums mb-1">{v.toFixed(1)}</span>
                <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${Math.min(100, (v / 20) * 100)}%` }} />
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
            <span className="truncate font-semibold text-slate-100" title={a.name}>{a.name}</span>
            <span className="min-w-0 flex justify-end">
              {a.clan && (
                <span className={`${TAG} inline-block max-w-full truncate align-middle`} title={a.clan}>{a.clan}</span>
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
                {(a.strength * 10 / 8).toFixed(1)}
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
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`text-sm px-2.5 py-1 rounded-full border ${scope === o ? 'bg-amber-400 border-amber-400 text-white font-semibold' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
        >
          {o === 'overall' ? 'Overall' : o}
        </button>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SetsPage({ meta, byNumber, goSet, onZoom, navCollapsed }: Props) {
  const [section, setSection] = useState<Section>('sets')
  const [metaScope, setMetaScope] = useState<Scope>('overall')
  const [statsScope, setStatsScope] = useState<Scope>('overall')
  const [windowKey, setWindowKey] = useState<WindowKey>('all')
  const [view, setView] = useState<'cards' | 'rows'>('cards')
  const [setsScope, setSetsScope] = useState<Scope>('overall')
  const [impactOpen, setImpactOpen] = useState(true)
  const [otherOpen, setOtherOpen] = useState(false)
  const [openEras, setOpenEras] = useState<Set<string>>(new Set(meta.eras.map((e) => e.name)))
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set(meta.eras.flatMap((e) => e.sets.map((s) => `${e.name}::${s.kind}`))))

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
          <ScopePicker eras={meta.eras} scope={metaScope} onChange={setMetaScope} />
          <Mock title="1. Archetype share" note="Donut and ranked table for the selected scope.">
            <ArchetypeShare decks={sampleDecks(metaScope)} />
          </Mock>
          <Mock title="2. Tier ranking" note="Decks grouped by tier, with power score and placement counts.">
            <TierRanking decks={sampleDecks(metaScope)} />
          </Mock>
          <Mock title="3. Time window" note="Switch the window to see how shares move. Change is shown in points.">
            <TimeWindow decks={sampleDecks(metaScope)} windowKey={windowKey} onChange={setWindowKey} />
          </Mock>
          <Mock title="4. Nation distribution" note="Share of top decks by nation, with tier counts per nation.">
            <NationShare scope={metaScope} />
          </Mock>
        </>
      )}

      {section === 'stats' && (
        <>
          <ScopePicker eras={meta.eras} scope={statsScope} onChange={setStatsScope} />
          <Mock title="1. Card usage" note="How many decks run each card and how many copies on average.">
            <CardUsage scope={statsScope} />
          </Mock>
          <Mock title="2. Deck shape" note="Trigger composition, staple triggers, and grade curve.">
            <DeckShape scope={statsScope} />
          </Mock>
          <Mock title="3. Drive check odds" note="Chance of hitting at least one trigger on a drive check. Interactive.">
            <DriveOdds />
          </Mock>
          <Mock title="4. Ride lines" note="Most-run unit at each grade for each archetype.">
            <RideLines scope={statsScope} />
          </Mock>
          <Mock title="5. Deck compare" note="Pick two archetypes to compare shared and unique cards.">
            <DeckCompare scope={statsScope} />
          </Mock>
        </>
      )}
    </div>
  )
}