# SUARA — PIXEL-DISCIPLINED PRODUCT UI REDESIGN BRIEF
## Paste this entire prompt into Gemini 3.8 Flash High while it has access to the SUARA workspace

You are acting as a principal product designer, design-systems engineer, accessibility specialist, and senior Next.js frontend engineer working on a REAL existing application: **SUARA — Sistem Usulan dan Aspirasi Rakyat**.

## 0. NON-NEGOTIABLE MISSION

Perform a disciplined **UI/UX redesign of the existing application**, not a generic AI-generated dashboard makeover. The owner rejects crowded dashboards, excessive borders, excessive cards, arbitrary iconography, compressed metrics, oversized fonts, decorative village illustrations, gradient-heavy sections, and mock data pretending to be real.

Your design should feel like a premium, restrained, editorial SaaS product for Indonesian civic participation, informed by the clarity of GOV.UK, information hierarchy of modern data products, and decision transparency of civic-tech platforms such as Decidim. DO NOT clone any of them; borrow information architecture principles, not their trademarks or layouts.

**Most important: business correctness > accessibility > visual elegance > decoration.** The product must be understandable to a first-time village resident using a small phone, and efficient for a village admin at a desktop computer.

**The provided screenshot is a NEGATIVE REFERENCE**, not a layout to preserve. Diagnose and replace its mistakes, including:
- Every metric is trapped inside a bordered box; information is over-segmented.
- KPI typography is oversized; values nearly overflow/collide (`Rp 685 juta`, `Rp 65 juta`, and other values).
- A thick bordered sidebar-form plus a thick bordered chart plus multiple bordered proposal cards produces visual noise.
- Sliders and preset buttons look improvised; current scenario vs official baseline is ambiguous.
- The budget segmented bar compresses project names into illegible text.
- Large rows of projects waste space but obscure the selection logic.
- Number, status, title, action, and commentary compete for attention.
- The page resembles a generated admin template instead of a considered civic decision tool.

## 1. REPOSITORY IS THE SOURCE OF TRUTH

Before editing a single component, inspect the LOCAL WORKING TREE, not just remote `main`. The user has shown a local `/simulasi` screen even though the GitHub `main` version previously contained a stub. **Do not replace, reset, or overwrite local in-progress features.** First run `git status`, review recent changes, and map existing source files, routes, components, tests, and feature maturity.

Read: `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/forum.md`, `docs/admin.md`, `app/page.tsx`, `app/simulasi/page.tsx`, `app/keputusan/page.tsx`, `app/globals.css`, `app/layout.tsx`, `components/landing/*`, `components/forum/*`, `components/admin/*`, `components/shell/*`, `components/ui/*`, `lib/seleksi.ts`, `lib/beranda.ts`, `lib/pratinjau.ts`, `lib/aturan-dukungan.ts`, `lib/transisi-status.ts`, and applicable tests/migrations.

Determine and explicitly report which features are fully implemented, locally in progress, stub-only, or planned. If exact code differs from the following documented baseline, LOCAL CODE WINS:
- Data seed: 3 RW, 7 voting proposals, official budget Rp300,000,000; default weights popularity 30%, urgency 40%, equity 30%.
- Official voting-majority selection: 2 projects, Rp290 million.
- SUARA recommendation: 4 projects, Rp285 million, official baseline. The documented recommended projects are Drainase, Jembatan, Lampu PJU, Jalan SDN 03; do not invent costs or labels when rendering data.
- Scenario budgets such as **Rp750 million** on a simulation are legitimate *what-if inputs*, not official current budget. Label explicitly: `Skenario simulasi: Rp750 juta` versus `Pagu resmi: Rp300 juta`.
- Matching similar proposals with embeddings/pgvector and a pg_trgm fallback exists; AI urgency assessment was documented as NOT yet implemented. Never display invented AI accuracy, AI-generated urgency, or “AI decided” claims.
- Public decision trail exists; final musyawarah decision flow is documented as not yet built, unless local files prove otherwise.
- There are only TWO authenticated roles: `warga` and `admin`. `pengunjung` is an unauthenticated access context. Do NOT invent a `pimpinan`, `superadmin`, `musyawarah`, or other login role.

