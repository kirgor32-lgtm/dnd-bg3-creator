from PIL import Image
import os, glob

def resize_portrait(path, max_w=600, max_h=750, quality=78):
    try:
        im = Image.open(path).convert("RGB")
    except Exception as e:
        print("SKIP (not image)", path, e)
        return
    w, h = im.size
    ratio = min(max_w / w, max_h / h, 1.0)
    if ratio < 1.0:
        im = im.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), Image.LANCZOS)
    im.save(path, "JPEG", quality=quality, optimize=True)

total_before = 0
total_after = 0
for folder in ["assets/img/races", "assets/img/classes"]:
    for p in glob.glob(f"{folder}/*.jpg"):
        before = os.path.getsize(p)
        resize_portrait(p)
        after = os.path.getsize(p)
        total_before += before
        total_after += after

print(f"before: {total_before/1024/1024:.1f} MB, after: {total_after/1024/1024:.1f} MB")
