from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DEFAULT_SUMMON_DATA = PROJECT_DIR / "summon.generated.json"
DEFAULT_CACHE_DIR = PROJECT_DIR / "_work" / "emulator_crisound"
DEFAULT_PUBLIC = PROJECT_DIR / "public"
DEFAULT_FFMPEG = PROJECT_DIR / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
DEFAULT_WORK_DIR = PROJECT_DIR / "_work" / "summon_movie_extract"

USM_SIGNATURES = {b"CRID", b"@SFV", b"@SFA", b"@SBT"}

# CRI Mana decryption key for Slime IM, recovered via a Frida MediaCodec capture
# XOR'd against the encrypted USM (the binary constant 0xD47EB533AEF7E5 was a red
# herring). Verified end-to-end with WannaCRI (full clean decrypt, 0 ffmpeg errors,
# real frames). This is the game key and works for every banner/cutscene USM.
DEFAULT_MOVIE_KEY = "0096EE8646D6F935"


@dataclass(frozen=True)
class MovieKey:
    key1: int
    key2: int


@dataclass(frozen=True)
class UsmChunk:
    offset: int
    magic: bytes
    data_size: int
    data_offset: int
    padding_size: int
    data_type: int
    payload_start: int
    payload_size: int
    next_offset: int


def normalized_movie_path(path: str | None) -> str | None:
    if not path:
        return None
    normalized = path.replace("\\", "/").strip("/")
    return normalized or None


def cache_key(movie_path: str) -> str:
    return hashlib.md5(movie_path.encode("utf-8")).hexdigest().upper()


def playable_path(movie_path: str) -> str:
    if movie_path.lower().endswith(".usm"):
        return f"{movie_path[:-4]}.mp4"
    return f"{movie_path}.mp4"


def find_ffmpeg(explicit: Path | None) -> Path:
    if explicit and explicit.exists():
        return explicit
    if DEFAULT_FFMPEG.exists():
        return DEFAULT_FFMPEG
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return Path(ffmpeg)
    raise SystemExit("Could not find ffmpeg. Install dependencies or pass --ffmpeg.")


def collect_banner_movies(summon_data: Path) -> list[str]:
    payload = json.loads(summon_data.read_text(encoding="utf-8"))
    movies: list[str] = []
    seen: set[str] = set()
    for banner in payload.get("banners", []):
        movie = normalized_movie_path(banner.get("movie_path"))
        if movie and movie not in seen:
            seen.add(movie)
            movies.append(movie)
    return movies


def parse_u32(value: str, label: str) -> int:
    cleaned = value.strip().replace("_", "")
    if cleaned.lower().startswith("0x"):
        parsed = int(cleaned, 16)
    elif any(char in cleaned.lower() for char in "abcdef"):
        parsed = int(cleaned, 16)
    else:
        parsed = int(cleaned, 0)
    if parsed < 0 or parsed > 0xFFFFFFFF:
        raise SystemExit(f"{label} must fit in an unsigned 32-bit value.")
    return parsed


def parse_movie_key(movie_key: str | None, key1: str | None, key2: str | None) -> MovieKey | None:
    if movie_key and (key1 or key2):
        raise SystemExit("Use either --movie-key or --movie-key1/--movie-key2, not both.")
    if movie_key:
        cleaned = movie_key.strip().lower().removeprefix("0x")
        cleaned = cleaned.replace("_", "").replace(" ", "")
        if not cleaned:
            raise SystemExit("--movie-key was empty.")
        full_key = int(cleaned, 16)
        if full_key < 0 or full_key > 0xFFFFFFFFFFFFFFFF:
            raise SystemExit("--movie-key must fit in an unsigned 64-bit value.")
        return MovieKey(key1=full_key & 0xFFFFFFFF, key2=(full_key >> 32) & 0xFFFFFFFF)
    if key1 or key2:
        if not key1 or not key2:
            raise SystemExit("--movie-key1 and --movie-key2 must be supplied together.")
        return MovieKey(key1=parse_u32(key1, "--movie-key1"), key2=parse_u32(key2, "--movie-key2"))
    return None


