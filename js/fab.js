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

  // Drop-down for read aloud / zoom / bookmarks (see .tools-group in read.css).
  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("toolsToggle");
    const group = document.getElementById("toolsGroup");
    if (!toggle || !group) return;

    function setOpen(open) {
      group.classList.toggle("is-open", open);
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!group.classList.contains("is-open"));
    });
    document.addEventListener("click", (e) => {
      if (!group.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  });
})();
