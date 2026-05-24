from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import warnings
from pathlib import Path

import UnityPy

UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
warnings.filterwarnings("ignore", category=DeprecationWarning)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
WORKSPACE_DIR = PROJECT_DIR.parents[1]
EXTRACTOR_DIR = WORKSPACE_DIR / "Slime_Extractor"
DEFAULT_SCAN = PROJECT_DIR / "_work" / "summon_lotteryinfo_scan.json"
DEFAULT_SUMMON_DATA = PROJECT_DIR / "summon.generated.json"
DEFAULT_PUBLIC = PROJECT_DIR / "public"
DEFAULT_TEXTURE_INDEX = EXTRACTOR_DIR / "website" / "texture_index.json"
DEFAULT_STAGE_ROOT = Path(r"C:\Users\Angel105\Documents\cenas\_work\stage")


def output_path_for_container(container: str, public_dir: Path) -> Path | None:
    marker = "Assets/AssetBundles/"
    if marker not in container:
        return None
    relative = container.split(marker, 1)[1]
    if not relative.lower().endswith(".png"):
        return None
    return public_dir / relative.replace("/", "\\")


def path_to_containers(path: str | None) -> list[str]:
    if not path:
        return []
    normalized = path.replace("\\", "/").strip("/")
    if not normalized.lower().endswith(".png"):
        normalized = f"{normalized}.png"
    return [
        f"Assets/AssetBundles/{normalized}",
        f"Assets/AssetBundles/L10NAssets/En/{normalized}",
    ]


def sources_to_containers(sources: list[str] | None) -> list[str]:
    containers: list[str] = []
    for source in sources or []:
        normalized = source.replace("\\", "/").strip("/")
        if not normalized:
            continue
        containers.append(f"Assets/AssetBundles/{normalized}")
    return containers


def texture_index_keys(container: str) -> list[str]:
    normalized = container.replace("\\", "/").strip("/")
    if normalized.startswith("Assets/AssetBundles/"):
        normalized = normalized.removeprefix("Assets/AssetBundles/")
    stem = Path(normalized).stem
    return [normalized, f"{normalized}/{stem}", Path(normalized).name, stem]


def bundles_from_texture_index(
    containers: list[str],
    texture_index_path: Path,
    stage_root: Path,
    bundle_paths: list[Path],
) -> int:
    if not texture_index_path.exists() or not stage_root.exists():
        return 0

    raw_index = json.loads(texture_index_path.read_text(encoding="utf-8"))
    indexes = [raw_index]
    if isinstance(raw_index, dict) and ("by_full" in raw_index or "by_base" in raw_index):
        indexes = [raw_index.get("by_full") or {}, raw_index.get("by_base") or {}]

    existing = set(bundle_paths)
    added = 0
    for container in containers:
        for key in texture_index_keys(container):
            matched = False
            for index in indexes:
                relative_paths = index.get(key, [])
                if relative_paths:
                    matched = True
                for relative_path in relative_paths:
                    bundle_path = stage_root / str(relative_path).replace("/", "\\")
                    if bundle_path.exists() and bundle_path not in existing:
                        bundle_paths.append(bundle_path)
                        existing.add(bundle_path)
                        added += 1
            if matched:
                break
    return added


def collect_needed_containers(summon_data_path: Path, extra_shop_ids: list[int]) -> tuple[set[str], set[str]]:
    payload = json.loads(summon_data_path.read_text(encoding="utf-8"))
    ids = {str(banner["master_ogc_lottery_shop_id"]) for banner in payload.get("banners", [])}
    ids.update(str(shop_id) for shop_id in extra_shop_ids)
    containers: set[str] = set()
    for banner in payload.get("banners", []):
        containers.update(path_to_containers(banner.get("banner_path")))
        containers.update(path_to_containers(banner.get("logo_path")))
        containers.update(path_to_containers(banner.get("info_panel_path")))
        for top_image in banner.get("top_images", []):
            containers.update(path_to_containers(top_image.get("image_path")))
        for sources in (banner.get("assets") or {}).values():
            containers.update(sources_to_containers(sources))
        for lottery in banner.get("lotteries", []):
            consume_item = lottery.get("consume_item") or {}
            containers.update(sources_to_containers(consume_item.get("icon_sources")))
        for selection in banner.get("point_selections", []):
            for reward in selection.get("reward_rows", []) or []:
                item = reward.get("item") or {}
                containers.update(sources_to_containers(item.get("icon_sources")))
    return ids, containers


