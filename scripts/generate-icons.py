"""Rebuild the app icon (PNGs + SVG) ; requires Pillow and Pretendard Bold.

Navy background with the "SSNA" wordmark in linen and a small terracotta
underline. The SVG embeds the 512px PNG so every size looks identical.
"""
import base64
import io
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
NAVY = '#141c3c'
LINEN = '#f7f3ec'
TERRACOTTA = '#c4664b'
TEXT = 'SSNA'
SCALE = 4
S = 512 * SCALE

FONT_CANDIDATES = [
    Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft/Windows/Fonts/Pretendard-Bold.otf',
    Path('C:/Windows/Fonts/Pretendard-Bold.otf'),
]
font_path = next((p for p in FONT_CANDIDATES if p.exists()), None)
if not font_path:
    raise SystemExit('Pretendard-Bold.otf 글꼴이 필요합니다')

canvas = Image.new('RGB', (S, S), NAVY)
draw = ImageDraw.Draw(canvas)

# 글자 폭이 아이콘의 약 66%가 되도록 크기를 맞춘다(아이폰 둥근 모서리 안쪽).
target = 0.66 * S
size = 400
while True:
    font = ImageFont.truetype(str(font_path), size)
    l, t, r, b = draw.textbbox((0, 0), TEXT, font=font)
    if r - l >= target:
        break
    size += 8
w, h = r - l, b - t
bar_h, gap = 14 * SCALE, 30 * SCALE
x = (S - w) / 2 - l
y = (S - (h + gap + bar_h)) / 2 - t
draw.text((x, y), TEXT, font=font, fill=LINEN)

# 글자 아래 짧은 테라코타 선
bar_w = 96 * SCALE
by = y + t + h + gap
draw.rounded_rectangle(((S - bar_w) / 2, by, (S + bar_w) / 2, by + bar_h), radius=bar_h / 2, fill=TERRACOTTA)

for px, name in [(512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    canvas.resize((px, px), Image.Resampling.LANCZOS).save(ROOT / 'assets' / name)
    print(name, px, 'RGB, opaque')

buf = io.BytesIO()
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(buf, format='PNG')
data = base64.b64encode(buf.getvalue()).decode('ascii')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
       f'  <image width="512" height="512" href="data:image/png;base64,{data}"/>\n</svg>\n')
(ROOT / 'assets/icon.svg').write_text(svg, encoding='utf-8')
print('icon.svg', len(svg) // 1024, 'KB')
