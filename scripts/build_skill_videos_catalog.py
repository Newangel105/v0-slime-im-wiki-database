# Generate public/skill-videos/catalog.json by combining per-character MP4
# files in public/Movie/SpecialSkill + public/Movie/BlessSkill with whatever
# is already on R2 (since the Movie tree moved to the CDN and most variants
# no longer have a local copy). The model viewer reads this catalog
# (components/model-viewer-client.tsx) and shows the videos that match the
# selected model id (variant).
#
# Filename convention (verified against models/index.json):
#   <ModelId>_Battle_SpecialSkill.mp4
#   <ModelId>_Battle_BlessSkill.mp4
import concurrent.futures
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"d:/Slime Isekai Memories Game Files/website/v0-slime-im-wiki-database")
PUBLIC = ROOT / "public"
MODELS_JSON = PUBLIC / "models" / "index.json"
CATALOG_OUT = PUBLIC / "skill-videos" / "catalog.json"

# R2 CDN used as a fallback discovery surface for variants without a local
# copy of the .mp4. Override with $R2_MOVIE_CDN.
R2_MOVIE_CDN = (os.environ.get("R2_MOVIE_CDN")
                or "https://pub-2b74b4d871924b6e821fc6800c65f72a.r2.dev").rstrip("/")

# Cloudflare blocks the default Python-urllib UA with 403 on r2.dev — use a
# generic browser-style UA so HEAD requests succeed.
_UA = "Mozilla/5.0 (compatible; SkillCatalogBuilder/1.0)"


def _r2_has(rel_path: str, timeout: float = 5.0) -> bool:
    url = f"{R2_MOVIE_CDN}/{rel_path.lstrip('/')}"
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": _UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return False


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
local_seen: set[tuple[str, str]] = set()

# Pass 1: walk local disk
for source in SOURCES:
    if not source["dir"].exists():
        print(f"  skipping {source['dir']} (missing - will fall back to R2)")
        continue
    files = sorted(f.name for f in source["dir"].iterdir() if f.name.endswith(".mp4"))
    print(f"\n{source['dir'].name}: {len(files)} mp4 files locally")
    matched_for_source = 0
    for fname in files:
        if not fname.endswith(source["suffix"]):
            continue
        variant = fname[: -len(source["suffix"])]
        if variant not in known_ids:
            unmatched.append((source["kind"], variant))
            continue
        videos.append({
            "variant": variant,
            "kind": source["kind"],
            "group": source["kind"],
            "scene": source["scene_label"],
            "mp4": f"{source['url_prefix']}{fname}",
        })
        local_seen.add((variant, source["kind"]))
        matched_for_source += 1
    print(f"  matched to model id: {matched_for_source}")

# Pass 2: HEAD-check R2 for variants we DIDN'T find locally.
r2_candidates = []
for variant in sorted(known_ids):
    for source in SOURCES:
        if (variant, source["kind"]) in local_seen:
            continue
        fname = f"{variant}{source['suffix']}"
        rel = f"Movie/{source['kind']}/{fname}"
        r2_candidates.append((variant, source, rel))

print(f"\nHEAD-checking R2 for {len(r2_candidates)} (variant,kind) candidates at {R2_MOVIE_CDN}")
r2_found = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=24) as ex:
    results = list(ex.map(lambda c: (c, _r2_has(c[2])), r2_candidates))
for (variant, source, rel), ok in results:
    if not ok:
        continue
    videos.append({
        "variant": variant,
        "kind": source["kind"],
        "group": source["kind"],
        "scene": source["scene_label"],
        "mp4": f"{source['url_prefix']}{variant}{source['suffix']}",
    })
    r2_found += 1
print(f"R2 hits: {r2_found}")

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
