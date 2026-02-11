#!/usr/bin/env python3
"""
extract-maps.py — Extract continent map PNGs from WoW 3.3.5a client MPQ archives.

Pipeline: MPQ archives (Data/ + Data/enUS/) → BLP tiles → Pillow → stitch → PNG

Usage:
    python3 tools/extract-maps.py [/path/to/WoW/Data]

Default Data path: /home/knat/Downloads/ChromieCraft_3.3.5a/Data

Dependencies:
    pip install mpyq Pillow
"""

import os
import sys
import struct
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
OUTPUT_DIR = SCRIPT_DIR.parent / "apps" / "web" / "public" / "maps"

TILE_WIDTH = 256
TILE_HEIGHT = 256
TILES_X = 4
TILES_Y = 3
IMAGE_WIDTH = TILE_WIDTH * TILES_X   # 1024
IMAGE_HEIGHT = TILE_HEIGHT * TILES_Y  # 768

CONTINENTS = [
    {"name": "Eastern Kingdoms", "key": "eastern-kingdoms", "folder": "Azeroth",      "stem": "Azeroth",      "mapId": 0},
    {"name": "Kalimdor",         "key": "kalimdor",         "folder": "Kalimdor",     "stem": "Kalimdor",     "mapId": 1},
    {"name": "Outland",          "key": "outland",          "folder": "Expansion01",  "stem": "Expansion01",  "mapId": 530},
    {"name": "Northrend",        "key": "northrend",        "folder": "Northrend",    "stem": "Northrend",    "mapId": 571},
]

# MPQ load order — later archives override earlier ones.
# We search both Data/ and Data/<locale>/ directories.
MPQ_LOAD_ORDER = [
    # Base data
    ("", "common.MPQ"),
    ("", "common-2.MPQ"),
    ("", "expansion.MPQ"),
    ("", "lichking.MPQ"),
    ("", "patch.MPQ"),
    ("", "patch-2.MPQ"),
    ("", "patch-3.MPQ"),
    # Locale data (Interface/WorldMap tiles live here)
    ("enUS", "locale-enUS.MPQ"),
    ("enUS", "expansion-locale-enUS.MPQ"),
    ("enUS", "lichking-locale-enUS.MPQ"),
    ("enUS", "patch-enUS.MPQ"),
    ("enUS", "patch-enUS-2.MPQ"),
    ("enUS", "patch-enUS-3.MPQ"),
]


def parse_world_map_area_dbc(data: bytes):
    """Parse WorldMapArea.dbc for continent coordinate bounds."""
    magic = data[:4]
    if magic != b"WDBC":
        print(f"  Not a WDBC file (magic: {magic})")
        return []

    record_count = struct.unpack_from("<I", data, 4)[0]
    record_size = struct.unpack_from("<I", data, 12)[0]
    string_block_size = struct.unpack_from("<I", data, 16)[0]

    header_size = 20
    string_block_offset = header_size + record_count * record_size

    entries = []
    for i in range(record_count):
        offset = header_size + i * record_size
        entry_id = struct.unpack_from("<I", data, offset)[0]
        map_id = struct.unpack_from("<I", data, offset + 4)[0]
        area_id = struct.unpack_from("<I", data, offset + 8)[0]

        name_offset = struct.unpack_from("<I", data, offset + 12)[0]
        area_name = ""
        if name_offset < string_block_size:
            str_start = string_block_offset + name_offset
            str_end = data.index(b"\x00", str_start)
            area_name = data[str_start:str_end].decode("utf-8", errors="replace")

        loc_left = struct.unpack_from("<f", data, offset + 16)[0]
        loc_right = struct.unpack_from("<f", data, offset + 20)[0]
        loc_top = struct.unpack_from("<f", data, offset + 24)[0]
        loc_bottom = struct.unpack_from("<f", data, offset + 28)[0]

        entries.append({
            "id": entry_id, "mapId": map_id, "areaId": area_id,
            "areaName": area_name,
            "locLeft": loc_left, "locRight": loc_right,
            "locTop": loc_top, "locBottom": loc_bottom,
        })

    return entries


