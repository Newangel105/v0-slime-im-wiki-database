# Build/refresh public/models/index.json — the manifest the 3D model viewer
# (app/model-viewer/page.tsx) fetches from R2 at runtime to know which character
# models exist.
#
# Why this exists: the extraction pipeline (step6_model_viewer) builds the
# per-character GLBs but NOTHING regenerated this manifest. So a newly-extracted
# model would get uploaded to R2 yet never appear in the viewer, because the
# index still listed the old set. This closes that gap.
#
# R2 note: the full model set (600+) lives on R2, not on disk — only freshly
# built GLBs are present locally. So we MERGE rather than rebuild: fetch the
# current index from R2/CDN and ADD entries for any local GLBs not already
# listed (and refresh entries whose GLBs we just rebuilt). If the existing index
# can't be fetched AND we'd otherwise shrink it, we refuse to write (never
# clobber the whole manifest) unless --allow-from-scratch is passed.
#
# Entry schema (matches the live index):
#   { "id", "name", "characterType", "glb",
#     "skillScene": { "glb", "manifest", "visibility" } }   # skillScene optional
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(r"d:/Slime Isekai Memories Game Files/website/v0-slime-im-wiki-database")
DEFAULT_MODELS_DIR = ROOT / "public" / "models"

# Bases tried in order to fetch the existing index. The custom domain only
# resolves in prod; the pub-*.r2.dev origin is always reachable. NEXT_PUBLIC_
# MEDIA_CDN (if exported) wins.
CDN_BASES = [
    "https://media.slimewiki.app",
    "https://pub-2b74b4d871924b6e821fc6800c65f72a.r2.dev",
]


def fetch_existing_index(bases: list[str]) -> list[dict] | None:
    for base in bases:
        url = base.rstrip("/") + "/models/index.json"
        try:
            # r2.dev 403s requests without a UA; a browser-ish one is fine.
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            models = data.get("models") if isinstance(data, dict) else data
            if isinstance(models, list):
                print(f"  fetched existing index from {url} ({len(models)} models)")
                return models
        except Exception as e:  # noqa: BLE001
            print(f"  (couldn't fetch {url}: {e})")
    return None


def scan_local_models(models_dir: Path) -> dict[str, dict]:
    """Walk public/models/Character/<type>/<id>/ and build an entry for every
    dir that has a <id>.glb. Keyed by id."""
    out: dict[str, dict] = {}
    character_root = models_dir / "Character"
    if not character_root.exists():
        return out
    for type_dir in sorted(p for p in character_root.iterdir() if p.is_dir()):
        ctype = type_dir.name  # e.g. "PC"
        for var_dir in sorted(p for p in type_dir.iterdir() if p.is_dir()):
            vid = var_dir.name
            glb = var_dir / f"{vid}.glb"
            if not glb.exists():
                continue
            rel = f"/models/Character/{ctype}/{vid}"
            entry: dict = {
                "id": vid,
                "name": vid,
                "characterType": ctype,
                "glb": f"{rel}/{vid}.glb",
            }
            skill_glb = var_dir / f"{vid}.skill.glb"
            if skill_glb.exists():
                scene: dict = {"glb": f"{rel}/{vid}.skill.glb"}
                if (var_dir / f"{vid}.skill-scenes.json").exists():
                    scene["manifest"] = f"{rel}/{vid}.skill-scenes.json"
                if (var_dir / f"{vid}.skill.visibility.json").exists():
                    scene["visibility"] = f"{rel}/{vid}.skill.visibility.json"
                entry["skillScene"] = scene
            out[vid] = entry
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--models-dir", type=Path, default=DEFAULT_MODELS_DIR,
                    help="public/models dir to scan for locally-built GLBs.")
    ap.add_argument("--output", type=Path, default=None,
                    help="Where to write index.json (default: <models-dir>/index.json).")
    ap.add_argument("--cdn-base", action="append", default=None,
                    help="Override CDN base(s) used to fetch the existing index. Repeatable.")
    ap.add_argument("--allow-from-scratch", action="store_true",
                    help="Write an index built only from local GLBs even if the existing "
                         "index couldn't be fetched (DANGER: shrinks the manifest).")
    args = ap.parse_args()

    models_dir = args.models_dir
    out_path = args.output or (models_dir / "index.json")

    local = scan_local_models(models_dir)
    print(f"local GLBs found: {len(local)}")

    import os
    bases: list[str] = []
    env_cdn = os.environ.get("NEXT_PUBLIC_MEDIA_CDN", "").strip()
    if env_cdn:
        bases.append(env_cdn)
    bases.extend(args.cdn_base or CDN_BASES)

    existing_list = fetch_existing_index(bases)

    if existing_list is None:
        if not local:
            print("no existing index and no local models — nothing to do.")
            sys.exit(0)
        if not args.allow_from_scratch:
            print("ERROR: couldn't fetch the existing index and refusing to rebuild from "
                  "local GLBs alone (would clobber the full manifest). Re-run with "
                  "--allow-from-scratch only if you really mean to. Skipping.")
            sys.exit(0)
        merged = local
        print("building from local GLBs only (--allow-from-scratch).")
    else:
        merged = {m["id"]: m for m in existing_list if isinstance(m, dict) and m.get("id")}
        before = len(merged)
        # Local entries are fresher (we just (re)built those GLBs) — they win.
        merged.update(local)
        added = len(merged) - before
        refreshed = len(local) - added
        print(f"merge: {before} existing + {len(local)} local -> {len(merged)} "
              f"({added} new, {refreshed} refreshed)")

    models = [merged[k] for k in sorted(merged)]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"models": models}, indent=1), encoding="utf-8")
    print(f"\nWrote {out_path}  ({len(models)} models)")


if __name__ == "__main__":
    main()
