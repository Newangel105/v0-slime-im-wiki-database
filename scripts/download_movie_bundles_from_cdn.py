"""Download every CDN bundle URL recovered via Frida memory scan, classify by
container path (using UnityPy), keep only Movie/* bundles, and run them through
the existing USM -> MP4 pipeline.

Reads:
  lib/summon-ui/lottery_runtime_data/movie_bundle_urls.json (bundle_urls[])
Writes:
  _work/cdn_bundles/<sha1prefix>.bundle (raw downloaded bundles)
  _work/cdn_bundles_index.jsonl         (cab_index-style listing of pulled bundles)
  _work/cdn_bundles_download.log        (per-URL HTTP status + size + container path)

Rules:
- Sleep 0.5s between requests so the CDN isn't hammered (113 URLs ~= 60s).
- Skip URLs whose target file already exists locally.
- Log every request (URL, HTTP status, size, content path, error).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT = SCRIPT_DIR.parent
INPUT_JSON = PROJECT / "lib" / "summon-ui" / "lottery_runtime_data" / "movie_bundle_urls.json"
OUT_DIR = PROJECT / "_work" / "cdn_bundles"
INDEX_OUT = PROJECT / "_work" / "cdn_bundles_index.jsonl"
LOG_OUT = PROJECT / "_work" / "cdn_bundles_download.log"

USM_PATH_RE = re.compile(
    r"Assets/AssetBundles/Movie/(?P<cat>SpecialSkill|BlessSkill|Announce|Lottery)/[^/]+/(?P<name>[A-Za-z0-9_]+)\.usm\.bytes$",
    re.IGNORECASE,
)
URL_RE = re.compile(r"https://ten-sura-m-assets-eu\.akamaized\.net/assets/Android/(?P<o>[a-f0-9]{32})/(?P<i>[a-f0-9]{32})\.bundle$")
USER_AGENT = "BestHTTP/2 v2.5.1"  # the game's actual UA string seen in url_run.log


def url_filename(url: str) -> str:
    m = URL_RE.match(url)
    if not m:
        return hashlib.sha1(url.encode()).hexdigest()[:24] + ".bundle"
    return f"{m['o']}_{m['i']}.bundle"


def http_get(url: str, dest: Path, timeout: float = 30.0) -> tuple[int, int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
            dest.write_bytes(data)
            return r.status, len(data), ""
    except urllib.error.HTTPError as e:
        return e.code, 0, f"HTTPError: {e}"
    except urllib.error.URLError as e:
        return -1, 0, f"URLError: {e}"
    except Exception as e:  # noqa: BLE001
        return -2, 0, f"Exception: {e!r}"


def classify_bundle(bundle_path: Path) -> dict:
    """Returns {cabs, externals, container[]} via UnityPy."""
    import warnings
    warnings.filterwarnings("ignore")
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "2021.3.25f1"
    try:
        env = UnityPy.load(str(bundle_path))
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
        return {"cabs": cabs, "ext": externals, "cont": container}
    except Exception as e:  # noqa: BLE001
        return {"cabs": [], "ext": [], "cont": [], "err": repr(e)[:200]}


def main() -> None:
    if not INPUT_JSON.exists():
        sys.exit(f"missing: {INPUT_JSON}")
    payload = json.loads(INPUT_JSON.read_text(encoding="utf-8"))
    urls = payload.get("bundle_urls") or []
    if not urls:
        sys.exit("no bundle_urls in movie_bundle_urls.json")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    log_fh = LOG_OUT.open("w", encoding="utf-8")
    index_fh = INDEX_OUT.open("w", encoding="utf-8")

    n_total = len(urls)
    n_fetched = 0
    n_skipped = 0
    n_failed = 0
    n_movie = 0

    for i, url in enumerate(sorted(urls), start=1):
        dest = OUT_DIR / url_filename(url)
        if dest.exists() and dest.stat().st_size > 100:
            n_skipped += 1
            log_fh.write(f"{url}\t200\t{dest.stat().st_size}\tcached\n")
            log_fh.flush()
        else:
            time.sleep(0.5)
            status, size, err = http_get(url, dest)
            log_fh.write(f"{url}\t{status}\t{size}\t{err}\n")
            log_fh.flush()
            if status != 200 or size == 0:
                n_failed += 1
                if dest.exists() and size == 0:
                    dest.unlink()
                print(f"[{i:3d}/{n_total}] FAIL {status} {url} ({err})", flush=True)
                continue
            n_fetched += 1

        idx = classify_bundle(dest)
        idx["path"] = str(dest)
        idx["url"] = url
        is_movie = any(USM_PATH_RE.search(c or "") for c in (idx.get("cont") or []))
        if is_movie:
            n_movie += 1
        idx["is_movie"] = is_movie
        index_fh.write(json.dumps(idx, ensure_ascii=False) + "\n")
        index_fh.flush()

        movie_paths = [c for c in (idx.get("cont") or []) if c and USM_PATH_RE.search(c)]
        if movie_paths:
            print(f"[{i:3d}/{n_total}] MOVIE {dest.name}  ->  {', '.join(movie_paths)}", flush=True)
        else:
            print(f"[{i:3d}/{n_total}] non-movie {dest.name} ({len(idx.get('cont') or [])} containers)", flush=True)

    log_fh.close()
    index_fh.close()
    print(f"\nDone: fetched={n_fetched} skipped={n_skipped} failed={n_failed} movie_bundles={n_movie}/{n_total}")
    print(f"  log:   {LOG_OUT}")
    print(f"  index: {INDEX_OUT}")


if __name__ == "__main__":
    main()
