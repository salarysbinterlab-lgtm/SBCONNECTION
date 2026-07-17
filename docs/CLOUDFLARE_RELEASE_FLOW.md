# SB Connect Release Flow

## Big Picture

1. Dev edits the project in this repo.
2. Dev tests locally with `npm.cmd run dev`.
3. Dev builds production files with `npm.cmd run build`.
4. Dev pushes to GitHub `main`.
5. GitHub Actions deploys `dist/` to Cloudflare.
6. Users open the same installed mobile app link.
7. The service worker checks for updates and refreshes the app when a new version is available.
8. Supabase stores app data and enforces access by role.

## One-Time Cloudflare Setup

Create a Cloudflare API token:

- Use the Cloudflare account that owns the Worker/project.
- Token permissions:
  - Account: `Cloudflare Workers Scripts:Edit`
  - Account: `Workers Tail:Read` is optional
  - Account: `Account Settings:Read`
  - Zone permissions are not required unless you also attach a custom domain.

Add GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

GitHub path:

```text
Repo > Settings > Secrets and variables > Actions > New repository secret
```

## Manual Deploy From This Machine

```powershell
cd D:\Projectsbconnect_app
npm.cmd run build
$env:CLOUDFLARE_API_TOKEN="paste_token_here"
$env:CLOUDFLARE_ACCOUNT_ID="paste_account_id_here"
$env:XDG_CONFIG_HOME="D:\Projectsbconnect_app\.wrangler-config"
npm.cmd run deploy:cloudflare
```

## Normal Update Flow

```powershell
cd D:\Projectsbconnect_app
npm.cmd run build
git status
git add .
git commit -m "Update app"
git push
```

After `git push`, GitHub Actions runs:

```text
npm ci -> npm run build -> wrangler deploy
```

## Mobile Install

Android Chrome:

1. Open the Cloudflare app URL.
2. Tap the menu.
3. Tap `Add to Home screen` or `Install app`.

iPhone Safari:

1. Open the Cloudflare app URL.
2. Tap Share.
3. Tap `Add to Home Screen`.

## Roles

- `dev`: edits code, database schema, CI, and release process.
- `admin`: manages app data inside the app according to role policies.
- `user`: uses the installed app.
- Supabase RLS and RPC functions enforce data access.
- Cloudflare only hosts the frontend; it should not store business data.

## Text And Storage

Text-heavy app data should live in Supabase tables, not in the frontend bundle. The frontend should store only UI code, images, icons, and safe public config.

For large content:

- News, missions, rewards, FAQs, logs: Supabase tables.
- Images and files: Supabase Storage, Google Drive/App Script, or Cloudflare R2 later.
- App code: GitHub plus Cloudflare deployment.

This keeps the mobile app lightweight and avoids worrying that frontend text storage will fill up.
