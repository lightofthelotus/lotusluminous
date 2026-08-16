// Text-size picker in the FAB's speed dial: toggles the reader body between
// its normal size and a larger one. Only .reader-body/.pager-page text and
// headings are affected (see --reader-font-size in read.css) — the chapter
// title above the pager stays fixed. Applies the saved choice immediately
// (this script runs after the body markup, before paginate.js builds pages)
// so the very first pagination pass already reflects it, then fires an
// event read.js listens for to repaginate on later changes.
(function () {
  const STORAGE_KEY = "v2:fontSize";
  const SIZES = ["normal", "large"];

  function loadSize() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return SIZES.includes(saved) ? saved : "normal";
    } catch (e) {
      return "normal";
    }
  }

  function saveSize(size) {
    try { localStorage.setItem(STORAGE_KEY, size); } catch (e) { /* storage unavailable */ }
  }

  function applySize(size) {
    document.body.classList.toggle("font-size-large", size === "large");
  }

  applySize(loadSize());

  document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("fontSizeMenu");
    const toggle = document.getElementById("fontSizeToggle");
    const panel = document.getElementById("fontSizePanel");
    if (!menu || !toggle || !panel) return;

    const options = Array.from(panel.querySelectorAll(".fontsize-option"));

    function markSelected(size) {
      options.forEach((opt) => {
        opt.setAttribute("aria-checked", String(opt.dataset.size === size));
      });
    }

    markSelected(loadSize());

    function open() {
      panel.hidden = false;
      menu.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    function close() {
      panel.hidden = true;
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });

    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        const size = opt.dataset.size;
        saveSize(size);
        applySize(size);
        markSelected(size);
        close();
        document.dispatchEvent(new CustomEvent("v2:fontsizechange", { detail: { size } }));
      });
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  });
})();
