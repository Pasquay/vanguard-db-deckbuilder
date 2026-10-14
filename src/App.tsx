import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Searcher from './components/Searcher.tsx'
import CardImg from './components/CardImg.tsx'
import { IconChevronDown, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconCopy, IconGrid, IconLayers, IconLibrary, IconMoon, IconPackage, IconSun, IconSwords, IconTrash } from './components/icons.tsx'
import DeckBuilder, { deckCover, type SavedDeck } from './components/DeckBuilder.tsx'
import type { CardRecord, IndexMeta, SetInfo } from './lib/types.ts'
import { fullUrl, thumbUrl } from './lib/types.ts'
import { renderSkill } from './lib/skill.tsx'

type Tab = 'home' | 'db' | 'deck' | 'decks' | 'sets'

const LS_KEY = 'vg-decks-v1'
function loadDecks(): SavedDeck[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}
const uid = () => Math.random().toString(36).slice(2, 10)
export const KIND_ORDER = ['Booster', 'Extra Booster', 'Trial Deck', 'Promo', 'Other']

export default function App() {
  const [cards, setCards] = useState<CardRecord[]>([])
  const [meta, setMeta] = useState<IndexMeta | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('vg-theme') as 'dark' | 'light') ?? 'dark')
  const [openEras, setOpenEras] = useState<Set<string>>(new Set())
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CardRecord | null>(null)
  const [lightbox, setLightbox] = useState<{ card: CardRecord; list: CardRecord[] } | null>(null)
  const [preset, setPreset] = useState<{ era?: string; set?: string } | null>(null)
  const [decks, setDecks] = useState<SavedDeck[]>(loadDecks)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [previewW, setPreviewW] = useState(336)
  const [resizingPreview, setResizingPreview] = useState(false)

  const startPreviewResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizingPreview(true)
    const startX = e.clientX
    const startW = previewW
    const move = (ev: MouseEvent) => setPreviewW(Math.min(560, Math.max(240, startW - (ev.clientX - startX))))
    const up = () => {
      setResizingPreview(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  useEffect(() => {
    Promise.all([
      fetch('data/all-cards.json').then((r) => { if (!r.ok) throw new Error(`all-cards.json ${r.status}`); return r.json() }),
      fetch('data/meta.json').then((r) => { if (!r.ok) throw new Error(`meta.json ${r.status}`); return r.json() }),
    ])
      .then(([c, m]) => {
        setCards(c)
        setMeta(m)
        setSelected(c[0] ?? null)
      })
      .catch((e) => setLoadError(`Couldn't load card data (did you run "npm run index"?): ${e.message}`))
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(decks))
  }, [decks])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('vg-theme', theme)
  }, [theme])

  const toggleIn = (set: Set<string>, v: string): Set<string> => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  const byNumber = useMemo(() => new Map(cards.map((c) => [c.card_number, c])), [cards])

  const zoom = useCallback((c: CardRecord, list?: CardRecord[]) => {
    setLightbox({ card: c, list: list ?? [] })
  }, [])

  const goSet = (era: string, set?: string) => {
    setPreset({ era, set })
    setTab('db')
  }

  const newDeck = () => {
    const d: SavedDeck = {
      id: uid(), name: `New Deck ${decks.length + 1}`, formatId: 'pre-lb',
      strictness: 'strict', region: 'EN', asOf: '2012-09-01', asOfPreset: 'en-prelb',
      main: {}, starter: null, cover: null, updatedAt: Date.now(),
    }
    setDecks((p) => [...p, d])
    setActiveId(d.id)
    setTab('deck')
  }
  const updateDeck = (d: SavedDeck) => setDecks((p) => p.map((x) => (x.id === d.id ? d : x)))

  const activeDeck = decks.find((d) => d.id === activeId) ?? null

  useEffect(() => {
    if (!lightbox) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = lightbox.list.findIndex((c) => c.card_number === lightbox.card.card_number)
        if (i >= 0 && lightbox.list.length > 1) {
          const n = e.key === 'ArrowRight'
            ? lightbox.list[(i + 1) % lightbox.list.length]
            : lightbox.list[(i - 1 + lightbox.list.length) % lightbox.list.length]
          setLightbox({ card: n, list: lightbox.list })
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [lightbox])

  if (loadError) return <div className="p-8 text-sm text-red-300">{loadError}</div>
  if (!meta) return <div className="p-8 text-sm text-slate-400">Loading cards…</div>

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`${navCollapsed ? 'w-16' : 'w-64'} shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col transition-all`}>
        <div className="flex items-center gap-1 px-3 pt-4 pb-2">
          {navCollapsed ? (
            <button
              onClick={() => setNavCollapsed(false)}
              className="mx-auto w-9 h-9 rounded-lg border border-slate-800 text-slate-300 hover:border-slate-500 text-sm flex items-center justify-center"
              title="Expand menu"
            >
              <IconChevronsRight />
            </button>
          ) : (
            <>
              <button onClick={() => setTab('home')} className="flex-1 min-w-0 text-left" title="Vanguard DB — home">
                <div className="flex items-center gap-1.5 text-xl font-black tracking-tight text-white truncate">
                  <IconSwords className="w-6 h-6 shrink-0 text-amber-400" />
                  <span>Vanguard <span className="text-amber-400">DB</span></span>
                </div>
                <div className="text-xs text-slate-500">{meta.total} cards · {meta.eras.length} era{meta.eras.length > 1 ? 's' : ''}</div>
              </button>
              <button
                onClick={() => setNavCollapsed(true)}
                className="shrink-0 w-7 h-7 rounded border border-slate-800 text-slate-400 hover:text-white hover:border-slate-500 text-sm flex items-center justify-center"
                title="Collapse menu"
              >
                <IconChevronsLeft />
              </button>
            </>
          )}
        </div>
        <nav className="px-2 space-y-1">
          {([
            ['db', <IconGrid key="i" />, 'Card DB'],
            ['deck', <IconLayers key="i" />, 'Deck Builder'],
            ['decks', <IconLibrary key="i" />, 'Decks'],
            ['sets', <IconPackage key="i" />, 'Sets'],
          ] as [Tab, ReactNode, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              title={label}
              className={`w-full flex items-center gap-2.5 text-[15px] px-3 py-2 rounded-lg ${tab === t ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-900'}`}
            >
              {icon}{navCollapsed ? '' : <span className="truncate">{label}</span>}
              {t === 'decks' && decks.length > 0 && !navCollapsed && <span className="ml-auto text-xs opacity-70">({decks.length})</span>}
            </button>
          ))}
        </nav>
        {!navCollapsed && (
          <>
            <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-slate-500 font-semibold">CardDB by era</div>
            <div className="flex-1 overflow-y-auto thin-scroll px-2 pb-3 min-h-0">
              {meta.eras.map((e) => {
                const eraOpen = openEras.has(e.name)
                return (
                <div key={e.name} className="mb-1">
                  <div className="flex items-center rounded hover:bg-slate-900">
                    <button
                      onClick={() => setOpenEras((p) => toggleIn(p, e.name))}
                      className="px-1.5 py-1.5 text-slate-500 flex items-center"
                      title={eraOpen ? 'Collapse era' : 'Expand era'}
                    >
                      {eraOpen ? <IconChevronDown /> : <IconChevronRight />}
                    </button>
                    <button
                      onClick={() => { setOpenEras((p) => new Set(p).add(e.name)); goSet(e.name) }}
                      className="flex-1 text-left text-sm font-semibold text-slate-200 px-1 py-1.5 truncate"
                      title={`Browse ${e.name}`}
                    >
                      {e.name} <span className="text-slate-500 font-normal">({e.sets.reduce((s, x) => s + x.count, 0)})</span>
                    </button>
                  </div>
                  {eraOpen && KIND_ORDER.filter((k) => e.sets.some((s) => s.kind === k)).map((k) => {
                    const kindKey = `${e.name}::${k}`
                    const kindOpen = openKinds.has(kindKey)
                    return (
                    <div key={k} className="mb-0.5">
                      <div className="flex items-center rounded hover:bg-slate-900">
                        <button
                          onClick={() => setOpenKinds((p) => toggleIn(p, kindKey))}
                          className="pl-5 pr-1 py-1 text-slate-500 flex items-center"
                          title={kindOpen ? `Collapse ${k}s` : `Expand ${k}s`}
                        >
                          {kindOpen ? <IconChevronDown /> : <IconChevronRight />}
                        </button>
                        <button
                          onClick={() => setOpenKinds((p) => toggleIn(p, kindKey))}
                          className="flex-1 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-1 truncate"
                        >
                          {k}s <span className="font-normal">({e.sets.filter((s) => s.kind === k).length})</span>
                        </button>
                      </div>
                      {kindOpen && e.sets.filter((s) => s.kind === k).map((s) => (
                        <button
                          key={s.code}
                          onClick={() => goSet(e.name, s.code)}
                          title={`[${s.code}] ${s.name}`}
                          className="w-full text-left text-sm text-slate-400 pl-10 pr-2 py-1 rounded hover:bg-slate-900 hover:text-slate-200 truncate"
                        >
                          [{s.code}] {s.name} <span className="text-slate-600">({s.count})</span>
                        </button>
                      ))}
                    </div>
                    )
                  })}
                </div>
                )
              })}
            </div>
          </>
        )}
        <div className="p-2 border-t border-slate-800 mt-auto">
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-full flex items-center justify-center gap-2 text-sm px-2 py-1.5 rounded border border-slate-800 text-slate-300 hover:border-amber-400/60"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            {navCollapsed ? '' : (theme === 'dark' ? 'Light mode' : 'Dark mode')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex min-w-0 min-h-0">
        {tab === 'home' && <HomePage meta={meta} decks={decks} go={(t) => setTab(t)} goSet={goSet} newDeck={newDeck} />}
        {tab === 'db' && (
          <>
            <div className="flex-1 min-w-0 p-3 flex flex-col min-h-0">
              {preset && (
                <div className="text-sm text-slate-400 mb-2">
                  Browsing: <span className="text-amber-200 font-semibold">{preset.era}{preset.set ? ` / ${preset.set}` : ''}</span>
                  <button onClick={() => setPreset(null)} className="ml-2 text-slate-500 hover:text-white">clear ✕</button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <Searcher
                  key={preset ? `${preset.era}-${preset.set ?? ''}` : 'all'}
                  cards={cards}
                  meta={meta}
                  selected={selected}
                  onSelect={setSelected}
                  onZoom={zoom}
                  preset={preset}
                />
              </div>
            </div>
            <div
              onMouseDown={startPreviewResize}
              title="Drag to resize preview"
              className={`vsplit-handle shrink-0 w-2.5 my-2 rounded flex items-center justify-center ${resizingPreview ? 'active' : ''}`}
            >
              <div className="w-1 h-16 rounded bg-slate-700" />
            </div>
            <div className="shrink-0 min-h-0 flex" style={{ width: previewW }}>
              <PreviewPane card={selected} onZoom={zoom} onAddToDeck={(c) => {
              let d = decks.find((x) => x.id === activeId) ?? decks[decks.length - 1]
              if (!d) {
                d = { id: uid(), name: `New Deck ${decks.length + 1}`, formatId: 'pre-lb', strictness: 'strict', region: 'EN', asOf: '2012-09-01', asOfPreset: 'en-prelb', main: {}, starter: null, cover: null, updatedAt: Date.now() }
                setDecks((p) => [...p, d!])
                setActiveId(d.id)
              }
              updateDeck({ ...d, main: { ...d.main, [c.card_number]: (d.main[c.card_number] ?? 0) + 1 }, updatedAt: Date.now() })
            }} />
            </div>
          </>
        )}
        {tab === 'deck' && (
          <div className="flex-1 min-w-0 p-3 min-h-0 flex flex-col">
            {!activeDeck ? (
              <div className="m-auto text-center">
                <div className="text-slate-300 mb-2">No deck open.</div>
                <button onClick={newDeck} className="px-4 py-2 rounded-lg bg-amber-400 text-white font-semibold">+ New pre-LB deck</button>
              </div>
            ) : (
              <DeckBuilder cards={cards} meta={meta} deck={activeDeck} onChange={updateDeck} onZoom={(c) => zoom(c)} />
            )}
          </div>
        )}
        {tab === 'decks' && (
          <DecksPage
            decks={decks}
            byNumber={byNumber}
            onOpen={(id) => { setActiveId(id); setTab('deck') }}
            onNew={newDeck}
            onDuplicate={(d) => setDecks((p) => [...p, { ...d, id: uid(), name: `${d.name} (copy)`, main: { ...d.main }, updatedAt: Date.now() }])}
            onDelete={(d) => {
              if (!confirm(`Delete "${d.name}"?`)) return
              setDecks((p) => p.filter((x) => x.id !== d.id))
              if (activeId === d.id) setActiveId(null)
            }}
          />
        )}
        {tab === 'sets' && <SetsPage meta={meta} byNumber={byNumber} goSet={goSet} onZoom={zoom} />}
      </main>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <CardImg
            src={fullUrl(lightbox.card)}
            alt={lightbox.card.name}
            loading="eager"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
          <div className="absolute bottom-4 text-sm text-slate-400" onClick={(e) => e.stopPropagation()}>
            {lightbox.card.name} · {lightbox.card.card_number} — click anywhere to close{lightbox.list.length > 1 ? ' · ←/→ to browse' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function HomePage({ meta, decks, go, goSet, newDeck }: {
  meta: IndexMeta; decks: SavedDeck[]; go: (t: Tab) => void; goSet: (era: string, set?: string) => void; newDeck: () => void
}) {
  const totalSets = meta.eras.reduce((s, e) => s + e.sets.length, 0)
  const tiles: { icon: ReactNode; title: string; desc: string; action: () => void }[] = [
    { icon: <IconGrid className="w-9 h-9" />, title: 'Card DB', desc: `${meta.total} cards · search, filter & browse every era`, action: () => go('db') },
    { icon: <IconLayers className="w-9 h-9" />, title: 'Deck Builder', desc: 'One-page builder with pre-LB legality checks', action: () => go('deck') },
    { icon: <IconLibrary className="w-9 h-9" />, title: 'Decks', desc: `${decks.length} saved deck${decks.length === 1 ? '' : 's'}`, action: () => go('decks') },
    { icon: <IconPackage className="w-9 h-9" />, title: 'Sets', desc: `${totalSets} sets across ${meta.eras.length} era${meta.eras.length > 1 ? 's' : ''}`, action: () => go('sets') },
  ]
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto text-center pt-10">
        <div className="flex items-center justify-center gap-3 text-5xl font-black tracking-tight text-white">
          <IconSwords className="w-12 h-12 text-amber-400" />
          <span>Vanguard <span className="text-amber-400">DB</span></span>
        </div>
        <div className="text-base text-slate-400 mt-2">{meta.total} cards · {totalSets} sets · pre-Limit Break era and beyond</div>
        <div className="grid grid-cols-2 gap-4 mt-8 text-left">
          {tiles.map((t) => (
            <button key={t.title} onClick={t.action} className="border border-slate-800 rounded-2xl p-6 bg-slate-950/60 hover:border-amber-400/70 hover:bg-slate-900 transition text-left">
              <div className="mb-3 text-amber-400">{t.icon}</div>
              <div className="text-xl font-bold text-slate-100">{t.title}</div>
              <div className="text-sm text-slate-400 mt-1">{t.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => go('db')} className="px-5 py-2.5 rounded-lg bg-amber-400 text-white font-bold">Browse cards</button>
          <button onClick={newDeck} className="px-5 py-2.5 rounded-lg border border-slate-700 hover:border-amber-400">+ New deck</button>
        </div>
        <div className="mt-10 text-left">
          <div className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Start from a set</div>
          <div className="flex flex-wrap gap-2">
            {meta.eras.flatMap((e) => e.sets.slice(0, 6).map((s) => (
              <button key={s.code} onClick={() => goSet(e.name, s.code)} className="text-sm px-3 py-1.5 rounded-full border border-slate-700 hover:border-amber-400 text-slate-300">
                [{s.code}] {s.name}
              </button>
            )))}
          </div>
        </div>
      </div>
    </div>
  )
}

function deckMainClan(d: SavedDeck, byNumber: Map<string, CardRecord>): string {
  const m = new Map<string, number>()
  for (const [num, n] of Object.entries(d.main)) {
    const c = byNumber.get(num)
    const k = c?.clan ?? 'No clan'
    m.set(k, (m.get(k) ?? 0) + n)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No clan'
}

function DecksPage({ decks, byNumber, onOpen, onNew, onDuplicate, onDelete }: {
  decks: SavedDeck[]; byNumber: Map<string, CardRecord>;
  onOpen: (id: string) => void; onNew: () => void;
  onDuplicate: (d: SavedDeck) => void; onDelete: (d: SavedDeck) => void
}) {
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [clanFilter, setClanFilter] = useState('')
  const [groupBy, setGroupBy] = useState<'none' | 'clan' | 'format'>('none')

  const clans = useMemo(() => {
    const s = new Set<string>()
    for (const d of decks) s.add(deckMainClan(d, byNumber))
    return [...s].sort()
  }, [decks, byNumber])

  const filtered = decks.filter((d) => !clanFilter || deckMainClan(d, byNumber) === clanFilter)

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', items: filtered }]
    const m = new Map<string, SavedDeck[]>()
    for (const d of filtered) {
      const k = groupBy === 'clan' ? deckMainClan(d, byNumber) : d.formatId
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(d)
    }
    return [...m.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => a.key.localeCompare(b.key))
  }, [filtered, groupBy, byNumber])

  const deckTotal = (d: SavedDeck) => Object.values(d.main).reduce((s, n) => s + n, 0)

  const row = (d: SavedDeck) => {
    const cover = deckCover(d, byNumber)
    return (
      <div
        key={d.id}
        onDoubleClick={() => onOpen(d.id)}
        title="Double-click to open"
        className="flex items-center gap-3 border border-slate-800 rounded-lg px-3 py-2 bg-slate-950/50"
      >
        <CardImg src={cover ? thumbUrl(cover) : ''} alt="" className="w-10 h-14 object-cover rounded bg-slate-800 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold truncate">{d.name}</div>
          <div className="text-xs text-slate-500">{deckMainClan(d, byNumber)} · {d.formatId} · {d.region} {d.strictness} · {deckTotal(d)}/50 · as of {d.asOf}</div>
        </div>
        <button onClick={() => onOpen(d.id)} className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">Open</button>
        <button onClick={() => onDuplicate(d)} className="flex items-center gap-1 text-sm px-2 py-1.5 text-slate-400 hover:text-white"><IconCopy />Duplicate</button>
        <button onClick={() => onDelete(d)} className="flex items-center gap-1 text-sm px-2 py-1.5 text-red-400 hover:text-red-200"><IconTrash />Delete</button>
      </div>
    )
  }

  const tile = (d: SavedDeck) => {
    const cover = deckCover(d, byNumber)
    return (
      <div key={d.id} className="rounded-lg overflow-hidden border border-slate-800 hover:border-amber-400/60 bg-slate-950/50 flex flex-col">
        <div className="w-full aspect-[50/73] bg-black flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => onOpen(d.id)} onDoubleClick={() => onOpen(d.id)} title="Open deck (double-click)">
          <CardImg src={cover ? thumbUrl(cover) : ''} alt={d.name} className="w-full h-full object-contain" />
        </div>
        <div className="p-2">
          <div className="text-[15px] font-semibold truncate" title={d.name}>{d.name}</div>
          <div className="text-xs text-slate-500">{deckMainClan(d, byNumber)} · {deckTotal(d)}/50 · {d.formatId}</div>
          <div className="flex gap-1 mt-1.5">
            <button onClick={() => onOpen(d.id)} className="flex-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">Open</button>
            <button onClick={() => onDuplicate(d)} title="Duplicate" className="flex items-center justify-center text-xs px-2 py-1 text-slate-400 hover:text-white"><IconCopy /></button>
            <button onClick={() => onDelete(d)} title="Delete" className="flex items-center justify-center text-xs px-2 py-1 text-red-400 hover:text-red-200"><IconTrash /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-xl font-bold">Saved decks</h2>
        <div className="flex rounded overflow-hidden border border-slate-700 text-sm ml-2">
          {(['list', 'grid'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{v}</button>
          ))}
        </div>
        <select value={clanFilter} onChange={(e) => setClanFilter(e.target.value)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1">
          <option value="">Clan: all</option>
          {clans.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'none' | 'clan' | 'format')} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1">
          <option value="none">Group: none</option>
          <option value="clan">Group: main clan</option>
          <option value="format">Group: format</option>
        </select>
        <button onClick={onNew} className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-amber-400 text-white font-semibold">+ New deck</button>
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
      <div className="text-xs text-slate-600 mt-3">Tip: mark a deck's Vanguard (ace + cover photo) with the VG button on any card in the Deck Builder. ★ sets the starting Vanguard.</div>
    </div>
  )
}

function SetsPage({ meta, byNumber, goSet, onZoom }: {
  meta: IndexMeta; byNumber: Map<string, CardRecord>;
  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void
}) {
  const [view, setView] = useState<'cards' | 'rows'>('cards')
  const [openEras, setOpenEras] = useState<Set<string>>(new Set(meta.eras.map((e) => e.name)))
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set(meta.eras.flatMap((e) => e.sets.map((s) => `${e.name}::${s.kind}`))))
  const toggle = (set: Set<string>, v: string, apply: (n: Set<string>) => void) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    apply(n)
  }
  return (
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
      <div className="flex items-center mb-3">
        <h2 className="text-xl font-bold">Sets by era</h2>
        <div className="flex rounded overflow-hidden border border-slate-700 text-sm ml-4">
          {(['cards', 'rows'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{v === 'cards' ? 'Grid' : 'Rows'}</button>
          ))}
        </div>
      </div>
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
                      <SetRow key={s.code} set={s} era={e.name} byNumber={byNumber} goSet={goSet} onZoom={onZoom} />
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )
      })}
    </div>
  )
}

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

