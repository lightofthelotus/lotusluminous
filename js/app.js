/*
 * v2 landing page: hero + recently-added + category teasers.
 * Uses the shared scrollytelling engine in common.js.
 */

(function () {
  const { fetchText, fetchJSON, parseFrontmatter, escapeHtml, cardHtml, fullDateLabel, observeReveals, initChrome, fail, CATALOG_PATH, assetPath } = window.V2;

  const READER = 'read.html';

  async function buildRecentCard(item, catalog) {
    if (item.type === 'novel') {
      const entry = catalog.novels.find((n) => n.slug === item.slug);
      if (!entry) return null;
      const manifest = await fetchJSON(assetPath(entry.manifest));
      const contentBase = assetPath(entry.manifest.replace(/manifest\.json$/, ''));
      const part = item.chapter
        ? manifest.parts.find((p) => p.file.replace(/\.md$/, '') === item.chapter)
        : manifest.parts[manifest.parts.length - 1];
      if (!part) return null;
      const raw = await fetchText(contentBase + part.file);
      const { data } = parseFrontmatter(raw);
      const chapterSlug = part.file.replace(/\.md$/, '');
      return cardHtml({
        tag: manifest.tag || 'Novel',
        title: `${manifest.title}: ${part.footerLabel || part.navLabel}`,
        description: data.description || manifest.description,
        href: `${READER}?type=novel&slug=${encodeURIComponent(entry.slug)}&chapter=${encodeURIComponent(chapterSlug)}`,
        date: fullDateLabel(data.date),
      });
    }

    if (item.type === 'standalone' || item.type === 'tech') {
      const list = item.type === 'tech' ? catalog.tech : catalog.standalone;
      const entry = list.find((e) => e.slug === item.slug);
      if (!entry) return null;
      const raw = await fetchText(assetPath(entry.md));
      const { data } = parseFrontmatter(raw);
      return cardHtml({
        tag: item.type === 'tech' ? 'Tech' : 'Story',
        title: data.title,
        description: data.description,
        href: `${READER}?type=${item.type}&slug=${encodeURIComponent(entry.slug)}`,
        date: fullDateLabel(data.date),
      });
    }

    return null;
  }

  async function loadRecent() {
    const grid = document.getElementById('recentGrid');
    if (!grid) return;
    try {
      const catalog = await fetchJSON(CATALOG_PATH);
      const items = catalog.recent || [];
      const cards = await Promise.all(items.map((item) => buildRecentCard(item, catalog)));
      grid.innerHTML = cards.filter(Boolean).join('\n');
      observeReveals(grid);
    } catch (err) {
      fail(grid, err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initChrome();
    loadRecent();
  });
})();
