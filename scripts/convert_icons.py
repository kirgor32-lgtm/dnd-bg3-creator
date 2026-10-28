from PIL import Image
import glob, os

src_dir = "scripts/bg3_class_icons"
out_dir = "assets/img/classes"
os.makedirs(out_dir, exist_ok=True)

for f in glob.glob(f"{src_dir}/*.webp"):
    name = os.path.splitext(os.path.basename(f))[0]
    img = Image.open(f).convert("RGBA")
    img_resized = img.resize((512, 512), Image.LANCZOS)
    out_path = f"{out_dir}/{name}.png"
    img_resized.save(out_path, "PNG")
    print(f"{name}: {img.size} -> 512x512 saved to {out_path}")
