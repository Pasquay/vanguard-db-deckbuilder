with open(r'C:\Users\Josep\Documents\TCG\Vanguard\VanguardApp\src\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact old function using a more flexible search
old_start = content.find('function SetsPage({ meta, byNumber, goSet, onZoom }: {')
if old_start == -1:
    print('Function not found!')
else:
    # Find the matching closing brace
    brace_start = content.find('{', old_start)
    brace_count = 0
    pos = brace_start
    while pos < len(content):
        if content[pos] == '{':
            brace_count += 1
        elif content[pos] == '}':
            brace_count -= 1
            if brace_count == 0:
                old_func_end = pos + 1
                old_func = content[old_start:old_func_end]
                print(f'Found function from {old_start} to {old_func_end}')
                
                # New function
                new_func = '''function SetsPage({ meta, byNumber, goSet, onZoom }: {
  meta: IndexMeta; byNumber: Map<string, CardRecord>;
  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void
}) {
  const [view, setView] = useState<'cards' | 'rows'>('cards')
  const [setFilter, setSetFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [eraFilter, setEraFilter] = useState('')

  const allSets = useMemo(() => meta.eras.flatMap(e => e.sets.map(s => ({ ...s, era: e.name }))), [meta])
  const kinds = useMemo(() => [...new Set(allSets.map(s => s.kind))].filter(k => k !== 'Trial Deck').sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)), [allSets])
  const eras = useMemo(() => [...new Set(allSets.map(s => s.era))].sort((a, b) => meta.eras.findIndex(e => e.name === a) - meta.eras.findIndex(e => e.name === b)), [allSets, meta])

  const filteredSets = allSets.filter(s =>
    (!setFilter || s.code.toLowerCase().includes(setFilter.toLowerCase()) || s.name.toLowerCase().includes(setFilter.toLowerCase())) &&
    (!kindFilter || s.kind === kindFilter) &&
    (!eraFilter || s.era === eraFilter)
  )

  return (
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-xl font-bold">Sets</h2>
        <div className="flex rounded overflow-hidden border border-slate-700 text-sm ml-2">
          {(['cards', 'rows'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'`}>{v === 'cards' ? 'Grid' : 'Rows'}</button>
          ))}
        </div>
        <input value={setFilter} onChange={(e) => setSetFilter(e.target.value)} placeholder="Filter sets by code or name..." className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5 w-48" />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
          <option value="">Kind: all</option>
          {kinds.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={eraFilter} onChange={(e) => setEraFilter(e.target.value)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
          <option value="">Era: all</option>
          {eras.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-sm text-slate-500 ml-auto">{filteredSets.length} / {allSets.length} sets</span>
      </div>
      {view === 'cards' ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filteredSets.map((s) => (
            <SetCard key={s.code} set={s} era={s.era} byNumber={byNumber} goSet={goSet} onZoom={onZoom} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSets.map((s) => (
            <SetRow key={s.code} set={s} era={s.era} byNumber={byNumber} goSet={goSet} onZoom={onZoom} />
          ))}
        </div>
      )}
    </div>
  )
}
'''
                
                # Replace
                new_content = content[:old_start] + new_func + content[old_func_end:]
                
                with open(r'C:\Users\Josep\Documents\TCG\Vanguard\VanguardApp\src\App.tsx', 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                print('Successfully replaced SetsPage function!')
                break
        pos += 1
"