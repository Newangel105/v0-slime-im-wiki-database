from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Embed exported Loup Loupe manual routes into loup-loupe-browser.tsx and disable the editor."
    )
    parser.add_argument("routes_json", type=Path, help="JSON exported from the Route Editor")
    parser.add_argument("tsx_file", type=Path, help="Path to loup-loupe-browser.tsx")
    parser.add_argument("--output", type=Path, default=None, help="Output file. Defaults to overwriting tsx_file.")
    args = parser.parse_args()

    routes = json.loads(args.routes_json.read_text(encoding="utf-8"))
    if not isinstance(routes, list):
        raise SystemExit("The route export must be a JSON array.")

    formatted = json.dumps(routes, indent=2, ensure_ascii=False)
    # Quote object keys are valid JS/TS and easier to diff.
    replacement = f"const HARD_CODED_ROUTES: RouteDefinition[] = {formatted};"

    tsx = args.tsx_file.read_text(encoding="utf-8")
    tsx, count = re.subn(
        r"const HARD_CODED_ROUTES: RouteDefinition\[\] = \[[\s\S]*?\];",
        replacement,
        tsx,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not find HARD_CODED_ROUTES in the TSX file.")

    tsx, count = re.subn(
        r"const ENABLE_ROUTE_EDITOR = true;",
        "const ENABLE_ROUTE_EDITOR = false;",
        tsx,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not find ENABLE_ROUTE_EDITOR = true in the TSX file.")

    output = args.output or args.tsx_file
    output.write_text(tsx, encoding="utf-8")
    print(f"Wrote production route file: {output}")


if __name__ == "__main__":
    main()
