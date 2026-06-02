from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = PROJECT_ROOT / "public" / "ui" / "slime"
SOURCE_DIR = OUT_DIR / "source"
PREVIEW_DIR = OUT_DIR / "previews"
GENERATED_DIR = Path(
    r"C:\Users\Angel105\.codex\generated_images\019e6379-e184-71d1-a390-6f5922e06eb3"
)

AI_SOURCES = {
    "nav": GENERATED_DIR / "ig_0208497d7ccba33d016a158153bcf88191941d185892651001.png",
    "stats": GENERATED_DIR / "ig_0208497d7ccba33d016a1581890f2c8191909d09bca271a379.png",
    "carousel": GENERATED_DIR / "ig_0208497d7ccba33d016a15864f138c8191ad8457daa5f07403.png",
    "hero": GENERATED_DIR / "ig_0208497d7ccba33d016a1585f3f59c8191803201632a2f47a3.png",
    "drawer": GENERATED_DIR / "ig_0912f6f4d31b4c9c016a1562f94af08191949b59da04aade10.png",
    "tile_sheet": GENERATED_DIR / "ig_0912f6f4d31b4c9c016a15634a226c8191970443898516ee81.png",
    "trigger": GENERATED_DIR / "ig_0912f6f4d31b4c9c016a156384fa188191a1374a07f2a58693.png",
}


def green_mask(arr: np.ndarray) -> np.ndarray:
    rgb = arr[..., :3].astype(np.int16)
    red = rgb[..., 0]
    green = rgb[..., 1]
    blue = rgb[..., 2]
    strong_key = (green >= 140) & (green > red + 45) & (green > blue + 45)
    soft_edge_key = (
        (green >= 105)
        & (green > red + 26)
        & (green > blue + 26)
        & (red <= 165)
        & (blue <= 165)
    )
    return strong_key | soft_edge_key


