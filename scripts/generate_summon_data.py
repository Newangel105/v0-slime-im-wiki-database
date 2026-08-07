from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import warnings
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import UnityPy
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit("UnityPy is required to extract summon master tables.") from exc

UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
warnings.filterwarnings("ignore", category=DeprecationWarning)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
WORKSPACE_DIR = PROJECT_DIR.parents[1]
EXTRACTOR_DIR = WORKSPACE_DIR / "Slime_Extractor"
DEFAULT_STAGE_ROOT = Path(r"C:\Users\Angel105\Documents\cenas\_work\stage")
DEFAULT_CACHE_DIR = PROJECT_DIR / "_work" / "summon_textassets"
DEFAULT_OUTPUT = PROJECT_DIR / "summon.generated.json"
PC_WIKI_PATH = PROJECT_DIR / "pc_wiki.generated.json"

sys.path.insert(0, str(EXTRACTOR_DIR))
from generate_pc_wiki_json import load_selected_records  # noqa: E402


FIELD_SPECS: dict[str, list[tuple[str, int, str]]] = {
    "MasterOgcLottery": [
        ("master_ogc_lottery_id", 0, "long"),
        ("master_ogc_lottery_shop_id", 1, "long"),
        ("master_ogc_lottery_rate_group_id", 2, "int"),
        ("replace_rate_group_step", 3, "string"),
        ("replace_master_ogc_lottery_rate_group_id", 4, "string"),
        ("reward_count", 5, "int"),
        ("consume_type", 6, "int"),
        ("consume_item_id", 7, "long"),
        ("gem_cost", 8, "int"),
        ("ticket_cost", 9, "int"),
        ("limit_draw_count", 10, "int"),
        ("limit_daily_draw_count", 11, "int"),
        ("point", 12, "int"),
        ("release_label", 13, "string"),
    ],
    "MasterOgcLotteryRate": [
        ("master_ogc_lottery_rate_id", 0, "long"),
        ("master_ogc_lottery_rate_group_id", 1, "int"),
        ("master_ogc_lottery_reward_group_id", 2, "int"),
        ("rate", 3, "int"),
        ("show_rarity", 4, "int"),
        ("release_label", 5, "string"),
    ],
    "MasterOgcLotteryReward": [
        ("master_ogc_lottery_reward_id", 0, "long"),
        ("master_ogc_lottery_reward_group_id", 1, "int"),
        ("lottery_reward_type", 2, "int"),
        ("lottery_reward_id", 3, "long"),
        ("release_label", 4, "string"),
    ],
    "MasterOgcLotteryShop": [
        ("master_ogc_lottery_shop_id", 0, "long"),
        ("sort", 1, "int"),
        ("display_type", 2, "int"),
        ("display_time", 3, "int"),
        ("banner_path", 5, "string"),
        ("logo_path", 6, "string"),
        ("info_panel_path", 7, "string"),
        ("movie_path", 8, "string"),
        ("character_details_ids_raw", 14, "string"),
        ("release_label", 17, "string"),
        ("master_ogc_lottery_shop_character_details_id", 18, "long"),
        ("master_ogc_lottery_animation_group_group_id", 20, "long"),
        ("pickup_animation_character_details_ids", 21, "string"),
        ("master_lottery_common_point_item_id", 22, "long"),
    ],
    "MasterOgcLotteryShopCharacterDetails": [
        ("master_ogc_lottery_shop_character_details_id", 0, "long"),
        ("character_details_ids", 1, "string"),
        ("release_label", 2, "string"),
    ],
    "MasterLotteryTopImage": [
        ("master_lottery_top_image_id", 0, "long"),
        ("master_ogc_lottery_shop_id", 1, "long"),
        ("image_type", 2, "int"),
        ("image_path", 3, "string"),
        ("sort", 4, "int"),
        ("release_label", 5, "string"),
    ],
    "MasterOgcLotteryAnimation": [
        ("master_ogc_lottery_animation_id", 0, "long"),
        ("animation_type", 1, "int"),
        ("step", 2, "int"),
        ("movie_path", 3, "string"),
        ("bgm_sound_type", 4, "int"),
        ("bgm_volume_percent", 5, "int"),
        ("bgm_action_type", 6, "int"),
        ("release_label", 7, "string"),
    ],
    "MasterOgcLotteryAnimationGroup": [
        ("master_ogc_lottery_animation_group_id", 0, "long"),
        ("master_ogc_lottery_animation_group_group_id", 1, "long"),
        ("selection_method_type", 2, "int"),
        ("rate", 3, "int"),
        ("animation_type", 4, "int"),
        ("release_label", 5, "string"),
        ("ignore_skip_first_time", 6, "bool"),
        ("cloak_performance_skip", 7, "bool"),
    ],
    "MasterLotteryPointItem": [
        ("master_lottery_point_item_id", 0, "long"),
        ("master_ogc_lottery_shop_id", 1, "long"),
        ("max_limit", 2, "int"),
        ("exchange_rate", 3, "int"),
        ("exchange_master_reward_group_id", 4, "long"),
        ("exchange_release_label", 5, "string"),
        ("release_label", 6, "string"),
    ],
    "MasterLotteryPointSelection": [
        ("master_lottery_point_selection_id", 0, "long"),
        ("master_ogc_lottery_shop_id", 1, "long"),
        ("selection_point", 2, "int"),
        ("master_reward_group_id", 3, "long"),
        ("release_label", 4, "string"),
        ("limit_count", 5, "int"),
    ],
    "MasterReward": [
        # NOTE: field 6 (release_label, string) is intentionally omitted. For
        # MasterReward some records carry a string offset that the generic
        # selected-container reader resolves out of bounds ("invalid string
        # end"), which fails the whole table. The Bazaar/Trade resolution only
        # needs the int/long reward fields below, so dropping the string makes
        # the 38k-row table decode cleanly.
        # Fields are 32-bit; verified against known Bazaar tiers:
        #   group 802102405001 -> qty 100, ...05002 -> 50, ...05003 -> 20,
        #   ...05004 -> 10, character group -> 1. quantity is vtable field 5
        #   (field 4 is receive_type), reward_item_id is the int at field 3.
        ("master_reward_id", 0, "long"),
        ("master_reward_group_id", 1, "long"),
        ("reward_type", 2, "int"),
        ("reward_item_id", 3, "int"),
        ("receive_type", 4, "int"),
        ("quantity", 5, "int"),
    ],
    "MasterLotteryTicket": [
        ("master_lottery_ticket_id", 0, "long"),
        ("rarity", 3, "int"),
        ("gold", 4, "int"),
        ("icon_path", 5, "string"),
        ("max_limit", 6, "int"),
        ("release_label", 7, "string"),
        ("is_pickup", 8, "bool"),
    ],
    "MasterExchangeItem": [
        ("master_exchange_item_id", 0, "long"),
        ("name", 1, "string"),
        ("description", 2, "string"),
        ("rarity", 3, "int"),
        ("icon_path", 6, "string"),
        ("max_limit", 7, "int"),
        ("release_label", 8, "string"),
    ],
    "MasterPc": [
        ("master_pc_id", 0, "long"),
        ("master_pc_arousal_group_id", 5, "int"),
        ("base_rarity", 6, "int"),
        ("master_arousal_type", 61, "int"),
        ("master_enhanced_statusboard_id", 71, "long"),
    ],
    "MasterPcArousal": [
        ("master_pc_arousal_id", 0, "long"),
        ("master_pc_arousal_group_id", 1, "int"),
        ("base_rarity", 2, "int"),
        ("arousal_count", 3, "int"),
        ("display_rarity", 4, "int"),
        ("display_arousal_count", 5, "int"),
        ("display_arousal_second_count", 6, "int"),
        ("max_level", 7, "int"),
        ("release_label", 12, "string"),
    ],
    # FlatBuffer field indices recovered from arm64 libil2cpp.so getters
    # (Table.__offset = 4 + 2*index): id=0, master_pc_id=1, voice_path=3,
    # movie_path=4, release_label=5. LotteryMessage is localized through
    # GlobalL10NMasterContainer.Localize and is joined from L10NPcLotteryMessage
    # below; it is not stored as a direct string field in this table.
    "MasterPcLotteryMessage": [
        ("master_pc_lottery_message_id", 0, "long"),
        ("master_pc_id", 1, "long"),
        ("voice_path", 3, "string"),
        ("movie_path", 4, "string"),
        ("release_label", 5, "string"),
    ],
    "L10NPcLotteryMessage": [
        ("localization_target_id", 0, "long"),
        ("column_name", 1, "string"),
        ("text", 2, "string"),
    ],
    "MasterDefineValue": [
        ("master_define_value_id", 0, "long"),
        ("define_name", 1, "string"),
        ("value", 2, "long"),
        ("release_label", 3, "string"),
    ],
    "MasterDefineAsset": [
        ("master_define_asset_id", 0, "long"),
        ("define_name", 1, "string"),
        ("asset_path", 2, "string"),
        ("address", 3, "string"),
        ("release_label", 4, "string"),
    ],
}

