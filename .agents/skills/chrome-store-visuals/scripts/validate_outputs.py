#!/usr/bin/env python3
"""Validate the Chrome Web Store visual asset set."""

from pathlib import Path
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[4]
EXPECTED = {
    "assets/store-screenshots/store-screenshot-main-en-1280x800-v2.png": (1280, 800),
    "assets/store-screenshots/store-screenshot-filters-en-1280x800-v2.png": (1280, 800),
    "assets/store-screenshots/store-screenshot-stats-en-1280x800-v2.png": (1280, 800),
    "assets/promo/x-unfollow-radar-tile-en-440x280-v2.png": (440, 280),
    "assets/promo/x-unfollow-radar-hero-en-1400x560-v2.png": (1400, 560),
}


def main() -> int:
    errors = []

    for relative_path, expected_size in EXPECTED.items():
        path = ROOT / relative_path
        if not path.is_file():
            errors.append(f"missing: {relative_path}")
            continue

        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                if image.format != "PNG":
                    errors.append(f"{relative_path}: format={image.format}, expected PNG")
                if image.size != expected_size:
                    errors.append(
                        f"{relative_path}: size={image.size}, expected {expected_size}"
                    )
                if image.mode != "RGB":
                    errors.append(f"{relative_path}: mode={image.mode}, expected RGB")
        except OSError as error:
            errors.append(f"{relative_path}: unreadable PNG ({error})")

    if errors:
        print("Store asset validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Validated {len(EXPECTED)} Chrome Web Store assets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
