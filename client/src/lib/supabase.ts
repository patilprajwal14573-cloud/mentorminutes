import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

const looksLikePlaceholder = (value: string) =>
  !value ||
  value.includes('your-project-id') ||
  value.includes('your-supabase-publishable-key');

export const isSupabaseConfigured =
  !looksLikePlaceholder(supabaseUrl) &&
  !looksLikePlaceholder(supabasePublishableKey) &&
  supabaseUrl.startsWith('https://');

let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabaseInstance = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = supabaseInstance;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to client/.env.'
    );
  }
  return supabaseInstance;
}

export interface SupabaseConnectionResult {
  ok: boolean;
  configured: boolean;
  url: string;
  message: string;
}

/**
 * Verifies that the frontend can reach the configured Supabase project's Auth service.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionResult> {
  if (!isSupabaseConfigured || !supabaseInstance) {
    return {
      ok: false,
      configured: false,
      url: supabaseUrl,
      message:
        'Missing or placeholder VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.',
    };
  }

  try {
    const { error } = await supabaseInstance.auth.getSession();
    if (error) {
      return {
        ok: false,
        configured: true,
        url: supabaseUrl,
        message: `Supabase responded with an error: ${error.message}`,
      };
    }

    // Verify project endpoint & publishable key against Auth health/settings endpoint
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabasePublishableKey,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        url: supabaseUrl,
        message: `Supabase Auth endpoint returned HTTP ${response.status}. Check your URL and publishable key.`,
      };
    }

    return {
      ok: true,
      configured: true,
      url: supabaseUrl,
      message: 'Connected to Supabase successfully.',
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      url: supabaseUrl,
      message: err instanceof Error ? err.message : 'Network error connecting to Supabase.',
    };
  }
}
