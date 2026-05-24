"""Focused data-presence + architectural-trace gates for CharacterAppear +
Result UI. NOT a pixel-level visual diff (the human still has to compare
screenshots to the reference videos for the final acceptance signoff).

What this DOES check, per the audit-rule list:
  - d2 / image2d placement or pivot: PcDetailCharaDisplaySetting present
  - PcDetailCharaDisplaySetting / offset_x_for_detail: manifest + settings
    populated for each named diag unit
  - ef_sageBg / ef_appear particle layer: data files present
  - root AnimatorController In / Appear / Default / Out missing: FSM JSON
    exists + In/Default/Out confirmed empty (no clip data to wire)
  - pptrCurveMapping sprite/material swap: 100% resolved (tex_hash + null +
    mat_props) for every rarity tier
  - URP bloom/postprocess approximation: accepted S3 (no presence check)
  - Browser limitation requiring prerender: documented exceptions
  - Result UI: extracted Bless sprite mapping covers the rarity_index for
    each diag rarity tier; thumbType dispatch wired

The script exits 1 if any gate fails; the user runs `pnpm dev` to do the
pixel-level visual comparison separately.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DIR = PROJECT_DIR / "lib" / "summon-ui" / "lottery_runtime_data"

# Diag units. Resolve each to its (manifest_kind, illustration_path,
# rarity_index) so we can check both CharacterAppear (illust + setting) and
# Result UI (sprite mapping by rarity_index) coverage.
DIAG_CHARACTER_APPEAR_UNITS = [
    # (label, master_pc_id, kind, ui_thumb.rarity_index for thumb sprite lookup)
    ("Dord R (DordDefault)", 230004, "bless", 3),
    ("Shion SR (ShionBefore)", 140014, "pc", 4),
    ("Shion SSR (ShionDefault)", 100003, "pc", 5),
    ("Elmesia URUltimate (ElmesiaHA2026)", 160661, "pc", 27),  # 5★ SpecialPlus = 20 + 7
]

# Result UI tests: one Chara + one Bless from each common rarity tier.
DIAG_RESULT_UI_UNITS = [
    ("Chara R", "Chara", 3),
    ("Chara SR", "Chara", 4),
    ("Chara SSR", "Chara", 5),
    ("Chara URUltimate", "Chara", 27),
    ("Chara Epic", "Chara", 36),
    ("Bless R", "Bless", 3),
    ("Bless SR", "Bless", 4),
    ("Bless SSR", "Bless", 5),
    ("Bless URUltimate", "Bless", 27),
    ("Bless Epic", "Bless", 36),
]


def gate_character_appear(failures: list[str]) -> None:
    print("=" * 80)
    print("Gate A — CharacterAppear data presence per diag unit")
    print("=" * 80)

    manifest = json.loads((RUNTIME_DIR / "character_appear_master_manifest.json").read_text(encoding="utf-8"))
    settings = json.loads((RUNTIME_DIR / "pcdetail_charadisplay_settings.json").read_text(encoding="utf-8"))
    pc_man = {r["master_pc_id"]: r for r in manifest.get("pc", [])}
    bless_man = {r["master_bless_pc_id"]: r for r in manifest.get("bless_pc", [])}
    pc_set = {s["master_pc_id"]: s for s in settings.get("settings_by_pc", [])}
    bless_set = {s["master_bless_pc_id"]: s for s in settings.get("settings_by_bless_pc", [])}

    for label, uid, kind, _idx in DIAG_CHARACTER_APPEAR_UNITS:
        m = (pc_man if kind == "pc" else bless_man).get(uid)
        s = (pc_set if kind == "pc" else bless_set).get(uid)
        ok = bool(m) and bool(s)
        print(f"  [{'OK' if ok else 'FAIL'}] {label}")
        if m:
            print(f"     illustration: {m.get('pc_detail_illustration_path')}")
            print(f"     offset_x_for_detail: {m.get('offset_x_for_detail')}")
        if s:
            print(f"     m_positionFullDetailIllust: {s.get('m_positionFullDetailIllust')}")
            print(f"     m_scaleFullDetailIllust: {s.get('m_scaleFullDetailIllust')}")
        if not ok:
            failures.append(f"{label}: missing CharacterAppear data ({kind}, id={uid})")


def gate_pptr_swaps(failures: list[str]) -> None:
    print()
    print("=" * 80)
    print("Gate B — pptrCurveMapping swap resolution per rarity tier")
    print("=" * 80)

    swaps = json.loads((RUNTIME_DIR / "character_appear_per_rarity_swaps.json").read_text(encoding="utf-8"))
    for r, body in (swaps.get("rarities") or {}).items():
        ss = body.get("swaps") or []
        total = len(ss)
        with_hash = sum(1 for s in ss if s.get("target_file_hash"))
        with_null = sum(1 for s in ss if s.get("resolved_as_null"))
        with_mat = sum(1 for s in ss if s.get("target_material_color") is not None or s.get("target_material_blend"))
        unk = total - with_hash - with_null - with_mat
        status = "OK" if unk == 0 else "FAIL"
        print(f"  [{status}] {r:<14} total={total} tex_hash={with_hash} null={with_null} mat_props={with_mat} unknown={unk}")
        if unk:
            failures.append(f"pptrCurveMapping rarity {r}: {unk} unresolved swap(s)")


def gate_animator(failures: list[str]) -> None:
    print()
    print("=" * 80)
    print("Gate C — UIRoot AnimatorController FSM extraction (stale-blocker check)")
    print("=" * 80)

    fsm_path = RUNTIME_DIR / "character_appear_uiroot_fsm.json"
    clips_path = RUNTIME_DIR / "character_appear_uiroot_indefaultout_clips.json"
    if not fsm_path.exists() or not clips_path.exists():
        failures.append("AnimatorController FSM / In-Default-Out extraction JSONs missing")
        print("  [FAIL] AnimatorController extraction files missing")
        return
    fsm = json.loads(fsm_path.read_text(encoding="utf-8"))
    clips = json.loads(clips_path.read_text(encoding="utf-8"))

    state_names = {s.get("name") for s in fsm.get("states", [])}
    required = {"In", "Default", "Out", "AppearR", "AppearSR", "AppearSSR", "AppearSSRUltimate", "AppearUREx", "AppearURUltimate"}
    missing = required - state_names
    if missing:
        failures.append(f"AnimatorController FSM missing states: {sorted(missing)}")
        print(f"  [FAIL] FSM missing states: {sorted(missing)}")
    else:
        print(f"  [OK] FSM has all required states ({len(state_names)} total)")

    for n in ("In", "Default", "Out"):
        d = clips.get(n)
        if not d:
            failures.append(f"In/Default/Out clip data missing for '{n}'")
            print(f"  [FAIL] clip '{n}' data missing")
            continue
        dense = d.get("dense_curves", 0)
        const = d.get("constant_curves", 0)
        streamed = d.get("streamed_size", 0)
        empty = (dense == 0 and const == 0 and streamed == 0)
        print(f"  [{'OK' if empty else 'NOTE'}] clip '{n}': dense={dense} const={const} streamed={streamed} {'(empty — no curve data to wire)' if empty else '(has curve data!)'}")
        if not empty:
            # Non-empty In/Default/Out means we have curves we're NOT wiring.
            # This isn't necessarily a failure — flag for review.
            failures.append(f"clip '{n}' has curve data ({dense} dense + {const} const + {streamed} streamed bytes) that the website doesn't wire yet")


def gate_result_ui_sprite_mapping(failures: list[str]) -> None:
    print()
    print("=" * 80)
    print("Gate D — Result UI sprite mapping coverage (Chara + Bless)")
    print("=" * 80)

    sm = json.loads((RUNTIME_DIR / "thumbreward_sprite_mappings.json").read_text(encoding="utf-8"))
    for label, variant, idx in DIAG_RESULT_UI_UNITS:
        base = (sm.get("base_sprite_by_rarity_index") or {}).get(variant, {}).get(str(idx))
        frame = (sm.get("frame_sprite_by_rarity_index") or {}).get(variant, {}).get(str(idx))
        ok = bool(base) and bool(frame)
        print(f"  [{'OK' if ok else 'FAIL'}] {label} (variant={variant} rarity_index={idx})")
        if base or frame:
            print(f"     base: {base}  frame: {frame}")
        if not ok:
            failures.append(f"{label}: sprite mapping missing for rarity_index={idx}")
    # Coverage stats
    star = sm.get("rarity_star_sprites") or []
    lb = sm.get("limit_break_star_sprites") or []
    print(f"  rarity_star_sprites: {star}")
    print(f"  limit_break_star_sprites: {lb}")


def gate_summon_data_thumb_type(failures: list[str]) -> None:
    print()
    print("=" * 80)
    print("Gate E — summon.generated.json thumb_type threading")
    print("=" * 80)

    data = json.loads((PROJECT_DIR / "summon.generated.json").read_text(encoding="utf-8"))
    chara = bless = unknown = 0
    sample_bless = None
    for b in data.get("banners", []):
        for lot in b.get("lotteries", []):
            for grp_id, buckets in (lot.get("rate_groups") or {}).items():
                for bk in buckets:
                    for c in (bk.get("characters") or []):
                        t = c.get("thumb_type")
                        if t == "Bless":
                            bless += 1
                            if sample_bless is None:
                                sample_bless = (c.get("name"), c.get("master_pc_id"), c.get("bless_element_icons"))
                        elif t == "Chara":
                            chara += 1
                        else:
                            unknown += 1
    print(f"  Chara: {chara}  Bless: {bless}  unknown: {unknown}")
    if sample_bless:
        print(f"  sample Bless: {sample_bless}")
    if bless == 0:
        failures.append("summon.generated.json contains NO Bless characters — generator may have regressed")
    if unknown > 0:
        failures.append(f"summon.generated.json contains {unknown} chars with no thumb_type — generator regression")


def main() -> int:
    failures: list[str] = []
    gate_character_appear(failures)
    gate_pptr_swaps(failures)
    gate_animator(failures)
    gate_result_ui_sprite_mapping(failures)
    gate_summon_data_thumb_type(failures)

    print()
    print("=" * 80)
    if failures:
        print(f"FOCUSED GATE FAILED — {len(failures)} issue(s):")
        for f in failures:
            print(f"  - {f}")
        print()
        print("Note: the human still needs to compare rendered output against the")
        print("reference videos in D:/video_compare/frames/ for the final visual")
        print("acceptance. This script only validates data-presence + architectural")
        print("trace; not pixel parity.")
        return 1
    print("FOCUSED GATE PASSED (data-presence + architectural trace).")
    print()
    print("Next: run `pnpm dev` and visually compare against:")
    print("  D:/video_compare/frames/nomovie_*.jpg  (CharacterAppear reference)")
    print("  Reference reels for Result UI (Chara + Bless mixed x10).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
