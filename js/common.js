/*
 * v2's own copy of the small fetch/markdown-frontmatter helpers read.js
 * needs (window.V2) — kept local so v2 never reaches outside its own
 * folder for a script. The root site has a much larger common.js with
 * the same function names plus scrollytelling/card-rendering machinery
 * v2 doesn't use; this is the trimmed, self-contained subset.
 */

window.V2 = (function () {
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

  function setMeta(selector, attr, value) {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      const [, name] = selector.match(/\[(?:name|property)="([^"]+)"\]/) || [];
      if (!name) return;
      el.setAttribute(selector.startsWith('meta[property') ? 'property' : 'name', name);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function setHead(title, description) {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) meta.setAttribute('content', description);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', location.href);

    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:type"]', 'content', 'article');
    setMeta('meta[property="og:url"]', 'content', location.href);
    setMeta('meta[property="og:site_name"]', 'content', 'The Lotus Luminous');
    setMeta('meta[name="twitter:card"]', 'content', 'summary');
    setMeta('meta[name="twitter:title"]', 'content', title);
    if (description) {
      setMeta('meta[property="og:description"]', 'content', description);
      setMeta('meta[name="twitter:description"]', 'content', description);
    }
  }

  function fail(mount, err) {
    console.error(err);
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (el) el.innerHTML = `<p style="padding:2rem;color:var(--text-muted)">Couldn't load this content: ${escapeHtml(err.message)}</p>`;
  }

  return { fetchText, fetchJSON, parseFrontmatter, escapeHtml, fullDateLabel, fail, setHead };
})();
