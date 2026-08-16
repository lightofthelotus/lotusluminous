/*
 * Local-dev-only "Export to Document" feature.
 *
 * Downloads the current novel (all chapters, with illustrations, real Word
 * headings, and page breaks between chapters) or the current short story /
 * tech article (single piece) as a genuine .docx, built natively with the
 * docx library (MIT-licensed, vendored in js/vendor/ so this never needs a
 * network fetch to a CDN) — not a screenshot/print rasterization.
 *
 * Content is parsed directly from the source markdown files (the same ones
 * js/read.js reads), via a dedicated block/inline parser in this file that
 * mirrors js/markdown.js's block rules but emits docx.Paragraph/ImageRun
 * objects instead of HTML strings.
 *
 * Deliberately gated to localhost: the button stays [hidden] in the markup
 * and only this script removes that attribute, and only after confirming
 * the page isn't being served from GitHub Pages or the live domain. On any
 * other host this file does nothing at all — no vendor script is loaded,
 * no button is shown.
 */
(function () {
  function isLocalHost() {
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "" || h === "::1";
  }

  if (!isLocalHost()) return;

  const CATALOG_PATH = "content/catalog.json";
  const VENDOR_SCRIPTS = ["js/common.js", "js/vendor/docx.min.js"];
  const ORDERED_LIST_REF = "export-docx-ol";

  let dependenciesPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        if (existing.dataset.loaded) resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function ensureDependencies() {
    if (!dependenciesPromise) {
      dependenciesPromise = VENDOR_SCRIPTS.reduce(
        (chain, src) => chain.then(() => loadScript(src)),
        Promise.resolve()
      );
    }
    return dependenciesPromise;
  }

  function assetPath(path) {
    return String(path).replace(/^\/+/, "");
  }

  function slugifyFilename(title) {
    return (
      String(title)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "download"
    );
  }

  // ---------- Inline markdown (bold/italic/code) -> docx.TextRun[] ----------
  function parseInlineTokens(text) {
    const tokens = [];
    const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
    let lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > lastIndex) tokens.push({ text: text.slice(lastIndex, m.index) });
      if (m[1] !== undefined) tokens.push({ text: m[1], code: true });
      else if (m[2] !== undefined) tokens.push({ text: m[2], bold: true });
      else tokens.push({ text: m[3] !== undefined ? m[3] : m[4], italics: true });
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
    return tokens;
  }

  function textRunsFromInline(text, extra) {
    extra = extra || {};
    return parseInlineTokens(text).map(
      (t) =>
        new window.docx.TextRun({
          text: t.text,
          bold: t.bold || extra.bold || undefined,
          italics: t.italics || extra.italics || undefined,
          color: extra.color,
          font: t.code ? "Consolas" : undefined,
        })
    );
  }

  // ---------- Images ----------
  const IMAGE_BLOCK_RE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;
  const MAX_IMG_WIDTH_PX = 500;

  function resolveIllustrationSrc(src, base) {
    if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) return src;
    return `${base.replace(/\/+$/, "")}/${src}`;
  }

  function extToImageType(src) {
    const ext = (src.split("?")[0].split(".").pop() || "").toLowerCase();
    if (ext === "jpeg") return "jpg";
    if (["jpg", "png", "gif", "bmp"].includes(ext)) return ext;
    return "png";
  }

  function readImageDimensions(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  async function fetchImage(src) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to load image ${src}: ${res.status}`);
    const buf = await res.arrayBuffer();
    const dims = await readImageDimensions(new Blob([buf]));
    return { buf, dims };
  }

  function scaleToMaxWidth(dims) {
    const width = Math.min(dims.width, MAX_IMG_WIDTH_PX);
    const scale = width / dims.width;
    return { width, height: Math.round(dims.height * scale) };
  }

  // ---------- Block-level markdown -> docx nodes ----------
  function sectionMarkerParagraph(text) {
    const { docx } = window;
    return new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 320, after: 240 },
      children: [new docx.TextRun({ text, bold: true, allCaps: true, characterSpacing: 30 })],
    });
  }

  function headingParagraph(text, level) {
    const { docx } = window;
    return new docx.Paragraph({ heading: level, spacing: { before: 280, after: 160 }, children: textRunsFromInline(text) });
  }

  function buildTable(lines) {
    const { docx } = window;
    const splitRow = (row) =>
      row
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
    const headCells = splitRow(lines[0]);
    const bodyRows = lines.slice(2).map(splitRow);
    const mkCell = (text, bold) =>
      new docx.TableCell({
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new docx.Paragraph({ children: textRunsFromInline(text, bold ? { bold: true } : {}) })],
      });
    const rows = [new docx.TableRow({ tableHeader: true, children: headCells.map((c) => mkCell(c, true)) })].concat(
      bodyRows.map((r) => new docx.TableRow({ children: r.map((c) => mkCell(c, false)) }))
    );
    return new docx.Table({ width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows });
  }

  async function blockToDocxNodes(block, opts) {
    const { docx } = window;

    if (block === "***" || block === "---") {
      return [
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new docx.TextRun("• • •")],
        }),
      ];
    }

    const imageMatch = block.match(IMAGE_BLOCK_RE);
    if (imageMatch) {
      const [, alt, rawSrc] = imageMatch;
      const src = opts.illustrationsBase ? resolveIllustrationSrc(rawSrc, opts.illustrationsBase) : rawSrc;
      try {
        const { buf, dims } = await fetchImage(src);
        const { width, height } = scaleToMaxWidth(dims);
        return [
          new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [new docx.ImageRun({ type: extToImageType(src), data: buf, transformation: { width, height } })],
          }),
        ];
      } catch (err) {
        console.warn("Skipping image in document export:", src, err);
        return [new docx.Paragraph({ children: [new docx.TextRun({ text: `[Image: ${alt}]`, italics: true })] })];
      }
    }

    if (block.startsWith("### ")) {
      const text = block.slice(4).trim();
      return [opts.headings ? headingParagraph(text, docx.HeadingLevel.HEADING_3) : sectionMarkerParagraph(text)];
    }
    if (block.startsWith("## ")) {
      const text = block.slice(3).trim();
      return [opts.headings ? headingParagraph(text, docx.HeadingLevel.HEADING_2) : sectionMarkerParagraph(text)];
    }
    if (block.startsWith("# ")) {
      const text = block.slice(2).trim();
      return [opts.headings ? headingParagraph(text, docx.HeadingLevel.HEADING_2) : sectionMarkerParagraph(text)];
    }

    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const TABLE_ROW_RE = /^\|.*\|$/;
    const TABLE_SEP_RE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/;
    if (lines.length >= 2 && TABLE_ROW_RE.test(lines[0]) && TABLE_SEP_RE.test(lines[1])) {
      return [buildTable(lines)];
    }

    if (lines.length >= 3 && lines[0] === "^" && lines[lines.length - 1] === "^") {
      const text = lines.slice(1, -1).join(" ");
      return [
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { before: 160, after: 160 },
          children: textRunsFromInline(text, { italics: true }),
        }),
      ];
    }

    if (lines.length && lines.every((l) => /^>\s?/.test(l))) {
      const text = lines.map((l) => l.replace(/^>\s?/, "")).join(" ");
      return [
        new docx.Paragraph({
          indent: { left: docx.convertInchesToTwip(0.4) },
          border: { left: { style: docx.BorderStyle.SINGLE, size: 12, color: "CBBFA3", space: 8 } },
          spacing: { before: 120, after: 120 },
          children: textRunsFromInline(text, { italics: true }),
        }),
      ];
    }

    if (lines.length && lines.every((l) => /^[-*]\s+/.test(l))) {
      return lines.map(
        (l) => new docx.Paragraph({ bullet: { level: 0 }, children: textRunsFromInline(l.replace(/^[-*]\s+/, "")) })
      );
    }

    if (lines.length && lines.every((l) => /^\d+\.\s+/.test(l))) {
      return lines.map(
        (l) =>
          new docx.Paragraph({
            numbering: { reference: ORDERED_LIST_REF, level: 0 },
            children: textRunsFromInline(l.replace(/^\d+\.\s+/, "")),
          })
      );
    }

    if (opts.poem) {
      const runs = [];
      lines.forEach((l, i) => {
        if (i > 0) runs.push(new docx.TextRun({ text: "", break: 1 }));
        runs.push(...textRunsFromInline(l));
      });
      return [new docx.Paragraph({ spacing: { before: 80, after: 80 }, children: runs })];
    }

    return [new docx.Paragraph({ spacing: { after: 200 }, children: textRunsFromInline(lines.join(" ")) })];
  }

  async function parseBodyToNodes(body, opts) {
    const blocks = body
      .trim()
      .split(/\n\s*\n+/)
      .filter((b) => b.trim());
    const nodes = [];
    for (const block of blocks) {
      const parsed = await blockToDocxNodes(block.trim(), opts);
      nodes.push(...parsed);
    }
    return nodes;
  }

  function numberingConfig() {
    const { docx } = window;
    return {
      config: [
        {
          reference: ORDERED_LIST_REF,
          levels: [{ level: 0, format: docx.LevelFormat.DECIMAL, text: "%1.", alignment: docx.AlignmentType.START }],
        },
      ],
    };
  }

  // ---------- Content builders ----------
  async function buildNovelDoc(slug) {
    const { fetchText, fetchJSON, parseFrontmatter } = window.V2;
    const { docx } = window;

    const catalog = await fetchJSON(CATALOG_PATH);
    const entry = catalog.novels.find((n) => n.slug === slug);
    if (!entry) throw new Error(`Unknown novel "${slug}"`);

    const manifest = await fetchJSON(assetPath(entry.manifest));
    const contentBase = assetPath(entry.manifest.replace(/manifest\.json$/, ""));
    const contentDirName = contentBase.replace(/\/+$/, "").split("/").pop();
    const illustrationsBase = `content/illustrations/${contentDirName}/`;

    const children = [];

    children.push(
      new docx.Paragraph({
        spacing: { before: 2400, after: 120 },
        alignment: docx.AlignmentType.CENTER,
        children: [new docx.TextRun({ text: (manifest.tag || "Novel").toUpperCase(), color: "7A6F5E", size: 18, characterSpacing: 30 })],
      })
    );
    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new docx.TextRun({ text: manifest.title, bold: true, size: 56 })],
      })
    );
    if (manifest.book) {
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new docx.TextRun({ text: `${manifest.book} · By Lotus Luminous`, size: 24 })],
        })
      );
    }
    if (manifest.description) {
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 200 },
          children: textRunsFromInline(manifest.description, { italics: true }),
        })
      );
    }

    for (const part of manifest.parts) {
      const raw = await fetchText(contentBase + part.file);
      const { data, body } = parseFrontmatter(raw);

      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_1,
          pageBreakBefore: true,
          spacing: { after: 80 },
          children: textRunsFromInline(data.title || part.navLabel || ""),
        })
      );
      if (part.footerLabel || part.navLabel) {
        children.push(
          new docx.Paragraph({
            spacing: { after: 300 },
            children: [new docx.TextRun({ text: part.footerLabel || part.navLabel, italics: true, color: "7A6F5E" })],
          })
        );
      }

      const bodyNodes = await parseBodyToNodes(body, { headings: false, illustrationsBase });
      children.push(...bodyNodes);
    }

    return new docx.Document({ numbering: numberingConfig(), sections: [{ properties: {}, children }] });
  }

  async function buildArticleDoc(type, slug) {
    const { fetchText, fetchJSON, parseFrontmatter, fullDateLabel } = window.V2;
    const { docx } = window;

    const catalog = await fetchJSON(CATALOG_PATH);
    const list = type === "tech" ? catalog.tech : catalog.shortstories;
    const entry = list.find((e) => e.slug === slug);
    if (!entry) throw new Error(`Unknown ${type} "${slug}"`);

    const raw = await fetchText(assetPath(entry.md));
    const { data, body } = parseFrontmatter(raw);
    const isPoem = data.poem === "true";

    const children = [];
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { after: 80 },
        children: textRunsFromInline(data.title || entry.title || slug),
      })
    );

    const metaParts = [];
    if (data.date) metaParts.push(fullDateLabel(data.date));
    if (data.readTime) metaParts.push(data.readTime);
    children.push(
      new docx.Paragraph({
        spacing: { after: 200 },
        children: [new docx.TextRun({ text: `By Lotus Luminous${metaParts.length ? " · " + metaParts.join(" · ") : ""}`, color: "7A6F5E" })],
      })
    );

    const lede = data.lede || data.description;
    if (lede) {
      children.push(new docx.Paragraph({ spacing: { after: 200 }, children: textRunsFromInline(lede, { italics: true }) }));
    }

    const bodyNodes = await parseBodyToNodes(body, {
      headings: type === "tech",
      poem: isPoem,
      illustrationsBase: `content/illustrations/${slug}/`,
    });
    children.push(...bodyNodes);

    return new docx.Document({ numbering: numberingConfig(), sections: [{ properties: {}, children }] });
  }

  // ---------- Export flow ----------
  async function exportToDocx(btn) {
    const { type, slug, title } = btn.dataset;
    if (!type || !slug) return;

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparing document…";

    try {
      await ensureDependencies();

      const doc = type === "novel" ? await buildNovelDoc(slug) : await buildArticleDoc(type, slug);
      const blob = await window.docx.Packer.toBlob(doc);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugifyFilename(title || slug)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error("Document export failed", err);
      alert("Sorry, the document export failed. See the console for details.");
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel === "Preparing document…" ? "Export to Document" : originalLabel;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("detailExportDocx");
    if (!btn) return;
    document.body.classList.add("docx-export-enabled");
    btn.hidden = false;
    btn.addEventListener("click", () => exportToDocx(btn));
  });
})();
