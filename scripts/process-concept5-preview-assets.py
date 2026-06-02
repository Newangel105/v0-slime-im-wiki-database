from __future__ import annotations

import importlib.util
import json
import shutil
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONCEPT5_DIR = PROJECT_ROOT / "public" / "_preview" / "concept5"

SOURCES = {
    "nav": CONCEPT5_DIR / "source" / "concept5-nav-ai-source-green.png",
    "intro": CONCEPT5_DIR / "source" / "concept5-intro-ai-source-green.png",
}


def load_slime_processor():
    processor_path = PROJECT_ROOT / "scripts" / "process-slime-ai-assets.py"
    spec = importlib.util.spec_from_file_location("slime_ai_asset_processor", processor_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {processor_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def copy_compat(src_name: str, dst_name: str) -> None:
    shutil.copyfile(CONCEPT5_DIR / src_name, CONCEPT5_DIR / dst_name)


def asymmetric_nine_slices(
    processor,
    name: str,
    source_path: Path,
    left: int,
    right: int,
    top: int,
    bottom: int,
    center_slice: int = 12,
    sample_x_ratio: float = 0.55,
    sample_y_ratio: float = 0.5,
) -> dict:
    img = processor.transparent_from_green(source_path, f"{name}-9")
    w, h = img.size
    sample_x = max(left, int(w * sample_x_ratio))
    sample_x = min(sample_x, w - right - center_slice)
    sample_y = max(top, int(h * sample_y_ratio))
    sample_y = min(sample_y, h - bottom - center_slice)
    center_x = max(left, min((w - center_slice) // 2, w - right - center_slice))
    center_y = max(top, min((h - center_slice) // 2, h - bottom - center_slice))

    processor.crop_save(img, (0, 0, left, top), CONCEPT5_DIR / f"{name}-9-top-left.png")
    processor.crop_save(img, (sample_x, 0, sample_x + center_slice, top), CONCEPT5_DIR / f"{name}-9-top.png")
    processor.crop_save(img, (w - right, 0, w, top), CONCEPT5_DIR / f"{name}-9-top-right.png")
    processor.crop_save(img, (0, sample_y, left, sample_y + center_slice), CONCEPT5_DIR / f"{name}-9-left.png")
    processor.crop_save(img, (center_x, center_y, center_x + center_slice, center_y + center_slice), CONCEPT5_DIR / f"{name}-9-center.png")
    processor.crop_save(img, (w - right, sample_y, w, sample_y + center_slice), CONCEPT5_DIR / f"{name}-9-right.png")
    processor.crop_save(img, (0, h - bottom, left, h), CONCEPT5_DIR / f"{name}-9-bottom-left.png")
    processor.crop_save(img, (sample_x, h - bottom, sample_x + center_slice, h), CONCEPT5_DIR / f"{name}-9-bottom.png")
    processor.crop_save(img, (w - right, h - bottom, w, h), CONCEPT5_DIR / f"{name}-9-bottom-right.png")

    return {
        "component": f"{name}-9",
        "sliceType": "asymmetric-9-slice",
        "width": w,
        "height": h,
        "topInset": top,
        "rightInset": right,
        "bottomInset": bottom,
        "leftInset": left,
        "centerSliceWidth": center_slice,
        "centerSliceHeight": center_slice,
        "source": f"/_preview/concept5/source/{name}-source-green.png",
        "preview": f"/_preview/concept5/previews/{name}-9-full-transparent.png",
    }


def main() -> None:
    processor = load_slime_processor()

    processor.OUT_DIR = CONCEPT5_DIR
    processor.SOURCE_DIR = CONCEPT5_DIR / "source"
    processor.PREVIEW_DIR = CONCEPT5_DIR / "previews"
    processor.OUT_DIR.mkdir(parents=True, exist_ok=True)
    processor.SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    processor.PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    nav_source = processor.save_cropped_source("ai-nav", SOURCES["nav"], 18)
    nav_full = processor.transparent_from_green(nav_source, "ai-nav")
    nav_full.save(CONCEPT5_DIR / "ai-nav-shell-transparent.png", optimize=True)
    nav_meta = processor.horizontal_slices(
        "ai-nav",
        nav_source,
        left_width=350,
        right_width=390,
        css_height=96,
        css_left=150,
        css_right=166,
        center_slice=12,
    )
    nav_meta["source"] = "/_preview/concept5/source/ai-nav-source-green.png"
    nav_meta["preview"] = "/_preview/concept5/previews/ai-nav-full-transparent.png"
    nav_9_meta = asymmetric_nine_slices(
        processor,
        "ai-nav",
        nav_source,
        left=440,
        right=360,
        top=92,
        bottom=74,
        center_slice=12,
    )
    copy_compat("ai-nav-left.png", "ai-nav-cap-left.png")
    copy_compat("ai-nav-center-8px.png", "ai-nav-center-strip-12px.png")
    copy_compat("ai-nav-right.png", "ai-nav-cap-right.png")

    intro_source = processor.save_cropped_source("intro-panel", SOURCES["intro"], 28)
    intro_full = processor.transparent_from_green(intro_source, "intro-panel")
    intro_full.save(CONCEPT5_DIR / "intro-panel-shell-transparent.png", optimize=True)
    intro_meta = processor.nine_slices(
        "intro-panel",
        intro_source,
        inset=170,
        css_inset=58,
        content_x=82,
        content_y=82,
        top_sample_ratio=0.34,
        center_slice=12,
    )
    intro_meta["source"] = "/_preview/concept5/source/intro-panel-source-green.png"
    intro_meta["preview"] = "/_preview/concept5/previews/intro-panel-full-transparent.png"
    w, _ = intro_full.size
    crest_box = (int(w * 0.36), 0, int(w * 0.64), 112)
    processor.crop_save(intro_full, crest_box, CONCEPT5_DIR / "intro-panel-crest.png")

    metadata = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "workflow": "Reuses scripts/process-slime-ai-assets.py chroma-key and slicing helpers for concept5 preview components.",
        "sourceAssets": {
            "nav": str(SOURCES["nav"]),
            "intro": str(SOURCES["intro"]),
            "logo": "/brand/battleSlime16.webp",
        },
        "assets": [
            {
                **nav_meta,
                "component": "concept5-nav",
                "compatFiles": [
                    "ai-nav-cap-left.png",
                    "ai-nav-center-strip-12px.png",
                    "ai-nav-cap-right.png",
                    "ai-nav-shell-transparent.png",
                ],
                "notes": "The source includes a transparent left medallion reserved for the wiki mark.",
            },
            {
                **nav_9_meta,
                "component": "concept5-nav-9-slice",
                "notes": "Optional full 9-slice export. The preview currently uses the horizontal 3-slice version because the nav height is fixed.",
            },
            {
                **intro_meta,
                "component": "concept5-intro-panel",
                "topCrest": {
                    "asset": "intro-panel-crest.png",
                    "sourceBox": {
                        "left": crest_box[0],
                        "top": crest_box[1],
                        "right": crest_box[2],
                        "bottom": crest_box[3],
                    },
                },
                "notes": "Top crest is overlaid separately to keep the shell ornament from stretching.",
            },
        ],
    }

    (CONCEPT5_DIR / "concept5-preview-slice-metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    print(f"Processed concept5 preview assets into {CONCEPT5_DIR}")


if __name__ == "__main__":
    main()
