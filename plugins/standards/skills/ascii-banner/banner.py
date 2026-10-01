#!/usr/bin/env python3
"""Render text as an ASCII-art banner from a FIGlet font (full-width layout).

Usage: banner.py "TEXT" [--frame] [--font PATH]
Font format: FIGfont 2 (http://www.jave.de/figlet/figfont.html).
"""
import argparse
import hashlib
import pathlib
import sys
import urllib.request

# The font has no stated license, so it is fetched on first use instead of shipped in this
# public repo. Pinned commit + hash so a changed upstream file can never alter the output.
FONT_URL = ("https://raw.githubusercontent.com/xero/figlet-fonts/"
            "fbf3b68dd0fcd1e63c0f04d3c79eea2743bb377c/ANSI%20Shadow.flf")
FONT_SHA256 = "5b3141fa14163c90ff199d169331333875df557fa463b9fb05b85fee6eca6dc1"
DEFAULT_FONT = pathlib.Path.home() / ".cache" / "ascii-banner" / "ansi-shadow.flf"


def ensure_default_font():
    if DEFAULT_FONT.exists():
        return
    data = urllib.request.urlopen(FONT_URL, timeout=20).read()
    if hashlib.sha256(data).hexdigest() != FONT_SHA256:
        sys.exit(f"font download does not match the pinned hash: {FONT_URL}")
    DEFAULT_FONT.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_FONT.write_bytes(data)


def load_font(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    header = lines[0].split()
    if not header[0].startswith("flf2a"):
        sys.exit(f"not a FIGfont 2 file: {path}")
    hardblank, height, comments = header[0][-1], int(header[1]), int(header[5])
    body = lines[1 + comments:]
    glyphs = {}
    for i, code in enumerate(range(32, 127)):
        rows = body[i * height:(i + 1) * height]
        if len(rows) < height:
            break
        # The endmark is whatever character closes each row; the last row repeats it.
        glyphs[chr(code)] = [r.rstrip(r[-1]).replace(hardblank, " ") for r in rows]
    return glyphs, height


def render(text, glyphs, height):
    missing = sorted({c for c in text if c not in glyphs})
    if missing:
        sys.exit(f"font has no glyph for: {''.join(missing)}")
    rows = ["".join(glyphs[c][r] for c in text).rstrip() for r in range(height)]
    return [r for r in rows if r.strip()]


def frame(rows):
    width = max(len(r) for r in rows)
    inner = width + 4
    return ([" ╔" + "═" * (inner - 2) + "╗", "╔╝" + " " * (inner - 2) + "╚╗"]
            + ["║  " + r.ljust(width) + "  ║" for r in rows]
            + ["╚╗" + " " * (inner - 2) + "╔╝", " ╚" + "═" * (inner - 2) + "╝"])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("text")
    p.add_argument("--frame", action="store_true")
    p.add_argument("--font", type=pathlib.Path, default=DEFAULT_FONT)
    a = p.parse_args()
    if a.font == DEFAULT_FONT:
        ensure_default_font()
    glyphs, height = load_font(a.font)
    rows = render(a.text, glyphs, height)
    print("\n".join(frame(rows) if a.frame else rows))


if __name__ == "__main__":
    main()
