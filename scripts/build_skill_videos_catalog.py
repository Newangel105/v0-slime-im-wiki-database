# Update public/skill-videos/catalog.json with the per-character skill MP4s in
# public/Movie/SpecialSkill and public/Movie/BlessSkill. The model viewer reads
# this catalog (see components/model-viewer-client.tsx:147).
#
# Filename convention (verified against models/index.json):
#   <ModelId>_Battle_SpecialSkill.mp4 / <ModelId>_Battle_BlessSkill.mp4
#
# R2 note: movies, models/index.json, and the existing catalog all live in R2,
# not on disk, so only freshly-extracted MP4s are present locally. We therefore
# fetch models + the current catalog from the deployed wiki (R2-backed) and MERGE
# the new local MP4(s) in — rebuilding purely from local files would wipe the
# catalog. If the base catalog can't be loaded we skip (never clobber).
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"d:/Slime Isekai Memories Game Files/website/v0-slime-im-wiki-database")
PUBLIC = ROOT / "public"
MODELS_JSON = PUBLIC / "models" / "index.json"
CATALOG_OUT = PUBLIC / "skill-videos" / "catalog.json"
WIKI = "https://slimewiki.vercel.app"  # deployed site, R2-backed — used when local files are absent

SOURCES = [
    {"dir": PUBLIC / "Movie" / "SpecialSkill", "url_prefix": "/Movie/SpecialSkill/",
     "kind": "SpecialSkill", "scene_label": "Special Skill", "suffix": "_Battle_SpecialSkill.mp4"},
    {"dir": PUBLIC / "Movie" / "BlessSkill", "url_prefix": "/Movie/BlessSkill/",
     "kind": "BlessSkill", "scene_label": "Bless Skill", "suffix": "_Battle_BlessSkill.mp4"},
]


def load_json(local: Path, wiki_path: str):
    """Local file if present, else fetch from the deployed (R2-backed) wiki."""
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    try:
        with urllib.request.urlopen(WIKI + wiki_path, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
        print(f"  loaded {local.name} from {WIKI}{wiki_path} (not on disk)")
        return data
    except Exception as e:  # noqa: BLE001
        print(f"  couldn't load {local.name} locally or from {WIKI}{wiki_path}: {e}")
        return None


models = load_json(MODELS_JSON, "/models/index.json")
known_ids = {m["id"] for m in models["models"]} if models and models.get("models") else None
print(f"Loaded {len(known_ids)} model ids" if known_ids is not None
      else "no models index available — skipping id validation")

# Start from the existing catalog so we merge instead of clobber.
existing = load_json(CATALOG_OUT, "/skill-videos/catalog.json")
if existing is None:
    print("could not load the existing catalog (local or wiki) — refusing to rebuild "
          "from local files (would clobber the whole catalog). Skipping.")
    sys.exit(0)
by_key = {(v["variant"], v["kind"]): v for v in (existing.get("videos") or [])}
print(f"existing catalog: {len(by_key)} videos")

# The game suffixes some model asset names with "PC" (player character) while the wiki uses
# the clean id (e.g. RimuruMaidCostumePC -> RimuruMaidCostume, consolidated in models/index.json).
# Map the movie variant to the clean id so the tab matches (and survives a rebuild).
VARIANT_ALIASES = {"RimuruMaidCostumePC": "RimuruMaidCostume"}

added = 0
for source in SOURCES:
    if not source["dir"].exists():
        print(f"  skipping {source['dir']} (missing)")
        continue
    files = sorted(f.name for f in source["dir"].iterdir() if f.name.endswith(source["suffix"]))
    print(f"{source['dir'].name}: {len(files)} mp4 files")
    for fname in files:
        variant = fname[: -len(source["suffix"])]
        variant = VARIANT_ALIASES.get(variant, variant)
        if known_ids is not None and variant not in known_ids:
            print(f"  skip (unknown model id): {variant}")
            continue
        key = (variant, source["kind"])
        if key not in by_key:
            added += 1
        by_key[key] = {
            "variant": variant, "kind": source["kind"], "group": source["kind"],
            "scene": source["scene_label"], "mp4": f"{source['url_prefix']}{fname}",
        }

videos = sorted(by_key.values(), key=lambda v: (v["variant"], v["kind"]))
catalog = {
    "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "source": "scripts/build_skill_videos_catalog.py",
    "videos": videos,
}
CATALOG_OUT.parent.mkdir(parents=True, exist_ok=True)
CATALOG_OUT.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
print(f"\nWrote {CATALOG_OUT}  ({len(videos)} entries, +{added} new)")
