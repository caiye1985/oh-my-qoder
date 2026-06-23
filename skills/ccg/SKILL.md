---
name: ccg
description: Qoder-Codex-Gemini tri-model orchestration via /ask codex + /ask antigravity (or gemini), then Qoder synthesizes results
level: 5
---

# CCG - Qoder-Codex-Gemini Tri-Model Orchestration

CCG routes through the canonical `/ask` skill (`/ask codex` + `/ask antigravity`), then Qoder synthesizes both outputs into one answer.

Use this when you want parallel external perspectives without launching tmux team workers.

## When to Use

- Backend/analysis + frontend/UI work in one request
- Code review from multiple perspectives (architecture + design/UX)
- Cross-validation where Codex and Antigravity/Gemini may disagree
- Fast advisor-style parallel input without team runtime orchestration

## Requirements

- **Codex CLI**: `npm install -g @openai/codex` (or `@openai/codex`)
- **Antigravity CLI** (Google's successor to the Gemini CLI): install the `agy` binary
  per the [official Antigravity instructions](https://antigravity.google) (inspect any
  installer before running it). Verify: `agy --version`
- **Gemini CLI** remains supported for enterprise/API-key use cases: `npm install -g @google/gemini-cli`
- `omq ask` command available
- If either CLI is unavailable, continue with whichever provider is available and note the limitation

## How It Works

```text
1. Qoder decomposes the request into two advisor prompts:
   - Codex prompt (analysis/architecture/backend)
   - Antigravity prompt (UX/design/docs/alternatives) — use gemini for enterprise

2. Qoder runs via CLI (skill nesting not supported):
   - `omq ask codex "<codex prompt>"`
   - `omq ask antigravity "<antigravity prompt>"`
     (or `omq ask gemini "<gemini prompt>"` for enterprise)

3. Artifacts are written under `.omc/artifacts/ask/`

4. Qoder synthesizes both outputs into one final response
```

## Execution Protocol

When invoked, Qoder MUST follow this workflow:

### 1. Decompose Request
Split the user request into:

- **Codex prompt:** architecture, correctness, backend, risks, test strategy
- **Antigravity prompt:** UX/content clarity, alternatives, edge-case usability, docs polish
- **Synthesis plan:** how to reconcile conflicts

### 2. Invoke advisors via CLI

> **Note:** Skill nesting (invoking a skill from within an active skill) is not supported in Qoder. Always use the direct CLI path via Bash tool.

Run both advisors (use antigravity or gemini depending on your setup):

```bash
omq ask codex "<codex prompt>"
omq ask antigravity "<antigravity prompt>"
```

Enterprise fallback:

```bash
omq ask gemini "<gemini prompt>"
```

### 3. Collect artifacts

Read latest ask artifacts from:

```text
.omc/artifacts/ask/codex-*.md
.omc/artifacts/ask/antigravity-*.md
.omc/artifacts/ask/gemini-*.md
```

### 4. Synthesize

Return one unified answer with:

- Agreed recommendations
- Conflicting recommendations (explicitly called out)
- Chosen final direction + rationale
- Action checklist

## Fallbacks

If one provider is unavailable:

- Continue with available provider + Qoder synthesis
- Clearly note missing perspective and risk

If both unavailable:

- Fall back to Qoder-only answer and state CCG external advisors were unavailable

## Invocation

```bash
/oh-my-qoder:ccg <task description>
```

Example:

```bash
/oh-my-qoder:ccg Review this PR - architecture/security via Codex and UX/readability via Antigravity
```
