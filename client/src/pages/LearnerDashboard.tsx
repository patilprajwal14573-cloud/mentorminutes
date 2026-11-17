import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckSquare,
  Target,
  AlertTriangle,
  History,
  TrendingUp,
  ArrowRight,
  MessageSquare,
  Award,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export const LearnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/reports/dashboard');
        if (res.data.success) {
          setStats(res.data.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner text="Loading Learner Dashboard..." />;

  const mentor = stats?.relationships?.[0]?.mentor;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-violet-200 text-xs font-semibold mb-3">
            Learner Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hi, {user?.name}
          </h1>
          <p className="text-sm text-violet-200 mt-2 leading-relaxed">
            {mentor ? (
              <>
                You are paired with <strong>{mentor.name}</strong> ({mentor.title}). Your unfinished
                action items automatically migrate forward, so you never lose momentum!
              </>
            ) : (
              'Connect with a mentor using an invite code to start scheduling sessions and tracking goals.'
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Link
              to="/actions"
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <CheckSquare className="w-4 h-4" /> My Action Items
            </Link>
            <Link
              to="/goals"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Target className="w-4 h-4" /> Track Goals
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Sessions Attended</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {stats?.completedSessions || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Completed 1:1 sessions</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tasks Completed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {stats?.actions?.completed || 0}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            {stats?.actions?.completionRate || 0}% overall completion
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Goals</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {stats?.goals?.active || 0}
          </p>
          <p className="text-[11px] text-indigo-600 font-medium mt-1">
            Avg {stats?.goals?.averageProgress || 0}% progress
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Actions</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {(stats?.actions?.pending || 0) + (stats?.actions?.inProgress || 0)}
          </p>
          {stats?.actions?.overdue > 0 ? (
            <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {stats?.actions?.overdue} overdue
            </p>
          ) : (
            <p className="text-[11px] text-emerald-600 font-medium mt-1">All on track</p>
          )}
        </div>
      </div>

      {/* Main Content Grid: Upcoming Sessions & Recent Feedback */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Next Upcoming Sessions</h3>
              <p className="text-xs text-slate-500">Don't forget to prepare topics and review action items</p>
            </div>
            <Link
              to="/sessions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              All sessions <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {stats?.upcomingSessions?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No upcoming sessions right now.</p>
            ) : (
              stats?.upcomingSessions?.map((session: any) => (
                <div
                  key={session._id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-violet-500 uppercase">
                        {new Date(session.scheduledDate).toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-sm font-extrabold text-violet-900 leading-none">
                        {new Date(session.scheduledDate).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{session.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        Session #{session.sessionNumber} · Duration: {session.durationMinutes}m
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/sessions/${session._id}`}
                    className="px-3 py-1 bg-slate-100 hover:bg-violet-50 hover:text-violet-600 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mentor Feedback Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Mentor Feedback</h3>
              <p className="text-[11px] text-slate-400">Notes shared by your mentor</p>
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {stats?.recentFeedbackSessions?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No feedback shared yet.</p>
            ) : (
              stats?.recentFeedbackSessions?.map((s: any) => (
                <div key={s._id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <p className="font-semibold text-slate-800 text-[11px] mb-1">{s.title}</p>
                  <p className="text-slate-600 italic">"{s.learnerFeedback}"</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
