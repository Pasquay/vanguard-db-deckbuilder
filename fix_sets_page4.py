with open(r'C:\Users\Josep\Documents\TCG\Vanguard\VanguardApp\src\App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace lines 628-690 (1-indexed) = indices 627-689 (0-indexed)
new_function_lines = [
    "function SetsPage({ meta, byNumber, goSet, onZoom }: {\n",
    "  meta: IndexMeta; byNumber: Map<string, CardRecord>;\n",
    "  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void\n",
    "}) {\n",
    "  const [view, setView] = useState<'cards' | 'rows'>('cards')\n",
    "  const [setFilter, setSetFilter] = useState('')\n",
    "  const [kindFilter, setKindFilter] = useState('')\n",
    "  const [eraFilter, setEraFilter] = useState('')\n",
    "  \n",
    "  const allSets = useMemo(() => meta.eras.flatMap(e => e.sets.map(s => ({ ...s, era: e.name }))), [meta])\n",
    "  const kinds = useMemo(() => [...new Set(allSets.map(s => s.kind))].filter(k => k !== 'Trial Deck').sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)), [allSets])\n",
    "  const eras = useMemo(() => [...new Set(allSets.map(s => s.era))].sort((a, b) => meta.eras.findIndex(e => e.name === a) - meta.eras.findIndex(e => e.name === b)), [allSets, meta])\n",
    "\n",
    "  const filteredSets = allSets.filter(s => \n",
    "    (!setFilter || s.code.toLowerCase().includes(setFilter.toLowerCase()) || s.name.toLowerCase().includes(setFilter.toLowerCase())) &&\n",
    "    (!kindFilter || s.kind === kindFilter) &&\n",
    "    (!eraFilter || s.era === eraFilter)\n",
    "  )\n",
    "\n",
    "  return (\n",
    "    <div className=\"flex-1 overflow-y-auto p-4 min-h-0\">\n",
    "      <div className=\"flex flex-wrap items-center gap-2 mb-3\">\n",
    "        <h2 className=\"text-xl font-bold\">Sets</h2>\n",
    "        <div className=\"flex rounded overflow-hidden border border-slate-700 text-sm ml-2\">\n",
    "          {(['cards', 'rows'] as const).map((v) => (\n",
    "            <button key={v} onClick={() => setView(v)} className={\"px-2.5 py-1 capitalize \" + (view === v ? 'bg-amber-400 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800')}>{v === 'cards' ? 'Grid' : 'Rows'}</button>\n",
    "          ))}\n",
    "        </div>\n",
    "        <input value={setFilter} onChange={(e) => setSetFilter(e.target.value)} placeholder=\"Filter sets by code or name...\" className=\"text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5 w-48\" />\n",
    "        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className=\"text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5\">\n",
    "          <option value=\"\">Kind: all</option>\n",
    "          {kinds.map(k => <option key={k} value={k}>{k}</option>)}\n",
    "        </select>\n",
    "        <select value={eraFilter} onChange={(e) => setEraFilter(e.target.value)} className=\"text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5\">\n",
    "          <option value=\"\">Era: all</option>\n",
    "          {eras.map(e => <option key={e} value={e}>{e}</option>)}\n",
    "        </select>\n",
    "        <span className=\"text-sm text-slate-500 ml-auto\">{filteredSets.length} / {allSets.length} sets</span>\n",
    "      </div>\n",
    "      {view === 'cards' ? (\n",
    "        <div className=\"grid gap-3\" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>\n",
    "          {filteredSets.map((s) => (\n",
    "            <SetCard key={s.code} set={s} era={s.era} byNumber={byNumber} goSet={goSet} onZoom={onZoom} />\n",
    "          ))}\n",
    "        </div>\n",
    "      ) : (\n",
    "        <div className=\"space-y-2\">\n",
    "          {filteredSets.map((s) => (\n",
    "            <SetRow key={s.code} set={s} era={s.era} byNumber={byNumber} goSet={goSet} onZoom={onZoom} />\n",
    "          ))}\n",
    "        </div>\n",
    "      )}\n",
    "    </div>\n",
    "  )\n",
    "}\n",
]

# Replace lines 628-690 (1-indexed) = indices 627-689 (0-indexed)
new_lines = lines[:627] + [line + '\n' for line in new_function_lines] + lines[690:]

with open(r'C:\Users\Josep\Documents\TCG\Vanguard\VanguardApp\src\App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Replaced SetsPage function successfully')