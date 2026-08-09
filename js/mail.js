// Client-only "mail me" widget: no backend, just deep-links into the
// reader's own webmail (or default desktop client) with the fields prefilled.
(function () {
  const EMAIL = "thelotusluminous@gmail.com";
  const SUBJECT = "Hello from your site";
  const BODY = "";

  const PROVIDERS = {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EMAIL)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
    yahoo: `https://compose.mail.yahoo.com/?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
    default: `mailto:${EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("mailMenu");
    const toggle = document.getElementById("mailToggle");
    const panel = document.getElementById("mailPanel");
    if (!menu || !toggle || !panel) return;

    panel.querySelectorAll(".mail-option").forEach((link) => {
      const url = PROVIDERS[link.dataset.provider];
      if (url) link.href = url;
    });

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

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    panel.querySelectorAll(".mail-option").forEach((link) => {
      link.addEventListener("click", close);
    });
  });
})();
