"""Fetch nationwide subway data from Amap's public subway page.

Sources:
  - City list:      http://map.amap.com/subway/index.html
  - City data:      http://map.amap.com/subway/service/subway?srhdata=<id>_drw_<city>.json

The endpoint is the same JSON the official page consumes (map.amap.com/subway).
Only the data already public on that page is fetched; no API key is required.
Usage:
    python scripts/fetch_subway_data.py [--raw-dir work/raw] [--force]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE_URL = "http://map.amap.com/subway"
INDEX_URL = f"{BASE_URL}/index.html"
DATA_URL = "http://map.amap.com/service/subway?_%d&srhdata={id}_drw_{name}.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Referer": INDEX_URL,
    "Accept": "application/json, text/javascript, */*; q=0.01",
}

# Matches anchors like:
#   <a class="city" href="javascript:void(0)" id="1100" cityname="beijing">北京</a>
#   <a class="other-city" ... id="5000" cityname="chongqing">重庆</a>
ANCHOR_RE = re.compile(
    r'<a[^>]*class="[^"]*(?:city|other-city)[^"]*"[^>]*id="(\d+)"'
    r'[^>]*cityname="([a-z]+)"[^>]*>([^<]+)</a>'
)


def http_get(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def get_city_list() -> list[dict]:
    html = http_get(INDEX_URL).decode("utf-8", errors="replace")
    cities: list[dict] = []
    seen: set[str] = set()
    for match in ANCHOR_RE.finditer(html):
        city_id, pinyin, name = match.groups()
        name = name.strip()
        if city_id in seen:
            continue
        seen.add(city_id)
        cities.append({"id": city_id, "pinyin": pinyin, "name": name})
    if not cities:
        raise RuntimeError("No cities parsed from index page; page layout may have changed.")
    return cities


def fetch_city(city: dict, raw_dir: Path, force: bool = False) -> tuple[bool, str]:
    out = raw_dir / f"{city['pinyin']}.json"
    if out.exists() and not force:
        return True, f"{city['name']}: cached, skip"
    url = DATA_URL.format(int(time.time() * 1000), id=city["id"], name=city["pinyin"])
    try:
        body = http_get(url)
        payload = json.loads(body.decode("utf-8", errors="replace"))
        if not isinstance(payload, dict) or "l" not in payload:
            raise ValueError(f"Unexpected payload shape: {str(payload)[:120]}")
        out.write_bytes(body)
        return True, f"{city['name']}: OK ({len(payload['l'])} lines, {len(body)} bytes)"
    except Exception as exc:  # noqa: BLE001 - report and continue
        return False, f"{city['name']}: FAILED ({exc})"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=Path("work/raw"))
    parser.add_argument("--delay", type=float, default=0.4, help="seconds between requests")
    parser.add_argument("--force", action="store_true", help="refetch even if cached")
    args = parser.parse_args()

    raw_dir = args.raw_dir
    raw_dir.mkdir(parents=True, exist_ok=True)

    cities = get_city_list()
    (raw_dir / "cities_raw.json").write_text(
        json.dumps(cities, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"[city list] {len(cities)} cities -> {raw_dir / 'cities_raw.json'}")

    ok = failed = 0
    for i, city in enumerate(cities, 1):
        success, message = fetch_city(city, raw_dir, force=args.force)
        ok += success
        failed += not success
        print(f"[{i:02d}/{len(cities)}] {message}", flush=True)
        if i < len(cities):
            time.sleep(args.delay)

    print(f"\nDone: {ok} OK, {failed} failed (see messages above).")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
