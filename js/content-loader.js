/*
 * Fetches Markdown content + JSON manifests and renders them into the page
 * using the site's existing CSS classes. Requires js/markdown.js (window.MD).
 */

const { parseFrontmatter, renderMarkdown, renderInline, escapeHtml } = window.MD;

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

// ---------- Novel chapter pages ----------

async function renderNovelChapter({ manifestPath, chapterFile, contentBase, mount, backHref }) {
  const root = typeof mount === 'string' ? document.querySelector(mount) : mount;
  try {
    const manifest = await fetchJSON(manifestPath);
    const currentIndex = manifest.parts.findIndex((p) => p.file === chapterFile);
    const raw = await fetchText(contentBase + chapterFile);
    const { data, body } = parseFrontmatter(raw);
    const bodyHtml = renderMarkdown(body, { headings: false });

    const navLinks = manifest.parts
      .map((p) => {
        const href = p.file.replace(/\.md$/, '.html');
        const active = p.file === chapterFile ? ' class="active"' : '';
        return `<a href="${href}"${active}>${escapeHtml(p.navLabel)}</a>`;
      })
      .join('\n        ');

    const prev = currentIndex > 0 ? manifest.parts[currentIndex - 1] : null;
    const next = currentIndex < manifest.parts.length - 1 ? manifest.parts[currentIndex + 1] : null;
    const prevLink = prev
      ? `<a href="${prev.file.replace(/\.md$/, '.html')}" class="btn btn-ghost">← ${escapeHtml(prev.footerLabel)}</a>`
      : '<span></span>';
    const nextLink = next
      ? `<a href="${next.file.replace(/\.md$/, '.html')}" class="btn btn-ghost">Next: ${escapeHtml(next.footerLabel)} →</a>`
      : `<a href="${backHref}" class="btn btn-ghost">More chapters coming soon →</a>`;

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
        <p class="post-meta">By Lotus Luminous</p>

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
  } catch (err) {
    fail(root, err);
  }
}

// ---------- Standalone posts (stories, poems, tech articles) ----------

async function renderPost({ mdPath, mount, backHref, backLabel, headings = false }) {
  const root = typeof mount === 'string' ? document.querySelector(mount) : mount;
  try {
    const raw = await fetchText(mdPath);
    const { data, body } = parseFrontmatter(raw);
    const isPoem = data.poem === 'true';
    const bodyHtml = renderMarkdown(body, { headings, poem: isPoem });
    const lede = data.lede || data.description;

    root.classList.add('post');
    if (isPoem) root.classList.add('poem');

    root.innerHTML = `
      <article class="post-article">
        <p class="eyebrow">${escapeHtml(data.eyebrow)}</p>
        <h1>${escapeHtml(data.title)}</h1>
        <p class="post-meta">By Lotus Luminous${data.readTime ? ` · ${escapeHtml(data.readTime)}` : ''}</p>

        <div class="post-body">
          <p class="lede">${renderInline(lede)}</p>

          ${bodyHtml}
        </div>

        <div class="post-footer-nav">
          <a href="${backHref}" class="btn btn-ghost">${escapeHtml(backLabel)}</a>
        </div>
      </article>
    `;

    setHead(`${data.title} — Lotus Luminous`, data.description);
  } catch (err) {
    fail(root, err);
  }
}

// ---------- Homepage / archive card collections ----------

function cardHtml({ mediaClass, mediaText, tag, title, description, href, linkText }) {
  return `
    <article class="card reveal">
      <div class="card-media ${mediaClass}">${escapeHtml(mediaText)}</div>
      <div class="card-body">
        <span class="card-tag">${escapeHtml(tag)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <a href="${href}" class="card-link">${escapeHtml(linkText)}</a>
      </div>
    </article>
  `;
}

async function novelCard(entry) {
  const manifest = await fetchJSON(entry.manifest);
  const href = entry.dir + manifest.parts[0].file.replace(/\.md$/, '.html');
  return cardHtml({
    mediaClass: 'card-media--literary',
    mediaText: manifest.cardMedia,
    tag: manifest.tag,
    title: manifest.title,
    description: manifest.description,
    href,
    linkText: manifest.linkText || 'Start Reading →',
  });
}

async function frontmatterOnlyCard(entry, mediaClass) {
  const raw = await fetchText(entry.md);
  const { data } = parseFrontmatter(raw);
  return cardHtml({
    mediaClass,
    mediaText: data.cardMedia,
    tag: data.cardTag,
    title: data.title,
    description: data.description,
    href: entry.href,
    linkText: data.linkText,
  });
}

async function renderCollection({ catalogPath, literarySelector, techSelector, statSelectors, scope = 'home' }) {
  const catalog = await fetchJSON(catalogPath);
  const include = (entry) => entry.v2Only !== true && (scope === 'all' || entry.homepage !== false);

  if (literarySelector) {
    const container = document.querySelector(literarySelector);
    const literaryEntries = [...catalog.novels, ...catalog.standalone].filter(include);
    const novels = catalog.novels.filter(include).map(novelCard);
    const standalone = catalog.standalone.filter(include).map((e) => frontmatterOnlyCard(e, 'card-media--literary'));
    container.innerHTML = (await Promise.all([...novels, ...standalone])).join('\n');
    observeReveal(container);
    if (statSelectors?.literary) {
      const el = document.querySelector(statSelectors.literary);
      if (el) el.textContent = literaryEntries.length;
    }
  }

  if (techSelector) {
    const container = document.querySelector(techSelector);
    const techEntries = catalog.tech.filter(include);
    const tech = techEntries.map((e) => frontmatterOnlyCard(e, 'card-media--tech'));
    container.innerHTML = (await Promise.all(tech)).join('\n');
    observeReveal(container);
    if (statSelectors?.tech) {
      const el = document.querySelector(statSelectors.tech);
      if (el) el.textContent = techEntries.length;
    }
  }
}

window.ContentLoader = { renderNovelChapter, renderPost, renderCollection };
