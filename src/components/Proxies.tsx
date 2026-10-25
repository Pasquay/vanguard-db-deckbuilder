import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardRecord, SortKey } from '../lib/types.ts'
import { compareCards, fullUrl } from '../lib/types.ts'
import { desktop } from '../lib/desktop.ts'
import { CARD_BACK } from './CardImg.tsx'
import type { SavedDeck } from './DeckBuilder.tsx'

interface Props {
  decks: SavedDeck[]
  initialId: string | null
  byNumber: Map<string, CardRecord>
}

type OrderKey = 'deck' | SortKey | 'custom'
type GuideStyle = 'full' | 'corners' | 'dashed' | 'dash-corners' | 'none'

const PAGE_MM: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: 'A4' },
  Letter: { w: 216, h: 279, label: 'Letter' },
  Legal: { w: 216, h: 356, label: 'Legal' },
  custom: { w: 210, h: 297, label: 'Custom…' },
}

const CARD_PRESETS: Record<string, { w: number; h: number; label: string }> = {
  vanguard: { w: 59, h: 86, label: 'Vanguard / Yu-Gi-Oh! (59×86)' },
  standard: { w: 63, h: 88, label: 'MTG / Pokémon (63×88)' },
  sleeve: { w: 62, h: 90.4, label: 'Sleeve VG (62×90)' },
  custom: { w: 59, h: 86, label: 'Custom…' },
}

interface Item {
  key: string
  card: CardRecord
}

function ProxyImg({ src, alt, scale, rotate, filter }: {
  src: string; alt: string; scale: number; rotate: boolean; filter: string
}) {
  const [dead, setDead] = useState(false)
  const shown = !dead && src ? src : CARD_BACK
  return (
    <img
      src={shown}
      alt={alt}
      loading="eager"
      draggable={false}
      onError={() => setDead(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `${rotate ? 'rotate(90deg) ' : ''}scale(${scale})`,
        filter: filter === 'none' ? undefined : filter,
      }}
    />
  )
}

/** Page-level cut grid in pure SVG strokes (never CSS backgrounds, so it prints
    identically with or without "background graphics"). Full/dashed draw one
    continuous line per boundary (no phase seams); corners draw per-cell ticks. */
function GridLines({ cols, rows, cw, ch, style, color, thick, len, count, dash, gap }: {
  cols: number; rows: number; cw: number; ch: number
  style: GuideStyle; color: string; thick: number; len: number; count: number; dash: number; gap: number
}) {
  if (style === 'none') return null
  const W = cols * cw
  const H = rows * ch
  const dasharray = style === 'dashed'
    ? `${dash}mm ${gap}mm`
    : style === 'dash-corners'
      ? `${len / (2 * Math.max(1, count) - 1)}mm ${len / (2 * Math.max(1, count) - 1)}mm`
      : undefined
  const els: React.ReactNode[] = []
  if (style === 'full' || style === 'dashed') {
    for (let i = 0; i <= cols; i++) {
      els.push(<line key={`v${i}`} x1={i * cw} y1={0} x2={i * cw} y2={H} />)
    }
    for (let j = 0; j <= rows; j++) {
      els.push(<line key={`h${j}`} x1={0} y1={j * ch} x2={W} y2={j * ch} />)
    }
  } else {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x0 = c * cw
        const x1 = (c + 1) * cw
        const y0 = r * ch
        const y1 = (r + 1) * ch
        const segs = [
          [x0, y0, x0 + len, y0], [x0, y0, x0, y0 + len],
          [x1, y0, x1 - len, y0], [x1, y0, x1, y0 + len],
          [x0, y1, x0 + len, y1], [x0, y1, x0, y1 - len],
          [x1, y1, x1 - len, y1], [x1, y1, x1, y1 - len],
        ]
        segs.forEach(([ax, ay, bx, by], k) => {
          els.push(<line key={`${c}-${r}-${k}`} x1={ax} y1={ay} x2={bx} y2={by} />)
        })
      }
    }
  }
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <g stroke={color} style={{ strokeWidth: `${thick}mm`, strokeDasharray: dasharray }}>
        {els}
      </g>
    </svg>
  )
}

