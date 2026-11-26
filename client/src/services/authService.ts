import { getSupabaseClient } from '../lib/supabase';
import { User, UserRole, UserSettings } from '../types';

export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  bio: string;
  avatar: string;
  company_or_school: string;
  expertise: string[];
  interests: string[];
  invite_code: string | null;
  settings: Partial<UserSettings> | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  title?: string;
  bio?: string;
  avatar?: string;
  companyOrSchool?: string;
  expertise?: string[];
  interests?: string[];
  settings?: UserSettings;
}

export const PENDING_INVITE_STORAGE_KEY = 'mentorminutes_pending_invite';

export function setPendingInviteCode(code: string): void {
  const cleaned = code.trim().toUpperCase();
  if (cleaned) {
    localStorage.setItem(PENDING_INVITE_STORAGE_KEY, cleaned);
  }
}

export function getPendingInviteCode(): string | null {
  const value = localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
  return value ? value.trim().toUpperCase() : null;
}

export function clearPendingInviteCode(): void {
  localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
}

export function mapProfileToUser(row: ProfileRow): User {
  return {
    id: row.id,
    _id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    title: row.title || '',
    bio: row.bio || '',
    avatar: row.avatar || '',
    companyOrSchool: row.company_or_school || '',
    expertise: Array.isArray(row.expertise) ? row.expertise : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    inviteCode: row.invite_code ?? undefined,
    settings: {
      emailNotifications: row.settings?.emailNotifications ?? true,
      sessionReminders: row.settings?.sessionReminders ?? true,
      theme: row.settings?.theme ?? 'light',
    },
    createdAt: row.created_at,
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches a user's profile from public.profiles, with a brief retry in case the
 * auth.users trigger is still committing right after signup.
 */
export async function fetchProfileById(userId: string, retries = 3): Promise<User | null> {
  const supabase = getSupabaseClient();

  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Failed to load user profile');
    }

    if (data) {
      return mapProfileToUser(data as ProfileRow);
    }

    if (attempt < retries - 1) {
      await wait(250);
    }
  }

  return null;
}

/**
 * Fallback if an auth user exists without a profile row (for example, created
 * prior to running the trigger migration).
 */
export async function ensureProfileFromAuthUser(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<User | null> {
  const existing = await fetchProfileById(authUser.id, 3);
  if (existing) return existing;

  const supabase = getSupabaseClient();
  const meta = authUser.user_metadata || {};
  const rawRole = typeof meta.role === 'string' ? meta.role.trim().toLowerCase() : 'learner';
  const role: UserRole = rawRole === 'mentor' ? 'mentor' : 'learner';
  const name =
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (authUser.email ? authUser.email.split('@')[0] : 'User');

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: authUser.id,
      email: (authUser.email || '').toLowerCase(),
      name,
      role,
      title: typeof meta.title === 'string' ? meta.title.trim() : '',
      company_or_school:
        typeof meta.companyOrSchool === 'string' ? meta.companyOrSchool.trim() : '',
    })
    .select('*')
    .single();

  if (error) {
    // Retry read in case the auth trigger raced with the fallback insert
    const raced = await fetchProfileById(authUser.id, 1);
    if (raced) return raced;
    throw new Error(error.message || 'Failed to create user profile');
  }

  let mapped = mapProfileToUser(data as ProfileRow);
  if (mapped.role === 'mentor' && !mapped.inviteCode) {
    try {
      const code = await regenerateInviteCodeRpc();
      mapped = { ...mapped, inviteCode: code };
    } catch {
      // Non-fatal if invite code generation is retried later
    }
  }

  return mapped;
}

export async function updateProfileInDb(
  userId: string,
  updates: ProfileUpdatePayload
): Promise<User> {
  const supabase = getSupabaseClient();
  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
  if (updates.title !== undefined) dbUpdates.title = updates.title.trim();
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio.trim();
  if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar.trim();
  if (updates.companyOrSchool !== undefined) {
    dbUpdates.company_or_school = updates.companyOrSchool.trim();
  }
  if (updates.expertise !== undefined) dbUpdates.expertise = updates.expertise;
  if (updates.interests !== undefined) dbUpdates.interests = updates.interests;
  if (updates.settings !== undefined) dbUpdates.settings = updates.settings;

  const { data, error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update profile');
  }

  return mapProfileToUser(data as ProfileRow);
}

export async function regenerateInviteCodeRpc(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('regenerate_mentor_invite_code');
  if (error || !data) {
    throw new Error(error?.message || 'Failed to regenerate invite code');
  }
  return String(data);
}

export async function joinRelationshipByInviteCodeRpc(
  inviteCode: string,
  topic = 'Mentorship Workspace'
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('join_relationship_by_invite_code', {
    p_invite_code: inviteCode.trim().toUpperCase(),
    p_topic: topic,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Unable to connect using that invite code');
  }

  return String(data);
}

export async function changePasswordWithVerification(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    throw new Error('Current password is incorrect');
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    throw new Error(updateError.message || 'Failed to update password');
  }
}
