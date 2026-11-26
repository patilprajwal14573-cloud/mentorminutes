import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Building2, Briefcase, KeyRound, Copy, Check, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SimpleNavbar } from '../components/layout/SimpleNavbar';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!user?.inviteCode) return;
    navigator.clipboard.writeText(user.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SimpleNavbar variant="light" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Welcome Card */}
        <section className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-indigo-100 text-xs font-semibold uppercase tracking-wider mb-3">
                {user?.role === 'mentor' ? 'Mentor Workspace' : 'Learner Portal'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome, {user?.name || 'Member'}!
              </h1>
              <p className="text-sm text-indigo-100/90 mt-2 max-w-xl leading-relaxed">
                You are signed in to MentorMinutes. This workspace helps mentors and learners
                manage mentoring cleanly and securely.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </section>

        {/* Mentor Invite Code Card */}
        {user?.role === 'mentor' && user.inviteCode && (
          <section className="bg-white rounded-2xl p-6 border border-indigo-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Your Mentor Invite Code</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Share this code with learners so they can connect with you when registering.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-900 bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-200">
                {user.inviteCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>
        )}

        {/* Account Summary Card */}
        <section className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">Your Profile</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <User className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Full Name</p>
                <p className="font-semibold text-slate-900 truncate">{user?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-semibold text-slate-900 truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Title / Major</p>
                <p className="font-semibold text-slate-900 truncate">
                  {user?.title || 'Not specified'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Company / School</p>
                <p className="font-semibold text-slate-900 truncate">
                  {user?.companyOrSchool || 'Not specified'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