OPTIONAL_TABLES: set[str] = {"MasterReward", "MasterPcLotteryMessage", "L10NPcLotteryMessage"}
TABLES = list(FIELD_SPECS)


def split_ids(value: Any) -> list[int]:
    if value is None:
        return []
    ids: list[int] = []
    for part in str(value).split("_"):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError:
            continue
    return ids


def clean_asset_path(path: str | None, extension: str = "png") -> str | None:
    if not path:
        return None
    normalized = path.replace("\\", "/").strip("/")
    if not normalized:
        return None
    if extension and "." not in Path(normalized).name:
        normalized = f"{normalized}.{extension.lstrip('.')}"
    return normalized


def web_sources_for_asset(path: str | None, extension: str = "png") -> list[str]:
    normalized = clean_asset_path(path, extension)
    if not normalized:
        return []
    if normalized.startswith("L10NAssets/"):
        return [f"/{normalized}"]
    if normalized.startswith(("Image/LotteryInfo/", "Image/Item/LotteryTicket/")):
        return [f"/L10NAssets/En/{normalized}", f"/{normalized}"]
    return [f"/{normalized}"]


def shop_sources(shop_id: int, name: str) -> list[str]:
    return web_sources_for_asset(f"Image/LotteryInfo/{shop_id}/{name}_{shop_id}")


# Banners that ship with no LotteryBgUnique_<id> asset of their own. The game
# either points the bg slot at a sibling shop's asset (revival / orphan banners)
# or uses a fixed event background (April Fool series).
#   - "shop:<id>" -> use LotteryBgUnique_<id> from that shop.
#   - "asset:<rel>" -> use that asset path directly under public/.
# Verified against on-disk assets in 2026-05-22 audit; do not remove without
# checking that the referenced asset still exists.
BACKGROUND_OVERRIDES: dict[int, str] = {
    500000933: "shop:500000936",   # Master Witch revival
    500000979: "asset:Image/Bg/bg_aprilfool_25/aprilfool",
    500000746: "asset:Image/Bg/bg_aprilfool_24/aprilfool",
    500000180: "asset:Image/Bg/bg_aprilfool_24/aprilfool",
    500000870: "shop:500000865",   # Emils / Dodomeki / Kokuyo orphan
    500000873: "shop:500000865",
    500000871: "shop:500000604",   # Izis / Kokuyo orphan
    500000872: "shop:500000604",
    500000288: "shop:500000604",   # was -> 500000872 which itself has no bg
    500000278: "shop:500000605",
    500000386: "shop:500000605",
    500000519: "shop:500000774",
    500000518: "shop:500000774",
    500000510: "shop:500000481",
    500000499: "shop:500000886",
    500000996: "shop:500000993",   # Azure Sea's Afterglow Part 2 -> Part 1's bg (same event)
    500001004: "shop:500000865",   # Three Demon Girls (ticket) reuses shop 865's bg (verified via /proc/fd)
}


def unique_background_sources(shop_id: int) -> list[str]:
    override = BACKGROUND_OVERRIDES.get(shop_id)
    if override:
        kind, _, value = override.partition(":")
        if kind == "shop":
            return web_sources_for_asset(
                f"Image/LotteryInfo/LotteryBg/unique/{value}/LotteryBgUnique_{value}"
            )
        if kind == "asset":
            return web_sources_for_asset(value)
    return web_sources_for_asset(f"Image/LotteryInfo/LotteryBg/unique/{shop_id}/LotteryBgUnique_{shop_id}")


def movie_info(path: str | None) -> dict[str, Any]:
    normalized = clean_asset_path(path, "")
    if not normalized:
        return {
            "path": None,
            "cache_key": None,
            "sources": [],
            "available": False,
        }
    playable = re.sub(r"\.usm$", ".mp4", normalized, flags=re.IGNORECASE)
    playable_web = f"/{playable}"
    playable_path = PROJECT_DIR / "public" / playable
    validation_path = playable_path.with_name(f"{playable_path.name}.validated.json")
    validated = False
    if playable_path.exists() and validation_path.exists():
        try:
            validated = bool(json.loads(validation_path.read_text(encoding="utf-8")).get("validated"))
        except (OSError, json.JSONDecodeError):
            validated = False
    return {
        "path": normalized,
        "cache_key": hashlib.md5(normalized.encode("utf-8")).hexdigest().upper(),
        "sources": [playable_web],
        "available": validated,
    }


def compact_lottery_ticket(ticket: dict[str, Any] | None, ticket_id: int) -> dict[str, Any] | None:
    if not ticket:
        return None
    icon_path = ticket.get("icon_path")
    resolved_icon_path = icon_path.replace("{0}", "L") if isinstance(icon_path, str) else icon_path
    return {
        "master_lottery_ticket_id": ticket_id,
        "rarity": ticket.get("rarity"),
        "gold": ticket.get("gold"),
        "icon_path": icon_path,
        "icon_sources": web_sources_for_asset(resolved_icon_path),
        "max_limit": ticket.get("max_limit"),
        "release_label": ticket.get("release_label"),
        "is_pickup": ticket.get("is_pickup"),
    }


