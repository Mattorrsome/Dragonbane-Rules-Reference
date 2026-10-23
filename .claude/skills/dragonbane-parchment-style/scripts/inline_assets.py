#!/usr/bin/env python3
"""Make a Dragonbane-styled HTML page self-contained.

Replaces <link rel="stylesheet" href="dragonbane.css"> with an inline <style>
block in which the Colus font and the three scroll pieces are embedded as data URIs.
The result works as a published artifact (no local files) or a single file to send.

Usage: python inline_assets.py input.html output.html
"""
import base64
import pathlib
import re
import sys

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"


def data_uri(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def build_css() -> str:
    css = (ASSETS / "dragonbane.css").read_text(encoding="utf-8")
    css = css.replace("url('Colus.otf')", f"url('{data_uri(ASSETS / 'Colus.otf', 'font/otf')}')")
    for piece in ("scroll-top.webp", "scroll-tile.webp", "scroll-bottom.webp"):
        css = css.replace(f"url('{piece}')", f"url('{data_uri(ASSETS / piece, 'image/webp')}')")
    return css


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = map(pathlib.Path, sys.argv[1:])
    html = src.read_text(encoding="utf-8")
    pattern = re.compile(r'<link[^>]+href=["\']dragonbane\.css["\'][^>]*>')
    style = "<style>\n" + build_css() + "\n</style>"
    if pattern.search(html):
        html = pattern.sub(lambda _: style, html, count=1)
    else:
        html = html.replace("</head>", style + "\n</head>", 1)
    dst.write_text(html, encoding="utf-8")
    print(f"wrote {dst} ({dst.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
