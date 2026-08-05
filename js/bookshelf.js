(function () {
  const CATALOG_URL = "content/catalog.json";

  const CATEGORY_META = {
    novels: { label: "Novels", order: 1 },
    standalone: { label: "Short Stories", order: 2 },
    tech: { label: "Tech Blog", order: 3 },
  };

  // Cycle of dark, translucent glass tints for novel spines, so every cover
  // reads as a distinct book instead of a repeated flat panel, while still
  // sitting inside the dark-glass theme.
  const GRADIENTS = {
    novels: [
      "linear-gradient(160deg, rgba(140, 40, 30, 0.32), rgba(20, 8, 6, 0.18))",
      "linear-gradient(160deg, rgba(30, 70, 110, 0.32), rgba(8, 14, 22, 0.18))",
      "linear-gradient(160deg, rgba(90, 50, 130, 0.32), rgba(14, 8, 22, 0.18))",
      "linear-gradient(160deg, rgba(30, 100, 80, 0.32), rgba(8, 18, 14, 0.18))",
      "linear-gradient(160deg, rgba(140, 100, 20, 0.32), rgba(22, 16, 6, 0.18))",
    ],
  };

  // Small alternating tilt so stacked newspapers don't look perfectly uniform.
  const TILTS = ["-1.5deg", "1deg", "-0.5deg", "1.8deg"];

  function formatTitle(slug) {
    return slug
      .split("-")
      .map((word) => {
        if (["api", "apis", "ai"].includes(word.toLowerCase())) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  const READER = "read.html";
  const READER_TYPE = { novels: "novel", standalone: "standalone", tech: "tech" };

  // v2 has its own immersive reader now (read.html) — self-contained, no
  // dependency on the hosted main site's reader.
  function targetUrl(item, category) {
    const type = READER_TYPE[category] || category;
    return `${READER}?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(item.slug)}`;
  }

  function buildBook(item, category, index) {
    const title = item.title || formatTitle(item.slug);

    const book = document.createElement("button");
    book.type = "button";
    book.className = "book";
    book.dataset.category = category;
    book.setAttribute("aria-haspopup", "dialog");

    if (category === "tech") {
      const tilt = TILTS[index % TILTS.length];
      book.innerHTML = `
        <span class="newspaper" style="--tilt: ${tilt}">
          <span class="newspaper-headline">${title}</span>
          <span class="newspaper-rule"></span>
          <span class="newspaper-columns" aria-hidden="true"></span>
        </span>
      `;
    } else if (category === "standalone") {
      const tilt = TILTS[index % TILTS.length];
      book.innerHTML = `
        <span class="notepad" style="--tilt: ${tilt}">
          <span class="notepad-rings" aria-hidden="true"></span>
          <span class="notepad-title">${title}</span>
        </span>
      `;
    } else {
      const gradients = GRADIENTS[category] || GRADIENTS.novels;
      const bg = gradients[index % gradients.length];
      book.innerHTML = `
        <span class="book-spine" style="--spine-bg: ${bg}">
          <span class="book-title">${title}</span>
        </span>
      `;
    }

    book.addEventListener("click", () => openDetail(item, category, book));
    return book;
  }

  const ARROW_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
  const ARROW_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

  // Each shelf row scrolls independently — the prev/next click zones only
  // ever act on the row they belong to.
  function wireRowScroll(viewport, row, prevBtn, nextBtn) {
    function update() {
      const scrollable = row.scrollWidth > row.clientWidth + 1;
      viewport.classList.toggle("is-scrollable", scrollable);
      prevBtn.disabled = row.scrollLeft <= 1;
      nextBtn.disabled = row.scrollLeft >= row.scrollWidth - row.clientWidth - 1;
    }

    function scrollByRow(direction) {
      const amount = Math.max(row.clientWidth * 0.8, 220);
      row.scrollBy({ left: direction * amount, behavior: "smooth" });
    }

    prevBtn.addEventListener("click", () => scrollByRow(-1));
    nextBtn.addEventListener("click", () => scrollByRow(1));
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    requestAnimationFrame(update);
  }

  function buildShelf(category, items) {
    const meta = CATEGORY_META[category] || { label: category };

    const section = document.createElement("section");
    section.className = "shelf";
    section.dataset.category = category;

    const head = document.createElement("div");
    head.className = "shelf-head";

    const title = document.createElement("h2");
    title.className = "shelf-title";
    title.textContent = meta.label;
    head.appendChild(title);

    const count = document.createElement("span");
    count.className = "shelf-count";
    count.textContent = `${items.length} title${items.length === 1 ? "" : "s"}`;
    head.appendChild(count);

    section.appendChild(head);

    const viewport = document.createElement("div");
    viewport.className = "shelf-viewport";

    const row = document.createElement("div");
    row.className = "shelf-row";
    items.forEach((item, i) => row.appendChild(buildBook(item, category, i)));

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "shelf-nav shelf-nav--prev";
    prevBtn.setAttribute("aria-label", `Scroll ${meta.label} left`);
    prevBtn.innerHTML = ARROW_LEFT;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "shelf-nav shelf-nav--next";
    nextBtn.setAttribute("aria-label", `Scroll ${meta.label} right`);
    nextBtn.innerHTML = ARROW_RIGHT;

    viewport.appendChild(prevBtn);
    viewport.appendChild(row);
    viewport.appendChild(nextBtn);
    section.appendChild(viewport);

    const plank = document.createElement("div");
    plank.className = "shelf-plank";
    section.appendChild(plank);

    wireRowScroll(viewport, row, prevBtn, nextBtn);

    return section;
  }

  // Card sizes come from the row's height (aspect-ratio + flex stretch), not
  // from the title — so a long title and a short one get the same box on
  // the same screen. The CSS clamp() on each title font-size only accounts
  // for viewport size, not title length, so a long title at that size can
  // need more vertical room than the box has and gets cropped mid-line.
  // This measures the box each title actually has to work with and shrinks
  // the font, in 1px steps, until the full title fits inside it — reusing
  // the CSS clamp() value as the starting point/ceiling, so short titles on
  // a big screen still get to render at the larger, more readable size.
  function fitTitle(el, availablePx, minPx) {
    if (!el || !availablePx || availablePx <= 1) return;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    let guard = 60;
    while (el.scrollHeight > availablePx + 1 && size > minPx && guard-- > 0) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }

  function fitAllTitles() {
    document.querySelectorAll(".book-spine").forEach((spine) => {
      const title = spine.querySelector(".book-title");
      const cs = getComputedStyle(spine);
      const available = spine.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      fitTitle(title, available, 11);
    });

    document.querySelectorAll(".notepad").forEach((pad) => {
      const title = pad.querySelector(".notepad-title");
      const cs = getComputedStyle(pad);
      const available = pad.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      fitTitle(title, available, 11);
    });

    // The headline's own clientHeight is its flex-allocated share of the
    // newspaper (flex-basis: 0, min-height: 0 in the CSS), fixed
    // regardless of its font-size or content — safe to use directly as
    // the available budget.
    document.querySelectorAll(".newspaper-headline").forEach((headline) => {
      fitTitle(headline, headline.clientHeight, 10);
    });
  }

  let fitTitlesTimer;
  function scheduleFitTitles() {
    clearTimeout(fitTitlesTimer);
    fitTitlesTimer = setTimeout(fitAllTitles, 80);
  }

  function renderLibrary(catalog) {
    const container = document.getElementById("library");
    container.innerHTML = "";

    Object.keys(CATEGORY_META)
      .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)
      .forEach((category) => {
        const items = catalog[category];
        if (items && items.length) {
          container.appendChild(buildShelf(category, items));
        }
      });

    requestAnimationFrame(fitAllTitles);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitAllTitles).catch(() => {});
    }
    window.addEventListener("resize", scheduleFitTitles);
  }

  // ---------- Detail panel: docked pane on desktop, popup card on mobile ----------
  const overlay = document.getElementById("detailOverlay");
  const panel = document.getElementById("detailPanel");
  const placeholder = document.getElementById("detailPlaceholder");
  const content = document.getElementById("detailContent");
  const closeBtn = document.getElementById("detailClose");
  const elTag = document.getElementById("detailTag");
  const elTitle = document.getElementById("detailTitle");
  const elMeta = document.getElementById("detailMeta");
  const elDescription = document.getElementById("detailDescription");
  const elLink = document.getElementById("detailLink");

  let activeBook = null;

  function openDetail(item, category, bookEl) {
    const title = item.title || formatTitle(item.slug);
    const meta = CATEGORY_META[category] || {};

    elTag.textContent = item.tag || meta.label || "";
    elTitle.textContent = title;
    elMeta.textContent = item.readTime || "";
    elMeta.style.display = item.readTime ? "" : "none";
    elDescription.textContent = item.description || "";
    elLink.textContent = (item.linkText || "Read") + " →";
    elLink.href = targetUrl(item, category);

    placeholder.hidden = true;
    // Re-trigger the fade/slide-in animation on every selection, not just the first.
    content.hidden = true;
    void content.offsetWidth;
    content.hidden = false;

    panel.classList.add("is-open");
    overlay.classList.add("is-visible");

    if (activeBook) activeBook.classList.remove("is-active");
    activeBook = bookEl || null;
    if (activeBook) activeBook.classList.add("is-active");
  }

  function closeDetail() {
    panel.classList.remove("is-open");
    overlay.classList.remove("is-visible");
    content.hidden = true;
    placeholder.hidden = false;
    if (activeBook) {
      activeBook.classList.remove("is-active");
      activeBook = null;
    }
  }

  // Mobile-only: the info icon next to the "Lotus Luminous" header opens the
  // same popup used for book details, but showing the site intro instead —
  // the panel is already docked and visible by default on desktop.
  function openIntro() {
    content.hidden = true;
    placeholder.hidden = false;
    panel.classList.add("is-open");
    overlay.classList.add("is-visible");
    if (activeBook) {
      activeBook.classList.remove("is-active");
      activeBook = null;
    }
  }

  closeBtn.addEventListener("click", closeDetail);
  overlay.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });

  const infoToggle = document.getElementById("infoToggle");
  if (infoToggle) infoToggle.addEventListener("click", openIntro);

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("year").textContent = new Date().getFullYear();

    fetch(CATALOG_URL)
      .then((res) => res.json())
      .then(renderLibrary)
      .catch((err) => {
        console.error("Failed to load catalog.json", err);
        document.getElementById("library").innerHTML =
          '<p class="library-message">The shelf couldn\'t be loaded right now.</p>';
      });
  });
})();
