#!/usr/bin/env python3
import json, os, re, subprocess, sys
from pathlib import Path

def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return p.stdout

def main():
    # Args: <repo> <tag|latest> <regex> <outpath>
    if len(sys.argv) != 5:
        print("Usage: fetch_go2rtc.py <repo> <tag|latest> <regex> <outpath>", file=sys.stderr)
        sys.exit(2)

    repo, tag, pattern, outpath = sys.argv[1:]
    outpath = str(Path(outpath))

    # Ask GitHub for release assets
    if tag == "latest":
        raw = run(["gh", "api", f"repos/{repo}/releases/latest"])
    else:
        raw = run(["gh", "api", f"repos/{repo}/releases/tags/{tag}"])

    data = json.loads(raw)
    assets = data.get("assets", [])
    if not assets:
        print("No assets found on that release.", file=sys.stderr)
        sys.exit(1)

    print("Available assets:")
    for a in assets:
        print(f"- {a.get('name')}")

    rx = re.compile(pattern, re.IGNORECASE)
    match = None
    for a in assets:
        name = a.get("name", "")
        if rx.search(name):
            match = a
            break

    if not match:
        print(f"\nERROR: No asset matched regex: {pattern}", file=sys.stderr)
        print("Fix: adjust the regex in release.yml for this OS/arch to match one of the asset names above.", file=sys.stderr)
        sys.exit(1)

    url = match.get("browser_download_url")
    name = match.get("name")
    if not url:
        print("Matched asset has no download URL.", file=sys.stderr)
        sys.exit(1)

    Path(os.path.dirname(outpath) or ".").mkdir(parents=True, exist_ok=True)

    print(f"\nDownloading: {name}")
    # Use curl so it works everywhere
    run(["curl", "-L", "-o", outpath, url])

    # chmod +x on unix
    if os.name != "nt":
        run(["chmod", "+x", outpath])

    print(f"Saved to: {outpath}")

if __name__ == "__main__":
    main()