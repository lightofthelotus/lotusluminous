// Left-nav speed dial: a single rounded FAB that expands to reveal the
// home/contact actions (and any future ones added to #fabActions), instead
// of two always-on buttons competing for space with the chapter dropdown.
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("floatNavLeft");
    const toggle = document.getElementById("fabToggle");
    const actions = document.getElementById("fabActions");
    if (!nav || !toggle || !actions) return;

    function open() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    function close() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      nav.classList.contains("is-open") ? close() : open();
    });

    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  });
})();