function SliderRow({ label, value, set, min, max, step, unit }: {
  label: string; value: number; set: (n: number) => void
  min: number; max: number; step: number; unit: string
}) {
  const [text, setText] = useState<string | null>(null)
  const commit = (raw: string) => {
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) {
      setText(null)
      return
    }
    const rounded = Math.round(n / step) * step
    set(Math.min(max, Math.max(min, Math.round(rounded * 100) / 100)))
    setText(null)
  }
  const shown = text ?? String(Math.round(value * 100) / 100)
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-300">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => { set(+e.target.value); setText(null) }}
        className="flex-1 min-w-0 accent-amber-400"
      />
      <button onClick={() => set(Math.max(min, Math.round((value - step) * 100) / 100))} className="w-6 h-6 shrink-0 rounded border border-slate-700 hover:border-slate-500 text-sm leading-none">−</button>
      <input
        value={shown}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          // Live-commit while typing (clamped, unrounded) so a print taken
          // immediately after editing still uses the typed value.
          const n = parseFloat(raw)
          if (Number.isFinite(n)) set(Math.min(max, Math.max(min, n)))
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
        className="w-14 shrink-0 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-right outline-none focus:border-amber-400"
      />
      <button onClick={() => set(Math.min(max, Math.round((value + step) * 100) / 100))} className="w-6 h-6 shrink-0 rounded border border-slate-700 hover:border-slate-500 text-sm leading-none">+</button>
      <span className="w-8 shrink-0 text-xs text-slate-500">{unit}</span>
    </div>
  )
}