All numbers must be calculated from actual repositories/services, seeded data, or genuine scenario state. Do not fill page whitespace with fabricated activity feeds, timestamps, village names, users, or testimonials.

## 2. PRODUCT EXPERIENCE & ROLE DIFFERENTIATION

### A. Public visitor — no account
Purpose: understand priorities, see proposals and discussions, inspect the fairness reasoning and public audit trail.
Information priority:
1. Clear plain-language statement: What is SUARA?
2. Official budget baseline plus comparison between `Suara terbanyak` and `Rekomendasi SUARA`.
3. Why selection differs and why a proposal may be deferred.
4. Explore public proposals, published reasons and decision trail.
Behavior: read-only. Attempted support/proposal submission redirects politely to login, preserving return URL. Do not promise independent self-registration: resident accounts are created by admin.

### B. Authenticated warga
Purpose: quickly submit a proposal, check a similar proposal, support or withdraw support, join discussion, follow proposal status.
Landing priority: one prominent `Ajukan usulan` CTA; easily scannable `Forum warga`; current proposal statuses, explanations, and support counts. Avoid duplicating an enterprise admin dashboard for warga.
Proposal creation: title + description + location context at RW level (NOT a fictional precise geolocation map) + estimated cost where required by implementation. Locally preserve draft if current implementation does so. Similar-proposal check offers `Dukung usulan ini` OR `Tetap ajukan usulan saya`; never forcibly merge or block. Existing one-support-per-proposal rule remains, withdrawing is supported when allowed. A resident can support many proposals under the currently documented rule.
Status wording must distinguish `Sedang dibahas`, `Masuk hitungan anggaran`, `Terbiayai dalam rekomendasi`, `Ditunda`, and an actual finalized decision. Never call an optimized recommendation `Disetujui` or `Sudah dibangun`.

### C. Authenticated admin desa
Purpose: triage forum proposals, review urgency, evaluate impacts, manage budget and scoring weights, create resident accounts, moderate content, inspect audit history.
Dashboard priority: `Butuh tindakan` first (if derived from actual data), then official budget status, followed by actionable proposal queue. No fabricated activity feed. Use dense, readable tables/rows for repetitive records, not giant bordered cards.
Admin modules and existing access routes: `/admin`, `/admin/usulan`, `/admin/anggaran`, `/admin/akun`, `/admin/moderasi`, plus `/akun` password change. Preserve actual routes and permissions.
Budget/weight changes: require reason and show a BEFORE vs AFTER impact preview before saving. Conflict detection/version checks must remain. At most 16 voting proposals for exact selection. Keep admin account creation CLI-only; web UI may create resident accounts, not admin accounts. Keep private account logs private and public policy/budget change logs public as currently designed.

### D. Simulation (`/simulasi`) — special cross-role experience if present locally
This is NOT a new role and not the same as persistent admin budget settings.
It is a sandbox for exploring candidate budget and weighting decisions WITHOUT writing to the official budget. Use explicitly labeled `Pagu resmi` and `Skenario yang sedang dicoba`. Show `Tidak mengubah data resmi` near the controls.
If a locally working simulation exists, preserve its logic and refactor UI only. If the route is a stub locally, do not implement a fake client-only simulator; offer an honest placeholder or implement only with existing tested calculation helpers, as separately scoped and verifiable.

## 3. DESIGN ART DIRECTION — PRECISE, NOT GENERIC

Brand personality: civic confidence, fair reasoning, calm clarity, Indonesian warmth, quietly premium. **NOT:** illustration-heavy rural tourism landing page, neon fintech, AI analytics dashboard, fancy Dribbble concept with no workable states.

Layout architecture:
- Marketing/public pages: contained horizontal navigation, max content width 1160–1200px, 24–40px desktop gutters, 16px mobile gutters.
- Functional pages: prefer compact top navigation or a slim contextual secondary navigation; avoid an oversized left sidebar for visitor/warga. On admin, a restrained 216–232px navigation rail is permissible only if useful, with the main content taking priority.
- Use a 12-column grid at desktop and single-column mobile. Max readable paragraph width 65–75 characters.
- Vertical rhythm: 8px base, spacing tokens `4, 8, 12, 16, 24, 32, 48, 64, 80` px. Page section separation 48–72px, tight list row separation 12–16px.
- Good alignment is mandatory: left edges of headings, metrics, tables, controls, and sections must align. Do not use arbitrary margins to fix individual screenshots.
- Use large blocks of white/cream negative space and typography for grouping. Most sections have NO border and NO box shadows.

