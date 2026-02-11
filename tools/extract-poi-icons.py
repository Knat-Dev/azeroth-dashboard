#!/usr/bin/env python3
"""
extract-poi-icons.py — Extract world map POI icons from WoW 3.3.5a client.

Reads Interface/Minimap/POIIcons.blp from MPQ archives, then crops out
the town (house) and city (fort) icons for each faction.

Atlas layout: 14 columns, 18x18 px cells, 16x16 visible icon (1px padding).

Icon indices (from AreaPOI.dbc — WoW uses ONE icon per type, no faction coloring):
  5: Town (yellow thatched house)   — all towns regardless of faction
  6: City (grey stone castle)       — all capital cities regardless of faction

Usage:
    python3 tools/extract-poi-icons.py [/path/to/WoW/Data]

Dependencies:
    pip install mpyq Pillow
"""

import os
import sys
import io
from pathlib import Path

try:
    import mpyq
except ImportError:
    print("ERROR: mpyq not installed. Run: pip install mpyq")
    sys.exit(1)

try:
    from PIL import Image, BlpImagePlugin  # noqa: F401
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

# ── Config ──

DEFAULT_DATA_PATH = "/home/knat/Downloads/ChromieCraft_3.3.5a/Data"
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "apps" / "web" / "public" / "maps" / "icons"

# Atlas constants (from WorldMapFrame.lua)
NUM_COLUMNS = 14
CELL_SIZE = 18       # Each icon cell in the atlas
ICON_SIZE = 16       # Visible icon area (1px padding each side)
PADDING = (CELL_SIZE - ICON_SIZE) // 2  # = 1

# Icons to extract: (atlas_index, output_filename)
ICONS_TO_EXTRACT = [
    (5, "town"),
    (6, "city"),
]

# Scale factor — 16x16 is tiny for a web map, scale up for crisp display
SCALE = 2  # → 32x32 output

MPQ_LOAD_ORDER = [
    ("", "common.MPQ"),
    ("", "common-2.MPQ"),
    ("", "expansion.MPQ"),
    ("", "lichking.MPQ"),
    ("", "patch.MPQ"),
    ("", "patch-2.MPQ"),
    ("", "patch-3.MPQ"),
    ("enUS", "locale-enUS.MPQ"),
    ("enUS", "expansion-locale-enUS.MPQ"),
    ("enUS", "lichking-locale-enUS.MPQ"),
    ("enUS", "patch-enUS.MPQ"),
    ("enUS", "patch-enUS-2.MPQ"),
    ("enUS", "patch-enUS-3.MPQ"),
]


def main():
    data_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATA_PATH

    if not os.path.isdir(data_path):
        print(f"Data directory not found: {data_path}")
        sys.exit(1)

    print(f"Data path: {data_path}")
    print(f"Output dir: {OUTPUT_DIR}\n")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Open MPQ archives
    archives = []
    for subdir, mpq_name in MPQ_LOAD_ORDER:
        mpq_path = os.path.join(data_path, subdir, mpq_name) if subdir else os.path.join(data_path, mpq_name)
        if not os.path.exists(mpq_path):
            continue
        try:
            archive = mpyq.MPQArchive(mpq_path, listfile=False)
            archives.append((mpq_name, archive))
        except Exception:
            continue

    if not archives:
        print("No MPQ archives found!")
        sys.exit(1)

    print(f"Loaded {len(archives)} MPQ archives")

    # Read POIIcons.blp (last match wins = highest priority)
    poi_data = None
    file_path = "Interface\\Minimap\\POIIcons.blp"
    for _name, archive in reversed(archives):
        try:
            data = archive.read_file(file_path)
            if data:
                poi_data = data
                break
        except Exception:
            continue

    if not poi_data:
        print(f"Could not find {file_path} in any MPQ archive!")
        sys.exit(1)

    atlas = Image.open(io.BytesIO(poi_data)).convert("RGBA")
    print(f"POIIcons atlas: {atlas.width}x{atlas.height}")

    # Also save the full atlas for reference
    atlas.save(str(OUTPUT_DIR / "_poi-atlas-debug.png"), "PNG")
    print(f"Saved full atlas as _poi-atlas-debug.png for reference")

    # Extract individual icons
    for index, name in ICONS_TO_EXTRACT:
        col = index % NUM_COLUMNS
        row = index // NUM_COLUMNS

        # Crop the 16x16 icon area (skip 1px padding)
        x1 = col * CELL_SIZE + PADDING
        y1 = row * CELL_SIZE + PADDING
        x2 = x1 + ICON_SIZE
        y2 = y1 + ICON_SIZE

        icon = atlas.crop((x1, y1, x2, y2))

        # Scale up for web display
        if SCALE > 1:
            icon = icon.resize(
                (ICON_SIZE * SCALE, ICON_SIZE * SCALE),
                Image.NEAREST,  # Nearest-neighbor preserves pixel art
            )

        output_path = OUTPUT_DIR / f"{name}.png"
        icon.save(str(output_path), "PNG")
        print(f"  {name}.png ({ICON_SIZE * SCALE}x{ICON_SIZE * SCALE}) — index {index} (row {row}, col {col})")

    print(f"\nExtracted {len(ICONS_TO_EXTRACT)} POI icons to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
