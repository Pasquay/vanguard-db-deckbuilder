with open(r'C:\Users\Josep\Documents\TCG\Vanguard\VanguardApp\src\App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the SetRow function start and end
start = None
for i, line in enumerate(lines):
    if 'function SetRow({ set: s, era, byNumber, goSet, onZoom }' in line:
        start = i
        break

# Find the matching closing brace
end = None
if start is not None:
    brace_count = 0
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
                if brace_count == 0:
                    end = i
                    break
        if end is not None:
            break

print(f'start={start}, end={end}')
if start is not None and end is not None:
    print(f'Lines {start+1} to {end+1}')

# New function
new_func = [
    "function SetRow({ set: s, era, byNumber, goSet, onZoom }: {\n",
    "  set: SetInfo; era: string; byNumber: Map<string, CardRecord>;\n",
    "  goSet: (era: string, set?: string) => void; onZoom: (c: CardRecord) => void\n",
    "}) {\n",
    "  const feat = featuredCards(s, byNumber, 8)\n",
    "  return (\n",
    "    <div className=\"flex items-center gap-4 border border-slate-800 rounded-xl px-5 py-4 bg-slate-950/50\">\n",
    "      <button onClick={() => goSet(era, s.code)} className=\"w-60 shrink-0 text-left\">\n",
    "        <div className=\"text-[15px] font-bold leading-snug\">[{s.code}] {s.name}</div>\n",
    "        <div className=\"text-xs text-slate-500 mt-1\">{s.kind} \u00b7 {s.count} cards \u2192 browse</div>\n",
    "        <div className=\"text-xs text-slate-400 mt-1.5 leading-snug\" title={clanLine(feat)}>{clanLine(feat)}</div>\n",
    "      </button>\n",
    "      <div className=\"flex-1 min-w-0\">\n",
    "        <div className=\"grid gap-2 overflow-hidden\" style={{ gridTemplateColumns: 'repeat(auto-fill, 112px)' }}>\n",
    "          {feat.map((c) => (\n",
    "            <span\n",
    "              key={c.card_number}\n",
    "              role=\"button\"\n",
    "              tabIndex={0}\n",
    "              title={\`${c.name} \u2014 click to zoom\`}\n",
    "              onClick={() => onZoom(c)}\n",
    "              onKeyDown={(e) => { if (e.key === 'Enter') onZoom(c) }}\n",
    "              className=\"cursor-zoom-in\"\n",
    "            >\n",
    "              <span className=\"block rounded overflow-hidden border border-slate-800 hover:border-amber-300 bg-black\">\n",
    "                <CardImg src={thumbUrl(c)} alt={c.name} className=\"w-full aspect-[50/73] object-contain\" />\n",
    "              </span>\n",
    "              <span className=\"block text-[11px] truncate text-slate-300 mt-0.5\">{c.name}</span>\n",
    "              <span className=\"block text-[10px] truncate text-slate-500\">{c.clan ?? ''}</span>\n",
    "            </span>\n",
    "          ))}\n",
    "        </div>\n",
    "      </div>\n",
    "    </div>\n",
    "  )\n",
    "}\n",
]

# Replace
new_lines = lines[:start] + [line + '\n' for line in new_func] + lines[end+1:]

with open(r'C:\Users\Josep\Documents\TCG\Vanguard\VanguardApp\src\App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Replaced SetRow function successfully')