# Skill sources

Installed for Claude Code on 2026-10-08. Each folder is a vendored copy; update by re-fetching from the source and re-applying the local change noted below.

| Folder | Source | Notes |
|---|---|---|
| `impeccable/` | `pbakaus/impeccable` 4.3.1 (copied from `.agents/skills/impeccable`) | `scripts/bin/` omitted (15 MB Windows exe); the launcher downloads its binary, and Codex's copy keeps the exe. |
| `taste-skill/` | `Leonxlnx/taste-skill` → `skills/taste-skill/SKILL.md` (main) | Skill name inside the file: `design-taste-frontend`. |
| `redesign-skill/` | `Leonxlnx/taste-skill` → `skills/redesign-skill/SKILL.md` (main) | Same repository as taste-skill; covers redesigns of existing apps. |
| `ui-ux-pro-max/` | `nextlevelbuilder/ui-ux-pro-max-skill` (main): `.claude/skills/ui-ux-pro-max/{SKILL.md,references}`, `src/ui-ux-pro-max/{scripts,data}` | Local change: script paths in SKILL.md point to `.claude/skills/ui-ux-pro-max/scripts/search.py` instead of `${CLAUDE_PLUGIN_ROOT}`. Python 3, stdlib only. |
| `humanizer/` | `blader/humanizer` → `SKILL.md` (main) | MIT. |
| `stop-slop/` | `hardikpandya/stop-slop` (copied from `.agents/skills/stop-slop`) | |
| `animate/`, `animation-vocabulary/`, `apple-design/`, `emil-design-eng/`, `find-animation-opportunities/`, `improve-animations/`, `review-animations/`, `break-ui/`, `pick-ui-library/`, `prototype/` | `emilkowalski/skills` → `skills/<name>/` (main, MIT) | Newer than the `.agents/skills` copies. Not installed: `animate-expo`, `mobile-native`, `write-swift` (native platforms), `ask-sonner` (the app has its own toast). |

Project-specific configuration for all of them lives in the root `CLAUDE.md` (Skills section).
