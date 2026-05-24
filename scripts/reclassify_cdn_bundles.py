"""Re-classify every bundle in _work/cdn_bundles via UnityPy. Writes
_work/cdn_bundles_index.jsonl with container/cab listing for each."""
from __future__ import annotations

import json
import re
import sys
import warnings
from pathlib import Path

import concurrent.futures

warnings.filterwarnings("ignore")

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT = SCRIPT_DIR.parent
CDN_DIR = PROJECT / "_work" / "cdn_bundles"
INDEX_OUT = PROJECT / "_work" / "cdn_bundles_index.jsonl"

USM_RE = re.compile(r"Assets/AssetBundles/Movie/(SpecialSkill|BlessSkill|Announce|Lottery)/[^/]+/[A-Za-z0-9_]+\.usm\.bytes$", re.IGNORECASE)


def classify(p: Path) -> dict:
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
    try:
        env = UnityPy.load(str(p))
        cabs, externals, container = [], [], []
        for bf in env.files.values():
            cf = getattr(bf, "files", None)
            if isinstance(cf, dict):
                for nm, sf in cf.items():
                    cabs.append(nm)
                    for e in getattr(sf, "externals", []) or []:
                        pth = getattr(e, "path", "")
                        if "CAB-" in pth:
                            externals.append(pth.split("/")[-1])
                        else:
                            externals.append(pth)
        for o in env.objects:
            if o.type.name == "AssetBundle":
                d = o.read()
                c = d.m_Container
                if isinstance(c, list):
                    container = [(i[0] if isinstance(i, (list, tuple)) else i) for i in c]
                else:
                    container = list(c.keys())
                break
        is_movie = any(USM_RE.search(c or "") for c in (container or []))
        return {"path": str(p), "cabs": cabs, "ext": externals, "cont": container, "is_movie": is_movie}
    except Exception as e:
        return {"path": str(p), "err": repr(e)[:200]}


def main():
    bundles = sorted(CDN_DIR.glob("*.bundle"))
    print(f"{len(bundles)} bundles to classify", flush=True)

    with INDEX_OUT.open("w", encoding="utf-8") as fh:
        done = 0
        with concurrent.futures.ProcessPoolExecutor(max_workers=8) as ex:
            for entry in ex.map(classify, bundles, chunksize=20):
                fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
                done += 1
                if done % 100 == 0:
                    print(f"  classified {done}/{len(bundles)}", flush=True)
    print(f"wrote {INDEX_OUT}", flush=True)

    # Summary
    movie_hits = []
    with INDEX_OUT.open("r", encoding="utf-8") as fh:
        for line in fh:
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get("is_movie"):
                for c in e.get("cont") or []:
                    m = USM_RE.search(c or "")
                    if m:
                        cat = m.group(1)
                        name = c.rsplit("/", 1)[-1].replace(".usm.bytes", "")
                        if not name.startswith("Cutin_"):
                            movie_hits.append((cat, name))
    from collections import Counter
    cats = Counter(c for c, _ in movie_hits)
    print(f"\nMovie hits: {len(movie_hits)}  by category: {dict(cats)}")


if __name__ == "__main__":
    main()
