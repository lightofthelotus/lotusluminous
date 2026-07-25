/*
 * v2 site engine: a single dynamic reader template (read.html) driven by
 * ?type=&slug=&chapter= query params, plus renderers for the tech and
 * literary home pages. Depends only on js/markdown.js (window.MD).
 */

window.SiteV2 = (function () {

const { parseFrontmatter, renderMarkdown, renderInline, escapeHtml } = window.MD;
const { assetPath, catalogPath } = window.SiteConfig;

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.text();
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function setHead(title, description) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && description) meta.setAttribute('content', description);
}

function observeReveal(container) {
  const els = container.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((el) => observer.observe(el));
}

function fail(mount, err) {
  console.error(err);
  const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (el) el.innerHTML = `<p style="padding:2rem;color:var(--text-muted)">Couldn't load this content: ${escapeHtml(err.message)}</p>`;
}

function tileHtml({ tag, title, description, href, date }) {
  return `
    <article class="card reveal">
      <div class="card-body">
        <span class="card-tag">${escapeHtml(tag)}</span>
        <h3>${escapeHtml(title)}</h3>
        ${date ? `<p class="card-date">${escapeHtml(date)}</p>` : ''}
        <p>${escapeHtml(description)}</p>
        <a href="${href}" class="card-link">Read More →</a>
      </div>
    </article>
  `;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function fullDateLabel(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

// ---------- Tech home: tiles grouped by publish month ----------

async function initTechHome({ mount }) {
  const root = document.querySelector(mount);
  try {
    const catalog = await fetchJSON(catalogPath);
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
        group = { label, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    });

    root.innerHTML = groups
      .map(
        (group) => `
      <div class="date-group reveal">
        <h3 class="date-group-label">${escapeHtml(group.label)}</h3>
        <div class="card-grid">
          ${group.entries
            .map((entry) =>
              tileHtml({
                tag: entry.data.cardTag,
                title: entry.data.title,
                description: entry.data.description,
                href: `../read.html?type=tech&slug=${encodeURIComponent(entry.slug)}`,
              })
            )
            .join('\n')}
        </div>
      </div>
    `
      )
      .join('\n');

    observeReveal(root);
  } catch (err) {
    fail(root, err);
  }
}

// ---------- Literary home: novels, short stories, poems ----------

async function initLiteraryHome({ mount }) {
  const root = document.querySelector(mount);
  try {
    const catalog = await fetchJSON(catalogPath);

    const novelCards = await Promise.all(
      catalog.novels.map(async (e) => {
        const manifest = await fetchJSON(assetPath(e.manifest));
        return tileHtml({
          tag: 'Novel',
          title: manifest.title,
          description: manifest.description,
          href: `../read.html?type=novel&slug=${encodeURIComponent(e.slug)}`,
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
      tileHtml({
        tag,
        title: entry.data.title,
        description: entry.data.description,
        href: `../read.html?type=standalone&slug=${encodeURIComponent(entry.slug)}`,
      });

    const storyCards = standaloneEntries.filter((e) => e.data.poem !== 'true').map((e) => toCard(e, 'Short Story'));
    const poemCards = standaloneEntries.filter((e) => e.data.poem === 'true').map((e) => toCard(e, 'Poem'));

    const section = (label, cards) =>
      cards.length
        ? `
      <div class="collection-block reveal">
        <h3 class="collection-block-label">${escapeHtml(label)}</h3>
        <div class="card-grid">${cards.join('\n')}</div>
      </div>
    `
        : '';

    root.innerHTML = section('Novels', novelCards) + section('Short Stories', storyCards) + section('Poems', poemCards);
    observeReveal(root);
  } catch (err) {
    fail(root, err);
  }
}

// ---------- Recently Added (homepage, configurable via catalog.json "recent") ----------

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

    return tileHtml({
      tag: manifest.tag || 'Novel',
      title: `${manifest.title}: ${part.footerLabel || part.navLabel}`,
      description: data.description || manifest.description,
      href: `read.html?type=novel&slug=${encodeURIComponent(entry.slug)}&chapter=${encodeURIComponent(chapterSlug)}`,
      date: fullDateLabel(data.date),
    });
  }

  if (item.type === 'standalone' || item.type === 'tech') {
    const list = item.type === 'tech' ? catalog.tech : catalog.standalone;
    const entry = list.find((e) => e.slug === item.slug);
    if (!entry) return null;

    const raw = await fetchText(assetPath(entry.md));
    const { data } = parseFrontmatter(raw);
    const tag = data.cardTag || (item.type === 'tech' ? 'Tech' : data.poem === 'true' ? 'Poem' : 'Short Story');

    return tileHtml({
      tag,
      title: data.title,
      description: data.description,
      href: `read.html?type=${item.type}&slug=${encodeURIComponent(entry.slug)}`,
      date: fullDateLabel(data.date),
    });
  }

  return null;
}

async function initRecentlyAdded({ mount }) {
  const root = document.querySelector(mount);
  if (!root) return;
  try {
    const catalog = await fetchJSON(catalogPath);
    const recent = catalog.recent || [];
    const cards = await Promise.all(recent.map((item) => buildRecentCard(item, catalog)));
    root.innerHTML = cards.filter(Boolean).join('\n');
    observeReveal(root);
  } catch (err) {
    fail(root, err);
  }
}

// ---------- Common reader (novel chapter / standalone / tech) ----------

function setBack(selector, href, label) {
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el) {
    el.setAttribute('href', href);
    el.textContent = label;
  }
}

async function initReader({ mount, backSelector }) {
  const root = typeof mount === 'string' ? document.querySelector(mount) : mount;
  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const slug = params.get('slug');

  try {
    const catalog = await fetchJSON(catalogPath);

    if (type === 'novel') {
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

      const navLinks = manifest.parts
        .map((p) => {
          const partSlug = p.file.replace(/\.md$/, '');
          const active = p.file === chapterFile ? ' class="active"' : '';
          return `<a href="read.html?type=novel&slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(partSlug)}"${active}>${escapeHtml(p.navLabel)}</a>`;
        })
        .join('\n        ');

      const prev = currentIndex > 0 ? manifest.parts[currentIndex - 1] : null;
      const next = currentIndex < manifest.parts.length - 1 ? manifest.parts[currentIndex + 1] : null;
      const prevLink = prev
        ? `<a href="read.html?type=novel&slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(prev.file.replace(/\.md$/, ''))}" class="btn btn-ghost">← ${escapeHtml(prev.footerLabel)}</a>`
        : '<span></span>';
      const nextLink = next
        ? `<a href="read.html?type=novel&slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(next.file.replace(/\.md$/, ''))}" class="btn btn-ghost">Next: ${escapeHtml(next.footerLabel)} →</a>`
        : `<a href="literary/index.html" class="btn btn-ghost">More chapters coming soon →</a>`;

      root.classList.add('novel-layout');
      root.innerHTML = `
        <aside class="novel-nav">
          <button class="novel-nav-toggle" type="button" aria-expanded="false">
            <span class="novel-nav-toggle-label">
              <span class="novel-nav-title">${escapeHtml(manifest.title)}</span>
              <span class="novel-nav-current">${escapeHtml(manifest.parts[currentIndex].navLabel)}</span>
            </span>
            <span class="novel-nav-icon">▾</span>
          </button>
          <div class="novel-nav-panel">
            <div class="novel-nav-meta">${escapeHtml(manifest.tag || manifest.book)}</div>
            <nav class="novel-nav-list">
              ${navLinks}
            </nav>
          </div>
        </aside>

        <article class="post-article novel-content">
          <p class="eyebrow">${escapeHtml(data.eyebrow || manifest.title)}</p>
          <h1>${escapeHtml(data.title)}</h1>
          <p class="post-meta">By Lotus Luminous${data.date ? ` · ${escapeHtml(fullDateLabel(data.date))}` : ''}</p>

          <div class="post-body">
            ${bodyHtml}
          </div>

          <div class="post-footer-nav" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
            ${prevLink}
            ${nextLink}
          </div>
        </article>
      `;

      const navToggleBtn = root.querySelector('.novel-nav-toggle');
      navToggleBtn.addEventListener('click', () => {
        const nav = navToggleBtn.closest('.novel-nav');
        const isOpen = nav.classList.toggle('open');
        navToggleBtn.setAttribute('aria-expanded', String(isOpen));
      });

      setHead(`${data.title} — ${manifest.title} — Lotus Luminous`, data.description || manifest.description);
      setBack(backSelector, 'literary/index.html', '← Back to Literary Blog');
      return;
    }

    if (type === 'standalone' || type === 'tech') {
      const list = type === 'tech' ? catalog.tech : catalog.standalone;
      const entry = list.find((e) => e.slug === slug);
      if (!entry) throw new Error(`Unknown ${type} "${slug}"`);

      const raw = await fetchText(assetPath(entry.md));
      const { data, body } = parseFrontmatter(raw);
      const isPoem = data.poem === 'true';
      const bodyHtml = renderMarkdown(body, { headings: type === 'tech', poem: isPoem });
      const lede = data.lede || data.description;

      root.classList.add('post');
      if (isPoem) root.classList.add('poem');

      const backHref = type === 'tech' ? 'tech/index.html' : 'literary/index.html';
      const backLabel = type === 'tech' ? '← Back to Tech Blog' : '← Back to Literary Blog';

      root.innerHTML = `
        <article class="post-article">
          <p class="eyebrow">${escapeHtml(data.eyebrow)}</p>
          <h1>${escapeHtml(data.title)}</h1>
          <p class="post-meta">By Lotus Luminous${data.date ? ` · ${escapeHtml(fullDateLabel(data.date))}` : ''}${data.readTime ? ` · ${escapeHtml(data.readTime)}` : ''}</p>

          <div class="post-body">
            <p class="lede">${renderInline(lede)}</p>

            ${bodyHtml}
          </div>

          <div class="post-footer-nav">
            <a href="${backHref}" class="btn btn-ghost">${backLabel}</a>
          </div>
        </article>
      `;

      setHead(`${data.title} — Lotus Luminous`, data.description);
      setBack(backSelector, backHref, backLabel);
      return;
    }

    throw new Error(`Unknown content type "${type}"`);
  } catch (err) {
    fail(root, err);
  }
}

return { initTechHome, initLiteraryHome, initReader, initRecentlyAdded };

})();