def object_is_needed(container: str, shop_ids: set[str], needed_containers: set[str]) -> bool:
    if container in needed_containers:
        return True
    for shop_id in shop_ids:
        if f"LotteryInfo/{shop_id}/" in container:
            return True
        if f"LotteryInfo/LotteryBg/unique/{shop_id}/" in container:
            return True
    return False


def export_bundle(bundle_path: Path, public_dir: Path, shop_ids: set[str], needed_containers: set[str]) -> int:
    exported = 0
    env = UnityPy.load(str(bundle_path))
    seen: set[str] = set()
    for obj in env.objects:
        container = getattr(obj, "container", "") or ""
        if container in seen or not object_is_needed(container, shop_ids, needed_containers):
            continue
        if obj.type.name != "Texture2D":
            continue
        out_path = output_path_for_container(container, public_dir)
        if out_path is None:
            continue
        data = obj.read()
        image = getattr(data, "image", None)
        if image is None:
            continue
        out_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(out_path)
        seen.add(container)
        exported += 1
    return exported


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract game lottery textures used by the summon simulator.")
    parser.add_argument("--scan", type=Path, default=DEFAULT_SCAN)
    parser.add_argument("--summon-data", type=Path, default=DEFAULT_SUMMON_DATA)
    parser.add_argument("--public-dir", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--texture-index", type=Path, default=DEFAULT_TEXTURE_INDEX)
    parser.add_argument("--stage-root", type=Path, default=DEFAULT_STAGE_ROOT)
    parser.add_argument("--extra-shop-id", action="append", type=int, default=[])
    args = parser.parse_args()

    if not args.scan.exists():
        raise SystemExit(f"Missing scan manifest: {args.scan}")

    shop_ids, needed_containers = collect_needed_containers(args.summon_data, args.extra_shop_id)
    scan = json.loads(args.scan.read_text(encoding="utf-8"))
    bundle_paths: list[Path] = []
    for entry in scan:
        objects = entry.get("objects", [])
        if any(object_is_needed(container, shop_ids, needed_containers) for _kind, container in objects):
            bundle_paths.append(Path(entry["file"]))

    missing_from_scan = [
        container
        for container in needed_containers
        if not any(
            container == object_container
            for entry in scan
            for _kind, object_container in entry.get("objects", [])
        )
    ]
    # Fall back to texture_index for ALL missing containers (banner art,
    # logos, character cutouts, backgrounds, item icons, etc.). Previously
    # this was item-only, which left banner assets unextracted when the
    # scan manifest predated the banner's release.
    missing_item_containers = list(missing_from_scan)
    if missing_item_containers:
        bundles_from_texture_index(missing_item_containers, args.texture_index, args.stage_root, bundle_paths)
        stage_roots: set[Path] = set()
        for entry in scan:
            file_path = Path(entry["file"])
            for parent in file_path.parents:
                if parent.name == "stage":
                    stage_roots.add(parent)
                    break
        needles = sorted(
            {
                Path(container.replace("\\", "/")).stem
                for container in missing_item_containers
                if Path(container.replace("\\", "/")).stem
            }
        )
        try:
            pattern_args: list[str] = []
            for needle in needles:
                pattern_args.extend(["-e", needle])
            raw = subprocess.check_output(
                ["rg", "-a", "-l", "-m", "1", *pattern_args, *map(str, stage_roots)],
                text=True,
                errors="ignore",
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            raw = ""
        for line in raw.splitlines():
            path = Path(line.strip())
            if path.exists() and path not in bundle_paths:
                bundle_paths.append(path)

    total = 0
    for bundle_path in bundle_paths:
        total += export_bundle(bundle_path, args.public_dir, shop_ids, needed_containers)
    print(f"exported {total} lottery textures from {len(bundle_paths)} bundles")


if __name__ == "__main__":
    main()
