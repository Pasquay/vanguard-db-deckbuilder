import { useMemo, useRef, useState } from 'react'
import type { CardRecord, GroupBy, IndexMeta } from '../lib/types.ts'
import { fullUrl, groupKey, thumbUrl } from '../lib/types.ts'
import { distribute } from '../lib/types.ts'
import CardImg from './CardImg.tsx'
import { IconChevronDown, IconChevronRight, IconSliders } from './icons.tsx'
import { BAN_PRESETS, FORMATS, latestPreset, presetDate, validateDeck, type Region, type Strictness } from '../lib/rules.ts'

export interface SavedDeck {
  id: string
  name: string
  formatId: string
  strictness: Strictness
  region: Region
  asOf: string
  /** Banlist preset id, or 'custom' for a hand-picked date. */
  asOfPreset?: string
  main: { [card_number: string]: number }
  starter: string | null
  cover?: string | null
  updatedAt: number
}

export function deckCover(deck: SavedDeck, byNumber: Map<string, CardRecord>): CardRecord | undefined {
  if (deck.cover && byNumber.get(deck.cover)) return byNumber.get(deck.cover)
  if (deck.starter && byNumber.get(deck.starter)) return byNumber.get(deck.starter)
  const first = Object.keys(deck.main)[0]
  return first ? byNumber.get(first) : undefined
}

interface Props {
  cards: CardRecord[]
  meta: IndexMeta
  deck: SavedDeck
  onChange: (d: SavedDeck) => void
  onZoom: (c: CardRecord) => void
}

type DeckView = 'list' | 'grid' | 'stacked'

