import { useEffect, useMemo, useState } from 'react'
import type { CardRecord } from '../lib/types.ts'
import { thumbUrl, fullUrl } from '../lib/types.ts'
import CardImg from './CardImg.tsx'
import { IconCopy, IconPrinter, IconTrash } from './icons.tsx'
import { deckCover, type SavedDeck } from './DeckBuilder.tsx'
import type { IndexMeta } from '../lib/types.ts'

// ── Types ──────────────────────────────────────────────────────────────────────
type DecksSub = 'mine' | 'official' | 'tournament' | 'community'
type OfficialKind = 'trial' | 'icon' | 'legend' | 'other'

const KIND_LABELS: Record<OfficialKind, string> = {
  trial: 'Trial Decks',
  icon: 'Icon Decks',
  legend: 'Legend Decks',
  other: 'Other Prebuilt',
}

// ── Deck Records ──────────────────────────────────────────────────────────────────────
export interface PreconRecord extends SavedDeck {
  kind: OfficialKind
  set: string
  clan?: string
  preview?: string[]
}

interface TournamentDeckRecord {
  event_url: string
  placement: string
  format: string
  deck_code: string
  decklog_url: string
  title: string
  series: string
  nation: string
  clan?: string
  year?: string | number
  main: Record<string, number>
  g_zone: Record<string, number>
}

type TGroup = {
  key: string
  items: TournamentDeckRecord[]
  subgroups: { key: string; items: TournamentDeckRecord[] }[] | null
}

