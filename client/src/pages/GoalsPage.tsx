import React, { useEffect, useState } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  AlertTriangle,
  Award,
  Filter,
  Trash2,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Goal, MentoringRelationship } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge, PriorityBadge, StatusBadge } from '@/components/common/Badge';

export const GoalsPage: React.FC = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [relationships, setRelationships] = useState<MentoringRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // New Goal Modal
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [relationshipId, setRelationshipId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<any>('technical');
  const [priority, setPriority] = useState<any>('medium');
  const [targetDate, setTargetDate] = useState('');
  const [milestonesText, setMilestonesText] = useState('');

  // Add Milestone Modal
  const [activeGoalForMilestone, setActiveGoalForMilestone] = useState<Goal | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  const fetchGoals = async () => {
    try {
      const [goalRes, relRes] = await Promise.all([
        api.get('/goals', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            category: categoryFilter !== 'all' ? categoryFilter : undefined,
          },
        }),
        api.get('/relationships'),
      ]);

      if (goalRes.data.success) setGoals(goalRes.data.goals);
      if (relRes.data.success) {
        setRelationships(relRes.data.relationships);
        if (!relationshipId && relRes.data.relationships.length > 0) {
          setRelationshipId(relRes.data.relationships[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [statusFilter, categoryFilter]);

  const handleToggleMilestone = async (goalId: string, milestoneId: string) => {
    try {
      const res = await api.patch(`/goals/${goalId}/milestones/${milestoneId}`);
      if (res.data.success) {
        setGoals((prev) =>
          prev.map((g) => (g._id === goalId ? res.data.goal : g))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoalForMilestone || !newMilestoneTitle.trim()) return;

    try {
      const res = await api.post(`/goals/${activeGoalForMilestone._id}/milestones`, {
        title: newMilestoneTitle,
      });
      if (res.data.success) {
        setGoals((prev) =>
          prev.map((g) => (g._id === activeGoalForMilestone._id ? res.data.goal : g))
        );
        setActiveGoalForMilestone(null);
        setNewMilestoneTitle('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const milestones = milestonesText
        .split('\n')
        .map((m) => m.trim())
        .filter((m) => m.length > 0)
        .map((m) => ({ title: m, completed: false }));

      const res = await api.post('/goals', {
        relationshipId,
        title,
        description,
        category,
        priority,
        targetDate: targetDate || undefined,
        milestones,
      });

      if (res.data.success) {
        setShowNewGoalModal(false);
        setTitle('');
        setDescription('');
        setMilestonesText('');
        setTargetDate('');
        fetchGoals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      await api.delete(`/goals/${goalId}`);
      setGoals((prev) => prev.filter((g) => g._id !== goalId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Mentoring Goals..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mentorship Goals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track measurable milestones, professional targets, and capability growth
          </p>
        </div>

        <button
          onClick={() => setShowNewGoalModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Goal
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filter Goals:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="not-started">Not Started</option>
          <option value="on-hold">On Hold</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
        >
          <option value="all">All Categories</option>
          <option value="technical">Technical</option>
          <option value="career">Career</option>
          <option value="project">Project</option>
          <option value="soft-skills">Soft Skills</option>
          <option value="academic">Academic</option>
        </select>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals found"
          description="Create a goal with milestones to measure progress throughout your mentorship."
          actionText="Create Goal"
          onAction={() => setShowNewGoalModal(true)}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const isCompleted = goal.status === 'completed' || goal.progress === 100;
            return (
              <div
                key={goal._id}
                className={`bg-white rounded-2xl p-6 border transition-all shadow-2xs hover:shadow-md flex flex-col ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {goal.category}
                      </span>
                      <PriorityBadge priority={goal.priority} />
                      <StatusBadge status={goal.status} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{goal.title}</h3>
                  </div>

                  <button
                    onClick={() => handleDeleteGoal(goal._id)}
                    className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                    title="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {goal.description && (
                  <p className="text-xs text-slate-600 mb-4">{goal.description}</p>
                )}

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-500">Milestone Progress</span>
                    <span className={isCompleted ? 'text-emerald-600 font-bold' : 'text-indigo-600'}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                {/* Milestones Checklist */}
                <div className="space-y-2 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Milestones ({goal.milestones?.filter((m) => m.completed).length || 0}/
                      {goal.milestones?.length || 0})
                    </span>
                    <button
                      onClick={() => setActiveGoalForMilestone(goal)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Milestone
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {goal.milestones?.map((m) => (
                      <div
                        key={m._id}
                        onClick={() => handleToggleMilestone(goal._id, m._id)}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors text-xs text-slate-800 group"
                      >
                        {m.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0" />
                        )}
                        <span className={m.completed ? 'line-through text-slate-400' : ''}>
                          {m.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Meta */}
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  {goal.targetDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Target:{' '}
                      {new Date(goal.targetDate).toLocaleDateString()}
                    </span>
                  )}
                  {goal.completedAt && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Achieved!
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Milestone Modal */}
      <Modal
        isOpen={!!activeGoalForMilestone}
        onClose={() => setActiveGoalForMilestone(null)}
        title="Add Milestone"
        subtitle={`Add sub-task to "${activeGoalForMilestone?.title}"`}
      >
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Milestone Title</label>
            <input
              type="text"
              required
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              placeholder="e.g. Write integration test suite"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveGoalForMilestone(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Add Milestone
            </button>
          </div>
        </form>
      </Modal>

      {/* New Goal Modal */}
      <Modal
        isOpen={showNewGoalModal}
        onClose={() => setShowNewGoalModal(false)}
        title="Create Mentorship Goal"
        subtitle="Define learning objectives and target outcomes"
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Mentorship Relationship</label>
            <select
              value={relationshipId}
              onChange={(e) => setRelationshipId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              {relationships.map((r) => (
                <option key={r._id} value={r._id}>
                  {user?.role === 'mentor' ? r.learner.name : r.mentor.name} — {r.topic}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Goal Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Full-Stack REST API & Auth"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="technical">Technical</option>
                <option value="career">Career</option>
                <option value="project">Project</option>
                <option value="soft-skills">Soft Skills</option>
                <option value="academic">Academic</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Target Completion Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Milestones (One milestone per line)
            </label>
            <textarea
              rows={3}
              value={milestonesText}
              onChange={(e) => setMilestonesText(e.target.value)}
              placeholder={"Design schemas\nWrite JWT verification\nAdd role guard"}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewGoalModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Create Goal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