def iter_usm_chunks(data: bytes | bytearray) -> list[UsmChunk]:
    chunks: list[UsmChunk] = []
    offset = 0
    size = len(data)
    while offset + 0x20 <= size:
        magic = bytes(data[offset : offset + 4])
        if magic not in USM_SIGNATURES:
            raise ValueError(f"Unexpected USM chunk signature {magic!r} at 0x{offset:X}.")
        data_size = int.from_bytes(data[offset + 4 : offset + 8], "big")
        data_offset = data[offset + 9]
        padding_size = int.from_bytes(data[offset + 10 : offset + 12], "big")
        data_type = data[offset + 15] & 0x03
        payload_start = offset + 8 + data_offset
        payload_size = data_size - data_offset - padding_size
        next_offset = offset + 8 + data_size
        if data_size < data_offset + padding_size:
            raise ValueError(f"Invalid USM chunk size at 0x{offset:X}.")
        if payload_start < offset + 0x20 or payload_start + payload_size > size or next_offset > size:
            raise ValueError(f"USM chunk at 0x{offset:X} points outside the file.")
        chunks.append(
            UsmChunk(
                offset=offset,
                magic=magic,
                data_size=data_size,
                data_offset=data_offset,
                padding_size=padding_size,
                data_type=data_type,
                payload_start=payload_start,
                payload_size=payload_size,
                next_offset=next_offset,
            )
        )
        offset = next_offset
    if offset != size:
        raise ValueError(f"USM parse stopped at 0x{offset:X}, but file size is 0x{size:X}.")
    return chunks


def u8(value: int) -> int:
    return value & 0xFF


def build_cri_video_masks(key: MovieKey) -> tuple[bytearray, bytearray]:
    key1 = key.key1.to_bytes(4, "little")
    key2 = key.key2.to_bytes(4, "little")
    table = bytearray(0x20)
    table[0x00] = key1[0]
    table[0x01] = key1[1]
    table[0x02] = key1[2]
    table[0x03] = u8(key1[3] - 0x34)
    table[0x04] = u8(key2[0] + 0xF9)
    table[0x05] = key2[1] ^ 0x13
    table[0x06] = u8(key2[2] + 0x61)
    table[0x07] = table[0x00] ^ 0xFF
    table[0x08] = u8(table[0x02] + table[0x01])
    table[0x09] = u8(table[0x01] - table[0x07])
    table[0x0A] = table[0x02] ^ 0xFF
    table[0x0B] = table[0x01] ^ 0xFF
    table[0x0C] = u8(table[0x0B] + table[0x09])
    table[0x0D] = u8(table[0x08] - table[0x03])
    table[0x0E] = table[0x0D] ^ 0xFF
    table[0x0F] = u8(table[0x0A] - table[0x0B])
    table[0x10] = u8(table[0x08] - table[0x0F])
    table[0x11] = table[0x10] ^ table[0x07]
    table[0x12] = table[0x0F] ^ 0xFF
    table[0x13] = table[0x03] ^ 0x10
    table[0x14] = u8(table[0x04] - 0x32)
    table[0x15] = u8(table[0x05] + 0xED)
    table[0x16] = table[0x06] ^ 0xF3
    table[0x17] = u8(table[0x13] - table[0x0F])
    table[0x18] = u8(table[0x15] + table[0x07])
    table[0x19] = u8(0x21 - table[0x13])
    table[0x1A] = table[0x14] ^ table[0x17]
    table[0x1B] = u8(table[0x16] + table[0x16])
    table[0x1C] = u8(table[0x17] + 0x44)
    table[0x1D] = u8(table[0x03] + table[0x04])
    table[0x1E] = u8(table[0x05] - table[0x16])
    table[0x1F] = table[0x1D] ^ table[0x13]
    return table, bytearray(value ^ 0xFF for value in table)


def unmask_video_packet(data: bytearray, payload_start: int, payload_size: int, key: MovieKey) -> None:
    payload_start += 0x40
    payload_size -= 0x40
    if payload_size < 0x200:
        return

    video_mask1, video_mask2 = build_cri_video_masks(key)
    mask = bytearray(video_mask2)
    for i in range(0x100, payload_size):
        mask_index = i & 0x1F
        buffer_index = payload_start + i
        data[buffer_index] ^= mask[mask_index]
        mask[mask_index] = data[buffer_index] ^ video_mask2[mask_index]

    mask = bytearray(video_mask1)
    for i in range(0x100):
        mask_index = i & 0x1F
        mask[mask_index] ^= data[payload_start + 0x100 + i]
        data[payload_start + i] ^= mask[mask_index]


