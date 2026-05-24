"""Extract every _gacha voice clip referenced by MasterPcLotteryMessage.VoicePath
to /public/Voice/Lottery/ as ogg + wav. Used by the summon reveal pipeline to
play the per-character voice line on the UILotteryTextAnnounce stage.

Pipeline:
  1. Scan the cab index for Sound/AudioClip/VOICE/<char>/voice_<char>_<NNN>_gacha.wav
     entries (the actual audio ships inside CRI ACB/AWB pairs in the bundle).
  2. Extract the ACB + AWB blobs to a temp dir.
  3. Decode each ACB cue to .wav via vgmstream-cli (separate install — get it
     from https://vgmstream.org/ and place vgmstream-cli.exe on PATH).
  4. Transcode the decoded .wav to .ogg via ffmpeg for browser playback.

Usage:
    python extract_lottery_voice.py [--cab-index <path>] [--vgmstream <path>] [--force]

If vgmstream-cli is not available the script still emits the wav (suitable for
HTMLAudioElement) so the browser can play the uncompressed file directly.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DEFAULT_CAB_INDEX = Path(r"C:\Users\Angel105\Documents\cenas\_work\cab_index.jsonl")
OUT = PROJECT_DIR / "public" / "Voice" / "Lottery"
MANIFEST = SCRIPT_DIR / "_lottery_voice.json"
FFMPEG = PROJECT_DIR / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

GACHA_RE = re.compile(r"Sound/AudioClip/VOICE/[^/]+/(voice_[^/]+_gacha)\.wav$", re.IGNORECASE)


def parse_cab_index(path: Path):
    """Yields (bundle_path: Path, voice_stem: str, container: str) for every
    _gacha voice file referenced in the cab index."""
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
                    yield Path(bundle_path), m.group(1), container


def extract_acb_awb(bundle: Path, out_dir: Path, voice_stem: str) -> tuple[Path | None, Path | None]:
    """Extract ACB + AWB pair from a Sound bundle (TextAsset blobs in the
    Unity bundle). Returns (acb_path, awb_path) or (None, None) if not found."""
    import warnings
    warnings.filterwarnings("ignore")
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
    env = UnityPy.load(str(bundle))
    acb_path = awb_path = None
    needle = voice_stem.lower()
    for obj in env.objects:
        if obj.type.name != "TextAsset":
            continue
        try:
            container = obj.container or ""
            if needle and needle not in container.lower():
                continue
            data = obj.read()
            raw = bytes(data.script) if hasattr(data, "script") else bytes(data.m_Script)
            name = getattr(data, "m_Name", "") or container.split("/")[-1]
            if name.lower().endswith(".acb"):
                acb_path = out_dir / name
                acb_path.write_bytes(raw)
            elif name.lower().endswith(".awb"):
                awb_path = out_dir / name
                awb_path.write_bytes(raw)
        except Exception:  # noqa: BLE001
            continue
    return acb_path, awb_path


def decode_with_vgmstream(vgmstream: Path, acb: Path, awb: Path | None, out_dir: Path,
                          target_stem: str) -> list[Path]:
    """Decode the ACB cue(s) to .wav. vgmstream extracts each subsong; we keep
    the one matching target_stem."""
    cmd = [str(vgmstream), "-S", "0", "-o", str(out_dir / "?n.wav"), str(acb)]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print(f"VGMSTREAM FAIL  {target_stem}  :: {r.stderr[-160:].decode(errors='replace')}")
        return []
    out = []
    for p in out_dir.glob("*.wav"):
        if target_stem.lower() in p.stem.lower():
            out.append(p)
    return out or list(out_dir.glob("*.wav"))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cab-index", type=Path, default=DEFAULT_CAB_INDEX)
    ap.add_argument("--vgmstream", type=Path, default=Path("vgmstream-cli.exe"),
                    help="path to vgmstream-cli executable")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not args.cab_index.exists():
        sys.exit(f"cab index not found: {args.cab_index}")
    vgmstream = args.vgmstream if args.vgmstream.exists() else shutil.which(str(args.vgmstream))
    if vgmstream:
        vgmstream = Path(vgmstream)
    has_ffmpeg = FFMPEG.exists()

    OUT.mkdir(parents=True, exist_ok=True)
    targets = list(parse_cab_index(args.cab_index))
    if not targets:
        sys.exit("no _gacha voice files referenced in cab index")
    # de-dupe by voice stem
    by_stem: dict[str, tuple[Path, str]] = {}
    for bundle, stem, container in targets:
        by_stem.setdefault(stem, (bundle, container))
    print(f"{len(by_stem)} _gacha voice clips found")

    manifest: dict[str, dict[str, str | None]] = {}
    ok = skip = fail = 0
    for stem, (bundle, container) in by_stem.items():
        wav_out = OUT / f"{stem}.wav"
        ogg_out = OUT / f"{stem}.ogg"
        manifest[stem] = {"wav": f"/Voice/Lottery/{stem}.wav", "ogg": f"/Voice/Lottery/{stem}.ogg" if has_ffmpeg else None}
        if wav_out.exists() and wav_out.stat().st_size > 1000 and not args.force:
            skip += 1
            continue
        if not bundle.exists():
            print(f"MISSING BUNDLE  {bundle}  (for {stem})")
            fail += 1
            continue
        if not vgmstream:
            print(f"NO VGMSTREAM    {stem}  (install vgmstream-cli + retry)")
            fail += 1
            continue
        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            acb, awb = extract_acb_awb(bundle, tdp, stem)
            if not acb:
                print(f"NO ACB          {stem}  in  {bundle}")
                fail += 1
                continue
            wavs = decode_with_vgmstream(vgmstream, acb, awb, tdp, stem)
            if not wavs:
                fail += 1
                continue
            shutil.copy2(wavs[0], wav_out)
            if has_ffmpeg:
                r = subprocess.run([str(FFMPEG), "-y", "-i", str(wav_out), "-c:a", "libvorbis", "-q:a", "4", str(ogg_out)],
                                   capture_output=True)
                if r.returncode != 0:
                    print(f"FFMPEG FAIL     {stem}  :: {r.stderr[-160:].decode(errors='replace')}")
            ok += 1
            print(f"OK              {stem}  ({wav_out.stat().st_size // 1024} KB)")

    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(f"\ndone: ok={ok} skip={skip} fail={fail} (manifest -> {MANIFEST})")


if __name__ == "__main__":
    main()
