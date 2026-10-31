# Clean an AI portrait: remove watermark corner, flood-fill near-neutral background to pure white,
# fit full figure into 768x1152 canvas on white (matching other race portraits).
import sys
from collections import deque
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
w, h = im.size
px = im.load()

def is_bg(c, ref):
    r, g, b = c
    sat = max(c) - min(c)
    return sat < 28 and abs(sum(c) / 3 - ref) < 60

# reference brightness = median of border pixels
border = [px[x, 0] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
ref = sorted(sum(c) / 3 for c in border)[len(border) // 2]

mask = Image.new("L", (w, h), 0)
mp = mask.load()
lum = lambda c: (c[0] + c[1] + c[2]) / 3
sat = lambda c: max(c) - min(c)
q = deque()
for x in range(w):
    q.append((x, 0, None)); q.append((x, h - 1, None))
for y in range(h):
    q.append((0, y, None)); q.append((w - 1, y, None))
seen = bytearray(w * h)
while q:
    x, y, prev = q.popleft()
    if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]:
        continue
    c = px[x, y]
    if sat(c) > 30 or (prev is not None and abs(lum(c) - prev) > 7):
        continue
    seen[y * w + x] = 1
    mp[x, y] = 255
    L = lum(c)
    q.extend(((x + 1, y, L), (x - 1, y, L), (x, y + 1, L), (x, y - 1, L)))
# keep soft shadow under feet as light grey instead of removing completely? -> remove (other portraits are clean white)
# watermark box (bottom-right) -> background
for y in range(int(h * 0.93), h):
    for x in range(int(w * 0.70), w):
        mp[x, y] = 255

mask = mask.filter(ImageFilter.GaussianBlur(1.2))
white = Image.new("RGB", (w, h), (255, 255, 255))
out = Image.composite(white, im, mask)

# fit into 768x1152 by figure bbox
inv = mask.point(lambda v: 255 if v < 128 else 0)
bbox = inv.getbbox()
fig = out.crop(bbox)
W, H = 768, 1152
scale = min((W * 0.86) / fig.width, (H * 0.92) / fig.height)
fig = fig.resize((int(fig.width * scale), int(fig.height * scale)), Image.LANCZOS)
canvas = Image.new("RGB", (W, H), (255, 255, 255))
canvas.paste(fig, ((W - fig.width) // 2, int(H * 0.96) - fig.height))
canvas.save(dst, quality=90)
print("bg ref", ref, "bbox", bbox, "->", dst)
