# Portfolio

A project portfolio for GitHub Pages, with a built-in content editor.

Static HTML, CSS and vanilla JavaScript — no build step, no framework, no dependencies to
install. Every page renders from a single data file, `data/content.json`, which you edit
through the visual editor at `/admin/` rather than by hand.

Three pages:

| Page | What's on it |
|---|---|
| **Home** | A short intro, then three highlight projects, then a closing call to action. |
| **Work** | Every project, filterable by tag. Each one links to its own case study page. |
| **About** | Your write-up, with contact details and a message form below it at `#contact`. |

---

## Contents

- [Going live](#going-live)
- [Using the editor](#using-the-editor)
- [Publishing directly from the browser](#publishing-directly-from-the-browser)
- [Publishing without a token](#publishing-without-a-token)
- [Working locally](#working-locally)
- [Project layout](#project-layout)
- [Content model](#content-model)
- [Design system](#design-system)
- [Customising](#customising)
- [Notes and limitations](#notes-and-limitations)

---

## Going live

1. **Turn on Pages.** Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
   That's the only required step — the repository was empty before this commit, so
   `claude/vibrant-ptolemy-6wl43z` is currently the default branch and the site deploys from
   it as-is.

   The included workflow (`.github/workflows/deploy.yml`) publishes the repository root on
   every push to the default branch. It validates `data/content.json` first, so a malformed
   content file fails the build instead of breaking the live site.

2. **Optional but recommended — rename the default branch to `main`.** Go to
   **Settings → Branches**, click the pencil next to `claude/vibrant-ptolemy-6wl43z` and
   rename it to `main`. The workflow follows whatever the default branch is called, so
   nothing breaks. If you rename it, set **Branch** to `main` in the editor's Publish
   section too.

3. **Wait for the first run** to finish under the **Actions** tab. Your site will be at:

   ```
   https://donovanw645.github.io/Portfolio/
   ```

   The editor is at `https://donovanw645.github.io/Portfolio/admin/`.

> Prefer the classic setup? Set **Source** to **Deploy from a branch** instead and pick your
> default branch with folder `/ (root)`. The `.nojekyll` file is already in place so GitHub
> serves the files as-is. Delete `.github/workflows/deploy.yml` if you go this route.

---

## Using the editor

Open `/admin/` on the live site (or locally — see [Working locally](#working-locally)).

The editor has one section per content area, listed down the left. Everything you type is
saved to a **local draft** in your browser as you go — nothing is public until you publish.

| Control | What it does |
|---|---|
| **Save draft** | Forces an immediate save of the local draft (it also autosaves). |
| **Preview** | Opens the real site rendered from your draft, with an orange banner so you can tell it apart from the live version. |
| **Publish** | Commits your changes to the repository. |

**Reordering and editing entries.** The project list uses collapsible rows. Click a row to
expand it; use the arrows to reorder, the copy icon to duplicate, and the bin to delete.
Order in the editor is the order on the site, so put your strongest work first.

**Choosing the three highlights.** The homepage shows the first three projects with
**Feature this project** ticked. Tick a fourth and it is ignored until you untick one of the
others — reorder the list to control which three win. If fewer than three are ticked, the row
is topped up from the top of the list so it never looks half-built. Every project appears on
the Work page regardless.

**Images.** Use *Choose file* to upload, or paste a URL. Large photos are downscaled in the
browser (longest edge capped at 1800px) before being stored, so your repository doesn't fill
up with camera-sized files. Uploads sit in the draft until you publish, at which point they
become real files in `assets/img/uploads/`. Identical images are stored once and shared.

**Formatting.** The project write-up and about page fields accept a small Markdown subset:
`## Heading`, `- bullet`, `1. numbered`, `**bold**`, `*italic*`, `` `code` ``,
`[text](url)` and `> quote`. Leave a blank line between paragraphs. Raw HTML is escaped
rather than rendered.

---

## Publishing directly from the browser

The **Publish** section commits `data/content.json` and any uploaded media straight to the
repository through the GitHub API. GitHub Pages then rebuilds, usually within a minute.

You need a **fine-grained personal access token**:

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Repository access** → *Only select repositories* → pick this repository, and nothing else
3. **Permissions** → *Repository permissions* → **Contents: Read and write**. Leave every
   other permission alone.
4. Set a short expiry — you can always issue another one.
5. Paste it into the editor and press **Test connection** before your first publish.

### About token safety

Be deliberate here, because this is the one genuinely sensitive part of the setup:

- The token is stored **in your browser** and sent **only to `api.github.com`**. It is never
  sent to the site itself, and it is never committed to the repository.
- Anything with access to your browser profile can read it. Tick *Keep this token in local
  storage* only on a machine you control; leave it unticked and the token is dropped when you
  close the tab.
- Use **Clear token** when you're done on a shared machine.
- A fine-grained token scoped to one repository with `Contents: write` can only modify that
  repository's files. A classic token with `repo` scope can reach **every** repository you own
  — don't use one here.
- If a token ever leaks, revoke it at
  [github.com/settings/tokens](https://github.com/settings/tokens). Nothing else is needed.

`/admin/` carries `noindex, nofollow` and no one can edit the site without a token, but it is
still a publicly reachable page. If you'd rather it weren't published at all, see
[Notes and limitations](#notes-and-limitations).

---

## Publishing without a token

If you'd rather not create a token:

1. **Import / export → Download content.json**
2. Commit it over `data/content.json` in this repository

Images stay embedded in the file as data URLs in this mode. It works, but the file gets large
— for more than a handful of images, either use token publishing or add images to
`assets/img/uploads/` yourself and paste the path (e.g. `assets/img/uploads/photo.jpg`) into
the image field instead of uploading.

---

## Working locally

The pages fetch `data/content.json`, so they need to be served over HTTP — opening
`index.html` from the file system will show a "content could not be loaded" message.

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/  and  http://localhost:8000/admin/
```

Any static server works (`npx serve`, `php -S localhost:8000`, etc.).

---

## Project layout

```
.
├── index.html              Home — intro plus three highlight projects
├── projects.html           Work archive, with tag filters
├── project.html            Case study detail (?id=slug)
├── about.html              About narrative plus the contact block (#contact)
├── 404.html                Self-contained not-found page
├── admin/
│   └── index.html          Content editor
├── data/
│   └── content.json        All site content — the single source of truth
├── assets/
│   ├── css/main.css        Design system and site styles
│   ├── css/admin.css       Editor styles
│   ├── js/site.js          Renders the public pages
│   ├── js/admin.js         The editor
│   ├── img/favicon.svg
│   ├── img/uploads/        Images uploaded through the editor
│   └── files/              Résumé and other documents
├── .github/workflows/
│   └── deploy.yml          Builds and deploys to GitHub Pages
└── .nojekyll               Serve files as-is, no Jekyll processing
```

---

## Content model

`data/content.json` holds these top-level keys. The editor covers all of them, so you rarely
need to touch the file directly.

| Key | Purpose |
|---|---|
| `site` | Titles, meta description, footer copyright |
| `profile` | Name, role, contact details, portrait, résumé link |
| `social` | Labelled external links |
| `home` | Intro copy and the wording above the highlight row |
| `projects` | Case studies — each becomes its own page |
| `about` | About page narrative |
| `contact` | Contact copy and form endpoint (renders on the About page) |

A project entry looks like this:

```json
{
  "id": "warehouse-automation",
  "title": "Warehouse Automation Rollout",
  "summary": "One line describing the project and its outcome.",
  "client": "Acme Logistics",
  "role": "Project Lead",
  "year": "2025",
  "status": "Completed",
  "featured": true,
  "tags": ["Logistics", "Process Design"],
  "cover": "assets/img/uploads/warehouse.jpg",
  "gallery": ["assets/img/uploads/floor-plan.jpg"],
  "highlights": ["Cut pick time by 32%", "Rolled out to four sites"],
  "description": "## Overview\n\nMarkdown-lite goes here.",
  "links": [{ "label": "Case study PDF", "url": "https://example.com/case.pdf" }]
}
```

`id` is the URL slug (`project.html?id=warehouse-automation`). The editor fills it in from the
title if you leave it blank. Changing it later breaks any existing links to that project.

---

## Design system

Deliberately restrained and corporate: deep navy and business blue, 2px corner radius
throughout, hairline rules instead of heavy shadows, and no bright or multi-coloured buttons.
Headings are set in a serif (Source Serif 4) against a sans-serif UI (Inter), with system
fallbacks if the webfonts don't load.

Everything is driven by custom properties at the top of `assets/css/main.css`:

```css
--c-navy:    #0c2340;   /* headers, hero, footer  */
--c-primary: #14406e;   /* links, accents, focus  */
--r:         2px;       /* corner radius           */
--container: 1180px;    /* max content width       */
```

A light and a dark palette are defined; the toggle in the header remembers the visitor's
choice, defaulting to their system preference.

---

## Customising

**Change the colours.** Edit the tokens in `:root` in `assets/css/main.css`, and the matching
ones under `:root[data-theme="dark"]`.

**Change the favicon and brand mark.** `assets/img/favicon.svg` holds the initials; the header
and footer marks are generated from the profile name automatically.

**Change how many projects the homepage highlights.** Set `HIGHLIGHT_COUNT` near the top of
the rendering section in `assets/js/site.js`. It's 3. The grid is built for three across, so
6 also lays out cleanly; 4 or 5 will leave a gap on the last row.

**Add a navigation item.** Add the page, then add an entry to `NAV_ITEMS` near the top of
`assets/js/site.js`.

**Add a content field.** Add it to the relevant section's `fields` array in the `SCHEMA` near
the top of `assets/js/admin.js` — the editor builds its forms from that schema, so the field
appears automatically. Then render it wherever you want in `assets/js/site.js`.

**Enable the contact form.** GitHub Pages serves static files only and cannot process form
submissions. Create a free endpoint at [Formspree](https://formspree.io) or
[Getform](https://getform.io) and paste it into **Contact → Form endpoint URL**. Without
one, the form falls back to opening the visitor's email client.

---

## Notes and limitations

- **Content renders client-side.** Pages fetch `content.json` and build themselves in the
  browser, which keeps the whole thing dependency-free but means search engines and link
  previews see the static `<title>` and meta description in the HTML rather than per-project
  text. Fine for a personal portfolio; not the right choice for a content-heavy marketing site.
- **JavaScript is required.** Visitors with it disabled get an explanatory message.
- **The editor is public but harmless.** Anyone can open `/admin/` and edit their own local
  draft; without a token with write access to this repository they cannot change anything you
  or your visitors see. To keep it off the public site entirely, add an
  `exclude: ['admin/']`-style step to the workflow or simply run the editor locally and use
  the download-and-commit route. Setting **Site → Show "Content editor" link** to off only
  hides the footer link; it does not unpublish the page.
- **Images are downscaled, not optimised.** Photos are capped at 1800px and re-encoded, which
  is enough for a portfolio. For maximum quality, optimise images yourself and paste paths
  rather than uploading.