def compact_exchange_item(item: dict[str, Any] | None, item_id: int) -> dict[str, Any] | None:
    if not item:
        return None
    icon_path = item.get("icon_path")
    resolved_icon_path = icon_path.replace("{0}", "L") if isinstance(icon_path, str) else icon_path
    return {
        "master_exchange_item_id": item_id,
        "name": item.get("name") or None,
        "description": item.get("description") or None,
        "rarity": item.get("rarity"),
        "icon_path": icon_path,
        "icon_sources": web_sources_for_asset(resolved_icon_path),
        "max_limit": item.get("max_limit"),
        "release_label": item.get("release_label"),
    }


def character_card_path(character: dict[str, Any] | None) -> str | None:
    if not character:
        return None
    for section_name in ("skills", "traits", "ex_abilities"):
        section = character.get(section_name)
        if not isinstance(section, list):
            continue
        for entry in section:
            if not isinstance(entry, dict):
                continue
            icon_path = entry.get("icon_path")
            if isinstance(icon_path, str) and "_CharaCard" in icon_path:
                return icon_path
    return None


def arousal_type_label(raw_value: Any) -> str:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        value = 0
    return {0: "Common", 1: "Special", 2: "SpecialPlus", 3: "Epic"}.get(value, f"Unknown({value})")


def rarity_sprite_index(base_rarity: int | None, display_rarity: int | None, arousal_type: int | None) -> int | None:
    rarity = int(display_rarity or base_rarity or 0)
    if rarity <= 0:
        return None
    try:
        arousal = int(arousal_type or 0)
    except (TypeError, ValueError):
        arousal = 0
    if arousal == 3:
        return 30 + rarity
    if arousal == 2:
        return 20 + rarity
    if arousal == 1:
        return 10 + rarity
    return rarity


def build_pc_ui_lookup(pc_rows: list[dict[str, Any]], arousal_rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    arousals_by_group: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in arousal_rows:
        group_id = int(row.get("master_pc_arousal_group_id") or 0)
        if group_id:
            arousals_by_group[group_id].append(row)

    lookup: dict[int, dict[str, Any]] = {}
    for pc in pc_rows:
        pc_id = int(pc.get("master_pc_id") or 0)
        group_id = int(pc.get("master_pc_arousal_group_id") or 0)
        max_arousal = None
        if group_id:
            rows = arousals_by_group.get(group_id, [])
            if rows:
                max_arousal = max(rows, key=lambda row: int(row.get("arousal_count") or 0))
        base_rarity = int(pc.get("base_rarity") or 0) or None
        display_rarity = int((max_arousal or {}).get("display_rarity") or base_rarity or 0) or None
        display_arousal_count = int((max_arousal or {}).get("display_arousal_count") or 0)
        display_second_count = int((max_arousal or {}).get("display_arousal_second_count") or 0)
        arousal_raw = int(pc.get("master_arousal_type") or 0)
        lookup[pc_id] = {
            "base_rarity": base_rarity,
            "display_rarity": display_rarity,
            "rarity_index": rarity_sprite_index(base_rarity, display_rarity, arousal_raw),
            "arousal_type": arousal_type_label(arousal_raw),
            "arousal_type_raw": arousal_raw,
            "limit_break_count": display_second_count or display_arousal_count,
            "max_level": (max_arousal or {}).get("max_level"),
            "master_pc_arousal_group_id": group_id or None,
            "master_enhanced_statusboard_id": pc.get("master_enhanced_statusboard_id") or None,
        }
    return lookup


def _detect_thumb_type(character: dict[str, Any], lottery_reward_type: int | None) -> str:
    """Map a character to XIUIThumbReward.ThumbType (dump.cs:517627).
    MasterRewardType.ToThumbType (dump.cs:296687) maps: 1→Item, 2→Chara, 3→Bless.
    When the per-row lottery_reward_type is unavailable, fall back to the
    illustration path prefix (Image/Character/Bless/... vs PC/...).
    """
    if lottery_reward_type == 3:
        return "Bless"
    if lottery_reward_type == 2:
        return "Chara"
    full = ((character or {}).get("images") or {}).get("full") or ""
    if isinstance(full, str) and full.startswith("Image/Character/Bless/"):
        return "Bless"
    return "Chara"


def compact_character(
    character: dict[str, Any] | None,
    character_id: int,
    pc_ui_by_id: dict[int, dict[str, Any]] | None = None,
    lottery_reward_type: int | None = None,
) -> dict[str, Any]:
    ui_thumb = (pc_ui_by_id or {}).get(character_id)
    if not character:
        return {
            "master_pc_id": character_id,
            "name": f"Character {character_id}",
            "affiliation_name": "",
            "rarity": None,
            "element": None,
            "attack_type": None,
            "character_role": None,
            "ultimate_type": None,
            "weapon_type": None,
            "tactics_type": None,
            "master_strategy_type_group_label": None,
            "master_character_tactics_type": None,
            "forces": [],
            "ui_thumb": ui_thumb,
            "thumb_type": "Bless" if lottery_reward_type == 3 else "Chara",
            "bless_element_icons": None,
            "images": {"icon": None, "full": None, "card": None},
        }

    images = dict(character.get("images") or {})
    images["card"] = character_card_path(character)
    compacted_ui_thumb = dict(ui_thumb or {})
    if compacted_ui_thumb and not compacted_ui_thumb.get("display_rarity") and images.get("card"):
        match = re.search(r"/([3-7])/", images["card"].replace("\\", "/"))
        if match:
            compacted_ui_thumb["display_rarity"] = int(match.group(1))

    thumb_type = _detect_thumb_type(character, lottery_reward_type)
    # `XIUIThumbReward.Bless` has TWO element icons (`IcElementBless` +
    # `IcElementBless2`). Bless characters in the wiki carry both via
    # `element` (primary) + `master_leader_skill_element_type_2` (secondary).
    # See generate_pc_wiki_json.py lines 3961-3963 — `element` falls back to
    # the secondary when the primary is "None", so we look at the BlessPc
    # record's secondary directly to keep them distinct.
    bless_element_icons: dict[str, str | None] | None = None
    if thumb_type == "Bless":
        secondary = character.get("master_leader_skill_element_type_2")
        if secondary in (None, "None", ""):
            secondary = None
        bless_element_icons = {
            "primary": character.get("element"),
            "secondary": secondary,
        }

    return {
        "master_pc_id": character_id,
        "name": character.get("name"),
        "affiliation_name": character.get("affiliation_name"),
        "rarity": character.get("rarity"),
        "element": character.get("element"),
        "attack_type": character.get("attack_type"),
        "character_role": character.get("character_role"),
        "ultimate_type": character.get("ultimate_type"),
        "weapon_type": character.get("weapon_type"),
        "tactics_type": character.get("tactics_type"),
        "master_strategy_type_group_label": character.get("master_strategy_type_group_label"),
        "master_character_tactics_type": character.get("master_character_tactics_type"),
        "forces": character.get("forces") or [],
        "ui_thumb": compacted_ui_thumb or None,
        # XIUIThumbReward dispatch hint — see SummonThumbType in lib/summon-data.ts.
        # Used by RuntimeThumbReward / FullArtRevealStage to choose the Bless
        # vs Chara variant of the per-card / per-charamodel render path.
        "thumb_type": thumb_type,
        "bless_element_icons": bless_element_icons,
        "images": images,
    }


def release_month(label: str | None) -> int | None:
    if not label:
        return None
    match = re.match(r"^(20\d{4})_", label)
    if not match:
        return None
    return int(match.group(1))


def table_asset_container(table_name: str) -> str:
    if table_name.startswith("L10N"):
        return f"Assets/AssetBundles/L10NMaster/En/{table_name}/{table_name}.bytes"
    return f"Assets/AssetBundles/Master/{table_name}/{table_name}.bytes"


def table_asset_name(table_name: str) -> bytes:
    return table_asset_container(table_name).encode("ascii")


def find_table_bundles(stage_root: Path, table_name: str) -> list[Path]:
    needle = table_asset_name(table_name)
    target_container = table_asset_container(table_name)
    candidates: list[Path] = []
    seen: set[Path] = set()

    for index_path in (stage_root.parent / "cab_index_assetpack.jsonl", stage_root.parent / "cab_index.jsonl"):
        if not index_path.exists():
            continue
        try:
            for line in index_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                if target_container not in line:
                    continue
                row = json.loads(line)
                path = Path(row.get("path") or "")
                if path.exists() and path not in seen:
                    seen.add(path)
                    candidates.append(path)
        except (OSError, json.JSONDecodeError):
            continue

    if candidates:
        return candidates

    search_names = [table_name]
    if table_name.startswith("Master"):
        search_names.append(table_name.removeprefix("Master"))

    for root_name in ("Shared", "assetpack"):
        root = stage_root / root_name
        if not root.exists():
            continue
        for search_name in search_names:
            try:
                raw = subprocess.check_output(
                    ["rg", "-a", "-l", "-m", "1", search_name, str(root)],
                    text=True,
                    errors="ignore",
                )
                for line in raw.splitlines():
                    if not line.strip():
                        continue
                    path = Path(line.strip())
                    if path not in seen:
                        seen.add(path)
                        candidates.append(path)
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass

    if candidates:
        return candidates

    for root_name in ("Shared", "assetpack"):
        root = stage_root / root_name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            try:
                data = path.read_bytes()
                if needle in data or any(name.encode("ascii") in data for name in search_names):
                    candidates.append(path)
            except OSError:
                continue
    return candidates


def extract_text_asset(bundle_path: Path, table_name: str, cache_dir: Path) -> Path | None:
    target_container = table_asset_container(table_name)
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as exc:
        print(f"[warn] UnityPy could not read {bundle_path}: {exc}", file=sys.stderr)
        return None

    for obj in env.objects:
        try:
            if obj.type.name != "TextAsset":
                continue
            container = getattr(obj, "container", "") or ""
            if container != target_container:
                continue
            out_path = cache_dir / f"{table_name}.dat"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(bytes(obj.get_raw_data()))
            return out_path
        except Exception as exc:
            print(f"[warn] Could not extract {table_name} from {bundle_path}: {exc}", file=sys.stderr)
            return None
    return None


_CONTAINER_INDEX_CACHE: dict[str, Any] = {}


def _bundle_for_container(stage_root: Path, container: str) -> Path | None:
    """Resolve a container path to its bundle file via bundle_container_index.json.

    The pipeline rebuilds that index every run from the current stage, so it
    reflects the CURRENT bundle layout (relocation-safe) — unlike caching by a
    previously-known path. This avoids the catastrophic fallback in
    find_table_bundles(), which (when ripgrep isn't on PATH) brute-forces every
    bundle file in Python, once per table. Returns the absolute bundle Path, or
    None if the index is absent / the container isn't listed (caller then falls
    back to find_table_bundles)."""
    key = str(stage_root)
    if key not in _CONTAINER_INDEX_CACHE:
        idx_path = stage_root / "bundle_container_index.json"
        by_container = None
        if idx_path.exists():
            try:
                by_container = json.loads(idx_path.read_text(encoding="utf-8")).get("by_container")
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] could not read bundle_container_index.json: {exc}", file=sys.stderr)
        _CONTAINER_INDEX_CACHE[key] = by_container
    by_container = _CONTAINER_INDEX_CACHE[key]
    if not by_container:
        return None
    entry = by_container.get(container)
    bundle_rel = entry.get("bundle") if isinstance(entry, dict) else None
    if not bundle_rel:
        return None
    p = stage_root / bundle_rel
    return p if p.exists() else None