COLOR TOKENS, starting from existing brand rather than random shades:
```
--background: #F7F8F5;       /* quiet warm off-white */
--surface: #FFFFFF;
--text: #14261E;             /* existing tinta */
--text-muted: #5B655F;
--green: #1B7048;            /* existing hijau-sawah */
--green-ink: #14563A;
--green-soft: #EAF3EC;
--line: #E3E8E1;             /* hairline only */
--blue-focus: #27409B;       /* existing biru-stempel */
--warning: #F2B600;          /* existing kuning-marka */
--error-text: #7A1A13;
--error-bg: #FDF1F0;
```
Keep accessible contrast; use only a few semantic states. Green does not replace text labels. Avoid full-saturation colored boxes for every metric. No gradients except an extremely subtle allowed decorative background where justified; default to none.

TYPE SYSTEM:
- Primary recommendation: `Plus Jakarta Sans` for display/headings and `Inter` for interface copy/figures, loaded locally or via framework font handling with fallbacks. You may choose one unified family if the visual audit proves it better. Do not combine 3–4 unrelated fonts.
- Keep exact font weight roles: 400 body, 500 nav/labels, 600 controls/subheads, 700 headline. No bold on every line.
- Desktop public H1: `clamp(38px, 4vw, 54px)` / line-height 1.1, letter spacing -0.03em; not 72–90px.
- Page H1 admin/simulation: 32–36px. Section H2: 22–26px. H3 18–20px. Body 15–16px / 1.5–1.65. Labels 12–13px, avoid using 11px as default.
- KPI numeric 28–38px (largest only for primary official budget), label 13–14px. Never allow a KPI number to wrap into overlapping columns. All currency figures use `font-variant-numeric: tabular-nums`, `white-space: nowrap` where appropriate, and adaptive font sizes; long values use `Rp285 juta` in summary and exact `Rp285.000.000` in detail.
- Use natural Indonesian with consistent typography and sentence case: `Pagu anggaran`, not screaming ALL CAPS.

BORDER/BOX RULES — STRICT:
- Maximum **ONE primary bounded surface** per major content region unless the content is a form requiring grouping.
- No outer border around every section, and absolutely no nested bordered card inside bordered card.
- Prefer `border-bottom: 1px solid var(--line)` for list rows and table separators. Avoid vertical divider overload.
- Inputs can use 1px border. Focus state 2px or 3px accessible outline. Selected tabs can use a 2px underline or soft background.
- Border radius: buttons 8px, inputs 8px, optional panel 10–12px. Do not use 20px rounded cards everywhere.
- Shadows only on popover, floating menu, or dialog—not normal content sections.
- Icons optional and sparse, 16–18px stroke, never decorative icon circles attached to every number. Use Lucide consistent set.
- No illustration in core data visualization. Use brand logo in header; optional editorial illustration only on a public welcome/empty state, not admin or simulator.

## 4. SCREEN-BY-SCREEN WIREFRAME CONTRACT

### 4.1 Public homepage `/`
Desktop viewport 1440x900 / content width ~1180:
1. Header height 64–72: small crisp SUARA logo, `Beranda`, `Forum`, `Simulasi` if working, `Jejak keputusan` and one login button or user menu. No oversized navbar buttons.
2. Hero 2 columns or editorial single column: left headline `Usulan warga, anggaran yang lebih adil.` with one 2-line description and `Jelajahi usulan`. Right can show a **single understated official budget summary**, not a hero illustration.
3. Most important feature is `Garis Pagu`: compare the two decision approaches using clear readable labels, `2 usulan / Rp290 juta` vs `4 usulan / Rp285 juta` when in official seed state. Explain that recommendation ≠ final approval.
4. Proposal ranking is a compact 4–7 row table/list with title, RW, score or popularity (correct labels), cost, explanation/status. Do not render 7 separate large cards.
5. Fairness methodology and public decision trail below; progressive disclosure to avoid overwhelm.
6. Official/sample data note displayed when fallback/demo is used.