export default function DeckBuilder({ cards, deck, onChange, onZoom }: Props) {
  const [q, setQ] = useState('')
  const [searchView, setSearchView] = useState<'compressed' | 'grid'>('compressed')
  const [deckView, setDeckView] = useState<DeckView>('list')
  const [deckGroup, setDeckGroup] = useState<GroupBy>('grade')
  const [hovered, setHovered] = useState<CardRecord | null>(null)
  const [leftW, setLeftW] = useState(320)
  const [rightW, setRightW] = useState(300)
  const [dragging, setDragging] = useState(false)
  const [draggingRight, setDraggingRight] = useState(false)
  const [collapsedStacks, setCollapsedStacks] = useState<Set<string>>(new Set())
  const [showPoolFilters, setShowPoolFilters] = useState(false)
  const [stackCols, setStackCols] = useState(2)
  const [collapsedDeckGroups, setCollapsedDeckGroups] = useState<Set<string>>(new Set())
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [poolF, setPoolF] = useState({ clan: '', nation: '', grade: '', ct: '', trig: '', set: '' })
  const gridRef = useRef<HTMLDivElement>(null)
  const byNumber = useMemo(() => new Map(cards.map((c) => [c.card_number, c])), [cards])
  const format = FORMATS.find((x) => x.id === deck.formatId) ?? FORMATS[0]

  const patch = (p: Partial<SavedDeck>) => onChange({ ...deck, ...p, updatedAt: Date.now() })
  const eff = presetDate(deck.region, deck.asOfPreset ?? 'custom', deck.asOf)

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startW = leftW
    const move = (ev: MouseEvent) => {
      setLeftW(Math.min(620, Math.max(220, startW + ev.clientX - startX)))
    }
    const up = () => {
      setDragging(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const startRightDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    setDraggingRight(true)
    const startX = e.clientX
    const startW = rightW
    const move = (ev: MouseEvent) => {
      setRightW(Math.min(480, Math.max(220, startW - (ev.clientX - startX))))
    }
    const up = () => {
      setDraggingRight(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const toggleStack = (k: string) =>
    setCollapsedStacks((p) => {
      const n = new Set(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const poolOpts = useMemo(() => {
    const u = (fn: (c: CardRecord) => string | null) => [...new Set(cards.map(fn).filter((x): x is string => !!x))].sort()
    return {
      clans: u((c) => c.clan),
      nations: u((c) => c.nation),
      types: u((c) => c.card_type),
      trigs: u((c) => c.trigger_type),
      sets: u((c) => c.set_code),
    }
  }, [cards])

  const poolActive = Object.values(poolF).filter(Boolean).length

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let r = cards
    if (needle) {
      r = r.filter((c) =>
        [c.name, c.skill_text, c.clan, c.nation, c.race, c.card_number, c.set_code]
          .filter(Boolean).join(' ').toLowerCase().includes(needle),
      )
    }
    if (poolF.clan) r = r.filter((c) => c.clan === poolF.clan)
    if (poolF.nation) r = r.filter((c) => c.nation === poolF.nation)
    if (poolF.grade !== '') r = r.filter((c) => c.grade === +poolF.grade)
    if (poolF.ct) r = r.filter((c) => c.card_type === poolF.ct)
    if (poolF.trig) r = r.filter((c) => c.trigger_type === poolF.trig)
    if (poolF.set) r = r.filter((c) => c.set_code === poolF.set)
    return r.slice(0, 150)
  }, [cards, q, poolF])

  const add = (c: CardRecord) =>
    patch({ main: { ...deck.main, [c.card_number]: (deck.main[c.card_number] ?? 0) + 1 } })
  const setCount = (num: string, n: number) => {
    const next = { ...deck.main }
    if (n <= 0) delete next[num]
    else next[num] = n
    patch({ main: next })
  }

  const issues = useMemo(
    () => validateDeck(deck.main, deck.starter, byNumber, format, { strictness: deck.strictness, region: deck.region, asOf: eff.date }),
    [deck, byNumber, format],
  )
  const errors = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warn')

  const total = Object.values(deck.main).reduce((s, n) => s + n, 0)
  const gradeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [num, n] of Object.entries(deck.main)) {
      const c = byNumber.get(num)
      const k = c?.grade === null || c?.grade === undefined ? '—' : `G${c.grade}`
      m.set(k, (m.get(k) ?? 0) + n)
    }
    return [...m.entries()].sort()
  }, [deck.main, byNumber])
  const trigStats = useMemo(() => {
    const byKind = new Map<string, number>()
    let t = 0, h = 0
    for (const [num, n] of Object.entries(deck.main)) {
      const c = byNumber.get(num)
      if (c?.card_type === 'Trigger Unit') {
        t += n
        const k = c.trigger_type ?? 'Unknown'
        byKind.set(k, (byKind.get(k) ?? 0) + n)
        if (k.toLowerCase() === 'heal') h += n
      }
    }
    return { t, h, byKind: [...byKind.entries()] }
  }, [deck.main, byNumber])
  const clanCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [num, n] of Object.entries(deck.main)) {
      const c = byNumber.get(num)
      m.set(c?.clan ?? 'No clan', (m.get(c?.clan ?? 'No clan') ?? 0) + n)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [deck.main, byNumber])

  const sortedDeck = useMemo(() => {
    const rows = Object.entries(deck.main)
      .map(([num, n]) => ({ c: byNumber.get(num)!, n }))
      .filter((r) => r.c)
    rows.sort((a, b) => (b.c.grade ?? -1) - (a.c.grade ?? -1) || a.c.name.localeCompare(b.c.name))
    return rows
  }, [deck.main, byNumber])

  const deckGroups = useMemo(() => {
    if (deckGroup === 'none') return [{ key: '', items: sortedDeck }]
    const m = new Map<string, { c: CardRecord; n: number }[]>()
    for (const r of sortedDeck) {
      const k = groupKey(r.c, deckGroup)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    const arr = [...m.entries()].map(([key, items]) => ({ key, items }))
    return deckGroup === 'grade' ? arr.sort((a, b) => b.key.localeCompare(a.key)) : arr.sort((a, b) => a.key.localeCompare(b.key))
  }, [sortedDeck, deckGroup])

  const starter = deck.starter ? byNumber.get(deck.starter) : undefined
  const preview = hovered ?? starter ?? sortedDeck[0]?.c ?? null

  const exportText = () => {
    const lines = [`# ${deck.name} (${format.label}, ${deck.region}, ${eff.label})`]
    if (starter) lines.push(`START: 1x ${starter.name} [${starter.card_number}]`)
    for (const { c, n } of sortedDeck) lines.push(`${n}x ${c.name} [${c.card_number}]`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${deck.name.replace(/\s+/g, '_')}.txt`
    a.click()
  }
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${deck.name.replace(/\s+/g, '_')}.json`
    a.click()
  }

  const importFile = async (file: File) => {
    setImportMsg(null)
    const text = await file.text()
    const errors: string[] = []
    // JSON format (our own export)
    if (file.name.endsWith('.json')) {
      try {
        const j = JSON.parse(text)
        if (!j.main || typeof j.main !== 'object') throw new Error('not a deck file (missing "main")')
        const main: { [k: string]: number } = {}
        for (const [num, n] of Object.entries(j.main)) {
          if (byNumber.has(num) && typeof n === 'number' && n > 0) main[num] = Math.min(99, Math.floor(n))
          else errors.push(`Unknown card: ${num}`)
        }
        const starter = typeof j.starter === 'string' && byNumber.has(j.starter) ? j.starter : null
        patch({
          name: typeof j.name === 'string' ? j.name : deck.name,
          formatId: typeof j.formatId === 'string' ? j.formatId : deck.formatId,
          main, starter,
          cover: typeof j.cover === 'string' && byNumber.has(j.cover) ? j.cover : null,
        })
        setImportMsg(errors.length ? `Imported with ${errors.length} skipped (${errors.slice(0, 3).join('; ')})` : 'Deck imported.')
      } catch (e) {
        setImportMsg(`Import failed: ${e instanceof Error ? e.message : e}`)
      }
      return
    }
    // TXT format (our export: "# Name", "START: 1x Name [NUM]", "Nx Name [NUM]")
    const byName = new Map<string, CardRecord>()
    for (const c of cards) {
      const k = c.name.toLowerCase()
      if (!byName.has(k)) byName.set(k, c)
    }
    const main: { [k: string]: number } = {}
    let starter: string | null = null
    let name: string | null = null
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('#')) {
        const m = /^#\s*(.+?)(?:\s*\(.*\))?$/.exec(line)
        if (m && !name) name = m[1]
        continue
      }
      const m = /^(?:START:\s*)?(\d+)\s*x\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$/i.exec(line)
      if (!m) { errors.push(`Skipped: ${line.slice(0, 40)}`); continue }
      const n = parseInt(m[1], 10)
      const num = (m[3] ?? '').toUpperCase()
      const c = (num && byNumber.get(num)) || byName.get(m[2].toLowerCase())
      if (!c) { errors.push(`Unknown card: ${m[2].slice(0, 40)}`); continue }
      if (/^START:/i.test(line)) starter = c.card_number
      else main[c.card_number] = (main[c.card_number] ?? 0) + n
    }
    patch({ ...(name ? { name } : {}), main, starter })
    const total = Object.values(main).reduce((s, x) => s + x, 0)
    setImportMsg(`Imported ${total} cards${starter ? ' + starter' : ''}.${errors.length ? ` ${errors.length} line(s) skipped.` : ''}`)
  }

  const stepper = (num: string, n: number) => (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => setCount(num, n - 1)} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-sm leading-none">−</button>
      <span className="w-7 text-center text-sm font-bold">×{n}</span>
      <button onClick={() => setCount(num, n + 1)} className="w-6 h-6 rounded bg-slate-800 hover:bg-amber-400 hover:text-white text-sm leading-none">+</button>
    </div>
  )

  const vgButton = (c: CardRecord) => (
    <button
      onClick={() => patch({ cover: deck.cover === c.card_number ? null : c.card_number })}
      title={deck.cover === c.card_number ? 'Unset deck Vanguard' : 'Set as deck Vanguard (ace + cover photo)'}
      className={`text-[11px] font-black px-1.5 py-0.5 rounded border shrink-0 ${deck.cover === c.card_number ? 'bg-amber-400 text-white border-amber-400' : 'text-slate-500 border-slate-700 hover:text-amber-200 hover:border-amber-400/60'}`}
    >
      VG
    </button>
  )
  const starButton = (c: CardRecord) => (
    <button
      onClick={() => patch({ starter: c.card_number })}
      title="Set as starting Vanguard"
      className={`text-base px-1 shrink-0 ${deck.starter === c.card_number ? 'text-amber-400' : 'text-slate-600 hover:text-amber-200'}`}
    >
      ★
    </button>
  )
  const rowHL = (c: CardRecord) =>
    deck.cover === c.card_number
      ? 'border-amber-400/70 bg-amber-400/5'
      : deck.starter === c.card_number
        ? 'border-sky-400/50 bg-sky-400/5'
        : ''

  const isCustom = (deck.asOfPreset ?? 'custom') === 'custom'

  const actionControls = (
    <>
      <span className={`font-semibold px-2 py-1 rounded ${errors.length ? 'bg-red-500/15 text-red-300' : warns.length ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-300'}`}>
        {total}/{format.mainSize} {errors.length ? `· ${errors.length} error${errors.length > 1 ? 's' : ''}` : warns.length ? `· ${warns.length} warning${warns.length > 1 ? 's' : ''}` : '· legal'}
      </span>
      <button onClick={exportText} className="px-2 py-1.5 rounded border border-slate-700 hover:border-slate-500">Export .txt</button>
      <button onClick={exportJson} className="px-2 py-1.5 rounded border border-slate-700 hover:border-slate-500">Export .json</button>
      <button onClick={() => fileRef.current?.click()} className="px-2 py-1.5 rounded border border-slate-700 hover:border-slate-500">Import</button>
      <input ref={fileRef} type="file" accept=".txt,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
      {importMsg && <span className="text-xs text-slate-400">{importMsg}</span>}
      <button onClick={() => { if (confirm('Clear this deck?')) patch({ main: {}, starter: null, cover: null }) }} title="Clear this deck" className="px-2 py-1.5 rounded bg-red-500/15 text-red-300 border border-red-900/30 hover:bg-red-500/25 font-semibold">Clear</button>
    </>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        <input
          value={deck.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm font-semibold w-48 outline-none focus:border-amber-400"
        />
        <select value={deck.formatId} onChange={(e) => patch({ formatId: e.target.value })} className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
          {FORMATS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <div className="flex rounded overflow-hidden border border-slate-700">
          {(['strict', 'casual'] as Strictness[]).map((s) => (
            <button key={s} onClick={() => patch({ strictness: s })} className={`px-2.5 py-1.5 capitalize ${deck.strictness === s ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{s}</button>
          ))}
        </div>
        <div className="flex rounded overflow-hidden border border-slate-700">
          {(['EN', 'JP'] as Region[]).map((r) => (
            <button key={r} onClick={() => patch({ region: r, asOfPreset: latestPreset(r) })} className={`px-2.5 py-1.5 ${deck.region === r ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{r}</button>
          ))}
        </div>
        <select
          value={deck.asOfPreset ?? 'custom'}
          onChange={(e) => patch({ asOfPreset: e.target.value })}
          title="Banlist / restriction list date"
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 max-w-52 text-sm"
        >
          {BAN_PRESETS.filter((p) => p.region === deck.region).map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          <option value="custom">Custom date…</option>
        </select>
        {(deck.asOfPreset ?? 'custom') === 'custom' && (
          <label className="text-slate-400">as of <input type="date" value={deck.asOf} onChange={(e) => patch({ asOf: e.target.value })} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200" /></label>
        )}
        {!isCustom && actionControls}
      </div>
      {isCustom && (
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        {actionControls}
      </div>
      )}

      <div ref={gridRef} className="flex-1 grid gap-0 min-h-0" style={{ gridTemplateColumns: `${leftW}px 10px 1fr 10px ${rightW}px` }}>
        <div className="flex flex-col min-h-0 border border-slate-800 rounded-lg p-2 bg-slate-950/50">
          <div className="flex items-center gap-2 mb-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pool to add…" className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400" />
            <button onClick={() => setShowPoolFilters((v) => !v)} title="Pool filters" className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded border shrink-0 ${showPoolFilters || poolActive ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-300'}`}>
              <IconSliders className="w-3.5 h-3.5" />{poolActive ? ` ${poolActive}` : ''}
            </button>
            <div className="flex rounded overflow-hidden border border-slate-700 text-xs shrink-0">
              {(['compressed', 'grid'] as const).map((v) => (
                <button key={v} onClick={() => setSearchView(v)} className={`px-2 py-1.5 capitalize ${searchView === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>
                  {v === 'compressed' ? 'Cards' : 'Grid'}
                </button>
              ))}
            </div>
          </div>
          {showPoolFilters && (
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-xs">
              <select value={poolF.clan} onChange={(e) => setPoolF((p) => ({ ...p, clan: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                <option value="">Clan: all</option>
                {poolOpts.clans.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={poolF.nation} onChange={(e) => setPoolF((p) => ({ ...p, nation: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                <option value="">Nation: all</option>
                {poolOpts.nations.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={poolF.grade} onChange={(e) => setPoolF((p) => ({ ...p, grade: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                <option value="">Grade: all</option>
                {[0, 1, 2, 3, 4].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              <select value={poolF.ct} onChange={(e) => setPoolF((p) => ({ ...p, ct: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                <option value="">Type: all</option>
                {poolOpts.types.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={poolF.trig} onChange={(e) => setPoolF((p) => ({ ...p, trig: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                <option value="">Trigger: all</option>
                {poolOpts.trigs.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={poolF.set} onChange={(e) => setPoolF((p) => ({ ...p, set: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
                <option value="">Set: all</option>
                {poolOpts.sets.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {poolActive > 0 && (
                <button onClick={() => setPoolF({ clan: '', nation: '', grade: '', ct: '', trig: '', set: '' })} className="col-span-2 text-amber-300 hover:text-amber-200 py-0.5">
                  Clear pool filters ({poolActive})
                </button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto thin-scroll min-h-0">
            {searchView === 'compressed' ? (
              <div className="space-y-1">
                {searchResults.map((c) => (
                  <div key={c.card_number} className="flex items-center gap-2 p-1 rounded hover:bg-slate-900" onMouseEnter={() => setHovered(c)} onMouseLeave={() => setHovered(null)}>
                    <CardImg src={thumbUrl(c)} alt="" onClick={() => onZoom(c)} className="w-9 h-12 object-cover rounded cursor-zoom-in bg-slate-800" />
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onZoom(c)} title={c.skill_text.slice(0, 200)}>
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-slate-500 truncate">{c.card_number} · {c.grade !== null ? `G${c.grade}` : ''} {c.clan ?? ''} {deck.main[c.card_number] ? `· in deck ×${deck.main[c.card_number]}` : ''}</div>
                    </div>
                    <button onClick={() => add(c)} className="text-sm px-2 py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-bold shrink-0">+</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {searchResults.map((c) => (
                  <div key={c.card_number} className="cursor-pointer rounded overflow-hidden border border-slate-800 hover:border-amber-400 flex flex-col" onMouseEnter={() => setHovered(c)} onMouseLeave={() => setHovered(null)} onClick={() => onZoom(c)} title={`${c.name} — click to zoom`}>
                    <div className="w-full aspect-[50/73] bg-black flex items-center justify-center overflow-hidden">
                      <CardImg src={thumbUrl(c)} alt={c.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="px-1 py-0.5 bg-slate-900">
                      <div className="text-[11px] font-medium truncate">{c.name}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); add(c) }} className="text-xs py-0.5 bg-slate-800 hover:bg-amber-400 hover:text-white font-bold">+ Add{deck.main[c.card_number] ? ` (${deck.main[c.card_number]})` : ''}</button>
                  </div>
                ))}
              </div>
            )}
            {searchResults.length === 0 && <div className="text-sm text-slate-500 p-2">No matches.</div>}
          </div>
        </div>

        <div onMouseDown={startDrag} title="Drag to resize" className={`vsplit-handle mx-1 rounded ${dragging ? 'active bg-amber-400' : 'bg-transparent'}`}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-1 h-16 rounded bg-slate-700" />
          </div>
        </div>

        <div className="flex flex-col min-h-0 border border-slate-800 rounded-lg p-2 bg-slate-950/50">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Deck <span className="normal-case font-normal text-slate-500">(starter counts toward the 50)</span>
            </div>
            <select value={deckGroup} onChange={(e) => setDeckGroup(e.target.value as GroupBy)} className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-1">
              <option value="none">Group: none</option>
              <option value="grade">Group: grade</option>
              <option value="card_type">Group: card type</option>
              <option value="clan">Group: clan</option>
              <option value="nation">Group: nation</option>
              <option value="trigger_type">Group: trigger</option>
            </select>
            {deckView === 'stacked' && (
              <span className="flex items-center gap-1 text-xs text-slate-500" title="Columns per group">
                <button onClick={() => setStackCols((v) => Math.max(1, v - 1))} className="w-6 h-6 rounded border border-slate-700 hover:border-slate-500 text-sm">−</button>
                <span className="w-14 text-center">{stackCols} col{stackCols === 1 ? '' : 's'}</span>
                <button onClick={() => setStackCols((v) => Math.min(6, v + 1))} className="w-6 h-6 rounded border border-slate-700 hover:border-slate-500 text-sm">+</button>
              </span>
            )}
            <div className="flex rounded overflow-hidden border border-slate-700 text-xs ml-auto shrink-0">
              {(['list', 'grid', 'stacked'] as DeckView[]).map((v) => (
                <button key={v} onClick={() => setDeckView(v)} className={`px-2 py-1 capitalize ${deckView === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{v}</button>
              ))}
            </div>
          </div>
          {starter ? (
            <div className={`flex items-center gap-2 p-1.5 rounded bg-amber-400/10 border border-amber-400/40 mb-2`} onMouseEnter={() => setHovered(starter)} onMouseLeave={() => setHovered(null)}>
              <CardImg src={thumbUrl(starter)} alt="" onClick={() => onZoom(starter)} className="w-9 h-12 object-cover rounded cursor-zoom-in" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">★ {starter.name} <span className="font-normal text-slate-400">(starter)</span></div>
                <div className="text-xs text-slate-400">{starter.card_number}</div>
              </div>
              <button onClick={() => patch({ starter: null })} className="text-sm text-slate-400 hover:text-white px-1">✕</button>
            </div>
          ) : (
            <div className="text-sm text-slate-500 border border-dashed border-slate-700 rounded p-2 mb-2">
              No starter — click ★ on a Grade 0 row below.
            </div>
          )}
          <div className="flex-1 overflow-y-auto thin-scroll min-h-0">
            {deckView === 'stacked' ? (
              <div className="space-y-3">
                {deckGroups.map(({ key, items }) => {
                  const pileKey = key || 'all'
                  const shut = collapsedStacks.has(`${deckGroup}::${pileKey}`)
                  return (
                  <div key={pileKey} className="w-full">
                    {key && (
                      <button
                        onClick={() => toggleStack(`${deckGroup}::${pileKey}`)}
                        className="w-full text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1 text-center border border-slate-800 rounded py-1 hover:border-slate-500"
                        title={shut ? 'Expand pile' : 'Collapse pile'}
                      >
                        <span className="inline-flex items-center gap-1">{shut ? <IconChevronRight /> : <IconChevronDown />} {key}</span> <span className="text-slate-500">({items.reduce((s, r) => s + r.n, 0)})</span>
                      </button>
                    )}
                    {!shut && (
                    <div className="flex gap-2 px-1">
                      {distribute(items.flatMap(({ c, n }) => Array.from({ length: n }, () => c)), stackCols).map((col, ci) => (
                        <div key={ci} className="flex-1 min-w-0">
                        {col.map((c, i) => {
                          const cur = deck.main[c.card_number] ?? 0
                          return (
                        <div
                          key={`${c.card_number}#${ci}-${i}`}
                          onMouseEnter={() => setHovered(c)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => onZoom(c)}
                          className={`group/strip relative rounded overflow-hidden border cursor-pointer ${deck.cover === c.card_number ? 'border-amber-400 ring-1 ring-amber-400' : deck.starter === c.card_number ? 'border-sky-400' : 'border-slate-700 hover:border-slate-400 hover:z-20'} bg-slate-900`}
                          style={{ marginTop: i === 0 ? 0 : -58, zIndex: 1 }}
                          title={`${c.name} — click to zoom`}
                        >
                          <div className="px-1.5 pt-1 text-[11px] font-semibold truncate text-slate-100" title={c.name}>
                            {c.name}{deck.cover === c.card_number ? ' [VG]' : ''}{deck.starter === c.card_number ? ' ★' : ''}
                          </div>
                          <div className="relative">
                            <CardImg src={thumbUrl(c)} alt="" className="w-full h-20 object-cover object-top" />
                            <span className="absolute top-1 right-1 hidden group-hover/strip:flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); patch({ cover: deck.cover === c.card_number ? null : c.card_number }) }} title="Set as deck Vanguard" className={`h-5 px-1 rounded text-[10px] font-black leading-none ${deck.cover === c.card_number ? 'bg-amber-400 text-white' : 'bg-black/70 text-white hover:bg-slate-600'}`}>VG</button>
                              <button onClick={(e) => { e.stopPropagation(); patch({ starter: c.card_number }) }} title="Set as starting Vanguard" className={`w-5 h-5 rounded text-xs leading-none ${deck.starter === c.card_number ? 'bg-black/70 text-amber-400' : 'bg-black/70 text-white hover:bg-slate-600'}`}>★</button>
                              <button onClick={(e) => { e.stopPropagation(); setCount(c.card_number, cur - 1) }} title="Remove one copy" className="w-5 h-5 rounded bg-black/70 text-white hover:bg-slate-600 text-xs leading-none">−</button>
                              <button onClick={(e) => { e.stopPropagation(); setCount(c.card_number, cur + 1) }} title="Add one copy" className="w-5 h-5 rounded bg-black/70 text-white hover:bg-amber-400 text-xs leading-none">+</button>
                            </span>
                          </div>
                        </div>
                          )
                        })}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                  )
                })}
              </div>
            ) : (
              deckGroups.map(({ key, items }) => {
                const gk = `${deckGroup}::${key || 'all'}`
                const gShut = collapsedDeckGroups.has(gk)
                const gCount = items.reduce((s, r) => s + r.n, 0)
                const gToggle = () => setCollapsedDeckGroups((p) => {
                  const n = new Set(p)
                  if (n.has(gk)) n.delete(gk)
                  else n.add(gk)
                  return n
                })
                return (
                <div key={key || 'all'}>
                  {key && (
                    <button onClick={gToggle} className="w-full flex items-center gap-1.5 text-xs font-semibold text-amber-200/90 uppercase tracking-wider pt-1 pb-0.5 hover:text-amber-100">
                      {gShut ? <IconChevronRight /> : <IconChevronDown />} {key} <span className="text-slate-500 normal-case">({gCount})</span>
                    </button>
                  )}
                  {deckView === 'list' ? (
                    <div className="space-y-1">
                      {(gShut ? [] : items).map(({ c, n }) => (
                        <div key={c.card_number} onMouseEnter={() => setHovered(c)} onMouseLeave={() => setHovered(null)} className={`flex items-center gap-2 p-1 rounded border border-transparent hover:bg-slate-900 ${rowHL(c)}`}>
                          <CardImg src={thumbUrl(c)} alt="" onClick={() => onZoom(c)} className="w-9 h-12 object-cover rounded cursor-zoom-in bg-slate-800 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {c.name}
                              {deck.cover === c.card_number && <span className="ml-1.5 text-[10px] font-black text-amber-400 border border-amber-400/60 rounded px-1">VG</span>}
                              {deck.starter === c.card_number && <span className="ml-1.5 text-[10px] font-bold text-sky-300">★ starter</span>}
                            </div>
                            <div className="text-xs text-slate-500 truncate">{c.card_number} · {c.grade !== null ? `G${c.grade}` : ''} · {c.card_type}</div>
                          </div>
                          {vgButton(c)}
                          {starButton(c)}
                          {stepper(c.card_number, n)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 py-1">
                      {(gShut ? [] : items).flatMap(({ c, n }) => Array.from({ length: n }, (_, k) => ({ c, k }))).map(({ c, k }) => {
                        return (
                        <div key={`${c.card_number}#${k}`} onMouseEnter={() => setHovered(c)} onMouseLeave={() => setHovered(null)} className={`group/tile rounded overflow-hidden border flex flex-col ${deck.cover === c.card_number ? 'border-amber-400 ring-1 ring-amber-400' : deck.starter === c.card_number ? 'border-sky-400' : 'border-slate-800 hover:border-amber-400/60'}`}>
                          <div className="relative w-full aspect-[50/73] bg-black cursor-zoom-in" onClick={() => onZoom(c)}>
                            <CardImg src={thumbUrl(c)} alt={c.name} className="w-full h-full object-contain" />
                            {deck.starter === c.card_number && <span className="absolute top-1 left-1 text-xs bg-black/70 text-sky-300 rounded px-1">★</span>}
                            {deck.cover === c.card_number && <span className="absolute bottom-1 left-1 text-[10px] font-black bg-amber-400 text-white rounded px-1">VG</span>}
                          </div>
                          <div className="px-1 py-0.5 bg-slate-900 text-[11px] font-medium truncate" title={c.name}>{c.name}</div>
                          <div className="flex items-center gap-1 px-1 py-0.5 bg-slate-900">
                            {vgButton(c)}
                            {starButton(c)}
                            <span className="ml-auto flex items-center gap-1">
                              <button onClick={() => setCount(c.card_number, (deck.main[c.card_number] ?? 0) - 1)} title="Remove one copy" className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-600 text-xs leading-none">−</button>
                              <button onClick={() => setCount(c.card_number, (deck.main[c.card_number] ?? 0) + 1)} title="Add one copy" className="w-5 h-5 rounded bg-slate-800 hover:bg-amber-400 hover:text-white text-xs leading-none">+</button>
                            </span>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                )
              })
            )}
            {sortedDeck.length === 0 && <div className="text-sm text-slate-500 p-2">Empty deck — add cards from the left pool.</div>}
          </div>
        </div>

        <div
          onMouseDown={startRightDrag}
          title="Drag to resize preview"
          className={`vsplit-handle mx-1 rounded ${draggingRight ? 'active bg-amber-400' : 'bg-transparent'}`}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-1 h-16 rounded bg-slate-700" />
          </div>
        </div>

        <div className="flex flex-col min-h-0 border border-slate-800 rounded-lg p-3 bg-slate-950/50 overflow-y-auto thin-scroll text-sm">
          {preview ? (
            <div className="mb-2">
              <CardImg src={fullUrl(preview)} alt={preview.name} loading="eager" onClick={() => onZoom(preview)} className="w-full rounded-lg cursor-zoom-in border border-slate-800 bg-black" />
              <div className="text-sm font-semibold mt-1 truncate">{preview.name}</div>
              <div className="text-xs text-slate-500">{hovered ? 'hovering' : starter ? 'starter' : 'first card'} · {preview.card_number}</div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 mb-2">Hover any card to preview it here.</div>
          )}
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Validation</div>
          {issues.length === 0 && <div className="text-emerald-300 mb-3">✓ Deck is legal.</div>}
          {errors.map((i, k) => <div key={`e${k}`} className="text-red-300 mb-1.5">✕ {i.text}</div>)}
          {warns.map((i, k) => <div key={`w${k}`} className="text-amber-200/90 mb-1.5">⚠ {i.text}</div>)}
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mt-3 mb-1">Grades</div>
          {gradeCounts.map(([g, n]) => (
            <div key={g} className="flex items-center gap-2 mb-1">
              <span className="w-8 text-slate-300">{g}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded"><div className="h-2 bg-sky-400 rounded" style={{ width: `${Math.min(100, (n / total) * 100 || 0)}%` }} /></div>
              <span className="w-6 text-right text-slate-300">{n}</span>
            </div>
          ))}
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mt-3 mb-1">
            Triggers <span className="normal-case font-normal">({trigStats.t}/{format.triggersExact} · Heal {trigStats.h}/{format.maxHeal})</span>
          </div>
          {trigStats.byKind.map(([k, n]) => (
            <div key={k} className="flex justify-between py-0.5 text-slate-300"><span>{k}</span><span>{n}</span></div>
          ))}
          <div className="flex-1 h-2 bg-slate-800 rounded my-2"><div className="h-2 bg-amber-400 rounded" style={{ width: `${Math.min(100, (trigStats.t / (format.triggersExact ?? 16)) * 100)}%` }} /></div>
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Clans</div>
          {clanCounts.map(([cl, n]) => (
            <div key={cl} className="flex justify-between py-0.5 text-slate-300"><span className="truncate mr-2">{cl}</span><span>{n}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}
