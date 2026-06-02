from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "public" / "assets" / "summer-wiki-ai"
CROPPED = BASE / "cropped"
SLICES = BASE / "slices"
PROPS = BASE / "props"


def save_crop(img: Image.Image, box: tuple[int, int, int, int], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    img.crop(box).save(out)


def horizontal_3_slice(name: str, left: int, right: int, mid_width: int = 12) -> dict:
    img = Image.open(CROPPED / f"{name}.png").convert("RGBA")
    w, h = img.size
    mid_x = (w - mid_width) // 2
    out_dir = SLICES / name

    save_crop(img, (0, 0, left, h), out_dir / "left.png")
    save_crop(img, (mid_x, 0, mid_x + mid_width, h), out_dir / "mid.png")
    save_crop(img, (w - right, 0, w, h), out_dir / "right.png")

    return {
        "asset": name,
        "type": "horizontal-3-slice",
        "source": f"/assets/summer-wiki-ai/cropped/{name}.png",
        "pieces": {
            "left": f"/assets/summer-wiki-ai/slices/{name}/left.png",
            "mid": f"/assets/summer-wiki-ai/slices/{name}/mid.png",
            "right": f"/assets/summer-wiki-ai/slices/{name}/right.png",
        },
        "size": {"width": w, "height": h},
        "slice": {"left": left, "right": right, "midWidth": mid_width},
    }


def vertical_3_slice(name: str, top: int, bottom: int, mid_height: int = 8, mid_y: int | None = None) -> dict:
    img = Image.open(CROPPED / f"{name}.png").convert("RGBA")
    w, h = img.size
    mid_y = (h - mid_height) // 2 if mid_y is None else mid_y
    out_dir = SLICES / f"{name}-vertical"

    save_crop(img, (0, 0, w, top), out_dir / "top.png")
    save_crop(img, (0, mid_y, w, mid_y + mid_height), out_dir / "mid.png")
    save_crop(img, (0, h - bottom, w, h), out_dir / "bottom.png")

    return {
        "asset": name,
        "type": "vertical-3-slice",
        "source": f"/assets/summer-wiki-ai/cropped/{name}.png",
        "pieces": {
            "top": f"/assets/summer-wiki-ai/slices/{name}-vertical/top.png",
            "mid": f"/assets/summer-wiki-ai/slices/{name}-vertical/mid.png",
            "bottom": f"/assets/summer-wiki-ai/slices/{name}-vertical/bottom.png",
        },
        "size": {"width": w, "height": h},
        "slice": {"top": top, "bottom": bottom, "midHeight": mid_height, "midY": mid_y},
    }


def clean_gallery_vertical_3_slice(name: str, top: int = 96, bottom: int = 96, mid_height: int = 8) -> dict:
    """Build a prop-free vertical 3-slice from clean material samples.

    The source contact sheet baked shells/starfish/tape into the frame. Those
    are useful as props, but not as part of the repeatable surface because cards
    can overlap them. This creates a clean stretch asset from the same sand,
    rope, and side-frame samples without those decorations.
    """
    src = Image.open(CROPPED / f"{name}.png").convert("RGBA")
    w, h = src.size
    out_dir = SLICES / f"{name}-clean-vertical"
    out_dir.mkdir(parents=True, exist_ok=True)

    fill_tile = Image.open(SLICES / name / "center-repeat.png").convert("RGBA")
    top_tile = Image.open(SLICES / name / "top.png").convert("RGBA").crop((0, 0, 128, top))
    bottom_src = Image.open(SLICES / name / "bottom.png").convert("RGBA")
    bottom_tile = bottom_src.crop((0, bottom_src.height - bottom, 128, bottom_src.height))
    left_tile = Image.open(SLICES / name / "left.png").convert("RGBA").crop((0, 0, 96, 128))
    right_src = Image.open(SLICES / name / "right.png").convert("RGBA")
    right_tile = right_src.crop((right_src.width - 96, 0, right_src.width, 128))

    def tile(canvas: Image.Image, tile_img: Image.Image, box: tuple[int, int, int, int]) -> None:
        left, top_y, right, bottom_y = box
        for y in range(top_y, bottom_y, tile_img.height):
            for x in range(left, right, tile_img.width):
                canvas.alpha_composite(tile_img, (x, y))

    def new_slice(height: int, top_edge: bool = False, bottom_edge: bool = False) -> Image.Image:
        canvas = Image.new("RGBA", (w, height), (0, 0, 0, 0))
        tile(canvas, fill_tile, (0, 0, w, height))
        if top_edge:
            tile(canvas, top_tile, (0, 0, w, min(height, top_tile.height)))
        if bottom_edge:
            y = max(0, height - bottom_tile.height)
            tile(canvas, bottom_tile, (0, y, w, height))
        tile(canvas, left_tile, (0, 0, left_tile.width, height))
        tile(canvas, right_tile, (w - right_tile.width, 0, w, height))
        return canvas

    top_img = new_slice(top, top_edge=True)
    mid_img = new_slice(mid_height)
    bottom_img = new_slice(bottom, bottom_edge=True)

    top_img.save(out_dir / "top.png")
    mid_img.save(out_dir / "mid.png")
    bottom_img.save(out_dir / "bottom.png")

    return {
        "asset": name,
        "type": "clean-prop-free-vertical-3-slice",
        "source": f"/assets/summer-wiki-ai/cropped/{name}.png",
        "pieces": {
            "top": f"/assets/summer-wiki-ai/slices/{name}-clean-vertical/top.png",
            "mid": f"/assets/summer-wiki-ai/slices/{name}-clean-vertical/mid.png",
            "bottom": f"/assets/summer-wiki-ai/slices/{name}-clean-vertical/bottom.png",
        },
        "size": {"width": w, "height": h},
        "slice": {"top": top, "bottom": bottom, "midHeight": mid_height},
    }


def nine_slice(name: str, inset: int, strip: int = 96) -> dict:
    img = Image.open(CROPPED / f"{name}.png").convert("RGBA")
    w, h = img.size
    cx = (w - strip) // 2
    cy = (h - strip) // 2
    out_dir = SLICES / name

    crops = {
        "top-left": (0, 0, inset, inset),
        "top": (cx, 0, cx + strip, inset),
        "top-right": (w - inset, 0, w, inset),
        "left": (0, cy, inset, cy + strip),
        "center": (cx, cy, cx + strip, cy + strip),
        "right": (w - inset, cy, w, cy + strip),
        "bottom-left": (0, h - inset, inset, h),
        "bottom": (cx, h - inset, cx + strip, h),
        "bottom-right": (w - inset, h - inset, w, h),
    }

    for key, box in crops.items():
        save_crop(img, box, out_dir / f"{key}.png")

    return {
        "asset": name,
        "type": "9-slice",
        "source": f"/assets/summer-wiki-ai/cropped/{name}.png",
        "pieces": {
            key: f"/assets/summer-wiki-ai/slices/{name}/{key}.png"
            for key in crops
        },
        "size": {"width": w, "height": h},
        "slice": {"inset": inset, "strip": strip},
    }


def alpha_bounds(img: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = img.getchannel("A")
    box = alpha.getbbox()
    return box


def crop_props(min_area: int = 900) -> dict:
    src = Image.open(CROPPED / "decor-props-sheet.png").convert("RGBA")
    w, h = src.size
    alpha = src.getchannel("A")
    pix = alpha.load()
    seen = bytearray(w * h)

    boxes: list[tuple[int, int, int, int, int]] = []
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if seen[idx] or pix[x, y] <= 8:
                continue

            seen[idx] = 1
            queue: deque[tuple[int, int]] = deque([(x, y)])
            min_x = max_x = x
            min_y = max_y = y
            area = 0

            while queue:
                px, py = queue.popleft()
                area += 1
                min_x = min(min_x, px)
                max_x = max(max_x, px)
                min_y = min(min_y, py)
                max_y = max(max_y, py)

                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if seen[nidx] or pix[nx, ny] <= 8:
                        continue
                    seen[nidx] = 1
                    queue.append((nx, ny))

            if area >= min_area:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1, area))

    boxes.sort(key=lambda b: (b[1], b[0]))
    PROPS.mkdir(parents=True, exist_ok=True)

    pieces = []
    for i, (left, top, right, bottom, area) in enumerate(boxes, 1):
        pad = 10
        box = (
            max(0, left - pad),
            max(0, top - pad),
            min(w, right + pad),
            min(h, bottom + pad),
        )
        out = PROPS / f"prop-{i:02d}.png"
        save_crop(src, box, out)
        pieces.append({
            "file": f"/assets/summer-wiki-ai/props/prop-{i:02d}.png",
            "box": {"left": box[0], "top": box[1], "right": box[2], "bottom": box[3]},
            "area": area,
        })

    return {
        "asset": "decor-props-sheet",
        "type": "connected-alpha-prop-crops",
        "source": "/assets/summer-wiki-ai/cropped/decor-props-sheet.png",
        "count": len(pieces),
        "pieces": pieces,
    }