def main():
    data_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATA_PATH

    if not os.path.isdir(data_path):
        print(f"Data directory not found: {data_path}")
        print("Usage: python3 tools/extract-maps.py [/path/to/WoW/Data]")
        sys.exit(1)

    print(f"Data path: {data_path}")
    print(f"Output dir: {OUTPUT_DIR}\n")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Open all MPQ archives ──

    archives = []
    for subdir, mpq_name in MPQ_LOAD_ORDER:
        mpq_path = os.path.join(data_path, subdir, mpq_name) if subdir else os.path.join(data_path, mpq_name)
        if not os.path.exists(mpq_path):
            continue
        try:
            print(f"  Opening {os.path.join(subdir, mpq_name) if subdir else mpq_name}...")
            archive = mpyq.MPQArchive(mpq_path, listfile=False)
            archives.append((mpq_name, archive))
        except Exception as e:
            print(f"  Warning: failed to open {mpq_name}: {e}")

    if not archives:
        print("No MPQ archives found!")
        sys.exit(1)

    print(f"\n  Loaded {len(archives)} MPQ archives")

    def read_from_mpq(file_path: str) -> bytes | None:
        """Read a file from archives (last match wins = highest priority).
        Tries the path as-is, then with uppercase WORLDMAP variant."""
        variants = [file_path]
        # WoW MPQs sometimes use uppercase WORLDMAP
        if "WorldMap" in file_path:
            variants.append(file_path.replace("WorldMap", "WORLDMAP"))

        for variant in variants:
            for _name, archive in reversed(archives):
                try:
                    data = archive.read_file(variant)
                    if data:
                        return data
                except Exception:
                    continue
        return None

    # ── Step 2: Parse WorldMapArea.dbc for coordinate bounds ──

    print("\nParsing WorldMapArea.dbc...")
    wma_data = read_from_mpq("DBFilesClient\\WorldMapArea.dbc")
    if wma_data:
        all_entries = parse_world_map_area_dbc(wma_data)
        continent_entries = [e for e in all_entries if e["areaId"] == 0 and e["locLeft"] != 0]

        # Build a mapId → bounds lookup
        dbc_bounds = {e["mapId"]: e for e in continent_entries}

        print("\n  Continent-level WorldMapArea bounds (areaID=0):")
        print("  ─────────────────────────────────────────────────")
        for e in continent_entries:
            print(f'  MapID={e["mapId"]:>3}  "{e["areaName"]}"')
            print(f'         locLeft={e["locLeft"]:.2f}  locRight={e["locRight"]:.2f}')
            print(f'         locTop={e["locTop"]:.2f}   locBottom={e["locBottom"]:.2f}')

        # Print ready-to-paste TypeScript values
        print("\n  Ready-to-paste coordinate values for map-bounds.ts:")
        print("  ───────────────────────────────────────────────────")
        for c in CONTINENTS:
            bounds = dbc_bounds.get(c["mapId"])
            if bounds:
                print(f'  {{ id: {c["mapId"]}, name: \'{c["name"]}\', key: \'{c["key"]}\',')
                print(f'    imageWidth: 1024, imageHeight: 768,')
                print(f'    locLeft: {bounds["locLeft"]}, locRight: {bounds["locRight"]},')
                print(f'    locTop: {bounds["locTop"]}, locBottom: {bounds["locBottom"]} }},')
    else:
        print("  WorldMapArea.dbc not found in any MPQ archive")
        dbc_bounds = {}

    # ── Step 3: Extract and stitch continent map tiles ──

    success_count = 0
    for continent in CONTINENTS:
        print(f"\nExtracting {continent['name']}...")
        canvas = Image.new("RGBA", (IMAGE_WIDTH, IMAGE_HEIGHT), (0, 0, 0, 255))
        tiles_found = 0

        for tile_idx in range(1, TILES_X * TILES_Y + 1):
            file_path = f"Interface\\WorldMap\\{continent['folder']}\\{continent['stem']}{tile_idx}.blp"
            blp_data = read_from_mpq(file_path)

            if not blp_data:
                print(f"  Missing tile {tile_idx}: {file_path}")
                continue

            try:
                tile_img = Image.open(io.BytesIO(blp_data))
                tile_img = tile_img.convert("RGBA")

                col = (tile_idx - 1) % TILES_X
                row = (tile_idx - 1) // TILES_X
                canvas.paste(tile_img, (col * TILE_WIDTH, row * TILE_HEIGHT))
                tiles_found += 1
            except Exception as e:
                print(f"  Failed to decode tile {tile_idx}: {e}")

        if tiles_found == 0:
            print(f"  No tiles found for {continent['name']}, skipping")
            continue

        output_path = OUTPUT_DIR / f"{continent['key']}.png"
        canvas.save(str(output_path), "PNG", optimize=True)
        size_kb = os.path.getsize(output_path) / 1024
        status = "complete" if tiles_found == TILES_X * TILES_Y else f"partial ({tiles_found}/{TILES_X * TILES_Y})"
        print(f"  -> {output_path.name} ({size_kb:.0f} KB, {status})")
        success_count += 1

    # ── Summary ──

    print(f"\n{'=' * 60}")
    print(f"Extracted {success_count}/{len(CONTINENTS)} continent maps to {OUTPUT_DIR}")
    if success_count < len(CONTINENTS):
        print("Tip: Missing tiles may be in locale-specific MPQ files.")
        print("     Make sure Data/enUS/ (or your locale) exists.")
    print()


if __name__ == "__main__":
    main()
