# AI Agent Workflow

## Goal

Use Codex, Claude, and CodeRabbit together without letting production become chaotic.

## Recommended Flow

1. Plan or discuss with Claude when the feature is unclear.
2. Implement locally with Codex.
3. Build locally with `npm.cmd run build`.
4. Push a feature branch.
5. Open a pull request to `main`.
6. Let CodeRabbit review the PR.
7. Fix actionable comments with Codex.
8. Merge to `main`.
9. GitHub Actions deploys to Cloudflare.
10. Users reopen the installed app and receive the updated PWA.

## Fast Flow

Use this only for small approved changes:

```powershell
cd D:\Projectsbconnect_app
npm.cmd run build
git add .
git commit -m "Update app"
git push origin main
```

## Safe Branch Flow

Use this for bigger feature changes:

```powershell
cd D:\Projectsbconnect_app
git checkout -b codex/update-feature
npm.cmd run build
git add .
git commit -m "Update feature"
git push origin codex/update-feature
```

Then open a PR on GitHub and let CodeRabbit review before merging.

## Which Agent Does What

Codex:

- Edit repo files
- Run builds
- Commit and push
- Fix CodeRabbit comments
- Keep release flow working

Claude:

- Think through UX, architecture, and risks
- Draft specs and admin/user/dev workflows
- Review complex SQL or product decisions before implementation

CodeRabbit:

- Review PR diffs
- Flag security, deploy, mobile, and data-integrity risks
- Summarize PRs
- Provide AI-agent prompts for follow-up fixes

## Production Rules

- Never commit secrets.
- Never rely only on client-side role checks for admin/security.
- Treat `main` as production.
- Test mobile PWA behavior after visual/layout changes.
- Keep heavy visual effects away from fixed/sticky mobile layers.
- SQL reset/drop/truncate scripts must stay clearly dev-only.

