import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  CheckSquare,
  Target,
  AlertTriangle,
  History,
  ArrowRight,
  Award,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Session, Goal, ActionItem } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface MentorDashboardStats {
  totalLearners: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: Session[];
  actions: {
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    carriedForward: number;
  };
  goals: {
    active: number;
    completed: number;
    averageProgress: number;
    recentlyCompleted: Goal[];
  };
  recentCompletedActions: ActionItem[];
}

export const MentorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<MentorDashboardStats | null>(null);
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

  if (loading) return <LoadingSpinner text="Loading Mentor Dashboard..." />;

  const actionDistribution = [
    { name: 'Completed', value: stats?.actions?.completed || 0, color: '#10B981' },
    { name: 'In Progress', value: stats?.actions?.inProgress || 0, color: '#6366F1' },
    { name: 'Pending', value: stats?.actions?.pending || 0, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold mb-3">
            Mentor Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="text-sm text-indigo-200 mt-2 leading-relaxed">
            You are currently guiding {stats?.totalLearners || 0} active{' '}
            {stats?.totalLearners === 1 ? 'mentee' : 'mentees'}. With automatic carry-forward, all
            unfinished actions seamlessly migrate to the next session.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Link
              to="/sessions"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <Calendar className="w-4 h-4" /> Schedule New Session
            </Link>
            <Link
              to="/goals"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Target className="w-4 h-4" /> View Goals
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Connected Mentees</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {stats?.totalLearners || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Active mentoring relationships</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Sessions</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {stats?.totalSessions || 0}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            {stats?.completedSessions || 0} completed
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Actions</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {(stats?.actions?.pending || 0) + (stats?.actions?.inProgress || 0)}
          </p>
          {stats?.actions?.overdue && stats.actions.overdue > 0 ? (
            <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {stats.actions.overdue} overdue
            </p>
          ) : (
            <p className="text-[11px] text-emerald-600 font-medium mt-1">All on schedule</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Goals / Carried</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            {stats?.goals?.active || 0}
          </p>
          <p className="text-[11px] text-purple-600 font-medium mt-1">
            {stats?.actions?.carriedForward || 0} tasks carried forward
          </p>
        </div>
      </div>

      {/* Upcoming Sessions & Action Chart */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Upcoming Mentoring Sessions</h3>
              <p className="text-xs text-slate-500">Scheduled 1:1 discussions</p>
            </div>
            <Link
              to="/sessions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {!stats?.upcomingSessions || stats.upcomingSessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No upcoming sessions scheduled.</p>
            ) : (
              stats.upcomingSessions.map((session) => (
                <div
                  key={session._id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">
                        {new Date(session.scheduledDate).toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-sm font-extrabold text-indigo-900 leading-none">
                        {new Date(session.scheduledDate).getDate()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{session.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        With {session.relationship?.learner?.name} · Session #{session.sessionNumber}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/sessions/${session._id}`}
                    className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Open
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Status Distribution Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col">
          <h3 className="text-base font-bold text-slate-900 mb-1">Action Item Health</h3>
          <p className="text-xs text-slate-500 mb-4">Status of agreed responsibilities</p>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={actionDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {actionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around text-center mt-auto pt-3 border-t border-slate-100 text-xs">
            <div>
              <p className="text-emerald-600 font-bold">{stats?.actions?.completed || 0}</p>
              <p className="text-slate-400 text-[10px]">Completed</p>
            </div>
            <div>
              <p className="text-indigo-600 font-bold">{stats?.actions?.inProgress || 0}</p>
              <p className="text-slate-400 text-[10px]">In Progress</p>
            </div>
            <div>
              <p className="text-amber-600 font-bold">{stats?.actions?.pending || 0}</p>
              <p className="text-slate-400 text-[10px]">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Completed Goals & Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs min-w-0">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600 shrink-0" /> Recently Completed Goals
            </h3>
            <Link to="/goals" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0">
              All Goals
            </Link>
          </div>
          {!stats?.goals?.recentlyCompleted || stats.goals.recentlyCompleted.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No completed goals yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.goals.recentlyCompleted.map((g) => (
                <div key={g._id} className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs flex items-center justify-between gap-2 min-w-0">
                  <span className="font-semibold text-slate-800 truncate min-w-0 flex-1">{g.title}</span>
                  <span className="text-[11px] text-emerald-700 font-bold shrink-0">100%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs min-w-0">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" /> Recent Mentoring Activity
            </h3>
            <Link to="/timeline" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0">
              Timeline
            </Link>
          </div>
          {!stats?.recentCompletedActions || stats.recentCompletedActions.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No recent completed tasks.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.recentCompletedActions.map((a) => (
                <div key={a._id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between gap-2 min-w-0">
                  <span className="font-medium text-slate-800 truncate min-w-0 flex-1">{a.title}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : 'Done'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
