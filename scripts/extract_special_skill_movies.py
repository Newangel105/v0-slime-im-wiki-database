"""Decode every Movie/SpecialSkill/<charName>_Battle_SpecialSkill/<...>.usm
to mp4 for the website. Used by the summon reveal pipeline to play the
per-character acquisition movie (MasterPcLotteryMessage.MoviePath) on a 5★+
pull when CharacterAcquisitionElement.IsPlayMovie is true.

Reuses the verified CRI Mana decryption pipeline + key from
extract_summon_movies_from_emulator_cache.py. Data-driven: it scans the live
assetpack bundle index for every Movie/SpecialSkill USM and converts what it
finds — no hand-coded character list.

Usage:
    python extract_special_skill_movies.py [--cab-index <path>] [--force]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))
import extract_summon_movies_from_emulator_cache as E  # noqa: E402

# Cab indexes: both Shared (cab_index.jsonl) and assetpack
# (cab_index_assetpack.jsonl) ship SpecialSkill USMs. Each character has a
# main movie (<name>_Battle_SpecialSkill.usm.bytes) AND a Cutin_ variant; the
# gacha movie is always the non-Cutin file (MasterPcLotteryMessage.MoviePath
# resolves to that container).
DEFAULT_CAB_INDEXES = [
    Path(r"C:\Users\Angel105\Documents\cenas\_work\cab_index.jsonl"),
    Path(r"C:\Users\Angel105\Documents\cenas\_work\cab_index_assetpack.jsonl"),
]
OUT = PROJECT_DIR / "public" / "Movie" / "SpecialSkill"
MANIFEST = SCRIPT_DIR / "_special_skill_movies.json"
FFMPEG = PROJECT_DIR / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
KEY = E.parse_movie_key(E.DEFAULT_MOVIE_KEY, None, None)

USM_RE = re.compile(r"Movie/SpecialSkill/[^/]+/([^/]+)\.usm\.bytes$", re.IGNORECASE)


def parse_cab_index(path: Path):
    """Yields (bundle_path: Path, usm_container_name: str) for every
    SpecialSkill USM referenced by a bundle in the cab index."""
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            bundle_path = entry.get("path")
            if not bundle_path:
                continue
            for container in entry.get("cont", []) or []:
                # USM container paths are "Assets/AssetBundles/Movie/SpecialSkill/..."
                # use search() not match() because the prefix is not at position 0.
                m = USM_RE.search(container or "")
                if m:
                    yield Path(bundle_path), m.group(1), container


def extract_usm_from_bundle(bundle: Path, container: str, out_usm: Path) -> bool:
    """Extracts the raw USM payload from an asset bundle's TextAsset entry.
    Returns True on success."""
    import warnings
    warnings.filterwarnings("ignore")
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
    env = UnityPy.load(str(bundle))
    needle = container.lower()
    for obj in env.objects:
        if obj.type.name != "TextAsset":
            continue
        try:
            ext = obj.container or ""
            if needle and needle not in ext.lower():
                continue
            data = obj.read()
            # TextAsset.m_Script is a str with surrogateescape-encoded bytes.
            # Re-encode with utf-8 + surrogateescape to recover the raw payload.
            raw = data.m_Script.encode("utf-8", "surrogateescape")
            ci = raw.find(b"CRID")
            if ci < 0:
                continue
            out_usm.write_bytes(raw[ci:])
            return True
        except Exception:  # noqa: BLE001
            continue
    return False


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cab-index", type=Path, action="append",
                    help="cab index JSONL (repeatable). Defaults to both cab_index.jsonl + cab_index_assetpack.jsonl.")
    ap.add_argument("--include-cutin", action="store_true",
                    help="also extract Cutin_<name>_Battle_SpecialSkill.usm (default: skip, only MoviePath target)")
    ap.add_argument("--limit", type=int, default=None, help="only extract this many movies (debug)")
    ap.add_argument("--force", action="store_true", help="re-decode even if mp4 already exists")
    args = ap.parse_args()

    indexes = args.cab_index or DEFAULT_CAB_INDEXES
    for p in indexes:
        if not p.exists():
            sys.exit(f"cab index not found: {p}")
    if KEY is None:
        sys.exit("CRI key not configured; check DEFAULT_MOVIE_KEY in extract_summon_movies_from_emulator_cache.py")

    OUT.mkdir(parents=True, exist_ok=True)
    targets: list[tuple[Path, str, str]] = []
    for p in indexes:
        targets.extend(parse_cab_index(p))
    if not targets:
        sys.exit("no Movie/SpecialSkill USMs found in cab indexes")
    if not args.include_cutin:
        targets = [t for t in targets if not t[1].lower().startswith("cutin_")]
    # de-dupe by container name
    seen: dict[str, tuple[Path, str, str]] = {}
    for t in targets:
        seen.setdefault(t[1], t)
    targets = list(seen.values())
    if args.limit:
        targets = targets[: args.limit]
    print(f"{len(targets)} SpecialSkill USMs referenced (cutin={'yes' if args.include_cutin else 'no'})")

    manifest: dict[str, str] = {}
    ok = skip = fail = 0
    for bundle, name, container in targets:
        mp4 = OUT / f"{name}.mp4"
        manifest[name] = f"/Movie/SpecialSkill/{name}.mp4"
        if mp4.exists() and mp4.stat().st_size > 1000 and not args.force:
            skip += 1
            continue
        if not bundle.exists():
            print(f"MISSING BUNDLE  {bundle} (for {name})")
            fail += 1
            continue
        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            usm = tdp / f"{name}.usm"
            if not extract_usm_from_bundle(bundle, container, usm):
                print(f"NO CRID         {name}  in  {bundle}")
                fail += 1
                continue
            try:
                E.demux_usm(usm, tdp, KEY)
            except Exception as exc:  # noqa: BLE001
                print(f"DEMUX FAIL      {name}  :: {exc!r:.120}")
                fail += 1
                continue
            h264 = tdp / f"{name}.h264"
            if not h264.exists() or h264.stat().st_size < 500:
                print(f"NO VIDEO        {name}")
                fail += 1
                continue
            # mux h264 + (optional) hca audio into mp4 with ffmpeg
            audio = tdp / f"{name}.hca"
            audio_arg = ["-i", str(audio)] if audio.exists() else []
            map_audio = ["-c:a", "aac", "-b:a", "128k"] if audio.exists() else []
            ff_cmd = [
                str(FFMPEG), "-y",
                "-i", str(h264),
                *audio_arg,
                "-c:v", "copy",
                *map_audio,
                str(mp4),
            ]
            import subprocess
            r = subprocess.run(ff_cmd, capture_output=True)
            if r.returncode != 0 or not mp4.exists() or mp4.stat().st_size < 1000:
                print(f"FFMPEG FAIL     {name}  :: {r.stderr[-160:].decode(errors='replace')}")
                fail += 1
                continue
            ok += 1
            print(f"OK              {name}  ({mp4.stat().st_size // 1024} KB)")

    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(f"\ndone: ok={ok} skip={skip} fail={fail} (manifest -> {MANIFEST})")


if __name__ == "__main__":
    main()
