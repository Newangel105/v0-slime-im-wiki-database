from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any


PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_RESOLVED_DIR = PROJECT_DIR / "_work" / "resolved_prefabs"
SPRITE_DEST = PROJECT_DIR / "public" / "UI" / "summon"
SPEC_DEST = PROJECT_DIR / "lib" / "summon-ui"


PREFABS = [
    ("UILotteryPromotion", "container", "lottery-promotion", True, True),
    ("UILotteryTextAnnounce", "container", "lottery-text-announce", True, False),
    ("UILotteryMovie", "container", "lottery-movie", True, False),
]


def ref_id(value: Any) -> str | None:
    if isinstance(value, dict) and "m_PathID" in value:
        return str(value["m_PathID"])
    return None


def rgba_alpha(color: Any) -> float:
    if not isinstance(color, dict):
        return 1.0
    alpha = color.get("a")
    if alpha is not None:
        return float(alpha)
    packed = color.get("rgba")
    if isinstance(packed, int):
        return ((packed >> 24) & 0xFF) / 255.0
    return 1.0


def flatten_prefab(
    resolved_dir: Path,
    prefab: str,
    root_name: str,
    spec_name: str,
    *,
    local: bool,
    keep_inactive: bool,
) -> None:
    data = json.loads((resolved_dir / f"{prefab}.json").read_text(encoding="utf-8"))
    game_objects: dict[str, Any] = data["gameObjects"]
    components: dict[str, Any] = data["components"]

    rt_to_go: dict[str, str] = {}
    go_to_rt: dict[str, str] = {}
    for pid, component in components.items():
        if component.get("type") not in ("RectTransform", "Transform"):
            continue
        go_id = ref_id(component.get("go"))
        if go_id:
            rt_to_go[str(pid)] = go_id
            go_to_rt[go_id] = str(pid)

    def rt_for_name(name: str) -> str | None:
        for go_id, go in game_objects.items():
            if go.get("name") == name and go_id in go_to_rt:
                return go_to_rt[go_id]
        return None

    def visual_for_go(go_id: str | None) -> tuple[dict[str, Any] | None, dict[str, Any] | None, int | None, dict[str, Any] | None]:
        if not go_id:
            return None, None, None, None
        sprite = None
        color = None
        image_type = None
        text = None
        for cref in game_objects.get(go_id, {}).get("components", []):
            component = components.get(str(cref.get("m_PathID")))
            if not component:
                continue
            cls = component.get("class", "")
            if cls.endswith("UI.Image") and isinstance(component.get("sprite"), dict) and component["sprite"].get("file"):
                sprite = component["sprite"]
                color = component.get("color")
                image_type = component.get("imgType")
            if "TextMeshProUGUI" in cls and component.get("text") is not None:
                text = {
                    "v": component.get("text"),
                    "size": component.get("fontSize"),
                    "color": component.get("fontColor"),
                    "align": component.get("alignment"),
                }
        return sprite, color, image_type, text

    root_rt = rt_for_name(root_name)
    if not root_rt:
        raise SystemExit(f"{prefab}: root GameObject not found: {root_name}")

    root_component = components[root_rt]
    root_size = root_component.get("sizeDelta") or [1920.0, 1080.0]
    canvas = [
        float(root_size[0] or 1920.0) if local else 1920.0,
        float(root_size[1] or 1080.0) if local else 1080.0,
    ]

    used_sprites: set[str] = set()
    nodes: list[dict[str, Any]] = []
    sequence = 0

    def walk(rt_id: str, parent_x: float, parent_y: float, parent_w: float, parent_h: float) -> None:
        nonlocal sequence
        component = components.get(rt_id)
        if not component:
            return
        go_id = rt_to_go.get(rt_id)
        go = game_objects.get(go_id) if go_id else None
        if go and not go.get("active", True) and not keep_inactive:
            return

        z = sequence
        sequence += 1
        anchor_min = component.get("anchorMin") or [0.0, 0.0]
        anchor_max = component.get("anchorMax") or [0.0, 0.0]
        size_delta = component.get("sizeDelta") or [0.0, 0.0]
        anchored_position = component.get("anchoredPosition") or [0.0, 0.0]
        pivot = component.get("pivot") or [0.5, 0.5]

        width = (anchor_max[0] - anchor_min[0]) * parent_w + size_delta[0]
        height = (anchor_max[1] - anchor_min[1]) * parent_h + size_delta[1]
        anchor_x = ((anchor_min[0] + anchor_max[0]) / 2.0) * parent_w + anchored_position[0]
        anchor_y = ((anchor_min[1] + anchor_max[1]) / 2.0) * parent_h + anchored_position[1]
        box_x = parent_x + anchor_x - pivot[0] * width
        box_y = parent_y + anchor_y - pivot[1] * height

        sprite, color, image_type, text = visual_for_go(go_id)
        name = go.get("name", "?") if go else "?"
        keep = (sprite and rgba_alpha(color) > 0.02) or text
        if keep and width > 0 and height > 0:
            node: dict[str, Any] = {
                "name": name,
                "z": z,
                "x": round(box_x / canvas[0] * 100.0, 4),
                "y": round((canvas[1] - (box_y + height)) / canvas[1] * 100.0, 4),
                "w": round(width / canvas[0] * 100.0, 4),
                "h": round(height / canvas[1] * 100.0, 4),
            }
            if sprite:
                used_sprites.add(sprite["file"])
                node.update(
                    img=sprite["file"],
                    iw=sprite.get("w"),
                    ih=sprite.get("h"),
                    border=sprite.get("border") or [0, 0, 0, 0],
                )
                if image_type is not None:
                    node["sliced"] = image_type == 1
                if isinstance(color, dict):
                    node["tint"] = [
                        round(float(color.get("r", 1)), 4),
                        round(float(color.get("g", 1)), 4),
                        round(float(color.get("b", 1)), 4),
                        round(float(color.get("a", 1)), 4),
                    ]
            if text:
                node["text"] = text
            nodes.append(node)

        for child in component.get("children", []):
            child_rt = ref_id(child)
            if child_rt:
                walk(child_rt, box_x, box_y, width, height)

    if local:
        for child in root_component.get("children", []):
            child_rt = ref_id(child)
            if child_rt:
                walk(child_rt, 0.0, 0.0, canvas[0], canvas[1])
    else:
        walk(root_rt, 0.0, 0.0, canvas[0], canvas[1])

    SPRITE_DEST.mkdir(parents=True, exist_ok=True)
    for filename in used_sprites:
        src = resolved_dir / "sprites" / filename
        dst = SPRITE_DEST / filename
        if src.exists() and not dst.exists():
            shutil.copy2(src, dst)

    SPEC_DEST.mkdir(parents=True, exist_ok=True)
    spec = {"prefab": prefab, "root": root_name, "canvas": canvas, "nodes": nodes}
    out_path = SPEC_DEST / f"{spec_name}.json"
    out_path.write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
    print(f"{spec_name}: {len(nodes)} nodes, {len(used_sprites)} sprites -> {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Flatten resolved summon reveal prefabs into frontend specs.")
    parser.add_argument("--resolved-dir", type=Path, default=DEFAULT_RESOLVED_DIR)
    args = parser.parse_args()

    for prefab, root, spec, local, keep_inactive in PREFABS:
        flatten_prefab(args.resolved_dir, prefab, root, spec, local=local, keep_inactive=keep_inactive)


if __name__ == "__main__":
    main()
