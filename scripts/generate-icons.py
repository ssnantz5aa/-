"""Rebuild the app icon (SVG + PNGs) from shared geometry; requires Pillow.

A linen calendar page on terracotta. One day is navy (pay received, with a
check) and one is blue (not received yet), matching the calendar colours.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TERRACOTTA = '#a34f39'
LINEN = '#f7f3ec'
HEADER = '#eee0d5'
CELL = '#e6dacd'
INK = '#45372e'
NAVY = '#1f2f6e'
BLUE = '#2f7be0'
SCALE = 4

canvas = Image.new('RGB', (512 * SCALE, 512 * SCALE), TERRACOTTA)
draw = ImageDraw.Draw(canvas)
elements = [f'  <rect width="512" height="512" fill="{TERRACOTTA}"/>']


def rect(x, y, width, height, radius, fill):
    elements.append(
        f'  <rect x="{x}" y="{y}" width="{width}" height="{height}" '
        f'rx="{radius}" fill="{fill}"/>')
    box = (x * SCALE, y * SCALE, (x + width) * SCALE - 1, (y + height) * SCALE - 1)
    draw.rounded_rectangle(box, radius=radius * SCALE, fill=fill)


def polygon(points, fill):
    elements.append('  <polygon points="' + ' '.join(f'{x},{y}' for x, y in points)
                    + f'" fill="{fill}"/>')
    draw.polygon([(x * SCALE, y * SCALE) for x, y in points], fill=fill)


# Calendar page with a soft header band.
PX, PY, PW, PH = 100, 132, 312, 280
rect(PX, PY, PW, PH, 44, LINEN)
rect(PX, PY, PW, 76, 44, HEADER)
rect(PX, PY + 40, PW, 36, 0, HEADER)

# Binder rings.
rect(168, 100, 28, 72, 14, INK)
rect(316, 100, 28, 72, 14, INK)

# Day grid: 3 x 2. One received (navy + check), one not yet (blue).
CW, CH, GAP = 66, 58, 20
gx = PX + (PW - (3 * CW + 2 * GAP)) // 2
gy = PY + 76 + 26
colours = {(0, 1): NAVY, (1, 2): BLUE}
for r in range(2):
    for c in range(3):
        x, y = gx + c * (CW + GAP), gy + r * (CH + GAP)
        rect(x, y, CW, CH, 14, colours.get((r, c), CELL))

# Check mark on the navy day.
nx, ny = gx + (CW + GAP), gy
check = [(nx + 17, ny + 30), (nx + 24, ny + 23), (nx + 30, ny + 29),
         (nx + 45, ny + 14), (nx + 52, ny + 21), (nx + 30, ny + 43)]
polygon(check, LINEN)

svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
svg += '\n'.join(elements) + '\n</svg>\n'
(ROOT / 'assets/icon.svg').write_text(svg, encoding='utf-8')
for size, name in [(512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / 'assets' / name)
    print(name, size, 'RGB, opaque')
