/*
 * v2 reader: renders a novel chapter, standalone story/poem, or tech
 * article. Uses common.js for fetch/reveal/scroll-spine/quick-nav chrome
 * and markdown.js (V2MD) for rendering markdown bodies.
 */

(function () {
  const { fetchText, fetchJSON, parseFrontmatter, escapeHtml, fullDateLabel, fail, setHead, initChrome, CATALOG_PATH, assetPath } = window.V2;
  const { renderMarkdown, renderInline } = window.V2MD;

  function setBack(href, label) {
    const el = document.getElementById('backLink');
    if (el) {
      el.setAttribute('href', href);
      el.textContent = label;
    }
  }

  async function renderNovel(root, params, slug) {
    const catalog = await fetchJSON(CATALOG_PATH);
    const entry = catalog.novels.find((n) => n.slug === slug);
    if (!entry) throw new Error(`Unknown novel "${slug}"`);

    const manifest = await fetchJSON(assetPath(entry.manifest));
    const contentBase = assetPath(entry.manifest.replace(/manifest\.json$/, ''));
    const chapterParam = params.get('chapter');
    const chapterFile = chapterParam ? `${chapterParam}.md` : manifest.parts[0].file;
    const currentIndex = manifest.parts.findIndex((p) => p.file === chapterFile);
    if (currentIndex === -1) throw new Error(`Unknown chapter "${chapterParam}"`);

    const raw = await fetchText(contentBase + chapterFile);
    const { data, body } = parseFrontmatter(raw);
    const bodyHtml = renderMarkdown(body, { headings: false });

    const prev = currentIndex > 0 ? manifest.parts[currentIndex - 1] : null;
    const next = currentIndex < manifest.parts.length - 1 ? manifest.parts[currentIndex + 1] : null;
    const chapterHref = (file) => `read.html?type=novel&slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(file.replace(/\.md$/, ''))}`;

    const prevLink = prev
      ? `<a href="${chapterHref(prev.file)}" class="btn btn-ghost">← ${escapeHtml(prev.footerLabel)}</a>`
      : '<span></span>';
    const nextLink = next
      ? `<a href="${chapterHref(next.file)}" class="btn btn-primary">Next: ${escapeHtml(next.footerLabel)} →</a>`
      : `<a href="literary/index.html" class="btn btn-primary">More chapters coming soon →</a>`;

    root.innerHTML = `
      <p class="eyebrow reveal">${escapeHtml(data.eyebrow || manifest.title)}</p>
      <h1 class="reveal">${escapeHtml(data.title)}</h1>
      <p class="reader-meta reveal">By Lotus Luminous${data.date ? ` · ${escapeHtml(fullDateLabel(data.date))}` : ''}</p>
      <div class="reader-body">
        ${bodyHtml}
      </div>
      <div class="reader-footer-nav reveal">
        ${prevLink}
        ${nextLink}
      </div>
    `;

    const select = document.getElementById('chapterSelect');
    select.hidden = false;
    select.innerHTML = manifest.parts
      .map((p) => `<option value="${escapeHtml(p.file.replace(/\.md$/, ''))}"${p.file === chapterFile ? ' selected' : ''}>${escapeHtml(p.navLabel)}</option>`)
      .join('');
    select.addEventListener('change', () => {
      window.location.href = chapterHref(`${select.value}.md`);
    });

    setBack('literary/index.html', '← Literary Blog');
    setHead(`${data.title} — ${manifest.title} — Lotus Luminous`, data.description || manifest.description);
  }

  async function renderStandalone(root, type, slug) {
    const catalog = await fetchJSON(CATALOG_PATH);
    const list = type === 'tech' ? catalog.tech : catalog.standalone;
    const entry = list.find((e) => e.slug === slug);
    if (!entry) throw new Error(`Unknown ${type} "${slug}"`);

    const raw = await fetchText(assetPath(entry.md));
    const { data, body } = parseFrontmatter(raw);
    const isPoem = data.poem === 'true';
    const bodyHtml = renderMarkdown(body, { headings: type === 'tech', poem: isPoem });
    const lede = data.lede || data.description;

    const backHref = type === 'tech' ? 'tech/index.html' : 'literary/index.html';
    const backLabel = type === 'tech' ? '← Tech Blog' : '← Literary Blog';

    root.classList.toggle('reader-article--poem', isPoem);
    root.innerHTML = `
      <p class="eyebrow reveal">${escapeHtml(data.eyebrow || '')}</p>
      <h1 class="reveal">${escapeHtml(data.title)}</h1>
      <p class="reader-meta reveal">By Lotus Luminous${data.readTime ? ` · ${escapeHtml(data.readTime)}` : ''}</p>
      <div class="reader-body">
        ${lede ? `<p class="lede">${renderInline(lede)}</p>` : ''}
        ${bodyHtml}
      </div>
      <div class="reader-footer-nav reveal">
        <a href="${backHref}" class="btn btn-primary">${backLabel}</a>
      </div>
    `;

    setBack(backHref, backLabel);
    setHead(`${data.title} — Lotus Luminous`, data.description);
  }

  async function init() {
    const root = document.getElementById('articleRoot');
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    const slug = params.get('slug');

    try {
      if (type === 'novel') {
        await renderNovel(root, params, slug);
      } else if (type === 'standalone' || type === 'tech') {
        await renderStandalone(root, type, slug);
      } else {
        throw new Error(`Unknown content type "${type}"`);
      }
    } catch (err) {
      fail(root, err);
    }

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    initChrome();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
