import { useMemo, useState } from 'react'
import type { CardRecord, Filters, GroupBy, IndexMeta, SortKey, ViewMode } from '../lib/types.ts'
import { EMPTY_FILTERS, cardMatches, groupKey, sortCards, thumbUrl } from '../lib/types.ts'
import { distribute } from '../lib/types.ts'
import { renderSkill as rsx } from '../lib/skill.tsx'
import CardImg from './CardImg.tsx'
import { IconChevronDown, IconChevronRight } from './icons.tsx'

interface Props {
  cards: CardRecord[]
  meta: IndexMeta
  selected: CardRecord | null
  onSelect: (c: CardRecord) => void
  onZoom: (c: CardRecord, list: CardRecord[]) => void
  onAdd?: (c: CardRecord) => void
  preset?: { era?: string; set?: string } | null
  compact?: boolean
}

function CheckList({ title, options, active, onToggle, defaultOpen }: {
  title: string; options: (string | number)[]; active: (string | number)[]; onToggle: (v: string | number) => void; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  if (!options.length) return null
  return (
    <div className="mb-3">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 hover:text-slate-200">
        {open ? <IconChevronDown /> : <IconChevronRight />}
        <span className="flex-1 text-left">{title}</span>
        {active.length > 0 && <span className="text-amber-300">({active.length})</span>}
      </button>
      {open && (
      <div className="space-y-0.5">
        {options.map((o) => (
          <label key={String(o)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer px-1 py-0.5 rounded hover:bg-slate-800">
            <input
              type="checkbox"
              className="accent-amber-400"
              checked={active.includes(o)}
              onChange={() => onToggle(o)}
            />
            <span className="truncate">{String(o)}</span>
          </label>
        ))}
      </div>
      )}
    </div>
  )
}

const KIND_ORDER = ['Booster', 'Extra Booster', 'Trial Deck', 'Promo', 'Other']

const STAT = (c: CardRecord) =>
  [c.grade !== null ? `G${c.grade}` : '', c.power ? `${c.power}` : '', c.card_type === 'Trigger Unit' ? (c.trigger_type ? `${c.trigger_type}` : 'Trigger') : '']
    .filter(Boolean).join(' · ')

export default function Searcher({ cards, meta, selected, onSelect, onZoom, onAdd, preset, compact }: Props) {
  const [f, setF] = useState<Filters>({
    ...EMPTY_FILTERS,
    eras: preset?.era ? [preset.era] : [],
    sets: preset?.set ? [preset.set] : [],
  })
  const [view, setView] = useState<ViewMode>(compact ? 'compressed' : 'grid')
  const [group, setGroup] = useState<GroupBy>('none')
  const [sort, setSort] = useState<SortKey>('set')
  const [gridCols, setGridCols] = useState(4) // 0 = auto-fill
  const [stackCols, setStackCols] = useState(2)
  const [showFilters, setShowFilters] = useState(!compact)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [collapsedStacks, setCollapsedStacks] = useState<Set<string>>(new Set())
  const [filterW, setFilterW] = useState(232)
  const [resizingFilters, setResizingFilters] = useState(false)
  const [openSets, setOpenSets] = useState(true)
  const [openSetKinds, setOpenSetKinds] = useState<Set<string>>(new Set())
  const [openEraFilters, setOpenEraFilters] = useState<Set<string>>(() => new Set(meta.eras.map((e) => e.name)))

  const startFilterResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizingFilters(true)
    const startX = e.clientX
    const startW = filterW
    const move = (ev: MouseEvent) => setFilterW(Math.min(420, Math.max(150, startW + ev.clientX - startX)))
    const up = () => {
      setResizingFilters(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }))
  const toggleIn = (key: 'clans' | 'nations' | 'card_types' | 'trigger_types' | 'sets' | 'rarities' | 'eras', v: string) =>
    setF((p) => {
      const arr = p[key] as string[]
      return { ...p, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }
    })
  const toggleGrade = (g: number) =>
    setF((p) => ({ ...p, grades: p.grades.includes(g) ? p.grades.filter((x) => x !== g) : [...p.grades, g] }))

  const results = useMemo(() => {
    const r = cards.filter((c) => cardMatches(c, f))
    return sortCards(r, sort)
  }, [cards, f, sort])

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: '', items: results }]
    const m = new Map<string, CardRecord[]>()
    for (const c of results) {
      const k = groupKey(c, group)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(c)
    }
    return [...m.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => a.key.localeCompare(b.key))
  }, [results, group])

  const toggleGroup = (k: string) =>
    setCollapsed((p) => {
      const n = new Set(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const toggleStack = (k: string) =>
    setCollapsedStacks((p) => {
      const n = new Set(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const toggleSetKind = (k: string) =>
    setOpenSetKinds((p) => toggleSet(p, k))

  const toggleSet = (set: Set<string>, v: string): Set<string> => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  // Era header checkbox: select/clear every set in that era.
  const toggleEraSets = (eraName: string) => {
    const codes = meta.eras.find((e) => e.name === eraName)?.sets.map((s) => s.code) ?? []
    setF((p) => {
      const allIn = codes.length > 0 && codes.every((c) => p.sets.includes(c))
      return { ...p, sets: allIn ? p.sets.filter((c) => !codes.includes(c)) : [...new Set([...p.sets, ...codes])] }
    })
  }

  // Stacked view piles cards into columns; falls back to grade when no group-by.
  const stackGroups = useMemo(() => {
    const eff: GroupBy = group === 'none' ? 'grade' : group
    const m = new Map<string, CardRecord[]>()
    for (const c of results) {
      const k = groupKey(c, eff)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(c)
    }
    return [...m.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => b.key.localeCompare(a.key))
  }, [results, group])

  const activeFilterCount =
    f.clans.length + f.nations.length + f.grades.length + f.card_types.length +
    f.trigger_types.length + f.sets.length + f.rarities.length + f.eras.length

  return (
    <div className="flex h-full min-h-0">
      {showFilters && (
        <>
        <div className="shrink-0 overflow-y-auto thin-scroll pr-2 mr-1" style={{ width: filterW }}>
          <div className="mb-3">
            <button onClick={() => setOpenSets((v) => !v)} className="w-full flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 hover:text-slate-200">
              {openSets ? <IconChevronDown /> : <IconChevronRight />}
              <span className="flex-1 text-left">Set</span>
              {f.sets.length > 0 && <span className="text-amber-300">({f.sets.length})</span>}
            </button>
            {openSets && meta.eras.map((e) => {
              const eraCodes = e.sets.map((s) => s.code)
              const eraTotal = e.sets.reduce((s, x) => s + x.count, 0)
              const allChecked = eraCodes.length > 0 && eraCodes.every((c) => f.sets.includes(c))
              const eraOpen = openEraFilters.has(e.name)
              return (
              <div key={e.name}>
                <div className="flex items-center gap-1 pl-1 pt-1">
                  <button onClick={() => setOpenEraFilters((p) => toggleSet(p, e.name))} className="shrink-0 flex items-center text-slate-500 hover:text-slate-300" title={eraOpen ? `Collapse ${e.name}` : `Expand ${e.name}`}>
                    {eraOpen ? <IconChevronDown /> : <IconChevronRight />}
                  </button>
                  <input type="checkbox" className="accent-amber-400 shrink-0" checked={allChecked} onChange={() => toggleEraSets(e.name)} title={`Select all ${e.name} sets`} />
                  <span className="flex-1 truncate text-[11px] font-semibold text-slate-400 uppercase tracking-wide" title={e.name}>{e.name} <span className="font-normal text-slate-500">({eraTotal})</span></span>
                </div>
                {eraOpen && KIND_ORDER.filter((k) => e.sets.some((s) => s.kind === k)).map((k) => {
                  const kindSets = e.sets.filter((s) => s.kind === k)
                  const kk = `${e.name}::${k}`
                  const nActive = kindSets.filter((s) => f.sets.includes(s.code)).length
                  return (
                  <div key={kk}>
                    <button
                      onClick={() => toggleSetKind(kk)}
                      className="w-full flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide pl-5 pr-1 pt-1 pb-0.5 hover:text-slate-300"
                    >
                      <span className="shrink-0">{openSetKinds.has(kk) ? <IconChevronDown /> : <IconChevronRight />}</span>
                      <span className="flex-1 text-left">{k}s</span>
                      {nActive > 0 && <span className="text-amber-300">({nActive})</span>}
                    </button>
                    {openSetKinds.has(kk) && kindSets.map((s) => (
                      <label key={s.code} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer pl-8 pr-1 py-0.5 rounded hover:bg-slate-800">
                        <input
                          type="checkbox"
                          className="accent-amber-400"
                          checked={f.sets.includes(s.code)}
                          onChange={() => toggleIn('sets', s.code)}
                        />
                        <span className="truncate" title={`[${s.code}] ${s.name}`}>[{s.code}] {s.name} <span className="text-slate-500">({s.count})</span></span>
                      </label>
                    ))}
                  </div>
                  )
                })}
              </div>
              )
            })}
          </div>
          <CheckList title="Clan" options={meta.clans} active={f.clans} onToggle={(v) => toggleIn('clans', String(v))} />
          <CheckList title="Nation" options={meta.nations} active={f.nations} onToggle={(v) => toggleIn('nations', String(v))} />
          <div className="mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Grade</div>
            <div className="flex flex-wrap gap-1">
              {[0, 1, 2, 3, 4].map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGrade(g)}
                  className={`w-9 h-8 text-sm rounded border ${f.grades.includes(g) ? 'bg-amber-400 text-white border-amber-400 font-bold' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <CheckList title="Card type" options={meta.card_types} active={f.card_types} onToggle={(v) => toggleIn('card_types', String(v))} />
          <CheckList title="Trigger" options={meta.trigger_types} active={f.trigger_types} onToggle={(v) => toggleIn('trigger_types', String(v))} />
          <CheckList title="Rarity" options={meta.rarities} active={f.rarities} onToggle={(v) => toggleIn('rarities', String(v))} />
          {activeFilterCount > 0 && (
            <button onClick={() => setF({ ...EMPTY_FILTERS, query: f.query })} className="text-sm text-amber-300 hover:text-amber-200 mb-2">
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

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <button onClick={() => setShowFilters((s) => !s)} className="text-sm px-2 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-slate-500">
            {showFilters ? 'Hide filters' : `Filters${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
          </button>
          <input
            value={f.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search name, skill, flavor, clan, nation, race, set…"
            className="flex-1 min-w-48 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-amber-400"
          />
          {f.query && (
            <button onClick={() => set({ query: '' })} className="text-sm text-slate-400 hover:text-white px-1">✕</button>
          )}
          <select value={group} onChange={(e) => { setGroup(e.target.value as GroupBy); setCollapsed(new Set()) }} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5" title="Group by">
            <option value="none">Group: none</option>
            <option value="grade">Group: grade</option>
            <option value="card_type">Group: card type</option>
            <option value="clan">Group: clan</option>
            <option value="nation">Group: nation</option>
            <option value="set_code">Group: set</option>
            <option value="trigger_type">Group: trigger</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5" title="Sort by">
            <option value="set">Sort: set</option>
            <option value="name">Sort: name</option>
            <option value="grade">Sort: grade</option>
            <option value="power">Sort: power</option>
            <option value="clan">Sort: clan</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="flex rounded overflow-hidden border border-slate-700 text-sm">
            {(['table', 'compressed', 'grid', 'stacked'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {v === 'table' ? 'Table' : v === 'compressed' ? 'Cards' : v === 'grid' ? 'Grid' : 'Stacked'}
              </button>
            ))}
          </div>
          {view === 'grid' && (
            <div className="flex items-center gap-1 text-sm text-slate-400" title="Columns per row (auto = fill)">
              <button onClick={() => setGridCols((v) => Math.max(0, (v || 9) - 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
              <span className="w-14 text-center">{gridCols === 0 ? 'Auto' : `${gridCols}/row`}</span>
              <button onClick={() => setGridCols((v) => Math.min(10, (v || 3) + 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
            </div>
          )}
          {view === 'stacked' && (
            <div className="flex items-center gap-1 text-sm text-slate-400" title="Columns per group">
              <button onClick={() => setStackCols((v) => Math.max(1, v - 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">−</button>
              <span className="w-14 text-center">{stackCols} col{stackCols === 1 ? '' : 's'}</span>
              <button onClick={() => setStackCols((v) => Math.min(6, v + 1))} className="w-7 h-7 rounded border border-slate-700 hover:border-slate-500">+</button>
            </div>
          )}
          <span className="text-sm text-slate-400 ml-auto">{results.length} cards</span>
        </div>

        <div className="flex-1 overflow-y-auto card-grid-scroll min-h-0 pr-1">
          {results.length === 0 && (
            <div className="text-sm text-slate-400 mt-8 text-center">No cards match. Try clearing filters or shortening the query.</div>
          )}
          {view === 'stacked' ? (
            <div className="py-1 space-y-3">
              {stackGroups.map((g) => {
                const pileShut = collapsedStacks.has(g.key)
                return (
                <div key={g.key} className="w-full">
                  <button
                    onClick={() => toggleStack(g.key)}
                    className="w-full text-xs font-semibold text-amber-200 uppercase tracking-wide mb-1 text-center sticky-head sticky top-0 z-10 py-1 rounded border border-slate-800"
                    title={pileShut ? 'Expand pile' : 'Collapse pile'}
                  >
                    <span className="inline-flex items-center gap-1">{pileShut ? <IconChevronRight /> : <IconChevronDown />} {g.key}</span> <span className="text-slate-500">({g.items.length})</span>
                  </button>
                  {!pileShut && (
                  <div className="flex gap-2 px-0.5 pb-2">
                    {distribute(g.items, stackCols).map((col, ci) => (
                      <div key={ci} className="flex-1 min-w-0">
                      {col.map((c, i) => (
                      <div
                        key={c.card_number}
                        onClick={() => onSelect(c)}
                        onDoubleClick={() => onZoom(c, results)}
                        title={`${c.name} — ${c.card_number}`}
                        className={`relative rounded overflow-hidden border cursor-pointer bg-slate-900 ${selected?.card_number === c.card_number ? 'border-amber-400 ring-1 ring-amber-400 z-10' : 'border-slate-700 hover:border-slate-400 hover:z-10'}`}
                        style={{ marginTop: i === 0 ? 0 : -64, zIndex: 1 }}
                      >
                        <div className="px-1.5 pt-1 text-xs font-semibold truncate text-slate-100">{c.name}</div>
                        <div className="px-1.5 text-[10px] text-slate-500 truncate">{c.card_number} · {STAT(c)}</div>
                        <CardImg src={thumbUrl(c)} alt="" className="w-full h-24 object-cover object-top" />
                        {onAdd && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAdd(c) }}
                            className="w-full text-xs py-0.5 bg-slate-800 hover:bg-amber-400 hover:text-white font-bold"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                      ))}
                      </div>
                    ))}
                  </div>
                  )}
                </div>
                )
              })}
            </div>
          ) : (
          groups.map((g) => (
            <div key={g.key}>
              {g.key && (
                <button
                  onClick={() => toggleGroup(g.key)}
                  className="sticky-head sticky top-0 z-10 w-full text-left text-sm font-semibold text-amber-200 uppercase tracking-wider py-1.5 mt-2 border-b border-slate-800"
                >
                  <span className="mr-2 text-slate-500 inline-flex">{collapsed.has(g.key) ? <IconChevronRight /> : <IconChevronDown />}</span>
                  {g.key} <span className="text-slate-500 normal-case">({g.items.length} card{g.items.length === 1 ? '' : 's'}{collapsed.has(g.key) ? ' — collapsed' : ''})</span>
                </button>
              )}
              {!collapsed.has(g.key) && view === 'grid' && (
                <div className="grid gap-3 py-2" style={gridCols === 0 ? { gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' } : { gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                  {g.items.map((c) => (
                    <div
                      key={c.card_number}
                      onClick={() => { onSelect(c); }}
                      onDoubleClick={() => onZoom(c, results)}
                      className={`group cursor-pointer rounded-lg overflow-hidden border transition flex flex-col ${selected?.card_number === c.card_number ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-800 hover:border-slate-500'}`}
                      title={`${c.name} — ${c.card_number} (click: preview, double-click: fullscreen)`}
                    >
                      <div className="w-full aspect-[50/73] bg-black flex items-center justify-center overflow-hidden">
                        <CardImg src={thumbUrl(c)} alt={c.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="px-2 py-1 bg-slate-900/90">
                        <div className="text-sm font-medium truncate text-slate-100">{c.name}</div>
                        <div className="text-xs text-slate-500 truncate">{c.card_number} · {STAT(c)}</div>
                      </div>
                      {onAdd && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onAdd(c) }}
                          className="w-full text-sm py-1 bg-slate-800 hover:bg-amber-400 hover:text-white text-slate-200 font-semibold"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!collapsed.has(g.key) && view === 'compressed' && (
                <div className="py-1 space-y-1">
                  {g.items.map((c) => (
                    <div
                      key={c.card_number}
                      onClick={() => onSelect(c)}
                      className={`flex items-center gap-3 px-2 py-1.5 rounded-lg border cursor-pointer ${selected?.card_number === c.card_number ? 'border-amber-400 bg-slate-900' : 'border-slate-800/60 hover:border-slate-600 bg-slate-900/40'}`}
                    >
                      <CardImg src={thumbUrl(c)} alt="" onClick={(e) => { e.stopPropagation(); onZoom(c, results) }} className="w-10 h-14 object-cover rounded cursor-zoom-in bg-slate-800" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-100 truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 truncate">{c.card_number} · {c.clan ?? c.nation} · {STAT(c)}</div>
                      </div>
                      {onAdd
                        ? <button onClick={(e) => { e.stopPropagation(); onAdd(c) }} className="text-sm px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-400 hover:text-white font-semibold">+ Add</button>
                        : <button onClick={(e) => { e.stopPropagation(); onZoom(c, results) }} className="text-xs text-slate-400 hover:text-white px-1">zoom</button>}
                    </div>
                  ))}
                </div>
              )}
              {!collapsed.has(g.key) && view === 'table' && (
                <table className="w-full text-sm my-2 border-collapse">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="py-1 pr-2 font-medium">Name</th>
                      <th className="py-1 pr-2 font-medium">No.</th>
                      <th className="py-1 pr-2 font-medium">Stats</th>
                      <th className="py-1 pr-2 font-medium">Clan / Nation</th>
                      <th className="py-1 font-medium">Skill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((c) => (
                      <tr
                        key={c.card_number}
                        onClick={() => onSelect(c)}
                        className={`border-b border-slate-800/50 cursor-pointer hover:bg-slate-900 ${selected?.card_number === c.card_number ? 'bg-slate-900' : ''}`}
                      >
                        <td className="py-1.5 pr-2 font-medium text-slate-100 max-w-44">
                          <span className="hover:text-amber-200" onClick={(e) => { e.stopPropagation(); onZoom(c, results) }} title="Fullscreen">{c.name}</span>
                        </td>
                        <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{c.card_number}</td>
                        <td className="py-1.5 pr-2 text-slate-300 whitespace-nowrap">{STAT(c)}{c.shield ? ` · 🛡${c.shield}` : ''}</td>
                        <td className="py-1.5 pr-2 text-slate-400 whitespace-nowrap">{c.clan ?? '—'} <span className="text-slate-600">/ {c.nation ?? '—'}</span></td>
                        <td className="py-1.5 text-slate-300 leading-relaxed">{rsx(c.skill_text.length > 220 ? c.skill_text.slice(0, 220) + '…' : c.skill_text)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
          )}
        </div>
      </div>
    </div>
  )
}
