# Codex / Gemini — Execution Prompt for SUARA Final Design Kit

You are the senior product designer and frontend engineer implementing the SUARA design handoff into the CURRENT LOCAL repository.

**Read in this order**: `SUARA_DESIGN_KIT_FINAL/README.md`, `SUARA_DESIGN_KIT_FINAL/IMPLEMENTATION.md`, `SUARA_DESIGN_KIT_FINAL/docs/ASSET_CATALOG.md`, each HTML file in `SUARA_DESIGN_KIT_FINAL/pages/`, and the corresponding individual PNG references under `screenshots/desktop/` and `screenshots/mobile/`. Inspect the existing Next.js project and its current uncommitted changes first. Do not start by rewriting the homepage from scratch.

**Primary objective:** implement a consistently branded, highly usable responsive experience that looks like the provided individual pages, without repeating the previous mistakes: AI-dashboard borders everywhere, huge empty spaces, tiny or overflowing metrics, clipped mascot art, mismatch between thumbnail previews and real assets, or fictional backend behavior.

**Absolute asset rules:** Use only the individual files from `assets/logo/`, `assets/mascot/`, `assets/scenes/`, and `assets/icons/`. Do not place any `assets/reference/` board as a website image. Do not redraw the mascot with simplistic flat SVGs. Preserve its original face/leaves/shading/vest. Use `object-fit: contain`; no clipping on any viewport.

**Absolute product rules:** The current repository already has functional `/simulasi`, `/keputusan`, `/keputusan/[tahun]`, and `/admin/keputusan` routes, plus AI urgency advisory subject to configuration. Do not replace them with static stubs. Keep existing exact knapsack, per-1,000-population normalization, audit logs, DB SQL policies, auth, 100% weights, scenario URL behavior, admin-preview logic, decision snapshots and version controls unchanged. UI text must be Indonesian and must distinguish recommendations from musyawarah decisions.

**Work in vertical slices:** audit => component implementation => inspect screenshot => test interactions => adjust visual details => move to next route. Start by implementing the shared shell, logo and tokens, then public home, forum/detail/proposal, simulation/decisions, login/account, admin. Do not wait until all routes are coded to run screenshots.

**Responsive QA:** Capture each route at 1440×900 desktop and 390×844 mobile as full-page images, plus overflow checks at 320/768/1024/1280. Review actual render against the route-specific screenshots. Check keyboard support, focus, status announcements, role-based access, validation and closure. Apply all Shneiderman's 8 Golden Rules from `IMPLEMENTATION.md`.

**Output:** actual changed files with a route-by-route summary, screenshot paths, testing logs and a list of any real blockers. Do not claim tests passed if they were not executed. Do not stop at producing another Markdown document or an image collage.

**Starting action:** audit the local repository and compare its route structure with the kit; then implement the shared design system and `/` with a visual review cycle.
