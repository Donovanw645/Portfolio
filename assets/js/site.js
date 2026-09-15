/* ==========================================================================
   Portfolio - site runtime
   Loads data/content.json and renders every public page from it.
   No build step, no dependencies. Works from any base path (user or
   project GitHub Pages sites alike).
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Base path resolution
     The script figures out the site root from its own <script src>, so
     every asset reference works whether the site is served from
     example.github.io/ or example.github.io/Portfolio/.
     --------------------------------------------------------------------- */
  var BASE = (function () {
    var el = document.currentScript;
    if (!el) {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (/site\.js(\?|$)/.test(all[i].src)) { el = all[i]; break; }
      }
    }
    if (!el || !el.src) return "./";
    return el.src.replace(/assets\/js\/site\.js.*$/, "");
  })();

  var DRAFT_KEY = "portfolio:draft";
  var THEME_KEY = "portfolio:theme";

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* Only allow http(s), mailto, tel and site-relative URLs in rendered links. */
  function safeUrl(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
    if (/^(javascript|data|vbscript):/i.test(raw.replace(/\s/g, ""))) return "";
    return raw;
  }

  /* Resolve a stored asset reference. Uploaded images are stored either as
     a repo-relative path ("assets/img/uploads/x.jpg"), a full URL, or an
     inline data: URL when the site has not been published through GitHub. */
  function asset(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^(https?:|data:|\/\/)/i.test(raw)) return raw;
    return BASE + raw.replace(/^\.?\//, "");
  }

  function nonEmpty(list) {
    return (Array.isArray(list) ? list : []).filter(function (item) {
      if (item === null || item === undefined) return false;
      if (typeof item === "string") return item.trim() !== "";
      return true;
    });
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "—";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function periodLabel(item) {
    var start = String(item.start || "").trim();
    var end = item.current ? "Present" : String(item.end || "").trim();
    if (start && end) return start + " — " + end;
    return start || end || "";
  }

  /* ---------------------------------------------------------------------
     Icons
     --------------------------------------------------------------------- */
  var ICONS = {
    arrow: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>',
    external: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3H3v10h10v-3M10 2h4v4M14 2l-6 6"/></svg>',
    mail: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1.5" y="3" width="13" height="10"/><path d="m1.5 4 6.5 4.5L14.5 4"/></svg>',
    phone: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 2h3l1.5 3.5L5.5 7a8 8 0 0 0 3.5 3.5l1.5-2L14 10v3H13A10.5 10.5 0 0 1 3 3Z"/></svg>',
    pin: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 14s5-4.2 5-8A5 5 0 0 0 3 6c0 3.8 5 8 5 8Z"/><circle cx="8" cy="6" r="1.8"/></svg>',
    doc: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 1.5H4v13h8V4.5Z"/><path d="M9 1.5v3h3"/></svg>',
    sun: '<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="3.6"/><path d="M10 2v2m0 12v2M2 10h2m12 0h2M4.3 4.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M5.7 14.3l-1.4 1.4"/></svg>',
    moon: '<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z"/></svg>',
    menu: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>'
  };

  /* ---------------------------------------------------------------------
     Minimal, safe Markdown subset
     Input is escaped first, so no author-supplied HTML can execute.
     Supports: ## / ### headings, - and 1. lists, > quotes, **bold**,
     *italic*, `code`, [text](url), and paragraphs.
     --------------------------------------------------------------------- */
  function inlineMd(text) {
    return esc(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, href) {
        var url = safeUrl(href.replace(/&amp;/g, "&"));
        if (!url) return label;
        var ext = /^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : "";
        return '<a href="' + esc(url) + '"' + ext + ">" + label + "</a>";
      });
  }

  function mdToHtml(source) {
    var text = String(source == null ? "" : source).replace(/\r\n?/g, "\n");
    if (!text.trim()) return "";

    var lines = text.split("\n");
    var out = [];
    var listType = null;
    var para = [];
    var quote = [];

    function flushPara() {
      if (para.length) { out.push("<p>" + inlineMd(para.join(" ")) + "</p>"); para = []; }
    }
    function flushList() {
      if (listType) { out.push("</" + listType + ">"); listType = null; }
    }
    function flushQuote() {
      if (quote.length) {
        out.push("<blockquote>" + inlineMd(quote.join(" ")) + "</blockquote>");
        quote = [];
      }
    }
    function flushAll() { flushPara(); flushList(); flushQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!trimmed) { flushAll(); continue; }

      var heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
      if (heading) {
        flushAll();
        var level = Math.min(heading[1].length + 1, 5);
        out.push("<h" + level + ">" + inlineMd(heading[2]) + "</h" + level + ">");
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flushAll(); out.push("<hr>"); continue; }

      var quoted = /^>\s?(.*)$/.exec(trimmed);
      if (quoted) { flushPara(); flushList(); quote.push(quoted[1]); continue; }
      flushQuote();

      var bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
      var numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
      if (bullet || numbered) {
        flushPara();
        var wanted = bullet ? "ul" : "ol";
        if (listType !== wanted) { flushList(); out.push("<" + wanted + ">"); listType = wanted; }
        out.push("<li>" + inlineMd((bullet || numbered)[1]) + "</li>");
        continue;
      }
      flushList();
      para.push(trimmed);
    }
    flushAll();
    return out.join("\n");
  }

  /* ---------------------------------------------------------------------
     Theme
     --------------------------------------------------------------------- */
  var Theme = {
    get: function () {
      try {
        var saved = localStorage.getItem(THEME_KEY);
        if (saved === "light" || saved === "dark") return saved;
      } catch (err) { /* storage unavailable */ }
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark" : "light";
    },
    set: function (mode) {
      document.documentElement.setAttribute("data-theme", mode);
      try { localStorage.setItem(THEME_KEY, mode); } catch (err) { /* ignore */ }
      $$("[data-theme-toggle]").forEach(function (btn) {
        btn.innerHTML = mode === "dark" ? ICONS.sun : ICONS.moon;
        btn.setAttribute("aria-label", mode === "dark" ? "Switch to light theme" : "Switch to dark theme");
      });
    },
    init: function () { this.set(this.get()); }
  };
  // Apply before first paint to avoid a flash of the wrong theme.
  document.documentElement.setAttribute("data-theme", Theme.get());

  /* ---------------------------------------------------------------------
     Data loading
     --------------------------------------------------------------------- */
  function isPreview() {
    return /(^|[?&])preview=1(&|$)/.test(window.location.search);
  }

  function loadContent() {
    if (isPreview()) {
      try {
        var draft = localStorage.getItem(DRAFT_KEY);
        if (draft) return Promise.resolve(JSON.parse(draft));
      } catch (err) {
        console.warn("Preview draft could not be read:", err);
      }
    }
    return fetch(BASE + "data/content.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " loading content.json");
        return res.json();
      });
  }

  /* ---------------------------------------------------------------------
     Shared chrome: header + footer
     --------------------------------------------------------------------- */
  var NAV_ITEMS = [
    { href: "index.html", label: "Home" },
    { href: "projects.html", label: "Work" },
    { href: "about.html", label: "About" },
    { href: "contact.html", label: "Contact" }
  ];

  function currentPage() {
    var file = window.location.pathname.split("/").pop();
    return file === "" ? "index.html" : file;
  }

  function keepPreview(href) {
    return isPreview() ? href + (href.indexOf("?") === -1 ? "?" : "&") + "preview=1" : href;
  }

  function renderHeader(data) {
    var mount = $("[data-site-header]");
    if (!mount) return;

    var site = data.site || {};
    var profile = data.profile || {};
    var page = currentPage();

    var utility = [];
    if (profile.email) {
      utility.push('<a class="utility-item" href="mailto:' + esc(profile.email) + '">' +
        ICONS.mail + "<span>" + esc(profile.email) + "</span></a>");
    }
    if (profile.phone) {
      utility.push('<a class="utility-item" href="tel:' + esc(String(profile.phone).replace(/[^\d+]/g, "")) + '">' +
        ICONS.phone + "<span>" + esc(profile.phone) + "</span></a>");
    }
    if (profile.location) {
      utility.push('<span class="utility-item utility-item--hide-sm">' + ICONS.pin +
        "<span>" + esc(profile.location) + "</span></span>");
    }

    var socials = nonEmpty(data.social).filter(function (s) { return s && s.url && s.label; })
      .map(function (s) {
        return '<a class="utility-item" href="' + esc(safeUrl(s.url)) +
          '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + "</a>";
      });

    var navLinks = NAV_ITEMS.map(function (item) {
      var active = item.href === page ? ' class="is-active" aria-current="page"' : "";
      return '<a href="' + keepPreview(item.href) + '"' + active + ">" + esc(item.label) + "</a>";
    }).join("");

    var brandName = site.shortTitle || site.title || profile.name || "Portfolio";

    mount.innerHTML =
      '<div class="utility-bar"><div class="container">' +
        '<div class="utility-items">' + utility.join("") + "</div>" +
        '<div class="utility-items">' + socials.join("") + "</div>" +
      "</div></div>" +
      '<header class="site-header"><div class="container header-inner">' +
        '<a class="brand" href="' + keepPreview("index.html") + '">' +
          '<span class="brand-mark" aria-hidden="true">' + esc(initials(profile.name || brandName)) + "</span>" +
          '<span class="brand-text"><span>' + esc(brandName) + "</span>" +
          (site.tagline ? '<span class="brand-sub">' + esc(site.tagline) + "</span>" : "") +
          "</span>" +
        "</a>" +
        '<nav class="site-nav" id="site-nav" aria-label="Primary">' +
          '<button class="icon-btn nav-close" type="button" data-nav-close aria-label="Close menu">' + ICONS.close + "</button>" +
          navLinks +
        "</nav>" +
        '<div class="header-actions">' +
          '<button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle theme"></button>' +
          '<button class="icon-btn nav-toggle" type="button" data-nav-open aria-label="Open menu" aria-controls="site-nav" aria-expanded="false">' + ICONS.menu + "</button>" +
        "</div>" +
      "</div></header>" +
      '<div class="nav-backdrop" data-nav-backdrop></div>';

    wireNav();
    Theme.init();
  }

  function wireNav() {
    var nav = $("#site-nav");
    var backdrop = $("[data-nav-backdrop]");
    var openBtn = $("[data-nav-open]");

    function setOpen(open) {
      if (!nav) return;
      nav.classList.toggle("is-open", open);
      if (backdrop) backdrop.classList.toggle("is-open", open);
      if (openBtn) openBtn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    }

    if (openBtn) openBtn.addEventListener("click", function () { setOpen(true); });
    $$("[data-nav-close]").forEach(function (btn) {
      btn.addEventListener("click", function () { setOpen(false); });
    });
    if (backdrop) backdrop.addEventListener("click", function () { setOpen(false); });
    $$("#site-nav a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    $$("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        Theme.set(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    });

    var header = $(".site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-stuck", window.scrollY > 8);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  function renderFooter(data) {
    var mount = $("[data-site-footer]");
    if (!mount) return;

    var site = data.site || {};
    var profile = data.profile || {};
    var year = new Date().getFullYear();

    var navLinks = NAV_ITEMS.map(function (item) {
      return '<li><a href="' + keepPreview(item.href) + '">' + esc(item.label) + "</a></li>";
    }).join("");

    var socials = nonEmpty(data.social).filter(function (s) { return s && s.url && s.label; })
      .map(function (s) {
        return '<li><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' +
          esc(s.label) + " " + ICONS.external + "</a></li>";
      }).join("");

    var contactItems = [];
    if (profile.email) contactItems.push('<li><a href="mailto:' + esc(profile.email) + '">' + esc(profile.email) + "</a></li>");
    if (profile.phone) contactItems.push("<li>" + esc(profile.phone) + "</li>");
    if (profile.location) contactItems.push("<li>" + esc(profile.location) + "</li>");

    mount.innerHTML =
      '<footer class="site-footer"><div class="container">' +
        '<div class="footer-main">' +
          "<div>" +
            '<span class="footer-brand">' +
              '<span class="brand-mark" aria-hidden="true">' + esc(initials(profile.name || site.title)) + "</span>" +
              esc(site.title || profile.name || "Portfolio") +
            "</span>" +
            '<p class="footer-about">' + esc(site.description || profile.summary || "") + "</p>" +
          "</div>" +
          "<div><h4>Navigate</h4><ul class=\"footer-links\">" + navLinks + "</ul></div>" +
          "<div><h4>Contact</h4><ul class=\"footer-links\">" +
            (contactItems.join("") || "") +
            (socials ? socials : "") +
          "</ul></div>" +
        "</div>" +
        '<div class="footer-bottom">' +
          "<span>&copy; " + year + " " + esc(site.copyright || site.title || profile.name || "") + ". All rights reserved.</span>" +
          "<span>" +
            (site.showAdminLink === false ? "" : '<a href="' + BASE + 'admin/">Content editor</a>') +
          "</span>" +
        "</div>" +
      "</div></footer>";
  }

  function renderMeta(data, overrides) {
    var site = data.site || {};
    var profile = data.profile || {};
    var o = overrides || {};
    var title = o.title
      ? o.title + " · " + (site.title || profile.name || "Portfolio")
      : [site.title || profile.name, profile.role].filter(Boolean).join(" · ");
    document.title = title;

    function setMeta(selector, attr, value) {
      var tag = $(selector);
      if (!tag) {
        tag = document.createElement("meta");
        var parts = selector.replace(/[\[\]"']/g, "").split("=");
        tag.setAttribute(parts[0].replace("meta", ""), parts[1]);
        document.head.appendChild(tag);
      }
      tag.setAttribute(attr, value);
    }
    var description = o.description || site.description || profile.summary || "";
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:type"]', "content", "website");
  }

  function previewBanner() {
    if (!isPreview()) return;
    var bar = document.createElement("div");
    bar.className = "preview-banner";
    bar.innerHTML = "<span><strong>Draft preview.</strong> Showing unsaved editor changes, not the published site.</span>" +
      '<a href="' + BASE + 'admin/">Back to editor</a>' +
      '<a href="' + window.location.pathname + '">View published version</a>';
    document.body.appendChild(bar);
  }

  /* ---------------------------------------------------------------------
     Reveal-on-scroll
     --------------------------------------------------------------------- */
  function initReveal() {
    var targets = $$("[data-reveal]");
    if (!targets.length) return;

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Without observer support (or with motion reduced) content simply stays
    // visible -- it is never hidden in the first place.
    if (reduced || !("IntersectionObserver" in window)) return;

    document.documentElement.classList.add("reveal-ready");

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });

    // Failsafe: whatever happens, nothing stays hidden for long.
    setTimeout(function () {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
    }, 3000);
  }

  /* ---------------------------------------------------------------------
     Shared fragments
     --------------------------------------------------------------------- */
  function projectCard(project, index) {
    var href = keepPreview("project.html?id=" + encodeURIComponent(project.id || slugify(project.title)));
    var cover = asset(project.cover);
    var thumb = cover
      ? '<img src="' + esc(cover) + '" alt="' + esc(project.title) + '" loading="lazy">'
      : '<div class="thumb-placeholder">' + esc(initials(project.title)) + "</div>";

    var meta = [];
    if (project.client) meta.push(esc(project.client));
    if (project.year) meta.push(esc(project.year));

    var tags = nonEmpty(project.tags).slice(0, 3).map(function (tag) {
      return '<span class="tag">' + esc(tag) + "</span>";
    }).join("");

    return '<a class="card project-card" href="' + href + '" data-reveal style="transition-delay:' +
        (index % 3) * 70 + 'ms">' +
      '<div class="thumb">' + thumb + "</div>" +
      '<div class="body">' +
        (meta.length ? '<div class="meta-line">' + meta.join('<span class="dot"></span>') + "</div>" : "") +
        "<h3>" + esc(project.title) + "</h3>" +
        '<p class="summary">' + esc(project.summary || "") + "</p>" +
        '<div class="foot">' +
          '<div class="tag-row">' + tags + "</div>" +
          '<span class="arrow-link">View ' + ICONS.arrow + "</span>" +
        "</div>" +
      "</div></a>";
  }

  function ctaBand(data) {
    var contact = data.contact || {};
    var profile = data.profile || {};
    return '<section class="cta-band"><div class="container cta-inner">' +
      "<div>" +
        "<h2>" + esc(contact.heading || "Let's work together") + "</h2>" +
        "<p>" + esc(contact.body || "") + "</p>" +
      "</div>" +
      '<div class="btn-row">' +
        '<a class="btn btn--on-dark" href="' + keepPreview("contact.html") + '">Contact me ' + ICONS.arrow + "</a>" +
        (profile.resumeUrl
          ? '<a class="btn btn--outline-on-dark" href="' + esc(asset(profile.resumeUrl)) +
            '" target="_blank" rel="noopener noreferrer">' + ICONS.doc + " Résumé</a>"
          : "") +
      "</div>" +
    "</div></section>";
  }

  /* ---------------------------------------------------------------------
     Page: Home
     --------------------------------------------------------------------- */
  function renderHome(data) {
    var home = data.home || {};
    var profile = data.profile || {};

    var heroMount = $("[data-hero]");
    if (heroMount) {
      var photo = asset(profile.photo);
      var portrait = photo
        ? '<img src="' + esc(photo) + '" alt="' + esc(profile.name || "Portrait") + '">'
        : '<div class="hero-portrait--placeholder">' + esc(initials(profile.name)) + "</div>";

      var metaBits = [];
      if (profile.location) metaBits.push("<span>" + ICONS.pin + esc(profile.location) + "</span>");
      if (profile.availability) metaBits.push("<span>" + ICONS.doc + esc(profile.availability) + "</span>");
      if (profile.email) metaBits.push("<span>" + ICONS.mail + esc(profile.email) + "</span>");

      heroMount.innerHTML =
        '<section class="hero"><div class="container"><div class="hero-grid">' +
          "<div>" +
            (home.eyebrow ? '<span class="eyebrow">' + esc(home.eyebrow) + "</span>" : "") +
            "<h1>" + esc(home.heroHeading || profile.name || "") + "</h1>" +
            '<p class="hero-lede">' + esc(home.heroSubheading || profile.summary || "") + "</p>" +
            '<div class="btn-row">' +
              (home.ctaPrimaryLabel
                ? '<a class="btn btn--on-dark" href="' + esc(keepPreview(safeUrl(home.ctaPrimaryUrl) || "projects.html")) + '">' +
                  esc(home.ctaPrimaryLabel) + " " + ICONS.arrow + "</a>"
                : "") +
              (home.ctaSecondaryLabel
                ? '<a class="btn btn--outline-on-dark" href="' + esc(keepPreview(safeUrl(home.ctaSecondaryUrl) || "contact.html")) + '">' +
                  esc(home.ctaSecondaryLabel) + "</a>"
                : "") +
            "</div>" +
            (metaBits.length ? '<div class="hero-meta">' + metaBits.join("") + "</div>" : "") +
          "</div>" +
          '<div class="hero-portrait">' + portrait + "</div>" +
        "</div></div></section>";
    }

    var statsMount = $("[data-stats]");
    var stats = nonEmpty(home.stats).filter(function (s) { return s.value || s.label; });
    if (statsMount) {
      statsMount.innerHTML = stats.length
        ? '<section class="stats-strip"><div class="container"><div class="stats-grid">' +
          stats.map(function (s) {
            return '<div class="stat"><div class="stat-value">' + esc(s.value) + "</div>" +
              '<div class="stat-label">' + esc(s.label) + "</div></div>";
          }).join("") +
          "</div></div></section>"
        : "";
    }

    var featuredMount = $("[data-featured]");
    if (featuredMount) {
      var all = nonEmpty(data.projects);
      var featured = all.filter(function (p) { return p.featured; });
      if (!featured.length) featured = all.slice(0, 3);
      featured = featured.slice(0, 6);

      featuredMount.innerHTML = featured.length
        ? '<section class="section"><div class="container">' +
          '<div class="section-head">' +
            '<span class="eyebrow">Selected work</span>' +
            "<h2>Featured projects</h2>" +
            "<p>A sample of recent engagements. Full project list available in the work archive.</p>" +
          "</div>" +
          '<div class="grid grid--3">' + featured.map(projectCard).join("") + "</div>" +
          '<div style="margin-top:38px"><a class="btn btn--outline" href="' + keepPreview("projects.html") +
            '">View all work ' + ICONS.arrow + "</a></div>" +
          "</div></section>"
        : "";
    }

    var servicesMount = $("[data-services]");
    if (servicesMount) {
      var services = nonEmpty(home.services).filter(function (s) { return s.title || s.description; });
      servicesMount.innerHTML = services.length
        ? '<section class="section section--alt"><div class="container">' +
          '<div class="section-head">' +
            (home.servicesEyebrow ? '<span class="eyebrow">' + esc(home.servicesEyebrow) + "</span>" : "") +
            "<h2>" + esc(home.servicesHeading || "What I do") + "</h2>" +
            (home.servicesIntro ? "<p>" + esc(home.servicesIntro) + "</p>" : "") +
          "</div>" +
          '<div class="grid grid--3">' + services.map(function (s, i) {
            return '<div class="service-card" data-reveal style="transition-delay:' + i * 70 + 'ms">' +
              '<span class="service-num">' + String(i + 1).padStart(2, "0") + "</span>" +
              "<h3>" + esc(s.title) + "</h3>" +
              "<p>" + esc(s.description) + "</p></div>";
          }).join("") + "</div>" +
          "</div></section>"
        : "";
    }

    var quotesMount = $("[data-testimonials]");
    if (quotesMount) {
      var quotes = nonEmpty(data.testimonials).filter(function (q) { return q.quote; });
      quotesMount.innerHTML = quotes.length
        ? '<section class="section"><div class="container">' +
          '<div class="section-head section-head--center">' +
            '<span class="eyebrow eyebrow--center">References</span>' +
            "<h2>What colleagues say</h2>" +
          "</div>" +
          '<div class="grid ' + (quotes.length > 1 ? "grid--2" : "") + '"' +
          // A lone quote reads better constrained than stretched full width.
          (quotes.length === 1 ? ' style="max-width:820px;margin:0 auto"' : "") + ">" +
          quotes.slice(0, 4).map(function (q, i) {
            return '<div class="quote-card" data-reveal style="transition-delay:' + i * 70 + 'ms">' +
              '<div class="quote-mark" aria-hidden="true">&ldquo;</div>' +
              "<blockquote>" + esc(q.quote) + "</blockquote>" +
              '<div class="quote-attr"><strong>' + esc(q.author || "") + "</strong>" +
              (q.title ? "<span>" + esc(q.title) + "</span>" : "") + "</div></div>";
          }).join("") + "</div></div></section>"
        : "";
    }

    var ctaMount = $("[data-cta]");
    if (ctaMount) ctaMount.innerHTML = ctaBand(data);

    renderMeta(data);
  }

  /* ---------------------------------------------------------------------
     Page: Projects index
     --------------------------------------------------------------------- */
  function renderProjects(data) {
    var mount = $("[data-projects]");
    if (!mount) return;

    var projects = nonEmpty(data.projects);
    var bannerMount = $("[data-banner]");
    if (bannerMount) {
      bannerMount.innerHTML = pageBanner({
        eyebrow: "Portfolio",
        heading: "Selected work",
        body: "Case studies and projects, most recent first. Filter by discipline to narrow the list.",
        crumbs: [{ label: "Home", href: "index.html" }, { label: "Work" }]
      });
    }

    if (!projects.length) {
      mount.innerHTML = '<section class="section"><div class="container">' +
        '<div class="empty-state"><h3>No projects yet</h3>' +
        '<p>Add your first project in the <a href="' + BASE + 'admin/">content editor</a>.</p></div>' +
        "</div></section>";
      renderMeta(data, { title: "Work" });
      return;
    }

    var tags = [];
    projects.forEach(function (p) {
      nonEmpty(p.tags).forEach(function (tag) {
        if (tags.indexOf(tag) === -1) tags.push(tag);
      });
    });
    tags.sort();

    mount.innerHTML = '<section class="section"><div class="container">' +
      (tags.length
        ? '<div class="filter-bar">' +
          '<span class="filter-label">Filter</span>' +
          '<button class="filter-btn is-active" type="button" data-filter="*">All</button>' +
          tags.map(function (tag) {
            return '<button class="filter-btn" type="button" data-filter="' + esc(tag) + '">' + esc(tag) + "</button>";
          }).join("") +
          '<span class="filter-count" data-filter-count></span>' +
          "</div>"
        : "") +
      '<div class="grid grid--3" data-project-grid>' +
      projects.map(function (p, i) { return projectCard(p, i); }).join("") +
      "</div>" +
      '<div class="empty-state" data-no-results hidden><h3>No matching projects</h3>' +
      "<p>Try a different filter.</p></div>" +
      "</div></section>";

    wireFilters(projects);
    renderMeta(data, { title: "Work" });
  }

  function wireFilters(projects) {
    var grid = $("[data-project-grid]");
    var buttons = $$("[data-filter]");
    var count = $("[data-filter-count]");
    var noResults = $("[data-no-results]");
    if (!grid) return;

    var cards = $$(".project-card", grid);

    function apply(filter) {
      var shown = 0;
      cards.forEach(function (card, i) {
        var tags = nonEmpty(projects[i] && projects[i].tags);
        var match = filter === "*" || tags.indexOf(filter) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      if (count) {
        count.textContent = shown + (shown === 1 ? " project" : " projects");
      }
      if (noResults) noResults.hidden = shown !== 0;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        apply(btn.getAttribute("data-filter"));
      });
    });
    apply("*");
  }

  function pageBanner(options) {
    var crumbs = (options.crumbs || []).map(function (c, i, arr) {
      var node = c.href
        ? '<a href="' + keepPreview(c.href) + '">' + esc(c.label) + "</a>"
        : "<span>" + esc(c.label) + "</span>";
      return node + (i < arr.length - 1 ? '<span class="sep">/</span>' : "");
    }).join("");

    return '<section class="page-banner"><div class="container">' +
      (crumbs ? '<nav class="breadcrumb" aria-label="Breadcrumb">' + crumbs + "</nav>" : "") +
      (options.eyebrow ? '<span class="eyebrow">' + esc(options.eyebrow) + "</span>" : "") +
      "<h1>" + esc(options.heading) + "</h1>" +
      (options.body ? "<p>" + esc(options.body) + "</p>" : "") +
      "</div></section>";
  }

  /* ---------------------------------------------------------------------
     Page: Project detail
     --------------------------------------------------------------------- */
  function renderProjectDetail(data) {
    var mount = $("[data-project-detail]");
    if (!mount) return;

    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    var projects = nonEmpty(data.projects);
    var index = -1;
    for (var i = 0; i < projects.length; i++) {
      if ((projects[i].id || slugify(projects[i].title)) === id) { index = i; break; }
    }

    var bannerMount = $("[data-banner]");

    if (index === -1) {
      if (bannerMount) {
        bannerMount.innerHTML = pageBanner({
          heading: "Project not found",
          body: "That project no longer exists or the link is incorrect.",
          crumbs: [{ label: "Home", href: "index.html" }, { label: "Work", href: "projects.html" }, { label: "Not found" }]
        });
      }
      mount.innerHTML = '<section class="section"><div class="container">' +
        '<div class="empty-state"><h3>Nothing here</h3><p>Return to the ' +
        '<a href="' + keepPreview("projects.html") + '">work archive</a>.</p></div></div></section>';
      renderMeta(data, { title: "Not found" });
      return;
    }

    var project = projects[index];

    if (bannerMount) {
      bannerMount.innerHTML = pageBanner({
        eyebrow: nonEmpty(project.tags)[0] || "Case study",
        heading: project.title,
        body: project.summary,
        crumbs: [
          { label: "Home", href: "index.html" },
          { label: "Work", href: "projects.html" },
          { label: project.title }
        ]
      });
    }

    var facts = [];
    if (project.client) facts.push(["Client", project.client]);
    if (project.role) facts.push(["Role", project.role]);
    if (project.year) facts.push(["Year", project.year]);
    if (project.status) facts.push(["Status", project.status]);

    var tags = nonEmpty(project.tags);
    var links = nonEmpty(project.links).filter(function (l) { return l && l.url && l.label; });
    var highlights = nonEmpty(project.highlights);
    var gallery = nonEmpty(project.gallery);
    var cover = asset(project.cover);

    var sidebar = '<aside class="fact-panel"><h2>Project details</h2>' +
      "<dl>" + facts.map(function (f) {
        return '<div class="fact"><dt>' + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>";
      }).join("") + "</dl>" +
      (tags.length
        ? '<div class="fact"><dt>Focus areas</dt><dd><div class="tag-row" style="margin-top:6px">' +
          tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") +
          "</div></dd></div>"
        : "") +
      (links.length
        ? '<div style="margin-top:22px;display:grid;gap:10px">' + links.map(function (l) {
            var url = safeUrl(l.url);
            return '<a class="btn btn--outline btn--sm" href="' + esc(url) +
              '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + " " + ICONS.external + "</a>";
          }).join("") + "</div>"
        : "") +
      "</aside>";

    var prev = projects[index - 1];
    var next = projects[index + 1];
    var pager = (prev || next)
      ? '<nav class="pager" aria-label="Project navigation">' +
        (prev
          ? '<a class="pager-link" href="' + keepPreview("project.html?id=" + encodeURIComponent(prev.id || slugify(prev.title))) +
            '"><span class="lbl">Previous</span><span class="ttl">' + esc(prev.title) + "</span></a>"
          : "<span></span>") +
        (next
          ? '<a class="pager-link pager-link--next" href="' + keepPreview("project.html?id=" + encodeURIComponent(next.id || slugify(next.title))) +
            '"><span class="lbl">Next</span><span class="ttl">' + esc(next.title) + "</span></a>"
          : "") +
        "</nav>"
      : "";

    mount.innerHTML = '<section class="section"><div class="container">' +
      '<div class="detail-grid">' +
        "<div>" +
          (cover ? '<figure class="detail-figure"><img src="' + esc(cover) + '" alt="' + esc(project.title) + '"></figure>' : "") +
          '<div class="prose">' + mdToHtml(project.description) + "</div>" +
          (highlights.length
            ? '<div style="margin-top:46px"><span class="eyebrow">Outcomes</span>' +
              '<ul class="highlight-list">' + highlights.map(function (h) {
                return "<li>" + esc(h) + "</li>";
              }).join("") + "</ul></div>"
            : "") +
          (gallery.length
            ? '<div style="margin-top:46px"><span class="eyebrow">Gallery</span>' +
              '<div class="gallery-grid">' + gallery.map(function (img) {
                return '<img src="' + esc(asset(img)) + '" alt="" loading="lazy">';
              }).join("") + "</div></div>"
            : "") +
        "</div>" +
        sidebar +
      "</div>" + pager +
      "</div></section>";

    var ctaMount = $("[data-cta]");
    if (ctaMount) ctaMount.innerHTML = ctaBand(data);

    renderMeta(data, { title: project.title, description: project.summary });
  }

  /* ---------------------------------------------------------------------
     Page: About
     --------------------------------------------------------------------- */
  function renderAbout(data) {
    var mount = $("[data-about]");
    if (!mount) return;

    var about = data.about || {};
    var profile = data.profile || {};

    var bannerMount = $("[data-banner]");
    if (bannerMount) {
      bannerMount.innerHTML = pageBanner({
        eyebrow: about.eyebrow || "About",
        heading: about.heading || "Background",
        body: profile.summary,
        crumbs: [{ label: "Home", href: "index.html" }, { label: "About" }]
      });
    }

    var photo = asset(profile.photo);
    var experience = nonEmpty(data.experience);
    var education = nonEmpty(data.education);
    var certifications = nonEmpty(data.certifications).filter(function (c) { return c.name; });
    var skills = nonEmpty(data.skills).filter(function (s) { return nonEmpty(s.items).length; });

    var html = "";

    /* Narrative + portrait */
    html += '<section class="section"><div class="container">' +
      '<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:60px;align-items:start">' +
        '<div class="prose">' + mdToHtml(about.body) + "</div>" +
        "<div>" +
          (photo
            ? '<img src="' + esc(photo) + '" alt="' + esc(profile.name || "") +
              '" style="width:100%;aspect-ratio:4/5;object-fit:cover;border:1px solid var(--c-line);border-radius:var(--r)">'
            : "") +
          '<div style="margin-top:' + (photo ? "24px" : "0") + ';padding:24px;background:var(--c-surface-2);border:1px solid var(--c-line);border-top:3px solid var(--c-navy);border-radius:var(--r)">' +
            '<dl style="margin:0">' +
              (profile.role ? '<div class="fact"><dt>Role</dt><dd>' + esc(profile.role) + "</dd></div>" : "") +
              (profile.location ? '<div class="fact"><dt>Location</dt><dd>' + esc(profile.location) + "</dd></div>" : "") +
              (profile.availability ? '<div class="fact"><dt>Availability</dt><dd>' + esc(profile.availability) + "</dd></div>" : "") +
              (profile.email ? '<div class="fact"><dt>Email</dt><dd><a href="mailto:' + esc(profile.email) + '">' + esc(profile.email) + "</a></dd></div>" : "") +
            "</dl>" +
            (profile.resumeUrl
              ? '<a class="btn btn--primary btn--sm" style="margin-top:18px;width:100%" href="' +
                esc(asset(profile.resumeUrl)) + '" target="_blank" rel="noopener noreferrer">' +
                ICONS.doc + " Download résumé</a>"
              : "") +
          "</div>" +
        "</div>" +
      "</div></div></section>";

    if (experience.length) {
      html += '<section class="section section--alt"><div class="container">' +
        '<div class="section-head"><span class="eyebrow">Experience</span><h2>Professional history</h2></div>' +
        '<div class="timeline">' + experience.map(function (job) {
          var bullets = nonEmpty(job.bullets);
          return '<article class="timeline-item" data-reveal>' +
            '<div class="timeline-period">' + esc(periodLabel(job)) +
              (job.current ? '<span class="current-pill">Current</span>' : "") +
            "</div>" +
            '<div class="timeline-body">' +
              "<h3>" + esc(job.role || "") + "</h3>" +
              '<div class="timeline-org">' + esc(job.organization || "") +
                (job.location ? '<span class="loc"> — ' + esc(job.location) + "</span>" : "") +
              "</div>" +
              (job.summary ? "<p>" + esc(job.summary) + "</p>" : "") +
              (bullets.length ? "<ul>" + bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "") +
            "</div></article>";
        }).join("") + "</div></div></section>";
    }

    if (skills.length) {
      html += '<section class="section"><div class="container">' +
        '<div class="section-head"><span class="eyebrow">Capabilities</span><h2>Skills &amp; tools</h2></div>' +
        skills.map(function (group) {
          return '<div class="skill-group"><h3>' + esc(group.category || "General") + "</h3>" +
            '<div class="tag-row">' + nonEmpty(group.items).map(function (item) {
              return '<span class="tag">' + esc(item) + "</span>";
            }).join("") + "</div></div>";
        }).join("") +
        "</div></section>";
    }

    if (education.length || certifications.length) {
      html += '<section class="section section--alt"><div class="container">' +
        '<div class="grid grid--2" style="gap:60px">' +
        (education.length
          ? "<div><div class=\"section-head\" style=\"margin-bottom:26px\"><span class=\"eyebrow\">Education</span><h2>Academic background</h2></div>" +
            '<div class="record-list">' + education.map(function (ed) {
              return '<div class="record"><div><h3>' + esc(ed.credential || "") + "</h3>" +
                '<div class="sub">' + esc(ed.institution || "") +
                (ed.location ? " — " + esc(ed.location) : "") + "</div>" +
                (ed.detail ? '<div class="detail">' + esc(ed.detail) + "</div>" : "") +
                '</div><div class="when">' + esc(ed.year || "") + "</div></div>";
            }).join("") + "</div></div>"
          : "") +
        (certifications.length
          ? "<div><div class=\"section-head\" style=\"margin-bottom:26px\"><span class=\"eyebrow\">Credentials</span><h2>Certifications</h2></div>" +
            '<div class="record-list">' + certifications.map(function (cert) {
              var url = safeUrl(cert.url);
              var name = url
                ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(cert.name) + " " + ICONS.external + "</a>"
                : esc(cert.name);
              return '<div class="record"><div><h3>' + name + "</h3>" +
                '<div class="sub">' + esc(cert.issuer || "") + "</div></div>" +
                '<div class="when">' + esc(cert.year || "") + "</div></div>";
            }).join("") + "</div></div>"
          : "") +
        "</div></div></section>";
    }

    mount.innerHTML = html;

    var ctaMount = $("[data-cta]");
    if (ctaMount) ctaMount.innerHTML = ctaBand(data);

    renderMeta(data, { title: "About" });
  }

  /* ---------------------------------------------------------------------
     Page: Contact
     --------------------------------------------------------------------- */
  function renderContact(data) {
    var mount = $("[data-contact]");
    if (!mount) return;

    var contact = data.contact || {};
    var profile = data.profile || {};

    var bannerMount = $("[data-banner]");
    if (bannerMount) {
      bannerMount.innerHTML = pageBanner({
        eyebrow: contact.eyebrow || "Contact",
        heading: contact.heading || "Get in touch",
        body: contact.body,
        crumbs: [{ label: "Home", href: "index.html" }, { label: "Contact" }]
      });
    }

    var methods = [];
    if (profile.email) {
      methods.push('<div class="contact-method"><span class="ic">' + ICONS.mail + "</span>" +
        '<div><dt>Email</dt><dd><a href="mailto:' + esc(profile.email) + '">' + esc(profile.email) + "</a></dd></div></div>");
    }
    if (profile.phone) {
      methods.push('<div class="contact-method"><span class="ic">' + ICONS.phone + "</span>" +
        '<div><dt>Phone</dt><dd><a href="tel:' + esc(String(profile.phone).replace(/[^\d+]/g, "")) + '">' +
        esc(profile.phone) + "</a></dd></div></div>");
    }
    if (profile.location) {
      methods.push('<div class="contact-method"><span class="ic">' + ICONS.pin + "</span>" +
        "<div><dt>Location</dt><dd>" + esc(profile.location) + "</dd></div></div>");
    }
    nonEmpty(data.social).filter(function (s) { return s.url && s.label; }).forEach(function (s) {
      methods.push('<div class="contact-method"><span class="ic">' + ICONS.external + "</span>" +
        "<div><dt>" + esc(s.label) + '</dt><dd><a href="' + esc(safeUrl(s.url)) +
        '" target="_blank" rel="noopener noreferrer">' + esc(String(s.url).replace(/^https?:\/\//, "")) +
        "</a></dd></div></div>");
    });

    mount.innerHTML = '<section class="section"><div class="container">' +
      '<div class="contact-grid">' +
        "<div>" +
          '<div class="section-head" style="margin-bottom:24px">' +
            '<span class="eyebrow">Direct</span><h2>Contact details</h2>' +
          "</div>" +
          '<dl class="contact-methods">' + methods.join("") + "</dl>" +
          (profile.availability
            ? '<p style="margin-top:24px;font-size:0.9375rem;color:var(--c-muted)">' +
              "<strong style=\"color:var(--c-ink)\">Status:</strong> " + esc(profile.availability) + "</p>"
            : "") +
        "</div>" +
        '<form class="form-card" data-contact-form novalidate>' +
          '<div class="section-head" style="margin-bottom:24px"><h2 style="font-size:1.35rem">Send a message</h2></div>' +
          '<div class="field"><label for="cf-name">Name <span class="req">*</span></label>' +
            '<input class="input" id="cf-name" name="name" type="text" required autocomplete="name"></div>' +
          '<div class="field"><label for="cf-email">Email <span class="req">*</span></label>' +
            '<input class="input" id="cf-email" name="email" type="email" required autocomplete="email"></div>' +
          '<div class="field"><label for="cf-subject">Subject</label>' +
            '<input class="input" id="cf-subject" name="subject" type="text"></div>' +
          '<div class="field"><label for="cf-message">Message <span class="req">*</span></label>' +
            '<textarea class="textarea" id="cf-message" name="message" required></textarea></div>' +
          '<button class="btn btn--primary" type="submit" data-submit>Send message ' + ICONS.arrow + "</button>" +
          '<div class="form-status" data-form-status role="status"></div>' +
          (!contact.formEndpoint && contact.formNote
            ? '<p class="field-hint" style="margin-top:14px">' + esc(contact.formNote) + "</p>"
            : "") +
        "</form>" +
      "</div></div></section>";

    wireContactForm(contact, profile);
    renderMeta(data, { title: "Contact" });
  }

  function wireContactForm(contact, profile) {
    var form = $("[data-contact-form]");
    if (!form) return;
    var status = $("[data-form-status]", form);
    var submit = $("[data-submit]", form);

    function say(message, ok) {
      status.textContent = message;
      status.className = "form-status is-visible form-status--" + (ok ? "ok" : "err");
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var message = form.message.value.trim();
      var subject = form.subject.value.trim() || "Portfolio enquiry from " + (name || "website");

      if (!name || !email || !message) { say("Please complete the required fields.", false); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Please enter a valid email address.", false); return; }

      var endpoint = safeUrl(contact.formEndpoint);
      if (!endpoint) {
        // No form backend configured: hand off to the visitor's mail client.
        var body = "Name: " + name + "\nEmail: " + email + "\n\n" + message;
        window.location.href = "mailto:" + encodeURIComponent(profile.email || "") +
          "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
        say("Opening your email client…", true);
        return;
      }

      submit.disabled = true;
      var original = submit.innerHTML;
      submit.textContent = "Sending…";

      fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        form.reset();
        say("Thank you. Your message has been sent and I will reply shortly.", true);
      }).catch(function () {
        say("Something went wrong. Please email " + (profile.email || "me") + " directly.", false);
      }).then(function () {
        submit.disabled = false;
        submit.innerHTML = original;
      });
    });
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  var PAGES = {
    home: renderHome,
    projects: renderProjects,
    project: renderProjectDetail,
    about: renderAbout,
    contact: renderContact
  };

  function boot() {
    var page = document.body.getAttribute("data-page");
    loadContent().then(function (data) {
      renderHeader(data);
      var render = PAGES[page];
      if (render) render(data);
      renderFooter(data);
      previewBanner();
      initReveal();
      document.body.classList.add("is-loaded");
    }).catch(function (err) {
      console.error(err);
      var main = $("#main") || document.body;
      main.innerHTML = '<section class="section"><div class="container">' +
        '<div class="empty-state"><h3>Content could not be loaded</h3>' +
        "<p>data/content.json is missing or invalid. If you are viewing this locally, " +
        "serve the folder over HTTP (for example <code>python3 -m http.server</code>) " +
        "rather than opening the file directly.</p></div></div></section>";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
