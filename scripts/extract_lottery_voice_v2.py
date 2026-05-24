"""Voice extraction v2 — handles the actual storage format used by Slime IM.

Each gacha voice is stored in a Unity AssetBundle as an AudioClip / AudioClipSource
under one of:
  Assets/AssetBundles/Sound/AudioClip/VOICE/sys/<char>/voice_sys_<char>_NNN_gacha.wav
  Assets/AssetBundles/Sound/AudioClipSource/VOICE/sys/<char>/voice_sys_<char>_NNN_gacha.asset

The earlier extract_lottery_voice.py assumed CRI ACB/AWB archives — wrong for
this game. We use UnityPy to read the AudioClip object directly and write the
PCM/Vorbis samples to a .wav file the browser can play.

Output: /public/Voice/Lottery/voice_<stem>.wav

Usage:
    python extract_lottery_voice_v2.py [--limit N] [--force]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DEFAULT_CAB_INDEXES = [
    Path(r"C:\Users\Angel105\Documents\cenas\_work\cab_index.jsonl"),
    Path(r"C:\Users\Angel105\Documents\cenas\_work\cab_index_assetpack.jsonl"),
]
OUT_DIR = PROJECT_DIR / "public" / "Voice" / "Lottery"
MANIFEST = PROJECT_DIR / "lib" / "summon-ui" / "lottery_runtime_data" / "lottery_voice_catalog.json"
SUMMON_DATA = PROJECT_DIR / "summon.generated.json"

# Match the actual container paths: Sound/AudioClip/VOICE/<root>/<char>/voice_*_gacha.wav
GACHA_RE = re.compile(
    r"Assets/AssetBundles/Sound/AudioClip/VOICE/(?P<root>[^/]+)/(?P<char>[^/]+)/(?P<stem>voice_[^/]+_gacha)\.wav$",
    re.IGNORECASE,
)


def parse_cab_indexes(paths: list[Path]):
    """Yields (bundle_path: Path, voice_stem: str, container: str)."""
    for path in paths:
        if not path.exists():
            continue
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
                    m = GACHA_RE.match(container or "")
                    if m:
                        yield Path(bundle_path), m.group("stem"), container


def collect_needed_stems() -> set[str]:
    """The set of voice stems the website actually wants — derived from
    summon.generated.json -> pc_lottery_messages[].voice_path. The frontend's
    candidate URL uses `/Voice/Lottery/voice_<stem>.ogg|wav` where <stem> is
    the part AFTER 'voice_' in the path (e.g. 'sys_benimaru_038_gacha')."""
    data = json.loads(SUMMON_DATA.read_text(encoding="utf-8"))
    out: set[str] = set()
    for msg in (data.get("pc_lottery_messages") or {}).values():
        vp = msg.get("voice_path") or ""
        m = re.search(r"voice_([^/]+)$", vp)
        if m:
            out.add("voice_" + m.group(1))
    return out


def extract_audio_clip(bundle: Path, container_needle: str, out_wav: Path) -> tuple[bool, str]:
    """Use UnityPy to read the AudioClip object whose container matches the
    needle, and write its samples to out_wav. Returns (success, error_str)."""
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
    try:
        env = UnityPy.load(str(bundle))
        needle = container_needle.lower()
        for obj in env.objects:
            if obj.type.name != "AudioClip":
                continue
            try:
                ext = (obj.container or "").lower()
                if needle and needle not in ext:
                    continue
                data = obj.read()
                # UnityPy gives a .samples dict mapping name → wav bytes.
                samples = getattr(data, "samples", None)
                if not samples:
                    return False, "AudioClip.samples empty"
                # First sample is the one we want.
                _, wav_bytes = next(iter(samples.items()))
                out_wav.parent.mkdir(parents=True, exist_ok=True)
                out_wav.write_bytes(wav_bytes)
                return True, ""
            except Exception as e:
                return False, f"AudioClip read err: {e!r}"[:200]
        return False, "no matching AudioClip in bundle"
    except Exception as e:
        return False, f"UnityPy.load err: {e!r}"[:200]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cab-index", type=Path, action="append", default=None)
    ap.add_argument("--limit", type=int, default=None, help="extract only first N (debug)")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    indexes = args.cab_index or DEFAULT_CAB_INDEXES
    needed_stems = collect_needed_stems()
    print(f"website needs {len(needed_stems)} voice stems")

    # Build (stem → first available bundle + container) map from cab indexes
    candidates: dict[str, tuple[Path, str]] = {}
    for bundle, stem, container in parse_cab_indexes(indexes):
        if stem not in candidates:  # first wins (assumes both indexes carry the same blob)
            candidates[stem] = (bundle, container)
    print(f"cab indexes carry {len(candidates)} gacha voices total")

    # Intersect with what the website needs
    intersect = sorted(needed_stems & set(candidates.keys()))
    missing_from_cab = sorted(needed_stems - set(candidates.keys()))
    print(f"  match: {len(intersect)}  | missing-from-cab: {len(missing_from_cab)}")
    if missing_from_cab:
        print(f"  first 5 missing: {missing_from_cab[:5]}")
    if args.limit:
        intersect = intersect[: args.limit]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog: dict[str, dict] = {}
    ok = skip = fail = 0
    for stem in intersect:
        bundle, container = candidates[stem]
        out_wav = OUT_DIR / f"{stem}.wav"
        if out_wav.exists() and out_wav.stat().st_size > 100 and not args.force:
            catalog[stem] = {"status": "exists", "wav": str(out_wav.relative_to(PROJECT_DIR)).replace("\\", "/")}
            skip += 1
            continue
        if not bundle.exists():
            catalog[stem] = {"status": "missing_bundle", "bundle": str(bundle)}
            fail += 1
            continue
        success, err = extract_audio_clip(bundle, stem, out_wav)
        if success and out_wav.exists() and out_wav.stat().st_size > 100:
            catalog[stem] = {
                "status": "extracted",
                "wav": str(out_wav.relative_to(PROJECT_DIR)).replace("\\", "/"),
                "size": out_wav.stat().st_size,
                "container": container,
            }
            ok += 1
            if ok % 25 == 0:
                print(f"  extracted {ok}/{len(intersect)}", flush=True)
        else:
            catalog[stem] = {"status": "fail", "err": err, "container": container}
            fail += 1

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        "_meta": "Gacha-voice extraction catalog. wav files in /public/Voice/Lottery/voice_<stem>.wav; frontend probes both .ogg and .wav.",
        "extracted": ok,
        "skipped_existing": skip,
        "failed": fail,
        "missing_from_cab": missing_from_cab,
        "entries": catalog,
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"\ndone: ok={ok} skip={skip} fail={fail}  (manifest -> {MANIFEST})")


if __name__ == "__main__":
    main()
