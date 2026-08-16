// Zoom in/out buttons next to the bookmark tab: toggles the reader body
// between its normal size and a larger one. Only .reader-body/.pager-page
// text and headings are affected (see --reader-font-size in read.css) — the
// chapter title above the pager stays fixed. Applies the saved choice
// immediately (this script runs after the body markup, before paginate.js
// builds pages) so the very first pagination pass already reflects it, then
// fires an event read.js listens for to repaginate on later changes.
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
    const zoomOutBtn = document.getElementById("zoomOutBtn");
    const zoomInBtn = document.getElementById("zoomInBtn");
    if (!zoomOutBtn || !zoomInBtn) return;

    function refreshButtons(size) {
      zoomOutBtn.disabled = size === "normal";
      zoomInBtn.disabled = size === "large";
    }

    function setSize(size) {
      saveSize(size);
      applySize(size);
      refreshButtons(size);
      document.dispatchEvent(new CustomEvent("v2:fontsizechange", { detail: { size } }));
    }

    refreshButtons(loadSize());

    zoomOutBtn.addEventListener("click", () => setSize("normal"));
    zoomInBtn.addEventListener("click", () => setSize("large"));
  });
})();
