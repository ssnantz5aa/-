"""Rebuild the calendar SVG and PNGs from shared geometry; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TERRACOTTA = '#a34f39'
LINEN = '#f7f3ec'
SCALE = 4
canvas = Image.new('RGB', (512 * SCALE, 512 * SCALE), TERRACOTTA)
draw = ImageDraw.Draw(canvas)
elements = [f'  <rect width="512" height="512" fill="{TERRACOTTA}"/>']


def rect(x, y, width, height, radius, fill):
    elements.append(
        f'  <rect x="{x}" y="{y}" width="{width}" height="{height}" '
        f'rx="{radius}" fill="{fill}"/>')
    box = (x * SCALE, y * SCALE,
           (x + width) * SCALE - 1, (y + height) * SCALE - 1)
    draw.rounded_rectangle(box, radius=radius * SCALE, fill=fill)


# A bound calendar page with a header and one completed schedule item.
rect(120, 132, 272, 264, 32, LINEN)
rect(144, 156, 224, 216, 8, TERRACOTTA)
rect(176, 104, 24, 76, 12, LINEN)
rect(312, 104, 24, 76, 12, LINEN)
rect(140, 204, 232, 24, 0, LINEN)
check = [(192, 294), (210, 276), (242, 308),
         (302, 248), (320, 266), (242, 344)]
elements.append('  <polygon points="' + ' '.join(f'{x},{y}' for x, y in check)
                + f'" fill="{LINEN}"/>')
draw.polygon([(x * SCALE, y * SCALE) for x, y in check], fill=LINEN)

svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
svg += '\n'.join(elements) + '\n</svg>\n'
(ROOT / 'assets/icon.svg').write_text(svg, encoding='utf-8')
for size, name in [(512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / 'assets' / name)
    print(name, size, 'RGB, opaque')
