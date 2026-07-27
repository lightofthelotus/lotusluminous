/*
 * v2 literary category page: novels, short stories, poems.
 */

(function () {
  const { fetchText, fetchJSON, parseFrontmatter, cardHtml, fullDateLabel, initChrome, fail, CATALOG_PATH, assetPath } = window.V2;

  const READER = '../read.html';

  function hideEmptySection(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid || grid.children.length) return;
    const panel = grid.closest('.panel');
    if (panel) panel.style.display = 'none';
    const link = document.querySelector(`.quicknav-link[data-target="${panel ? panel.id : ''}"]`);
    if (link) link.style.display = 'none';
  }

  async function loadLiterary() {
    const novelsGrid = document.getElementById('novelsGrid');
    const storiesGrid = document.getElementById('storiesGrid');
    const poemsGrid = document.getElementById('poemsGrid');

    try {
      const catalog = await fetchJSON(CATALOG_PATH);

      const novelCards = await Promise.all(
        catalog.novels.map(async (e) => {
          const manifest = await fetchJSON(assetPath(e.manifest));
          return cardHtml({
            tag: manifest.tag || 'Novel',
            title: manifest.title,
            description: manifest.description,
            href: `${READER}?type=novel&slug=${encodeURIComponent(e.slug)}`,
          });
        })
      );

      const standaloneEntries = await Promise.all(
        catalog.standalone.map(async (e) => {
          const raw = await fetchText(assetPath(e.md));
          const { data } = parseFrontmatter(raw);
          return { ...e, data };
        })
      );

      const toCard = (entry, tag) =>
        cardHtml({
          tag,
          title: entry.data.title,
          description: entry.data.description,
          href: `${READER}?type=standalone&slug=${encodeURIComponent(entry.slug)}`,
          date: fullDateLabel(entry.data.date),
        });

      const storyCards = standaloneEntries.filter((e) => e.data.poem !== 'true').map((e) => toCard(e, 'Short Story'));
      const poemCards = standaloneEntries.filter((e) => e.data.poem === 'true').map((e) => toCard(e, 'Poem'));

      novelsGrid.innerHTML = novelCards.join('\n');
      storiesGrid.innerHTML = storyCards.join('\n');
      poemsGrid.innerHTML = poemCards.join('\n');

      hideEmptySection('novelsGrid');
      hideEmptySection('storiesGrid');
      hideEmptySection('poemsGrid');
    } catch (err) {
      fail(novelsGrid, err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    await loadLiterary();
    initChrome();
  });
})();