### 4.2 Forum `/forum`
Top title + description + CTA for eligible residents; persistent filter row (status/RW/category) and search. Use 1-column clean list with title, RW/category, support count, discussion count, status. Avoid 3-wide card grids. Make each row keyboard accessible and use URL-backed filter state where the app already does so. Mobile filter control collapses into a drawer/sheet with clear Apply/Reset.

### 4.3 Proposal detail `/forum/[id]`
Readable article and context on the left (~70%), compact fact sheet and action on the right (~30%), stacked on mobile. Include urgency reason only when actually set, support controls under permissions, discussion chronology, and public decision timeline. Avoid a giant collection of status chips.

### 4.4 Proposal creation `/forum/usul`
Linear single-column form max 680px. Explicit field help, units for currency, in-place validation, retained draft, distinct `Periksa usulan serupa`, `Tinjau usulan`, `Kirim usulan` stages matching current functionality. AI semantic match results must label fallback correctly and not assert certainty.

### 4.5 Admin home `/admin`
A workplace, NOT a marketing homepage. Header `Ringkasan admin` + last verified data timestamp if available. One row of unboxed operational stats in small type, then main work queue `Usulan perlu ditinjau` as a table, and a narrow budget summary/shortcuts sidebar. No decorative hero, no generic “Selamat datang” cover occupying half screen. Every count links to the filtered operational task where possible.

### 4.6 Admin proposal review `/admin/usulan/[id]`
Clear proposal text, citizen context and evidence on left; action rail on right with urgency rubric grouped into four semantic categories 1–3, 4–6, 7–8, 9–10 and REQUIRED human-written reason. Show before/after impact preview. Distinguish `Masukkan ke hitungan`, `Kembalikan ke pembahasan`, and `Tidak dilanjutkan` using language consistent with current states. Prominent cancel/back; confirmation if destructive. Do not add AI urgency UI unless implemented.

### 4.7 Admin budget `/admin/anggaran`
Two-column layout: compact form area (pagu and weights, with exact integer total 100) and live read-only impact comparison. Official saved value vs unsaved draft clearly differentiated. Before saving, show changes in selected projects, remaining budget, and written reason. On concurrent version conflict, show latest server value next to draft and offer `Muat ulang nilai terbaru`. No silent overwrite.

### 4.8 Simulation `/simulasi` (SCREENSHOT REDESIGN PRIORITY)
The current screenshot is unacceptable. Build the following structure:

**Top region, NOT card:**
- Breadcrumb `Beranda / Simulasi anggaran`.
- H1 `Simulasikan pilihan anggaran` at 34px, short explanation.
- A low-key notice `Perubahan di halaman ini hanya simulasi. Anggaran resmi tidak berubah.`.

**Control region:**
- At desktop, a shallow full-width control bar or left 320px settings area with NO heavy outer border. Use 16px label, generous row spacing.
- Group 1: `Pagu simulasi` currency number input plus accessible range control if and only if a range actually helps. Include a concise `Kembali ke pagu resmi Rp300 juta` button. Preset scenario chips allowed but do not show more than 3 presets at once, and ensure `Rp750 juta` clearly reads as a non-official active simulation.
- Group 2: `Metode pemilihan` segmented control (`Rekomendasi SUARA` / `Suara terbanyak`).
- Group 3: scoring weight controls only when relevant to SUARA recommendation, integers sum exactly 100; show readable `30% / 40% / 30%`, with inline validation and a simple reset. Disable/hide irrelevant weight controls in voting mode, with a brief explanation.
- Prefer 1–2 concise controls per line. Do NOT put three nested panels, each with strong black strokes.

