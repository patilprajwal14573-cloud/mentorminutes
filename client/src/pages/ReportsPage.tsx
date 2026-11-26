import React, { useCallback, useEffect, useState } from 'react';
import {
  Printer,
  History,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '@/services/api';
import { MentoringRelationship } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface DashboardStats {
  isMentor: boolean;
  totalLearners: number;
  totalRelationships: number;
  relationships: MentoringRelationship[];
  totalSessions: number;
  completedSessions: number;
  scheduledSessions: number;
  cancelledSessions: number;
  actions: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    overdue: number;
    carriedForward: number;
    completionRate: number;
  };
  goals: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
    averageProgress: number;
    categories: Record<string, number>;
  };
  actionPriorities: Record<string, number>;
}

export const ReportsPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [relationshipId, setRelationshipId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goalStatus, setGoalStatus] = useState('all');
  const [sessionStatus, setSessionStatus] = useState('all');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/reports/dashboard', {
        params: {
          relationshipId: relationshipId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          goalStatus: goalStatus !== 'all' ? goalStatus : undefined,
          sessionStatus: sessionStatus !== 'all' ? sessionStatus : undefined,
        },
      });
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [relationshipId, startDate, endDate, goalStatus, sessionStatus]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleResetFilters = () => {
    setRelationshipId('');
    setStartDate('');
    setEndDate('');
    setGoalStatus('all');
    setSessionStatus('all');
  };

  if (loading) return <LoadingSpinner text="Generating Mentorship Report..." />;

  const handlePrint = () => {
    window.print();
  };

  const priorityData = Object.entries(stats?.actionPriorities || {}).map(([key, val]) => ({
    name: key.toUpperCase(),
    count: val,
  }));

  const categoryData = Object.entries(stats?.goals?.categories || {}).map(([key, val]) => ({
    name: key.toUpperCase(),
    count: val,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Mentoring Analytics & Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Filterable performance metrics, carry-forward efficiency, and PDF export
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <Printer className="w-4 h-4" /> Print / Export PDF
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 self-center mr-1">
          <Filter className="w-4 h-4 text-slate-400" /> Filters:
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            {stats?.isMentor ? 'Learner / Mentorship' : 'Mentorship'}
          </label>
          <select
            value={relationshipId}
            onChange={(e) => setRelationshipId(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
          >
            <option value="">All Mentorships</option>
            {stats?.relationships?.map((r) => (
              <option key={r._id} value={r._id}>
                {stats.isMentor ? r.learner?.name : r.mentor?.name} — {r.topic}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 text-slate-700"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 text-slate-700"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Session Status</label>
          <select
            value={sessionStatus}
            onChange={(e) => setSessionStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
          >
            <option value="all">All Sessions</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Goal Status</label>
          <select
            value={goalStatus}
            onChange={(e) => setGoalStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
          >
            <option value="all">All Goals</option>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm print:border-none print:shadow-none space-y-8">
        {/* Document Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              MentorMinutes Official Report
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Mentorship Progress & Continuity Summary
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Generated on {new Date().toLocaleDateString()} · Records calculated live from database
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p className="font-bold text-slate-800">
              {stats?.isMentor ? 'Mentor Viewpoint' : 'Learner Viewpoint'}
            </p>
            <p>{stats?.totalRelationships || 0} Scoped Mentorships</p>
          </div>
        </div>

        {/* Executive Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Sessions Completed</span>
            <span className="text-2xl font-black text-slate-900">
              {stats?.completedSessions || 0} / {stats?.totalSessions || 0}
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Action Completion</span>
            <span className="text-2xl font-black text-emerald-600">
              {stats?.actions?.completionRate || 0}%
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Tasks Carried / Overdue</span>
            <span className="text-2xl font-black text-purple-600">
              {stats?.actions?.carriedForward || 0}
              <span className="text-sm font-bold text-rose-500"> / {stats?.actions?.overdue || 0}</span>
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Avg Goal Progress</span>
            <span className="text-2xl font-black text-indigo-600">
              {stats?.goals?.averageProgress || 0}%
            </span>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1.5">
            <h3 className="font-bold text-slate-800 mb-2">Session Breakdown</h3>
            <p className="flex justify-between"><span className="text-slate-500">Scheduled:</span> <strong>{stats?.scheduledSessions || 0}</strong></p>
            <p className="flex justify-between"><span className="text-slate-500">Completed:</span> <strong className="text-emerald-600">{stats?.completedSessions || 0}</strong></p>
            <p className="flex justify-between"><span className="text-slate-500">Cancelled:</span> <strong className="text-slate-600">{stats?.cancelledSessions || 0}</strong></p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1.5">
            <h3 className="font-bold text-slate-800 mb-2">Action Items Breakdown</h3>
            <p className="flex justify-between"><span className="text-slate-500">Pending / In Progress:</span> <strong className="text-amber-600">{(stats?.actions?.pending || 0) + (stats?.actions?.inProgress || 0)}</strong></p>
            <p className="flex justify-between"><span className="text-slate-500">Completed:</span> <strong className="text-emerald-600">{stats?.actions?.completed || 0}</strong></p>
            <p className="flex justify-between"><span className="text-slate-500">Overdue:</span> <strong className="text-rose-600">{stats?.actions?.overdue || 0}</strong></p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1.5">
            <h3 className="font-bold text-slate-800 mb-2">Goal Statistics</h3>
            <p className="flex justify-between"><span className="text-slate-500">Active Goals:</span> <strong className="text-indigo-600">{stats?.goals?.active || 0}</strong></p>
            <p className="flex justify-between"><span className="text-slate-500">Completed Goals:</span> <strong className="text-emerald-600">{stats?.goals?.completed || 0}</strong></p>
            <p className="flex justify-between"><span className="text-slate-500">Overdue Goals:</span> <strong className="text-rose-600">{stats?.goals?.overdue || 0}</strong></p>
          </div>
        </div>

        {/* Charts & Breakdown */}
        <div className="grid md:grid-cols-2 gap-8 pt-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Action Items Priority Breakdown
            </h3>
            <div className="h-56 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Goal Focus by Category
            </h3>
            <div className="h-56 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Carry Forward Efficiency Audit */}
        <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-200/80">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900">
              Automatic Carry-Forward Audit & Integrity
            </h3>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Automatic Action Carry-Forward ensures accountability across recurring sessions.
            Out of {stats?.actions?.total || 0} total created actions in this report scope,{' '}
            <strong>{stats?.actions?.carriedForward || 0}</strong> tasks were safely carried forward
            between sessions without data loss or duplication.
          </p>
        </div>
      </div>
    </div>
  );
};