function tournamentToPrecon(d: TournamentDeckRecord): PreconRecord {
  return {
    id: d.deck_code,
    name: d.title || `${d.nation} (${d.deck_code})`,
    kind: 'other' as OfficialKind,
    set: d.deck_code,
    clan: d.nation || undefined,
    formatId: d.format.toLowerCase(),
    strictness: 'strict',
    region: 'EN',
    asOf: '',
    asOfPreset: '',
    starter: Object.keys(d.main)[0] ?? null,
    cover: Object.keys(d.main)[0] ?? null,
    updatedAt: 0,
    main: d.main,
    preview: Object.keys(d.main).slice(0, 6),
  } as unknown as PreconRecord
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function deckMainClan(d: SavedDeck, byNumber: Map<string, CardRecord>): string {
  const m = new Map<string, number>()
  for (const [num, n] of Object.entries(d.main)) {
    const c = byNumber.get(num)
    const k = c?.clan ?? 'No clan'
    m.set(k, (m.get(k) ?? 0) + n)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No clan'
}

function deckEra(d: SavedDeck, meta: IndexMeta): string {
  const eraCounts = new Map<string, number>()
  for (const [cardNum, count] of Object.entries(d.main)) {
    const setCode = cardNum.split('/')[0]
    for (const era of meta.eras) {
      if (era.sets.some((s) => s.code === setCode)) {
        eraCounts.set(era.name, (eraCounts.get(era.name) ?? 0) + count)
        break
      }
    }
  }
  if (eraCounts.size === 0) return 'Unknown'
  return [...eraCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

function preconFeatured(deck: PreconRecord, byNumber: Map<string, CardRecord>, count: number): CardRecord[] {
  const out: CardRecord[] = []
  const seen = new Set<string>()

  const add = (num: string | null | undefined) => {
    if (!num) return
    const c = byNumber.get(num)
    if (c && !seen.has(num)) { seen.add(num); out.push(c) }
  }

  add(deck.cover)
  add(deck.starter)

  if (deck.preview) {
    for (const num of deck.preview) {
      if (out.length >= count) break
      add(num)
    }
  }

  if (out.length < count) {
    const rest = Object.keys(deck.main).filter((num) => !seen.has(num)).sort()
    for (const num of rest) {
      if (out.length >= count) break
      add(num)
    }
  }

  return out.slice(0, count)
}

const uid = () => Math.random().toString(36).slice(2, 10)

// ── Deck Modal ─────────────────────────────────────────────────────────────────
function DeckModal({ deck, byNumber, onClose, onAddToDeck }: {
  deck: PreconRecord
  byNumber: Map<string, CardRecord>
  onClose: () => void
  onAddToDeck: (d: SavedDeck) => void
}) {
  const [cols, setCols] = useState(8)
  const [sortBy, setSortBy] = useState<'number' | 'grade' | 'power' | 'name' | 'trigger'>('grade')
  const [groupBy, setGroupBy] = useState<'none' | 'grade' | 'type' | 'trigger'>('none')
  const [sortAsc, setSortAsc] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'individual' | 'stacked'>('individual')
  const [zoomed, setZoomed] = useState<CardRecord | null>(null)

  const entries = useMemo(() => {
    const raw = Object.entries(deck.main)
      .map(([num, n]) => ({ c: byNumber.get(num), n }))
      .filter((x): x is { c: CardRecord; n: number } => !!x.c)
    raw.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'grade': cmp = (b.c.grade ?? 0) - (a.c.grade ?? 0) || a.c.name.localeCompare(b.c.name); break
        case 'power': cmp = (b.c.power ?? 0) - (a.c.power ?? 0) || a.c.name.localeCompare(b.c.name); break
        case 'name': cmp = a.c.name.localeCompare(b.c.name); break
        case 'trigger': cmp = (a.c.trigger_type ?? '').localeCompare(b.c.trigger_type ?? '') || a.c.name.localeCompare(b.c.name); break
        default: cmp = a.c.card_number.localeCompare(b.c.card_number)
      }
      return sortAsc ? cmp : -cmp
    })
    return raw
  }, [deck, byNumber, sortBy, sortAsc])

  const total = Object.values(deck.main).reduce((s, n) => s + n, 0)
  const isEmpty = total === 0

  const handleAddToDeck = () => {
    const copied: SavedDeck = {
      ...deck,
      id: uid(),
      name: deck.name,
      starter: deck.starter,
      cover: deck.cover ?? null,
      updatedAt: Date.now(),
    }
    onAddToDeck(copied)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-800 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-slate-100 truncate">{deck.name}</div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {deck.clan ?? ''}{deck.clan ? ' · ' : ''}{deck.set} · {total > 0 ? `${total}/50 cards` : 'deck list coming soon'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded overflow-hidden border border-slate-700 text-xs">
              <button onClick={() => setViewMode('individual')} className={`px-2.5 py-1 ${viewMode === 'individual' ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>Spread</button>
              <button onClick={() => setViewMode('stacked')} className={`px-2.5 py-1 ${viewMode === 'stacked' ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>Stack</button>
            </div>
            <select value={groupBy} onChange={(e) => { setGroupBy(e.target.value as typeof groupBy); setCollapsed(new Set()) }} className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300">
              <option value="none">Group by</option>
              <option value="grade">Grade</option>
              <option value="type">Unit type</option>
              <option value="trigger">Trigger</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300">
              <option value="number">Sort by</option>
              <option value="name">Name</option>
              <option value="grade">Grade</option>
              <option value="power">Power</option>
              <option value="trigger">Trigger</option>
            </select>
            <button onClick={() => setSortAsc((v) => !v)} title={sortAsc ? 'Ascending' : 'Descending'} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500 text-slate-300 text-sm">
              {sortAsc ? '↑' : '↓'}
            </button>
            <div className="flex items-center gap-1 text-sm text-slate-300">
              <button onClick={() => setCols((v) => Math.max(3, v - 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
              <span className="w-6 text-center">{cols}</span>
              <button onClick={() => setCols((v) => Math.min(12, v + 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-2">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isEmpty ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Deck list coming soon.</div>
          ) : (() => {
            const cardTile = (c: CardRecord, k: number) => (
              <div key={`${c.card_number}#${k}`} onClick={() => setZoomed(c)} className="group/tile relative rounded overflow-hidden ring-1 ring-slate-800 hover:ring-amber-400/60 cursor-zoom-in">
                <div className="w-full aspect-[50/73] bg-black">
                  <CardImg src={thumbUrl(c)} alt={c.name} className="w-full h-full object-contain" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-white text-[10px] font-medium truncate">{c.name}</div>
              </div>
            )

            const stackedTile = (c: CardRecord, n: number) => (
              <div key={c.card_number} onClick={() => setZoomed(c)} className="group/tile relative rounded overflow-hidden ring-1 ring-slate-800 hover:ring-amber-400/60 cursor-zoom-in">
                <div className="w-full aspect-[50/73] bg-black">
                  <CardImg src={thumbUrl(c)} alt={c.name} className="w-full h-full object-contain" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-white text-[10px] font-medium flex items-center justify-between">
                  <span className="truncate mr-1">{c.name}</span>
                  <span className="shrink-0 text-amber-300 font-bold">{n}x</span>
                </div>
              </div>
            )

            const renderGrid = (items: { c: CardRecord; n: number }[]) => (
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {viewMode === 'individual'
                  ? items.flatMap(({ c, n }) => Array.from({ length: n }, (_, k) => cardTile(c, k)))
                  : items.map(({ c, n }) => stackedTile(c, n))
                }
              </div>
            )

            if (groupBy === 'none') return renderGrid(entries)

            const getGroupKey = (c: CardRecord) => {
              if (groupBy === 'grade') return `Grade ${c.grade ?? '?'}`
              if (groupBy === 'type') return c.card_type ?? 'Unknown'
              if (groupBy === 'trigger') return c.card_type === 'Trigger Unit' ? (c.trigger_type ?? 'Trigger') : 'Non-Trigger'
              return ''
            }

            const grouped = new Map<string, { c: CardRecord; n: number }[]>()
            for (const e of entries) {
              const k = getGroupKey(e.c)
              if (!grouped.has(k)) grouped.set(k, [])
              grouped.get(k)!.push(e)
            }

            return (
              <div className="space-y-4">
                {[...grouped.entries()].map(([label, items]) => {
                  const isCollapsed = collapsed.has(label)
                  return (
                    <div key={label}>
                      <button
                        onClick={() => setCollapsed((p) => { const n = new Set(p); if (n.has(label)) n.delete(label); else n.add(label); return n })}
                        className="flex items-center gap-2 text-xs font-semibold text-amber-200 uppercase tracking-wider mb-2 hover:text-amber-100 w-full text-left"
                      >
                        <span>{isCollapsed ? '▸' : '▾'}</span>
                        <span>{label}</span>
                        <span className="text-slate-500 normal-case">({items.reduce((s, x) => s + x.n, 0)})</span>
                      </button>
                      {!isCollapsed && renderGrid(items)}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Lightbox */}
        {zoomed && (
          <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-6" onClick={() => setZoomed(null)}>
            <img src={fullUrl(zoomed)} alt={zoomed.name} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
            <div className="absolute bottom-4 text-sm text-slate-400">{zoomed.name} · {zoomed.card_number} — click anywhere to close</div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <button onClick={handleAddToDeck} disabled={isEmpty} className="px-4 py-2 rounded-lg bg-amber-400 text-white font-semibold text-sm hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed">
            + Add to My Decks &amp; Open in Builder
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Official / Tournament / Community List ─────────────────────────────────────
function PreconsList({ byNumber, navCollapsed, onOpen }: {
  byNumber: Map<string, CardRecord>
  navCollapsed: boolean
  onOpen: (d: SavedDeck) => void
}) {
  const [officialKind, setOfficialKind] = useState<OfficialKind>('trial')
  const [precons, setPrecons] = useState<PreconRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [clanFilter, setClanFilter] = useState<Set<string>>(new Set())
  const [clanOpen, setClanOpen] = useState(false)
  const [groupBy, setGroupBy] = useState<'none' | 'clan' | 'era'>('none')
  const [modal, setModal] = useState<PreconRecord | null>(null)
  const [previewZoom, setPreviewZoom] = useState<CardRecord | null>(null)

  useEffect(() => {
    fetch('/card-images/Decks/precons.json')
      .then((r) => r.json())
      .then(setPrecons)
      .catch(() => setPrecons([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!clanOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.clan-dropdown')) setClanOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [clanOpen])

  const filtered = precons.filter((d) => d.kind === officialKind)
  const clans = [...new Set(filtered.map((d) => d.clan ?? '').filter(Boolean))].sort()
  const clanFiltered = filtered.filter((d) => clanFilter.size === 0 || (d.clan != null && clanFilter.has(d.clan)))

  const groups = useMemo(() => {
    if (groupBy === 'clan') {
      const m = new Map<string, PreconRecord[]>()
      for (const d of clanFiltered) {
        const k = d.clan ?? 'Unknown'
        if (!m.has(k)) m.set(k, [])
        m.get(k)!.push(d)
      }
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, items }))
    }
    if (groupBy === 'era') {
      const m = new Map<string, PreconRecord[]>()
      for (const d of clanFiltered) {
        const k = d.formatId ?? 'Unknown'
        if (!m.has(k)) m.set(k, [])
        m.get(k)!.push(d)
      }
      return [...m.entries()].map(([key, items]) => ({ key, items }))
    }
    return [{ key: '', items: clanFiltered }]
  }, [clanFiltered, groupBy])

  const tile = (d: PreconRecord) => {
    const cover = deckCover(d, byNumber)
    const total = Object.values(d.main).reduce((s, n) => s + n, 0)
    return (
      <div key={d.id} className="rounded-lg overflow-hidden border border-slate-800 hover:border-amber-400/60 bg-slate-950/50 flex flex-col">
        <div className="w-full aspect-[50/73] bg-black flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => setModal(d)} title="View deck">
          {cover
            ? <CardImg src={thumbUrl(cover)} alt={cover.name} className="w-full h-full object-contain" />
            : <div className="text-slate-600 text-3xl">⚔</div>
          }
        </div>
        <div className="p-2">
          <div className="text-[15px] font-semibold truncate" title={d.name}>{d.name}</div>
          <div className="text-xs text-slate-500">{d.clan ? `${d.clan} · ` : ''}{d.set} · {total > 0 ? `${total}/50` : 'coming soon'}</div>
          <div className="flex gap-1 mt-1.5">
            <button onClick={() => setModal(d)} className="flex-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">View Deck</button>
          </div>
        </div>
      </div>
    )
  }

  const row = (d: PreconRecord) => {
    const total = Object.values(d.main).reduce((s, n) => s + n, 0)
    const feat = preconFeatured(d, byNumber, navCollapsed ? 8 : 6)
    const cl = feat.map((c) => c.clan).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ')
    return (
      <div key={d.id} className="flex items-center gap-4 border border-slate-800 rounded-xl px-5 py-4 bg-slate-950/50">
        <button onClick={() => setModal(d)} className="w-64 shrink-0 text-left">
          <div className="text-[15px] font-bold leading-snug">{d.name}</div>
          <div className="text-xs text-slate-500 mt-1">{d.clan ? `${d.clan} · ` : ''}{d.set} · {total > 0 ? `${total}/50` : 'coming soon'} → view deck</div>
          <div className="text-xs text-slate-400 mt-1.5 leading-snug">{cl}</div>
        </button>
        <div className="flex-1 min-w-0">
          <div className="grid gap-2 overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fill, 112px)' }}>
            {feat.map((c) => (
              <span key={c.card_number} role="button" tabIndex={0} title={`${c.name} — click to zoom`} onClick={() => setPreviewZoom(c)} onKeyDown={(e) => { if (e.key === 'Enter') setPreviewZoom(c) }} className="cursor-zoom-in">
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

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading…</div>

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(Object.keys(KIND_LABELS) as OfficialKind[]).map((k) => (
          <button key={k} onClick={() => { setOfficialKind(k); setClanFilter(new Set()) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${officialKind === k ? 'bg-amber-400 text-white border-amber-400' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
            {KIND_LABELS[k]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{v}</button>
            ))}
          </div>
          <div className="relative clan-dropdown">
            <button onClick={() => setClanOpen((v) => !v)} className={`text-sm bg-slate-900 border rounded px-2 py-1 flex items-center gap-1.5 ${clanFilter.size > 0 ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-300'}`}>
              {clanFilter.size === 0 ? 'Clan: all' : `Clan: ${clanFilter.size}`}
              <span className="text-xs">▾</span>
            </button>
            {clanOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-slate-900 border border-slate-700 rounded-lg shadow-xl min-w-[180px] max-h-64 overflow-y-auto thin-scroll">
                <button onClick={() => setClanFilter(new Set())} className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border-b border-slate-800">Clear all</button>
                {clans.map((c) => (
                  <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 cursor-pointer">
                    <input type="checkbox" checked={clanFilter.has(c)} onChange={() => setClanFilter((prev) => { const next = new Set(prev); if (next.has(c)) next.delete(c); else next.add(c); return next })} className="accent-amber-400" />
                    <span className="text-sm text-slate-300">{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'none' | 'clan' | 'era')} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1">
            <option value="none">Group: none</option>
            <option value="clan">Group: clan</option>
            <option value="era">Group: era</option>
          </select>
        </div>
      </div>

      {clanFiltered.length === 0 ? (
        <div className="text-slate-500 text-sm text-center mt-16">No decks yet for this category.</div>
      ) : (
        groups.map((g) => (
          <div key={g.key || 'all'} className="mb-4">
            {g.key && <div className="text-sm font-semibold text-amber-200 uppercase tracking-wider mb-1.5">{g.key} <span className="text-slate-500 normal-case">({g.items.length})</span></div>}
            {view === 'list'
              ? <div className="grid gap-2">{g.items.map(row)}</div>
              : <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${navCollapsed ? 6 : 5}, minmax(0, 1fr))` }}>{g.items.map(tile)}</div>
            }
          </div>
        ))
      )}

      {modal && <DeckModal deck={modal} byNumber={byNumber} onClose={() => setModal(null)} onAddToDeck={(d) => { onOpen(d) }} />}

      {previewZoom && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6" onClick={() => setPreviewZoom(null)}>
          <img src={thumbUrl(previewZoom)} alt={previewZoom.name} className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 text-sm text-slate-400">{previewZoom.name} · {previewZoom.card_number} — click anywhere to close</div>
        </div>
      )}
    </>
  )
}

// ── Your Decks List ────────────────────────────────────────────────────────────
function MyDecksList({ decks, byNumber, meta, onOpen, onProxy, onNew, onDuplicate, onDelete }: {
  decks: SavedDeck[]
  byNumber: Map<string, CardRecord>
  meta: IndexMeta
  onOpen: (id: string) => void
  onProxy: (id: string) => void
  onNew: () => void
  onDuplicate: (d: SavedDeck) => void
  onDelete: (d: SavedDeck) => void
}) {
  const [view, setView] = useState<'list' | 'grid'>('grid')
  const [search, setSearch] = useState('')
  const [clanFilter, setClanFilter] = useState<Set<string>>(new Set())
  const [clanOpen, setClanOpen] = useState(false)
  const [groupBy, setGroupBy] = useState<'none' | 'clan' | 'era'>('era')

  useEffect(() => {
    if (!clanOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.clan-dropdown')) setClanOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [clanOpen])

  const clans = useMemo(() => {
    const s = new Set<string>()
    for (const d of decks) s.add(deckMainClan(d, byNumber))
    return [...s].sort()
  }, [decks, byNumber])

  const filtered = decks.filter((d) => {
    if (clanFilter.size > 0 && !clanFilter.has(deckMainClan(d, byNumber))) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!d.name.toLowerCase().includes(q) && !deckMainClan(d, byNumber).toLowerCase().includes(q)) return false
    }
    return true
  })

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', items: filtered }]
    const m = new Map<string, SavedDeck[]>()
    for (const d of filtered) {
      const k = groupBy === 'clan' ? deckMainClan(d, byNumber) : deckEra(d, meta)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(d)
    }
    return [...m.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => a.key.localeCompare(b.key))
  }, [filtered, groupBy, byNumber])

  const deckTotal = (d: SavedDeck) => Object.values(d.main).reduce((s, n) => s + n, 0)

  const row = (d: SavedDeck) => {
    const cover = deckCover(d, byNumber)
    return (
      <div key={d.id} onDoubleClick={() => onOpen(d.id)} title="Double-click to open" className="flex items-center gap-3 border border-slate-800 rounded-lg px-3 py-2 bg-slate-950/50">
        <CardImg src={cover ? thumbUrl(cover) : ''} alt="" className="w-10 h-14 object-cover rounded bg-slate-800 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold truncate">{d.name}</div>
          <div className="text-xs text-slate-500">{deckMainClan(d, byNumber)} · {d.formatId} · {d.region} {d.strictness} · {deckTotal(d)}/50 · as of {d.asOf}</div>
        </div>
        <button onClick={() => onOpen(d.id)} className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">Open</button>
        <button onClick={() => onProxy(d.id)} title="Print proxies from this deck" className="flex items-center gap-1 text-sm px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-amber-400"><IconPrinter className="w-4 h-4" />Proxy</button>
        <button onClick={() => onDuplicate(d)} className="flex items-center gap-1 text-sm px-2 py-1.5 text-slate-400 hover:text-white"><IconCopy />Duplicate</button>
        <button onClick={() => onDelete(d)} className="flex items-center gap-1 text-sm px-2 py-1.5 text-red-400 hover:text-red-200"><IconTrash />Delete</button>
      </div>
    )
  }

  const tile = (d: SavedDeck) => {
    const cover = deckCover(d, byNumber)
    return (
      <div key={d.id} className="rounded-lg overflow-hidden border border-slate-800 hover:border-amber-400/60 bg-slate-950/50 flex flex-col">
        <div className="w-full aspect-[50/73] bg-black flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => onOpen(d.id)} title="Open deck">
          <CardImg src={cover ? thumbUrl(cover) : ''} alt={d.name} className="w-full h-full object-contain" />
        </div>
        <div className="p-2">
          <div className="text-[15px] font-semibold truncate" title={d.name}>{d.name}</div>
          <div className="text-xs text-slate-500">{deckMainClan(d, byNumber)} · {deckTotal(d)}/50 · {d.formatId}</div>
          <div className="flex gap-1 mt-1.5">
            <button onClick={() => onOpen(d.id)} className="flex-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">Open</button>
            <button onClick={() => onProxy(d.id)} title="Print proxies" className="flex-1 text-xs px-2 py-1 rounded border border-slate-700 text-slate-300 hover:border-amber-400 font-semibold">Proxy</button>
            <button onClick={() => onDuplicate(d)} title="Duplicate" className="flex items-center justify-center text-xs px-2 py-1 text-slate-400 hover:text-white"><IconCopy /></button>
            <button onClick={() => onDelete(d)} title="Delete" className="flex items-center justify-center text-xs px-2 py-1 text-red-400 hover:text-red-200"><IconTrash /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search decks…"
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 w-48"
        />
        <button onClick={onNew} className="text-sm px-3 py-1.5 rounded-lg bg-amber-400 text-white font-semibold">+ New deck</button>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{v}</button>
            ))}
          </div>
          <div className="relative clan-dropdown">
            <button onClick={() => setClanOpen((v) => !v)} className={`text-sm bg-slate-900 border rounded px-2 py-1 flex items-center gap-1.5 ${clanFilter.size > 0 ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-300'}`}>
              {clanFilter.size === 0 ? 'Clan: all' : `Clan: ${clanFilter.size}`}
              <span className="text-xs">▾</span>
            </button>
            {clanOpen && (
              <div className="absolute top-full right-0 mt-1 z-20 bg-slate-900 border border-slate-700 rounded-lg shadow-xl min-w-[180px] max-h-64 overflow-y-auto thin-scroll">
                <button onClick={() => setClanFilter(new Set())} className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border-b border-slate-800">Clear all</button>
                {clans.map((c) => (
                  <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 cursor-pointer">
                    <input type="checkbox" checked={clanFilter.has(c)} onChange={() => setClanFilter((prev) => { const next = new Set(prev); if (next.has(c)) next.delete(c); else next.add(c); return next })} className="accent-amber-400" />
                    <span className="text-sm text-slate-300">{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'none' | 'clan' | 'era')} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1">
            <option value="none">Group: none</option>
            <option value="clan">Group: main clan</option>
            <option value="era">Group: era</option>
          </select>
        </div>
      </div>
      {decks.length === 0 && <div className="text-sm text-slate-500">No decks yet.</div>}
      {groups.map((g) => (
        <div key={g.key || 'all'} className="mb-3">
          {g.key && <div className="text-sm font-semibold text-amber-200 uppercase tracking-wider mb-1.5">{g.key} <span className="text-slate-500 normal-case">({g.items.length})</span></div>}
          {view === 'list'
            ? <div className="grid gap-2">{g.items.map(row)}</div>
            : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>{g.items.map(tile)}</div>}
        </div>
      ))}
      <div className="text-xs text-slate-600 mt-3">Tip: mark a deck's Vanguard with the VG button in the Deck Builder. ★ sets the starting Vanguard.</div>
    </>
  )
}

// ── Tournament Decks List ──────────────────────────────────────────────────────
const NATIONS = new Set(['United Sanctuary','Dragon Empire','Brandt Gate','Dark States','Stoicheia','Lyrical Monasterio','Zoo','Star Gate','Dark Zone','Magallanica'])
const CATEGORY_ORDER = ['Keter Sanctuary', 'Dragon Empire', 'Dark States', 'Brandt Gate', 'Stoicheia', 'Lyrical Monasterio', 'Collabs', 'Other', 'Unknown']
const NATION_NAMES = new Set(['Keter Sanctuary', 'Dragon Empire', 'Dark States', 'Brandt Gate', 'Stoicheia', 'Lyrical Monasterio', 'Lyrical', 'United Sanctuary', 'Magallanica', 'Zoo', 'Star Gate', 'Dark Zone'])

function clanOf(d: TournamentDeckRecord, byNumber: Map<string, CardRecord>): string {
  if (d.nation && !NATION_NAMES.has(d.nation)) return d.nation
  const m = new Map<string, number>()
  for (const [num, n] of Object.entries(d.main)) {
    const c = byNumber.get(num)?.clan
    if (c) m.set(c, (m.get(c) ?? 0) + n)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown'
}

function categoryOf(d: TournamentDeckRecord, byNumber: Map<string, CardRecord>, map: Record<string, string>): string {
  if (d.nation && map[d.nation]) return map[d.nation]
  const clan = clanOf(d, byNumber)
  return map[clan] ?? (clan === 'Unknown' ? 'Unknown' : 'Other')
}

const categoryRank = (c: string) => {
  const i = CATEGORY_ORDER.indexOf(c)
  return i === -1 ? 99 : i
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || 'th')
}

const placeLabel = (d: TournamentDeckRecord) => {
  const p = d.placement || ''
  if (/champion/i.test(p)) return '1st'
  const m = p.match(/(\d+)(?:st|nd|rd|th)\s+runner/i)
  if (m) return ordinal(Number(m[1]) + 1)
  return p.split(',')[0].trim() || 'Unknown'
}

type TSub = { key: string; items: TournamentDeckRecord[] }
function budgetSubs(subs: TSub[], limit: number) {
  let left = limit
  const out: (TSub & { shown: TournamentDeckRecord[] })[] = []
  for (const s of subs) {
    if (left <= 0) break
    const shown = s.items.slice(0, left)
    left -= shown.length
    out.push({ ...s, shown })
  }
  return out
}

function TournamentList({ byNumber, navCollapsed, onOpen }: {
  byNumber: Map<string, CardRecord>
  navCollapsed: boolean
  onOpen: (d: SavedDeck) => void
}) {
  const [decks, setDecks] = useState<TournamentDeckRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [catMap, setCatMap] = useState<Record<string, string>>({})
  const [modal, setModal] = useState<PreconRecord | null>(null)
  const [previewZoom, setPreviewZoom] = useState<CardRecord | null>(null)
  const [formatFilter, setFormatFilter] = useState<string>('all')
  const [nationFilter, setNationFilter] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [tCols, setTCols] = useState(6)
  const [groupBy, setGroupBy] = useState<'none' | 'nation' | 'format' | 'year'>('year')
  const [sortAsc, setSortAsc] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filterW, setFilterW] = useState(220)
  const [resizingFilters, setResizingFilters] = useState(false)
  const PAGE = 100
  const [shown, setShown] = useState<Record<string, number>>({})
  const limitFor = (k: string) => shown[k] ?? PAGE
  const showMore = (k: string, total: number, visible: number) => total > visible ? (
    <div className="flex justify-center mt-3">
      <button onClick={() => setShown(prev => ({ ...prev, [k]: limitFor(k) + PAGE }))} className="text-sm px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300">
        Show more ({total - visible} left)
      </button>
    </div>
  ) : null

  useEffect(() => {
    Promise.all([
      fetch('/card-images/Decks/tournament_decks.json').then((r) => r.json()),
      fetch('/card-images/Decks/clan_categories.json').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([data, map]: [TournamentDeckRecord[], Record<string, string>]) => {
        setDecks(data.filter((d) => d.main && Object.keys(d.main).length > 0))
        setCatMap(map)
      })
      .catch(() => setDecks([]))
      .finally(() => setLoading(false))
  }, [])

  const startFilterResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizingFilters(true)
    const startX = e.clientX
    const startW = filterW
    const onMove = (ev: MouseEvent) => setFilterW(Math.max(160, Math.min(400, startW + ev.clientX - startX)))
    const onUp = () => { setResizingFilters(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const formats = useMemo(() => ['all', ...([...new Set(decks.map((d) => d.format))].sort())], [decks])
  const nations = useMemo(() => [...new Set(decks.map((d) => d.nation).filter(Boolean))].sort(), [decks])
  const trueNations = nations.filter((n) => NATIONS.has(n))
  const clans = nations.filter((n) => !NATIONS.has(n))
  const activeFilterCount = (formatFilter !== 'all' ? 1 : 0) + nationFilter.size

  const filtered = useMemo(() => decks.filter((d) => {
    if (formatFilter !== 'all' && d.format !== formatFilter) return false
    if (nationFilter.size > 0 && !nationFilter.has(d.nation)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!d.title.toLowerCase().includes(q) && !d.nation.toLowerCase().includes(q) && !d.event_url.toLowerCase().includes(q)) return false
    }
    return true
  }), [decks, formatFilter, nationFilter, search])

  const eventTitle = (d: TournamentDeckRecord) => {
    const slug = d.event_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/|\/$/g, '')
    const raw = slug.split('/').pop() ?? slug
    const cleaned = raw
      .replace(/^[A-Za-z]*\d{4}[_-]?/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
    return cleaned || raw
  }
  const yearOf = (d: TournamentDeckRecord) =>
    d.year ? String(d.year) : (d.event_url.match(/(20\d{2})/)?.[1] ?? 'Unknown')

    const groups = useMemo<TGroup[]>(() => {
    const cmp = (a: string, b: string) => (sortAsc ? a.localeCompare(b) : b.localeCompare(a))
    const bucket = (items: TournamentDeckRecord[], keyOf: (d: TournamentDeckRecord) => string) => {
      const m = new Map<string, TournamentDeckRecord[]>()
      for (const d of items) {
        const k = keyOf(d)
        if (!m.has(k)) m.set(k, [])
        m.get(k)!.push(d)
      }
      return [...m.entries()]
    }
    if (groupBy === 'none') return [{ key: '', items: filtered, subgroups: null }]
    if (groupBy === 'year') {
      return bucket(filtered, yearOf)
        .sort((a, b) => (a[0] === 'Unknown' ? 1 : b[0] === 'Unknown' ? -1 : cmp(a[0], b[0])))
        .map(([key, items]) => ({
          key,
          items,
          subgroups: bucket(items, eventTitle)
            .sort((a, b) => cmp(a[0], b[0]))
            .map(([k, v]) => ({ key: k, items: v })),
        }))
    }
    if (groupBy === 'nation') {
      return bucket(filtered, (d) => categoryOf(d, byNumber, catMap))
        .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]))
        .map(([key, items]) => ({
          key,
          items,
          subgroups: bucket(items, (d) => clanOf(d, byNumber))
            .sort((a, b) => cmp(a[0], b[0]))
            .map(([k, v]) => ({ key: k, items: v })),
        }))
    }
    return bucket(filtered, (d) => d.format || 'Unknown')
      .sort((a, b) => cmp(a[0], b[0]))
      .map(([key, items]) => ({ key, items, subgroups: null }))
  }, [filtered, groupBy, sortAsc, byNumber, catMap])

  const allKeys = useMemo(() => {
    const keys: string[] = []
    for (const g of groups) {
      if (g.key) keys.push(g.key)
      for (const s of g.subgroups ?? []) keys.push(`${g.key}::${s.key}`)
    }
    return keys
  }, [groups])
  const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsedGroups.has(k))
  const toggleAll = () => setCollapsedGroups(allCollapsed ? new Set() : new Set(allKeys))

  const tile = (d: TournamentDeckRecord) => {
    const precon = tournamentToPrecon(d)
    const feat = preconFeatured(precon, byNumber, 1)
    const cover = feat[0]
    return (
      <div key={d.deck_code} className="rounded-lg overflow-hidden border border-slate-800 hover:border-amber-400/60 bg-slate-950/50 flex flex-col cursor-pointer" onClick={() => setModal(precon)}>
        <div className="w-full aspect-[50/73] bg-black flex items-center justify-center overflow-hidden">
          <CardImg src={cover ? thumbUrl(cover) : ''} alt={d.title} className="w-full h-full object-contain" />
        </div>
        <div className="p-2">
          <div className="text-[13px] font-semibold truncate" title={d.title}>{d.title}</div>
          <div className="text-[11px] text-slate-500 truncate">{d.clan || d.nation || 'Unknown'} · {placeLabel(d)} · {d.series}</div>
          <div className="flex gap-1 mt-1.5">
            <button onClick={() => setModal(precon)} className="flex-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">View Deck</button>
          </div>
        </div>
      </div>
    )
  }

  const row = (d: TournamentDeckRecord) => {
    const precon = tournamentToPrecon(d)
    const feat = preconFeatured(precon, byNumber, navCollapsed ? 8 : 6)
    return (
      <div key={d.deck_code} className="flex items-center gap-4 border border-slate-800 rounded-xl px-5 py-4 bg-slate-950/50">
        <button onClick={() => setModal(precon)} className="w-56 shrink-0 text-left">
          <div className="text-[15px] font-bold leading-snug">{d.title}</div>
          <div className="text-xs text-slate-500 mt-1">{d.clan || d.nation || 'Unknown'} · {placeLabel(d)} · {d.series} · {Object.values(d.main).reduce((s, n) => s + n, 0)} cards</div>
          <span className="text-[10px] text-amber-400 hover:underline mt-1 block">View deck</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="grid gap-2 overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fill, 90px)' }}>
            {feat.map((c) => (
              <span key={c.card_number} role="button" tabIndex={0} onClick={() => setPreviewZoom(c)} className="cursor-zoom-in">
                <span className="block rounded overflow-hidden border border-slate-800 hover:border-amber-300 bg-black">
                  <CardImg src={thumbUrl(c)} alt={c.name} className="w-full aspect-[50/73] object-contain" />
                </span>
                <span className="block text-[11px] truncate text-slate-300 mt-0.5">{c.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading…</div>
  if (decks.length === 0) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">No tournament decks found.</div>

  return (
    <>
      <div className="flex h-[calc(100vh-13rem)] min-h-[360px]">
        {/* Filter sidebar */}
        {showFilters && (
          <>
            <div className="shrink-0 overflow-y-auto thin-scroll pr-2 mr-1" style={{ width: filterW }}>
              {/* Format */}
              <div className="mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Format</div>
                <div className="flex flex-col gap-0.5">
                  {formats.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer py-0.5 rounded hover:bg-slate-800 px-1">
                      <input type="checkbox" className="accent-amber-400" checked={formatFilter === f} onChange={() => setFormatFilter(f)} />
                      <span className="capitalize">{f === 'all' ? 'All formats' : f}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Nation */}
              {trueNations.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Nation
                    {[...nationFilter].some(n => NATIONS.has(n)) && (
                      <button onClick={() => setNationFilter(prev => { const next = new Set(prev); trueNations.forEach(n => next.delete(n)); return next })} className="ml-2 text-amber-400 hover:text-amber-300 normal-case font-normal text-xs">Clear</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {trueNations.map((n) => (
                      <label key={n} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer py-0.5 rounded hover:bg-slate-800 px-1">
                        <input type="checkbox" className="accent-amber-400" checked={nationFilter.has(n)} onChange={() => setNationFilter((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next })} />
                        {n}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {/* Clan */}
              {clans.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Clan
                    {[...nationFilter].some(n => !NATIONS.has(n)) && (
                      <button onClick={() => setNationFilter(prev => { const next = new Set(prev); clans.forEach(n => next.delete(n)); return next })} className="ml-2 text-amber-400 hover:text-amber-300 normal-case font-normal text-xs">Clear</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {clans.map((n) => (
                      <label key={n} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer py-0.5 rounded hover:bg-slate-800 px-1">
                        <input type="checkbox" className="accent-amber-400" checked={nationFilter.has(n)} onChange={() => setNationFilter((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next })} />
                        {n}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {activeFilterCount > 0 && (
                <button onClick={() => { setFormatFilter('all'); setNationFilter(new Set()) }} className="text-sm text-amber-300 hover:text-amber-200 mb-2">
                  Clear all filters ({activeFilterCount})
                </button>
              )}
            </div>
            <div
              onMouseDown={startFilterResize}
              title="Drag to resize filters"
              className={`vsplit-handle shrink-0 w-2.5 mr-1 my-2 rounded flex items-center justify-center self-stretch ${resizingFilters ? 'active' : ''}`}
            >
              <div className="w-1 h-16 rounded bg-slate-700" />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setShowFilters(v => !v)} className={`text-sm px-2 py-1.5 rounded border ${showFilters || activeFilterCount > 0 ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
              {showFilters ? 'Hide filters' : `Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
            </button>
            <button onClick={toggleAll} disabled={allKeys.length === 0} title={allCollapsed ? 'Expand all groups' : 'Collapse all groups'} className="text-sm px-2 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-amber-400 disabled:opacity-40 whitespace-nowrap">
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search decks…" className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 flex-1 min-w-0" />
            <div className="ml-auto flex items-center gap-2">
              {view === 'grid' && (
                <div className="flex items-center gap-1 text-sm text-slate-400" title="Columns per row (auto = fill)">
                  <button onClick={() => setTCols((v) => Math.max(0, (v || 9) - 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
                  <span className="w-14 text-center">{tCols === 0 ? 'Auto' : `${tCols}/row`}</span>
                  <button onClick={() => setTCols((v) => Math.min(10, (v || 3) + 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
                </div>
              )}
              <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
                {(['grid', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{v}</button>
                ))}
              </div>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1">
                <option value="year">Group: year</option>
                <option value="nation">Group: nation</option>
                <option value="format">Group: format</option>
                <option value="none">Group: none</option>
              </select>
              <button onClick={() => setSortAsc(v => !v)} title={sortAsc ? 'Ascending' : 'Descending'} className="w-7 h-7 flex items-center justify-center rounded border border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-400 text-base">
                {sortAsc ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="text-xs text-slate-500 mb-3">{filtered.length} deck{filtered.length !== 1 ? 's' : ''}</div>
            {filtered.length === 0 ? (
              <div className="text-slate-500 text-sm text-center mt-16">No decks match the current filters.</div>
            ) : (
              groups.map((g) => {
                const isCollapsed = collapsedGroups.has(g.key)
                const toggle = (k: string) => setCollapsedGroups(prev => {
                  const next = new Set(prev)
                  if (next.has(k)) next.delete(k)
                  else next.add(k)
                  return next
                })
                const renderItems = (items: TournamentDeckRecord[]) =>
                  view === 'list'
                    ? <div className="grid gap-2">{items.map(row)}</div>
                    : <div className="grid gap-3" style={tCols === 0 ? { gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' } : { gridTemplateColumns: `repeat(${tCols}, minmax(0, 1fr))` }}>{items.map(tile)}</div>
                const limit = limitFor(g.key || 'all')
                const subs = g.subgroups ? budgetSubs(g.subgroups, limit) : null
                const shownTotal = subs ? subs.reduce((n, s) => n + s.shown.length, 0) : Math.min(limit, g.items.length)
                return (
                  <div key={g.key || 'all'} className="mb-6">
                    {g.key && (
                      <button onClick={() => toggle(g.key)} className="flex items-center gap-2 w-full text-left mb-2 group/hdr">
                        <span className="text-xs text-slate-400 transition-transform" style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                        <span className="text-base font-bold text-amber-200 group-hover/hdr:text-amber-300">{g.key}</span>
                        <span className="text-slate-500 text-sm font-normal">({g.items.length})</span>
                      </button>
                    )}
                    {!isCollapsed && (subs
                      ? subs.map((s) => {
                          const subKey = `${g.key}::${s.key}`
                          const subCollapsed = collapsedGroups.has(subKey)
                          return (
                            <div key={subKey} className="mb-3 pl-3 border-l border-slate-800">
                              <button onClick={() => toggle(subKey)} className="flex items-center gap-2 w-full text-left mb-2 group/sub">
                                <span className="text-xs text-slate-400 transition-transform" style={{ display: 'inline-block', transform: subCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                                <span className="text-sm font-semibold text-slate-200 group-hover/sub:text-amber-300">{s.key}</span>
                                <span className="text-slate-500 text-xs font-normal">({s.items.length})</span>
                              </button>
                              {!subCollapsed && renderItems(s.shown)}
                            </div>
                          )
                        })
                      : renderItems(g.items.slice(0, limit)))}
                    {!isCollapsed && showMore(g.key || 'all', g.items.length, shownTotal)}
                  </div>
                )
              })
            )}
          </div>
          {modal && <DeckModal deck={modal} byNumber={byNumber} onClose={() => setModal(null)} onAddToDeck={(d) => { onOpen(d) }} />}
          {previewZoom && (
            <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6" onClick={() => setPreviewZoom(null)}>
              <img src={thumbUrl(previewZoom)} alt={previewZoom.name} className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
              <div className="absolute bottom-4 text-sm text-slate-400">{previewZoom.name} · {previewZoom.card_number} — click anywhere to close</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────────
export default function DecksPage({ decks, byNumber, meta, navCollapsed, onOpen, onProxy, onNew, onDuplicate, onDelete }: {
  decks: SavedDeck[]
  byNumber: Map<string, CardRecord>
  meta: IndexMeta
  navCollapsed: boolean
  onOpen: (id: string) => void
  onProxy: (id: string) => void
  onNew: () => void
  onDuplicate: (d: SavedDeck) => void
  onDelete: (d: SavedDeck) => void
}) {
  const [sub, setSub] = useState<DecksSub>('mine')

  const subTabs: { id: DecksSub; label: string; count?: number }[] = [
    { id: 'mine', label: 'Your Decks', count: decks.length },
    { id: 'official', label: 'Official Decks' },
    { id: 'tournament', label: 'Tournament Decks' },
    { id: 'community', label: 'Community Decks' },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 overflow-y-auto">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Decks</h1>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-800">
          {subTabs.map((s) => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-t ${sub === s.id ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {s.label}{s.count !== undefined && s.count > 0 ? ` (${s.count})` : ''}
            </button>
          ))}
        </div>

        {sub === 'mine' && (
          <MyDecksList
            decks={decks}
            byNumber={byNumber}
            meta={meta}
            onOpen={onOpen}
            onProxy={onProxy}
            onNew={onNew}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        )}
        {sub === 'official' && (
          <PreconsList byNumber={byNumber} navCollapsed={navCollapsed} onOpen={(d) => { onOpen(d.id) }} />
        )}
        {sub === 'tournament' && (
          <TournamentList byNumber={byNumber} navCollapsed={navCollapsed} onOpen={(d) => { onOpen(d.id) }} />
        )}
        {sub === 'community' && (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">🚧 Under construction</div>
        )}
      </div>
    </div>
  )
}