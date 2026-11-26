import React, { useEffect, useState } from 'react';
import {
  User,
  Lock,
  Bell,
  Save,
  Check,
  Copy,
  KeyRound,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  changePasswordWithVerification,
  regenerateInviteCodeRpc,
  updateProfileInDb,
} from '@/services/authService';

type ThemeOption = 'light' | 'dark' | 'system';

export const SettingsPage: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || '');
  const [companyOrSchool, setCompanyOrSchool] = useState(user?.companyOrSchool || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Preferences form
  const [emailNotifications, setEmailNotifications] = useState(
    user?.settings?.emailNotifications ?? true
  );
  const [sessionReminders, setSessionReminders] = useState(
    user?.settings?.sessionReminders ?? true
  );
  const [theme, setTheme] = useState<ThemeOption>(user?.settings?.theme ?? 'light');
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);
  const [prefsError, setPrefsError] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status feedback
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setTitle(user.title || '');
    setCompanyOrSchool(user.companyOrSchool || '');
    setBio(user.bio || '');
    setAvatar(user.avatar || '');
    setEmailNotifications(user.settings?.emailNotifications ?? true);
    setSessionReminders(user.settings?.sessionReminders ?? true);
    setTheme(user.settings?.theme ?? 'light');
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError('');
    setProfileSuccess(false);

    if (!name.trim()) {
      setProfileError('Full name is required');
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await updateProfileInDb(user._id, {
        name,
        title,
        companyOrSchool,
        bio,
        avatar,
      });
      updateUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPrefsError('');
    setPrefsSaving(true);
    setPrefsSuccess(false);
    try {
      const updated = await updateProfileInDb(user._id, {
        settings: {
          emailNotifications,
          sessionReminders,
          theme,
        },
      });
      updateUser(updated);
      setPrefsSuccess(true);
      setTimeout(() => setPrefsSuccess(false), 3000);
    } catch (err: unknown) {
      setPrefsError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordSaving(true);
    try {
      await changePasswordWithVerification(user.email, currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Password update failed');
    } finally {
      setPasswordSaving(false);
    }
  };

  const copyCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleRegenerateCode = async () => {
    setRegeneratingCode(true);
    try {
      await regenerateInviteCodeRpc();
      await refreshUser();
    } catch (err) {
      console.error('Failed to regenerate invite code:', err);
    } finally {
      setRegeneratingCode(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your personal profile, credentials, and notification preferences
        </p>
      </div>

      {/* Mentor Invite Code Card */}
      {user?.role === 'mentor' && user.inviteCode && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-5 border border-indigo-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Your Mentor Invitation Code</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Share this unique code with mentees so they can connect with you instantly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-sm font-black text-indigo-900 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 whitespace-nowrap">
              {user.inviteCode}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-2xs"
              title="Copy code"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleRegenerateCode}
              disabled={regeneratingCode}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-indigo-200 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
              title="Generate a new invite code"
            >
              <RefreshCw className={`w-4 h-4 ${regeneratingCode ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" /> Public Profile
        </h2>

        {profileError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Role (Fixed)</label>
              <input
                type="text"
                disabled
                value={user?.role?.toUpperCase() || ''}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed uppercase font-bold text-xs"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Professional Title / Major</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Software Architect"
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Company / University</label>
              <input
                type="text"
                value={companyOrSchool}
                onChange={(e) => setCompanyOrSchool(e.target.value)}
                placeholder="e.g. Tech Mentors Guild"
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Avatar Image URL</label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief description of your expertise, mentoring philosophy, or learning goals..."
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {profileSuccess ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Profile saved successfully!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Notification & Theme Preferences */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600" /> Notification & Theme Preferences
        </h2>

        {prefsError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{prefsError}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePreferences} className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-slate-800">In-App Activity Alerts</p>
              <p className="text-[11px] text-slate-500">
                Receive alerts when sessions, goals, or actions are updated
              </p>
            </div>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-slate-800">Session & Deadline Reminders</p>
              <p className="text-[11px] text-slate-500">
                Highlight overdue action items and approaching goal deadlines
              </p>
            </div>
            <input
              type="checkbox"
              checked={sessionReminders}
              onChange={(e) => setSessionReminders(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Theme Preference</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeOption)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              <option value="light">Light (Default)</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            {prefsSuccess ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Preferences saved!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={prefsSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {prefsSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Form */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-600" /> Security & Password
        </h2>

        {passwordError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {passwordSuccess ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Password updated!
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-60"
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
