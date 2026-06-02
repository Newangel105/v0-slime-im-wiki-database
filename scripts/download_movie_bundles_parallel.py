"""Parallel download of the full bundle URL pool (54K+ URLs).

Two-phase strategy to avoid downloading 7 GB of small non-movie bundles:
1. HEAD pass: 16 concurrent threads issue HEAD against each URL to get
   Content-Length. Filter to bundles ≥ MIN_BUNDLE_SIZE bytes (movies are
   typically 10–15 MB; UI/atlas bundles are 50–500 KB).
2. GET pass: 16 concurrent threads download the filtered set into
   `_work/cdn_bundles/`.

After download, run the existing classification + extraction pipeline.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT = SCRIPT_DIR.parent
INPUT_JSON = PROJECT / "lib" / "summon-ui" / "lottery_runtime_data" / "movie_bundle_urls.json"
OUT_DIR = PROJECT / "_work" / "cdn_bundles"
HEAD_OUT = PROJECT / "_work" / "cdn_bundles_head_sizes.tsv"
DOWNLOAD_LOG = PROJECT / "_work" / "cdn_bundles_parallel_download.log"

URL_RE = re.compile(r"https://ten-sura-m-assets-eu\.akamaized\.net/assets/Android/(?P<o>[a-f0-9]{32})/(?P<i>[a-f0-9]{32})\.bundle$")
USER_AGENT = "BestHTTP/2 v2.5.1"
MIN_BUNDLE_SIZE = 5 * 1024 * 1024  # 5 MB — movies are 10-15 MB, UI bundles < 1 MB
HEAD_WORKERS = 16
GET_WORKERS = 12


def url_filename(url: str) -> str:
    m = URL_RE.match(url)
    if not m:
        return None
    return f"{m['o']}_{m['i']}.bundle"


def head_size(url: str, timeout: float = 10.0) -> tuple[int, str]:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            size = int(r.headers.get("Content-Length", "0"))
            return size, ""
    except urllib.error.HTTPError as e:
        return -1, f"HTTP {e.code}"
    except Exception as e:  # noqa: BLE001
        return -1, repr(e)[:80]


def http_get(url: str, dest: Path, timeout: float = 60.0) -> tuple[int, int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
            dest.write_bytes(data)
            return r.status, len(data), ""
    except urllib.error.HTTPError as e:
        return e.code, 0, f"HTTPError: {e}"
    except Exception as e:  # noqa: BLE001
        return -1, 0, f"Err: {e!r}"[:120]


def load_urls(input_json: Path, only_git_added: bool) -> list[str]:
    payload = json.loads(input_json.read_text(encoding="utf-8"))
    current_urls = {u for u in (payload.get("bundle_urls") or []) if URL_RE.match(u)}
    if not only_git_added:
        return sorted(current_urls)

    try:
        rel = input_json.resolve().relative_to(PROJECT.resolve())
    except ValueError:
        rel = input_json.resolve()
    rel_spec = str(rel).replace("\\", "/")
    r = subprocess.run(
        [
            "git",
            "-c", f"safe.directory={PROJECT.resolve().as_posix()}",
            "-C", str(PROJECT),
            "show", f"HEAD:{rel_spec}",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError(f"git show HEAD version failed: {(r.stderr or r.stdout).strip()}")
    previous = json.loads(r.stdout)
    previous_urls = {u for u in (previous.get("bundle_urls") or []) if URL_RE.match(u)}
    return sorted(current_urls - previous_urls)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-json", type=Path, default=INPUT_JSON,
                    help="JSON file containing bundle_urls[]. Defaults to movie_bundle_urls.json.")
    ap.add_argument("--only-git-added", action="store_true",
                    help="Only process bundle URLs added in git diff for --input-json.")
    ap.add_argument("--min-size", type=int, default=MIN_BUNDLE_SIZE,
                    help="Skip bundles smaller than N bytes. Default 5 MB (movies are ≥ 10 MB).")
    ap.add_argument("--no-head", action="store_true",
                    help="Skip HEAD pass; just GET every URL (slower, more bandwidth).")
    ap.add_argument("--skip-existing", action="store_true", default=True)
    args = ap.parse_args()

    urls = load_urls(args.input_json, args.only_git_added)
    source = f"{args.input_json}"
    if args.only_git_added:
        source += " (git-added URLs only)"
    print(f"input pool: {len(urls)} URLs from {source}", flush=True)
    if not urls:
        print("nothing to do")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Skip already-downloaded
    existing_local = {p.name for p in OUT_DIR.glob("*.bundle") if p.stat().st_size > 100}
    pending = [u for u in urls if url_filename(u) not in existing_local]
    print(f"{len(existing_local)} already in _work/cdn_bundles; {len(pending)} pending", flush=True)

    if not pending:
        print("nothing to do")
        return

    # Phase 1: HEAD pass
    targets: list[tuple[str, int]] = []
    if args.no_head:
        targets = [(u, -1) for u in pending]
    else:
        print(f"\n=== Phase 1: HEAD on {len(pending)} URLs ({HEAD_WORKERS} parallel) ===", flush=True)
        head_fh = HEAD_OUT.open("w", encoding="utf-8")
        t0 = time.time()
        done = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=HEAD_WORKERS) as ex:
            futs = {ex.submit(head_size, u): u for u in pending}
            for fut in concurrent.futures.as_completed(futs):
                u = futs[fut]
                size, err = fut.result()
                head_fh.write(f"{u}\t{size}\t{err}\n")
                if size >= args.min_size:
                    targets.append((u, size))
                done += 1
                if done % 500 == 0:
                    rate = done / (time.time() - t0)
                    eta = (len(pending) - done) / rate if rate else 0
                    print(f"  HEAD {done}/{len(pending)} ({rate:.1f}/s eta {eta:.0f}s)  >=5MB targets={len(targets)}", flush=True)
        head_fh.close()
        print(f"HEAD done in {time.time()-t0:.1f}s.  Targets ≥ {args.min_size/1024/1024:.1f} MB: {len(targets)}", flush=True)

    if not targets:
        print("no targets pass size filter")
        return

    # Phase 2: GET pass
    print(f"\n=== Phase 2: GET on {len(targets)} URLs ({GET_WORKERS} parallel) ===", flush=True)
    log_fh = DOWNLOAD_LOG.open("a", encoding="utf-8")
    t0 = time.time()
    ok = fail = 0

    def worker(u_size: tuple[str, int]) -> tuple[str, int, int, str]:
        u, expected_size = u_size
        dest = OUT_DIR / url_filename(u)
        if dest.exists() and dest.stat().st_size > 100:
            return (u, 200, dest.stat().st_size, "cached")
        status, got, err = http_get(u, dest)
        return (u, status, got, err)

    with concurrent.futures.ThreadPoolExecutor(max_workers=GET_WORKERS) as ex:
        futs = {ex.submit(worker, t): t for t in targets}
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            u, st, sz, err = fut.result()
            log_fh.write(f"{u}\t{st}\t{sz}\t{err}\n")
            log_fh.flush()
            if st == 200 and sz > 1000:
                ok += 1
            else:
                fail += 1
            done += 1
            if done % 50 == 0:
                rate = done / (time.time() - t0)
                eta = (len(targets) - done) / rate if rate else 0
                print(f"  GET {done}/{len(targets)} (ok={ok} fail={fail}) {rate:.1f}/s eta {eta:.0f}s", flush=True)
    log_fh.close()
    print(f"\nGET done in {time.time()-t0:.1f}s.  ok={ok}  fail={fail}", flush=True)


if __name__ == "__main__":
    main()
