import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  History,
  Target,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '@/services/api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export const ReportsPage: React.FC = () => {
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
            Exportable performance metrics, carry-forward efficiency, and milestone tracking
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <Printer className="w-4 h-4" /> Print / Export PDF
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
              Generated on {new Date().toLocaleDateString()} · System: v1.0.0
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p className="font-bold text-slate-800">
              {stats?.isMentor ? 'Mentor Viewpoint' : 'Learner Viewpoint'}
            </p>
            <p>{stats?.totalRelationships} Active Mentorships</p>
          </div>
        </div>

        {/* Executive Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Sessions Held</span>
            <span className="text-2xl font-black text-slate-900">
              {stats?.completedSessions || 0}
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Action Completion</span>
            <span className="text-2xl font-black text-emerald-600">
              {stats?.actions?.completionRate || 0}%
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Tasks Carried</span>
            <span className="text-2xl font-black text-purple-600">
              {stats?.actions?.carriedForward || 0}
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <span className="text-xs text-slate-500 block mb-1">Avg Goal Progress</span>
            <span className="text-2xl font-black text-indigo-600">
              {stats?.goals?.averageProgress || 0}%
            </span>
          </div>
        </div>

        {/* Charts & Breakdown */}
        <div className="grid md:grid-cols-2 gap-8 pt-4">
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
            Automatic Action Carry-Forward ensures 100% accountability across recurring sessions.
            Out of {stats?.actions?.total || 0} total created actions,{' '}
            <strong>{stats?.actions?.carriedForward || 0}</strong> tasks were safely carried forward
            between sessions without data loss or duplication.
          </p>
        </div>
      </div>
    </div>
  );
};