function Stepper({ label, value, set, min, max }: {
  label: string; value: number; set: (n: number) => void; min: number; max: number
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-300">
      <span className="w-24 shrink-0">{label}</span>
      <button onClick={() => set(Math.max(min, value - 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
      <span className="w-10 text-center">{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
    </div>
  )
}

const PROXY_LS_KEY = 'vg-proxy-settings-v1'

function loadProxySettings() {
  try { return JSON.parse(localStorage.getItem(PROXY_LS_KEY) ?? '{}') } catch { return {} }
}
function saveProxySettings(s: object) {
  try { localStorage.setItem(PROXY_LS_KEY, JSON.stringify(s)) } catch {}
}

type SectionId = 'page' | 'cards' | 'guides' | 'bleed' | 'image' | 'export'

export default function Proxies({ decks, initialId, byNumber }: Props) {
  const [open, setOpen] = useState<Set<SectionId>>(new Set())
  const [deckId, setDeckId] = useState<string | null>(initialId ?? decks[0]?.id ?? null)
  const ls = useMemo(() => loadProxySettings(), [])
  const [pageSize, setPageSize] = useState(ls.pageSize ?? 'A4')
  const [customPw, setCustomPw] = useState(ls.customPw ?? 210)
  const [customPh, setCustomPh] = useState(ls.customPh ?? 297)
  const [pageOrient, setPageOrient] = useState<'portrait' | 'landscape'>(ls.pageOrient ?? 'portrait')
  const [rows, setRows] = useState(ls.rows ?? 3)
  const [cols, setCols] = useState(ls.cols ?? 3)
  const [order, setOrder] = useState<OrderKey>(ls.order === 'custom' ? 'deck' : ls.order ?? 'deck')
  const [manualKeys, setManualKeys] = useState<string[] | null>(null)
  const [cardPreset, setCardPreset] = useState(ls.cardPreset ?? 'vanguard')
  const [cardW, setCardW] = useState(ls.cardW ?? 59)
  const [cardH, setCardH] = useState(ls.cardH ?? 86)
  const [rotation, setRotation] = useState<'portrait' | 'landscape'>(ls.rotation ?? 'portrait')
  const [guides, setGuides] = useState<GuideStyle>(ls.guides ?? 'corners')
  const [guideColor, setGuideColor] = useState(ls.guideColor ?? '#00ff00')
  const [thick, setThick] = useState(ls.thick ?? 0.2)
  const [tickLen, setTickLen] = useState(ls.tickLen ?? 4)
  const [dashLen, setDashLen] = useState(ls.dashLen ?? 1)
  const [gapLen, setGapLen] = useState(ls.gapLen ?? 1)
  const [dashCount, setDashCount] = useState<number>(ls.dashCount ?? 3)
  const [guideOn, setGuideOn] = useState(ls.guideOn ?? true)
  const [bleedOn, setBleedOn] = useState(ls.bleedOn ?? true)
  const [vigOn, setVigOn] = useState(ls.vigOn ?? false)
  const [bleed, setBleed] = useState(ls.bleed ?? 0.1)
  const [bright, setBright] = useState(ls.bright ?? 100)
  const [contrast, setContrast] = useState(ls.contrast ?? 100)
  const [saturate, setSaturate] = useState(ls.saturate ?? 100)
  const [vigStr, setVigStr] = useState(ls.vigStr ?? 10)
  const [vigReach, setVigReach] = useState(ls.vigReach ?? 10)
  const [targetDpi, setTargetDpi] = useState(ls.targetDpi ?? 600)
  const [natW, setNatW] = useState<Record<string, number>>({})
  const [zoom, setZoom] = useState<number>(ls.zoom ?? 1)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [insert, setInsert] = useState<{ idx: number; side: 'before' | 'after' } | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    saveProxySettings({
      pageSize, customPw, customPh, pageOrient, rows, cols, order,
      cardPreset, cardW, cardH, rotation, guides, guideColor, thick,
      tickLen, dashLen, gapLen, dashCount, guideOn, bleedOn, vigOn,
      bleed, bright, contrast, saturate, vigStr, vigReach, targetDpi, zoom,
    })
  }, [pageSize, customPw, customPh, pageOrient, rows, cols, order,
      cardPreset, cardW, cardH, rotation, guides, guideColor, thick,
      tickLen, dashLen, gapLen, dashCount, guideOn, bleedOn, vigOn,
      bleed, bright, contrast, saturate, vigStr, vigReach, targetDpi, zoom])
  
  const deck = decks.find((d) => d.id === deckId) ?? null

  const exportPdf = async () => {
    if (!deck || exporting) return
    setExporting(true)
    setExportMsg(null)
    try {
      const r = await desktop.exportPdf(deck.name)
      if (r.ok) {
        setExportMsg(`Saved: ${r.path}`)
      } else if (!r.cancelled) {
        // No native path (plain browser dev) — fall back to system print.
        if (!desktop.hasBridge) window.print()
        else setExportMsg(`Export failed: ${r.error ?? 'unknown error'}`)
      }
    } finally {
      setExporting(false)
    }
  }

  // Save-as-PDF defaults to the document title — use the deck name.
  useEffect(() => {
    const prev = document.title
    if (deck) document.title = `${deck.name} - proxies`
    return () => { document.title = prev }
  }, [deck])

  const base: Item[] = useMemo(() => {
    if (!deck) return []
    const out: Item[] = []
    for (const [num, n] of Object.entries(deck.main)) {
      const c = byNumber.get(num)
      if (!c) continue
      for (let i = 0; i < n; i++) out.push({ key: `${num}#${i}`, card: c })
    }
    return out
  }, [deck, byNumber])

  const items: Item[] = useMemo(() => {
    if (order === 'custom' && manualKeys) {
      const byKey = new Map(base.map((it) => [it.key, it]))
      return manualKeys.map((k) => byKey.get(k)).filter((x): x is Item => !!x)
    }
    if (order === 'deck' || order === 'custom') return base
    return [...base].sort((a, b) => compareCards(a.card, b.card, order))
  }, [base, order, manualKeys])

  // Probe natural image widths for effective-DPI readout.
  useEffect(() => {
    const srcs = [...new Set(items.map((it) => fullUrl(it.card)).filter(Boolean))]
    let live = true
    for (const s of srcs) {
      if (natW[s] !== undefined) continue
      const im = new Image()
      im.onload = () => {
        if (live) setNatW((p) => (p[s] === undefined ? { ...p, [s]: im.naturalWidth } : p))
      }
      im.src = s
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const pickOrder = (o: OrderKey) => {
    setOrder(o)
    if (o !== 'custom') setManualKeys(null)
  }

  const dropAt = (globalIdx: number) => {
    if (!dragKey) return
    const side = insert && insert.idx === globalIdx ? insert.side : 'after'
    const keys = items.map((it) => it.key)
    const from = keys.indexOf(dragKey)
    if (from < 0) return
    let to = globalIdx + (side === 'after' ? 1 : 0)
    keys.splice(from, 1)
    if (from < to) to -= 1
    keys.splice(to, 0, dragKey)
    setManualKeys(keys)
    setOrder('custom')
    setDragKey(null)
    setInsert(null)
  }

  const dragCard = dragKey ? items.find((x) => x.key === dragKey)?.card ?? null : null

  const perPage = rows * cols
  const pages = useMemo(() => {
    const out: Item[][] = []
    for (let i = 0; i < items.length; i += perPage) out.push(items.slice(i, i + perPage))
    return out
  }, [items, perPage])

  const basePage = pageSize === 'custom' ? { w: customPw, h: customPh } : PAGE_MM[pageSize]
  const pw = pageOrient === 'portrait' ? basePage.w : basePage.h
  const ph = pageOrient === 'portrait' ? basePage.h : basePage.w
  const cw = rotation === 'portrait' ? cardW : cardH
  const ch = rotation === 'portrait' ? cardH : cardW
  const effGuides: GuideStyle = guideOn ? guides : 'none'
  const effBleed = bleedOn ? bleed : 0
  const effVig = vigOn ? vigStr : 0
  const vigAlpha = effVig / 100
  const vigR = Math.min(vigReach, cw / 2, ch / 2)
  const bleedScale = 1 + (effBleed * 2) / Math.max(1, cw)
  const filterStr = bright === 100 && contrast === 100 && saturate === 100
    ? 'none'
    : `brightness(${bright / 100}) contrast(${contrast / 100}) saturate(${saturate / 100})`
  const needW = cols * cw
  const needH = rows * ch
  const fitW = pw - 16
  const fitH = ph - 16
  const overflows = needW > fitW + 1e-6 || needH > fitH + 1e-6
  const missing = deck ? Object.keys(deck.main).filter((num) => !byNumber.get(num)).length : 0

  const dpis = items.map((it) => {
    const w = natW[fullUrl(it.card)]
    return w ? { name: it.card.name, dpi: Math.round((w / cw) * 25.4) } : null
  }).filter((x): x is { name: string; dpi: number } => !!x)
  const minDpi = dpis.length ? Math.min(...dpis.map((d) => d.dpi)) : null
  const lowCount = dpis.filter((d) => d.dpi < targetDpi).length

  const applyPreset = (id: string) => {
    setCardPreset(id)
    if (id !== 'custom') {
      const p = CARD_PRESETS[id]
      setCardW(p.w)
      setCardH(p.h)
    }
  }

  const toggleSection = (s: SectionId) =>
    setOpen((p) => {
      const n = new Set(p)
      if (n.has(s)) n.delete(s)
      else n.add(s)
      return n
    })

  const cell = (it: Item, globalIdx: number, interactive: boolean, ns: string) => (
    <div
      key={it.key}
      className="relative overflow-hidden bg-white"
      style={{ width: `${cw}mm`, height: `${ch}mm` }}
      draggable={interactive}
      onDragStart={interactive
        ? (e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', it.key)
          // Transparent native ghost + our own solid floating preview
          // (the default ghost renders washed-out and can't be fixed).
          const ghost = document.createElement('canvas')
          ghost.width = 1
          ghost.height = 1
          e.dataTransfer.setDragImage(ghost, 0, 0)
          setDragKey(it.key)
        }
        : undefined}
      onDragOver={interactive
        ? (e) => {
          e.preventDefault()
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const side = e.clientX - r.left < r.width / 2 ? 'before' : 'after'
          setInsert((prev) => (prev && prev.idx === globalIdx && prev.side === side ? prev : { idx: globalIdx, side }))
        }
        : undefined}
      onDragLeave={interactive ? () => setInsert((prev) => (prev && prev.idx === globalIdx ? null : prev)) : undefined}
      onDrop={interactive ? (e) => { e.preventDefault(); dropAt(globalIdx) } : undefined}
      onDragEnd={interactive ? () => { setDragKey(null); setInsert(null) } : undefined}
      title={interactive ? `${it.card.name} — drag to reorder` : it.card.name}
    >
      <ProxyImg src={fullUrl(it.card)} alt={it.card.name} scale={bleedScale} rotate={rotation === 'landscape'} filter={filterStr} />
      {effVig > 0 && (
        <svg className="absolute pointer-events-none" width="100%" height="100%" style={{ inset: 0 }} viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`vg-${ns}-${globalIdx}-t`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity={vigAlpha} />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`vg-${ns}-${globalIdx}-b`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity={vigAlpha} />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`vg-${ns}-${globalIdx}-l`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity={vigAlpha} />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`vg-${ns}-${globalIdx}-r`} x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity={vigAlpha} />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={cw} height={vigR} fill={`url(#vg-${ns}-${globalIdx}-t)`} />
          <rect x={0} y={ch - vigR} width={cw} height={vigR} fill={`url(#vg-${ns}-${globalIdx}-b)`} />
          <rect x={0} y={0} width={vigR} height={ch} fill={`url(#vg-${ns}-${globalIdx}-l)`} />
          <rect x={cw - vigR} y={0} width={vigR} height={ch} fill={`url(#vg-${ns}-${globalIdx}-r)`} />
        </svg>
      )}
      {interactive && insert && insert.idx === globalIdx && (
        <div
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{
            [insert.side === 'before' ? 'left' : 'right']: 0,
            width: '0.8mm',
            background: '#ff0000',
          }}
        />
      )}
    </div>
  )

  const sections: { id: SectionId; label: string; body: React.ReactNode }[] = [
    {
      id: 'page', label: 'Page Layout', body: (
        <>
          <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
            {Object.keys(PAGE_MM).map((p) => (
              <button key={p} onClick={() => setPageSize(p)} className={`flex-1 px-1 py-1.5 ${pageSize === p ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{PAGE_MM[p].label}</button>
            ))}
          </div>
          {pageSize === 'custom' && (
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <input type="number" min={50} max={500} step={1} value={customPw} onChange={(e) => setCustomPw(+e.target.value || 0)} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-amber-400" />
              <span className="text-xs text-slate-500">×</span>
              <input type="number" min={50} max={500} step={1} value={customPh} onChange={(e) => setCustomPh(+e.target.value || 0)} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-amber-400" />
              <span className="text-xs text-slate-500">mm</span>
            </div>
          )}
          <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
            {(['portrait', 'landscape'] as const).map((o) => (
              <button key={o} onClick={() => setPageOrient(o)} className={`flex-1 px-2 py-1.5 capitalize ${pageOrient === o ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{o}</button>
            ))}
          </div>
          <Stepper label="Rows" value={rows} set={setRows} min={1} max={6} />
          <Stepper label="Cols" value={cols} set={setCols} min={1} max={6} />
          <div className={`text-xs ${overflows ? 'text-red-300' : 'text-slate-500'}`}>
            Grid {Math.round(needW)}×{Math.round(needH)}mm on {Math.round(fitW)}×{Math.round(fitH)}mm printable
            {overflows ? ' — overflows the page, reduce rows/cols or card size.' : ' — fits.'}
          </div>
        </>
      ),
    },
    {
      id: 'cards', label: 'Cards', body: (
        <>
          <select value={order} onChange={(e) => pickOrder(e.target.value as OrderKey)} className="w-full text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5" title="Card order">
            <option value="deck">Order: deck</option>
            <option value="set">Order: set</option>
            <option value="name">Order: name</option>
            <option value="grade">Order: grade</option>
            <option value="power">Order: power</option>
            <option value="clan">Order: clan</option>
            <option value="custom" disabled={!manualKeys}>Custom (dragged)</option>
          </select>
          {order === 'custom' && <div className="text-xs text-slate-500">Drag cards in the preview to arrange. Changing order above resets this.</div>}
          <select value={cardPreset} onChange={(e) => applyPreset(e.target.value)} className="w-full text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5" title="Card size preset">
            {Object.entries(CARD_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-sm text-slate-300">
            <input type="number" min={20} max={120} step={0.5} value={cardW} onChange={(e) => { setCardW(+e.target.value || 0); setCardPreset('custom') }} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-amber-400" />
            <span className="text-xs text-slate-500">×</span>
            <input type="number" min={20} max={170} step={0.5} value={cardH} onChange={(e) => { setCardH(+e.target.value || 0); setCardPreset('custom') }} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-amber-400" />
            <span className="text-xs text-slate-500">mm</span>
          </div>
          <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
            {(['portrait', 'landscape'] as const).map((r) => (
              <button key={r} onClick={() => setRotation(r)} className={`flex-1 px-2 py-1.5 capitalize ${rotation === r ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}>{r}</button>
            ))}
          </div>
          <div className="text-xs text-slate-500">Sleeved fit prints VG art at 63×88 so it fills an MTG sleeve and stays readable.</div>
        </>
      ),
    },
    {
      id: 'guides', label: 'Guidelines', body: (
        <>
          <div className="grid grid-cols-5 gap-1 text-xs">
            {(['full', 'corners', 'dashed', 'dash-corners', 'none'] as GuideStyle[]).map((g) => (
              <button key={g} onClick={() => setGuides(g)} className={`px-1 py-1 text-xs rounded border capitalize ${guides === g ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{g === 'dash-corners' ? 'dash corn.' : g}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-300">
            <span className="w-24 shrink-0">Color</span>
            <input type="color" value={guideColor} onChange={(e) => setGuideColor(e.target.value)} className="w-10 h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer" />
            <span className="text-xs text-slate-500">{guideColor}</span>
          </div>
          <SliderRow label="Thickness" value={thick} set={setThick} min={0.1} max={2} step={0.1} unit="mm" />
          {(guides === 'corners' || guides === 'dash-corners') && (
            <SliderRow label="Tick length" value={tickLen} set={setTickLen} min={1} max={15} step={0.1} unit="mm" />
          )}
          {guides === 'dash-corners' && (
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <span className="w-24 shrink-0">Dashes</span>
              <button onClick={() => setDashCount((v) => Math.max(1, v - 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
              <span className="w-10 text-center">{dashCount}</span>
              <button onClick={() => setDashCount((v) => Math.min(8, v + 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
            </div>
          )}
          {guides === 'dashed' && (
            <>
              <SliderRow label="Dash length" value={dashLen} set={setDashLen} min={0.5} max={10} step={0.1} unit="mm" />
              <SliderRow label="Gap length" value={gapLen} set={setGapLen} min={0.5} max={10} step={0.1} unit="mm" />
            </>
          )}
          {(!guideOn || guides === 'none') && <div className="text-xs text-slate-500">Guidelines off.</div>}
        </>
      ),
    },
    {
      id: 'bleed', label: 'Bleed', body: (
        <>
          <SliderRow label="Bleed" value={bleed} set={setBleed} min={0} max={3} step={0.1} unit="mm" />
          <div className="text-xs text-slate-500">Art is scaled up under an overflow crop, so cuts land on art instead of white edges. 0.1mm is a safe hairline; use 1–3mm for borderless cutting.</div>
        </>
      ),
    },
    {
      id: 'image', label: 'Image', body: (
        <>
          <SliderRow label="Brightness" value={bright} set={setBright} min={20} max={200} step={1} unit="%" />
          <SliderRow label="Contrast" value={contrast} set={setContrast} min={20} max={200} step={1} unit="%" />
          <SliderRow label="Saturate" value={saturate} set={setSaturate} min={0} max={200} step={1} unit="%" />
          <SliderRow label="Vignette" value={vigStr} set={setVigStr} min={0} max={80} step={1} unit="%" />
          <SliderRow label="Vig reach" value={vigReach} set={setVigReach} min={2} max={40} step={0.5} unit="mm" />
          <button onClick={() => { setBright(100); setContrast(100); setSaturate(100); setVigStr(10); setVigReach(10); setVigOn(true) }} className="w-full text-xs px-2 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-slate-500">
            Reset image to defaults
          </button>
          <div className="text-[11px] text-slate-600" title="Debug readout">
            dbg: vigOn={String(vigOn)} vigStr={String(vigStr)} effVig={effVig}
          </div>
          <div className="text-xs text-slate-500">Applied to every card on the sheet, preview and print alike. Useful for dark scans — try Contrast 110 + Brightness 105.</div>
        </>
      ),
    },
    {
      id: 'export', label: 'Export', body: (
        <>
          <SliderRow label="Target DPI" value={targetDpi} set={setTargetDpi} min={150} max={800} step={50} unit="" />
          <div className="text-sm text-slate-300 space-y-1">
            <div>{items.length} cards · {pages.length} page{pages.length === 1 ? '' : 's'} · {pageSize} {pageOrient}</div>
            <div className="text-slate-500">{cols}×{rows} grid · {cw}×{ch}mm {rotation} · {effGuides} guides · {effBleed}mm bleed</div>
            {dpis.length > 0 && (
              <div className={lowCount > 0 ? 'text-amber-200' : 'text-emerald-300'}>
                Art resolution: min {minDpi} DPI · {dpis.length - lowCount}/{dpis.length} meet {targetDpi} DPI
                {lowCount > 0 ? ' — small/old scans print soft above their native size.' : ' — all cards meet target.'}
              </div>
            )}
            {dpis.length === 0 && <div className="text-slate-500">Measuring art resolution…</div>}
          </div>
          <button
            onClick={exportPdf}
            disabled={items.length === 0 || exporting}
            className="w-full py-2.5 rounded-lg bg-amber-400 text-white font-bold hover:brightness-110 disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : desktop.hasBridge ? 'Export PDF' : 'Print / Save PDF'}
          </button>
          <div className="text-[11px] text-slate-500">Engine: {desktop.hasBridge ? 'native PDF' : 'system print fallback'}</div>
          {exportMsg && <div className="text-xs text-slate-300">{exportMsg}</div>}
          {missing > 0 && <div className="text-xs text-amber-200">⚠ {missing} card(s) missing art and were skipped.</div>}
          <div className="text-[11px] text-slate-500">Tip: 300 DPI is the print-shop standard, 150 is the playable minimum. Effective DPI = scan pixels ÷ printed size — sizing a card up lowers it. Uses Upscaled art. In the print dialog choose “Save as PDF”. One cell per copy.</div>
        </>
      ),
    },
  ]

  return (
    <div className="flex-1 flex min-h-0 min-w-0">
      <style>{`@page { size: ${pw}mm ${ph}mm; margin: 0; }`}</style>
      <div className="w-80 shrink-0 flex flex-col min-h-0 border-r border-slate-800">
        <div className="p-3 pb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Deck</div>
          <select value={deckId ?? ''} onChange={(e) => { setDeckId(e.target.value); setManualKeys(null); setOrder('deck') }} className="w-full text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({Object.values(d.main).reduce((s, n) => s + n, 0)})
              </option>
            ))}
          </select>
          {decks.length === 0 && <div className="text-xs text-slate-500 mt-1">No decks yet — build one first.</div>}
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll min-h-0">
          {sections.map((s) => {
            const isOpen = open.has(s.id)
            const tgl = s.id === 'guides' ? { v: guideOn, set: setGuideOn }
              : s.id === 'bleed' ? { v: bleedOn, set: setBleedOn }
              : s.id === 'image' ? { v: vigOn, set: setVigOn }
              : null
            return (
              <div key={s.id} className="border-b border-slate-800">
                <div className="flex items-center">
                  <button
                    onClick={() => toggleSection(s.id)}
                    className={`flex-1 text-left px-3 py-2 text-sm font-semibold ${isOpen ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {s.label}
                  </button>
                  {tgl && (
                    <button
                      onClick={() => tgl.set(!tgl.v)}
                      title={tgl.v ? 'Turn off' : 'Turn on'}
                      className={`w-8 h-5 shrink-0 rounded-full border transition ${tgl.v ? 'bg-amber-400 border-amber-400' : 'bg-slate-800 border-slate-700'}`}
                    >
                      <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-all ${tgl.v ? 'ml-4' : 'ml-0.5'}`} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleSection(s.id)}
                    className="px-2 text-slate-400 hover:text-slate-200"
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    <span className={`border-b-2 ${isOpen ? 'border-amber-400' : 'border-transparent'} px-1`}>
                      {isOpen ? '▾' : '▸'}
                    </span>
                  </button>
                </div>
                {isOpen && <div className="px-3 pb-3 space-y-2.5">{s.body}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 text-sm">
          <span className="text-slate-400">Preview</span>
          <button onClick={() => setZoom((z) => Math.max(0.15, Math.round((z - 0.05) * 100) / 100))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
          <span className="w-14 text-center text-slate-300">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.05) * 100) / 100))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
          <span className="text-xs text-slate-500 ml-auto">{items.length} cards · drag between cards to reorder</span>
        </div>
        <div
          className="flex-1 overflow-auto thin-scroll p-4 min-h-0 bg-black/20"
          onDragOver={(e) => { if (dragKey) setMouse({ x: e.clientX, y: e.clientY }) }}
          onDrop={() => { setDragKey(null); setInsert(null); setMouse(null) }}
        >
          {pages.length === 0 && <div className="text-sm text-slate-500 text-center mt-10">Pick a deck to preview its proxy sheet.</div>}
          <div className="space-y-6">
            {pages.map((cells, pi) => (
              <div key={pi}>
                <div className="text-xs text-slate-500 mb-1">Page {pi + 1}/{pages.length}</div>
                <div className="proxy-preview-page mx-auto overflow-hidden" style={{ width: `${pw}mm`, zoom }}>
                  <div className="grid relative mx-auto" style={{ width: `${needW}mm`, gridTemplateColumns: `repeat(${cols}, ${cw}mm)`, gridAutoRows: `${ch}mm`, margin: '8mm auto' }}>
                    {cells.map((it, li) => cell(it, pi * perPage + li, true, 'pv'))}
                    <GridLines cols={cols} rows={rows} cw={cw} ch={ch} style={effGuides} color={guideColor} thick={thick} len={tickLen} count={dashCount} dash={dashLen} gap={gapLen} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dragCard && mouse && (
        <div
          className="fixed z-[100] pointer-events-none w-28 rounded overflow-hidden shadow-2xl opacity-100"
          style={{ left: mouse.x, top: mouse.y, transform: 'translate(-50%, -50%)' }}
        >
          <ProxyImg src={fullUrl(dragCard)} alt="" scale={1} rotate={false} filter={filterStr} />
        </div>
      )}

      {createPortal(
        <div id="proxy-print-root">
          {pages.map((cells, pi) => (
            <div key={pi} style={{ width: `${pw}mm`, height: `${ph}mm`, padding: '8mm', background: '#fff', pageBreakAfter: pi < pages.length - 1 ? 'always' : 'auto' }}>
              <div className="grid relative mx-auto" style={{ width: `${needW}mm`, gridTemplateColumns: `repeat(${cols}, ${cw}mm)`, gridAutoRows: `${ch}mm`, justifyContent: 'center' }}>
                {cells.map((it, li) => cell(it, pi * perPage + li, false, 'pr'))}
                <GridLines cols={cols} rows={rows} cw={cw} ch={ch} style={effGuides} color={guideColor} thick={thick} len={tickLen} count={dashCount} dash={dashLen} gap={gapLen} />
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

