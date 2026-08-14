"""Clean raw Amap subway JSON into frontend-ready datasets.

Raw files (work/raw/<city>.json) are produced by fetch_subway_data.py.
Outputs:
  - data/cities.json           -> summary for the national overview map
  - data/cities/<pinyin>.json  -> per-city detail (lines, stations, paths)

Field notes on the raw Amap format:
  - top-level: "i" city id, "s" city display name, "o" screen offset, "l" lines
  - line: "ls" line id, "ln" short name, "kn" display name, "cl" color hex,
          "st" stations, "c" schematic polyline ("x y" strings)
  - station: "si" id, "n" name, "p" schematic x/y, "sl" real lng/lat,
             "t" transfer flag, "su" active flag
The schematic coordinates are the same ones Amap's own page draws; real
lng/lat is kept alongside for the national map and tooltips.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

RAW_DIR = Path("work/raw")
OUT_DIR = Path("data")
CITY_DIR = OUT_DIR / "cities"

# Fallback palette for lines whose raw color is missing.
FALLBACK_COLORS = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
]


def parse_xy(value: str) -> tuple[float, float]:
    x, y = value.split()
    return float(x), float(y)


def haversine_km(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def line_path(line: dict) -> list[list[float]]:
    """Schematic polyline: prefer line["c"], fall back to f-segments, then stations."""
    for key in ("c",):
        raw = line.get(key)
        if raw:
            try:
                return [list(parse_xy(p)) for p in raw]
            except (ValueError, AttributeError):
                pass
    segs = line.get("f") or []
    pts: list[list[float]] = []
    for seg in segs:
        for p in seg.get("c", []):
            try:
                pts.append(list(parse_xy(p)))
            except (ValueError, AttributeError):
                continue
    if pts:
        return pts
    return [[float(st["p"].split()[0]), float(st["p"].split()[1])] for st in line["st"] if st.get("p")]


def station_key(st: dict) -> str:
    return st.get("si") or f"{st.get('n')}@{st.get('p')}"


def clean_city(raw: dict, city_meta: dict) -> dict:
    lines: list[dict] = []
    stations_by_key: dict[str, dict] = {}
    order: list[str] = []

    for line in raw.get("l", []):
        if line.get("su") not in (None, "1"):
            continue
        line_id = line.get("ls", "")
        short_name = line.get("ln", "")
        path = line_path(line)
        station_keys: list[str] = []
        for st in line.get("st", []):
            if st.get("su") not in (None, "1"):
                continue
            key = station_key(st)
            station_keys.append(key)
            if key not in stations_by_key:
                x, y = (None, None)
                if st.get("p"):
                    try:
                        x, y = parse_xy(st["p"])
                    except ValueError:
                        pass
                lng, lat = (None, None)
                if st.get("sl") and "," in st["sl"]:
                    try:
                        lng, lat = (float(v) for v in st["sl"].split(","))
                    except ValueError:
                        pass
                stations_by_key[key] = {
                    "id": st.get("si", ""),
                    "name": st.get("n", ""),
                    "pinyin": st.get("sp", ""),
                    "x": x,
                    "y": y,
                    "lng": lng,
                    "lat": lat,
                    "transfer": st.get("t") == "1",
                    "lines": [],
                }
                order.append(key)
            stations_by_key[key]["lines"].append(
                {"id": line_id, "name": short_name}
            )

        lines.append(
            {
                "id": line_id,
                "name": short_name,
                "fullName": line.get("kn", short_name),
                "branch": line.get("la", ""),
                "color": f"#{line['cl']}" if line.get("cl") else FALLBACK_COLORS[len(lines) % len(FALLBACK_COLORS)],
                "path": path,
                "stationIds": station_keys,
            }
        )

    stations = [stations_by_key[k] for k in order]
    for st in stations:
        st["lines"] = sorted(st["lines"], key=lambda d: d["name"])
        st["lineIds"] = [d["id"] for d in st["lines"]]
        st["lineNames"] = [d["name"] for d in st["lines"]]

    # Estimated network length: unique consecutive station pairs across lines,
    # using real lng/lat so the number is roughly the physical network length.
    unique_segments: set[tuple[str, str]] = set()
    est_km = 0.0
    for line in lines:
        ids = line["stationIds"]
        for a, b in zip(ids, ids[1:]):
            pair = tuple(sorted((a, b)))
            if pair in unique_segments:
                continue
            unique_segments.add(pair)
            sa, sb = stations_by_key.get(a), stations_by_key.get(b)
            if not sa or not sb or None in (sa["lng"], sa["lat"], sb["lng"], sb["lat"]):
                continue
            est_km += haversine_km(sa["lng"], sa["lat"], sb["lng"], sb["lat"])

    lngs = [s["lng"] for s in stations if s["lng"] is not None]
    lats = [s["lat"] for s in stations if s["lat"] is not None]
    center = (
        {"lng": sum(lngs) / len(lngs), "lat": sum(lats) / len(lats)} if lngs and lats else None
    )
    bounds = (
        {"minLng": min(lngs), "maxLng": max(lngs), "minLat": min(lats), "maxLat": max(lats)}
        if lngs and lats
        else None
    )

    city_name = city_meta["name"]
    return {
        "id": raw.get("i", city_meta["id"]),
        "name": city_name,
        "pinyin": city_meta["pinyin"],
        "adcode": raw.get("i", city_meta["id"]),
        "rawName": raw.get("s", ""),
        "center": center,
        "bounds": bounds,
        "stats": {
            "lineCount": len(lines),
            "stationCount": len(stations),
            "transferCount": sum(1 for s in stations if s["transfer"]),
            "estimatedNetworkKm": round(est_km, 1),
            "estimated": True,
        },
        "lines": lines,
        "stations": stations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    raw_dir = args.raw_dir
    out_dir = args.out_dir
    city_dir = out_dir / "cities"
    city_dir.mkdir(parents=True, exist_ok=True)

    cities_meta = json.loads((raw_dir / "cities_raw.json").read_text(encoding="utf-8"))
    summary: list[dict] = []
    problems: list[str] = []

    for meta in cities_meta:
        raw_path = raw_dir / f"{meta['pinyin']}.json"
        if not raw_path.exists():
            problems.append(f"{meta['name']}: raw file missing")
            continue
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
        city = clean_city(raw, meta)

        out_path = city_dir / f"{meta['pinyin']}.json"
        out_path.write_text(json.dumps(city, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

        st = city["stats"]
        summary.append(
            {
                "id": city["id"],
                "name": city["name"],
                "pinyin": city["pinyin"],
                "adcode": city["adcode"],
                "lng": city["center"]["lng"] if city["center"] else None,
                "lat": city["center"]["lat"] if city["center"] else None,
                **st,
            }
        )
        flag = ""
        if st["stationCount"] == 0 or st["lineCount"] == 0:
            flag = "  <-- EMPTY"
            problems.append(f"{city['name']}: no lines/stations parsed")
        print(f"{city['name']:6s} lines={st['lineCount']:3d} stations={st['stationCount']:4d} "
              f"transfers={st['transferCount']:3d} estKm={st['estimatedNetworkKm']:7.1f}{flag}")

    summary.sort(key=lambda c: c["stationCount"], reverse=True)
    (out_dir / "cities.json").write_text(
        json.dumps(summary, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"\nSummary written to {out_dir / 'cities.json'} "
          f"({len(summary)} cities); per-city files under {city_dir}")
    if problems:
        print("Problems:")
        for p in problems:
            print("  -", p)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