def unmask_usm(usm_path: Path, output_path: Path, key: MovieKey) -> tuple[int, int]:
    data = bytearray(usm_path.read_bytes())
    chunks = iter_usm_chunks(data)
    video_packets = 0
    audio_packets = 0
    for chunk in chunks:
        if chunk.magic == b"@SFV" and chunk.data_type == 0:
            unmask_video_packet(data, chunk.payload_start, chunk.payload_size, key)
            video_packets += 1
        elif chunk.magic == b"@SFA" and chunk.data_type == 0:
            audio_packets += 1
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(data)
    return video_packets, audio_packets


def audio_extension(payload: bytes) -> str:
    if payload.startswith(b"HCA"):
        return ".hca"
    if payload.startswith(b"CRI"):
        return ".adx"
    return ".bin"


def demux_usm(usm_path: Path, output_dir: Path, key: MovieKey | None) -> None:
    data = bytearray(usm_path.read_bytes())
    chunks = iter_usm_chunks(data)
    video_path = output_dir / f"{usm_path.stem}.h264"
    audio_file = None
    video_file = None
    try:
        for chunk in chunks:
            if chunk.data_type != 0:
                continue
            payload_start = chunk.payload_start
            payload_end = payload_start + chunk.payload_size
            if chunk.magic == b"@SFV":
                if key:
                    unmask_video_packet(data, payload_start, chunk.payload_size, key)
                if not video_file:
                    output_dir.mkdir(parents=True, exist_ok=True)
                    video_file = video_path.open("wb")
                video_file.write(data[payload_start:payload_end])
            elif chunk.magic == b"@SFA":
                if not audio_file:
                    output_dir.mkdir(parents=True, exist_ok=True)
                    extension = audio_extension(bytes(data[payload_start : payload_start + 16]))
                    audio_file = (output_dir / f"{usm_path.stem}{extension}").open("wb")
                audio_file.write(data[payload_start:payload_end])
    finally:
        if video_file:
            video_file.close()
        if audio_file:
            audio_file.close()


def summarize_stderr(stderr: str, limit: int = 12) -> str:
    lines = [line.strip() for line in stderr.splitlines() if line.strip()]
    if not lines:
        return ""
    if len(lines) <= limit:
        return "\n".join(lines)
    return "\n".join([*lines[:limit], f"... {len(lines) - limit} more lines omitted"])


def _frame_std(ffmpeg: Path, video_path: Path, frame_no: int) -> float:
    """Decode a single gray frame and return its pixel standard deviation.

    A correctly decrypted/decoded frame has real image content (high deviation).
    A wrong key / failed decryption decodes to near-uniform gray (deviation ~0).
    """
    command = [
        str(ffmpeg), "-hide_banner", "-v", "error",
        "-i", str(video_path),
        "-vf", f"select=gte(n\\,{frame_no})",
        "-vframes", "1", "-pix_fmt", "gray", "-f", "rawvideo", "-",
    ]
    result = subprocess.run(command, capture_output=True)
    px = result.stdout
    if not px:
        return -1.0
    sample = px[:262144]
    mean = sum(sample) / len(sample)
    return (sum((value - mean) ** 2 for value in sample) / len(sample)) ** 0.5


def validate_mp4(ffmpeg: Path, output_path: Path) -> tuple[bool, str]:
    """Validate that a video both decodes without errors AND has real content.

    Re-encoded MP4s are always structurally valid even when the source was
    decrypted with the wrong key, so a clean ffmpeg pass is not enough: we also
    require that sampled frames are not flat gray garbage.
    """
    command = [str(ffmpeg), "-v", "error", "-i", str(output_path), "-f", "null", "-"]
    result = subprocess.run(command, text=True, capture_output=True)
    stderr = result.stderr.strip()
    if result.returncode != 0 or stderr:
        return False, summarize_stderr(stderr)

    stds = [_frame_std(ffmpeg, output_path, n) for n in (15, 45, 90)]
    decoded = [s for s in stds if s >= 0]
    if not decoded:
        return False, "no frames could be decoded"
    if max(decoded) < 12.0:
        return False, f"frames are near-uniform (max pixel std {max(decoded):.2f}); likely wrong decryption"
    return True, ""


def validation_sidecar(output_path: Path) -> Path:
    return output_path.with_name(f"{output_path.name}.validated.json")


def write_validation_sidecar(
    output_path: Path,
    movie_path: str,
    source_path: Path,
    key: MovieKey | None,
    source_kind: str,
) -> None:
    sidecar = validation_sidecar(output_path)
    payload = {
        "validated": True,
        "movie_path": movie_path,
        "source_kind": source_kind,
        "source_path": str(source_path),
        "source_size": source_path.stat().st_size,
        "movie_key_supplied": key is not None,
    }
    sidecar.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def remove_validation_sidecar(output_path: Path) -> None:
    sidecar = validation_sidecar(output_path)
    if sidecar.exists():
        sidecar.unlink()


