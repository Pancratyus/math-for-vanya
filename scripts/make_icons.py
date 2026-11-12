#!/usr/bin/env python3
"""Генерация иконок PWA: градиент + белая ×. Без внешних сервисов.
Запуск: python3 scripts/make_icons.py  (нужен Pillow)"""
import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "app", "icons"))
os.makedirs(OUT, exist_ok=True)

S = 2048  # исходник, потом LANCZOS-даунсемпл

# диагональный градиент: синий -> фиолетовый
C1 = (78, 134, 255)   # #4E86FF
C2 = (150, 70, 255)   # #9646FF

grad = Image.new("RGB", (S, S))
px = grad.load()
for y in range(S):
    for x in range(0, S, 4):  # шаг 4 по x: градиент гладкий, точность не теряем
        t = (x + y) / (2 * S - 2)
        r = int(C1[0] + (C2[0] - C1[0]) * t)
        g = int(C1[1] + (C2[1] - C1[1]) * t)
        b = int(C1[2] + (C2[2] - C1[2]) * t)
        for dx in range(4):
            if x + dx < S:
                px[x + dx, y] = (r, g, b)

# знак умножения × из двух скруглённых брусков ±45°
layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
cx = cy = S / 2
half = S * 0.26          # полудлина луча
w = S * 0.135            # толщина
dxy = half * math.sqrt(2) / 2
r = w / 2
for sx, sy in ((1, 1), (1, -1)):
    x1, y1 = cx - dxy * sx, cy - dxy * sy
    x2, y2 = cx + dxy * sx, cy + dxy * sy
    d.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 255), width=int(w))
    for (ex, ey) in ((x1, y1), (x2, y2)):
        d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=(255, 255, 255, 255))

img = Image.alpha_composite(grad.convert("RGBA"), layer)

for size in (512, 192, 180):
    small = img.resize((size, size), Image.LANCZOS).convert("RGB")
    path = os.path.join(OUT, f"icon-{size}.png")
    small.save(path, "PNG")
    print("ok", path)

print("done")
