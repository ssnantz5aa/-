"""Rebuild the app icon (PNGs + SVG); requires Pillow and the Broadway font (falls back to Pretendard Bold).

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
    Path('C:/Windows/Fonts/BROADW.TTF'),  # Broadway (사용자 선택)
    Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft/Windows/Fonts/Pretendard-Bold.otf',
    Path('C:/Windows/Fonts/Pretendard-Bold.otf'),
]
# ICON_FONT=글꼴파일 로 다른 글꼴을 쓸 수 있다. ICON_PREVIEW=파일.png 면 미리보기만 만든다.
if os.environ.get('ICON_FONT'):
    FONT_CANDIDATES.insert(0, Path(os.environ['ICON_FONT']))
font_path = next((p for p in FONT_CANDIDATES if p.exists()), None)
if not font_path:
    raise SystemExit('Broadway 또는 Pretendard-Bold 글꼴이 필요합니다')

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
target_w, max_h = (PW + 20) * SCALE, 92 * SCALE
size = 120
while True:
    font = ImageFont.truetype(str(font_path), size + 4)
    l, t, r, b = draw.textbbox((0, 0), TEXT, font=font)
    if r - l > target_w or b - t > max_h:
        break
    size += 4
font = ImageFont.truetype(str(font_path), size)
l, t, r, b = draw.textbbox((0, 0), TEXT, font=font)
w, h = r - l, b - t
# 달력 아래 ~ (아래 여백 = 위쪽 고리 여백 70) 사이 가운데
top = (PY + PH) * SCALE + ((512 - 70 - PY - PH) * SCALE - h) / 2
draw.text(((S - w) / 2 - l, top - t), TEXT, font=font, fill=LINEN)

if os.environ.get('ICON_PREVIEW'):
    canvas.resize((512, 512), Image.Resampling.LANCZOS).save(os.environ['ICON_PREVIEW'])
    raise SystemExit(0)

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
