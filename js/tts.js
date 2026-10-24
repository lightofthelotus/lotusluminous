/*
 * Read-aloud for the reader. The floating speaker button (#ttsToggle)
 * switches on a sentence-by-sentence narration of the page the reader is
 * on, using the browser's built-in speech voices.
 *
 * - Each sentence gets its own pitch / rate / volume, inferred from the text
 *   (punctuation, dialogue, a small mood vocabulary), and the next sentence
 *   is prepared while the current one is still being spoken, so the gap
 *   between sentences is only a short natural pause (never above MAX_PAUSE_MS).
 * - The word being spoken is highlighted (white background, black text) via
 *   the CSS Custom Highlight API, which paints Ranges without touching the
 *   DOM — so it can't disturb the paginator and has no layout cost. Word
 *   positions come from the engine's `boundary` events; voices that don't
 *   emit them fall back to a timed estimate.
 * - When a page is finished the reader turns to the next one. A sentence that
 *   runs over a page break is skipped at the bottom of the first page and read
 *   in full after the turn; only the words on the new page are highlighted.
 * - Playback stops at the end of the chapter, and restarts from the top of
 *   the page whenever the reader turns the page themselves or the pages are
 *   re-flowed (zoom / resize).
 */
(function () {
  const MAX_PAUSE_MS = 900;
  const ESTIMATE_AFTER_MS = 350;      // no boundary event by then => estimate
  const EST_CHARS_PER_SEC = 15;       // at rate 1.0
  const HIGHLIGHT_NAME = 'tts-word';
  const TERMINATOR = /[.!?…]["'”’)\]]*$/;
  const ABBREVIATION = /^(?:mr|mrs|ms|dr|st|sr|jr|vs|etc|prof|no|[A-Za-z])\.$/i;
  const OPENING_QUOTE = /^["'“‘(\[]+/;
  const SPEECH_CHARS = { '—': ',', '–': ',', '…': ',' }; // same-length swaps keep char offsets valid

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('ttsToggle');
    if (!btn) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      btn.hidden = true;
      return;
    }

    const synth = window.speechSynthesis;
    const track = document.getElementById('pagerTrack');
    const canHighlight = !!(window.CSS && CSS.highlights && typeof Highlight !== 'undefined');

    let on = false;
    let gen = 0;                 // bumps on every stop/restart; stale callbacks compare against it
    let cursor = null;           // { page, index } of the sentence being / about to be spoken
    let pageCache = new Map();   // page index -> sentence items
    let activeUtterance = null;  // held so the engine can't garbage-collect it mid-speech
    let timers = [];
    let internalNav = false;
    let restartTimer = null;
    let waiting = false;         // switched on, but the browser wants a tap before it will speak
    let autoAttempt = false;     // first utterance after a page load while resuming
    let pendingAuto = false;     // resume once the pager has built the first page

    // The on/off choice lives for the browser tab's session, so it survives
    // chapter changes and reloads, and is gone when the browser is closed.
    const STORE_KEY = 'v2:readAloud';
    const remember = (v) => { try { v ? sessionStorage.setItem(STORE_KEY, '1') : sessionStorage.removeItem(STORE_KEY); } catch (e) { /* storage unavailable */ } };
    const remembered = () => { try { return sessionStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; } };
    let voice = null;
    let pronunciations = {};     // lower-cased word -> respelling (js/pronunciations.js)

    // Respellings (js/pronunciations.js) are read by the voice instead of the
    // printed word, which fixes how names like Vaanathi are said.
    Object.keys(window.V2Pronunciations || {}).forEach((k) => {
      pronunciations[k.toLowerCase()] = window.V2Pronunciations[k];
    });
    console.info(`[read-aloud] ${Object.keys(pronunciations).length} pronunciations loaded`);

    // ---------- Voice ----------
    function pickVoice() {
      const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
      if (!voices.length) return null;
      // Browsers don't expose gender, so female Indian-English voices are
      // recognised by locale plus known names (Windows: Neerja, Heera;
      // macOS/iOS: Veena; Android/Chrome: "female" in the name).
      const FEMALE_IN = /neerja|heera|veena|aditi|raveena|priya|kalpana|female/i;
      const MALE = /ravi|prabhat|rishi|hemant|\bmale\b/i;
      const score = (v) =>
        (/^en[-_]IN/i.test(v.lang) ? 20 : 0) +
        (FEMALE_IN.test(v.name) ? 10 : 0) -
        (MALE.test(v.name) && !/female/i.test(v.name) ? 10 : 0) +
        (/natural|neural/i.test(v.name) ? 5 : 0) +
        (v.localService ? 2 : 0) +
        (/^en[-_]GB/i.test(v.lang) ? 1 : 0) -
        (/google/i.test(v.name) ? 1 : 0); // Google network voices never report word boundaries
      return voices.sort((a, b) => score(b) - score(a))[0];
    }

    // ---------- Text model ----------
    // Flattens a block's text nodes into one string plus a per-character map
    // back to (node, offset), so any word can become a Range regardless of
    // how many <em>/<strong> wrappers it crosses.
    function flatten(block) {
      let text = '';
      const nodes = [];
      const offs = [];
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeType === Node.TEXT_NODE) {
          for (let i = 0; i < n.data.length; i++) {
            text += n.data[i];
            nodes.push(n);
            offs.push(i);
          }
        } else if (n.tagName === 'BR') {
          text += ' ';
          nodes.push(null);
          offs.push(0);
        }
      }
      return { text, nodes, offs };
    }

    function isSentenceEnd(word, nextWord) {
      if (!TERMINATOR.test(word)) return false;
      if (ABBREVIATION.test(word.replace(/^["'“‘(\[]+/, ''))) return false;
      // `"Wait." she said` — a lowercase word after the terminator continues the sentence.
      if (nextWord && /^[a-z]/.test(nextWord.replace(OPENING_QUOTE, ''))) return false;
      return true;
    }

    // Splits a flattened block into sentences of word records.
    function segment(flat, pageIndex) {
      const words = [];
      const re = /\S+/g;
      let m;
      while ((m = re.exec(flat.text))) {
        words.push({ text: m[0], s: m.index, e: m.index + m[0].length, flat, pageIndex });
      }
      const sentences = [];
      let cur = [];
      words.forEach((w, i) => {
        cur.push(w);
        const next = words[i + 1];
        if (isSentenceEnd(w.text, next && next.text)) { sentences.push(cur); cur = []; }
      });
      if (cur.length) sentences.push(cur); // unterminated tail
      return { sentences, endsClean: cur.length === 0 };
    }

    const LEAF = 'p, li, h2, h3, h4, blockquote:not(:has(p, li))';
    function leafBlocks(pageEl) {
      return Array.from(pageEl.querySelectorAll(LEAF))
        .filter((el) => !el.closest('figure, .scene-break, .status-marker') && el.textContent.trim());
    }

    // Does page p open with the second half of a paragraph that began on p-1?
    function continuesFromPrevious(p) {
      if (p <= 0) return false;
      const prev = track.children[p - 1];
      const cur = track.children[p];
      if (!prev || !cur) return false;
      const a = prev.lastElementChild;
      const b = cur.firstElementChild;
      return !!(a && b && a.tagName === 'P' && b.tagName === 'P' &&
        a.dataset.pageBlockIndex !== undefined &&
        a.dataset.pageBlockIndex === b.dataset.pageBlockIndex);
    }

    // The unfinished sentence at the very end of page p-1 that spills onto p.
    function carriedTail(p) {
      if (!continuesFromPrevious(p)) return null;
      const blocks = leafBlocks(track.children[p - 1]);
      const last = blocks[blocks.length - 1];
      if (!last) return null;
      const seg = segment(flatten(last), p - 1);
      return seg.endsClean ? null : seg.sentences[seg.sentences.length - 1];
    }

    function buildPage(p) {
      const pageEl = track.children[p];
      if (!pageEl) return [];
      const blocks = leafBlocks(pageEl);
      const spillsOver = continuesFromPrevious(p + 1);
      const items = [];

      blocks.forEach((block, bi) => {
        const seg = segment(flatten(block), p);
        let sentences = seg.sentences;

        if (bi === 0) {
          const carried = carriedTail(p);
          if (carried && sentences.length) sentences[0] = carried.concat(sentences[0]);
        }
        // Its unfinished last sentence is read in full on the next page instead.
        if (bi === blocks.length - 1 && spillsOver && !seg.endsClean) sentences = sentences.slice(0, -1);

        const heading = /^H\d$/.test(block.tagName);
        sentences.forEach((words, si) => {
          items.push(makeItem(words, p, heading, si === sentences.length - 1));
        });
      });
      return items;
    }

    function getItems(p) {
      if (!pageCache.has(p)) pageCache.set(p, buildPage(p));
      return pageCache.get(p);
    }

    // ---------- Emotion ----------
    const LEXICON = [
      { re: /\b(dark\w*|shadow\w*|fear\w*|afraid|dread\w*|cold|silen\w*|blood\w*|death|dead|die[sd]?|grave|tremb\w*|shiver\w*|ghost\w*|curse[sd]?)\b/i, pitch: -0.08, rate: -0.07 },
      { re: /\b(whisper\w*|murmur\w*|hush\w*|softly|quietly|breath\w*)\b/i, pitch: -0.03, rate: -0.05, volume: 0.7 },
      { re: /\b(rage|furious|fury|angry|anger|snarl\w*|growl\w*|shout\w*|roar\w*|scream\w*|burn\w*|storm\w*|never)\b/i, pitch: 0.05, rate: 0.1, volume: 1 },
      { re: /\b(laugh\w*|smil\w*|joy\w*|delight\w*|love[sd]?|loving|warm\w*|gentl\w*|tender\w*|glad|bright|golden|dawn)\b/i, pitch: 0.08, rate: 0.02 },
      { re: /\b(weep\w*|wept|tears?|griev\w*|sorrow\w*|mourn\w*|lost|alone|empty|ache[sd]?|aching)\b/i, pitch: -0.06, rate: -0.1 },
    ];

    function emotionFor(text, heading, wordCount) {
      let rate = 0.97, pitch = 1, volume = 1, pause = 220;

      if (OPENING_QUOTE.test(text)) { pitch += 0.08; rate += 0.03; pause = 150; }
      if (/\?["'”’)\]]*$/.test(text)) { pitch += 0.14; pause = 300; }
      if (/!/.test(text)) { pitch += 0.1; rate += 0.08; volume = 1; pause = 280; }
      if (/…|\.\.\.|[—–]["'”’]?$/.test(text)) { rate -= 0.08; pitch -= 0.04; pause = 450; }
      if (wordCount <= 3) rate -= 0.06;
      else if (wordCount >= 28) rate += 0.04;
      LEXICON.forEach((l) => {
        if (l.re.test(text)) {
          pitch += l.pitch || 0;
          rate += l.rate || 0;
          if (l.volume !== undefined) volume = l.volume;
        }
      });
      if (heading) { rate -= 0.1; pitch -= 0.05; pause = 500; }

      return {
        rate: Math.min(1.35, Math.max(0.7, rate)),
        pitch: Math.min(1.5, Math.max(0.6, pitch)),
        volume: Math.min(1, Math.max(0.3, volume)),
        pause,
      };
    }

    // Swaps the word's letters for its respelling, keeping surrounding
    // punctuation and a possessive 's ("Vaanathi's" -> "Vaanathee's").
    function pronounce(text) {
      const m = /^([^\p{L}]*)(\p{L}+)(['’]s)?([^\p{L}]*)$/u.exec(text);
      const respelt = m && pronunciations[m[2].toLowerCase()];
      return respelt ? m[1] + respelt + (m[3] || '') + m[4] : text;
    }

    function makeItem(words, pageIndex, heading, paragraphEnd) {
      let speak = '';
      words.forEach((w, i) => {
        if (i) speak += ' ';
        w.charStart = speak.length;
        speak += pronounce(w.text).replace(/[—–…]/g, (c) => SPEECH_CHARS[c]);
      });
      const text = words.map((w) => w.text).join(' ');
      const emo = emotionFor(text, heading, words.length);
      if (paragraphEnd) emo.pause += 250;
      emo.pause = Math.min(MAX_PAUSE_MS, emo.pause);
      return { words, speak, pageIndex, emo };
    }

    // ---------- Highlight ----------
    // One Highlight object for the whole session, emptied and refilled — more
    // reliable on touch browsers than swapping a new object into the registry,
    // which could leave the previous word painted.
    const wordHighlight = canHighlight ? new Highlight() : null;
    if (canHighlight) CSS.highlights.set(HIGHLIGHT_NAME, wordHighlight);

    function clearHighlight() {
      if (wordHighlight) wordHighlight.clear();
    }

    function highlightWord(item, wi) {
      if (!canHighlight) return;
      const w = item.words[wi];
      // Words still on the previous page (wrapped sentence) stay unhighlighted.
      if (!w || w.pageIndex !== item.pageIndex) { clearHighlight(); return; }
      const { nodes, offs } = w.flat;
      if (!nodes[w.s] || !nodes[w.e - 1]) return;
      const range = document.createRange();
      range.setStart(nodes[w.s], offs[w.s]);
      range.setEnd(nodes[w.e - 1], offs[w.e - 1] + 1);
      wordHighlight.clear();
      wordHighlight.add(range);
    }

    function wordAtChar(item, charIndex) {
      let lo = 0, hi = item.words.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (item.words[mid].charStart <= charIndex) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    // ---------- Playback ----------
    function later(fn, ms) {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    }

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function turnTo(p) {
      const pager = window.V2Pager;
      if (!pager || pager.getState().currentPage === p) return;
      internalNav = true; // the pagechange this fires is ours, not the reader's
      pager.goTo(p);
      internalNav = false;
    }

    // Moves the cursor to the next sentence, skipping empty (illustration-only) pages.
    function advance() {
      const total = window.V2Pager.getState().totalPages;
      let { page, index } = cursor;
      index++;
      while (page < total && index >= getItems(page).length) { page++; index = 0; }
      if (page >= total) return false;
      cursor = { page, index };
      return true;
    }

    function speakCurrent() {
      if (!on) return;
      const myGen = gen;
      const item = getItems(cursor.page)[cursor.index];
      if (!item) { stop(); return; }

      turnTo(item.pageIndex);
      clearHighlight(); // nothing from the previous sentence may linger

      const u = new SpeechSynthesisUtterance(item.speak);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-US'; }
      u.rate = item.emo.rate;
      u.pitch = item.emo.pitch;
      u.volume = item.emo.volume;

      let sawBoundary = false;

      function estimate(wi) {
        if (myGen !== gen || sawBoundary || wi >= item.words.length) return;
        highlightWord(item, wi);
        const w = item.words[wi];
        later(() => estimate(wi + 1), ((w.text.length + 1) / (EST_CHARS_PER_SEC * u.rate)) * 1000);
      }

      u.onstart = () => {
        if (myGen !== gen) return;
        autoAttempt = false;
        highlightWord(item, 0);
        later(() => { if (!sawBoundary) estimate(0); }, ESTIMATE_AFTER_MS);
        // Warm the next sentence (builds its page + emotion) while this one speaks.
        const saved = cursor;
        if (advance()) { getItems(cursor.page); }
        cursor = saved;
      };
      u.onboundary = (e) => {
        if (myGen !== gen || (e.name && e.name !== 'word')) return;
        sawBoundary = true;
        highlightWord(item, wordAtChar(item, e.charIndex));
      };
      u.onend = () => {
        if (myGen !== gen) return;
        sawBoundary = true; // stops any estimate chain
        clearHighlight();
        if (!advance()) { endOfChapter(); return; }
        later(speakCurrent, item.emo.pause);
      };
      u.onerror = (e) => {
        if (myGen !== gen || e.error === 'interrupted' || e.error === 'canceled') return;
        sawBoundary = true;
        clearHighlight();
        if (e.error === 'not-allowed') { needGesture(); return; }
        if (!advance()) { endOfChapter(); return; }
        later(speakCurrent, 100);
      };

      console.debug('[read-aloud] speaking:', item.speak);
      activeUtterance = u;
      synth.speak(u);
      // Some browsers drop a speak() that has no user activation without any error.
      if (autoAttempt) later(() => { if (myGen === gen && autoAttempt) needGesture(); }, 2500);
    }

    function setButton(state) {
      btn.classList.toggle('is-on', state);
      document.body.classList.toggle('tts-on', state);
      btn.setAttribute('aria-pressed', String(state));
      btn.title = state ? 'Stop reading aloud' : 'Read aloud';
      btn.setAttribute('aria-label', btn.title);
    }

    function setWaiting(state) {
      waiting = state;
      btn.classList.toggle('is-waiting', state);
      let toast = document.getElementById('ttsToast');
      if (state && !toast) {
        toast = document.createElement('div');
        toast.id = 'ttsToast';
        toast.className = 'tts-toast';
        toast.setAttribute('role', 'status');
        toast.textContent = 'Tap anywhere to continue reading aloud';
        document.body.appendChild(toast);
      }
      if (toast) toast.hidden = !state;
    }

    // Browsers refuse to start speech on a freshly loaded page until the
    // reader interacts with it. Stay switched on and resume at the next tap/key.
    function needGesture() {
      gen++;
      clearTimers();
      synth.cancel();
      autoAttempt = false;
      setWaiting(true);
    }

    function onGesture(e) {
      if (!waiting || btn.contains(e.target)) return;
      setWaiting(false);
      start();
    }
    ['click', 'touchend', 'keydown'].forEach((t) => document.addEventListener(t, onGesture, true));

    // Chapter finished: carry on into the next chapter if there is one.
    function endOfChapter() {
      const pager = window.V2Pager;
      if (pager && pager.hasNextChapter) {
        gen++;
        clearTimers();
        clearHighlight();
        pager.goTo(pager.getState().totalPages); // navigates; the next page resumes via sessionStorage
        return;
      }
      stop(); // end of the book
    }

    // Restart narration at a given sentence on the page the reader is viewing.
    function startAt(page, index) {
      voice = voice || pickVoice();
      setWaiting(false);
      gen++;
      clearTimers();
      clearTimeout(restartTimer);
      synth.cancel();
      clearHighlight();
      cursor = { page, index };
      later(speakCurrent, 60);
    }

    // Finds the sentence holding the caret position (node, offset). Looks at
    // the viewed page and the next one, since a sentence that wraps over a
    // page break is read from the next page's list.
    function sentenceAtCaret(node, offset, page) {
      const total = window.V2Pager.getState().totalPages;
      for (let p = page; p <= Math.min(page + 1, total - 1); p++) {
        const items = getItems(p);
        for (let i = 0; i < items.length; i++) {
          for (const w of items[i].words) {
            const { nodes, offs } = w.flat;
            if (!nodes[w.s] || !nodes[w.e - 1]) continue;
            const r = document.createRange();
            r.setStart(nodes[w.s], offs[w.s]);
            r.setEnd(nodes[w.e - 1], offs[w.e - 1] + 1);
            // 1 = caret is past this word; the first word that isn't is the one clicked (or the next after a gap)
            let pos;
            try { pos = r.comparePoint(node, offset); } catch (err) { continue; }
            if (pos <= 0) return { page: p, index: i };
          }
        }
      }
      return null;
    }

    function caretAt(x, y) {
      if (document.caretPositionFromPoint) {
        const c = document.caretPositionFromPoint(x, y);
        return c && c.offsetNode ? { node: c.offsetNode, offset: c.offset } : null;
      }
      if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(x, y);
        return r ? { node: r.startContainer, offset: r.startOffset } : null;
      }
      return null;
    }

    track.addEventListener('click', (e) => {
      if (!on || e.target.closest('a, button')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // the reader was selecting text, not jumping
      const caret = caretAt(e.clientX, e.clientY);
      if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return;
      const hit = sentenceAtCaret(caret.node, caret.offset, window.V2Pager.getState().currentPage);
      if (hit) startAt(hit.page, hit.index);
    });

    function start() {
      const pager = window.V2Pager;
      if (!pager) return;
      voice = voice || pickVoice();
      on = true;
      remember(true);
      setWaiting(false);
      gen++;
      clearTimers();
      pageCache = new Map();
      setButton(true);
      synth.cancel();

      const total = pager.getState().totalPages;
      let page = pager.getState().currentPage;
      while (page < total && !getItems(page).length) page++;
      if (page >= total) { stop(); return; }
      cursor = { page, index: 0 };
      // Chrome drops a speak() issued in the same tick as cancel().
      later(speakCurrent, 60);
    }

    function stop() {
      on = false;
      remember(false);
      setWaiting(false);
      gen++;
      clearTimers();
      clearTimeout(restartTimer);
      synth.cancel();
      activeUtterance = null;
      clearHighlight();
      setButton(false);
    }

    btn.addEventListener('click', () => (on ? stop() : start()));
    // Voices load asynchronously in Chrome; re-pick when they arrive.
    synth.addEventListener && synth.addEventListener('voiceschanged', () => { voice = pickVoice(); });

    // Resumes narration from the first word of a newly opened chapter. The
    // pager reports its first page just before window.V2Pager exists, so this
    // is also called on v2:pagerready.
    function autoResume() {
      if (!pendingAuto || !window.V2Pager) return;
      pendingAuto = false;
      autoAttempt = true;
      start();
    }
    document.addEventListener('v2:pagerready', autoResume);

    // The reader turned the page (or pages were re-flowed): resume from the top of what they see.
    document.addEventListener('v2:pagechange', () => {
      if (!on || internalNav) return;
      if (pendingAuto) { autoResume(); return; }
      if (waiting) return; // the next tap resumes from whatever page is showing
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => { if (on) start(); }, 120);
    });

    window.addEventListener('pagehide', () => synth.cancel());

    // Switched on earlier in this browser session: show it as on straight
    // away and start as soon as the first page of this chapter is ready.
    if (remembered()) {
      on = true;
      pendingAuto = true;
      setButton(true);
    } else {
      setButton(false);
    }
  });
})();
