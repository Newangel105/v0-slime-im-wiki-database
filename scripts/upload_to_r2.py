"""Bulk-upload public/Movie + public/Video to a Cloudflare R2 bucket.

Run this ONCE to populate the bucket after `lib/media-cdn.ts` was wired in.
Skips files already present on R2 (compares object key + size), so it's
safe to re-run if the upload is interrupted halfway.

Requirements
------------
    pip install boto3

Credentials
-----------
Set these env vars BEFORE running (paste the three values Cloudflare showed
when you created the API token):

    set R2_ACCOUNT_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
    set R2_ACCESS_KEY_ID=<the access key id>
    set R2_SECRET_ACCESS_KEY=<the secret access key>
    set R2_BUCKET=slimewiki-media

Then run:

    python scripts/upload_to_r2.py

The script uploads everything under public/Movie/ and public/Video/ keeping
the directory structure. Cache-Control is set to a long max-age so
Cloudflare's CDN aggressively caches in front of R2 — keeps R2 Class B
operation count near zero on the free tier.
"""
from __future__ import annotations

import concurrent.futures
import mimetypes
import os
import sys
import time
from pathlib import Path

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError
except ImportError:
    sys.stderr.write("Missing boto3. Run: pip install boto3\n")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC = REPO_ROOT / "public"
UPLOAD_DIRS = ["Movie", "Video"]
CACHE_CONTROL = "public, max-age=31536000, immutable"
PARALLEL = 12  # concurrent uploads

# Resolve credentials
ENDPOINT = os.environ.get("R2_ACCOUNT_ENDPOINT") or ""
ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID") or ""
SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY") or ""
BUCKET = os.environ.get("R2_BUCKET") or "slimewiki-media"

if not (ENDPOINT and ACCESS_KEY and SECRET_KEY):
    sys.stderr.write(
        "Missing one of R2_ACCOUNT_ENDPOINT / R2_ACCESS_KEY_ID / "
        "R2_SECRET_ACCESS_KEY env vars. Set them per the docstring above.\n"
    )
    sys.exit(1)

# boto3 client tuned for R2's S3 API
s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name="auto",
    config=Config(
        signature_version="s3v4",
        retries={"max_attempts": 5, "mode": "adaptive"},
        max_pool_connections=PARALLEL + 4,
    ),
)


def collect_local_files() -> list[Path]:
    """Walk public/Movie + public/Video and return relative file paths."""
    files: list[Path] = []
    for d in UPLOAD_DIRS:
        root = PUBLIC / d
        if not root.is_dir():
            continue
        for p in root.rglob("*"):
            if p.is_file():
                files.append(p)
    return files


def list_remote_keys() -> dict[str, int]:
    """Return {key: size} for everything already in the bucket. Lets us skip
    files that are already uploaded with the same size."""
    out: dict[str, int] = {}
    token = None
    while True:
        kwargs = {"Bucket": BUCKET}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for o in resp.get("Contents", []) or []:
            out[o["Key"]] = int(o["Size"])
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return out


def upload_one(local: Path, key: str) -> tuple[str, int, str]:
    """Upload one file. Returns (key, size, status)."""
    size = local.stat().st_size
    ctype, _ = mimetypes.guess_type(local.name)
    extra = {"CacheControl": CACHE_CONTROL}
    if ctype:
        extra["ContentType"] = ctype
    try:
        s3.upload_file(str(local), BUCKET, key, ExtraArgs=extra)
        return (key, size, "OK")
    except ClientError as e:
        return (key, size, f"ERR: {e}")


def main() -> int:
    local_files = collect_local_files()
    if not local_files:
        print("No files under public/Movie or public/Video. Nothing to upload.")
        return 0
    print(f"Found {len(local_files)} local files. Listing remote bucket...")
    remote = list_remote_keys()
    print(f"  remote already has {len(remote)} objects")

    # Decide what to upload
    to_upload: list[tuple[Path, str]] = []
    skipped = 0
    for local in local_files:
        # key is relative to public/, e.g. "Movie/SpecialSkill/X.mp4"
        key = str(local.relative_to(PUBLIC)).replace("\\", "/")
        size = local.stat().st_size
        if remote.get(key) == size:
            skipped += 1
            continue
        to_upload.append((local, key))
    print(f"  skipping {skipped} already-uploaded; uploading {len(to_upload)} new/changed")

    if not to_upload:
        print("Bucket is up to date. Done.")
        return 0

    # Upload in parallel
    total_bytes = sum(p.stat().st_size for p, _ in to_upload)
    print(f"  total bytes to transfer: {total_bytes / (1024**3):.2f} GB")
    t0 = time.time()
    done = 0
    bytes_done = 0
    failures: list[tuple[str, str]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=PARALLEL) as ex:
        futures = [ex.submit(upload_one, p, k) for p, k in to_upload]
        for fut in concurrent.futures.as_completed(futures):
            key, sz, status = fut.result()
            done += 1
            bytes_done += sz
            if status != "OK":
                failures.append((key, status))
                print(f"  [{done}/{len(to_upload)}] FAIL {key}: {status}")
            elif done % 10 == 0 or done == len(to_upload):
                elapsed = max(0.001, time.time() - t0)
                speed = bytes_done / elapsed / (1024 * 1024)  # MB/s
                pct = bytes_done / total_bytes * 100 if total_bytes else 0
                print(
                    f"  [{done}/{len(to_upload)}] {pct:5.1f}%  "
                    f"{bytes_done / (1024**3):5.2f} GB / "
                    f"{total_bytes / (1024**3):5.2f} GB  "
                    f"({speed:6.2f} MB/s)"
                )
    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s. {len(to_upload) - len(failures)} uploaded, {len(failures)} failed.")
    if failures:
        print("Failures:")
        for key, status in failures[:20]:
            print(f"  {key}: {status}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
