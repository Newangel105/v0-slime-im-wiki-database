from __future__ import annotations

import argparse
import subprocess
import warnings
from pathlib import Path

import UnityPy

UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
warnings.filterwarnings("ignore", category=DeprecationWarning)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DEFAULT_STAGE = Path(r"C:\Users\Angel105\Documents\cenas\_work\stage")
DEFAULT_PUBLIC = PROJECT_DIR / "public"

UI_PREFIXES = (
    "Assets/AssetBundles/UI/Texture/GlobalAtlas/",
    "Assets/AssetBundles/UI/Texture/CommonEtcAtlas/",
    "Assets/AssetBundles/UI/Texture/CommonAtlas/",
    "Assets/AssetBundles/UI/Texture/OutAtlas/",
    "Assets/AssetBundles/UI/Texture/CharaInfoAtlas/",
    "Assets/AssetBundles/UI/Texture/BattleAtlas/",
    "Assets/AssetBundles/UI/Texture/CommonRarityAtlas/",
    "Assets/AssetBundles/UI/Texture/CommonLotteryInfoPanelAtlas/",
)


def output_path_for_container(container: str, public_dir: Path) -> Path | None:
    marker = "Assets/AssetBundles/"
    if marker not in container:
        return None
    relative = container.split(marker, 1)[1]
    if not relative.lower().endswith((".png", ".webp")):
        return None
    return public_dir / relative.replace("/", "\\")


def find_candidate_bundles(stage_dir: Path) -> list[Path]:
    paths: set[Path] = set()
    for needle in (
        "UI/Texture/GlobalAtlas",
        "UI/Texture/CommonEtcAtlas",
        "UI/Texture/CommonAtlas",
        "UI/Texture/OutAtlas",
        "UI/Texture/CharaInfoAtlas",
        "UI/Texture/BattleAtlas",
        "UI/Texture/CommonRarityAtlas",
        "UI/Texture/CommonLotteryInfoPanelAtlas",
    ):
        try:
            raw = subprocess.check_output(
                ["rg", "-a", "-l", "-m", "1", needle, str(stage_dir)],
                text=True,
                errors="ignore",
            )
        except subprocess.CalledProcessError:
            continue
        for line in raw.splitlines():
            path = Path(line.strip())
            if path.name not in {"dump.cs", "global-metadata.dat"}:
                paths.add(path)
    return sorted(paths)


def export_bundle(bundle_path: Path, public_dir: Path) -> int:
    exported = 0
    env = UnityPy.load(str(bundle_path))
    seen: set[str] = set()
    for obj in env.objects:
        container = getattr(obj, "container", "") or ""
        if container in seen or not container.startswith(UI_PREFIXES):
            continue
        if obj.type.name not in {"Sprite", "Texture2D"}:
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
    parser = argparse.ArgumentParser(description="Extract real game UI atlas sprites used by the summon simulator.")
    parser.add_argument("--stage-dir", type=Path, default=DEFAULT_STAGE)
    parser.add_argument("--public-dir", type=Path, default=DEFAULT_PUBLIC)
    args = parser.parse_args()

    bundles = find_candidate_bundles(args.stage_dir)
    total = 0
    for bundle_path in bundles:
        total += export_bundle(bundle_path, args.public_dir)
    print(f"exported {total} summon UI sprites from {len(bundles)} bundles")


if __name__ == "__main__":
    main()