**Results region:**
- First row: one prominent result `Rp685 juta dari Rp750 juta` (when that genuinely is computed for the selected simulation) + one 1px horizontal progress track; secondary metrics `6 usulan terpilih`, `Rp65 juta sisa`, `3 RW tercakup` as unboxed typographic columns, not bordered statistic cards. All counts bound to computed state; do not hardcode screenshot values.
- Below: horizontal allocation visualization with 1 line per project OR a segmented budget bar. **NEVER render tiny project names inside narrow segments**. If using segments: color segments only, show project labels in an adjacent numbered legend/table and use accessible data labels. Display available remainder as neutral empty track, not unreadable diagonal hatching.
- Below: `Usulan terpilih` clean table/rows with `#`, title (max 2 lines), RW, score (where applicable), cost, status / “Lihat alasan”; keep line height readable. On desktop ~60–76px per row, NOT 120px bordered mini-cards. Add separate `Usulan tidak terpilih` disclosure with explicit reasons, to make the optimization transparent.
- When switching scenarios, update results without resetting the user's scroll or causing layout jumps. Show pending state subtle but visible. If the simulator is local-only, no save button. If working with official budget settings, the persistent save action must live only in admin.

Desktop sizing example: max width 1180, left control column 300–320, gap 40, results flexible minmax(0,1fr), avoid values stretching across 4 columns within an 800px area. At width 1280, keep numbers legible; at 1024, switch to stacked controls-above-results if needed.

### 4.9 `/keputusan`
If local code remains stub, retain an honest empty state and route; no fake approvals, fake signatures, or invented “Pimpinan” role. If work-in-progress exists, integrate only with verified backend states and permission logic.

## 5. SHNEIDERMAN'S EIGHT GOLDEN RULES — DESIGN + TEST CONTRACT

1. **Strive for consistency:** identical navigation labels, typography, spacing, badges/status labels, currency units, and action patterns across public, resident and admin. Use shared components and tokens; assert consistency in visual review.
2. **Enable frequent users to use shortcuts:** keyboard-focusable navigation, skip-to-content, searchable tables, persistent filter URLs, meaningful quick actions for admin, Esc closes dialog, Enter submits a valid focused form. Do not invent OS hotkeys that conflict with browsers.
3. **Offer informative feedback:** immediate support-count update, meaningful pending indicator for budget recalculation, inline field feedback, status plus date when relevant; show `Pratinjau diperbarui` after recomputation, no silent no-op.
4. **Design dialogs to yield closure:** completion states following submitted proposal, moderation, updated budget, or account creation. Confirm what happened and next step; don't only flash an anonymous toast.
5. **Prevent errors:** disabled invalid submit, limits on budgets, integer weights totalling 100, confirmation for dangerous actions, explain required admin reasons, enforce all validation on server too. Never silently change user numbers.
6. **Permit easy reversal of actions:** cancel dialogs, reset simulation to official settings, withdraw support where permitted, restore hidden content if authorized, preserve unsaved edits on recoverable error. Explicitly note irreversible actions where rules disallow undo.
7. **Support internal locus of control:** user chooses voting/recommendation scenario, controls sorting/filtering, can understand why changes occurred, never auto-submits or uses surprise redirects; admin sees impacts before saving.
8. **Reduce short-term memory load:** keep context adjacent to controls, compare before/after side by side, explain jargon in-place, make current official baseline continuously recognizable, use human-readable labels instead of requiring users to memorize color codes or values.

**WCAG:** target 2.2 AA; ≥4.5:1 normal text, visible keyboard focus, labels associated with inputs, 44px touch targets wherever practical, no horizontal overflow at 320/360/390 widths, prefers-reduced-motion support; respect keyboard/screen reader structure. Do not use color alone for meaning.

## 6. RESPONSIVE AND OVERFLOW REQUIREMENTS

Create and verify at: 320x700, 360x800, 390x844, 768x1024, 1024x768, 1280x800, 1440x900, and 1920x1080.
- No text collision, clipped numbers, overlapped controls, overflow, invisible button, or unintended horizontal scrolling.
- Desktop 3–4 KPIs should NOT compress at 1024; reduce columns or stack instead.
- Text nodes, grid children and flex children use `min-width: 0` where necessary.
- Proposal titles wrap gracefully; currencies display compactly in narrow table layouts.
- Table displays may convert to label/value row pairs on phones, but do NOT convert every row into a giant bordered card.
- On mobile, present simulator controls before results with an anchor jump to `Hasil simulasi`, use full-width tap-friendly buttons, and keep the official-vs-simulated distinction near top.

