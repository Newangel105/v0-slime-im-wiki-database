"""Validate CharacterAppear runtime data freshness.

Fails (non-zero exit) if any "diagnostic" unit named below is missing from
either `character_appear_master_manifest.json` or
`pcdetail_charadisplay_settings.json`. This is a guard against silent
fallback to prefab defaults for known current units (B-A1 blocker in
SUMMON_REVEAL_STATUS.md).

Run as a pre-commit / CI check after any stage data refresh.

Adding a unit here = forcing the manifest + settings extractors to cover it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DIR = PROJECT_DIR / "lib" / "summon-ui" / "lottery_runtime_data"
MANIFEST_PATH = RUNTIME_DIR / "character_appear_master_manifest.json"
SETTINGS_PATH = RUNTIME_DIR / "pcdetail_charadisplay_settings.json"


# Test units: any current unit whose stage-gate must pass. Add new diag units
# here before refreshing data so the validation enforces coverage.
DIAG_UNITS: list[tuple[str, int, str, str]] = [
    # (label, id, kind ∈ {"pc","bless"}, illustration_path_substring)
    ("Dord R (DordDefault)", 230004, "bless", "DordDefault"),
    ("Shion SR (ShionBefore)", 140014, "pc", "ShionBefore"),
    ("Shion SSR (ShionDefault)", 100003, "pc", "ShionDefault"),
    ("Elmesia URUltimate (ElmesiaHA2026)", 160661, "pc", "ElmesiaHA2026"),
]


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    settings = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))

    pc_manifest = {r["master_pc_id"]: r for r in manifest.get("pc", [])}
    bless_manifest = {r["master_bless_pc_id"]: r for r in manifest.get("bless_pc", [])}
    pc_settings = {s["master_pc_id"]: s for s in settings.get("settings_by_pc", [])}
    bless_settings = {s["master_bless_pc_id"]: s for s in settings.get("settings_by_bless_pc", [])}

    failures: list[str] = []
    for label, uid, kind, path_substring in DIAG_UNITS:
        m = (pc_manifest if kind == "pc" else bless_manifest).get(uid)
        s = (pc_settings if kind == "pc" else bless_settings).get(uid)
        ok_m = m is not None
        ok_s = s is not None
        ok_path = bool(m and path_substring in (m.get("pc_detail_illustration_path") or ""))
        status = "OK" if (ok_m and ok_s and ok_path) else "FAIL"
        print(f"[{status}] {label} (id={uid}, kind={kind})")
        if not ok_m:
            failures.append(f"{label}: missing from {kind} manifest")
        if not ok_s:
            failures.append(f"{label}: missing from {kind} settings")
        if not ok_path:
            failures.append(f"{label}: pc_detail_illustration_path does not contain '{path_substring}'")
        if ok_m and ok_s and ok_path:
            print(f"  illustration: {m.get('pc_detail_illustration_path')}")
            print(f"  setting m_positionFullDetailIllust: {s.get('m_positionFullDetailIllust')}")
            print(f"  setting m_scaleFullDetailIllust: {s.get('m_scaleFullDetailIllust')}")
            print(f"  offset_x_for_detail: {m.get('offset_x_for_detail')}")

    print()
    print(f"manifest: {len(pc_manifest)} pc, {len(bless_manifest)} bless_pc")
    print(f"settings: {len(pc_settings)} settings_by_pc, {len(bless_settings)} settings_by_bless_pc")

    if failures:
        print()
        print("VALIDATION FAILED:")
        for f in failures:
            print(f"  - {f}")
        print()
        print("Refresh data sources:")
        print("  cd D:/Slime Isekai Memories Game Files/Slime_Extractor")
        print("  python generate_character_appear_manifest.py --base-dir C:/Users/Angel105/Documents/cenas/_work/stage")
        print("  cd C:/Users/Angel105/Documents/cenas/_work")
        print("  python extract_pcdetail_charadisplay_settings.py")
        return 1
    print()
    print("ALL DIAG UNITS PRESENT.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
