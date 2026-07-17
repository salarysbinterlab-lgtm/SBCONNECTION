# CodeRabbit Review Guide

## Role

CodeRabbit is the pull request reviewer. It should not replace local testing, but it should catch risks before changes reach `main` and deploy to Cloudflare.

## Review Priorities

1. Production safety
2. Supabase RLS and role security
3. Android PWA rendering and install/update behavior
4. Cloudflare/GitHub Actions deploy correctness
5. Broken asset paths, missing files, and cache issues
6. Accidental secrets or destructive SQL

## Repository-Specific Concerns

- `main` is production deployment.
- `public/icons/**` contains visual assets used by installed PWA metadata and mobile navigation.
- `public/sw.js` controls installed app updates.
- `public/manifest.webmanifest` controls install card, splash, and icon behavior.
- `src/components/UserDashboard.tsx` is large and user-facing; review mobile behavior carefully.
- SQL reset files are dev-only and must not be mistaken for production migrations.

## Comment Style

- Prioritize actionable issues over style preferences.
- Use Thai when possible, with code identifiers in English.
- For risky production changes, request changes.
- For visual/mobile changes, mention likely Android rendering risks clearly.

