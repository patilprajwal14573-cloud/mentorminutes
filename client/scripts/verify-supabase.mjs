import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, '..');

function loadEnvFiles() {
  const env = {};
  const candidates = ['.env', '.env.local', '.env.development', '.env.development.local'];

  for (const file of candidates) {
    const fullPath = path.join(clientDir, file);
    if (!fs.existsSync(fullPath)) continue;

    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  return env;
}

function decodeJwtRole(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const env = loadEnvFiles();
  const url = (env.VITE_SUPABASE_URL || '').trim();
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

  if (!url || url.includes('your-project-id')) {
    console.error('❌ VITE_SUPABASE_URL is missing or still has the placeholder value in client/.env');
    process.exit(1);
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.error(`❌ VITE_SUPABASE_URL does not look like a valid Supabase HTTPS URL: ${url}`);
    process.exit(1);
  }

  if (!key || key.includes('your-supabase-publishable-key')) {
    console.error(
      '❌ VITE_SUPABASE_PUBLISHABLE_KEY is missing or still has the placeholder value in client/.env'
    );
    process.exit(1);
  }

  // Security check: ensure secret / service_role key was NOT accidentally pasted into frontend env
  if (key.startsWith('sb_secret_') || decodeJwtRole(key) === 'service_role') {
    console.error(
      '🚨 SECURITY ERROR: You pasted a secret / service_role key into VITE_SUPABASE_PUBLISHABLE_KEY!'
    );
    console.error(
      '   Replace it immediately with the Publishable key (starts with sb_publishable_... or anon key).'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  try {
    const { error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('❌ Supabase SDK session check failed:', sessionError.message);
      process.exit(1);
    }

    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
    });

    if (!res.ok) {
      console.error(`❌ Supabase Auth endpoint returned HTTP ${res.status}. Check your URL and key.`);
      process.exit(1);
    }

    const settings = await res.json();
    console.log('✅ Supabase connection verified!');
    console.log(`   Project URL: ${url}`);
    console.log(
      `   Email Auth enabled: ${Boolean(settings?.external?.email)} | Signup disabled: ${Boolean(settings?.disable_signup)}`
    );
  } catch (err) {
    console.error('❌ Failed to reach Supabase:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
