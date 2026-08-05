/*
 * v2 reader: always-immersive, no-scroll, page-turn reader for novels,
 * standalone stories, and tech articles. Uses v2's own local fetch/markdown
 * helpers (window.V2 / window.V2MD, content-agnostic) and resolves every
 * content path relative to v2/, so this page never reaches outside its own
 * folder. Pagination is v2's own fork (js/paginate.js) with wheel-driven
 * page turns and page-jump/bookmark support built in.
 */

(function () {
  const { fetchText, fetchJSON, parseFrontmatter, escapeHtml, fullDateLabel, fail, setHead } = window.V2;
  const { renderMarkdown, renderInline } = window.V2MD;

  const CATALOG_PATH = 'content/catalog.json';
  const BOOKMARKS_PREFIX = 'v2:bookmarks:';
  const MAX_BOOKMARKS = 5;

  let pagerController = null;
  let pageState = { currentPage: 0, totalPages: 1 };
  let currentCtx = null; // { type, slug, chapterFile, chapterLabel, itemLabel }

  function assetPath(path) {
    return String(path).replace(/^\/+/, '');
  }

  function setLink(id, href, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('href', href);
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
  }

  function wireChapterSelect(parts, currentFile, onChange) {
    const select = document.getElementById('chapterSelect');
    if (!parts) {
      select.hidden = true;
      return;
    }
    select.hidden = false;
    select.innerHTML = parts
      .map((p) => `<option value="${escapeHtml(p.file.replace(/\.md$/, ''))}"${p.file === currentFile ? ' selected' : ''}>${escapeHtml(p.navLabel)}</option>`)
      .join('');
    select.onchange = () => onChange(select.value);
  }

  // ---------- Page-number jump ----------
  function initPageJump() {
    const wrap = document.getElementById('pageJump');
    const input = document.getElementById('pageJumpInput');
    const total = document.getElementById('pageJumpTotal');

    function commit() {
      const n = parseInt(input.value, 10);
      if (!pagerController || !Number.isFinite(n)) return;
      const clamped = Math.min(Math.max(n, 1), pageState.totalPages);
      input.value = String(clamped);
      pagerController.goTo(clamped - 1);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(); input.blur(); }
    });
    input.addEventListener('blur', commit);

    return {
      show() { wrap.hidden = false; },
      update(page, totalPages) {
        input.max = String(totalPages);
        if (document.activeElement !== input) input.value = String(page + 1);
        total.textContent = `/ ${totalPages}`;
      },
    };
  }

  // ---------- Bookmarks: up to 5 per book, floating expandable tab ----------
  function bookmarkKey(type, slug) {
    return `${BOOKMARKS_PREFIX}${type}:${slug}`;
  }

  function loadBookmarks(type, slug) {
    try {
      const raw = localStorage.getItem(bookmarkKey(type, slug));
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, MAX_BOOKMARKS) : [];
    } catch (e) {
      return [];
    }
  }

  function saveBookmarks(type, slug, list) {
    try { localStorage.setItem(bookmarkKey(type, slug), JSON.stringify(list.slice(0, MAX_BOOKMARKS))); } catch (e) { /* storage unavailable */ }
  }

  function bookmarkHref(type, slug, bookmark) {
    const base = bookmark.chapterFile
      ? `read.html?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(bookmark.chapterFile.replace(/\.md$/, ''))}`
      : `read.html?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`;
    return `${base}&p=${bookmark.page}`;
  }

  function initBookmarks(ctx) {
    const tab = document.getElementById('bookmarkTab');
    const toggle = document.getElementById('bookmarkToggle');
    const countEl = document.getElementById('bookmarkCount');
    const panel = document.getElementById('bookmarkPanel');
    const list = document.getElementById('bookmarkList');
    const empty = document.getElementById('bookmarkEmpty');
    const addBtn = document.getElementById('bookmarkAdd');

    function sameSpot(b) {
      return (b.chapterFile || null) === (ctx.chapterFile || null) && b.page === pageState.currentPage;
    }

    function render() {
      const bookmarks = loadBookmarks(ctx.type, ctx.slug);

      countEl.hidden = bookmarks.length === 0;
      countEl.textContent = String(bookmarks.length);
      addBtn.disabled = bookmarks.length >= MAX_BOOKMARKS || bookmarks.some(sameSpot);
      addBtn.textContent = bookmarks.some(sameSpot) ? 'Already bookmarked' : bookmarks.length >= MAX_BOOKMARKS ? 'Max 5 bookmarks' : '+ Add this page';

      empty.hidden = bookmarks.length > 0;
      list.innerHTML = '';
      bookmarks.forEach((b, i) => {
        const li = document.createElement('li');
        li.className = 'bookmark-item';

        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'bookmark-item-link' + (sameSpot(b) ? ' is-current' : '');
        link.textContent = b.label;
        link.addEventListener('click', () => {
          const here = (b.chapterFile || null) === (ctx.chapterFile || null);
          if (here && pagerController) {
            pagerController.goTo(b.page);
            closePanel();
          } else {
            window.location.href = bookmarkHref(ctx.type, ctx.slug, b);
          }
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'bookmark-item-remove';
        remove.setAttribute('aria-label', `Remove bookmark: ${b.label}`);
        remove.innerHTML = '&times;';
        remove.addEventListener('click', (e) => {
          e.stopPropagation();
          const updated = loadBookmarks(ctx.type, ctx.slug);
          updated.splice(i, 1);
          saveBookmarks(ctx.type, ctx.slug, updated);
          render();
        });

        li.appendChild(link);
        li.appendChild(remove);
        list.appendChild(li);
      });
    }

    function openPanel() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      render();
    }
    function closePanel() {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
    function togglePanel() {
      if (panel.hidden) openPanel(); else closePanel();
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });
    addBtn.addEventListener('click', () => {
      const bookmarks = loadBookmarks(ctx.type, ctx.slug);
      if (bookmarks.length >= MAX_BOOKMARKS || bookmarks.some(sameSpot)) return;
      bookmarks.push({
        chapterFile: ctx.chapterFile || null,
        page: pageState.currentPage,
        label: ctx.chapterLabel
          ? `${ctx.chapterLabel} · Page ${pageState.currentPage + 1}`
          : `Page ${pageState.currentPage + 1}`,
      });
      saveBookmarks(ctx.type, ctx.slug, bookmarks);
      render();
    });
    document.addEventListener('click', (e) => {
      if (!tab.contains(e.target)) closePanel();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });

    render();
    return render;
  }

  // ---------- Pager bootstrap ----------
  async function startPager({ onOverflowPrev, onOverflowNext, startAt, onNavigate }) {
    const pageJump = initPageJump();
    pageJump.show();

    pagerController = await window.V2Paginate.init({
      container: document.getElementById('pager'),
      source: document.getElementById('pagerSource'),
      track: document.getElementById('pagerTrack'),
      onOverflowPrev,
      onOverflowNext,
      startAt,
      onPageChange: (page, totalPages) => {
        pageState = { currentPage: page, totalPages };
        pageJump.update(page, totalPages);
        if (onNavigate) onNavigate();
      },
      isActive: () => true,
    });
  }

  async function renderNovel(params, slug) {
    const catalog = await fetchJSON(CATALOG_PATH);
    const entry = catalog.novels.find((n) => n.slug === slug);
    if (!entry) throw new Error(`Unknown novel "${slug}"`);

    const manifest = await fetchJSON(assetPath(entry.manifest));
    const contentBase = assetPath(entry.manifest.replace(/manifest\.json$/, ''));
    const contentDirName = contentBase.replace(/\/+$/, '').split('/').pop();
    const illustrationsBase = `content/illustrations/${contentDirName}/`;
    const chapterParam = params.get('chapter');
    const chapterFile = chapterParam ? `${chapterParam}.md` : manifest.parts[0].file;
    const currentIndex = manifest.parts.findIndex((p) => p.file === chapterFile);
    if (currentIndex === -1) throw new Error(`Unknown chapter "${chapterParam}"`);

    const raw = await fetchText(contentBase + chapterFile);
    const { data, body } = parseFrontmatter(raw);
    const bodyHtml = renderMarkdown(body, { headings: false, illustrationsBase });

    const prev = currentIndex > 0 ? manifest.parts[currentIndex - 1] : null;
    const next = currentIndex < manifest.parts.length - 1 ? manifest.parts[currentIndex + 1] : null;
    const chapterHref = (file, extra) => `read.html?type=novel&slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(file.replace(/\.md$/, ''))}${extra || ''}`;

    document.getElementById('readerHeader').innerHTML = `
      <p class="eyebrow">${escapeHtml(data.eyebrow || manifest.title)}</p>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="reader-meta">By Lotus Luminous${data.date ? ` · ${escapeHtml(fullDateLabel(data.date))}` : ''}</p>
    `;
    document.getElementById('pagerSource').innerHTML = bodyHtml;

    wireChapterSelect(manifest.parts, chapterFile, (value) => {
      window.location.href = chapterHref(`${value}.md`);
    });

    setLink('backLink', 'index.html', '← The Shelf');
    setHead(`${data.title} — ${manifest.title} — Lotus Luminous`, data.description || manifest.description);

    currentCtx = {
      type: 'novel',
      slug,
      chapterFile,
      chapterLabel: manifest.parts[currentIndex].navLabel || data.title,
    };
    const refreshBookmarks = initBookmarks(currentCtx);

    const pageParam = parseInt(params.get('p'), 10);
    await startPager({
      onOverflowPrev: prev ? () => { window.location.href = chapterHref(prev.file, '#last'); } : null,
      onOverflowNext: next ? () => { window.location.href = chapterHref(next.file); } : null,
      startAt: location.hash === '#last' ? 'end' : (Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0),
      onNavigate: refreshBookmarks,
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
    const bodyHtml = renderMarkdown(body, { headings: type === 'tech', poem: isPoem, illustrationsBase: `content/illustrations/${slug}/` });
    const lede = data.lede || data.description;
    const ledeHtml = lede ? `<p class="lede">${renderInline(lede)}</p>` : '';

    const backHref = 'index.html';
    const backLabel = '← The Shelf';

    document.getElementById('readerViewport').classList.toggle('reader-viewport--poem', isPoem);

    document.getElementById('readerHeader').innerHTML = `
      <p class="eyebrow">${escapeHtml(data.eyebrow || '')}</p>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="reader-meta">By Lotus Luminous${data.readTime ? ` · ${escapeHtml(data.readTime)}` : ''}</p>
    `;
    document.getElementById('pagerSource').innerHTML = ledeHtml + bodyHtml;

    wireChapterSelect(null);
    setLink('backLink', backHref, backLabel);
    setHead(`${data.title} — Lotus Luminous`, data.description);

    currentCtx = { type, slug, chapterFile: null, chapterLabel: null };
    const refreshBookmarks = initBookmarks(currentCtx);

    const pageParam = parseInt(new URLSearchParams(location.search).get('p'), 10);
    await startPager({
      startAt: Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0,
      onNavigate: refreshBookmarks,
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
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
