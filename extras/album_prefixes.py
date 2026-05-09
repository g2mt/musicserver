#!/usr/bin/env python3
"""Check common path prefixes for tracks in each album."""

import json
import os
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


def common_prefix(paths: list[str]) -> str:
    """Find the longest common directory prefix across all paths."""
    split = [p.split("/") for p in paths]
    parts = []
    for comps in zip(*split):
        if all(c == comps[0] for c in comps):
            parts.append(comps[0])
        else:
            break
    return "/".join(parts)


def main():
    tracks_resp = run_do("/track", "GET", ["limit=-1"])
    tracks = tracks_resp.get("tracks", [])

    albums: dict[str, list[str]] = {}
    for track in tracks:
        album = track["album"]
        albums.setdefault(album, []).append(track["path"])

    empty_prefix_albums = []
    for album, paths in sorted(albums.items()):
        prefix = common_prefix(paths)
        if not prefix:
            empty_prefix_albums.append(album)
            print(f"ALBUM: {album} {{")
            print(f"  TRACKS: {{")
            for p in paths:
                print(f"    {p}")
            print(f"  }}")
            print(f"  Common prefix: (empty)")
            print(f"}}")
        # else:
        #     print(f"{album}: {prefix}")

    if empty_prefix_albums:
        print(
            f"\nWARNING: {len(empty_prefix_albums)} album(s) have an empty common prefix:"
        )
        for name in empty_prefix_albums:
            print(f"  - {name}")
    else:
        print("\nAll albums have a non-empty common prefix.")


if __name__ == "__main__":
    main()
