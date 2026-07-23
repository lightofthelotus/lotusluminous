/*
 * Minimal Markdown engine for this site: frontmatter + a small set of block/inline
 * rules (paragraphs, scene breaks, headings, lists, blockquotes, poem stanzas).
 * Not a general-purpose Markdown parser — only what the content actually uses.
 */

window.MD = (function () {

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

function renderBlock(block, opts) {
  if (block === '***' || block === '---') {
    return '<div class="scene-break">• • •</div>';
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

return { parseFrontmatter, renderMarkdown, renderInline, escapeHtml };

})();
