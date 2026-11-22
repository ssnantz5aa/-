"""Rebuild the app icon (PNGs + SVG); requires Pillow and Pretendard Bold.

Deep navy background, the linen calendar page (one navy day with a check =
pay received, one blue day = not yet), and the "SSNA" wordmark below it.
The SVG embeds the 512px PNG so every size looks identical.
"""
import base64
import io
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG = '#141c3c'        # 깊은 남색 배경
LINEN = '#f7f3ec'
HEADER = '#eee0d5'
CELL = '#e6dacd'
RING = '#c4664b'      # 테라코타 고리
NAVY = '#1f2f6e'      # 받음
BLUE = '#2f7be0'      # 아직 안 받음
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

canvas = Image.new('RGB', (S, S), BG)
draw = ImageDraw.Draw(canvas)


def rect(x, y, w, h, r, fill):
    draw.rounded_rectangle((x * SCALE, y * SCALE, (x + w) * SCALE - 1, (y + h) * SCALE - 1),
                           radius=r * SCALE, fill=fill)


# 달력 종이
PX, PY, PW, PH = 128, 96, 256, 232
rect(PX, PY, PW, PH, 38, LINEN)
rect(PX, PY, PW, 62, 38, HEADER)
rect(PX, PY + 30, PW, 32, 0, HEADER)

# 고리
rect(178, 70, 24, 58, 12, RING)
rect(310, 70, 24, 58, 12, RING)

# 날짜 칸 3 x 2: 남색(받음, 체크) 하나, 파랑(안 받음) 하나
CW, CH, GAP = 56, 50, 16
gx = PX + (PW - (3 * CW + 2 * GAP)) // 2
gy = PY + 62 + 22
colours = {(0, 1): NAVY, (1, 2): BLUE}
for r in range(2):
    for c in range(3):
        rect(gx + c * (CW + GAP), gy + r * (CH + GAP), CW, CH, 12, colours.get((r, c), CELL))
nx, ny = gx + (CW + GAP), gy
check = [(nx + 14, ny + 26), (nx + 20, ny + 20), (nx + 25, ny + 25),
         (nx + 37, ny + 13), (nx + 43, ny + 19), (nx + 25, ny + 37)]
draw.polygon([(x * SCALE, y * SCALE) for x, y in check], fill=LINEN)

# SSNA 글자: 달력 폭에 맞춰 아래쪽에
target = (PW + 20) * SCALE
size = 200
while True:
    font = ImageFont.truetype(str(font_path), size)
    l, t, r, b = draw.textbbox((0, 0), TEXT, font=font)
    if r - l >= target:
        break
    size += 4
w, h = r - l, b - t
top = (PY + PH + 36) * SCALE
draw.text(((S - w) / 2 - l, top - t), TEXT, font=font, fill=LINEN)

for px, name in [(512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    canvas.resize((px, px), Image.Resampling.LANCZOS).save(ROOT / 'assets' / name)
    print(name, px, 'RGB, opaque')

buf = io.BytesIO()
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(buf, format='PNG')
data = base64.b64encode(buf.getvalue()).decode('ascii')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
       f'  <image width="512" height="512" href="data:image/png;base64,{data}"/>\n</svg>\n')
(ROOT / 'assets/icon.svg').write_text(svg, encoding='utf-8')
print('icon.svg', len(svg) // 1024, 'KB', '| text bottom', round((top + h) / SCALE))
