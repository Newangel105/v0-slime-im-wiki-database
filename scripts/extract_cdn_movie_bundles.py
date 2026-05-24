"""Extract every Movie/(SpecialSkill|BlessSkill|Announce|Lottery) USM from
the CDN-downloaded bundle pool, demux with the verified CRI key, and emit
web-ready MP4s with imageio-ffmpeg.

Reuses `extract_summon_movies_from_emulator_cache.demux_usm` for the USM
demux + decryption, then ffmpeg-muxes h264 + hca into mp4.

Inputs:
  _work/cdn_bundles_index.jsonl  (one line per downloaded bundle with `cont` list)
Outputs:
  public/Movie/SpecialSkill/<stem>.mp4   (flat, matches frontend resolver)
  public/Movie/BlessSkill/<stem>.mp4     (flat, parallel convention)
  public/Movie/Announce/<group>/<stem>.mp4
  public/Movie/Lottery/<stem>.mp4
  plus `.mp4.validated.json` sidecars
  _work/cdn_movie_extraction.log
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))
import extract_summon_movies_from_emulator_cache as E  # noqa: E402

INDEX = PROJECT / "_work" / "cdn_bundles_index.jsonl"
PUBLIC = PROJECT / "public"
LOG = PROJECT / "_work" / "cdn_movie_extraction.log"
FFMPEG = Path(r"C:/Users/Angel105/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe")
KEY = E.parse_movie_key(E.DEFAULT_MOVIE_KEY, None, None)

USM_RE = re.compile(
    r"Assets/AssetBundles/Movie/(?P<cat>SpecialSkill|BlessSkill|Announce|Lottery)/(?P<group>[^/]+)/(?P<name>[A-Za-z0-9_]+)\.usm\.bytes$",
    re.IGNORECASE,
)


def extract_usm_from_bundle(bundle: Path, container: str, out_usm: Path) -> bool:
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
            raw = data.m_Script.encode("utf-8", "surrogateescape")
            ci = raw.find(b"CRID")
            if ci < 0:
                continue
            out_usm.write_bytes(raw[ci:])
            return True
        except Exception:  # noqa: BLE001
            continue
    return False


def output_mp4_path(cat: str, group: str, name: str) -> Path:
    if cat.lower() == "specialskill":
        return PUBLIC / "Movie" / "SpecialSkill" / f"{name}.mp4"
    if cat.lower() == "blessskill":
        return PUBLIC / "Movie" / "BlessSkill" / f"{name}.mp4"
    if cat.lower() == "announce":
        return PUBLIC / "Movie" / "Announce" / group / f"{name}.mp4"
    return PUBLIC / "Movie" / "Lottery" / f"{name}.mp4"


def write_validation_sidecar(mp4: Path, movie_path: str, bundle: Path, bundle_url: str | None) -> None:
    sidecar = mp4.with_name(f"{mp4.name}.validated.json")
    sidecar.write_text(json.dumps({
        "validated": True,
        "movie_path": movie_path,
        "source_kind": "cdn_bundle_usm",
        "source_path": str(bundle),
        "source_size": bundle.stat().st_size if bundle.exists() else None,
        "bundle_url": bundle_url,
        "movie_key_supplied": True,
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    if not INDEX.exists():
        sys.exit(f"missing: {INDEX}")
    log_fh = LOG.open("w", encoding="utf-8")
    ok = skip = fail = 0
    seen_stems: set[str] = set()
    with INDEX.open("r", encoding="utf-8") as fh:
        entries = [json.loads(line) for line in fh if line.strip()]
    movie_entries = [e for e in entries if e.get("is_movie")]
    print(f"{len(movie_entries)} movie bundles in cdn_bundles_index.jsonl")

    for entry in movie_entries:
        bundle = Path(entry["path"])
        bundle_url = entry.get("url")
        for container in entry.get("cont", []) or []:
            m = USM_RE.search(container or "")
            if not m:
                continue
            cat, group, name = m["cat"], m["group"], m["name"]
            # Skip the Cutin_ variant — gacha movie is the non-Cutin one.
            if name.lower().startswith("cutin_"):
                continue
            stem_key = f"{cat}/{name}".lower()
            if stem_key in seen_stems:
                continue
            seen_stems.add(stem_key)

            mp4 = output_mp4_path(cat, group, name)
            movie_path = f"Movie/{cat}/{group}/{name}.usm"

            if mp4.exists() and mp4.stat().st_size > 1000:
                log_fh.write(f"SKIP\t{movie_path}\t{mp4.name}\talready_present\n")
                skip += 1
                continue

            mp4.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory() as td:
                tdp = Path(td)
                usm = tdp / f"{name}.usm"
                if not extract_usm_from_bundle(bundle, container, usm):
                    log_fh.write(f"FAIL\t{movie_path}\textract_usm_from_bundle failed\n")
                    fail += 1
                    continue
                try:
                    E.demux_usm(usm, tdp, KEY)
                except Exception as exc:  # noqa: BLE001
                    log_fh.write(f"FAIL\t{movie_path}\tdemux_usm: {exc!r}\n")
                    fail += 1
                    continue
                h264 = tdp / f"{name}.h264"
                if not h264.exists() or h264.stat().st_size < 500:
                    log_fh.write(f"FAIL\t{movie_path}\tno_h264_after_demux\n")
                    fail += 1
                    continue
                hca = tdp / f"{name}.hca"
                audio_args = ["-i", str(hca)] if hca.exists() else []
                audio_map = ["-c:a", "aac", "-b:a", "128k"] if hca.exists() else []
                ff_cmd = [str(FFMPEG), "-y", "-i", str(h264), *audio_args, "-c:v", "copy", *audio_map, str(mp4)]
                r = subprocess.run(ff_cmd, capture_output=True)
                if r.returncode != 0 or not mp4.exists() or mp4.stat().st_size < 1000:
                    log_fh.write(f"FAIL\t{movie_path}\tffmpeg: {r.stderr[-160:].decode(errors='replace')}\n")
                    fail += 1
                    continue
            write_validation_sidecar(mp4, movie_path, bundle, bundle_url)
            log_fh.write(f"OK\t{movie_path}\t{mp4}\t{mp4.stat().st_size}\n")
            print(f"OK   {cat:13s} {name}  ->  {mp4.relative_to(PROJECT)}  ({mp4.stat().st_size//1024} KB)")
            ok += 1

    log_fh.close()
    print(f"\nDone: ok={ok} skip={skip} fail={fail}")


if __name__ == "__main__":
    main()
