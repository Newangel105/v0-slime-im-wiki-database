"""Build a single, authoritative movie URL catalog for the Slime IM website's
summon reveal pipeline.

Combines every signal we have:
  1. `summon.generated.json` -> `pc_lottery_messages[].movie_path` (265 entries:
     SpecialSkill + BlessSkill), and `banners[].movie_path` (lottery banners that
     have a main-movie override).
  2. `_lottery_movies.json` -> 29 main lottery pattern movies in public/Movie/Lottery.
  3. `cab_index.jsonl` + `cab_index_assetpack.jsonl` -> bundle paths whose
     container references a `Movie/SpecialSkill|BlessSkill|Announce|Lottery`
     USM. The presence of a bundle here proves we can extract the USM locally.
  4. `_work/blusestacks_scan/movie_bundle_paths.tsv` (if present) -> BlueStacks
     UnityCache/Shared bundles that the live game has cached. The intersection
     with #1 tells us which CDN-only movies can now be harvested from device.
  5. `public/Movie/*` -> already-shipped MP4s + `.validated.json` sidecars.
     A movie is `converted` if both files exist.

For every catalog entry we emit:
    {
      "movie_path":          str,        # canonical USM path (lowercase normalised)
      "stem":                str,        # filename stem (used for /Movie/SpecialSkill/<stem>.mp4)
      "category":            str,        # SpecialSkill | BlessSkill | Announce | Lottery | banner_override
      "master_pc_id":        int|null,
      "character_name":      str|null,
      "release_label":       str|null,
      "logical_movie_path":  str,        # path as game data refers to it
      "cdn_url":             str|null,   # if a CDN URL has been observed
      "raw_local_path":      str|null,   # _work/... where the USM landed
      "raw_local_exists":    bool,
      "converted_mp4":       str|null,   # public/Movie/... if the MP4 is shipped
      "converted_mp4_exists":bool,
      "web_url":             str,        # /Movie/... URL the frontend will use
      "source_table":        list[str],  # ["pc_lottery_messages", "banner", ...]
      "bundle_paths":        list[str],  # cab index bundle paths if any
      "device_bundle_paths": list[str],  # BlueStacks UnityCache bundle relpaths
      "status":              str,        # available | downloadable | downloaded |
                                          # converted | missing | unknown
      "notes":               str|null,
    }

Run from project root:
    python scripts/build_movie_url_catalog.py
Writes:
    lib/summon-ui/lottery_runtime_data/movie_url_catalog.json
    lib/summon-ui/lottery_runtime_data/movie_url_catalog.summary.json
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
RE_WORK = Path(r"C:/Users/Angel105/Documents/cenas/_work")

SUMMON_DATA = PROJECT_DIR / "summon.generated.json"
PUBLIC = PROJECT_DIR / "public"
LOTTERY_DIR = PUBLIC / "Movie" / "Lottery"
SPECIALSKILL_DIR = PUBLIC / "Movie" / "SpecialSkill"
ANNOUNCE_DIR = PUBLIC / "Movie" / "Announce"
PROMOTION_DIR = PUBLIC / "Movie" / "Promotion"

CAB_INDEXES = [
    RE_WORK / "cab_index.jsonl",
    RE_WORK / "cab_index_assetpack.jsonl",
]
DEVICE_BUNDLE_TSV = PROJECT_DIR / "_work" / "blusestacks_scan" / "movie_bundle_paths.tsv"
LOTTERY_MOVIES_JSON = LOTTERY_DIR / "_lottery_movies.json"

OUT_CATALOG = PROJECT_DIR / "lib" / "summon-ui" / "lottery_runtime_data" / "movie_url_catalog.json"
OUT_SUMMARY = PROJECT_DIR / "lib" / "summon-ui" / "lottery_runtime_data" / "movie_url_catalog.summary.json"

USM_RE = re.compile(r"Movie/(?P<cat>SpecialSkill|BlessSkill|Announce|Lottery)/(?:[^/]+/)?(?P<stem>[A-Za-z0-9_]+)\.usm(?:\.bytes)?$", re.IGNORECASE)


def normalise(path: str | None) -> str | None:
    if not path:
        return None
    p = path.replace("\\", "/").strip("/")
    return p or None


def stem_of(path: str | None) -> str | None:
    if not path:
        return None
    return Path(path).stem


def md5_hex_upper(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest().upper()


def load_summon_data() -> dict:
    return json.loads(SUMMON_DATA.read_text(encoding="utf-8"))


def load_cab_index_movie_hits(path: Path) -> dict[str, list[str]]:
    """Returns map of `stem -> [bundle_path,...]` for every Movie/* USM in the cab index."""
    out: dict[str, list[str]] = {}
    if not path.exists():
        return out
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            bundle = entry.get("path")
            if not bundle:
                continue
            for cont in entry.get("cont", []) or []:
                if not cont:
                    continue
                m = USM_RE.search(cont)
                if not m:
                    continue
                stem = m.group("stem")
                if stem.lower().startswith("cutin_"):
                    continue
                out.setdefault(stem, []).append(bundle)
    return out


def load_device_bundle_paths() -> dict[str, list[str]]:
    """TSV format: <bundle_rel>\t<Movie/Category/charName_prefix>."""
    out: dict[str, list[str]] = {}
    if not DEVICE_BUNDLE_TSV.exists():
        return out
    with DEVICE_BUNDLE_TSV.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\r\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            rel, hint = parts[0], parts[1]
            out.setdefault(hint, []).append(rel)
    return out


def load_existing_mp4_paths() -> dict[str, Path]:
    """Map of stem -> public mp4 path that exists (and has .validated.json)."""
    out: dict[str, Path] = {}
    for d in (SPECIALSKILL_DIR, ANNOUNCE_DIR, LOTTERY_DIR, PROMOTION_DIR):
        if not d.exists():
            continue
        for mp4 in d.rglob("*.mp4"):
            out.setdefault(mp4.stem, mp4)
    return out


def fmt_web_url(movie_path: str | None, stem: str | None, category: str) -> str | None:
    if not movie_path:
        return None
    norm = movie_path.replace("\\", "/").strip("/")
    if not norm.lower().endswith(".usm"):
        return None
    web = norm[:-4] + ".mp4"
    return f"/{web}"


def special_skill_flat_url(stem: str | None) -> str | None:
    # Frontend looks up `/Movie/SpecialSkill/<stem>.mp4` (flat); see
    # specialSkillMoviePathFor() in components/summon-simulator.tsx.
    if not stem:
        return None
    return f"/Movie/SpecialSkill/{stem}.mp4"


def bless_skill_flat_url(stem: str | None) -> str | None:
    if not stem:
        return None
    return f"/Movie/BlessSkill/{stem}.mp4"


def category_for(movie_path: str | None) -> str:
    if not movie_path:
        return "unknown"
    p = movie_path.lower()
    if "/specialskill/" in p:
        return "SpecialSkill"
    if "/blessskill/" in p:
        return "BlessSkill"
    if "/announce/" in p:
        return "Announce"
    if "/lottery/" in p:
        return "Lottery"
    return "unknown"


def build_catalog() -> tuple[list[dict], dict]:
    data = load_summon_data()
    cab_hits: dict[str, list[str]] = {}
    for ci in CAB_INDEXES:
        for stem, bundles in load_cab_index_movie_hits(ci).items():
            cab_hits.setdefault(stem, [])
            for b in bundles:
                if b not in cab_hits[stem]:
                    cab_hits[stem].append(b)

    device_hits = load_device_bundle_paths()
    existing_mp4 = load_existing_mp4_paths()

    catalog: list[dict] = []
    by_path: dict[str, dict] = {}

    pc_msgs = data.get("pc_lottery_messages", {}) or {}
    for pc_id, msg in pc_msgs.items():
        mp = normalise(msg.get("movie_path"))
        if not mp:
            continue
        stem = stem_of(mp)
        cat = category_for(mp)
        entry = by_path.get(mp.lower())
        if entry is None:
            entry = {
                "movie_path": mp,
                "stem": stem,
                "category": cat,
                "master_pc_id": int(pc_id) if pc_id.isdigit() else msg.get("master_pc_id"),
                "character_name": None,
                "release_label": msg.get("release_label"),
                "logical_movie_path": mp,
                "cdn_url": None,
                "raw_local_path": None,
                "raw_local_exists": False,
                "converted_mp4": None,
                "converted_mp4_exists": False,
                "web_url": (special_skill_flat_url(stem) if cat == "SpecialSkill" else
                            bless_skill_flat_url(stem) if cat == "BlessSkill" else
                            fmt_web_url(mp, stem, cat)),
                "source_table": ["pc_lottery_messages"],
                "bundle_paths": cab_hits.get(stem, []),
                "device_bundle_paths": [],
                "status": "missing",
                "notes": None,
            }
            by_path[mp.lower()] = entry
            catalog.append(entry)
        else:
            if msg.get("release_label") and not entry["release_label"]:
                entry["release_label"] = msg["release_label"]
            if "pc_lottery_messages" not in entry["source_table"]:
                entry["source_table"].append("pc_lottery_messages")

    banners = data.get("banners", []) or []
    for banner in banners:
        mp = normalise(banner.get("movie_path"))
        if not mp:
            continue
        stem = stem_of(mp)
        cat = category_for(mp)
        entry = by_path.get(mp.lower())
        if entry is None:
            entry = {
                "movie_path": mp,
                "stem": stem,
                "category": cat,
                "master_pc_id": None,
                "character_name": None,
                "release_label": banner.get("release_label"),
                "logical_movie_path": mp,
                "cdn_url": None,
                "raw_local_path": None,
                "raw_local_exists": False,
                "converted_mp4": None,
                "converted_mp4_exists": False,
                "web_url": fmt_web_url(mp, stem, cat),
                "source_table": ["banner"],
                "bundle_paths": cab_hits.get(stem, []),
                "device_bundle_paths": [],
                "status": "missing",
                "notes": None,
            }
            by_path[mp.lower()] = entry
            catalog.append(entry)
        else:
            if "banner" not in entry["source_table"]:
                entry["source_table"].append("banner")

    # Main lottery pattern movies (from public/Movie/Lottery/_lottery_movies.json)
    if LOTTERY_MOVIES_JSON.exists():
        try:
            lottery_index = json.loads(LOTTERY_MOVIES_JSON.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            lottery_index = {}
        for name, web in lottery_index.items():
            mp = f"Movie/Lottery/{name}.usm"
            if mp.lower() in by_path:
                continue
            entry = {
                "movie_path": mp,
                "stem": name,
                "category": "Lottery",
                "master_pc_id": None,
                "character_name": None,
                "release_label": None,
                "logical_movie_path": mp,
                "cdn_url": None,
                "raw_local_path": None,
                "raw_local_exists": False,
                "converted_mp4": None,
                "converted_mp4_exists": False,
                "web_url": web,
                "source_table": ["_lottery_movies.json"],
                "bundle_paths": cab_hits.get(name, []),
                "device_bundle_paths": [],
                "status": "missing",
                "notes": "main lottery pattern movie",
            }
            by_path[mp.lower()] = entry
            catalog.append(entry)

    # Fill in device bundle hints (key is the regex hit prefix; cross-reference by stem)
    for stem_prefix, bundles in device_hits.items():
        # stem_prefix looks like "Movie/SpecialSkill/BenimaruDefault_Battle_SpecialSkill" or shorter
        norm = stem_prefix.strip("/")
        # Try to match each catalog entry by stem prefix substring
        for entry in catalog:
            if not entry["stem"]:
                continue
            if entry["stem"] in norm or norm.endswith(f"/{entry['stem']}"):
                for b in bundles:
                    if b not in entry["device_bundle_paths"]:
                        entry["device_bundle_paths"].append(b)

    # Finalise status + existing MP4
    for entry in catalog:
        stem = entry["stem"]
        cat = entry["category"]
        entry["validated"] = False
        if cat == "SpecialSkill":
            # flat: /Movie/SpecialSkill/<stem>.mp4
            mp4 = SPECIALSKILL_DIR / f"{stem}.mp4"
        elif cat == "BlessSkill":
            mp4 = PUBLIC / "Movie" / "BlessSkill" / f"{stem}.mp4"
        else:
            web = entry.get("web_url") or ""
            mp4 = PUBLIC / web.lstrip("/") if web else None
        if mp4 and mp4.exists():
            entry["converted_mp4"] = str(mp4.relative_to(PROJECT_DIR)).replace("\\", "/")
            entry["converted_mp4_exists"] = True
            entry["status"] = "converted"
            validated_sidecar = mp4.with_name(f"{mp4.name}.validated.json")
            if validated_sidecar.exists():
                entry["validated"] = True
        elif entry["bundle_paths"]:
            entry["status"] = "downloadable"
        elif entry["device_bundle_paths"]:
            entry["status"] = "downloadable"
        else:
            entry["status"] = "missing"

    catalog.sort(key=lambda e: (e["category"], e["stem"] or ""))
    return catalog, summarise(catalog)


def summarise(catalog: list[dict]) -> dict:
    by_cat: dict[str, dict] = {}
    by_status: dict[str, int] = {}
    for e in catalog:
        cat = e["category"]
        st = e["status"]
        by_cat.setdefault(cat, {"total": 0, "by_status": {}})
        by_cat[cat]["total"] += 1
        by_cat[cat]["by_status"][st] = by_cat[cat]["by_status"].get(st, 0) + 1
        by_status[st] = by_status.get(st, 0) + 1
    return {
        "total": len(catalog),
        "by_category": by_cat,
        "by_status": by_status,
    }


def main() -> None:
    catalog, summary = build_catalog()
    OUT_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    OUT_CATALOG.write_text(json.dumps({
        "_meta": {
            "description": "Authoritative catalog of every USM movie referenced by the summon flow.",
            "sources": [
                "summon.generated.json -> pc_lottery_messages",
                "summon.generated.json -> banners",
                "public/Movie/Lottery/_lottery_movies.json",
                "_work/cab_index.jsonl (UnityPy scan of stage/Shared bundles)",
                "_work/cab_index_assetpack.jsonl (UnityPy scan of split_android_assetpack.apk)",
                "_work/blusestacks_scan/movie_bundle_paths.tsv (on-device UnityCache scan, if present)",
                "public/Movie/* (shipped MP4s + validated.json sidecars)",
            ],
            "schema": {
                "movie_path": "canonical USM path",
                "stem": "filename without extension",
                "category": "SpecialSkill | BlessSkill | Announce | Lottery | banner_override",
                "status": "missing | downloadable | downloaded | converted",
            },
        },
        "summary": summary,
        "entries": catalog,
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    OUT_SUMMARY.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT_CATALOG.relative_to(PROJECT_DIR)} ({len(catalog)} entries)")
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
