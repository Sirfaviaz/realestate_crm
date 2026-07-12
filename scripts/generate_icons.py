#!/usr/bin/env python3
"""Create simple PWA icons."""

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow not installed — skip icon generation")
    raise SystemExit(0)

public = Path(__file__).resolve().parent.parent / "frontend" / "public"

for size in (192, 512):
    img = Image.new("RGB", (size, size), "#059669")
    draw = ImageDraw.Draw(img)
    margin = size // 6
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 8,
        fill="#ffffff",
    )
    draw.rounded_rectangle(
        [margin * 2, margin * 2, size - margin * 2, size - margin * 2],
        radius=size // 12,
        fill="#059669",
    )
    img.save(public / f"icon-{size}.png")

print("Icons created")
