# Claude Agent Guide

## Best Use

Use Claude for architecture thinking, long-form analysis, implementation alternatives, copywriting, and risk review before code changes.

Claude should help answer:

- Is this feature flow correct for employee/admin/dev use?
- Is there a simpler UX for mobile users?
- What are the risks of this SQL/RLS design?
- What should CodeRabbit/Codex pay attention to in a PR?

## Context To Read First

- `docs/AI_AGENT_WORKFLOW.md`
- `docs/CLOUDFLARE_RELEASE_FLOW.md`
- `docs/PRODUCTION_READY_STEPS.md`
- `.coderabbit.yaml`

## Boundaries

- Do not suggest storing secrets in frontend code.
- Do not suggest bypassing Supabase RLS from the client.
- Do not assume desktop behavior proves Android PWA behavior is safe.
- Prefer precise implementation notes that Codex can apply.

