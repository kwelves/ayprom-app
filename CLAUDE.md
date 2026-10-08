# AYPROM — notes for Claude Code

Local Windows desktop app (Electron 44 + React 19 + Sharp) for batch product-photo processing. Product truth: `PRODUCT.md`. Visual system: `DESIGN.md` (decisions) and `src/renderer/styles/tokens.css` (values). UI copy is Russian.

## Commands

```bash
npm run typecheck      # tsc --noEmit
npm test               # node:test via tsx, 67+ tests
npm run build          # esbuild main/preload/worker + vite renderer
npx prettier --check "src/**/*.{ts,tsx,css}"
node scripts/qa.mjs    # Electron end-to-end (needs the Electron binary; Windows CI)
```

Renderer-only checks in a container without Electron: build with `npx vite build`, serve `dist/renderer`, inject a mock `window.ayprom` (see `DesktopAPI` in `src/shared/contracts.ts`) and drive it with Playwright. Chromium lives at `/opt/pw-browsers`.

## Renderer map

- `src/renderer/App.tsx` — state, IPC calls, keyboard shortcuts (Ctrl+1/2/3, Ctrl+O, Ctrl+Enter).
- `components/` — TitleBar, Queue, Preview (stage), PresetControls, ProcessingControls, ExportControls, ProcessDock, ResultSheet, HistoryView, UpdateNotice.
- `ui/` — design-system primitives: `Segmented`, `Digits`/`CountUp`, `Meter`, `motion.ts` presets, `format.ts`.
- `styles/` — `tokens.css` → `base.css` (reset, controls) → `app.css` (shell, components).

## Contracts that tests and QA scripts rely on

Keep these accessible names and texts when changing UI: heading «Пакетная обработка», `.app-version` containing «Версия x.y.z», theme radios «Системная/Светлая/Тёмная тема», buttons «Добавить», «Выбрать папку результата», «Запустить обработку», «Остановить», «Новая очередь», «Предпросмотр <name>», «Убрать <name>», «Переименовать»; titles «Создать пресет с текущими настройками», «Дублировать», «Сохранить изменения», «Сбросить к сохранённым значениям»; labels «Пресет», «<field>: значение»; alt «После обработки»; text «Полное качество»; `.history-counts` («N готово»); exactly one `.dropzone`. `tests/update-view.test.ts` renders `UpdateNotice` and matches `>Скачать<` and `disabled=""`.

## Hard rules

- CSP is `default-src 'self'`: no CDN fonts or scripts, no inline `data:` assets (`vite.config.ts` sets `assetsInlineLimit: 0`). Fonts come from `@fontsource*` packages.
- Components read semantic tokens only. No raw hex outside `tokens.css` (main-process window chrome colors mirror `--bg-chrome`).
- Brand accent is AYPROM Cobalt `#053C95` (from `assets/app-icon.png`). Do not reintroduce the old teal.
- Every animation has a reduced-motion path (`MotionConfig reducedMotion="user"` + the CSS media query).
- Processing, preview, presets, persistence, cancellation and file safety must behave exactly as before any UI change.

## Skills (`.claude/skills/`)

| Skill | Use it for | AYPROM configuration |
|---|---|---|
| `impeccable` | Any UI design, redesign, critique, audit, polish, animate | Mode is **Operate**. Context = `PRODUCT.md` + `DESIGN.md`. Read `reference/craft-floor.md` before UI edits. The `scripts/impeccable` launcher downloads a binary on first run; if it is unavailable, read PRODUCT.md/DESIGN.md directly (the skill's documented fallback). On Windows use `.agents/skills/impeccable/scripts/impeccable.cmd`, which ships the exe. |
| `taste-skill` | Anti-template check on visual decisions | Brief is a dense desktop tool: variance low, density high, motion medium. Its landing-page rules do not apply. |
| `redesign-skill` | Auditing an existing screen before changing it | Preserve every contract listed above. |
| `ui-ux-pro-max` | Focused UX/a11y/motion lookups | Stack is `react`; run `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux` (or `--stack react`). The persisted system is `design-system/ayprom/MASTER.md`; do not regenerate it with `--force` — the generic generator suggests violet/Poppins, which the brand overrides. |
| `humanizer` | Rewriting user-facing copy, release notes, docs | Russian UI copy: short, names the action, errors name the recovery. |
| `stop-slop` | Final pass on any prose (PRs, docs, notes) | Same as above; keep technical terms. |

### Emil Kowalski skills (motion and craft)

These set the motion bar for AYPROM. Any change that touches animation goes through `review-animations` before it ships.

| Skill | Use it for | AYPROM configuration |
|---|---|---|
| `emil-design-eng` | Polish and component decisions, the "invisible details" | Personality is a crisp professional tool: no bounce, no decorative loops. |
| `review-animations` | Mandatory review of every motion diff (invoke explicitly: it has `disable-model-invocation`) | Standards are law here: UI motion < 300 ms, strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, never `scale(0)`, full `transform` strings in `motion` props, no animation on keyboard/high-frequency actions (mode switch, live counters). |
| `animate` | Building a new animation from scratch | Use presets in `src/renderer/ui/motion.ts`; CSS for predetermined motion, `motion` for presence/layout. |
| `improve-animations` | Periodic motion audit with plans | Plans go to `plans/` (see `plans/001-*`, `plans/002-*`). |
| `find-animation-opportunities` | Spotting missing feedback | Read-only; reject anything high-frequency. |
| `animation-vocabulary` | Naming an effect precisely before searching motion.dev / 21st.dev | — |
| `apple-design` | Springs, materials, interruptible transitions | Springs use `{ type: "spring", duration, bounce: 0–0.06 }`. |
| `break-ui` | Stress-testing screens with worst-case data | Realistic AYPROM worst cases: UNC paths `\\NAS\…`, 60-char folder names without spaces, 12 480 photos, exactly 1 photo, 0 photos with EPERM error, 80-char preset name (schema max), 40+ sources. Toggle stays dev-only. |
| `pick-ui-library` | Choosing a library for a new need | Respect the CSP ('self' only) and the existing stack before adding a dependency. |
| `prototype` | Several live variants of one UI piece | Dev-only, never shipped. |

Codex keeps its own copies under `.agents/skills/`; `.claude/skills/` is what Claude Code loads. Sources and versions: `.claude/skills/SOURCES.md`.

## Design references

Use these when looking for motion, icon or component patterns. Adapt patterns to this stack (React + plain CSS tokens + `motion`); do not paste shadcn/Tailwind components as-is.

| Site | What it is good for here |
|---|---|
| [motion.dev](https://motion.dev) | The animation library in use (`motion/react`): presence, layout, springs, `animate()`. Docs first. |
| [withanimation.app](https://withanimation.app) | Interaction and animation recipes; timing and easing references. |
| [ssgoi.dev](https://ssgoi.dev) | Page/view transition patterns; ideas for workspace switches. |
| [21st.dev](https://21st.dev) | Component catalogue (also available as the `21st_dev` MCP server: `search`, then `get_component`). Used as reference for the segmented control, digit roll and dropzone. |
| [kokonutui.com](https://kokonutui.com) | Polished React/Tailwind components and micro-interactions to borrow patterns from. |
| [animejs.com](https://animejs.com) (anime.js) | Timeline/stagger/SVG line drawing. Only if `motion` cannot express an effect; do not add both for the same job. |
| [iconly.pro](https://iconly.pro) | Icon sets. The app uses Lucide; switching sets means replacing every icon at once, never mixing. |
