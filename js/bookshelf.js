(function () {
  const CATALOG_URL = "content/catalog.json";

  const CATEGORY_META = {
    novels: { label: "Novels", order: 1 },
    shortstories: { label: "Short Stories", order: 2 },
    tech: { label: "Tech Blogs", order: 3 },
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

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function fullDateLabel(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  }

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
  const READER_TYPE = { novels: "novel", shortstories: "shortstories", tech: "tech" };

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
    } else if (category === "shortstories") {
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
  const elExportDocx = document.getElementById("detailExportDocx");

  let activeBook = null;
  const isDesktop = () => window.matchMedia("(min-width: 861px)").matches;

  function openDetail(item, category, bookEl) {
    document.body.classList.remove("panel-closed");
    const title = item.title || formatTitle(item.slug);
    const meta = CATEGORY_META[category] || {};

    const metaParts = [];
    if (category === "tech" || category === "shortstories") {
      const dateLabel = fullDateLabel(item.date);
      if (dateLabel) metaParts.push(dateLabel);
    }
    if (item.readTime) metaParts.push(item.readTime);

    elTag.textContent = item.tag || meta.label || "";
    elTitle.textContent = title;
    elMeta.textContent = metaParts.join(" · ");
    elMeta.style.display = metaParts.length ? "" : "none";
    elDescription.textContent = item.description || "";
    elLink.textContent = (item.linkText || "Read") + " →";
    elLink.href = targetUrl(item, category);

    if (elExportDocx) {
      elExportDocx.dataset.type = READER_TYPE[category] || category;
      elExportDocx.dataset.slug = item.slug;
      elExportDocx.dataset.title = title;
    }

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
    // On desktop the panel is normally always docked, showing either a
    // book's detail or, by default, the about intro. Closing a book detail
    // should still just fall back to the intro — but if the intro itself is
    // what's showing (nothing left to "go back" to), collapse the panel
    // entirely so the X has something real to do, same as it already does
    // on mobile where closing hides the popup outright.
    if (isDesktop() && !placeholder.hidden) {
      document.body.classList.add("panel-closed");
      overlay.classList.remove("is-visible");
      if (activeBook) {
        activeBook.classList.remove("is-active");
        activeBook = null;
      }
      return;
    }

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
  // the panel is already docked and visible by default on desktop. On
  // desktop, the same icon appears once the panel has been closed, as the
  // way to bring it back.
  function openIntro() {
    document.body.classList.remove("panel-closed");
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
  if (infoToggle) {
    const INTRO_SEEN_KEY = "introSeen";
    if (!localStorage.getItem(INTRO_SEEN_KEY)) {
      infoToggle.classList.add("is-pulsing");
    }
    infoToggle.addEventListener("click", () => {
      infoToggle.classList.remove("is-pulsing");
      localStorage.setItem(INTRO_SEEN_KEY, "1");
      openIntro();
    });
  }

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
