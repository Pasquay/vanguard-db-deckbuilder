"""Generate build/icon.ico: original crossed-swords mark on dark tile.
No Bushiroad art. Run: python scripts/make_icon.py (Pillow required)."""
from PIL import Image, ImageDraw

SIZE = 1024
BG = (11, 18, 32, 255)        # near-black navy
RING = (47, 129, 247, 255)    # vanguard blue
BLADE = (232, 241, 252, 255)  # pale steel
HILT = (140, 165, 195, 255)   # muted steel

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# tile
d.rounded_rectangle([28, 28, SIZE - 28, SIZE - 28], radius=230, fill=BG,
                    outline=RING, width=26)


def blade(x0, y0, x1, y1, flip):
    # blade
    d.line([x0, y0, x1, y1], fill=BLADE, width=96, joint='curve')
    # tip triangle
    dx, dy = x1 - x0, y1 - y0
    import math
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    px, py = -uy, ux
    tip = 150
    d.polygon([(x1, y1),
               (x1 - ux * tip + px * 52, y1 - uy * tip + py * 52),
               (x1 - ux * tip - px * 52, y1 - uy * tip - py * 52)],
              fill=BLADE)
    # guard + grip + pommel (perpendicular at base)
    gx, gy = x0, y0
    d.line([(gx - px * 120, gy - py * 120), (gx + px * 120, gy + py * 120)],
           fill=HILT, width=64, joint='curve')
    bx, by = gx - ux * 130, gy - uy * 130
    d.line([(gx, gy), (bx, by)], fill=HILT, width=64, joint='curve')
    d.ellipse([bx - 52, by - 52, bx + 52, by + 52], fill=HILT)


blade(300, 790, 700, 250, False)
blade(724, 790, 324, 250, True)

img.save('build/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48),
                                  (64, 64), (128, 128), (256, 256)])
print('wrote build/icon.ico')
check = Image.open('build/icon.ico')
print('sizes:', check.info.get('sizes'))
