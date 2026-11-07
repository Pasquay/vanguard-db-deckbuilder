import { useState } from 'react'
import type { CardRecord, IndexMeta, SetInfo } from '../lib/types.ts'
import { KIND_ORDER, thumbUrl } from '../lib/types.ts'
import CardImg from './CardImg.tsx'
import { IconChevronDown, IconChevronRight } from './icons.tsx'

export default function SetsPage({ meta, byNumber, goSet, onZoom, navCollapsed }: {
  meta: IndexMeta; byNumber: Map<string, CardRecord>;
  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void; navCollapsed: boolean
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
  const anyOpen = openEras.size > 0
  const toggleAll = () => {
    if (anyOpen) {
      setOpenEras(new Set())
      setOpenKinds(new Set())
    } else {
      setOpenEras(new Set(meta.eras.map((e) => e.name)))
      setOpenKinds(new Set(meta.eras.flatMap((e) => e.sets.map((s) => `${e.name}::${s.kind}`))))
    }
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
        <button
          onClick={toggleAll}
          className="ml-2 text-sm px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          {anyOpen ? 'Collapse all' : 'Expand all'}
        </button>
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