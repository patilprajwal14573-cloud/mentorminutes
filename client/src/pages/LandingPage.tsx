import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SimpleNavbar } from '../components/layout/SimpleNavbar';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SimpleNavbar variant="dark" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/35 via-slate-900 to-slate-900 pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Mentoring Made Simple
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
              Manage your mentoring{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-sky-300">
                in one clear workspace.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              MentorMinutes helps mentors and learners manage mentoring relationships, organize
              their mentorship journey, and stay aligned from day one.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
                >
                  Open Your Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
                  >
                    Get Started Free <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 rounded-xl text-sm font-semibold transition-all"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Simple Overview Cards */}
        <section className="py-16 border-t border-slate-800 bg-slate-950/60 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base text-white mb-2">Built for Mentors &amp; Learners</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Dedicated Mentor and Learner accounts so both sides have a clear, focused experience.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base text-white mb-2">Easy Invite Connections</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mentors receive a unique invitation code that learners can use to connect quickly.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base text-white mb-2">Secure Cloud Accounts</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Powered by Supabase Authentication and PostgreSQL Row Level Security for safe access.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-500 bg-slate-950">
        <p>© 2026 MentorMinutes — Helping mentors and learners manage mentoring.</p>
      </footer>
    </div>
  );
};
