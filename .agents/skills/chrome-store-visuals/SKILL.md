---
name: chrome-store-visuals
description: Generate X Unfollow Radar Chrome Web Store screenshots and promotional tiles from newly supplied popup screenshots. Use when the user provides updated Main, Filters, or Statistics screenshots or asks to refresh the store visuals in the established project format.
---

# Chrome Store Visuals

Create a consistent five-file Chrome Web Store asset set from the user's latest X Unfollow Radar popup screenshots.

## Inputs

- Inspect every supplied screenshot before changing files.
- Identify its destination from the active popup tab: `Main`, `Filters`, or `Statistics`.
- If the tab is unambiguous, proceed without asking. Ask only when a screenshot cannot be mapped safely.
- Replace only the supplied canonical sources:
  - `assets/store-source/popup-main-en.png`
  - `assets/store-source/popup-filters-en.png`
  - `assets/store-source/popup-stats-en.png`
- Keep the latest unsupplied canonical source so partial refreshes remain possible.

Preserve the screenshot content exactly. Do not redraw, retouch, translate, invent state, hide UI, or alter counters. Cropping browser chrome or empty margins is allowed only when it leaves the popup intact.

## Generate

Use the repository's deterministic compositor:

```bash
python3 scripts/generate-store-assets.py
```

Keep `assets/store-source/radar-gradient-v2.png` as the background and keep the existing English copy, layout, typography, colors, corner treatment, and shadows unless the user explicitly requests a design change. Do not invoke ImageGen for an ordinary screenshot refresh.

The required outputs are:

- `assets/store-screenshots/store-screenshot-main-en-1280x800-v2.png`
- `assets/store-screenshots/store-screenshot-filters-en-1280x800-v2.png`
- `assets/store-screenshots/store-screenshot-stats-en-1280x800-v2.png`
- `assets/promo/x-unfollow-radar-tile-en-440x280-v2.png`
- `assets/promo/x-unfollow-radar-hero-en-1400x560-v2.png`

## Verify and deliver

Run the skill validator:

```bash
python3 .agents/skills/chrome-store-visuals/scripts/validate_outputs.py
```

It must confirm exact dimensions, PNG format, and RGB color without alpha. Visually inspect all five generated files and fix clipping, illegible text, distorted screenshots, or stale UI before delivery.

Create or refresh the upload bundle after validation:

```bash
python3 -m zipfile -c x-unfollow-radar-store-assets-v2.zip \
  assets/store-screenshots/store-screenshot-main-en-1280x800-v2.png \
  assets/store-screenshots/store-screenshot-filters-en-1280x800-v2.png \
  assets/store-screenshots/store-screenshot-stats-en-1280x800-v2.png \
  assets/promo/x-unfollow-radar-tile-en-440x280-v2.png \
  assets/promo/x-unfollow-radar-hero-en-1400x560-v2.png
```

Report clickable paths for the five assets and ZIP. Follow the user's current commit and push instruction; the ZIP is intentionally ignored by Git.
