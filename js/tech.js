/*
 * v2 tech category page: articles grouped by publish month, with the
 * quick-nav populated dynamically to match whatever months exist.
 */

(function () {
  const { fetchText, fetchJSON, parseFrontmatter, escapeHtml, cardHtml, monthLabel, initChrome, fail, CATALOG_PATH, assetPath } = window.V2;

  const READER = '../read.html';

  function slugifyMonth(label) {
    return `m-${label.toLowerCase().replace(/\s+/g, '-')}`;
  }

  async function loadTech() {
    const groupsRoot = document.getElementById('techGroups');
    const monthLinks = document.getElementById('monthLinks');

    try {
      const catalog = await fetchJSON(CATALOG_PATH);
      const entries = await Promise.all(
        catalog.tech.map(async (e) => {
          const raw = await fetchText(assetPath(e.md));
          const { data } = parseFrontmatter(raw);
          return { ...e, data };
        })
      );

      entries.sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));

      const groups = [];
      entries.forEach((entry) => {
        const label = entry.data.date ? monthLabel(entry.data.date) : 'Undated';
        let group = groups.find((g) => g.label === label);
        if (!group) {
          group = { label, id: slugifyMonth(label), entries: [] };
          groups.push(group);
        }
        group.entries.push(entry);
      });

      groupsRoot.innerHTML = groups
        .map(
          (group) => `
        <div class="date-group reveal-group" id="${group.id}">
          <h3 class="date-group-label reveal">${escapeHtml(group.label)}</h3>
          <div class="card-grid">
            ${group.entries
              .map((entry) =>
                cardHtml({
                  tag: entry.data.cardTag || 'Tech',
                  title: entry.data.title,
                  description: entry.data.description,
                  href: `${READER}?type=tech&slug=${encodeURIComponent(entry.slug)}`,
                })
              )
              .join('\n')}
          </div>
        </div>
      `
        )
        .join('\n');

      monthLinks.innerHTML = groups
        .map((group) => `<a href="#${group.id}" class="quicknav-link" data-target="${group.id}">${escapeHtml(group.label)}</a>`)
        .join('\n');
    } catch (err) {
      fail(groupsRoot, err);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    await loadTech();
    initChrome();
  });
})();
