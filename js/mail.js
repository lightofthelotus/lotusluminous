// Client-only "mail me" widget: no backend, just deep-links into the
// reader's own webmail (or default desktop client) with the fields prefilled.
(function () {
  const EMAIL = "thelotusluminous@gmail.com";
  const SUBJECT = "Here is what I think about thelotusluminous.in";
  const BODY = "";

  const PROVIDERS = {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EMAIL)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
    yahoo: `https://compose.mail.yahoo.com/?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
    default: `mailto:${EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`,
  };

  // On phones/tablets, tapping a mail.google.com / outlook.live.com link
  // gets intercepted by the installed app itself (Android App Links / iOS
  // Universal Links) before it ever reaches the compose page, so the app
  // just opens to the inbox and drops the to/subject/body params. mailto:
  // isn't hijacked that way — the OS routes it straight to the default
  // mail app (or a chooser) fully prefilled — so skip the picker on touch
  // devices and fire mailto: directly.
  // UA-only check (not pointer:coarse): touchscreen laptops also report a
  // coarse pointer, which wrongly sent them down the mailto-only path and
  // broke the dropdown for anyone without a desktop mail client configured.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("mailMenu");
    const toggle = document.getElementById("mailToggle");
    const panel = document.getElementById("mailPanel");
    if (!menu || !toggle || !panel) return;

    panel.querySelectorAll(".mail-option").forEach((link) => {
      const url = PROVIDERS[link.dataset.provider];
      if (url) link.href = url;
    });

    if (isMobile) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = PROVIDERS.default;
      });
      return;
    }

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
