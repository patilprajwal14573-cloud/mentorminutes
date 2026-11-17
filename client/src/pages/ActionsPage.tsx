import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Filter,
  History,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCircle2,
  ListFilter,
} from 'lucide-react';
import api from '@/services/api';
import { ActionItem } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ActionCard } from '@/components/actions/ActionCard';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PriorityBadge, StatusBadge } from '@/components/common/Badge';

export const ActionsPage: React.FC = () => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [carriedOnly, setCarriedOnly] = useState(false);

  // Lineage modal state
  const [selectedActionLineage, setSelectedActionLineage] = useState<ActionItem | null>(null);

  const fetchActions = async () => {
    try {
      const res = await api.get('/actions', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          overdue: overdueOnly ? 'true' : undefined,
        },
      });
      if (res.data.success) {
        let items: ActionItem[] = res.data.actions;
        if (carriedOnly) {
          items = items.filter((a) => a.carryCount > 0);
        }
        setActions(items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [statusFilter, priorityFilter, overdueOnly, carriedOnly]);

  const handleStatusChange = async (actionId: string, status: string) => {
    try {
      await api.patch(`/actions/${actionId}/status`, { status });
      fetchActions();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Action Items..." />;

  const pendingCount = actions.filter((a) => a.status === 'pending').length;
  const inProgressCount = actions.filter((a) => a.status === 'in-progress').length;
  const completedCount = actions.filter((a) => a.status === 'completed').length;
  const carriedCount = actions.filter((a) => a.carryCount > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Action Items Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Every agreed responsibility tracked across sessions with automatic carry-forward
          </p>
        </div>

        {/* Quick status counters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
            {pendingCount} Pending
          </div>
          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-semibold">
            {inProgressCount} In Progress
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
            {completedCount} Done
          </div>
          <div className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl text-xs font-semibold">
            {carriedCount} Carried
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button
            onClick={() => setCarriedOnly(!carriedOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              carriedOnly
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Carried Forward Only
          </button>

          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              overdueOnly
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Overdue Only
          </button>
        </div>
      </div>

      {/* Action Items List */}
      {actions.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No action items found"
          description="Action items are assigned during mentoring sessions and carry forward automatically."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action) => (
            <ActionCard
              key={action._id}
              action={action}
              onStatusChange={handleStatusChange}
              onViewLineage={(act) => setSelectedActionLineage(act)}
            />
          ))}
        </div>
      )}

      {/* Carry Forward Lineage Modal */}
      {selectedActionLineage && (
        <Modal
          isOpen={!!selectedActionLineage}
          onClose={() => setSelectedActionLineage(null)}
          title="Action Item Carry-Forward History"
          subtitle="Full trail of session transfers and status preservation"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm mb-1">
                {selectedActionLineage.title}
              </h4>
              <p className="text-slate-500">{selectedActionLineage.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={selectedActionLineage.status} />
                <PriorityBadge priority={selectedActionLineage.priority} />
                <span className="font-semibold text-amber-700">
                  Carried {selectedActionLineage.carryCount} times
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <p className="font-bold text-indigo-900">
                  Originated in Session #{selectedActionLineage.originalSession?.sessionNumber || 1}
                </p>
                <p className="text-indigo-700 text-[11px] mt-0.5">
                  Title: {selectedActionLineage.originalSession?.title || 'Kickoff Session'}
                </p>
              </div>

              {selectedActionLineage.carryHistory?.map((h, i) => (
                <div key={i} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>Carry Forward #{i + 1}</span>
                    <span className="text-[10px] text-amber-700 font-normal">
                      {new Date(h.carriedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-amber-800 mt-1">{h.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