def ensure_table_file(stage_root: Path, cache_dir: Path, table_name: str, refresh: bool) -> Path | None:
    cached = cache_dir / f"{table_name}.dat"
    if cached.exists() and not refresh:
        return cached

    staged = stage_root / "TextAsset" / f"{table_name}.dat"
    if staged.exists():
        return staged

    # Fast path: jump straight to the one bundle holding this table via the
    # container index, instead of scanning all ~53K bundles (9.5 GB) per table.
    direct = _bundle_for_container(stage_root, table_asset_container(table_name))
    if direct is not None:
        extracted = extract_text_asset(direct, table_name, cache_dir)
        if extracted and extracted.exists():
            return extracted

    for bundle in find_table_bundles(stage_root, table_name):
        extracted = extract_text_asset(bundle, table_name, cache_dir)
        if extracted and extracted.exists():
            return extracted
    return cached if cached.exists() else None


def load_tables(stage_root: Path, cache_dir: Path, refresh: bool) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    tables: dict[str, list[dict[str, Any]]] = {}
    missing: list[str] = []

    for table_name in TABLES:
        cached = cache_dir / f"{table_name}.dat"
        if table_name in OPTIONAL_TABLES and not refresh and not cached.exists():
            missing.append(table_name)
            tables[table_name] = []
            continue
        path = ensure_table_file(stage_root, cache_dir, table_name, refresh)
        if path is None or not path.exists():
            if table_name not in OPTIONAL_TABLES:
                print(f"[warn] Missing {table_name}", file=sys.stderr)
            missing.append(table_name)
            tables[table_name] = []
            continue
        try:
            tables[table_name] = load_selected_records(path, FIELD_SPECS[table_name])
        except Exception as exc:
            if table_name not in OPTIONAL_TABLES:
                print(f"[warn] Could not parse {table_name}: {exc}", file=sys.stderr)
            missing.append(table_name)
            tables[table_name] = []
    return tables, missing


def rate_percent(rate: int) -> float:
    return round(rate / 100, 4)


