import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Searcher from './components/Searcher.tsx'
import DecksPage from './components/DecksPage.tsx'
import Proxies from './components/Proxies.tsx'
import CardCreator from './components/CardCreator.tsx'
import SetsPage from './components/SetsPage.tsx'
import { IconChevronDown, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconGrid, IconHammer, IconLayers, IconLibrary, IconMoon, IconPackage, IconPrinter, IconSun, IconSwords } from './components/icons.tsx'
import DeckBuilder, { type SavedDeck } from './components/DeckBuilder.tsx'
import type { CardRecord, IndexMeta } from './lib/types.ts'
import { fullUrl, KIND_ORDER } from './lib/types.ts'
import { renderSkill } from './lib/skill.tsx'
import { desktop } from './lib/desktop.ts'
import { deckFileName } from './lib/decks.ts'

type Tab = 'home' | 'db' | 'deck' | 'decks' | 'sets' | 'proxies' | 'creator'

const LS_KEY = 'vg-decks-v1'
function loadDecks(): SavedDeck[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}
const uid = () => Math.random().toString(36).slice(2, 10)

export default function App() {
  const [cards, setCards] = useState<CardRecord[]>([])
  const [meta, setMeta] = useState<IndexMeta | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [navCollapsed, setNavCollapsed] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('vg-theme') as 'dark' | 'light') ?? 'dark')
  const [openEras, setOpenEras] = useState<Set<string>>(new Set())
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CardRecord | null>(null)
  const [lightbox, setLightbox] = useState<{ card: CardRecord; list: CardRecord[] } | null>(null)
  const [preset, setPreset] = useState<{ era?: string; set?: string } | null>(null)
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [decksReady, setDecksReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const prevDeckIds = useRef<Set<string>>(new Set())
  const [proxyDeckId, setProxyDeckId] = useState<string | null>(null)
  const [cardDbDir, setCardDbDir] = useState<string | null>(null)
  const [rescanning, setRescanning] = useState(false)
  const [rescanMsg, setRescanMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('data/all-cards.json').then((r) => { if (!r.ok) throw new Error(`all-cards.json ${r.status}`); return r.json() }),
      fetch('data/meta.json').then((r) => { if (!r.ok) throw new Error(`meta.json ${r.status}`); return r.json() }),
    ])
      .then(([c, m]) => {
        setCards(c)
        setMeta(m)
        setSelected(c[0] ?? null)
        c.slice(0, 30).forEach((card: CardRecord) => {
          if (card.image_raw) {
            const img = new Image()
            img.src = card.image_raw
          }
        })
      })
      .catch((e) => setLoadError(`Couldn't load card data (did you run "npm run index"?): ${e.message}`))
  }, [])

  // Initial load: server files win; localStorage fills gaps (migration path).
  useEffect(() => {
    const local = loadDecks()
    fetch('/api/decks')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.ok && Array.isArray(j.decks) && j.decks.length > 0) {
          const ids = new Set(j.decks.map((d: SavedDeck) => d.id))
          const merged = [...j.decks, ...local.filter((d) => !ids.has(d.id))]
          setDecks(merged)
          prevDeckIds.current = new Set(merged.map((d) => d.id))
        } else {
          setDecks(local)
          prevDeckIds.current = new Set(local.map((d) => d.id))
        }
      })
      .catch(() => {
        setDecks(local)
        prevDeckIds.current = new Set(local.map((d) => d.id))
      })
      .finally(() => setDecksReady(true))
  }, [])

  // Local backup (survives server outages; server files are the source of truth).
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(decks))
    } catch { /* storage full/blocked — server files still hold the decks */ }
  }, [decks])

  // Packaged app: ensure a CardDB folder is selected (first launch asks).
  // Re-asks if the saved folder went missing (moved/deleted drive).
  useEffect(() => {
    const d = desktop
    if (!d) return
    d.getState().then((s) => {
      if (s.cardDbDir && s.exists !== false) {
        setCardDbDir(s.cardDbDir)
      } else {
        d.pickFolder().then((dir) => {
          if (dir) window.location.reload()
        })
      }
    })
  }, [])

  const changeFolder = async () => {
    if (!desktop) return
    const d = await desktop.pickFolder()
    if (d) window.location.reload()
  }
  const rescan = async () => {
    if (!desktop || rescanning) return
    setRescanning(true)
    setRescanMsg(null)
    const r = await desktop.rescan()
    setRescanning(false)
    if (r.ok) window.location.reload()
    else setRescanMsg(r.error ?? 'Rescan failed.')
  }

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

  // Persist every deck to <CardDB>/decks/[ERA] Vanguard.json (debounced);
  // delete files for decks removed in the app.
  useEffect(() => {
    if (!decksReady) return
    const t = setTimeout(async () => {
      try {
        const cur = new Map(decks.map((d) => [d.id, d]))
        for (const d of decks) {
          await fetch('/api/decks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deck: d, file: deckFileName(d, byNumber) }),
          })
        }
        for (const id of prevDeckIds.current) {
          if (!cur.has(id)) {
            await fetch(`/api/decks/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
          }
        }
        prevDeckIds.current = new Set(cur.keys())
      } catch { /* offline — localStorage backup holds */ }
    }, 800)
    return () => clearTimeout(t)
  }, [decks, decksReady, byNumber])

  const zoom = useCallback((c: CardRecord, list?: CardRecord[]) => {
    setLightbox({ card: c, list: list ?? [] })
  }, [])

  const stepLightbox = useCallback((dir: 1 | -1) => {
    setLightbox((lb) => {
      if (!lb || lb.list.length < 2) return lb
      const i = lb.list.findIndex((c) => c.card_number === lb.card.card_number)
      if (i < 0) return lb
      return { card: lb.list[(i + dir + lb.list.length) % lb.list.length], list: lb.list }
    })
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
            ['proxies', <IconPrinter key="i" />, 'Proxies'],
            ['sets', <IconPackage key="i" />, 'Sets & Stats'],
            ['creator', <IconHammer key="i" />, 'Card Creator'],
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
            <div className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-slate-500 font-semibold">Sets</div>
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
        <div className="p-2 border-t border-slate-800 mt-auto space-y-1.5">
          <div className="px-1 text-[10px] text-slate-600" title="Build timestamp — quote this when reporting bugs">
            build {typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev'}
          </div>
          {desktop && !navCollapsed && (
            <div className="px-1">
              <div className="text-[11px] text-slate-500 truncate" title={cardDbDir ?? 'No CardDB folder selected'}>
                CardDB: {cardDbDir ? cardDbDir.split(/[/\\]/).slice(-2).join('/') : 'not set'}
              </div>
              <div className="flex gap-1 mt-1">
                <button onClick={changeFolder} title="Locate your CardDB folder" className="flex-1 text-xs px-2 py-1 rounded border border-slate-800 text-slate-300 hover:border-slate-500">
                  Change…
                </button>
                <button onClick={rescan} disabled={rescanning} title="Rebuild the card index from your CardDB" className="flex-1 text-xs px-2 py-1 rounded border border-slate-800 text-slate-300 hover:border-slate-500 disabled:opacity-50">
                  {rescanning ? 'Scanning…' : 'Rescan'}
                </button>
              </div>
              {rescanMsg && <div className="text-[11px] text-red-300 mt-1">{rescanMsg}</div>}
            </div>
          )}
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
        {tab === 'home' && <HomePage meta={meta} decks={decks} go={(t) => setTab(t)} />}
        {tab === 'db' && (
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
        )}
        {tab === 'deck' && (
          <div className="flex-1 min-w-0 p-3 min-h-0 flex flex-col">
            {!activeDeck ? (
              <div className="m-auto text-center">
                <div className="text-slate-300 mb-2">No deck open.</div>
                <button onClick={newDeck} className="px-4 py-2 rounded-lg bg-amber-400 text-white font-semibold">+ New deck</button>
              </div>
            ) : (
              <DeckBuilder cards={cards} deck={activeDeck} onChange={updateDeck} onZoom={zoom} />
            )}
          </div>
        )}
        {tab === 'decks' && (
          <DecksPage
            decks={decks}
            byNumber={byNumber}
            meta={meta}
            navCollapsed={navCollapsed}
            onOpen={(id) => { setActiveId(id); setTab('deck') }}
            onProxy={(id) => { setProxyDeckId(id); setTab('proxies') }}
            onZoom={zoom}
            onNew={newDeck}
            onDuplicate={(d) => setDecks((p) => [...p, { ...d, id: uid(), name: `${d.name} (copy)`, main: { ...d.main }, updatedAt: Date.now() }])}
            onDelete={(d) => {
              if (!confirm(`Delete "${d.name}"?`)) return
              setDecks((p) => p.filter((x) => x.id !== d.id))
              if (activeId === d.id) setActiveId(null)
            }}
          />
        )}
        {tab === 'sets' && <SetsPage meta={meta} byNumber={byNumber} goSet={goSet} onZoom={zoom} navCollapsed={navCollapsed} />}
        {tab === 'creator' && <CardCreator />}
        {tab === 'proxies' && (
          <Proxies key={proxyDeckId ?? activeId ?? 'none'} decks={decks} initialId={proxyDeckId ?? activeId} byNumber={byNumber} />
        )}
      </main>

      {lightbox && (
        <div
          data-card-lightbox
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl flex gap-0 overflow-hidden h-[600px] max-h-[88vh]"
            style={{ width: 900 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-5 right-4 z-10 text-slate-400 hover:text-white text-xl leading-none px-2"
            >✕</button>

            {lightbox.list.length > 1 && (
              <>
                <button
                  onClick={() => stepLightbox(-1)}
                  aria-label="Previous card"
                  className="fixed left-1/2 -ml-[512px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-800/90 border border-slate-600 text-white hover:bg-amber-400 hover:border-amber-400 flex items-center justify-center"
                ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 5 8 12 15 19" /></svg></button>
                <button
                  onClick={() => stepLightbox(1)}
                  aria-label="Next card"
                  className="fixed left-1/2 ml-[472px] top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-800/90 border border-slate-600 text-white hover:bg-amber-400 hover:border-amber-400 flex items-center justify-center"
                ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 5 16 12 9 19" /></svg></button>
              </>
            )}

            <div className="shrink-0 w-96 bg-black flex items-center justify-center p-4 rounded-l-2xl">
              <img
                src={fullUrl(lightbox.card)}
                alt={lightbox.card.name}
                loading="eager"
                className="w-full object-contain rounded-2xl"
              />
            </div>

            <div className="flex-1 overflow-y-auto thin-scroll p-5 min-h-0">
              <div className="text-xl font-bold text-slate-100 pr-8">{lightbox.card.name}</div>
              <div className="text-xs text-slate-500 mb-3">{lightbox.card.card_number} · {lightbox.card.set_name}</div>

              <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
                {([['Grade', lightbox.card.grade ?? '—'], ['Power', lightbox.card.power ?? '—'], ['Crit', lightbox.card.critical ?? '—'], ['Shield', lightbox.card.shield ?? '—']] as [string, string | number][]).map(([k, v]) => (
                  <div key={k} className="bg-slate-900 rounded-lg px-1 py-1.5">
                    <div className="text-[11px] text-slate-500">{k}</div>
                    <div className="text-base font-bold text-slate-100">{v}</div>
                  </div>
                ))}
              </div>

              {lightbox.card.skill_text && (
                <>
                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Skill</div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line mb-3">
                    {renderSkill(lightbox.card.skill_text)}
                  </div>
                </>
              )}

              <table className="w-full text-sm border-collapse mb-3">
                <tbody>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Clan</td>
                    <td className="py-1 pr-2 text-slate-200 align-top">{lightbox.card.clan ?? '—'}</td>
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Nation</td>
                    <td className="py-1 text-slate-200 align-top">{lightbox.card.nation ?? '—'}</td>
                  </tr>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Type</td>
                    <td className="py-1 pr-2 text-slate-200 align-top">{lightbox.card.card_type ?? '—'}</td>
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Race</td>
                    <td className="py-1 text-slate-200 align-top">{lightbox.card.race ?? '—'}</td>
                  </tr>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Icons</td>
                    <td className="py-1 pr-2 text-slate-200 align-top">{lightbox.card.skill_icons_raw ?? '—'}</td>
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Rarity</td>
                    <td className="py-1 text-slate-200 align-top">{lightbox.card.rarity ?? '—'}</td>
                  </tr>
                  {lightbox.card.card_type === 'Trigger Unit' && (
                    <tr className="border-b border-amber-400/30 bg-amber-400/5">
                      <td className="py-1 pr-1 text-amber-200 text-xs uppercase tracking-wide font-semibold align-top">Trigger</td>
                      <td colSpan={3} className="py-1 text-slate-100 font-semibold">
                        {lightbox.card.trigger_type ?? 'Trigger'}{lightbox.card.trigger_power ? ` +${lightbox.card.trigger_power}` : ''}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Set</td>
                    <td colSpan={3} className="py-1 text-slate-200">{lightbox.card.set_code} · {lightbox.card.set_name}</td>
                  </tr>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-1 pr-1 text-slate-500 text-xs uppercase tracking-wide w-14 align-top">Illust</td>
                    <td colSpan={3} className="py-1 text-slate-200">{lightbox.card.illustrator ?? '—'}</td>
                  </tr>
                </tbody>
              </table>

              {lightbox.card.flavor_text && (
                <>
                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Flavor</div>
                  <div className="text-sm text-slate-400 italic mb-3">{lightbox.card.flavor_text}</div>
                </>
              )}

              {lightbox.list.length > 1 && (
                <div className="text-xs text-slate-600 mt-1">← / → to browse · Esc to close</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HomePage({ meta, decks, go }: {
  meta: IndexMeta; decks: SavedDeck[]; go: (t: Tab) => void
}) {
  const totalSets = meta.eras.reduce((s, e) => s + e.sets.length, 0)
  const tiles: { icon: ReactNode; title: string; desc: string; action: () => void }[] = [
    { icon: <IconGrid className="w-9 h-9" />, title: 'Card DB', desc: `${meta.total} cards · search, filter & browse every era`, action: () => go('db') },
    { icon: <IconLayers className="w-9 h-9" />, title: 'Deck Builder', desc: 'One-page builder with pre-LB legality checks', action: () => go('deck') },
    { icon: <IconLibrary className="w-9 h-9" />, title: 'Decks', desc: `${decks.length} saved deck${decks.length === 1 ? '' : 's'} · official precons & more`, action: () => go('decks') },
    { icon: <IconPrinter className="w-9 h-9" />, title: 'Proxies', desc: 'Print proxy sheets from any deck', action: () => go('proxies') },
    { icon: <IconPackage className="w-9 h-9" />, title: 'Sets & Stats', desc: `${totalSets} sets · browse, meta & stats by era`, action: () => go('sets') },
    { icon: <IconHammer className="w-9 h-9" />, title: 'Card Creator', desc: 'Design and build your own custom cards', action: () => go('creator') },
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
      </div>
    </div>
  )
}