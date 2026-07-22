# Production Ready Steps

Run these SQL files in Supabase SQL Editor in this order after the existing setup:

1. `sql/94_EMP_ID_FIRST_LOGIN_PASSWORD.sql`
2. `sql/95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY.sql`
3. `sql/13_PRODUCTION_SECURITY_AND_ASSETS.sql`
4. `sql/14_LEGACY_RPC_ALIASES_FOR_REACT_APP.sql`
5. `sql/15_QUOTATION_SUPABASE_SCHEMA.sql`
6. `sql/16_FRONTEND_RPC_COMPLETION_AND_AUTH_HARDENING.sql`

Then verify:

1. Log in with an active `emp_id` and the current password.
2. First login with the provisioned temporary password must force password change.
3. User pages: home, news, mission, rewards, ranking, notifications, overall log.
4. Admin pages: dashboard, users, news, missions, rewards, ledger, manager departments, calendar.
5. Admin reset password must call `admin_reset_user_password` through the alias `admin_reset_password`.
6. Mission evidence/review and reward fulfillment RPCs return success.
7. Quotation creates Drive PDF/XLSX and mirrors normalized rows to `quotations`, `quotation_items`, `quotation_cost_notes`, and `quotation_files`.

Local commands:

```bash
npm.cmd run check
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173/
```

Notes:

- `src/helpers/api.ts` no longer falls back to mock data when Supabase URL/key are configured.
- Mock login accounts only work when Supabase config is missing or still contains placeholders.
- Browser direct table `select/insert/update` helpers in `public/app/assets/js/sbClient.js` are disabled. Use RPC only.
- Keep only publishable/anon Supabase keys in frontend files. Never put a `service_role` key in this project.
- Drive image uploads require the deployed Apps Script endpoint in the canonical `public/app/assets/js/sbConfig.js`.
- Passwordless first setup is disabled; every new account must receive a temporary credential from an admin or trusted provisioning job.
- Quotation binaries remain in Google Drive; Supabase stores normalized metadata only and does not require a Storage bucket.