def bounds_for_non_green(img: Image.Image, x_min: int = 0, x_max: int | None = None) -> tuple[int, int, int, int]:
    arr = np.asarray(img.convert("RGBA"))
    non_green = ~green_mask(arr)
    if x_max is None:
        x_max = img.width
    mask = np.zeros(non_green.shape, dtype=bool)
    mask[:, x_min:x_max] = non_green[:, x_min:x_max]
    ys, xs = np.where(mask)
    if xs.size == 0 or ys.size == 0:
        raise RuntimeError("No non-green pixels found")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def expand_bounds(bounds: tuple[int, int, int, int], pad: int, width: int, height: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = bounds
    return max(0, left - pad), max(0, top - pad), min(width, right + pad), min(height, bottom + pad)


def save_cropped_source(name: str, src_path: Path, pad: int = 12) -> Path:
    img = Image.open(src_path).convert("RGBA")
    bounds = expand_bounds(bounds_for_non_green(img), pad, img.width, img.height)
    out_path = SOURCE_DIR / f"{name}-source-green.png"
    img.crop(bounds).save(out_path)
    return out_path


def transparent_from_green(source_path: Path, preview_name: str) -> Image.Image:
    img = Image.open(source_path).convert("RGBA")
    arr = np.array(img)
    mask = green_mask(arr)
    arr[mask, 3] = 0
    transparent = Image.fromarray(arr, "RGBA")
    transparent.save(PREVIEW_DIR / f"{preview_name}-full-transparent.png")
    return transparent


def crop_save(img: Image.Image, box: tuple[int, int, int, int], out_path: Path) -> None:
    img.crop(box).save(out_path)


def tile_sheet_sources(src_path: Path) -> dict[str, Path]:
    img = Image.open(src_path).convert("RGBA")
    arr = np.asarray(img)
    non_green = ~green_mask(arr)
    occupied_cols = np.where(non_green.any(axis=0))[0]
    if occupied_cols.size == 0:
        raise RuntimeError("No tile sheet assets found")

    runs: list[tuple[int, int]] = []
    start = int(occupied_cols[0])
    prev = int(occupied_cols[0])
    for value in occupied_cols[1:]:
        x = int(value)
        if x > prev + 16:
            if prev - start > 80:
                runs.append((start, prev + 1))
            start = x
        prev = x
    if prev - start > 80:
        runs.append((start, prev + 1))

    if len(runs) < 2:
        raise RuntimeError(f"Expected two tile sheet assets, found {len(runs)}")

    runs.sort(key=lambda run: run[1] - run[0], reverse=True)
    tile_run = runs[0]
    thumb_run = runs[-1]

    tile_bounds = expand_bounds(bounds_for_non_green(img, *tile_run), 12, img.width, img.height)
    thumb_bounds = expand_bounds(bounds_for_non_green(img, *thumb_run), 12, img.width, img.height)

    sheet_path = SOURCE_DIR / "quick-tile-thumb-sheet-source-green.png"
    tile_path = SOURCE_DIR / "tile-frame-source-green.png"
    thumb_path = SOURCE_DIR / "thumb-active-source-green.png"
    shutil.copyfile(src_path, sheet_path)
    img.crop(tile_bounds).save(tile_path)
    img.crop(thumb_bounds).save(thumb_path)
    return {"tile": tile_path, "thumb": thumb_path, "sheet": sheet_path}


def horizontal_slices(
    name: str,
    source_path: Path,
    left_width: int,
    right_width: int,
    css_height: int,
    css_left: int,
    css_right: int,
    center_slice: int = 8,
) -> dict:
    img = transparent_from_green(source_path, name)
    w, h = img.size
    center_x = max(left_width, int(w * 0.52))
    center_x = min(center_x, w - right_width - center_slice)

    crop_save(img, (0, 0, left_width, h), OUT_DIR / f"{name}-left.png")
    crop_save(img, (center_x, 0, center_x + center_slice, h), OUT_DIR / f"{name}-center-8px.png")
    crop_save(img, (w - right_width, 0, w, h), OUT_DIR / f"{name}-right.png")

    return {
        "component": name,
        "sliceType": "horizontal-3-slice",
        "width": w,
        "height": h,
        "leftWidth": left_width,
        "centerSliceWidth": center_slice,
        "rightWidth": right_width,
        "cssHeight": css_height,
        "cssLeftWidth": css_left,
        "cssRightWidth": css_right,
        "contentInsetLeft": 24,
        "contentInsetRight": 24,
        "contentInsetTop": 14,
        "contentInsetBottom": 14,
        "source": f"/ui/slime/source/{name}-source-green.png",
        "preview": f"/ui/slime/previews/{name}-full-transparent.png",
    }


def nine_slices(
    name: str,
    source_path: Path,
    inset: int,
    css_inset: int,
    content_x: int,
    content_y: int,
    top_sample_ratio: float = 0.35,
    center_slice: int = 8,
) -> dict:
    img = transparent_from_green(source_path, name)
    w, h = img.size
    sample_x = max(inset, int(w * top_sample_ratio))
    sample_x = min(sample_x, w - inset - center_slice)
    sample_y = max(inset, int(h * 0.52))
    sample_y = min(sample_y, h - inset - center_slice)
    center_x = (w - center_slice) // 2
    center_y = (h - center_slice) // 2

    crop_save(img, (0, 0, inset, inset), OUT_DIR / f"{name}-top-left.png")
    crop_save(img, (sample_x, 0, sample_x + center_slice, inset), OUT_DIR / f"{name}-top.png")
    crop_save(img, (w - inset, 0, w, inset), OUT_DIR / f"{name}-top-right.png")
    crop_save(img, (0, sample_y, inset, sample_y + center_slice), OUT_DIR / f"{name}-left.png")
    crop_save(img, (center_x, center_y, center_x + center_slice, center_y + center_slice), OUT_DIR / f"{name}-center.png")
    crop_save(img, (w - inset, sample_y, w, sample_y + center_slice), OUT_DIR / f"{name}-right.png")
    crop_save(img, (0, h - inset, inset, h), OUT_DIR / f"{name}-bottom-left.png")
    crop_save(img, (sample_x, h - inset, sample_x + center_slice, h), OUT_DIR / f"{name}-bottom.png")
    crop_save(img, (w - inset, h - inset, w, h), OUT_DIR / f"{name}-bottom-right.png")

    return {
        "component": name,
        "sliceType": "9-slice",
        "width": w,
        "height": h,
        "topInset": inset,
        "rightInset": inset,
        "bottomInset": inset,
        "leftInset": inset,
        "centerSliceWidth": center_slice,
        "centerSliceHeight": center_slice,
        "cssInset": css_inset,
        "contentInsetLeft": content_x,
        "contentInsetRight": content_x,
        "contentInsetTop": content_y,
        "contentInsetBottom": content_y,
        "source": f"/ui/slime/source/{name}-source-green.png",
        "preview": f"/ui/slime/previews/{name}-full-transparent.png",
    }


def vertical_slices(
    name: str,
    source_path: Path,
    top_height: int,
    bottom_height: int,
    css_top: int,
    css_bottom: int,
    middle_slice: int = 8,
) -> dict:
    img = transparent_from_green(source_path, name)
    w, h = img.size
    mid_y = max(top_height, int(h * 0.52))
    mid_y = min(mid_y, h - bottom_height - middle_slice)

    crop_save(img, (0, 0, w, top_height), OUT_DIR / f"{name}-top.png")
    crop_save(img, (0, mid_y, w, mid_y + middle_slice), OUT_DIR / f"{name}-middle-8px.png")
    crop_save(img, (0, h - bottom_height, w, h), OUT_DIR / f"{name}-bottom.png")

    return {
        "component": name,
        "sliceType": "vertical-3-slice",
        "width": w,
        "height": h,
        "topHeight": top_height,
        "middleSliceHeight": middle_slice,
        "bottomHeight": bottom_height,
        "cssTopHeight": css_top,
        "cssBottomHeight": css_bottom,
        "contentInsetLeft": 10,
        "contentInsetRight": 10,
        "contentPaddingTop": 8,
        "contentPaddingBottom": 8,
        "source": f"/ui/slime/source/{name}-source-green.png",
        "preview": f"/ui/slime/previews/{name}-full-transparent.png",
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    nav_source = save_cropped_source("nav", AI_SOURCES["nav"], 8)
    hero_source = save_cropped_source("hero-frame", AI_SOURCES["hero"], 8)
    showcase_source = save_cropped_source("showcase-frame", AI_SOURCES["hero"], 8)
    carousel_source = save_cropped_source("carousel-shell", AI_SOURCES["carousel"], 8)
    drawer_source = save_cropped_source("drawer-frame", AI_SOURCES["drawer"], 8)
    tile_sources = tile_sheet_sources(AI_SOURCES["tile_sheet"])
    trigger_source = save_cropped_source("drawer-trigger", AI_SOURCES["trigger"], 8)

    stats_source = save_cropped_source("stats", AI_SOURCES["stats"], 8)
    transparent_from_green(showcase_source, "showcase-frame").save(OUT_DIR / "showcase-frame.png")
    transparent_from_green(carousel_source, "carousel-shell").save(OUT_DIR / "carousel-shell.png")

    metadata = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "workflow": "AI-drawn source shells, chroma-keyed locally, exported as production slices",
        "palette": {
            "background": "#030812",
            "panel": "#061426",
            "accent": "#31efff",
            "highlight": "#2de0bc",
            "alert": "#ff6d7c",
            "chromaKey": "#00ff00",
        },
        "sourcePrompts": {
            "nav": "AI-drawn rounded website nav shell on #00ff00 chroma background; no baked text/icons/buttons.",
            "stats": "AI-drawn low carousel rail shell on #00ff00 chroma background; no baked thumbnails/arrows.",
            "showcaseFrame": "AI-drawn ocean-ribbon showcase shell on #00ff00 chroma background; no baked UI content.",
            "carouselShell": "AI-drawn carousel rail with empty thumbnail wells on #00ff00 chroma background.",
            "heroFrame": "AI-drawn 9-slice featured/database panel shell on #00ff00 chroma background; clean content fill.",
            "drawerFrame": "AI-drawn tall drawer/menu panel shell on #00ff00 chroma background; clean iframe/timer content fill.",
            "tileFrame": "AI-drawn compact quick-access tile shell from source sheet on #00ff00 chroma background.",
            "thumbActive": "AI-drawn active carousel thumbnail shell from source sheet on #00ff00 chroma background.",
            "drawerTrigger": "AI-drawn slim vertical trigger shell on #00ff00 chroma background.",
        },
        "assets": [
            horizontal_slices("nav", nav_source, 250, 250, 52, 58, 58),
            horizontal_slices("stats", stats_source, 260, 260, 68, 58, 58),
            {
                "component": "showcase-frame",
                "sliceType": "full-shell-scaled",
                "source": "/ui/slime/source/showcase-frame-source-green.png",
                "preview": "/ui/slime/previews/showcase-frame-full-transparent.png",
                "asset": "/ui/slime/showcase-frame.png",
                "contentInsetLeft": 42,
                "contentInsetRight": 42,
                "contentInsetTop": 42,
                "contentInsetBottom": 42,
            },
            {
                "component": "carousel-shell",
                "sliceType": "full-shell-scaled",
                "source": "/ui/slime/source/carousel-shell-source-green.png",
                "preview": "/ui/slime/previews/carousel-shell-full-transparent.png",
                "asset": "/ui/slime/carousel-shell.png",
                "slots": 6,
                "contentInsetLeft": 146,
                "contentInsetRight": 146,
                "contentInsetTop": 24,
                "contentInsetBottom": 24,
            },
            nine_slices("hero-frame", hero_source, 126, 54, 66, 58, 0.34),
            nine_slices("tile-frame", tile_sources["tile"], 102, 30, 42, 36, 0.42),
            nine_slices("thumb-active", tile_sources["thumb"], 86, 18, 18, 18, 0.42),
            nine_slices("drawer-frame", drawer_source, 110, 52, 62, 58, 0.36),
            vertical_slices("drawer-trigger", trigger_source, 190, 190, 74, 74),
        ],
    }

    (OUT_DIR / "slice-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Processed AI-drawn SLIME.WIKI UI assets into {OUT_DIR}")


if __name__ == "__main__":
    main()