def build_pool_lookup(rewards: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    by_group: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for reward in rewards:
        group_id = int(reward.get("master_ogc_lottery_reward_group_id") or 0)
        if group_id:
            by_group[group_id].append(reward)
    return dict(by_group)


def infer_featured_assignments(rates: list[dict[str, Any]], featured_ids: list[int]) -> dict[int, list[int]]:
    if not featured_ids:
        return {}

    max_rarity = max((int(row.get("show_rarity") or 0) for row in rates), default=0)
    candidates = [
        row
        for row in rates
        if int(row.get("show_rarity") or 0) == max_rarity
        and int(row.get("master_ogc_lottery_reward_group_id") or 0) > 0
        and int(row.get("rate") or 0) > 0
    ]
    candidates.sort(key=lambda row: (int(row.get("rate") or 0), int(row.get("master_ogc_lottery_reward_group_id") or 0)))
    if not candidates:
        return {}

    if len(featured_ids) == 1:
        preferred = next((row for row in candidates if int(row.get("rate") or 0) == 70), candidates[0])
        return {int(preferred["master_ogc_lottery_reward_group_id"]): featured_ids}

    single_pickup_rows = [row for row in candidates if int(row.get("rate") or 0) == 70]
    if len(single_pickup_rows) >= len(featured_ids):
        return {
            int(row["master_ogc_lottery_reward_group_id"]): [character_id]
            for row, character_id in zip(single_pickup_rows, featured_ids)
        }

    combined_rate = 70 * len(featured_ids)
    combined = next((row for row in candidates if int(row.get("rate") or 0) == combined_rate), None)
    if combined:
        return {int(combined["master_ogc_lottery_reward_group_id"]): featured_ids}

    return {int(candidates[0]["master_ogc_lottery_reward_group_id"]): featured_ids}


def build_buckets(
    rates: list[dict[str, Any]],
    reward_pool_lookup: dict[int, list[dict[str, Any]]],
    featured_ids: list[int],
    characters_by_id: dict[int, dict[str, Any]],
    pc_ui_by_id: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    sorted_rates = sorted(
        rates,
        key=lambda row: (-int(row.get("show_rarity") or 0), int(row.get("rate") or 0), int(row.get("master_ogc_lottery_reward_group_id") or 0)),
    )
    inferred_featured_assignments = infer_featured_assignments(rates, featured_ids)
    buckets: list[dict[str, Any]] = []

    for row in sorted_rates:
        reward_group_id = int(row.get("master_ogc_lottery_reward_group_id") or 0)
        rarity = int(row.get("show_rarity") or 0)
        reward_rows = reward_pool_lookup.get(reward_group_id, [])
        # Per-row lottery_reward_type (1=Item, 2=Pc/Chara, 3=BlessPc/Bless, 7=Ticket).
        # Per `MasterOgcLotteryReward` FIELD_SPECS at the top of this file.
        # Used to pass through to compact_character so thumb_type is set
        # data-authoritatively (not just by path heuristic).
        reward_character_pairs: list[tuple[int, int | None]] = [
            (int(reward["lottery_reward_id"]), int(reward.get("lottery_reward_type") or 0) or None)
            for reward in reward_rows
            if int(reward.get("lottery_reward_id") or 0) in characters_by_id
        ]
        reward_character_ids = [cid for cid, _t in reward_character_pairs]
        reward_type_by_id = {cid: t for cid, t in reward_character_pairs}

        featured_bucket = False
        character_ids: list[int] = []
        inferred_featured_ids = inferred_featured_assignments.get(reward_group_id, [])
        if reward_character_ids:
            character_ids = reward_character_ids
            featured_bucket = any(character_id in featured_ids for character_id in reward_character_ids)
        elif inferred_featured_ids:
            character_ids = inferred_featured_ids
            featured_bucket = True

        characters = [
            compact_character(
                characters_by_id.get(character_id),
                character_id,
                pc_ui_by_id,
                lottery_reward_type=reward_type_by_id.get(character_id),
            )
            for character_id in character_ids
        ]
        label = "Featured pickup" if featured_bucket else f"{rarity} star reward pool"
        if not characters:
            label = f"{rarity} star reward group {reward_group_id}"

        buckets.append(
            {
                "master_ogc_lottery_rate_id": row.get("master_ogc_lottery_rate_id"),
                "master_ogc_lottery_rate_group_id": row.get("master_ogc_lottery_rate_group_id"),
                "master_ogc_lottery_reward_group_id": reward_group_id,
                "rate": row.get("rate"),
                "rate_percent": rate_percent(int(row.get("rate") or 0)),
                "show_rarity": rarity,
                "release_label": row.get("release_label"),
                "label": label,
                "is_featured": featured_bucket,
                "characters": characters,
                "reward_rows_resolved": len(reward_rows),
            }
        )

    return buckets


def group_by(rows: list[dict[str, Any]], key: str) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        value = row.get(key)
        if value is None:
            continue
        result[int(value)].append(row)
    return dict(result)


def first_by(rows: list[dict[str, Any]], key: str) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for row in rows:
        value = row.get(key)
        if value is not None:
            result[int(value)] = row
    return result


def infer_pc_id_from_reward_group(group_id: int) -> int | None:
    text = str(group_id)
    if not text.startswith("802100"):
        return None
    try:
        pc_id = int(text.removeprefix("802100"))
    except ValueError:
        return None
    return pc_id or None


def compact_point_selection(
    row: dict[str, Any],
    reward_rows_by_group: dict[int, list[dict[str, Any]]],
    characters_by_id: dict[int, dict[str, Any]],
    lottery_tickets_by_id: dict[int, dict[str, Any]],
    exchange_items_by_id: dict[int, dict[str, Any]],
    pc_ui_by_id: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    group_id = int(row.get("master_reward_group_id") or 0)
    reward_rows = sorted(reward_rows_by_group.get(group_id, []), key=lambda reward: int(reward.get("master_reward_id") or 0))
    character_id: int | None = None
    ticket: dict[str, Any] | None = None

    enriched_reward_rows: list[dict[str, Any]] = []
    character_reward_type: int | None = None
    for reward in reward_rows:
        reward_type = int(reward.get("reward_type") or 0)
        reward_item_id = int(reward.get("reward_item_id") or 0)
        enriched_reward = dict(reward)
        if reward_type == 1 and reward_item_id:
            enriched_reward["item"] = compact_exchange_item(exchange_items_by_id.get(reward_item_id), reward_item_id)
        enriched_reward_rows.append(enriched_reward)
        if reward_type in {2, 3} and reward_item_id:
            character_id = reward_item_id
            character_reward_type = reward_type
            break
        if reward_type == 7 and reward_item_id and ticket is None:
            ticket = compact_lottery_ticket(lottery_tickets_by_id.get(reward_item_id), reward_item_id)

    if character_id is None:
        character_id = infer_pc_id_from_reward_group(group_id)

    compacted = {
        **row,
        "reward_rows": enriched_reward_rows,
        "character": compact_character(
            characters_by_id.get(character_id),
            character_id,
            pc_ui_by_id,
            lottery_reward_type=character_reward_type,
        ) if character_id else None,
        "ticket": ticket,
    }
    return compacted


def build_l10n_lookup(rows: list[dict[str, Any]]) -> dict[int, dict[str, str]]:
    lookup: dict[int, dict[str, str]] = defaultdict(dict)
    for row in rows:
        target_id = int(row.get("localization_target_id") or 0)
        column_name = (row.get("column_name") or "").strip()
        text = (row.get("text") or "").strip()
        if not target_id or not column_name or not text:
            continue
        lookup[target_id][column_name] = text
        lookup[target_id][column_name.lower()] = text
    return dict(lookup)


def lottery_message_text(localized_row: dict[str, str] | None) -> str | None:
    if not localized_row:
        return None
    for key in ("LotteryMessage", "lottery_message", "message", "Message", "Text", "text"):
        text = localized_row.get(key)
        if text:
            return text
    if len(localized_row) == 1:
        return next(iter(localized_row.values()))
    return None


def resolve_replace_groups(lottery: dict[str, Any]) -> dict[str, int]:
    steps = split_ids(lottery.get("replace_rate_group_step"))
    groups = split_ids(lottery.get("replace_master_ogc_lottery_rate_group_id"))
    return {str(step): group_id for step, group_id in zip(steps, groups) if step and group_id}


def build_payload(tables: dict[str, list[dict[str, Any]]], missing: list[str], stage_root: Path) -> dict[str, Any]:
    wiki = json.loads(PC_WIKI_PATH.read_text(encoding="utf-8"))
    characters_by_id = {int(character["master_pc_id"]): character for character in wiki.get("characters", [])}
    pc_ui_by_id = build_pc_ui_lookup(tables.get("MasterPc", []), tables.get("MasterPcArousal", []))

    shops = tables["MasterOgcLotteryShop"]
    lotteries = tables["MasterOgcLottery"]
    rates_by_group = group_by(tables["MasterOgcLotteryRate"], "master_ogc_lottery_rate_group_id")
    rewards_by_group = build_pool_lookup(tables["MasterOgcLotteryReward"])
    details_by_id = first_by(tables["MasterOgcLotteryShopCharacterDetails"], "master_ogc_lottery_shop_character_details_id")
    top_images_by_shop = group_by(tables["MasterLotteryTopImage"], "master_ogc_lottery_shop_id")
    lotteries_by_shop = group_by(lotteries, "master_ogc_lottery_shop_id")
    point_items_by_shop = group_by(tables["MasterLotteryPointItem"], "master_ogc_lottery_shop_id")
    point_selections_by_shop = group_by(tables["MasterLotteryPointSelection"], "master_ogc_lottery_shop_id")
    point_reward_rows_by_group = group_by(tables.get("MasterReward", []), "master_reward_group_id")
    animations_by_type = group_by(tables["MasterOgcLotteryAnimation"], "animation_type")
    animation_groups_by_group = group_by(tables["MasterOgcLotteryAnimationGroup"], "master_ogc_lottery_animation_group_group_id")
    lottery_tickets_by_id = first_by(tables["MasterLotteryTicket"], "master_lottery_ticket_id")
    exchange_items_by_id = first_by(tables["MasterExchangeItem"], "master_exchange_item_id")
    pc_lottery_message_l10n = build_l10n_lookup(tables.get("L10NPcLotteryMessage", []))

    months = sorted(
        {
            month
            for shop in shops
            if int(shop.get("master_ogc_lottery_shop_id") or 0) in lotteries_by_shop
            for month in [release_month(shop.get("release_label"))]
            if month is not None
        }
    )
    current_months = set(months[-2:]) if len(months) >= 2 else set(months)

    banners: list[dict[str, Any]] = []
    for shop in shops:
        shop_id = int(shop.get("master_ogc_lottery_shop_id") or 0)
        shop_lotteries = sorted(lotteries_by_shop.get(shop_id, []), key=lambda row: (int(row.get("reward_count") or 0), int(row.get("gem_cost") or 0)))
        if not shop_lotteries:
            continue
        # Historic banners are kept too (no "current_months" filter) — the
        # simulator shows every banner the game has ever released. The user
        # may navigate to an old banner intentionally.
        if not shop.get("release_label") or not shop.get("banner_path"):
            continue
        # Drop `_close` meta-banners (the "this banner closed on X" dialogs).
        # They are typically Japanese-only (never localized), share their
        # assets with the parent banner, and clutter the carousel without
        # representing a real recruit the user can interact with.
        lbl = (shop.get("release_label") or "").lower()
        if "_close" in lbl:
            continue

        detail = details_by_id.get(int(shop.get("master_ogc_lottery_shop_character_details_id") or 0))
        detail_ids = split_ids(detail.get("character_details_ids") if detail else None)
        pickup_ids = split_ids(shop.get("pickup_animation_character_details_ids"))
        featured_ids = pickup_ids or detail_ids
        featured_characters = [compact_character(characters_by_id.get(character_id), character_id, pc_ui_by_id) for character_id in featured_ids]
        detail_characters = [compact_character(characters_by_id.get(character_id), character_id, pc_ui_by_id) for character_id in detail_ids]
        animation_group_id = int(shop.get("master_ogc_lottery_animation_group_group_id") or 0)
        animation_group_rows = sorted(animation_groups_by_group.get(animation_group_id, []), key=lambda row: (int(row.get("rate") or 0), int(row.get("animation_type") or 0)))
        animation_types = sorted({int(row.get("animation_type") or 0) for row in animation_group_rows})
        animation_assets = {
            str(animation_type): sorted(
                animations_by_type.get(animation_type, []),
                key=lambda row: int(row.get("step") or 0),
            )
            for animation_type in animation_types
        }
        top_images = sorted(top_images_by_shop.get(shop_id, []), key=lambda row: int(row.get("sort") or 0))
        panel_top_image = next((row for row in top_images if int(row.get("image_type") or 0) == 1 and row.get("image_path")), None)
        movie_top_image = next((row for row in top_images if int(row.get("image_type") or 0) == 2 and row.get("image_path")), None)

        rendered_lotteries: list[dict[str, Any]] = []
        for lottery in shop_lotteries:
            rate_group_id = int(lottery.get("master_ogc_lottery_rate_group_id") or 0)
            replacement_groups = resolve_replace_groups(lottery)
            consume_item_id = int(lottery.get("consume_item_id") or 0)
            all_group_ids = [rate_group_id, *replacement_groups.values()]
            rendered_lotteries.append(
                {
                    **lottery,
                    "consume_item": compact_lottery_ticket(lottery_tickets_by_id.get(consume_item_id), consume_item_id)
                    if consume_item_id
                    else None,
                    "replacement_rate_groups": replacement_groups,
                    "rate_groups": {
                        str(group_id): build_buckets(
                            rates_by_group.get(group_id, []),
                            rewards_by_group,
                            featured_ids,
                            characters_by_id,
                            pc_ui_by_id,
                        )
                        for group_id in all_group_ids
                    },
                }
            )

        banners.append(
            {
                "master_ogc_lottery_shop_id": shop_id,
                "sort": shop.get("sort"),
                "display_type": shop.get("display_type"),
                "display_time": shop.get("display_time"),
                "release_label": shop.get("release_label"),
                "release_month": release_month(shop.get("release_label")),
                "banner_path": shop.get("banner_path"),
                "logo_path": shop.get("logo_path"),
                "info_panel_path": shop.get("info_panel_path"),
                "movie_path": shop.get("movie_path"),
                "character_details_ids_raw": shop.get("character_details_ids_raw"),
                # Drives LotteryPatterMovieUtility.GetPatternAnimation: a pulled
                # element whose PcId is in this list is the banner pickup, which
                # flips MasterOgcLotterySelectionMethodType (HasPickupAndNew /
                # AlreadyHave) and so changes which cutscene plays.
                "pickup_animation_character_details_ids": pickup_ids,
                "featured_character_ids": featured_ids,
                "featured_characters": featured_characters,
                "detail_character_ids": detail_ids,
                "detail_characters": detail_characters,
                "top_images": top_images,
                "assets": {
                    "banner": web_sources_for_asset(shop.get("banner_path")),
                    "logo": web_sources_for_asset(shop.get("logo_path")),
                    "info_panel": web_sources_for_asset(shop.get("info_panel_path")),
                    "character": shop_sources(shop_id, "LotteryCharacter"),
                    "login_notice": shop_sources(shop_id, "LotteryLoginNotice"),
                    "background": unique_background_sources(shop_id),
                    "top_panel": web_sources_for_asset(panel_top_image.get("image_path") if panel_top_image else None)
                    or shop_sources(shop_id, "LotteryCharacter"),
                    "top_movie_image": web_sources_for_asset(movie_top_image.get("image_path") if movie_top_image else None),
                },
                "movie": movie_info(shop.get("movie_path")),
                "lotteries": rendered_lotteries,
                "point_items": point_items_by_shop.get(shop_id, []),
                "point_selections": [
                    compact_point_selection(row, point_reward_rows_by_group, characters_by_id, lottery_tickets_by_id, exchange_items_by_id, pc_ui_by_id)
                    for row in sorted(
                        point_selections_by_shop.get(shop_id, []),
                        key=lambda point_row: int(point_row.get("master_lottery_point_selection_id") or 0),
                    )
                ],
                "animation_group": {
                    "master_ogc_lottery_animation_group_group_id": animation_group_id,
                    "rows": animation_group_rows,
                    "assets_by_animation_type": animation_assets,
                },
            }
        )

    banners.sort(key=lambda row: (int(row.get("release_month") or 0), int(row.get("sort") or 0), int(row.get("master_ogc_lottery_shop_id") or 0)), reverse=True)

    # Per-character acquisition reveal data (CharacterAcquisitionElement built by
    # CreateInternal from MasterPcLotteryMessage keyed by master_pc_id). MoviePath
    # here is the character-specific cutscene shown on the reveal step; this is
    # the "animation when you get the banner unit". IsPlayMovie = MoviePath set.
    # ssm_manifest = the actually-extracted Movie/SpecialSkill mp4 files; voice_manifest =
    # the actually-extracted /Voice/Lottery audio files. Both manifests are written
    # by the matching extract_* scripts and consumed here to flip availability flags.
    special_skill_manifest: dict[str, str] = {}
    ssm_path = SCRIPT_DIR / "_special_skill_movies.json"
    if ssm_path.exists():
        try:
            special_skill_manifest = json.loads(ssm_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    voice_manifest: dict[str, dict[str, str | None]] = {}
    voice_path_manifest = SCRIPT_DIR / "_lottery_voice.json"
    if voice_path_manifest.exists():
        try:
            voice_manifest = json.loads(voice_path_manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    def special_skill_movie_for(usm_path: str | None) -> dict[str, Any] | None:
        """Resolve MasterPcLotteryMessage.MoviePath ->
        Movie/SpecialSkill/<charName>_Battle_SpecialSkill/[Cutin_]<...>.usm
        -> /Movie/SpecialSkill/<name>.mp4 (when the extractor has it)."""
        if not usm_path:
            return None
        import re as _re
        m = _re.search(r"Movie/SpecialSkill/[^/]+/([^/]+)\.usm", usm_path, _re.IGNORECASE)
        if not m:
            return None
        stem = m.group(1)
        mp4_rel = f"/Movie/SpecialSkill/{stem}.mp4"
        return {
            "path": usm_path,
            "cache_key": stem,
            "sources": [mp4_rel] if stem in special_skill_manifest else [],
            "available": stem in special_skill_manifest,
        }

    def voice_for(voice_path: str | None) -> dict[str, Any] | None:
        """Resolve MasterPcLotteryMessage.VoicePath ->
        Sound/AudioClip/VOICE/<char>/voice_<stem>.wav
        -> /Voice/Lottery/<stem>.{ogg|wav} (when the extractor has it)."""
        if not voice_path:
            return None
        import re as _re
        m = _re.search(r"voice_([^/]+?)(?:\.wav)?$", voice_path, _re.IGNORECASE)
        if not m:
            return None
        stem = f"voice_{m.group(1)}"
        entry = voice_manifest.get(stem)
        sources: list[str] = []
        if entry:
            if entry.get("ogg"):
                sources.append(entry["ogg"])
            if entry.get("wav"):
                sources.append(entry["wav"])
        return {
            "path": voice_path,
            "stem": stem,
            "sources": sources,
            "available": bool(sources),
        }

    pc_lottery_messages: dict[str, Any] = {}
    for row in tables.get("MasterPcLotteryMessage", []):
        pc_id = int(row.get("master_pc_id") or 0)
        if not pc_id:
            continue
        movie_path = (row.get("movie_path") or "").strip()
        voice_path = (row.get("voice_path") or "").strip()
        prev = pc_lottery_messages.get(str(pc_id))
        # later release rows override earlier; keep the row that actually has a movie
        if prev and prev.get("movie_path") and not movie_path:
            continue
        pc_lottery_messages[str(pc_id)] = {
            "master_pc_id": pc_id,
            "lottery_message": lottery_message_text(pc_lottery_message_l10n.get(int(row.get("master_pc_lottery_message_id") or 0))),
            "voice_path": voice_path or None,
            "movie_path": movie_path or None,
            "release_label": (row.get("release_label") or "").strip() or None,
            "is_play_movie": bool(movie_path),
            "movie": special_skill_movie_for(movie_path) if movie_path else None,
            "voice": voice_for(voice_path) if voice_path else None,
        }

    define_values: dict[str, int] = {}
    define_release_labels: dict[str, str] = {}
    for row in tables.get("MasterDefineValue", []):
        define_name = (row.get("define_name") or "").strip()
        if not define_name:
            continue
        define_values[define_name] = int(row.get("value") or 0)
        release_label = (row.get("release_label") or "").strip()
        if release_label:
            define_release_labels[define_name] = release_label

    lottery_movie_define_assets: dict[str, dict[str, Any]] = {}
    for row in tables.get("MasterDefineAsset", []):
        define_name = (row.get("define_name") or "").strip()
        if not define_name.startswith("lottery.movie."):
            continue
        lottery_movie_define_assets[define_name] = {
            "asset_path": (row.get("asset_path") or "").strip() or None,
            "address": (row.get("address") or "").strip() or None,
            "release_label": (row.get("release_label") or "").strip() or None,
        }

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "stage_root": str(stage_root),
            "latest_release_months": sorted(current_months),
            "missing_tables": sorted(set(missing)),
            "limitations": [
                "MasterOgcLotteryReward maps reward groups to exact pool contents. When it is missing, non-featured results are shown as reward-group buckets while the rates remain exact.",
            ]
            if "MasterOgcLotteryReward" in missing
            else [],
        },
        "pc_lottery_messages": pc_lottery_messages,
        "define_values": define_values,
        "define_release_labels": define_release_labels,
        "lottery_movie_define_assets": lottery_movie_define_assets,
        "ui_assets": {
            "gem_icon": ["/Image/Item/Gem/3000001/gem_3000001_ItemL.png"],
            "question_icon": ["/UI/Texture/CommonEtcAtlas/btnQuestionNormal.webp"],
            "character_details_icon": [],
            "switch_icon": [
                "/UI/Texture/CharaInfoAtlas/btnChangeNormal.webp",
                "/UI/Texture/Texture/CharaInfoAtlas/btnChangeNormal.webp",
            ],
            "trade_icon": ["/UI/Texture/CommonAtlas/btnExchangeNormal.png"],
            "close_icon": ["/UI/Texture/OutAtlas/btnMenuCloseNormal.png", "/UI/Texture/CommonAtlas/btnCloseNormal.png"],
            "exchange_item_icon": ["/Image/Item/Exchange/2400013/exchange_item_2400013_ItemL.png"],
            "carousel_arrow_left": [
                "/UI/Texture/CommonAtlas/btnScrollArrowL.png",
                "/UI/Texture/OutAtlas/simpleArrowL.png",
            ],
            "carousel_arrow_right": [
                "/UI/Texture/CommonAtlas/btnScrollArrowR.png",
                "/UI/Texture/OutAtlas/simpleArrowR.png",
            ],
        },
        "banners": banners,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate summon simulator data from local Tensura master bundles.")
    parser.add_argument("--stage-root", type=Path, default=DEFAULT_STAGE_ROOT)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--refresh", action="store_true", help="Re-scan Unity bundles instead of using cached TextAssets.")
    parser.add_argument("--public-dir", type=Path, action="append",
                        help="Extra public/ dir(s) to search when pruning banner/asset paths. "
                             "Banner images accumulate in the WIKI repo's public/, so pass that "
                             "here; otherwise historical banners get pruned and the file "
                             "collapses to 0 banners. <output>/public is always appended.")
    args = parser.parse_args()

    tables, missing = load_tables(args.stage_root, args.cache_dir, args.refresh)
    payload = build_payload(tables, missing, args.stage_root)
    # Rewrite every asset path to whichever extension actually exists on disk
    # (.webp preferred), drop dead paths, and drop banners with no usable banner
    # or logo. Bakes the post-hoc _work/prune_summon_data_paths.py logic into
    # the generator so EXE/headless runs produce a ready-to-ship file. Search the
    # passed --public-dir(s) (e.g. the wiki repo's public/) AND the run's own
    # <output>/public, so neither historical nor freshly-extracted banners drop.
    public_dirs: list[Path] = list(args.public_dir or [])
    public_dirs.append(args.output.parent / "public")
    _finalize_payload(payload, public_dirs)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.output} ({len(payload['banners'])} banners)")
    if missing:
        print("missing tables: " + ", ".join(sorted(set(missing))))


def _best_existing_path(rel: str, public_dirs) -> str | None:
    """Return `rel` rewritten to the on-disk extension (.webp preferred),
    searching each of public_dirs in order. Accepts a single Path or a list:
    banner/asset images accumulate in the WIKI repo's public/ across runs, while
    a given run's own public/ only holds what that run extracted — so we check
    both, else historical banners get pruned and the file collapses to 0."""
    dirs = public_dirs if isinstance(public_dirs, (list, tuple)) else [public_dirs]
    rel = rel.lstrip("/")
    base = rel
    if base.lower().endswith(".png"):
        base = base[:-4]
    elif base.lower().endswith(".webp"):
        base = base[:-5]
    for public_dir in dirs:
        if (public_dir / (base + ".webp")).exists():
            return "/" + base + ".webp"
        if (public_dir / (base + ".png")).exists():
            return "/" + base + ".png"
    return None


def _prune_array(arr: list[str] | None, public_dir: Path) -> list[str]:
    if not arr:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for p in arr:
        if not isinstance(p, str) or not p:
            continue
        fixed = _best_existing_path(p, public_dir)
        if fixed and fixed not in seen:
            out.append(fixed)
            seen.add(fixed)
    return out


def _finalize_payload(payload: dict, public_dir: Path) -> None:
    banners = payload.get("banners") or []
    # Newest release month(s): a brand-new banner here may not have its art in
    # public/ yet (the banners stage runs AFTER summon in the pipeline), so keep
    # it instead of pruning it out of the file entirely.
    latest_months = {str(m) for m in (payload.get("meta") or {}).get("latest_release_months") or []}
    kept: list = []
    for b in banners:
        # Skip _close meta-banners (Japanese-only closing dialog entries).
        label = (b.get("release_label") or "").lower()
        if "_close" in label or label.endswith("close"):
            continue

        assets = b.get("assets") or {}
        for k, v in list(assets.items()):
            if isinstance(v, list):
                assets[k] = _prune_array(v, public_dir)
        b["assets"] = assets

        for lottery in b.get("lotteries") or []:
            item = lottery.get("consume_item") or {}
            if isinstance(item.get("icon_sources"), list):
                item["icon_sources"] = _prune_array(item["icon_sources"], public_dir)
        for sel in b.get("point_selections") or []:
            for row in sel.get("reward_rows") or []:
                item = row.get("item") or {}
                if isinstance(item.get("icon_sources"), list):
                    item["icon_sources"] = _prune_array(item["icon_sources"], public_dir)

        # Drop banners with neither banner nor logo image on disk — they can't
        # render in the strip. EXCEPTION: a brand-new banner from the current
        # release whose art hasn't been extracted into public/ yet still carries a
        # catalog banner_path — keep it with its web source so it survives into the
        # file and renders once the art lands, instead of being pruned out (fixes
        # the "new banner pruned" circular-dependency bug: summon runs before the
        # banner-art fetch).
        if not (assets.get("banner") or assets.get("logo")):
            if b.get("banner_path") and str(b.get("release_month")) in latest_months:
                assets["banner"] = web_sources_for_asset(b.get("banner_path"))
                if b.get("logo_path"):
                    assets["logo"] = web_sources_for_asset(b.get("logo_path"))
            else:
                continue
        kept.append(b)
    payload["banners"] = kept


if __name__ == "__main__":
    main()
