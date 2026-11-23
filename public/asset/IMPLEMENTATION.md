# SUARA — IMPLEMENTATION.md

> **Mission:** Build a cohesive, bright, production-grade responsive civic-tech interface with an identifiable Tunas mascot, using the files in this kit as *individual* references. Do not turn them into a single poster, do not crop or stretch mascot poses, and do not replace the already-working business logic.

## 0. Reference hierarchy and non-negotiables

1. **Current local repository and server-side contracts** win for behavior, data, roles, and security. Check local uncommitted changes before modifying anything.
2. `README.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `docs/forum.md`, `docs/admin.md`, `docs/simulasi.md`, `docs/keputusan.md` and current migrations in the real repo describe product behavior.
3. **These UI files** define visual direction: `pages/*.html`, `shared/styles.css`, `design/tokens.css`, `assets/*` and per-page full screenshots.
4. Original asset references in `assets/reference/` define Tunas appearance; production icons and Tunas PNGs are separated in `assets/`. Never claim PNGs are vector sources.
5. Do not hardcode results, duplicate scoring formulas, or conflate recommendation with final decision.

**Verified repo state on 2026-11-23:** `/simulasi`, `/keputusan`, `/keputusan/[tahun]`, `/admin/keputusan`, forum, admin workflows, and optional AI urgency advice have been implemented. Some older docs said these routes were stubs; **do not follow stale summaries**. Use the local tree if it is even newer.

## 1. Branding and visual identity

**Identity:** SUARA — *Sistem Usulan dan Aspirasi Rakyat*. Public service, accessible, welcoming, transparent, and concrete. Do not look like generic SaaS dashboards filled with floating bordered cards.

**Logo:** Preserve the leaf mark supplied by the user at `assets/logo/suara-mark.svg` and all `favicon-*.png`. Use `suara-horizontal.svg` at large enough sizes for its wordmark to remain readable; use icon-only mark on mobile and in favicon.

**Tunas mascot (locked personality):** round cream face, leaf-head silhouette, deep green hood/clothing, soft ink outlines, gentle blush, warm shiny eyes, friendly gestures, cream vest and brown satchel where present. Do not redraw a completely different species, face, leaf geometry, or clothing pose-to-pose. Mascot is **supporting communication**, not a replacement for data. Use one hero pose in `/`, smaller explain/think/success poses for empty states, and avoid the mascot in dense administrative tables.

**Fonts:** Plus Jakarta Sans for major headings and Inter for reading/UI/data. Use `font-display: swap`, system fallbacks, and tabular figures for money. Never use huge type in budget rows; size constrained by parent width.

**Colors:** source `design/tokens.css`, with forest `#0F5132`, official product green `#1B7048`, warm white `#FCFAF5`, dark text `#14261E`, mint surfaces, restrained golden `#F2B600`. Use semantic status classes for success/warning/danger and sufficient contrast. Make screens luminous, not slate-gray.

**Geometry:** max content width 1280px, desktop gutter 40–64px, tablet 24px, mobile 16–20px. Use 8px spacing scale and radius 8–12px. One contextual surface, not nested panels-within-panels. Dividers mainly in tables/forms. No pointless shadows. Desktop headings H1 40–52px; ordinary page H1 30–36px; mobile 28–36px. Body 15–16px and secondary 13–14px, with fluid spacing.

**Image rules:** never `object-fit: cover` on Tunas. Use `contain` and proper intrinsic dimensions, preserve transparent padding. Never shrink entire desktop interfaces to make mobile.

## 2. Exact responsive shell

| Viewport | Desired structure | Acceptance |
|---|---|---|
| 320px | Single column, short labels, scrollable sections | No horizontal scroll or overlapping action bars |
| 390px | Mobile UI, appropriate bottom navigation for signed-in public/warga or admin | Text readable, no clipped fields, content not hidden behind sticky controls |
| 768px | Tablet: 1–2 columns depending on content density | Forms stack before they become cramped |
| 1024px | Tablet landscape: flexible content and collapsed sidebars | Charts/financial values unbroken |
| 1280px | Laptop: 2-column working pages | No huge empty regions or compressed right rail |
| 1440px | Desktop: max 1280px content, full page screenshots | Clear hierarchy above fold and no visually cut components |

Use CSS Grid with `minmax(0,1fr)` and `min-width:0`; use `clamp()` sparingly; cards must have explicit reason to exist. No horizontal page overflow. If a financial chart segment is too narrow, put the label in a legend rather than inside the bar. All controls >= 44×44 CSS px where possible. Sticky bottom actions must include safe-area padding and not occlude focused inputs.

## 3. Role and permission model

| Capability | Public visitor | Verified warga | Admin desa |
|---|---|---|---|
| Read forum, decisions, budget comparison, history | Yes | Yes | Yes |
| Open simulation, share URL state | Yes | Yes | Yes |
| Submit proposal / vote / cancel vote | Sign in first | Yes (subject to status and rules) | No |
| Comment in a proposal | No | Yes | Yes, clearly labeled "Admin desa" |
| Moderate hidden/visible content | No | No | Yes, mandatory reason |
| Change official budget, weights, proposal status, users | No | No | Yes, within allowed transitions |
| Set musyawarah result | No | No | Through `/admin/keputusan` with checks and confirmation |

**Important:** “Pengunjung” is access without authentication; the two authenticated roles are `warga` and `admin`. No registration page. A resident account is created by admin and linked to a warga record.

## 4. Route-by-route implementation blueprints

Each entry maps to a **separate HTML reference and separate desktop/mobile PNG screenshot**. Implement real Next.js routes, not copies of static HTML placeholders.

### `/` — `pages/home.html`

**Goal:** immediately reveal the problem SUARA solves; comparison in first two sections; keep Tunas distinctive but not oversized. Desktop: navbar (~68px), hero 55/45 width, decorative hero <= 350px tall, compact stats strip, comparison of two scenarios, reasons, recommendation table, decision trail. On mobile: headline first, Tunas below content, CTAs, two-column budget stats, comparison stacked, table converted to legible rows.

**Default demo truth:** Rp300 million pagu; 7 voting proposals; 162 votes; 3 RW. Popularity-based greedy => Gapura Rp180m + Balai warga Rp110m = Rp290m. Recommended exact knapsack => Jalan SDN 03 Rp85m, Drainase Rp90m, Jembatan Rp70m, Lampu PJU Rp40m = Rp285m; Talud Rp220m deferred. Weight popularity 30%, urgency 40%, fairness 30%. Use server data rather than hardcoded strings in actual application.

**Interaction:** segmented comparison with selected state and immediate numerical/text feedback; detailed projects link to proposal; historical trail link to decisions. Show clear fallback badge if database is unavailable. **No pretend budget approval on this page.**

### `/forum` — `pages/forum.html`

List first. On desktop use search + RW/category/status/sort filters in one row; results in clean rows separated by a single rule. On mobile use search with accessible “Filter” bottom sheet and 20-result pagination/load-more. URL stores filters so back button restores context. Distinguish `forum` and `voting`, show selected position only for `voting`. Status labels always use text + icon, not color alone. Public can read, cannot vote. Warga can submit and support. Admin can moderate but not support.

### `/forum/[id]` — `pages/detail.html`

Use content left + slim contextual rail right desktop, stack mobile. Show original text, RW, category, urgency if assessed, cost, current status, comments, and public decision history. Support action only for eligible verified warga on eligible status. Make “batalkan dukungan” reversible; show server-backed feedback. For proposals still in forum, link “Lihat kalau usulan ini dihitung” to simulation with URL arguments. Show reasons for hidden content without exposing moderated text. Tunas should not crowd the body copy.

### `/forum/usul` — `pages/submit.html`

Three visible stages: **Isi → Periksa kemiripan → Tinjau & kirim**. Preserve draft and return on network failures. Required: title 8–80 chars, description 20–1,500, estimated budget Rp100k–Rp5b, RW, category. User can submit 3 proposals per 24 hours. AI similarity checks semantics + RW and offers merge support, **never forbids submitting the original proposal**. Mark fallback from embeddings to `pg_trgm` honestly. After submit, show confirmation with link to proposal and closure. Never send form data via fake UI-only controls.

### `/simulasi` — `pages/simulation.html`

This route **exists in the current repo** and is much richer than an ordinary 3-slider demo. Reuse the actual simulation engine and Peta Pagu. Keep official pagu distinct from trial pagu; update scenario without server mutations; make all 3 weights sum 100 automatically using repository `lib/bobot-simulasi.ts` logic. Include presets (Resmi, Dukungan saja, Keselamatan dulu, Merata dulu), shareable URL state, browser back/forward restoration, reset, *what changed* list, per-RW table, **Peta Pagu**, 231-combination stability explanation, and hypothetical forum proposal addition. On mobile put controls in collapsible area/sheet and results first after brief summary. No misleading percentages invented for Peta Pagu.

### `/keputusan` — `pages/decisions.html`

Current code already provides a year register and detailed public decision logs. Group running period and decided years. Distinguish **recommendation snapshot** from **musyawarah result**. Demo seed: 2026 decided (before SUARA) and 2027 running. Public read-only. If an annual result has no recommendation snapshot, say so and do not manufacture a comparison. Do not treat the whole feature as unimplemented.

### `/keputusan/[tahun]` — `pages/decision-2026.html`

For 2026 demo: Rp320m pagu; Rp310m approved, Rp10m remainder; 3 approved and one rejected; decided before SUARA was deployed. Use a factual table and optional print/CSV links mapped to real export endpoints. For 2027 or newer when data exists: two proportional budget bars (recommendation vs final), differences and written reasons, all proposal outcomes, per-RW allocation, print A4 and CSV. Year page is snapshot-based and must not recalculate historical results.

### `/masuk` — `pages/login.html`

A single quiet login form: username, password, show/hide password, correct errors, session expiry and retry instructions. No public account registration. Preserve existing `scrypt` and JWT security, httpOnly cookie, rate limiting and role redirects; do not visually expose whether a username exists.

### `/akun` — `pages/account.html`

Show account security and change-password workflow. Require old password, validate new, show success confirmation. Revokes other sessions. Warga and admin see same password-control semantics; do not put private user data in public logs.

### `/admin` — `pages/admin.html`

Operational, not marketing. Sidebar on desktop, slim responsive navigation on mobile. Top section: pending reviews, budget, currently recommended count, flagged moderation—not decorative KPIs. Task-oriented list with actions and clear feedback. Tunas only as optional guidance in empty state; hide mascot from dense data tables.

### `/admin/usulan` — `pages/admin-proposals.html`

Filter status + RW, inspect with accessible table. Clicking opens proper admin detail page rather than public details. Status transition button labels come from actual allowed server transitions; never show unauthorized actions. Use concise urgency/category/status labels; show stale-data and version-collision UI.

### `/admin/usulan/[id]` — `pages/admin-proposal-review.html`

Review proposal and urgency rubric (1–3, 4–6, 7–8, 9–10). On `forum → voting`, urgency score 1–10 and mandatory explanation of 20–500 chars. `voting → forum` clears current urgency but preserves history. Optional Gemini urgency **advice**: only after admin picks a score, never auto-applies AI value, disclose when advice is unavailable and do not send personal details carelessly. **Preview before commit** must compare old/new Garis Pagu and indicate which projects change status. Handle version conflicts without silently overwriting other admin's work.

### `/admin/anggaran` — `pages/admin-budget.html`

Official budget and weights (not simulator). Validate Rp10 million–Rp10 billion, three integer weight inputs totaling exactly 100, mandatory reason, preview-before-save with old/new recommendation and per-project differences, conflict state with latest value and reload. Atomic SQL authority, not client-only validation. On mobile stack controls then preview; keep save visible but disabled until state is valid. Undo/cancel is draft-level, not rollback of audit history.

### `/admin/akun` — `pages/admin-accounts.html`

Accounts management list; private data stays in admin log. Create/reset/deactivate react to real state. Clear status badges, confirmations for destructive actions and reset operations. Prevent admin deactivating self or last active admin as per business logic.

### `/admin/akun/baru` — `pages/admin-account-new.html`

Only admin can create citizen accounts; choose unlinked resident, username, generate random initial password, show once after success, require password change at first sign-in. Never provide admin role assignment in UI.

### `/admin/moderasi` — `pages/admin-moderation.html`

Queue/report review, content preview, reason input 10–500 chars and explicit confirm. Public log shows reason, not hidden content or private admin identity. Allow recovery/show-again according to server rules. Avoid alert-heavy visuals; status icon + label + time.

### `/admin/keputusan` — `pages/admin-decisions.html`

**Existing working route**, not a stub. All voting proposals must have exactly one musyawarah outcome (approved / referred to another funding source / carried to next period / rejected). Show approval cost vs budget, required reasons for differences, source for referred projects, date, 20–1000 char meeting note, explicit attestation, snapshot preview, and version/conflict feedback. Persist in one transaction through existing logic. Cancellation of a fixed decision within 24 hours only as allowed, confirmed and logged. The admin's proposal-review page must never replace this route.

## 5. Shneiderman's 8 Golden Rules — behavioral acceptance

| Rule | SUARA implementation / how to verify |
|---|---|
| 1. Consistency | Same term “terbiayai/ditunda” everywhere; same component colors; same formatting, route nav and icon states |
| 2. Shortcuts | Admin task shortcuts, direct proposal links, form focus/keyboard nav, scenario presets, shareable filter/URL state |
| 3. Informative feedback | Loading/saving/validation feedback, simulation result updates, vote count response, offline/fallback warning |
| 4. Dialogs yield closure | A proposal submission finishes with reference link; admin commit shows success summary; musyawarah completion has explicit receipt |
| 5. Error prevention | Client + server validation, weights sum 100, no impossible status transition, per-role guards, conflicts handled safely |
| 6. Easy reversal | Undo vote, reset simulation, cancel unsaved form; only permit rollback when business rules allow (24h musyawarah cancellation) |
| 7. Internal locus of control | No automatic submission, no surprise navigation; user controls sliders, tabs, filters; no official budget change through public simulation |
| 8. Reduce memory load | Show current/after comparisons together, visible reasons and normalized vote meaning, persistent filter context and plain-language explanations |

Every route must supply keyboard focus indicators; status changes should be announced by `aria-live` judiciously. A11y requirement: WCAG 2.2 AA aspirational with real axe/keyboard/screen-reader tests, not assumed from a beautiful screenshot.

## 6. Assets and usage rules

- `assets/logo/`: use exactly one supplied leaf mark throughout nav, favicon, and footer. No replacing brand with generated leaf variants.
- `assets/mascot/tunas-wave.png`: homepage hello or onboarding; `tunas-explain.png`: methodology; `tunas-thinking.png`: ambiguous/empty states; `tunas-celebrate.png`: confirmation/success; `tunas-analyze.png`: simulation assist. Each file is separately addressable.
- `assets/mascot/tunas-original-scene.png`: original illustrated scene with background, **not** transparent. Do not use as transparent avatar.
- `assets/scenes/`: independent village/balai/jembatan/sawah art. Avoid using photos that depict fabricated real projects.
- `assets/icons/*.svg`: functional UI icons. Use 20–24px and stroke consistency; icons complement text.
- `assets/reference/`: lock likeness and visual identity. Reference boards are **not** assets to place whole into a webpage.

Some transparent pose PNGs were extracted from the original concept board. At high zoom the source's resolution limits are visible; do not enlarge them beyond their useful resolution. If vector animation is required, commission a proper layered redraw that preserves character traits rather than using previous simplified SVG.

## 7. Implementation order (do not shotgun-redesign everything)

1. Inventory all live routes and compare existing business features to this spec. Do not reset local changes.
2. Wire brand tokens and logo across existing `app/layout.tsx`, public and admin shells; verify that no cached data or role logic is affected.
3. Implement public home, forum, detail and submission; take screenshots after each.
4. Implement *actual* simulator Peta Pagu/stability UX and decision register/detail, not prototype substitutes.
5. Implement login/account and all admin pages, including decision formation and moderation.
6. Run `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run e2e` as supported. Report exact commands and pass/fail, never invent scores.
7. For every page, capture complete desktop/mobile screenshots at 1440×900 and 390×844. Additionally verify 320,768,1024,1280px widths, scrollWidth and footer/action occlusion. Compare screen by screen to **individual** screenshot references.
8. Fix discrepancies before calling the redesign finished. Stop only after layout and functionality meet the criteria.

## 8. What this kit does and does not prove

- **Included:** 17 individual HTML page prototypes, 34 full-height screen renders, 32+ original/reference/illustration assets and 16 SVG UI icons, data-derived simulation example, documented UX rules.
- **Not included:** database integration, live authentication, interactive moderation/decision persistence, AI runtime, production Next.js wiring, exact production test results, editable mascot vector layers, guaranteed pixel-perfect typography across OS/browser renderers.
- Do not claim 1:1 pixel fidelity or WCAG conformance until screenshot diffs and real accessibility testing are executed in the actual deployed application.

## Final quality gate

A page is **not done** if any mascot is clipped, any action is covered by mobile navigation, any financial value overflows its cell, a user can take an unauthorized action, a mock data point is shown as official, the result requires reading a wall of text, or screenshots are produced only as a montage rather than a single full-page capture for that route.