def convert_movie(ffmpeg: Path, input_path: Path, output_path: Path, overwrite: bool) -> tuple[bool, bool, str]:
    if output_path.exists() and not overwrite:
        valid, errors = validate_mp4(ffmpeg, output_path)
        if valid:
            return False, True, "already exists and validates"
        print(f"[warn] removing invalid existing MP4: {output_path}", file=sys.stderr)
        if errors:
            print(summarize_stderr(errors), file=sys.stderr)
        output_path.unlink()
        remove_validation_sidecar(output_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        str(ffmpeg),
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(input_path),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode != 0:
        if output_path.exists():
            output_path.unlink()
        remove_validation_sidecar(output_path)
        return False, False, summarize_stderr(result.stderr)

    valid, errors = validate_mp4(ffmpeg, output_path)
    if not valid:
        if output_path.exists():
            output_path.unlink()
        remove_validation_sidecar(output_path)
        return False, False, errors or "ffmpeg validation failed"

    return True, True, "converted and validated"


def is_inside(path: Path, parent: Path) -> bool:
    resolved_path = path.resolve()
    resolved_parent = parent.resolve()
    try:
        resolved_path.relative_to(resolved_parent)
        return True
    except ValueError:
        return False


def playable_relative_path(movie_path: str) -> Path:
    return Path(*playable_path(movie_path).split("/"))


def find_imported_mp4(movie_path: str, import_dirs: list[Path], recursive: bool) -> Path | None:
    relative_path = playable_relative_path(movie_path)
    file_name = relative_path.name
    for import_dir in import_dirs:
        direct_candidates = [
            import_dir / relative_path,
            import_dir / file_name,
        ]
        for candidate in direct_candidates:
            if candidate.is_file():
                return candidate
        if recursive and import_dir.exists():
            for candidate in import_dir.rglob(file_name):
                if candidate.is_file():
                    return candidate
    return None


def import_playable_mp4(
    ffmpeg: Path,
    imported_path: Path,
    output_path: Path,
    movie_path: str,
    overwrite: bool,
) -> tuple[bool, bool, str]:
    valid, errors = validate_mp4(ffmpeg, imported_path)
    if not valid:
        return False, False, errors or "import candidate did not validate"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not overwrite:
        output_valid, output_errors = validate_mp4(ffmpeg, output_path)
        trusted_output = output_valid and validation_sidecar(output_path).exists()
        if trusted_output:
            return False, True, "already exists and validates"
        if output_errors:
            print(f"[warn] replacing unvalidated MP4 for {movie_path}: {summarize_stderr(output_errors, 4)}", file=sys.stderr)

    if imported_path.resolve() != output_path.resolve():
        shutil.copy2(imported_path, output_path)
    return True, True, "imported and validated"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Extract cached CRI USM summon movies into browser-playable MP4 files. "
            "Game USMs are containers, and these summon files may need a CRI movie key before ffmpeg can decode them."
        )
    )
    parser.add_argument("--summon-data", type=Path, default=DEFAULT_SUMMON_DATA)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR, help="Pulled emulator CriSound directory.")
    parser.add_argument("--public-dir", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--work-dir", type=Path, default=DEFAULT_WORK_DIR)
    parser.add_argument("--ffmpeg", type=Path, default=None)
    parser.add_argument(
        "--movie-key",
        default=DEFAULT_MOVIE_KEY,
        help=f"64-bit CRI movie key (default: verified game key {DEFAULT_MOVIE_KEY}).",
    )
    parser.add_argument("--movie-key1", default=None, help="Low 32-bit CRI key part used by crid_mod -a.")
    parser.add_argument("--movie-key2", default=None, help="High 32-bit CRI key part used by crid_mod -b.")
    parser.add_argument(
        "--import-mp4-dir",
        type=Path,
        action="append",
        default=[],
        help="Directory containing already-playable MP4s named like the summon movie stem.",
    )
    parser.add_argument("--recursive-import-search", action="store_true")
    parser.add_argument("--allow-raw-ffmpeg", action="store_true", help="Try direct ffmpeg conversion without a movie key.")
    parser.add_argument("--extract-tracks", action="store_true", help="Also write raw .h264 and audio tracks for inspection.")
    parser.add_argument("--keep-decrypted-usm", action="store_true", help="Keep temporary unmasked USM files in --work-dir.")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--fail-on-corrupt", action="store_true", help="Exit non-zero if a cached movie cannot be converted cleanly.")
    args = parser.parse_args()

    if not args.cache_dir.exists():
        raise SystemExit(f"Missing cache directory: {args.cache_dir}")
    if not is_inside(args.public_dir, PROJECT_DIR):
        raise SystemExit(f"Refusing to write outside the project public directory: {args.public_dir}")

    key = parse_movie_key(args.movie_key, args.movie_key1, args.movie_key2)
    ffmpeg = find_ffmpeg(args.ffmpeg) if key or args.allow_raw_ffmpeg or args.import_mp4_dir else None
    converted = 0
    imported = 0
    skipped = 0
    missing = 0
    failed = 0

    if not key and not args.allow_raw_ffmpeg:
        print(
            "[info] no CRI movie key supplied; cached USM files will be demuxed only if --extract-tracks is set, "
            "and MP4 conversion will be skipped to avoid publishing corrupt direct ffmpeg output."
        )

    for movie_path in collect_banner_movies(args.summon_data):
        key_hash = cache_key(movie_path)
        output_path = args.public_dir / playable_path(movie_path)
        if not is_inside(output_path, args.public_dir):
            failed += 1
            print(f"[warn] refusing unsafe output path for {movie_path}: {output_path}", file=sys.stderr)
            continue

        imported_mp4 = find_imported_mp4(movie_path, args.import_mp4_dir, args.recursive_import_search)
        if imported_mp4:
            if not ffmpeg:
                raise RuntimeError("ffmpeg should have been resolved before importing MP4s.")
            did_import, valid_output, message = import_playable_mp4(
                ffmpeg,
                imported_mp4,
                output_path,
                movie_path,
                args.overwrite,
            )
            if did_import:
                imported += 1
                write_validation_sidecar(output_path, movie_path, imported_mp4, None, "imported_mp4")
                print(f"imported {movie_path} <- {imported_mp4}")
                continue
            if valid_output:
                skipped += 1
                write_validation_sidecar(output_path, movie_path, imported_mp4, None, "imported_mp4")
                print(f"skipped {movie_path}: {message}")
                continue
            print(f"[warn] import candidate failed for {movie_path}: {message}", file=sys.stderr)

        cache_subdir = args.cache_dir / key_hash
        usm_files = sorted(cache_subdir.glob("*.usm"))
        if not usm_files:
            missing += 1
            continue

        usm_path = usm_files[0]
        input_path = usm_path
        decrypted_path = args.work_dir / "decrypted_usm" / key_hash / usm_path.name
        if key:
            try:
                video_packets, audio_packets = unmask_usm(usm_path, decrypted_path, key)
                input_path = decrypted_path
                print(f"unmasked {movie_path}: {video_packets} video packets, {audio_packets} audio packets")
            except ValueError as error:
                failed += 1
                print(f"[warn] could not parse {usm_path}: {error}", file=sys.stderr)
                continue
        elif not args.allow_raw_ffmpeg:
            skipped += 1
            print(f"skipped {movie_path}: cache contains USM, but no --movie-key was supplied")
            if args.extract_tracks:
                demux_usm(usm_path, args.work_dir / "tracks" / key_hash, key)
            continue

        if args.extract_tracks:
            demux_usm(input_path, args.work_dir / "tracks" / key_hash, None)

        if not ffmpeg:
            raise RuntimeError("ffmpeg should have been resolved before conversion.")
        did_convert, valid_output, message = convert_movie(ffmpeg, input_path, output_path, args.overwrite)
        if did_convert:
            converted += 1
            write_validation_sidecar(output_path, movie_path, usm_path, key, "cache_usm")
            print(f"converted {movie_path} -> {output_path.relative_to(args.public_dir)}")
        elif valid_output:
            skipped += 1
            write_validation_sidecar(output_path, movie_path, usm_path, key, "cache_usm")
            print(f"skipped {movie_path}: {message}")
        else:
            failed += 1
            print(f"[warn] failed {movie_path}: {message}", file=sys.stderr)

        if key and decrypted_path.exists() and not args.keep_decrypted_usm:
            decrypted_path.unlink()

    print(f"imported {imported}, converted {converted}, skipped {skipped}, failed {failed}, missing cache entries {missing}")
    if args.fail_on_corrupt and failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
