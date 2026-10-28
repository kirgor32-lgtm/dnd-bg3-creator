"""
Склеивает несколько JPG-кандидатов в один коллаж с подписями,
чтобы отправлять пользователю одним сообщением вместо нескольких.

Usage:
    from make_collage import make_collage
    make_collage([("drow", "path1.jpg"), ("triton", "path2.jpg")], "out.jpg", cols=3)
"""
from PIL import Image, ImageDraw, ImageFont
import os

def make_collage(items, out_path, cols=3, thumb_w=300, thumb_h=450, label_h=30):
    """items: list of (label, path) tuples"""
    rows = (len(items) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + label_h)), "white")
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except Exception:
        font = ImageFont.load_default()

    for i, (label, path) in enumerate(items):
        col = i % cols
        row = i // cols
        x0 = col * thumb_w
        y0 = row * (thumb_h + label_h)
        if path and os.path.exists(path):
            try:
                img = Image.open(path).convert("RGB")
                img.thumbnail((thumb_w - 10, thumb_h - 10))
                px = x0 + (thumb_w - img.width) // 2
                py = y0 + (thumb_h - img.height) // 2
                canvas.paste(img, (px, py))
            except Exception as e:
                draw.text((x0 + 10, y0 + 10), f"ERR: {e}", fill="red", font=font)
        else:
            draw.text((x0 + 10, y0 + thumb_h // 2), "нет кандидата", fill="gray", font=font)
        draw.rectangle([x0, y0 + thumb_h, x0 + thumb_w, y0 + thumb_h + label_h], fill="#222")
        draw.text((x0 + 8, y0 + thumb_h + 5), label, fill="white", font=font)

    canvas.save(out_path, "JPEG", quality=88)
    return out_path