## 7. CODE QUALITY & SCOPE

Stay in the existing Next.js + React + TypeScript + CSS Modules architecture. Reuse tokens, extend design-system primitives minimally, and refactor visible JSX/CSS without rewriting validated business logic, SQL, RLS, session management, or migrations. Do not introduce a massive UI framework, unrelated component library, animation library, or a font CDN dependency unless essential and supported.

Use CSS grid/flexbox and semantic HTML, not fixed-pixel absolute layouts. Keep accessible headings, fieldsets/legends for grouped controls, table semantics for comparisons, and actual buttons for actions. Avoid nested clickable regions. Maintain route behavior and test IDs if existing tests use them.

Status and score handling must be semantically correct. In particular, do not confuse urgency (0–10) with final weighted score, and do not show recommendations as legally approved decisions. Keep simulation calculations deterministic and preserve exact algorithm outputs/tie-breaking.

Do not make a fake screenshot-only UI or leave inert buttons. Every visible action must either work or be honestly disabled with a reason.

## 8. EXECUTION SEQUENCE — DO NOT SKIP

**Phase A: Audit (before modifications)**
1. Inspect git status, local routes/files/changed components.
2. Produce a small feature/role matrix and source-of-truth list.
3. Identify screenshot flaws at pixel/layout level.
4. List proposed files to edit and features protected from regression.

**Phase B: Design tokens and component prototype**
1. Define typography scale, spacing, color, radius, border policy in CSS tokens.
2. Implement a real responsive version of the `/simulasi` page as the first reference screen if locally built; otherwise use home `/`.
3. Verify computed data and interactions still work.
4. Produce a before/after comparison and adjust spacing and density based on real viewport screenshots.

**Phase C: Roll out to roles**
1. Public and resident pages.
2. Admin workflow pages.
3. Preserve all auth/session boundaries and real state transitions.

**Phase D: Verification**
Run existing `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and E2E tests where configured (`npm run e2e`). If browser screenshot or Playwright inspection is available, capture screenshots at 1440x900, 1280x800, 390x844 and 320x700, manually inspect and fix. Also test keyboard flow and focus. Report failures rather than hiding or deleting tests.

## 9. VISUAL QA GATES — REJECT IF ANY FAIL

Reject the redesigned screen when:
- More than 2 major bordered rectangles dominate a viewport, or content is built as nested cards.
- Any KPI wraps, clips, or exceeds its column width.
- Chart labels are inside segments narrower than the text label.
- Headings, buttons and metrics do not align to a stable grid.
- The main screen displays fictional statistics, users, village names or activity items.
- A simulation scenario appears to be the actual official budget.
- Roles receive actions they are not authorized to perform.
- An action has no feedback, no validation, or no way out.
- Desktop looks acceptable but 360px mobile is broken.
- The output is “pretty” but impossible to implement because controls are fake.

## 10. RESPONSE FORMAT REQUIRED FROM YOU

Give the user, in order:
1. **Audit findings**: what exists in the real local app vs what is only planned; key differences from remote main.
2. **Before/after design rationale** with 5 concrete screenshot defects fixed.
3. **Exact design tokens** and typography table.
4. **Role navigation matrix** for visitor, warga and admin (NO fourth role).
5. **Changed files** and their purposes.
6. **Screenshots or viewport proof** for desktop and mobile, if browser execution is available.
7. **8 Golden Rules compliance matrix**, linking each rule to actual implementation and verification.
8. **Test results** (pass/fail/blocked), plus any remaining risks.

IMPORTANT: Do the UI implementation, not just a textual design essay, provided access to the repository and necessary tools. Start with the screenshot's `/simulasi` screen and do not modify underlying scoring logic to make mockups visually convenient. Do not claim “done” until validation. If you lack browser tooling, state that explicitly and provide runnable instructions for local visual QA.

### Final taste check
A professional product designer should be able to say: “This interface is quiet, intentional, readable, accountable, and unmistakably designed around the decision the user needs to make.” If the design relies on colored cards, decorative icons and thick borders to look interesting, redesign it again.
