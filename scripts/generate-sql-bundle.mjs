import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sqlDir = join(projectRoot, 'sql');
const output = join(sqlDir, 'sbconnect_FINAL_all_in_one.sql');
const migrations = [
  '01_extensions.sql',
  '02_types.sql',
  '03_core_schema.sql',
  '04_content_schema.sql',
  '05_points_rewards_schema.sql',
  '06_chat_notifications_schema.sql',
  '07_it_requests_schema.sql',
  '08_views.sql',
  '09_functions_triggers.sql',
  '10_rls_policies.sql',
  '11_public_session_rpc_FINAL.sql',
  '90_seed_app_settings.sql',
  '91_seed_from_xlsx_FIXED_V3_empid_normalized.sql',
  '92_post_seed_fixes.sql',
  '94_EMP_ID_FIRST_LOGIN_PASSWORD.sql',
  '95_ADMIN_ACCOUNTS_SPECIAL_POINTS_ACTIVITY.sql',
  '13_PRODUCTION_SECURITY_AND_ASSETS.sql',
  '14_LEGACY_RPC_ALIASES_FOR_REACT_APP.sql',
  '15_QUOTATION_SUPABASE_SCHEMA.sql',
  '16_FRONTEND_RPC_COMPLETION_AND_AUTH_HARDENING.sql',
];

const sections = await Promise.all(migrations.map(async (name) => {
  const body = (await readFile(join(sqlDir, name), 'utf8')).trim();
  return `\n\n-- =========================================================\n-- ${name}\n-- =========================================================\n\n${body}\n`;
}));

const header = `-- GENERATED FILE: do not edit directly.\n-- Run \`npm run sql:bundle\` after changing a migration.\n-- Production-safe bundle for a blank database; destructive reset and DEV bootstrap are excluded.\n`;
await writeFile(output, header + sections.join(''), 'utf8');
console.log(`Generated ${output} from ${migrations.length} migrations.`);
