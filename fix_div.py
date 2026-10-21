lines = open('C:/Users/Josep/Documents/TCG/Vanguard/VanguardApp/src/App.tsx', encoding='utf-8').readlines()
# Line 876 (0-indexed 875) is '            </div>\n' which closes line 840's <div key={card.key} ...>
# But line 841's <div className="flex items-center justify-between mb-2"> was opened inside line 840's div and never closed.
# Insert </div> before line 876 to close line 841's div first.
lines.insert(876, '          </div>\n')
open('C:/Users/Josep/Documents/TCG/Vanguard/VanguardApp/src/App.tsx', 'w', encoding='utf-8').writelines(lines)
print('Added closing </div> for clan div before line 876')
