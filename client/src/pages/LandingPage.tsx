import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  ShieldCheck,
  Sparkles,
  Compass,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SimpleNavbar } from '../components/layout/SimpleNavbar';

interface MentoringService {
  title: string;
  description: string;
  benefits: string[];
  icon: LucideIcon;
  accentBg: string;
  accentText: string;
  accentBorder: string;
}

const MENTORING_SERVICES: MentoringService[] = [
  {
    title: 'One-to-One Mentoring',
    description:
      'Personalized mentoring sessions tailored to your individual pace, questions, and learning priorities.',
    benefits: [
      'Dedicated 1-on-1 focus with your mentor',
      'Simple connection using a private mentor invite code',
      'Structured conversations centered on your growth',
    ],
    icon: Users,
    accentBg: 'from-indigo-500/20 to-indigo-500/5',
    accentText: 'text-indigo-400',
    accentBorder: 'border-indigo-500/30',
  },
  {
    title: 'Career Guidance',
    description:
      'Clear, practical perspective to help you navigate role choices, career transitions, and next professional steps.',
    benefits: [
      'Clarity on career direction and long-term options',
      'Constructive feedback on your professional readiness',
      'Thoughtful decision-making support from a mentor',
    ],
    icon: Compass,
    accentBg: 'from-violet-500/20 to-violet-500/5',
    accentText: 'text-violet-400',
    accentBorder: 'border-violet-500/30',
  },
  {
    title: 'Academic Mentoring',
    description:
      'Steady guidance for students looking to organize coursework, research focus, and effective study habits.',
    benefits: [
      'Structured academic check-ins and study direction',
      'Support breaking down complex subjects and projects',
      'Consistent encouragement throughout your academic term',
    ],
    icon: GraduationCap,
    accentBg: 'from-sky-500/20 to-sky-500/5',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/30',
  },
  {
    title: 'Skill Development',
    description:
      'Focused mentoring designed to help you build practical technical, communication, and problem-solving skills.',
    benefits: [
      'Targeted skill practice aligned with your objectives',
      'Actionable feedback on areas to strengthen next',
      'Continuous momentum as you build real confidence',
    ],
    icon: TrendingUp,
    accentBg: 'from-emerald-500/20 to-emerald-500/5',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/30',
  },
];

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const getStartedDestination = isAuthenticated ? '/dashboard' : '/register';

  useEffect(() => {
    if (location.hash === '#services') {
      document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

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

        {/* Mentoring Services Section */}
        <section id="services" className="py-20 border-t border-slate-800 bg-slate-900 px-4 sm:px-6 scroll-mt-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
                Mentoring Services
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Support tailored to every stage of your journey
              </h2>
              <p className="text-sm sm:text-base text-slate-400 mt-3 leading-relaxed">
                Explore how MentorMinutes helps mentors and learners structure meaningful guidance
                across personal, academic, and career goals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MENTORING_SERVICES.map((service) => {
                const Icon = service.icon;
                return (
                  <article
                    key={service.title}
                    className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors shadow-lg shadow-slate-950/40"
                  >
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${service.accentBg} border ${service.accentBorder} ${service.accentText} flex items-center justify-center shrink-0`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                          {service.title}
                        </h3>
                      </div>

                      <p className="text-sm text-slate-300 leading-relaxed mb-5">
                        {service.description}
                      </p>

                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 mb-6">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                          What the learner gets
                        </p>
                        <ul className="space-y-2">
                          {service.benefits.map((benefit) => (
                            <li key={benefit} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Link
                      to={getStartedDestination}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                      Get Started <ArrowRight className="w-4 h-4" />
                    </Link>
                  </article>
                );
              })}
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
