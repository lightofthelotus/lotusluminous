#!/usr/bin/env python3
"""Generates sitemap.xml from content/catalog.json (and novel manifests).

Run from the repo root: python scripts/generate_sitemap.py
"""
import json
import os
from datetime import date
from urllib.parse import quote
from xml.sax.saxutils import escape

SITE_URL = "https://thelotusluminous.in"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

READER_TYPE = {"novels": "novel", "shortstories": "shortstories", "tech": "tech"}


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_url(type_, slug, chapter=None):
    url = f"{SITE_URL}/read.html?type={quote(type_)}&slug={quote(slug)}"
    if chapter:
        url += f"&chapter={quote(chapter)}"
    return url


def main():
    catalog = read_json(os.path.join(ROOT, "content", "catalog.json"))
    today = date.today().isoformat()
    urls = [(f"{SITE_URL}/index.html", 1.0)]

    for category, entries in catalog.items():
        if category not in READER_TYPE:
            continue
        type_ = READER_TYPE[category]
        for entry in entries:
            slug = entry["slug"]
            urls.append((read_url(type_, slug), 0.8))

            manifest_path = entry.get("manifest")
            if not manifest_path:
                continue
            manifest = read_json(os.path.join(ROOT, manifest_path))
            for part in manifest.get("parts", []):
                chapter = part["file"].rsplit(".", 1)[0]
                urls.append((read_url(type_, slug, chapter), 0.6))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, priority in urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc)}</loc>")
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")

    out_path = os.path.join(ROOT, "sitemap.xml")
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Wrote {len(urls)} URLs to {out_path}")


if __name__ == "__main__":
    main()