def main() -> None:
    SLICES.mkdir(parents=True, exist_ok=True)
    PROPS.mkdir(parents=True, exist_ok=True)

    metadata = {
        "generatedFrom": "/assets/summer-wiki-ai/source",
        "croppedSources": "/assets/summer-wiki-ai/cropped",
        "assets": [
            {
                "asset": "summer-day-beach-bg",
                "type": "full-page-background",
                "file": "/assets/summer-wiki-ai/background/summer-day-beach-bg.png",
                "css": {
                    "backgroundSize": "cover",
                    "backgroundPosition": "center top",
                },
            },
            horizontal_3_slice("top-nav-shell", left=270, right=180),
            horizontal_3_slice("top-nav-shell-slim", left=230, right=230),
            nine_slice("search-sort-panel", inset=120, strip=96),
            nine_slice("filter-water-panel", inset=150, strip=128),
            nine_slice("gallery-desk-panel", inset=190, strip=128),
            nine_slice("gallery-board-clean", inset=92, strip=128),
            nine_slice("character-detail-dossier-v2", inset=138, strip=128),
            nine_slice("character-detail-row-v2", inset=110, strip=128),
            nine_slice("character-detail-art-frame-v2", inset=120, strip=128),
            nine_slice("character-detail-dossier-v4", inset=96, strip=128),
            nine_slice("character-detail-row-v4", inset=42, strip=96),
            nine_slice("character-detail-art-frame-v4", inset=92, strip=128),
            {
                "asset": "character-detail-stat-board-v4",
                "type": "fixed-stat-benchmark-panel",
                "file": "/assets/summer-wiki-ai/cropped/character-detail-stat-board-v4.png",
            },
            vertical_3_slice("gallery-desk-panel", top=176, bottom=176, mid_height=8),
            clean_gallery_vertical_3_slice("gallery-desk-panel"),
            crop_props(),
            {
                "asset": "characters-title-sign",
                "type": "standalone-decorative-title",
                "file": "/assets/summer-wiki-ai/cropped/characters-title-sign.png",
            },
            {
                "asset": "card-detail",
                "type": "kept-existing",
                "file": "/assets/characters-beach/soft-detail-card-cropped.png",
            },
        ],
    }

    (BASE / "slice-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Wrote slices and metadata under {BASE}")


if __name__ == "__main__":
    main()
