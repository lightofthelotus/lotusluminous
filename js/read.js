/*
 * v5 reader: renders a novel chapter, standalone story/poem, or tech
 * article into two parallel views — an immersive swipeable page-flip
 * view (paginate.js) and a classic scrolling view (common.js chrome) —
 * lets the reader toggle between them, and lets them bookmark a single
 * spot (one bookmark total) to jump back to later.
 */

(function () {
  const { fetchText, fetchJSON, parseFrontmatter, escapeHtml, fullDateLabel, fail, setHead, initChrome, CATALOG_PATH, assetPath } = window.V2;
  const { renderMarkdown, renderInline } = window.V2MD;

  const MODE_KEY = 'readerViewMode';
  const BOOKMARK_KEY = 'readerBookmark';
  let pagerController = null;
  let currentImmersivePage = 0;

  function getStoredMode() {
    return localStorage.getItem(MODE_KEY) === 'normal' ? 'normal' : 'immersive';
  }

  function applyMode(mode) {
    document.body.classList.toggle('mode-normal', mode === 'normal');
    document.body.classList.toggle('mode-immersive', mode === 'immersive');
    document.getElementById('immersiveView').hidden = mode !== 'immersive';
    document.getElementById('normalView').hidden = mode !== 'normal';
    const label = document.getElementById('viewModeLabel');
    const toggle = document.getElementById('viewModeToggle');
    if (label) label.textContent = mode === 'immersive' ? 'Immersive' : 'Scroll';
    if (toggle) toggle.setAttribute('aria-pressed', String(mode === 'immersive'));
    localStorage.setItem(MODE_KEY, mode);
    if (mode === 'immersive' && pagerController) pagerController.refresh();
  }

  function initModeToggle() {
    const toggle = document.getElementById('viewModeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      applyMode(getStoredMode() === 'immersive' ? 'normal' : 'immersive');
    });
    applyMode(getStoredMode());
  }

  function setLinks(href, label) {
    ['backLink', 'backLinkClassic'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('href', href);
      if (id === 'backLink') {
        el.setAttribute('aria-label', label);
        el.setAttribute('title', label);
      } else {
        el.textContent = label;
      }
    });
  }

  function wireChapterSelect(select, wrap, parts, currentFile, onChange) {
    if (!parts) {
      if (wrap) wrap.hidden = true;
      select.hidden = true;
      return;
    }
    if (wrap) wrap.hidden = false;
    select.hidden = false;
    select.innerHTML = parts
      .map((p) => `<option value="${escapeHtml(p.file.replace(/\.md$/, ''))}"${p.file === currentFile ? ' selected' : ''}>${escapeHtml(p.navLabel)}</option>`)
      .join('');
    select.onchange = () => onChange(select.value);
  }

  function setChapterSelects(parts, currentFile, onChange) {
    wireChapterSelect(document.getElementById('chapterSelect'), document.getElementById('floatNavRight'), parts, currentFile, onChange);
    wireChapterSelect(document.getElementById('chapterSelectClassic'), null, parts, currentFile, onChange);
  }

  // ---------- Bookmark (one global bookmark, jump back to it any time) ----------

  function loadBookmark() {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveBookmark(bookmark) {
    try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark)); } catch (e) { /* storage unavailable */ }
  }

  function clearBookmark() {
    try { localStorage.removeItem(BOOKMARK_KEY); } catch (e) { /* storage unavailable */ }
  }

  function sameContent(bookmark, ctx) {
    return !!bookmark && bookmark.type === ctx.type && bookmark.slug === ctx.slug && (bookmark.chapterFile || null) === (ctx.chapterFile || null);
  }

  function hrefForBookmark(bookmark) {
    const base = bookmark.type === 'novel'
      ? `read.html?type=novel&slug=${encodeURIComponent(bookmark.slug)}&chapter=${encodeURIComponent(bookmark.chapterFile.replace(/\.md$/, ''))}`
      : `read.html?type=${encodeURIComponent(bookmark.type)}&slug=${encodeURIComponent(bookmark.slug)}`;
    return `${base}&p=${bookmark.page}`;
  }

  function initBookmark(ctx) {
    const buttons = ['bookmarkBtn', 'bookmarkBtnClassic'].map((id) => document.getElementById(id)).filter(Boolean);
    if (!buttons.length) return;

    function refresh() {
      const bookmark = loadBookmark();
      const here = bookmark && sameContent(bookmark, ctx) && bookmark.page === currentImmersivePage;
      const elsewhere = bookmark && !here;
      buttons.forEach((btn) => {
        btn.classList.toggle('is-bookmarked-here', !!here);
        btn.classList.toggle('is-bookmarked-elsewhere', !!elsewhere);
        const label = here
          ? 'Remove bookmark'
          : elsewhere
            ? `Go to your bookmark: ${bookmark.label}`
            : 'Bookmark this page';
        btn.setAttribute('title', label);
        btn.setAttribute('aria-label', label);
      });
    }

    function onClick() {
      const bookmark = loadBookmark();
      const here = bookmark && sameContent(bookmark, ctx) && bookmark.page === currentImmersivePage;
      if (bookmark && !here) {
        window.location.href = hrefForBookmark(bookmark);
        return;
      }
      if (here) {
        clearBookmark();
      } else {
        saveBookmark({ type: ctx.type, slug: ctx.slug, chapterFile: ctx.chapterFile || null, page: currentImmersivePage, label: ctx.label });
      }
      refresh();
    }

    buttons.forEach((btn) => btn.addEventListener('click', onClick));
    refresh();
    return refresh;
  }

  async function startPager({ onOverflowPrev, onOverflowNext, startAt, onBookmarkRefresh }) {
    pagerController = await window.V2Paginate.init({
      container: document.getElementById('pager'),
      source: document.getElementById('pagerSource'),
      track: document.getElementById('pagerTrack'),
      prevBtn: document.getElementById('pagerPrevBtn'),
      nextBtn: document.getElementById('pagerNextBtn'),
      indicator: document.getElementById('pagerIndicator'),
      onOverflowPrev,
      onOverflowNext,
      startAt,
      onPageChange: (page) => {
        currentImmersivePage = page;
        if (onBookmarkRefresh) onBookmarkRefresh();
      },
      isActive: () => document.body.classList.contains('mode-immersive'),
    });
    if (document.body.classList.contains('mode-immersive')) pagerController.refresh();
  }

  async function renderNovel(params, slug) {
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

    const headerHtml = `
      <p class="eyebrow reveal">${escapeHtml(data.eyebrow || manifest.title)}</p>
      <h1 class="reveal">${escapeHtml(data.title)}</h1>
      <p class="reader-meta reveal">By Lotus Luminous${data.date ? ` · ${escapeHtml(fullDateLabel(data.date))}` : ''}</p>
    `;
    document.getElementById('readerHeader').innerHTML = headerHtml;
    document.getElementById('pagerSource').innerHTML = bodyHtml;

    const prevLink = prev
      ? `<a href="${chapterHref(prev.file)}" class="btn btn-ghost">← ${escapeHtml(prev.footerLabel)}</a>`
      : '<span></span>';
    const nextLink = next
      ? `<a href="${chapterHref(next.file)}" class="btn btn-primary">Next: ${escapeHtml(next.footerLabel)} →</a>`
      : '<a href="literary/index.html" class="btn btn-primary">More chapters coming soon →</a>';
    document.getElementById('articleRootClassic').innerHTML = `
      ${headerHtml}
      <div class="reader-body">${bodyHtml}</div>
      <div class="reader-footer-nav reveal">${prevLink}${nextLink}</div>
    `;

    setChapterSelects(manifest.parts, chapterFile, (value) => {
      window.location.href = chapterHref(`${value}.md`);
    });

    setLinks('literary/index.html', '← Literary Blog');
    setHead(`${data.title} — ${manifest.title} — Lotus Luminous`, data.description || manifest.description);

    const pageParam = parseInt(params.get('p'), 10);
    const onBookmarkRefresh = initBookmark({
      type: 'novel',
      slug,
      chapterFile,
      label: `${manifest.title} — ${data.title}`,
    });

    await startPager({
      onOverflowPrev: prev ? () => { window.location.href = `${chapterHref(prev.file)}#last`; } : null,
      onOverflowNext: next ? () => { window.location.href = chapterHref(next.file); } : null,
      startAt: location.hash === '#last' ? 'end' : (Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0),
      onBookmarkRefresh,
    });
  }

  async function renderStandalone(type, slug) {
    const catalog = await fetchJSON(CATALOG_PATH);
    const list = type === 'tech' ? catalog.tech : catalog.standalone;
    const entry = list.find((e) => e.slug === slug);
    if (!entry) throw new Error(`Unknown ${type} "${slug}"`);

    const raw = await fetchText(assetPath(entry.md));
    const { data, body } = parseFrontmatter(raw);
    const isPoem = data.poem === 'true';
    const bodyHtml = renderMarkdown(body, { headings: type === 'tech', poem: isPoem });
    const lede = data.lede || data.description;
    const ledeHtml = lede ? `<p class="lede reveal">${renderInline(lede)}</p>` : '';

    const backHref = type === 'tech' ? 'tech/index.html' : 'literary/index.html';
    const backLabel = type === 'tech' ? '← Tech Blog' : '← Literary Blog';

    document.getElementById('readerViewport').classList.toggle('reader-viewport--poem', isPoem);
    document.getElementById('articleRootClassic').classList.toggle('reader-article--poem', isPoem);

    const headerHtml = `
      <p class="eyebrow reveal">${escapeHtml(data.eyebrow || '')}</p>
      <h1 class="reveal">${escapeHtml(data.title)}</h1>
      <p class="reader-meta reveal">By Lotus Luminous${data.readTime ? ` · ${escapeHtml(data.readTime)}` : ''}</p>
    `;
    document.getElementById('readerHeader').innerHTML = headerHtml;
    // The lede rides as the first page of the pager rather than the fixed
    // header, so the immersive header stays compact and leaves more room
    // for the swipeable body.
    document.getElementById('pagerSource').innerHTML = ledeHtml + bodyHtml;

    document.getElementById('articleRootClassic').innerHTML = `
      ${headerHtml}
      <div class="reader-body">
        ${ledeHtml}
        ${bodyHtml}
      </div>
      <div class="reader-footer-nav reveal">
        <a href="${backHref}" class="btn btn-primary">${backLabel}</a>
      </div>
    `;

    setChapterSelects(null);
    setLinks(backHref, backLabel);
    setHead(`${data.title} — Lotus Luminous`, data.description);

    const pageParam = parseInt(new URLSearchParams(location.search).get('p'), 10);
    const onBookmarkRefresh = initBookmark({ type, slug, chapterFile: null, label: data.title });

    await startPager({
      startAt: Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0,
      onBookmarkRefresh,
    });
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    const slug = params.get('slug');

    try {
      if (type === 'novel') {
        await renderNovel(params, slug);
      } else if (type === 'standalone' || type === 'tech') {
        await renderStandalone(type, slug);
      } else {
        throw new Error(`Unknown content type "${type}"`);
      }
    } catch (err) {
      fail(document.getElementById('pagerTrack'), err);
      fail(document.getElementById('articleRootClassic'), err);
    }

    initModeToggle();
    initChrome();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
