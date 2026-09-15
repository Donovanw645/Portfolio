/* ==========================================================================
   Portfolio - content editor
   A schema-driven editor for data/content.json. Runs entirely in the
   browser: edits autosave to a local draft, and can be exported as a file
   or published straight to GitHub through the Contents API.
   ========================================================================== */
(function () {
  "use strict";

  var DRAFT_KEY = "portfolio:draft";
  var GH_KEY = "portfolio:github";
  var TOKEN_KEY = "portfolio:token";
  var THEME_KEY = "portfolio:theme";
  var DATA_PATH = "data/content.json";
  var IMAGE_DIR = "assets/img/uploads/";
  var FILE_DIR = "assets/files/";
  var MAX_IMAGE_DIM = 1800;
  var IMAGE_QUALITY = 0.82;

  /* ---------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function getPath(obj, path) {
    var keys = String(path).split(".");
    var node = obj;
    for (var i = 0; i < keys.length; i++) {
      if (node === null || node === undefined) return undefined;
      node = node[keys[i]];
    }
    return node;
  }

  function setPath(obj, path, value) {
    var keys = String(path).split(".");
    var node = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      var key = keys[i];
      if (node[key] === null || typeof node[key] !== "object") {
        node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      }
      node = node[key];
    }
    node[keys[keys.length - 1]] = value;
  }

  function slugify(value) {
    return String(value || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "—";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function bytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  /* Deterministic short hash, used to name uploaded files. */
  function hash(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = ((h1 ^ c) * 0x01000193) >>> 0;
      h2 = ((h2 + c) * 0x85ebca6b) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).replace(/[^a-z0-9]/g, "").slice(0, 12);
  }

  var ICONS = {
    up: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 3v10M4 9l4 4 4-4"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 6.5v5M9.5 6.5v5"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8"/><path d="M10.5 5.5v-3h-8v8h3"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3l5 5-5 5"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 3v10M3 8h10"/></svg>',
    x: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="3.6"/><path d="M10 2v2m0 12v2M2 10h2m12 0h2M4.3 4.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M5.7 14.3l-1.4 1.4"/></svg>',
    moon: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z"/></svg>'
  };

  /* ---------------------------------------------------------------------
     Schema
     Drives every form in the editor. Adding a field here is all it takes
     for it to appear in the UI and be written to content.json.
     --------------------------------------------------------------------- */
  var SCHEMA = [
    {
      key: "site", label: "Site", type: "object",
      title: "Site settings",
      desc: "Global titles and metadata used in the browser tab, header and footer.",
      fields: [
        { key: "title", label: "Site title", type: "text", hint: "Usually your full name." },
        { key: "shortTitle", label: "Header brand text", type: "text", hint: "Shown in the navigation bar. Use your full name, or a shorter form if it crowds the nav." },
        { key: "tagline", label: "Brand sub-label", type: "text", hint: "Small uppercase text under the brand, e.g. \"Portfolio\"." },
        { key: "description", label: "Meta description", type: "textarea", full: true, hint: "Used for search engines and link previews. Aim for 150-160 characters." },
        { key: "copyright", label: "Copyright name", type: "text" },
        { key: "showAdminLink", label: "Show \"Content editor\" link in the site footer", type: "checkbox", full: true }
      ]
    },
    {
      key: "profile", label: "Profile", type: "object",
      title: "Profile",
      desc: "Your identity and contact details. These appear in the header bar, hero, about page and footer.",
      fields: [
        { key: "name", label: "Full name", type: "text" },
        { key: "role", label: "Professional title", type: "text", hint: "e.g. Operations Analyst, Software Engineer." },
        { key: "location", label: "Location", type: "text" },
        { key: "availability", label: "Availability status", type: "text", hint: "e.g. Open to new opportunities." },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", type: "text", hint: "Leave blank to hide it from the site." },
        { key: "summary", label: "Short summary", type: "textarea", full: true, hint: "Two or three sentences. Used in the footer and as a fallback hero description." },
        { key: "photo", label: "Portrait photo", type: "image", full: true, hint: "A portrait crop works best. Displayed at 4:5." },
        { key: "resumeUrl", label: "Résumé / CV", type: "file", full: true, hint: "Upload a PDF or paste a link. Adds a download button to the site." }
      ]
    },
    {
      key: "social", label: "Links", type: "list",
      title: "Social & professional links",
      desc: "Shown in the top utility bar, the footer and on the contact page.",
      itemName: "link",
      titleKey: "label",
      template: { label: "", url: "" },
      fields: [
        { key: "label", label: "Label", type: "text", hint: "e.g. LinkedIn, GitHub, Behance." },
        { key: "url", label: "URL", type: "url" }
      ]
    },
    {
      key: "home", label: "Homepage", type: "object",
      title: "Homepage",
      desc: "The intro banner and the wording above the three highlighted projects.",
      fields: [
        { key: "eyebrow", label: "Hero eyebrow", type: "text", hint: "Small label above the headline." },
        { key: "heroHeading", label: "Hero headline", type: "textarea", full: true },
        { key: "heroSubheading", label: "Hero description", type: "textarea", full: true },
        { key: "ctaPrimaryLabel", label: "Primary button text", type: "text" },
        { key: "ctaPrimaryUrl", label: "Primary button link", type: "text", hint: "e.g. projects.html or a full URL." },
        { key: "ctaSecondaryLabel", label: "Secondary button text", type: "text" },
        { key: "ctaSecondaryUrl", label: "Secondary button link", type: "text" },
        { key: "featuredEyebrow", label: "Highlights eyebrow", type: "text", hint: "Small label above the highlight row." },
        { key: "featuredHeading", label: "Highlights heading", type: "text" },
        { key: "featuredIntro", label: "Highlights intro", type: "textarea", full: true },
      ]
    },
    {
      key: "projects", label: "Projects", type: "list",
      title: "Projects & case studies",
      desc: "Each project gets its own page. Order here is the order shown on the site. The first three with \u201cFeature this project\u201d ticked appear on the homepage; the rest live on the Work page.",
      itemName: "project",
      titleKey: "title",
      subKey: "client",
      template: {
        id: "", title: "New project", summary: "", client: "", role: "", year: "",
        status: "Completed", featured: false, tags: [], cover: "", gallery: [],
        highlights: [], description: "", links: []
      },
      fields: [
        { key: "title", label: "Project title", type: "text" },
        { key: "id", label: "URL slug", type: "text", hint: "Used in the page address. Leave blank to generate it from the title.", slugFrom: "title" },
        { key: "summary", label: "One-line summary", type: "textarea", full: true, hint: "Shown on project cards and under the page heading." },
        { key: "client", label: "Client or company", type: "text" },
        { key: "role", label: "Your role", type: "text" },
        { key: "year", label: "Year", type: "text" },
        { key: "status", label: "Status", type: "text", hint: "e.g. Completed, Ongoing, Prototype." },
        { key: "featured", label: "Feature this project on the homepage (first three win)", type: "checkbox", full: true },
        { key: "tags", label: "Tags", type: "strings", full: true, inline: true, hint: "Comma separated. These become the filter buttons on the work page." },
        { key: "cover", label: "Cover image", type: "image", full: true },
        { key: "description", label: "Full write-up", type: "markdown", full: true },
        { key: "highlights", label: "Outcomes", type: "strings", full: true, hint: "One per line. Rendered as a results list." },
        { key: "gallery", label: "Gallery images", type: "images", full: true },
        {
          key: "links", label: "External links", type: "list", full: true,
          itemName: "link", titleKey: "label", template: { label: "", url: "" },
          fields: [
            { key: "label", label: "Label", type: "text" },
            { key: "url", label: "URL", type: "url" }
          ]
        }
      ]
    },
    {
      key: "about", label: "About", type: "object",
      title: "About page",
      desc: "The narrative at the top of the About page. Contact details sit below it on the same page.",
      fields: [
        { key: "eyebrow", label: "Eyebrow", type: "text" },
        { key: "heading", label: "Heading", type: "text" },
        { key: "body", label: "Body", type: "markdown", full: true }
      ]
    },
    {
      key: "contact", label: "Contact", type: "object",
      title: "Contact block",
      desc: "The contact section at the bottom of the About page, linked as about.html#contact. The details themselves come from Profile and Links.",
      fields: [
        { key: "eyebrow", label: "Eyebrow", type: "text" },
        { key: "heading", label: "Heading", type: "text" },
        { key: "body", label: "Intro text", type: "textarea", full: true },
        {
          key: "formEndpoint", label: "Form endpoint URL", type: "url", full: true,
          hint: "GitHub Pages cannot process form submissions. Paste a Formspree or Getform endpoint to receive messages by email. Left blank, the form opens the visitor's mail client instead."
        },
        { key: "formNote", label: "Note under the form", type: "textarea", full: true, hint: "Only shown while no form endpoint is set." }
      ]
    }
  ];

  var SECTION_BY_KEY = {};
  SCHEMA.forEach(function (section) { SECTION_BY_KEY[section.key] = section; });

  /* ---------------------------------------------------------------------
     State
     --------------------------------------------------------------------- */
  var state = {
    data: null,
    published: null,
    section: "site",
    dirty: false,
    open: {}
  };

  /* ---------------------------------------------------------------------
     Toasts
     --------------------------------------------------------------------- */
  function toast(message, kind) {
    var stack = $(".toast-stack");
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " toast--" + kind : "");
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .25s ease";
      setTimeout(function () { el.remove(); }, 260);
    }, 3600);
  }

  /* ---------------------------------------------------------------------
     Draft persistence
     --------------------------------------------------------------------- */
  var saveTimer = null;

  function markDirty() {
    state.dirty = true;
    updateSaveState("Unsaved changes", "is-dirty");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 700);
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.data));
      state.dirty = false;
      updateSaveState("Draft saved locally", "is-saved");
    } catch (err) {
      updateSaveState("Draft too large to save", "is-dirty");
      toast("Local draft could not be saved: " + err.message, "err");
    }
  }

  function updateSaveState(text, cls) {
    var el = $("[data-save-state]");
    if (!el) return;
    el.className = "save-state " + (cls || "");
    el.innerHTML = '<span class="dot"></span><span>' + esc(text) + "</span>";
  }

  /* ---------------------------------------------------------------------
     Field rendering
     --------------------------------------------------------------------- */
  function fieldWrap(field, inner) {
    return '<div class="field' + (field.full ? " field--full" : "") + '">' +
      (field.type === "checkbox" ? "" : "<label>" + esc(field.label) + "</label>") +
      inner +
      (field.hint ? '<p class="field-hint">' + esc(field.hint) + "</p>" : "") +
      "</div>";
  }

  function renderField(field, path, value) {
    var full = path + "." + field.key;
    var v = value === undefined || value === null ? "" : value;

    switch (field.type) {
      case "checkbox":
        return fieldWrap(field,
          '<label class="checkbox-row"><input type="checkbox" data-path="' + esc(full) + '" data-kind="checkbox"' +
          (value ? " checked" : "") + "><span>" + esc(field.label) + "</span></label>");

      case "textarea":
        return fieldWrap(field,
          '<textarea class="textarea" style="min-height:96px" data-path="' + esc(full) + '">' + esc(v) + "</textarea>");

      case "markdown":
        return fieldWrap(field,
          '<textarea class="textarea textarea--code" data-path="' + esc(full) + '">' + esc(v) + "</textarea>" +
          '<p class="field-hint">Formatting: <code>## Heading</code>, <code>- bullet</code>, ' +
          "<code>**bold**</code>, <code>*italic*</code>, <code>[text](url)</code>, <code>&gt; quote</code>. " +
          "Leave a blank line between paragraphs.</p>");

      case "strings":
        var list = Array.isArray(value) ? value : [];
        return fieldWrap(field, field.inline
          ? '<input class="input" type="text" data-path="' + esc(full) + '" data-kind="csv" value="' + esc(list.join(", ")) + '">'
          : '<textarea class="textarea" style="min-height:110px" data-path="' + esc(full) + '" data-kind="lines">' +
            esc(list.join("\n")) + "</textarea>");

      case "image":
      case "file":
        return fieldWrap(field, mediaPicker(full, v, field.type));

      case "images":
        return fieldWrap(field, galleryPicker(full, Array.isArray(value) ? value : []));

      case "list":
        return '<div class="field field--full"><label>' + esc(field.label) + "</label>" +
          (field.hint ? '<p class="field-hint" style="margin:0 0 10px">' + esc(field.hint) + "</p>" : "") +
          '<div class="sub-repeater" data-nested="' + esc(full) + '">' +
            renderNestedList(field, full, Array.isArray(value) ? value : []) +
          "</div></div>";

      default:
        var inputType = field.type === "email" ? "email" : (field.type === "url" ? "url" : "text");
        return fieldWrap(field,
          '<input class="input" type="' + inputType + '" data-path="' + esc(full) + '"' +
          (field.slugFrom ? ' data-slug-from="' + esc(path + "." + field.slugFrom) + '"' : "") +
          ' value="' + esc(v) + '">');
    }
  }

  function renderFields(fields, path, obj) {
    return '<div class="form-grid">' + fields.map(function (field) {
      return renderField(field, path, (obj || {})[field.key]);
    }).join("") + "</div>";
  }

  /* Nested object lists (links, stats, capabilities) render as compact rows. */
  function renderNestedList(field, path, items) {
    var rows = items.map(function (item, index) {
      var cells = field.fields.map(function (sub) {
        var subPath = path + "." + index + "." + sub.key;
        if (sub.type === "textarea") {
          return '<textarea class="textarea" style="min-height:64px" placeholder="' + esc(sub.label) +
            '" data-path="' + esc(subPath) + '">' + esc(item[sub.key] || "") + "</textarea>";
        }
        return '<input class="input" type="text" placeholder="' + esc(sub.label) + '" data-path="' +
          esc(subPath) + '" value="' + esc(item[sub.key] || "") + '">';
      }).join("");

      return '<div class="sub-row">' + cells +
        '<button class="tool-btn tool-btn--danger" type="button" title="Remove" ' +
        'data-action="nested-remove" data-list="' + esc(path) + '" data-index="' + index + '">' +
        ICONS.trash + "</button></div>";
    }).join("");

    return rows +
      '<button class="btn btn--outline btn--sm" type="button" style="margin-top:' + (items.length ? "12px" : "0") + '" ' +
      'data-action="nested-add" data-list="' + esc(path) + '">' + ICONS.plus + " Add " + esc(field.itemName || "item") + "</button>";
  }

  /* ---------------------------------------------------------------------
     Media pickers
     --------------------------------------------------------------------- */
  function isData(value) { return /^data:/.test(String(value || "")); }

  function mediaPreview(value, kind) {
    if (!value) return '<div class="media-preview">No file</div>';
    if (kind === "file" && !/^data:image|\.(png|jpe?g|gif|webp|svg)$/i.test(value)) {
      return '<div class="media-preview">' + (isData(value) ? "Uploaded file" : esc(String(value).split("/").pop())) + "</div>";
    }
    var src = isData(value) || /^https?:/i.test(value) ? value : "../" + String(value).replace(/^\.?\//, "");
    return '<div class="media-preview"><img src="' + esc(src) + '" alt=""></div>';
  }

  function mediaPicker(path, value, kind) {
    var accept = kind === "file" ? ".pdf,.doc,.docx,image/*" : "image/*";
    var pending = isData(value)
      ? '<p class="media-note"><strong>Pending upload.</strong> This file is held in the draft (' +
        bytes(Math.round(String(value).length * 0.75)) + ") and becomes a real file in the repository when you publish.</p>"
      : "";

    return '<div class="media-picker">' +
      mediaPreview(value, kind) +
      "<div>" +
        '<div class="media-actions">' +
          '<label class="btn btn--outline btn--sm" style="cursor:pointer">' +
            '<input type="file" accept="' + accept + '" hidden data-upload="' + esc(path) + '" data-upload-kind="' + esc(kind) + '">' +
            "Choose file</label>" +
          (value ? '<button class="btn btn--outline btn--sm" type="button" data-action="clear-media" data-path="' + esc(path) + '">Remove</button>' : "") +
        "</div>" +
        '<input class="input" type="text" placeholder="…or paste a URL or repository path" data-path="' + esc(path) + '" value="' +
          (isData(value) ? "" : esc(value)) + '"' + (isData(value) ? " disabled" : "") + ">" +
        pending +
      "</div></div>";
  }

  function galleryPicker(path, items) {
    var thumbs = items.map(function (item, index) {
      var src = isData(item) || /^https?:/i.test(item) ? item : "../" + String(item).replace(/^\.?\//, "");
      return '<div class="gallery-thumb"><img src="' + esc(src) + '" alt="">' +
        '<button type="button" title="Remove" data-action="gallery-remove" data-path="' + esc(path) +
        '" data-index="' + index + '">' + ICONS.x + "</button></div>";
    }).join("");

    return (items.length ? '<div class="gallery-strip">' + thumbs + "</div>" : "") +
      '<label class="btn btn--outline btn--sm" style="cursor:pointer">' +
      '<input type="file" accept="image/*" multiple hidden data-upload-multi="' + esc(path) + '">' +
      ICONS.plus + " Add images</label>";
  }

  /* ---------------------------------------------------------------------
     Image processing
     Large photos are downscaled in the browser so the data file and the
     published repository stay a sensible size.
     --------------------------------------------------------------------- */
  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read " + file.name)); };
      reader.readAsDataURL(file);
    });
  }

  function processFile(file, kind) {
    var isImage = /^image\//.test(file.type);
    // SVGs and non-images are stored as-is; only raster images are resized.
    if (kind === "file" || !isImage || file.type === "image/svg+xml") {
      return readAsDataUrl(file);
    }
    return readAsDataUrl(file).then(function (dataUrl) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
          if (scale === 1 && dataUrl.length < 400000) { resolve(dataUrl); return; }
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var hasAlpha = file.type === "image/png" || file.type === "image/webp";
          resolve(canvas.toDataURL(hasAlpha ? "image/webp" : "image/jpeg", IMAGE_QUALITY));
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      });
    });
  }

  /* ---------------------------------------------------------------------
     Panels
     --------------------------------------------------------------------- */
  function renderNav() {
    var nav = $("[data-admin-nav]");
    var items = SCHEMA.map(function (section) {
      var count = section.type === "list"
        ? '<span class="badge">' + (Array.isArray(state.data[section.key]) ? state.data[section.key].length : 0) + "</span>"
        : "";
      return '<button type="button" data-section="' + esc(section.key) + '"' +
        (state.section === section.key ? ' class="is-active"' : "") + ">" +
        "<span>" + esc(section.label) + "</span>" + count + "</button>";
    }).join("");

    var extras = [
      { key: "__publish", label: "Publish" },
      { key: "__data", label: "Import / export" }
    ].map(function (item) {
      return '<button type="button" data-section="' + item.key + '"' +
        (state.section === item.key ? ' class="is-active"' : "") + "><span>" + item.label + "</span></button>";
    }).join("");

    nav.innerHTML = "<h2>Content</h2>" + items +
      '<h2 style="margin-top:14px">Deploy</h2>' + extras;
  }

  function renderPanel() {
    var main = $("[data-admin-main]");

    if (state.section === "__publish") { main.innerHTML = publishPanel(); wirePublish(); return; }
    if (state.section === "__data") { main.innerHTML = dataPanel(); wireDataPanel(); return; }

    var section = SECTION_BY_KEY[state.section];
    if (!section) { main.innerHTML = ""; return; }

    if (section.type === "object") {
      if (!state.data[section.key] || typeof state.data[section.key] !== "object") state.data[section.key] = {};
      main.innerHTML = '<section class="panel">' +
        '<div class="panel-head"><div><h1>' + esc(section.title) + "</h1>" +
        "<p>" + esc(section.desc) + "</p></div></div>" +
        '<div class="panel-body">' + renderFields(section.fields, section.key, state.data[section.key]) + "</div>" +
        "</section>";
      return;
    }

    if (!Array.isArray(state.data[section.key])) state.data[section.key] = [];
    var items = state.data[section.key];

    var body = items.length
      ? '<div class="repeater">' + items.map(function (item, index) {
          return repeatItem(section, item, index);
        }).join("") + "</div>"
      : '<div class="empty-state"><h3>Nothing here yet</h3><p>Add your first ' +
        esc(section.itemName || "entry") + " to get started.</p></div>";

    main.innerHTML = '<section class="panel">' +
      '<div class="panel-head"><div><h1>' + esc(section.title) + "</h1><p>" + esc(section.desc) + "</p></div>" +
      '<button class="btn btn--primary btn--sm" type="button" data-action="add-item">' + ICONS.plus +
      " Add " + esc(section.itemName || "item") + "</button></div>" +
      '<div class="panel-body">' + body + "</div></section>";
  }

  function repeatItem(section, item, index) {
    var openKey = section.key + ":" + index;
    var isOpen = !!state.open[openKey];
    var title = item[section.titleKey] || "Untitled " + (section.itemName || "item");
    var sub = section.subKey && item[section.subKey] ? item[section.subKey] : "";
    var count = Array.isArray(state.data[section.key]) ? state.data[section.key].length : 0;

    return '<article class="repeat-item' + (isOpen ? " is-open" : "") + '" data-item="' + index + '">' +
      '<div class="repeat-head" data-action="toggle" data-index="' + index + '">' +
        '<span class="repeat-index">' + (index + 1) + "</span>" +
        '<span class="repeat-title">' + esc(title) +
          (sub ? ' <span class="repeat-sub">— ' + esc(sub) + "</span>" : "") + "</span>" +
        '<span class="repeat-tools">' +
          '<button class="tool-btn" type="button" title="Move up" data-action="move" data-dir="-1" data-index="' + index + '"' +
            (index === 0 ? " disabled" : "") + ">" + ICONS.up + "</button>" +
          '<button class="tool-btn" type="button" title="Move down" data-action="move" data-dir="1" data-index="' + index + '"' +
            (index === count - 1 ? " disabled" : "") + ">" + ICONS.down + "</button>" +
          '<button class="tool-btn" type="button" title="Duplicate" data-action="duplicate" data-index="' + index + '">' + ICONS.copy + "</button>" +
          '<button class="tool-btn tool-btn--danger" type="button" title="Delete" data-action="remove" data-index="' + index + '">' + ICONS.trash + "</button>" +
        "</span>" +
      "</div>" +
      '<div class="repeat-body">' + (isOpen ? renderFields(section.fields, section.key + "." + index, item) : "") + "</div>" +
      "</article>";
  }

  /* ---------------------------------------------------------------------
     Publish panel
     --------------------------------------------------------------------- */
  function ghConfig() {
    var cfg = { owner: "", repo: "", branch: "main", remember: false };
    try {
      var saved = JSON.parse(localStorage.getItem(GH_KEY) || "{}");
      Object.keys(saved).forEach(function (k) { cfg[k] = saved[k]; });
    } catch (err) { /* ignore */ }
    if (!cfg.owner || !cfg.repo) {
      // Infer from the Pages URL: owner.github.io/repo/
      var host = location.hostname.match(/^([^.]+)\.github\.io$/);
      if (host) {
        cfg.owner = cfg.owner || host[1];
        var seg = location.pathname.split("/").filter(Boolean);
        if (!cfg.repo && seg.length > 1) cfg.repo = seg[0];
      }
    }
    return cfg;
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ""; }
    catch (err) { return ""; }
  }

  function countPending() {
    var n = 0;
    walkStrings(state.data, function (value) { if (isData(value)) n++; return value; });
    return n;
  }

  function publishPanel() {
    var cfg = ghConfig();
    var size = JSON.stringify(state.data).length;

    return '<section class="panel">' +
      '<div class="panel-head"><div><h1>Publish to GitHub</h1>' +
      "<p>Writes your content straight to the repository. GitHub Pages rebuilds the site automatically, " +
      "usually within a minute.</p></div></div>" +
      '<div class="panel-body">' +

      '<div class="stat-tiles">' +
        '<div class="stat-tile"><div class="n">' + (state.data.projects || []).length + '</div><div class="l">Projects</div></div>' +
        '<div class="stat-tile"><div class="n">' + (state.data.projects || []).filter(function (p) { return p.featured; }).length + '</div><div class="l">Featured</div></div>' +
        '<div class="stat-tile"><div class="n">' + countPending() + '</div><div class="l">Files to upload</div></div>' +
        '<div class="stat-tile"><div class="n">' + bytes(size) + '</div><div class="l">Draft size</div></div>' +
      "</div>" +

      '<div class="callout callout--warn">' +
        "<p><strong>About the access token.</strong> Publishing needs a GitHub token with write access to this " +
        "repository. It is stored in your own browser and sent only to <code>api.github.com</code> — never to this site " +
        "or anywhere else. Even so, a token in browser storage can be read by anything with access to this browser " +
        "profile, so use a <strong>fine-grained personal access token limited to this one repository</strong>, " +
        "with <em>Contents: read and write</em> and nothing more, and give it a short expiry.</p>" +
        '<p style="margin-top:10px"><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Create a fine-grained token on GitHub</a></p>' +
      "</div>" +

      '<div class="form-grid">' +
        '<div class="field"><label>Repository owner</label>' +
          '<input class="input" id="gh-owner" type="text" value="' + esc(cfg.owner) + '" placeholder="your-username"></div>' +
        '<div class="field"><label>Repository name</label>' +
          '<input class="input" id="gh-repo" type="text" value="' + esc(cfg.repo) + '" placeholder="Portfolio"></div>' +
        '<div class="field"><label>Branch</label>' +
          '<input class="input" id="gh-branch" type="text" value="' + esc(cfg.branch || "main") + '">' +
          '<p class="field-hint">The branch GitHub Pages publishes from.</p></div>' +
        '<div class="field"><label>Access token</label>' +
          '<input class="input" id="gh-token" type="password" value="' + esc(getToken()) + '" placeholder="github_pat_…" autocomplete="off"></div>' +
        '<div class="field field--full"><label class="checkbox-row"><input type="checkbox" id="gh-remember"' +
          (cfg.remember ? " checked" : "") + "><span>Keep this token in local storage between sessions</span></label>" +
          '<p class="field-hint">Leave unticked to hold it only until this tab closes.</p></div>' +
      "</div>" +

      '<div class="btn-row" style="margin-top:8px">' +
        '<button class="btn btn--outline" type="button" data-action="gh-test">Test connection</button>' +
        '<button class="btn btn--primary" type="button" data-action="gh-publish">Publish changes</button>' +
        '<button class="btn btn--outline" type="button" data-action="gh-forget">Clear token</button>' +
      "</div>" +

      '<div class="log" data-log></div>' +

      '<div class="callout" style="margin-top:26px">' +
        "<p><strong>No token, or prefer to commit yourself?</strong> Use <em>Import / export</em> to download " +
        "<code>content.json</code> and commit it to <code>data/content.json</code> by hand. Images stay embedded in " +
        "the file in that case, which works but makes it larger.</p>" +
      "</div>" +
      "</div></section>";
  }

  /* ---------------------------------------------------------------------
     Import / export panel
     --------------------------------------------------------------------- */
  function dataPanel() {
    return '<section class="panel">' +
      '<div class="panel-head"><div><h1>Import &amp; export</h1>' +
      "<p>Move content between machines, keep backups, or edit the underlying file directly.</p></div></div>" +
      '<div class="panel-body">' +
        '<div class="btn-row" style="margin-bottom:24px">' +
          '<button class="btn btn--primary" type="button" data-action="export">Download content.json</button>' +
          '<label class="btn btn--outline" style="cursor:pointer"><input type="file" accept="application/json,.json" hidden data-import>Import a file</label>' +
          '<button class="btn btn--outline" type="button" data-action="preview">Preview draft</button>' +
          '<button class="btn btn--outline" type="button" data-action="revert">Discard draft</button>' +
        "</div>" +

        '<div class="callout">' +
          "<p><strong>Discard draft</strong> throws away every local change and reloads the published " +
          "<code>data/content.json</code>. There is no undo.</p>" +
        "</div>" +

        '<div class="field field--full"><label>Raw JSON</label>' +
          '<textarea class="textarea textarea--code" style="min-height:420px" data-raw>' +
          esc(JSON.stringify(state.data, null, 2)) + "</textarea>" +
          '<p class="field-hint">Edit carefully, then apply. Invalid JSON is rejected and nothing changes.</p></div>' +
        '<button class="btn btn--primary" type="button" data-action="apply-raw">Apply JSON</button>' +
      "</div></section>";
  }

  /* ---------------------------------------------------------------------
     Event wiring
     --------------------------------------------------------------------- */
  function rerender(keepScroll) {
    var y = window.scrollY;
    renderNav();
    renderPanel();
    if (keepScroll) window.scrollTo(0, y);
  }

  function activeSection() { return SECTION_BY_KEY[state.section]; }

  function wireGlobal() {
    var main = $("[data-admin-main]");

    /* Section navigation */
    $("[data-admin-nav]").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-section]");
      if (!btn) return;
      state.section = btn.getAttribute("data-section");
      rerender();
      window.scrollTo(0, 0);
    });

    /* Text input binding */
    main.addEventListener("input", function (event) {
      var el = event.target.closest("[data-path]");
      if (!el || el.disabled) return;
      var path = el.getAttribute("data-path");
      var kind = el.getAttribute("data-kind");
      var value;

      if (kind === "checkbox") value = el.checked;
      else if (kind === "csv") value = el.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      else if (kind === "lines") value = el.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      else value = el.value;

      setPath(state.data, path, value);
      markDirty();

      /* Live-update the collapsed row title as you type. */
      var section = activeSection();
      if (section && section.type === "list") {
        var parts = path.split(".");
        if (parts.length >= 3 && (parts[2] === section.titleKey || parts[2] === section.subKey)) {
          var row = main.querySelector('.repeat-item[data-item="' + parts[1] + '"] .repeat-title');
          if (row) {
            var item = state.data[section.key][parts[1]];
            row.innerHTML = esc(item[section.titleKey] || "Untitled") +
              (section.subKey && item[section.subKey] ? ' <span class="repeat-sub">— ' + esc(item[section.subKey]) + "</span>" : "");
          }
        }
      }
    });

    main.addEventListener("change", function (event) {
      var el = event.target.closest("[data-path][data-kind='checkbox']");
      if (el) { setPath(state.data, el.getAttribute("data-path"), el.checked); markDirty(); }
    });

    /* Auto-fill an empty slug from the title when leaving the title field. */
    main.addEventListener("blur", function (event) {
      var el = event.target.closest("[data-slug-from]");
      if (!el || el.value.trim()) return;
      var source = getPath(state.data, el.getAttribute("data-slug-from"));
      if (!source) return;
      var value = slugify(source);
      el.value = value;
      setPath(state.data, el.getAttribute("data-path"), value);
      markDirty();
    }, true);

    /* Buttons inside the panel */
    main.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      var section = activeSection();
      var index = parseInt(btn.getAttribute("data-index"), 10);

      switch (action) {
        case "toggle": {
          var key = section.key + ":" + index;
          state.open[key] = !state.open[key];
          rerender(true);
          break;
        }
        case "add-item": {
          var item = clone(section.template);
          if ("id" in item) item.id = "";
          state.data[section.key].push(item);
          state.open = {};
          state.open[section.key + ":" + (state.data[section.key].length - 1)] = true;
          markDirty(); rerender();
          break;
        }
        case "duplicate": {
          var copy = clone(state.data[section.key][index]);
          if (copy.id) copy.id = copy.id + "-copy";
          if (copy.title) copy.title = copy.title + " (copy)";
          state.data[section.key].splice(index + 1, 0, copy);
          markDirty(); rerender(true);
          break;
        }
        case "remove": {
          var label = state.data[section.key][index][section.titleKey] || "this " + (section.itemName || "item");
          if (!confirm("Delete “" + label + "”? This cannot be undone.")) break;
          state.data[section.key].splice(index, 1);
          state.open = {};
          markDirty(); rerender(true);
          break;
        }
        case "move": {
          var dir = parseInt(btn.getAttribute("data-dir"), 10);
          var target = index + dir;
          var list = state.data[section.key];
          if (target < 0 || target >= list.length) break;
          var moved = list.splice(index, 1)[0];
          list.splice(target, 0, moved);
          var wasOpen = state.open[section.key + ":" + index];
          state.open = {};
          if (wasOpen) state.open[section.key + ":" + target] = true;
          markDirty(); rerender(true);
          break;
        }
        case "nested-add": {
          var listPath = btn.getAttribute("data-list");
          var spec = findFieldSpec(listPath);
          var arr = getPath(state.data, listPath);
          if (!Array.isArray(arr)) { setPath(state.data, listPath, []); arr = getPath(state.data, listPath); }
          arr.push(clone(spec && spec.template ? spec.template : {}));
          markDirty(); rerender(true);
          break;
        }
        case "nested-remove": {
          var nlist = getPath(state.data, btn.getAttribute("data-list"));
          if (Array.isArray(nlist)) nlist.splice(index, 1);
          markDirty(); rerender(true);
          break;
        }
        case "clear-media": {
          setPath(state.data, btn.getAttribute("data-path"), "");
          markDirty(); rerender(true);
          break;
        }
        case "gallery-remove": {
          var gal = getPath(state.data, btn.getAttribute("data-path"));
          if (Array.isArray(gal)) gal.splice(index, 1);
          markDirty(); rerender(true);
          break;
        }
        case "export": exportJson(); break;
        case "preview": openPreview(); break;
        case "revert": revertDraft(); break;
        case "apply-raw": applyRaw(); break;
        case "gh-test": githubTest(); break;
        case "gh-publish": githubPublish(); break;
        case "gh-forget": forgetToken(); break;
      }
    });

    /* File inputs */
    main.addEventListener("change", function (event) {
      var single = event.target.closest("[data-upload]");
      if (single && single.files && single.files[0]) {
        var kind = single.getAttribute("data-upload-kind");
        var path = single.getAttribute("data-upload");
        processFile(single.files[0], kind).then(function (dataUrl) {
          setPath(state.data, path, dataUrl);
          markDirty(); rerender(true);
          toast("File added to the draft. Publish to upload it.", "ok");
        }).catch(function (err) { toast(err.message, "err"); });
        return;
      }

      var multi = event.target.closest("[data-upload-multi]");
      if (multi && multi.files && multi.files.length) {
        var galPath = multi.getAttribute("data-upload-multi");
        var files = Array.prototype.slice.call(multi.files);
        Promise.all(files.map(function (f) { return processFile(f, "image"); })).then(function (urls) {
          var arr = getPath(state.data, galPath);
          if (!Array.isArray(arr)) { setPath(state.data, galPath, []); arr = getPath(state.data, galPath); }
          urls.forEach(function (u) { arr.push(u); });
          markDirty(); rerender(true);
          toast(urls.length + " image(s) added to the draft.", "ok");
        }).catch(function (err) { toast(err.message, "err"); });
        return;
      }

      var importer = event.target.closest("[data-import]");
      if (importer && importer.files && importer.files[0]) {
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = JSON.parse(reader.result);
            state.data = normalize(parsed);
            state.open = {};
            markDirty(); rerender();
            toast("Content imported.", "ok");
          } catch (err) { toast("That file is not valid JSON.", "err"); }
        };
        reader.readAsText(importer.files[0]);
      }
    });

    /* Top bar */
    $("[data-action='save']").addEventListener("click", function () { saveDraft(); toast("Draft saved.", "ok"); });
    $("[data-action='top-preview']").addEventListener("click", openPreview);
    $("[data-action='top-publish']").addEventListener("click", function () {
      state.section = "__publish"; rerender(); window.scrollTo(0, 0);
    });
    $("[data-theme-toggle]").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  /* Find the schema spec for a nested list path such as "projects.0.links". */
  function findFieldSpec(path) {
    var parts = path.split(".");
    var section = SECTION_BY_KEY[parts[0]];
    if (!section) return null;
    var fields = section.fields;
    for (var i = 1; i < parts.length; i++) {
      if (/^\d+$/.test(parts[i])) continue;
      var match = null;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j].key === parts[i]) { match = fields[j]; break; }
      }
      if (!match) return null;
      if (i === parts.length - 1) return match;
      fields = match.fields || [];
    }
    return null;
  }

  /* ---------------------------------------------------------------------
     Draft actions
     --------------------------------------------------------------------- */
  function exportJson() {
    saveDraft();
    var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "content.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("content.json downloaded. Commit it to data/content.json.", "ok");
  }

  var PREVIEW_TARGET = {
    projects: "../projects.html?preview=1",
    about: "../about.html?preview=1",
    contact: "../about.html?preview=1#contact"
  };

  function openPreview() {
    saveDraft();
    window.open(PREVIEW_TARGET[state.section] || "../index.html?preview=1", "_blank", "noopener");
  }

  function revertDraft() {
    if (!confirm("Discard all local changes and reload the published content?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
    location.reload();
  }

  function applyRaw() {
    var textarea = $("[data-raw]");
    try {
      var parsed = JSON.parse(textarea.value);
      state.data = normalize(parsed);
      state.open = {};
      markDirty(); rerender();
      toast("JSON applied.", "ok");
    } catch (err) {
      toast("Invalid JSON: " + err.message, "err");
    }
  }

  /* ---------------------------------------------------------------------
     GitHub publishing
     --------------------------------------------------------------------- */
  function logLine(text, kind) {
    var log = $("[data-log]");
    if (!log) return;
    var span = document.createElement("span");
    span.className = kind || "";
    span.textContent = text + "\n";
    log.appendChild(span);
    log.scrollTop = log.scrollHeight;
  }

  /* Re-render the panel without losing the publish log. renderPanel() replaces
     the whole subtree, so the accumulated log is carried over by hand. */
  function rerenderKeepingLog() {
    var log = $("[data-log]");
    var html = log ? log.innerHTML : "";
    rerender(true);
    var fresh = $("[data-log]");
    if (fresh) {
      fresh.innerHTML = html;
      fresh.scrollTop = fresh.scrollHeight;
    }
  }

  function readGhForm() {
    var cfg = {
      owner: $("#gh-owner").value.trim(),
      repo: $("#gh-repo").value.trim(),
      branch: $("#gh-branch").value.trim() || "main",
      remember: $("#gh-remember").checked
    };
    var token = $("#gh-token").value.trim();
    try {
      localStorage.setItem(GH_KEY, JSON.stringify(cfg));
      if (cfg.remember) { localStorage.setItem(TOKEN_KEY, token); sessionStorage.removeItem(TOKEN_KEY); }
      else { sessionStorage.setItem(TOKEN_KEY, token); localStorage.removeItem(TOKEN_KEY); }
    } catch (err) { /* storage unavailable */ }
    cfg.token = token;
    return cfg;
  }

  function forgetToken() {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (err) { /* ignore */ }
    var field = $("#gh-token");
    if (field) field.value = "";
    toast("Token cleared from this browser.", "ok");
  }

  function gh(cfg, path, options) {
    var opts = options || {};
    return fetch("https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + path, {
      method: opts.method || "GET",
      headers: {
        Authorization: "Bearer " + cfg.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        return { ok: res.ok, status: res.status, json: json };
      });
    });
  }

  function validateCfg(cfg) {
    if (!cfg.owner || !cfg.repo) { toast("Enter the repository owner and name.", "err"); return false; }
    if (!cfg.token) { toast("Enter a GitHub access token.", "err"); return false; }
    return true;
  }

  function githubTest() {
    var cfg = readGhForm();
    if (!validateCfg(cfg)) return;
    $("[data-log]").innerHTML = "";
    logLine("Checking " + cfg.owner + "/" + cfg.repo + " …", "info");
    gh(cfg, "").then(function (res) {
      if (!res.ok) {
        logLine("Failed (" + res.status + "): " + (res.json.message || "unknown error"), "err");
        if (res.status === 404) {
          logLine("A 404 here usually means the token cannot see this repository. Check the owner and name, " +
            "and that the token grants access to it.", "dim");
        }
        return;
      }
      logLine("Repository found: " + res.json.full_name + (res.json.private ? " (private)" : " (public)"), "ok");
      logLine("Default branch: " + res.json.default_branch, "dim");
      if (res.json.permissions && res.json.permissions.push === false) {
        logLine("Warning: this token has read access but not write access.", "err");
      }
      return gh(cfg, "/branches/" + encodeURIComponent(cfg.branch)).then(function (br) {
        if (br.ok) logLine("Branch \"" + cfg.branch + "\" exists. Ready to publish.", "ok");
        else logLine("Branch \"" + cfg.branch + "\" not found (" + br.status + "). " +
          "Set the branch to " + res.json.default_branch + " or create it first.", "err");
      });
    }).catch(function (err) {
      logLine("Network error: " + err.message, "err");
    });
  }

  /* Walk every string in the data tree, letting the callback rewrite it. */
  function walkStrings(node, fn) {
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        if (typeof node[i] === "string") node[i] = fn(node[i]);
        else if (node[i] && typeof node[i] === "object") walkStrings(node[i], fn);
      }
    } else if (node && typeof node === "object") {
      Object.keys(node).forEach(function (key) {
        if (typeof node[key] === "string") node[key] = fn(node[key]);
        else if (node[key] && typeof node[key] === "object") walkStrings(node[key], fn);
      });
    }
    return node;
  }

  var MIME_EXT = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "image/svg+xml": "svg", "application/pdf": "pdf"
  };

  function utf8Base64(str) {
    var bytesArr = new TextEncoder().encode(str);
    var binary = "";
    var CHUNK = 0x8000;
    for (var i = 0; i < bytesArr.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytesArr.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function putFile(cfg, path, base64, message) {
    return gh(cfg, "/contents/" + path.split("/").map(encodeURIComponent).join("/") +
      "?ref=" + encodeURIComponent(cfg.branch)).then(function (existing) {
      var body = { message: message, content: base64, branch: cfg.branch };
      if (existing.ok && existing.json && existing.json.sha) {
        if (existing.json.content && existing.json.content.replace(/\s/g, "") === base64) {
          return { skipped: true, path: path };
        }
        body.sha = existing.json.sha;
      }
      return gh(cfg, "/contents/" + path.split("/").map(encodeURIComponent).join("/"), {
        method: "PUT", body: body
      }).then(function (res) {
        if (!res.ok) throw new Error(path + ": " + (res.json.message || "HTTP " + res.status));
        return { skipped: false, path: path };
      });
    });
  }

  function githubPublish() {
    var cfg = readGhForm();
    if (!validateCfg(cfg)) return;

    var btn = $("[data-action='gh-publish']");
    btn.disabled = true;
    var originalLabel = btn.textContent;
    btn.textContent = "Publishing…";
    $("[data-log]").innerHTML = "";

    var payload = clone(state.data);

    /* Collect every inline data: URL and turn it into a real repository file. */
    var uploads = [];
    walkStrings(payload, function (value) {
      if (!isData(value)) return value;
      var match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(value);
      if (!match) return value;
      var mime = match[1];
      var base64 = match[2] ? match[3] : btoa(unescape(encodeURIComponent(decodeURIComponent(match[3]))));
      var ext = MIME_EXT[mime] || (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
      var dir = /^image\//.test(mime) ? IMAGE_DIR : FILE_DIR;
      var target = dir + hash(base64) + "." + ext;
      if (!uploads.some(function (u) { return u.path === target; })) {
        uploads.push({ path: target, base64: base64, size: Math.round(base64.length * 0.75) });
      }
      return target;
    });

    logLine("Publishing to " + cfg.owner + "/" + cfg.repo + " on branch " + cfg.branch, "info");
    logLine(uploads.length ? uploads.length + " file(s) to upload." : "No new files to upload.", "dim");

    var chain = Promise.resolve();
    uploads.forEach(function (upload) {
      chain = chain.then(function () {
        logLine("Uploading " + upload.path + " (" + bytes(upload.size) + ") …", "dim");
        return putFile(cfg, upload.path, upload.base64, "Add media " + upload.path.split("/").pop())
          .then(function (result) {
            logLine(result.skipped ? "  already present, skipped" : "  uploaded", result.skipped ? "dim" : "ok");
          });
      });
    });

    chain.then(function () {
      logLine("Writing " + DATA_PATH + " …", "dim");
      return putFile(cfg, DATA_PATH, utf8Base64(JSON.stringify(payload, null, 2)),
        "Update portfolio content");
    }).then(function (result) {
      logLine(result.skipped ? "No content changes to commit." : "Content committed.", "ok");
      logLine("", "dim");
      logLine("Done. GitHub Pages usually rebuilds within a minute.", "ok");
      logLine("Site: https://" + cfg.owner.toLowerCase() + ".github.io/" + cfg.repo + "/", "info");
      logLine("Build status: https://github.com/" + cfg.owner + "/" + cfg.repo + "/actions", "info");

      /* Uploaded files now live in the repo, so drop the inline copies. The
         panel is refreshed so the pending-file counters reset. */
      state.data = payload;
      saveDraft();
      rerenderKeepingLog();
      toast("Published successfully.", "ok");
    }).catch(function (err) {
      logLine("Failed: " + err.message, "err");
      if (/409|sha/i.test(err.message)) {
        logLine("The file changed in the repository since this page loaded. Reload the editor and try again.", "dim");
      }
      toast("Publish failed. See the log.", "err");
    }).then(function () {
      /* Re-query: a re-render above may have replaced the original button. */
      var live = $("[data-action='gh-publish']");
      if (live) { live.disabled = false; live.textContent = originalLabel; }
    });
  }

  function wirePublish() { /* handled through delegation in wireGlobal */ }
  function wireDataPanel() { /* handled through delegation in wireGlobal */ }

  /* ---------------------------------------------------------------------
     Normalisation
     Guarantees every section exists so the forms never hit undefined.
     --------------------------------------------------------------------- */
  function normalize(input) {
    var data = (input && typeof input === "object") ? input : {};
    SCHEMA.forEach(function (section) {
      if (section.type === "list") {
        if (!Array.isArray(data[section.key])) data[section.key] = [];
      } else {
        if (!data[section.key] || typeof data[section.key] !== "object") data[section.key] = {};
      }
    });
    (data.projects || []).forEach(function (project) {
      if (!project.id) project.id = slugify(project.title);
      ["tags", "gallery", "highlights", "links"].forEach(function (key) {
        if (!Array.isArray(project[key])) project[key] = [];
      });
    });
    return data;
  }

  /* ---------------------------------------------------------------------
     Theme
     --------------------------------------------------------------------- */
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    try { localStorage.setItem(THEME_KEY, mode); } catch (err) { /* ignore */ }
    var btn = $("[data-theme-toggle]");
    if (btn) btn.innerHTML = mode === "dark" ? ICONS.sun : ICONS.moon;
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function boot() {
    applyTheme(document.documentElement.getAttribute("data-theme") || "light");

    fetch("../" + DATA_PATH, { cache: "no-cache" })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .catch(function () { return {}; })
      .then(function (published) {
        state.published = published;

        var draft = null;
        try {
          var raw = localStorage.getItem(DRAFT_KEY);
          if (raw) draft = JSON.parse(raw);
        } catch (err) { /* ignore */ }

        state.data = normalize(draft || clone(published));
        renderNav();
        renderPanel();
        wireGlobal();

        var brand = $("[data-admin-initials]");
        if (brand) brand.textContent = initials((state.data.profile || {}).name || "Portfolio");

        if (draft) {
          updateSaveState("Local draft loaded", "is-saved");
          toast("Restored your unsaved draft.", null);
        } else {
          updateSaveState("Up to date", "is-saved");
        }
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
