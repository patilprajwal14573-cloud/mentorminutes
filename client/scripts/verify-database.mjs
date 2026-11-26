import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    const p = path.join(clientDir, file);
    if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return env;
}

const TABLES = [
  'profiles',
  'mentoring_relationships',
  'sessions',
  'mentor_private_notes',
  'goals',
  'milestones',
  'action_items',
  'action_item_session_links',
  'action_item_events',
  'notifications',
];

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const RPCS = [
  { name: 'preview_carry_forward', args: { p_relationship_id: ZERO_UUID } },
  {
    name: 'carry_forward_actions',
    args: { p_relationship_id: ZERO_UUID, p_new_session_id: ZERO_UUID, p_selected_action_ids: null },
  },
  {
    name: 'create_session_with_carry_forward',
    args: { p_relationship_id: ZERO_UUID },
  },
  { name: 'join_relationship_by_invite_code', args: { p_invite_code: 'MM-TEST00' } },
  {
    name: 'create_relationship_by_learner_email',
    args: { p_learner_email: 'test@example.com', p_topic: 'Test' },
  },
  { name: 'regenerate_mentor_invite_code', args: {} },
  { name: 'sync_due_reminders', args: {} },
];

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in client/.env');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let allPassed = true;

  console.log('Checking all 10 MentorMinutes tables & RLS...');
  for (const table of TABLES) {
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === 'PGRST205') {
      console.error(`❌ ${table}: MISSING (status ${status} - ${error.message})`);
      allPassed = false;
    } else if (error) {
      console.log(`✅ ${table}: EXISTS & RLS-protected for anon (status ${status} - ${error.code})`);
    } else if (Array.isArray(data) && data.length === 0) {
      console.log(`✅ ${table}: EXISTS & anonymous read returns 0 rows`);
    } else {
      console.warn(`⚠️  ${table}: EXISTS and returned ${data.length} row(s) anonymously — check RLS!`);
      allPassed = false;
    }
  }

  console.log('\nChecking all 7 MentorMinutes RPC functions & anonymous access restriction...');
  for (const rpc of RPCS) {
    const { error } = await supabase.rpc(rpc.name, rpc.args);
    if (error && error.code === 'PGRST202') {
      console.error(`❌ RPC ${rpc.name}: MISSING (${error.message})`);
      allPassed = false;
    } else if (error && (error.code === '42501' || /permission denied/i.test(error.message))) {
      console.log(
        `✅ RPC ${rpc.name}: EXISTS & properly blocks anonymous callers (${error.message})`
      );
    } else if (error) {
      console.warn(`⚠️  RPC ${rpc.name}: unexpected error (${error.code} - ${error.message})`);
      allPassed = false;
    } else {
      console.warn(`⚠️  RPC ${rpc.name}: succeeded anonymously — expected authenticated-only!`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    process.exit(1);
  }
  console.log('\n🎉 Database schema, RLS, and all 7 RPC checks passed!');
}

main();
