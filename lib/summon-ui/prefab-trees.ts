// Faithful nested prefab trees (built by _work/build_prefab_tree.py).
// These preserve the full RectTransform incl. localScale, sibling order,
// masks, CanvasGroup alpha and active-state — consumed by <PrefabTree>.
import characterAppear from "./prefab_trees/UILotteryCharacterAppear.tree.json"
import promotion from "./prefab_trees/UILotteryPromotion.tree.json"
import result from "./prefab_trees/UILotteryResult.tree.json"
import textAnnounce from "./prefab_trees/UILotteryTextAnnounce.tree.json"
import movie from "./prefab_trees/UILotteryMovie.tree.json"
import type { PrefabTreeJson } from "@/components/prefab-tree"

export const PREFAB_TREES = {
  characterAppear: characterAppear as unknown as PrefabTreeJson,
  promotion: promotion as unknown as PrefabTreeJson,
  result: result as unknown as PrefabTreeJson,
  textAnnounce: textAnnounce as unknown as PrefabTreeJson,
  movie: movie as unknown as PrefabTreeJson,
}

// Find a subtree by full prefab path (e.g.
// "UILotteryResult/container/modalContainer/modalFront/resultList/resultTemplate").
// Returns a synthetic PrefabTreeJson where `root` is the matched node, so
// <PrefabTree tree={subtree} /> renders just that subtree.
import type { TreeNode, PrefabTreeJson as _PT } from "@/components/prefab-tree"
export function subtreeAt(tree: PrefabTreeJson, path: string): PrefabTreeJson | null {
  function find(n: TreeNode): TreeNode | null {
    if (n.path === path) return n
    for (const c of n.children) {
      const f = find(c)
      if (f) return f
    }
    return null
  }
  const hit = find(tree.root)
  if (!hit) return null
  return { prefab: tree.prefab, root: hit }
}

// The game runs landscape; the scene UI canvas is 1920×1080 (the recorded
// real-game frames are 16:9). All reveal prefabs' root stretches to that
// canvas; their `container` either stays a fixed 1920×1080 centred box
// (CharacterAppear) or stretches to it (Promotion/Result/etc.) — either way
// the design space is 1920×1080. We render into a 16:9 box so `contain`
// and `stretch` coincide; `contain` keeps it safe on non-16:9 containers.
export const PREFAB_DESIGN: Record<keyof typeof PREFAB_TREES, { size: [number, number]; fit: "contain" | "stretch" }> = {
  characterAppear: { size: [1920, 1080], fit: "contain" },
  promotion: { size: [1920, 1080], fit: "contain" },
  result: { size: [1920, 1080], fit: "contain" },
  textAnnounce: { size: [1920, 1080], fit: "contain" },
  movie: { size: [1920, 1080], fit: "contain" },
}
