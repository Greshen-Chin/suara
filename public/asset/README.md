# SUARA — Independent Assets & Responsive UI Handoff

**Version:** Design Kit Final (prototype) | **Reference:** `Greshen-Chin/suara` checked 23 November 2026.

## Start here

1. Extract the ZIP without flattening folders.
2. Open `pages/home.html` in a normal browser (or serve the folder with `python -m http.server 8000`). Each page is an independent HTML file; navigation links go between files.
3. Review `screenshots/desktop/` and `screenshots/mobile/`: one complete screenshot per page, **not a collage or cropped portion of a board**.
4. Read `IMPLEMENTATION.md` before moving visual components into the existing Next.js repo.
5. Use `PROMPT_FOR_CODEX_GEMINI.md` to hand off the implementation.

## Folder map

```
SUARA_DESIGN_KIT_FINAL/
├── assets/
│   ├── logo/                  original supplied mark, SVG wordmark, favicon PNGs
│   ├── mascot/                separate PNGs for Tunas poses and states
│   ├── scenes/                individual village/landscape images and supporting SVGs
│   ├── icons/                 independent consistent SVG icons
│   └── reference/             ORIGINAL approved boards, for comparison only
├── pages/                     17 distinct responsive HTML pages
├── screenshots/desktop/       17 full-page 1440px screenshots
├── screenshots/mobile/        17 full-page 390px screenshots
├── shared/                    shared CSS/JS for the interactive prototype
├── design/                    design tokens + asset manifest
├── docs/                      asset catalogue and QA render report
├── IMPLEMENTATION.md          per-route implementation and 8 Golden Rules
└── PROMPT_FOR_CODEX_GEMINI.md agent handoff prompt
```

## Scope & honesty

- This package is a **coded visual/interactivity prototype**, not production Next.js code and not a live Supabase client.
- It uses real seed values (3 RW, 7 voting proposals, 162 votes, Rp300m default budget). Decision year 2026 represents the included `seed_keputusan.sql` historical data.
- Simulator prototype can vary budget and weights; other server mutations show prototype feedback only.
- Some illustrations are raster PNGs extracted and upscaled from the supplied high-quality concept board. They are **not newly authored editable SVGs**; the original boards are retained in `assets/reference`.
- New design must not override actual Next.js logic or installed features.
- Automated UI screenshot rendering passed on the tested sizes, but this does **not** prove full WCAG 2.2 AA compliance or production E2E tests.
