#!/usr/bin/env python3
"""Show tracks with duplicate or similar looking titles."""

import json
import os
import re
import shlex
import subprocess
import sys

MUSICSERVER = shlex.split(os.environ.get("MUSICSERVER", "musicserver"))


def run_do(path: str, method: str, params: list[str] | None = None) -> dict:
    cmd = [*MUSICSERVER, "-d", "do", path, method]
    if params:
        cmd.extend(params)
    print("Running", cmd)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error running '{' '.join(cmd)}': {result.stderr}")
        sys.exit(1)
    return json.loads(result.stdout)


def normalize(s: str) -> str:
    """Normalize a title for comparison: lowercase, strip, collapse whitespace."""
    return re.sub(r"\s+", " ", s.strip().lower())


def main():
    tracks_resp = run_do("/track", "GET", ["limit=-1"])
    tracks = tracks_resp.get("tracks", [])

    # Group tracks by normalized title
    groups: dict[str, list[dict]] = {}
    for track in tracks:
        key = normalize(track["name"])
        groups.setdefault(key, []).append(track)

    # Sort by original name of first track in group
    dupes = [(key, group) for key, group in groups.items() if len(group) > 1]
    dupes.sort(key=lambda x: x[1][0]["name"].casefold())

    if not dupes:
        print("No duplicate titles found.")
        return

    for key, group in dupes:
        print(f"Title: {group[0]['name']}")
        for t in group:
            artist = t.get("artist", "")
            album = t.get("album", "")
            print(f"  {artist} — {album}  [{t.get('short_id', t['id'])}]")
        print()


if __name__ == "__main__":
    main()