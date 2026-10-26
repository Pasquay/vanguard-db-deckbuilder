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

export interface PreconRecord extends SavedDeck {
  kind: OfficialKind
  set: string
  clan?: string
  preview?: string[]
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
  const [sortBy, setSortBy] = useState<'number' | 'grade' | 'power' | 'name' | 'trigger'>('number')
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
        case 'grade': cmp = (a.c.grade ?? 0) - (b.c.grade ?? 0) || a.c.name.localeCompare(b.c.name); break
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
        {(sub === 'tournament' || sub === 'community') && (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">🚧 Under construction</div>
        )}
      </div>
    </div>
  )
}