function SetRow({ set: s, era, byNumber, goSet, onZoom }: {
  set: SetInfo; era: string; byNumber: Map<string, CardRecord>;
  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void
}) {
  const feat = featuredCards(s, byNumber, 8)
  return (
    <div className="flex items-center gap-4 border border-slate-800 rounded-xl px-5 py-4 bg-slate-950/50">
      <button onClick={() => goSet(era, s.code)} className="w-72 shrink-0 text-left">
        <div className="text-[15px] font-bold leading-snug">[{s.code}] {s.name}</div>
        <div className="text-xs text-slate-500 mt-1">{s.kind} · {s.count} cards → browse</div>
        <div className="text-xs text-slate-400 mt-1.5 leading-snug" title={clanLine(feat)}>{clanLine(feat)}</div>
      </button>
      <div className="flex gap-2.5 flex-1 items-start justify-center">
        {feat.map((c) => (
          <span
            key={c.card_number}
            role="button"
            tabIndex={0}
            title={`${c.name} — click to zoom`}
            onClick={() => onZoom(c)}
            onKeyDown={(e) => { if (e.key === 'Enter') onZoom(c) } }
            className="block w-24 shrink-0 cursor-zoom-in"
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
  )
}

function PreviewPane({ card, onZoom, onAddToDeck }: { card: CardRecord | null; onZoom: (c: CardRecord) => void; onAddToDeck: (c: CardRecord) => void }) {
  if (!card) return <div className="flex-1 border-l border-slate-800 p-4 text-sm text-slate-500">Select a card.</div>
  const icons = card.skill_icons_raw ?? '—'
  const isTrigger = card.card_type === 'Trigger Unit'
  const triggerLine = isTrigger
    ? `${card.trigger_type ?? 'Trigger'}${card.trigger_power ? ` +${card.trigger_power}` : ''}`
    : ''
  const pairRows: [string, string, string, string][] = [
    ['Type', card.card_type ?? '—', 'Icons', icons],
    ['Clan', card.clan ?? '—', 'Race', card.race ?? '—'],
  ]
  const fullRows: [string, string][] = [
    ['Nation', card.nation ?? '—'],
    ['Set', `${card.set_code} · ${card.set_name}`],
  ]
  const lastRow: [string, string, string, string] = ['Illust', card.illustrator ?? '—', 'Rarity', card.rarity ?? '—']
  return (
    <div className="flex-1 border-l border-slate-800 overflow-y-auto thin-scroll p-4 min-h-0">
      <CardImg src={fullUrl(card)} alt={card.name} loading="eager" onClick={() => onZoom(card)} className="w-full rounded-lg cursor-zoom-in border border-slate-800 bg-black" />
      <div className="mt-2 text-lg font-bold text-slate-100">{card.name}</div>
      <div className="text-xs text-slate-500">{card.card_number} · {card.set_name}</div>
      <div className="grid grid-cols-4 gap-1.5 my-2 text-center">
        {[['Grade', card.grade ?? '—'], ['Power', card.power ?? '—'], ['Crit', card.critical ?? '—'], ['Shield', card.shield ?? '—']].map(([k, v]) => (
          <div key={k} className="bg-slate-900 rounded-lg px-1 py-1.5"><div className="text-[11px] text-slate-500">{k}</div><div className="text-base font-bold">{v}</div></div>
        ))}
      </div>
      <table className="w-full text-sm border-collapse">
        <tbody>
          {pairRows.map(([k1, v1, k2, v2], i) => (
            <tr key={i} className="border-b border-slate-800/60">
              <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">{k1}</td>
              <td className="py-1 pr-2 text-slate-200 align-top">{v1}</td>
              <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">{k2}</td>
              <td className="py-1 text-slate-200 align-top">{v2}</td>
            </tr>
          ))}
          {isTrigger && (
            <tr className="border-b border-amber-400/30 bg-amber-400/5">
              <td className="py-1 pr-1 text-amber-200 text-xs uppercase tracking-wide font-semibold align-top">Trigger</td>
              <td colSpan={3} className="py-1 text-slate-100 font-semibold">{triggerLine}</td>
            </tr>
          )}
          {fullRows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-800/60">
              <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">{k}</td>
              <td colSpan={3} className="py-1 text-slate-200">{v}</td>
            </tr>
          ))}
          <tr className="border-b border-slate-800/60">
            <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">{lastRow[0]}</td>
            <td className="py-1 pr-2 text-slate-200 align-top">{lastRow[1]}</td>
            <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">{lastRow[2]}</td>
            <td className="py-1 text-slate-200 align-top">{lastRow[3]}</td>
          </tr>
        </tbody>
      </table>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-3 mb-1">Skill</div>
      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{renderSkill(card.skill_text)}</div>
      {card.flavor_text && (
        <>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-2 mb-1">Flavor</div>
          <div className="text-sm text-slate-400 italic">{card.flavor_text}</div>
        </>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={() => onZoom(card)} className="flex-1 text-sm px-2 py-2 rounded border border-slate-700 hover:border-amber-400">Fullscreen</button>
        <button onClick={() => onAddToDeck(card)} className="flex-1 text-sm px-2 py-2 rounded bg-amber-400 text-white font-bold hover:bg-amber-300">+ Deck</button>
      </div>
      <div className="text-[11px] text-slate-600 mt-2">Preview uses the Upscaled image; grids use Raw for speed.</div>
    </div>
  )
}
