---
name: omc-reference
description: OMC agent catalog, available tools, team pipeline routing, commit protocol, and skills registry. Auto-loads when delegating to agents, using OMC tools, orchestrating teams, making commits, or invoking skills.
user-invocable: false
---

# OMC Reference

Use this built-in reference when you need detailed OMC catalog information that does not need to live in every `AGENTS.md` session.

## Agent Catalog

Prefix: `oh-my-qoder:`. See `agents/*.md` for full prompts.

- `explore` (efficient) — fast codebase search and mapping
- `analyst` (performance) — requirements clarity and hidden constraints
- `planner` (performance) — sequencing and execution plans
- `architect` (performance) — system design, boundaries, and long-horizon tradeoffs
- `debugger` (auto) — root-cause analysis and failure diagnosis
- `executor` (auto) — implementation and refactoring
- `verifier` (auto) — completion evidence and validation
- `tracer` (auto) — trace gathering and evidence capture
- `security-reviewer` (auto) — trust boundaries and vulnerabilities
- `code-reviewer` (performance) — comprehensive code review
- `test-engineer` (auto) — testing strategy and regression coverage
- `designer` (auto) — UX and interaction design
- `writer` (efficient) — documentation and concise content work
- `qa-tester` (auto) — runtime/manual validation
- `scientist` (auto) — data analysis and statistical reasoning
- `document-specialist` (auto) — SDK/API/framework documentation lookup
- `git-master` (auto) — commit strategy and history hygiene
- `code-simplifier` (performance) — behavior-preserving simplification
- `critic` (performance) — plan/design challenge and review

## Model Routing

- `efficient` — quick lookups, lightweight inspection, narrow docs work
- `auto` — standard implementation, debugging, and review
- `performance` — architecture, deep analysis, consensus planning, and high-risk review

## Tools Reference

### External AI / orchestration
- `/team N:executor "task"`
- `omq team N:codex|gemini|antigravity "..."`
- `omq ask <qoder|codex|gemini|antigravity>`
- `/ccg`

### OMC state
- `state_read`, `state_write`, `state_clear`, `state_list_active`, `state_get_status`

### Team orchestration
- Qoder 2.1.178+ uses one implicit agent team per session. Spawn teammates directly with Agent/Task using distinct `name` values; do not call removed `TeamCreate`/`TeamDelete` tools or rely on `team_name` for native routing.
- Use TodoWrite or the available task-list surface for tracking only. Task-list tools do not create native teams.
- Legacy OMC tmux/CLI teams are separate: use `/team` or `omq team` plus OMC state/API commands for external worker runs.

### Notepad
- `notepad_read`, `notepad_write_priority`, `notepad_write_working`, `notepad_write_manual`

### Project memory
- `project_memory_read`, `project_memory_write`, `project_memory_add_note`, `project_memory_add_directive`

### Code intelligence
- LSP: `lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_diagnostics`, and related helpers
- AST: `ast_grep_search`, `ast_grep_replace`
- Utility: `python_repl`

## Skills Registry

Invoke built-in workflows via `/oh-my-qoder:<name>`.

### Workflow skills
- `autopilot` — full autonomous execution from idea to working code
- `ralph` — persistence loop until completion with verification
- `ultrawork` — high-throughput parallel execution
- `visual-verdict` — structured visual QA verdicts
- `team` — coordinated team orchestration
- `ccg` — Codex + Gemini + Qoder synthesis lane
- `ultraqa` — QA cycle: test, verify, fix, repeat
- `omc-plan` — planning workflow and `/plan`-safe alias
- `ralplan` — consensus planning workflow
- `sciomc` — science/research workflow
- `external-context` — external docs/research workflow
- `deepinit` — hierarchical AGENTS.md generation
- `deep-interview` — Socratic ambiguity-gated requirements workflow
- `ai-slop-cleaner` — regression-safe cleanup workflow

### Utility skills
- `ask`, `cancel`, `note`, `skillify`, `learner` (deprecated alias), `omc-setup`, `mcp-setup`, `hud`, `omc-doctor`, `trace`, `release`, `project-session-manager`, `skill`, `writer-memory`, `configure-notifications`

### Keyword triggers kept compact in AGENTS.md
- `"autopilot"→autopilot`
- `"ralph"→ralph`
- `"ulw"→ultrawork`
- `"ccg"→ccg`
- `"ralplan"→ralplan`
- `"deep interview"→deep-interview`
- `"deslop" / "anti-slop"→ai-slop-cleaner`
- `"deep-analyze"→analysis mode`
- `"tdd"→TDD mode`
- `"deepsearch"→codebase search`
- `"ultrathink"→deep reasoning`
- `"cancelomc"→cancel`
- Team orchestration is explicit via `/team`.

## Team Pipeline

Stages: `team-plan` → `team-prd` → `team-exec` → `team-verify` → `team-fix` (loop).

- Use `team-fix` for bounded remediation loops.
- `team ralph` links the team pipeline with Ralph-style sequential verification.
- Prefer team mode when independent parallel lanes justify the coordination overhead.

## Commit Protocol

Use git trailers to preserve decision context in every commit message.

### Format
- Intent line first: why the change was made
- Optional body with context and rationale
- Structured trailers when applicable

### Common trailers
- `Constraint:` active constraint shaping the decision
- `Rejected:` alternative considered | reason for rejection
- `Directive:` forward-looking warning or instruction
- `Confidence:` `high` | `medium` | `low`
- `Scope-risk:` `narrow` | `moderate` | `broad`
- `Not-tested:` known verification gap

### Example
```text
feat(docs): reduce always-loaded OMC instruction footprint

Move reference-only orchestration content into a native Qoder skill so
session-start guidance stays small while detailed OMC reference remains available.

Constraint: Preserve AGENTS.md marker-based installation flow
Rejected: Sync all built-in skills in legacy install | broader behavior change than issue requires
Confidence: high
Scope-risk: narrow
Not-tested: End-to-end plugin marketplace install in a fresh Qoder profile
```
