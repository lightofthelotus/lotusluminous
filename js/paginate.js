/*
 * Book-style pagination: splits a block of rendered content into literal
 * per-page <div> elements sized to the reader's viewport, then lets the
 * reader move between them by swipe, arrow buttons, or the left/right
 * keyboard keys. Building real page elements (rather than guessing a CSS
 * column width and hoping it matches) keeps the page-turn shift amount
 * exactly equal to each page's real rendered width — no drift.
 */

window.V2Paginate = (function () {

  // Finds the text-node + local offset for a global character offset within
  // el's text content, so a Range can be built without caring how many
  // inline <strong>/<em>/<code> wrappers the text passes through.
  function locateTextOffset(el, globalOffset) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = globalOffset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.data.length) return { node, offset: remaining };
      remaining -= node.data.length;
      node = walker.nextNode();
    }
    return null;
  }

  // Splits a paragraph-like element into a "fits in the remaining space"
  // part and a "carries over to the next page" part, cutting only at a
  // word boundary. Uses the Range API so nested <strong>/<em>/<code> tags
  // are reconstructed correctly on both sides of the cut.
  function splitParagraphToFit(paragraphClone, measurerTop, maxHeight) {
    const fullText = paragraphClone.textContent;
    if (!fullText || !fullText.trim()) return null;

    function bottomAtOffset(offset) {
      const loc = locateTextOffset(paragraphClone, offset);
      if (!loc) return -Infinity;
      const range = document.createRange();
      range.selectNodeContents(paragraphClone);
      range.setEnd(loc.node, loc.offset);
      const rects = range.getClientRects();
      const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
      return rect.bottom - measurerTop;
    }

    let lo = 0;
    let hi = fullText.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (bottomAtOffset(mid) <= maxHeight) lo = mid; else hi = mid - 1;
    }

    // The caller's overflow check is a coarser box measurement than this
    // Range-based one; they can disagree by a hair right at the boundary.
    // If the precise text measurement says the whole paragraph actually
    // fits, trust it — say so instead of giving up and losing a whole
    // paragraph's worth of space to a rounding difference.
    if (lo >= fullText.length) return { fits: true };
    if (lo <= 0) return null;

    // Snap back to the nearest preceding word boundary so we never cut a word.
    let cut = lo;
    while (cut > 0 && !/\s/.test(fullText[cut])) cut--;
    while (cut > 0 && /\s/.test(fullText[cut - 1])) cut--;
    if (cut <= 0) return null;

    const splitLoc = locateTextOffset(paragraphClone, cut);
    if (!splitLoc) return null;

    const rangeA = document.createRange();
    rangeA.selectNodeContents(paragraphClone);
    rangeA.setEnd(splitLoc.node, splitLoc.offset);
    const fragA = rangeA.cloneContents();

    const rangeB = document.createRange();
    rangeB.selectNodeContents(paragraphClone);
    rangeB.setStart(splitLoc.node, splitLoc.offset);
    const fragB = rangeB.cloneContents();

    const partA = document.createElement(paragraphClone.tagName);
    partA.className = paragraphClone.className;
    partA.appendChild(fragA);

    const partB = document.createElement(paragraphClone.tagName);
    partB.className = paragraphClone.className;
    partB.appendChild(fragB);
    if (partB.firstChild && partB.firstChild.nodeType === Node.TEXT_NODE) {
      partB.firstChild.data = partB.firstChild.data.replace(/^\s+/, '');
    }

    if (!partA.textContent.trim() || !partB.textContent.trim()) return null;
    return { partA, partB };
  }

  function splitIntoPages(blocks, width, height) {
    if (!blocks.length) return [[]];

    const measurer = document.createElement('div');
    measurer.className = 'pager-page reader-body';
    measurer.style.cssText = `position:absolute; left:-9999px; top:0; visibility:hidden; width:${width}px; height:auto;`;
    document.body.appendChild(measurer);

    // The last child's own rendered bottom edge (no margin) — unlike
    // scrollHeight, this doesn't count a trailing margin-bottom that's
    // pure invisible whitespace clipped by overflow:hidden anyway. Using
    // scrollHeight here falsely flagged "overflow" on paragraphs whose
    // text fit fine but whose margin poked past the edge, which made the
    // splitter give up (nothing to cut) and shove the whole paragraph to
    // the next page for no visual reason.
    function contentBottom() {
      if (!measurer.lastElementChild) return 0;
      return measurer.lastElementChild.getBoundingClientRect().bottom - measurer.getBoundingClientRect().top;
    }

    const pages = [];
    let currentBlocks = [];
    const queue = blocks.slice();
    let guard = blocks.length * 20 + 50; // safety net against any pathological loop

    while (queue.length && guard-- > 0) {
      const block = queue.shift();
      const clone = block.cloneNode(true);
      measurer.appendChild(clone);

      if (contentBottom() <= height) {
        currentBlocks.push(block);
        continue;
      }

      // Only plain paragraphs are safe to cut mid-block — headings, lists,
      // blockquotes, and poem stanzas stay atomic and move whole.
      const canSplit = block.tagName === 'P' && !block.classList.contains('poem-stanza');
      const split = canSplit ? splitParagraphToFit(clone, measurer.getBoundingClientRect().top, height) : null;

      if (split && split.fits) {
        // Precise measurement says it fits after all — keep the clone in
        // place (it already contributes to the accumulated height) and
        // move on, same as the normal fits-fine path above.
        currentBlocks.push(block);
        continue;
      }

      measurer.removeChild(clone);

      if (split && split.partA) {
        currentBlocks.push(split.partA);
        pages.push(currentBlocks);
        queue.unshift(split.partB);
        currentBlocks = [];
        measurer.innerHTML = '';
        continue;
      }

      if (currentBlocks.length > 0) {
        pages.push(currentBlocks);
        currentBlocks = [block];
        measurer.innerHTML = '';
        measurer.appendChild(block.cloneNode(true));
      } else {
        // Doesn't fit even alone on a blank page — accept the overflow
        // rather than looping forever on it.
        currentBlocks = [block];
      }
    }
    if (currentBlocks.length) pages.push(currentBlocks);

    document.body.removeChild(measurer);
    return pages;
  }

  // Splitting measures each block's real rendered height, but an <img> that
  // hasn't finished loading yet reports zero height — the paginator would
  // then pack extra text after it, and once the image loads moments later
  // it pushes past the page's overflow:hidden edge, silently clipping the
  // image and everything below it. Waiting for images up front (like fonts)
  // keeps that first measurement accurate.
  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    return Promise.all(imgs.map((img) => {
      // #pagerSource (where this runs) is a permanently hidden staging
      // container with no layout box, so a loading="lazy" image never
      // triggers the browser's visibility check and its load event would
      // never fire. Forcing eager here bypasses that gate; it doesn't
      // affect the separate classic-scroll DOM, which keeps its own lazy
      // <img> elements from a different render pass.
      if (img.loading === 'lazy') img.loading = 'eager';
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  async function init({ container, source, track, prevBtn, nextBtn, indicator, onOverflowPrev, onOverflowNext, startAt, onPageChange, isActive }) {
    const allBlocks = Array.from(source.children);
    const active = isActive || (() => true);
    let currentPage = 0;
    let totalPages = 1;

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) { /* ignore */ }
    }
    try { await waitForImages(source); } catch (e) { /* ignore */ }

    function trackWidth() {
      // getBoundingClientRect gives the real sub-pixel width; clientWidth
      // truncates to a whole pixel, which drifted the shift out of sync
      // with the real column width by a page turn or two.
      return track.getBoundingClientRect().width;
    }

    function build() {
      // Measure the track itself — the same box whose width we later use
      // to shift pages — so the two numbers can never disagree.
      const width = trackWidth();
      const height = track.getBoundingClientRect().height;
      const pages = width > 0 && height > 0 ? splitIntoPages(allBlocks, width, height) : [allBlocks];

      track.style.transition = 'none';
      track.innerHTML = '';
      pages.forEach((pageBlocks) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'pager-page reader-body';
        pageBlocks.forEach((b) => pageEl.appendChild(b));
        track.appendChild(pageEl);
      });

      totalPages = Math.max(1, pages.length);
      currentPage = Math.min(currentPage, totalPages - 1);
    }

    function render(animate) {
      const shift = trackWidth() * currentPage;
      track.style.transition = animate ? 'transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)' : 'none';
      track.style.transform = `translateX(-${shift}px)`;
      if (indicator) indicator.textContent = totalPages > 1 ? `${currentPage + 1} / ${totalPages}` : '';
      if (prevBtn) prevBtn.disabled = currentPage === 0 && !onOverflowPrev;
      if (nextBtn) nextBtn.disabled = currentPage === totalPages - 1 && !onOverflowNext;
      if (onPageChange) onPageChange(currentPage, totalPages);
    }

    function goTo(page) {
      if (page < 0) {
        if (onOverflowPrev) onOverflowPrev();
        return;
      }
      if (page > totalPages - 1) {
        if (onOverflowNext) onOverflowNext();
        return;
      }
      currentPage = page;
      render(true);
    }

    function next() { if (active()) goTo(currentPage + 1); }
    function prev() { if (active()) goTo(currentPage - 1); }

    if (prevBtn) prevBtn.addEventListener('click', () => prev());
    if (nextBtn) nextBtn.addEventListener('click', () => next());

    function onKeydown(e) {
      if (!active()) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    document.addEventListener('keydown', onKeydown);

    let touchStartX = null;
    let touchStartY = null;
    container.addEventListener('touchstart', (e) => {
      if (!active()) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    container.addEventListener('touchend', (e) => {
      if (!active() || touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next(); else prev();
      }
    }, { passive: true });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!active()) return;
        build();
        render(false);
      }, 150);
    });

    build();
    if (startAt === 'end') currentPage = totalPages - 1;
    else if (typeof startAt === 'number' && startAt > 0) currentPage = Math.min(startAt, totalPages - 1);
    render(false);

    return {
      refresh() { build(); render(false); },
      destroy() { document.removeEventListener('keydown', onKeydown); },
    };
  }

  return { init };

})();
