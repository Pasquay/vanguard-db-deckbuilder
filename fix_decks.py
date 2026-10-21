lines = open('src/App.tsx', encoding='utf-8').readlines()

new_header = [
    '      <div className="flex flex-wrap items-center gap-2 mb-3">\n',
    '        <h2 className="text-xl font-bold">Saved decks</h2>\n',
    '        <div className="flex rounded overflow-hidden border border-slate-700 text-sm ml-2">\n',
    '          {([\'list\', \'grid\'] as const).map((v) => (\n',
    '            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? \'bg-amber-400 text-white font-semibold\' : \'text-slate-300 hover:bg-slate-800\'}`}>{v}</button>\n',
    '          ))}\n',
    '        </div>\n',
    '        <select value={clanFilter} onChange={(e) => setClanFilter(e.target.value)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">\n',
    '          <option value="">Era: all</option>\n',
    '          {clans.map((c) => <option key={c} value={c}>{c}</option>)}\n',
    '        </select>\n',
    '        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as \'none\' | \'era\' | \'format\')} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">\n',
    '          <option value="none">Group: none</option>\n',
    '          <option value="era">Group: era</option>\n',
    '          <option value="format">Group: format</option>\n',
    '        </select>\n',
    '        <button onClick={onNew} className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-amber-400 text-white font-semibold">+ New deck</button>\n',
    '      </div>\n',
]

start = None
for i, line in enumerate(lines):
    if 'Saved decks' in line and '<h2' in line:
        start = i
        break

end = None
for i in range(len(lines)):
    if i > 0 and '{decks.length === 0' in lines[i]:
        end = i
        break

if start is not None and end is not None:
    new_lines = lines[:start] + [
        '      <div className="flex flex-wrap items-center gap-2 mb-3">\n',
        '        <h2 className="text-xl font-bold">Saved decks</h2>\n',
        '        <div className="flex rounded overflow-hidden border border-slate-700 text-sm ml-2">\n',
        '          {([\'list\', \'grid\'] as const).map((v) => (\n',
        '            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? \'bg-amber-400 text-white font-semibold\' : \'text-slate-300 hover:bg-slate-800\'}`}>{v}</button>\n',
        '          ))}\n',
        '        </div>\n',
        '        <select value={clanFilter} onChange={(e) => setClanFilter(e.target.value)} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">\n',
        '          <option value="">Era: all</option>\n',
        '          {clans.map((c) => <option key={c} value={c}>{c}</option>)\n',
        '        </select>\n',
    '        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as \'none\' | \'era\' | \'format\')} className="text-sm bg-slate-900 border border-slate-700 rounded px-2 py-1.5">\n',
    '          <option value="none">Group: none</option>\n',
    '          <option value="era">Group: era</option>\n',
    '          <option value="format">Group: format</option>\n',
    '        </select>\n',
    '        <button onClick={onNew} className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-amber-400 text-white font-semibold">+ New deck</button>\n',
    '      </div>\n',
    ] + lines[start + 19:]

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Replaced header section')