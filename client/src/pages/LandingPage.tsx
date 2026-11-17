import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  History,
  ShieldCheck,
  Target,
  Calendar,
  CheckCircle2,
  Users,
  Award,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();

  const handleQuickDemoLogin = async (email: string) => {
    const res = await login(email, 'Password123!');
    if (res.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">MentorMinutes</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-20 pb-28 px-4 sm:px-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-900 to-slate-900 pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold mb-8">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Full-Stack Mentoring & Session Management Platform
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
              Mentorship sessions where <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-sky-300">
                no agreed action is ever forgotten.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              MentorMinutes provides a centralized workspace for mentors and learners to plan sessions,
              record structured notes, track milestones, and <strong>automatically carry forward unfinished action items</strong> between sessions.
            </p>

            {/* Quick Demo Persona Launchers */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 max-w-2xl mx-auto backdrop-blur-md shadow-2xl mb-12">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                ⚡ Instant Demonstration Launchers (No setup needed)
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickDemoLogin('sarah.mitchell@mentorminutes.dev')}
                  className="flex items-center justify-between p-3.5 bg-slate-700/60 hover:bg-indigo-900/40 border border-slate-600 hover:border-indigo-500 rounded-xl text-left transition-all group"
                >
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-indigo-300">
                      Dr. Sarah Mitchell
                    </p>
                    <p className="text-xs text-indigo-400">Mentor Persona (Architect)</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all" />
                </button>

                <button
                  onClick={() => handleQuickDemoLogin('emily.chen@mentorminutes.dev')}
                  className="flex items-center justify-between p-3.5 bg-slate-700/60 hover:bg-violet-900/40 border border-slate-600 hover:border-violet-500 rounded-xl text-left transition-all group"
                >
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-violet-300">
                      Emily Chen
                    </p>
                    <p className="text-xs text-violet-400">Learner Persona (Developer)</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-400 transform group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Core Unique Feature: Automatic Action Carry-Forward */}
        <section className="py-20 bg-slate-950/60 border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
                <History className="w-3.5 h-3.5" /> Core Unique Innovation
              </div>
              <h2 className="text-3xl font-bold text-white">Automatic Action Carry-Forward</h2>
              <p className="text-slate-400 text-sm mt-3">
                When a new session is scheduled, all open action items (pending and in-progress) from the previous session automatically transfer forward into the new agenda, preserving lineage and preventing duplicates.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mb-4">
                  1
                </div>
                <h3 className="font-bold text-base text-white mb-2">Session #1 Assigned Tasks</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  During Session #1, mentor and learner agree on 3 action items. 1 task is completed, while 2 tasks remain unfinished.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-indigo-500/40 p-6 rounded-2xl relative shadow-lg shadow-indigo-500/10">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold mb-4">
                  2
                </div>
                <h3 className="font-bold text-base text-white mb-2">Automated Transition</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When Session #2 is created, the system copies unfinished tasks, links original session references, and marks originals as carried.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold mb-4">
                  3
                </div>
                <h3 className="font-bold text-base text-white mb-2">Zero Lost Continuity</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Session #2 opens with the carried items clearly badged. If a task spans multiple sessions, it increments carry count (e.g. Carried x2).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Engineered for Production Excellence
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                <Lock className="w-8 h-8 text-indigo-400 mb-3" />
                <h3 className="font-bold text-slate-100 text-base mb-1">Private Mentor Notes</h3>
                <p className="text-xs text-slate-400">
                  Strict backend privacy guard: mentor private notes are scrubbed in all API responses sent to learners.
                </p>
              </div>

              <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                <Target className="w-8 h-8 text-emerald-400 mb-3" />
                <h3 className="font-bold text-slate-100 text-base mb-1">Dynamic Milestones</h3>
                <p className="text-xs text-slate-400">
                  Goals feature interactive milestone checklists with automated real-time progress percentage recalculation.
                </p>
              </div>

              <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                <History className="w-8 h-8 text-amber-400 mb-3" />
                <h3 className="font-bold text-slate-100 text-base mb-1">Chronological Timeline</h3>
                <p className="text-xs text-slate-400">
                  Unified journey stream visualizing sessions, completed goals, and carried-forward tasks over time.
                </p>
              </div>

              <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                <Users className="w-8 h-8 text-sky-400 mb-3" />
                <h3 className="font-bold text-slate-100 text-base mb-1">Invite Codes</h3>
                <p className="text-xs text-slate-400">
                  Mentors generate unique invite codes (e.g. MM-ARCH99) allowing learners to connect with one click.
                </p>
              </div>

              <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                <ShieldCheck className="w-8 h-8 text-violet-400 mb-3" />
                <h3 className="font-bold text-slate-100 text-base mb-1">Automated Test Suite</h3>
                <p className="text-xs text-slate-400">
                  Backed by automated integration tests for carry-forward idempotency, authorization guards, and privacy leaks.
                </p>
              </div>

              <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                <Award className="w-8 h-8 text-rose-400 mb-3" />
                <h3 className="font-bold text-slate-100 text-base mb-1">Printable Reports</h3>
                <p className="text-xs text-slate-400">
                  Generate professional summaries, attendance logs, and carry-forward metrics ready for print/export.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-500 bg-slate-950">
        <p>© 2026 MentorMinutes — Full-Stack Mentoring Session & Progress Management Platform.</p>
        <p className="mt-1">Built with React, Node.js, Express, MongoDB, and Tailwind CSS.</p>
      </footer>
    </div>
  );
};
