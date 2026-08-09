/*
 * Shared scrollytelling engine for all v2 pages: fetch helpers, card
 * rendering, progressive reveal, the scroll-drawn SVG spine, quick-nav
 * active-section tracking, and background parallax. Standalone — reads
 * /content/catalog.json and markdown frontmatter directly.
 */

window.V2 = (function () {
  const CATALOG_PATH = '/content/catalog.json';

  function assetPath(path) {
    return `/${String(path).replace(/^\/+/, '')}`;
  }

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

  function parseFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return { data: {}, body: raw };
    const data = {};
    match[1].split('\n').forEach((line) => {
      if (!line.trim()) return;
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    });
    return { data, body: raw.slice(match[0].length) };
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function fullDateLabel(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  }

  function monthLabel(dateStr) {
    const [y, m] = dateStr.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  function cardHtml({ tag, title, description, href, date }) {
    return `
      <article class="card reveal">
        <span class="card-tag">${escapeHtml(tag)}</span>
        ${date ? `<span class="card-date">${escapeHtml(date)}</span>` : ''}
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description || '')}</p>
        <a href="${href}" class="card-link">Read More →</a>
      </article>
    `;
  }

  function setHead(title, description) {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) meta.setAttribute('content', description);
  }

  function fail(mount, err) {
    console.error(err);
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (el) el.innerHTML = `<p style="padding:2rem;color:var(--text-muted)">Couldn't load this content: ${escapeHtml(err.message)}</p>`;
  }

  // ---------- Progressive reveal ----------
  let revealObserver;
  function observeReveals(root) {
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
      );
    }
    root.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
  }

  // ---------- Scroll spine (continuous drawn SVG line, both edges) ----------
  const SPINE_MIN_REVEAL = 0.08; // fraction already visible at the very top, so it's never fully hidden

  function buildSpinePath(side) {
    const height = 1000;
    const step = 8;
    const center = side === 'right' ? 96.5 : 3.5;
    const sign = side === 'right' ? -1 : 1;
    const points = [];
    for (let y = 0; y <= height; y += step) {
      const x = center + sign * (Math.sin(y / 110) * 1.2 + Math.sin(y / 300 + 1) * 0.8);
      points.push(`${y === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y}`);
    }
    return points.join(' ');
  }

  function initScrollSpine() {
    const instances = ['left', 'right']
      .map((side) => {
        const path = document.querySelector(`.spine-path[data-side="${side}"]`);
        if (!path) return null;
        const dot = document.querySelector(`.spine-dot[data-side="${side}"]`);
        path.setAttribute('d', buildSpinePath(side));
        const length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        return { path, dot, length };
      })
      .filter(Boolean);

    if (!instances.length) return null;

    function apply(pct) {
      const frac = SPINE_MIN_REVEAL + (1 - SPINE_MIN_REVEAL) * (pct / 100);
      instances.forEach(({ path, dot, length }) => {
        const drawn = length * frac;
        path.style.strokeDashoffset = String(length - drawn);
        if (dot) {
          const point = path.getPointAtLength(drawn);
          dot.setAttribute('cx', String(point.x));
          dot.setAttribute('cy', String(point.y));
          dot.setAttribute('opacity', pct > 0.5 && pct < 99.5 ? '1' : '0');
        }
      });
    }

    apply(0);
    return apply;
  }

  // ---------- Active section tracking + scroll progress + parallax ----------
  function initScrollEffects() {
    const quicknav = document.getElementById('quicknav');
    const progress = document.getElementById('scrollProgress');
    const navLinks = Array.from(document.querySelectorAll('.quicknav-link'));
    const sections = navLinks
      .map((link) => document.getElementById(link.dataset.target))
      .filter(Boolean);
    const blobs = Array.from(document.querySelectorAll('.blob'));
    const updateSpine = initScrollSpine();

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY || window.pageYOffset;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(100, (scrollY / docHeight) * 100) : 0;
        if (progress) progress.style.width = `${pct}%`;
        if (quicknav) quicknav.classList.toggle('scrolled', scrollY > 40);
        if (updateSpine) updateSpine(pct);
        blobs.forEach((blob) => {
          const depth = parseFloat(blob.dataset.depth || '0.15');
          blob.style.transform = `translateY(${scrollY * depth}px)`;
        });
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (sections.length) {
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const link = navLinks.find((l) => l.dataset.target === entry.target.id);
            if (!link) return;
            if (entry.isIntersecting) {
              navLinks.forEach((l) => l.classList.remove('active'));
              link.classList.add('active');
            }
          });
        },
        { threshold: 0.5 }
      );
      sections.forEach((section) => sectionObserver.observe(section));
    }
  }

  function initScrollCue() {
    document.querySelectorAll('[data-scroll-to]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.scrollTo);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function initChrome() {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    observeReveals(document);
    initScrollEffects();
    initScrollCue();
  }

  return {
    assetPath,
    fetchText,
    fetchJSON,
    parseFrontmatter,
    escapeHtml,
    fullDateLabel,
    monthLabel,
    cardHtml,
    fail,
    setHead,
    observeReveals,
    initChrome,
    CATALOG_PATH,
  };
})();
