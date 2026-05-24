"""GET phase only: read the HEAD-pass TSV and download every bundle whose
Content-Length is >= MIN_SIZE. Skips already-downloaded files.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT = SCRIPT_DIR.parent
HEAD_TSV = PROJECT / "_work" / "cdn_bundles_head_sizes.tsv"
OUT_DIR = PROJECT / "_work" / "cdn_bundles"
LOG_OUT = PROJECT / "_work" / "filtered_get.log"

URL_RE = re.compile(r"https://ten-sura-m-assets-eu\.akamaized\.net/assets/Android/(?P<o>[a-f0-9]{32})/(?P<i>[a-f0-9]{32})\.bundle$")
USER_AGENT = "BestHTTP/2 v2.5.1"
GET_WORKERS = 12


def url_filename(url):
    m = URL_RE.match(url)
    if not m:
        return None
    return f"{m['o']}_{m['i']}.bundle"


def http_get(url, dest, timeout=120.0):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
            dest.write_bytes(data)
            return r.status, len(data), ""
    except urllib.error.HTTPError as e:
        return e.code, 0, f"HTTPError: {e}"
    except Exception as e:
        return -1, 0, f"Err: {e!r}"[:120]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-size", type=int, default=5 * 1024 * 1024)
    args = ap.parse_args()

    targets = []
    with HEAD_TSV.open("r", encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\r\n").split("\t")
            if len(parts) < 2: continue
            url, size_s = parts[0], parts[1]
            try: size = int(size_s)
            except: continue
            if size >= args.min_size:
                targets.append((url, size))
    print(f"loaded {len(targets)} targets (>={args.min_size/1024/1024:.0f} MB)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    log_fh = LOG_OUT.open("a", encoding="utf-8")

    def worker(t):
        u, _ = t
        dest = OUT_DIR / url_filename(u)
        if dest.exists() and dest.stat().st_size > 100:
            return (u, 200, dest.stat().st_size, "cached")
        return (u,) + http_get(u, dest)

    t0 = time.time()
    ok = fail = cached = 0
    total_bytes = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=GET_WORKERS) as ex:
        futs = {ex.submit(worker, t): t for t in targets}
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            u, st, sz, err = fut.result()
            log_fh.write(f"{u}\t{st}\t{sz}\t{err}\n")
            log_fh.flush()
            if st == 200 and sz > 1000:
                if err == "cached":
                    cached += 1
                else:
                    ok += 1
                    total_bytes += sz
            else:
                fail += 1
            done += 1
            if done % 25 == 0:
                rate = (total_bytes / 1e6) / (time.time() - t0 + 0.001)
                eta = (len(targets) - done) / (done / (time.time() - t0 + 0.001))
                print(f"  GET {done}/{len(targets)} (fetched={ok} cached={cached} fail={fail}) {rate:.1f} MB/s eta {eta:.0f}s", flush=True)

    print(f"\nDone in {time.time()-t0:.1f}s.  fetched={ok}  cached={cached}  fail={fail}  total {total_bytes/1e6:.0f} MB")
    log_fh.close()


if __name__ == "__main__":
    main()
