# Codex Agent Guide

## Role

Codex is the hands-on implementation agent for this repository. Codex may edit files, run builds, commit, and push when the user explicitly asks or approves.

## Project

SB Connect is a production PWA for employees.

- Frontend: React, Vite, Tailwind
- Hosting: Cloudflare Workers Static Assets
- Data/backend: Supabase SQL, RLS, RPC functions
- Release: GitHub `main` deploys to Cloudflare through GitHub Actions
- Main user roles: `user`, `admin`, `admin_it`, `dev`

## Operating Rules

- Run `npm.cmd run build` before committing frontend or deployment changes.
- Do not commit `.env`, tokens, API secrets, or local config folders.
- Prefer feature branches and pull requests for larger changes so CodeRabbit can review before production deploy.
- Direct `main` pushes are acceptable only for small user-approved changes.
- Keep mobile Android performance in mind: avoid heavy `backdrop-filter`, fixed masked layers, oversized media, and overlapping text.
- Preserve Supabase security: RLS, role checks, and `security_invoker` views matter.

## Standard Commands

```powershell
cd D:\Projectsbconnect_app
npm.cmd run build
git status
git add .
git commit -m "Describe change"
git push origin main
```

## Safer PR Flow

```powershell
cd D:\Projectsbconnect_app
git checkout -b codex/update-feature
npm.cmd run build
git add .
git commit -m "Update feature"
git push origin codex/update-feature
```

Then open a pull request into `main` and wait for CodeRabbit review.

