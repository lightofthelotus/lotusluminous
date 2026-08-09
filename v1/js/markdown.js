/*
 * Minimal Markdown engine for v2: same small block/inline rule set as the
 * classic site's renderer (paragraphs, scene breaks, headings, lists,
 * blockquotes, poem stanzas). Kept as its own copy so v2 has no code
 * dependency on v1.
 */

window.V2MD = (function () {

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
  return out;
}

const IMAGE_BLOCK_RE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;

function resolveIllustrationSrc(src, base) {
  if (/^(https?:)?\/\//.test(src) || src.startsWith('/')) return src;
  return `${base.replace(/\/+$/, '')}/${src}`;
}

function renderBlock(block, opts) {
  if (block === '***' || block === '---') {
    return '<div class="scene-break">• • •</div>';
  }

  const imageMatch = block.match(IMAGE_BLOCK_RE);
  if (imageMatch) {
    const [, alt, rawSrc] = imageMatch;
    const src = opts.illustrationsBase ? resolveIllustrationSrc(rawSrc, opts.illustrationsBase) : rawSrc;
    return `<figure class="illustration">\n        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">\n      </figure>`;
  }

  if (block.startsWith('### ')) {
    const text = block.slice(4).trim();
    return opts.headings ? `<h3>${renderInline(text)}</h3>` : `<div class="scene-break">${renderInline(text)}</div>`;
  }

  if (block.startsWith('## ')) {
    const text = block.slice(3).trim();
    return opts.headings ? `<h2>${renderInline(text)}</h2>` : `<div class="scene-break">${renderInline(text)}</div>`;
  }

  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length >= 3 && lines[0] === '^' && lines[lines.length - 1] === '^') {
    const text = lines.slice(1, -1).join(' ');
    return `<p class="voice-aside">${renderInline(text)}</p>`;
  }

  if (lines.length && lines.every((l) => /^>\s?/.test(l))) {
    const text = lines.map((l) => l.replace(/^>\s?/, '')).join(' ');
    return `<blockquote>\n        ${renderInline(text)}\n      </blockquote>`;
  }

  if (lines.length && lines.every((l) => /^[-*]\s+/.test(l))) {
    const items = lines.map((l) => `<li>${renderInline(l.replace(/^[-*]\s+/, ''))}</li>`).join('\n        ');
    return `<ul>\n        ${items}\n      </ul>`;
  }

  if (lines.length && lines.every((l) => /^\d+\.\s+/.test(l))) {
    const items = lines.map((l) => `<li>${renderInline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('\n        ');
    return `<ol>\n        ${items}\n      </ol>`;
  }

  if (opts.poem) {
    const text = lines.map(renderInline).join('<br>\n        ');
    return `<p class="poem-stanza">\n        ${text}\n      </p>`;
  }

  return `<p>${renderInline(lines.join(' '))}</p>`;
}

function renderMarkdown(body, opts = {}) {
  const blocks = body.trim().split(/\n\s*\n+/).filter((b) => b.trim());
  return blocks.map((block) => renderBlock(block.trim(), opts)).join('\n      ');
}

return { renderMarkdown, renderInline, escapeHtml };

})();
