#!/usr/bin/env python3
"""Rebuild the gallery grid in index.html from project subdirectories."""

import os
import re
import glob as globmod

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(SCRIPT_DIR, "index.html")
YAML_PATH = os.path.join(SCRIPT_DIR, "gallery.yaml")

# Words that should stay uppercase
UPPERCASE_WORDS = {"2d", "3d", "fft", "dag", "ai", "api", "css", "html", "js", "ui", "ux"}
# Words that should stay lowercase (unless first word)
LOWERCASE_WORDS = {"a", "an", "the", "and", "but", "or", "nor", "for", "in", "on", "at", "to", "of"}


def load_title_overrides():
    """Load title overrides from gallery.yaml (simple key: value parsing)."""
    overrides = {}
    if not os.path.exists(YAML_PATH):
        return overrides
    with open(YAML_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                key, value = line.split(":", 1)
                overrides[key.strip()] = value.strip()
    return overrides


def auto_title(dirname):
    """Generate a display title from a directory name like '3d-torus-shooter'."""
    words = dirname.split("-")
    result = []
    for i, word in enumerate(words):
        if word.lower() in UPPERCASE_WORDS:
            result.append(word.upper())
        elif i > 0 and word.lower() in LOWERCASE_WORDS:
            result.append(word.lower())
        else:
            result.append(word.capitalize())
    return " ".join(result)


def find_projects():
    """Find all subdirectories that contain an index.html."""
    projects = []
    for entry in sorted(os.listdir(SCRIPT_DIR)):
        subdir = os.path.join(SCRIPT_DIR, entry)
        if not os.path.isdir(subdir):
            continue
        if not os.path.isfile(os.path.join(subdir, "index.html")):
            continue
        # Find screenshot (screenshot1.jpg, .jpeg, .png, .webp)
        screenshots = globmod.glob(os.path.join(subdir, "screenshot1.*"))
        screenshot = None
        for s in screenshots:
            if s.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                screenshot = os.path.basename(s)
                break
        projects.append({"dir": entry, "screenshot": screenshot})
    return projects


def build_grid_html(projects, overrides):
    """Build the HTML for the gallery grid."""
    cards = []
    for project in projects:
        dirname = project["dir"]
        title = overrides.get(dirname, auto_title(dirname))
        screenshot = project["screenshot"]
        if screenshot:
            img = f'    <img src="{dirname}/{screenshot}" alt="{title}" loading="lazy">'
        else:
            img = f'    <img src="" alt="{title}" loading="lazy">'
        card = (
            f'  <a class="card" href="{dirname}/index.html">\n'
            f'{img}\n'
            f'    <div class="label">{title}</div>\n'
            f'  </a>'
        )
        cards.append(card)
    return (
        "<!-- BEGIN GALLERY -->\n"
        '<div class="grid">\n'
        + "\n".join(cards)
        + "\n</div>\n"
        "<!-- END GALLERY -->"
    )


BEGIN_MARKER = "<!-- BEGIN GALLERY -->"
END_MARKER = "<!-- END GALLERY -->"


def rebuild_index(grid_html):
    """Replace the section between gallery markers in index.html."""
    with open(INDEX_PATH) as f:
        content = f.read()

    begin = content.find(BEGIN_MARKER)
    end = content.find(END_MARKER)

    if begin == -1 or end == -1:
        print("ERROR: Could not find gallery markers in index.html")
        print(f"  {BEGIN_MARKER} found: {begin != -1}")
        print(f"  {END_MARKER} found: {end != -1}")
        raise SystemExit(1)

    new_content = content[:begin] + grid_html + content[end + len(END_MARKER):]

    with open(INDEX_PATH, "w") as f:
        f.write(new_content)


def main():
    overrides = load_title_overrides()
    projects = find_projects()

    print(f"Found {len(projects)} projects:")
    for p in projects:
        title = overrides.get(p["dir"], auto_title(p["dir"]))
        marker = " (override)" if p["dir"] in overrides else ""
        screenshot_status = p["screenshot"] or "NO SCREENSHOT"
        print(f"  {p['dir']:40s} -> {title}{marker}  [{screenshot_status}]")

    grid_html = build_grid_html(projects, overrides)
    rebuild_index(grid_html)
    print(f"\nRebuilt index.html with {len(projects)} gallery entries.")


if __name__ == "__main__":
    main()
