# Generate public/skill-videos/catalog.json from the per-character MP4 files in
# public/Movie/SpecialSkill and public/Movie/BlessSkill. The model viewer
# reads this catalog (see components/model-viewer-client.tsx:147) and shows
# the videos that match the selected model id (variant).
#
# Filename convention (verified against models/index.json):
#   <ModelId>_Battle_SpecialSkill.mp4
#   <ModelId>_Battle_BlessSkill.mp4
import json, os, re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"d:/Slime Isekai Memories Game Files/website/v0-slime-im-wiki-database")
PUBLIC = ROOT / "public"
MODELS_JSON = PUBLIC / "models" / "index.json"
CATALOG_OUT = PUBLIC / "skill-videos" / "catalog.json"

# Movie folder -> (kind label shown in the scene dropdown, regex group order)
SOURCES = [
    {
        "dir": PUBLIC / "Movie" / "SpecialSkill",
        "url_prefix": "/Movie/SpecialSkill/",
        "kind": "SpecialSkill",
        "scene_label": "Special Skill",
        "suffix": "_Battle_SpecialSkill.mp4",
    },
    {
        "dir": PUBLIC / "Movie" / "BlessSkill",
        "url_prefix": "/Movie/BlessSkill/",
        "kind": "BlessSkill",
        "scene_label": "Bless Skill",
        "suffix": "_Battle_BlessSkill.mp4",
    },
]

models = json.loads(MODELS_JSON.read_text(encoding="utf-8"))
known_ids = {m["id"] for m in models["models"]}
print(f"Loaded {len(known_ids)} model ids")

videos = []
unmatched = []
for source in SOURCES:
    if not source["dir"].exists():
        print(f"  skipping {source['dir']} (missing)")
        continue
    files = sorted(f.name for f in source["dir"].iterdir() if f.name.endswith(".mp4"))
    print(f"\n{source['dir'].name}: {len(files)} mp4 files")
    matched_for_source = 0
    for fname in files:
        if not fname.endswith(source["suffix"]):
            continue
        variant = fname[: -len(source["suffix"])]
        if variant not in known_ids:
            unmatched.append((source["kind"], variant))
            continue
        entry = {
            "variant": variant,
            "kind": source["kind"],
            "group": source["kind"],
            "scene": source["scene_label"],
            "mp4": f"{source['url_prefix']}{fname}",
        }
        videos.append(entry)
        matched_for_source += 1
    print(f"  matched to model id: {matched_for_source}")

if unmatched:
    print(f"\nUnmatched ({len(unmatched)}):")
    for kind, v in unmatched[:10]:
        print(f"  {kind} -> {v}")

# Order by variant alphabetic then kind for stable diffs.
videos.sort(key=lambda v: (v["variant"], v["kind"]))

catalog = {
    "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "source": "scripts/build_skill_videos_catalog.py",
    "videos": videos,
}
CATALOG_OUT.parent.mkdir(parents=True, exist_ok=True)
CATALOG_OUT.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
print(f"\nWrote {CATALOG_OUT}  ({len(videos)} entries)")
