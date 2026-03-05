import os
from pathlib import Path

EXCLUDE = {
    ".git", "node_modules", "dist", "build", "out", ".next", ".cache",
    ".venv", "venv", "__pycache__", ".DS_Store"
}

ROOT = Path(".").resolve()
OUT = Path("docs/repo-diagram.mmd")

def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    return any(p in EXCLUDE for p in parts)

def safe_id(path: Path) -> str:
    # Mermaid node IDs must be simple; use underscores
    rel = path.relative_to(ROOT)
    if str(rel) == ".":
        return "ROOT"
    return "N_" + str(rel).replace("\\", "/").replace("/", "_").replace("-", "_").replace(".", "_")

def label(path: Path) -> str:
    rel = path.relative_to(ROOT)
    return "." if str(rel) == "." else str(rel).replace("\\", "/")

dirs = []
edges = []

# Collect directories (limited depth is optional; adjust if your repo is huge)
MAX_DEPTH = 6

for p in ROOT.rglob("*"):
    if not p.is_dir():
        continue
    if should_skip(p):
        continue
    rel = p.relative_to(ROOT)
    depth = len(rel.parts)
    if depth > MAX_DEPTH:
        continue
    dirs.append(p)

# Ensure root is included
dirs.append(ROOT)

# Create edges parent -> child (directory containment)
dir_set = set(dirs)
for d in dirs:
    if d == ROOT:
        continue
    parent = d.parent
    if parent in dir_set:
        edges.append((parent, d))

# Write Mermaid
OUT.parent.mkdir(parents=True, exist_ok=True)
lines = []
lines.append("```mermaid")
lines.append("flowchart TD")
lines.append("  classDef root fill:#111,color:#fff,stroke:#fff;")
lines.append("  classDef dir fill:#f6f8fa,stroke:#333,color:#111;")
lines.append("")
# Nodes
for d in sorted(set(dirs), key=lambda x: str(x)):
    nid = safe_id(d)
    lbl = label(d)
    if d == ROOT:
        lines.append(f'  {nid}["{lbl}"]:::root')
    else:
        lines.append(f'  {nid}["{lbl}"]:::dir')
# Edges
lines.append("")
for a, b in sorted(edges, key=lambda x: (str(x[0]), str(x[1]))):
    lines.append(f"  {safe_id(a)} --> {safe_id(b)}")
lines.append("```")

OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {OUT}")