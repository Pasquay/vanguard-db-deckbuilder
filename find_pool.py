lines = open('src/components/DeckBuilder.tsx', encoding='utf-8').readlines()
for i, line in enumerate(lines):
    if 'poolOpts' in line and 'useMemo' in line:
        print(i+1, repr(line))
        for j in range(i, min(i+20, len(lines))):
            print(j+1, repr(lines[j]))
        break