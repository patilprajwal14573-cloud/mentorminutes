import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Lock,
  Plus,
  Save,
  Check,
  FileText,
  Trash2,
  Calendar,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Session, ActionItem } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/Badge';
import { ActionCard } from '@/components/actions/ActionCard';
import { CarryForwardBanner } from '@/components/sessions/CarryForwardBanner';

export const SessionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable session fields
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [agenda, setAgenda] = useState('');
  const [topicsDiscussed, setTopicsDiscussed] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState('');
  const [sharedSummary, setSharedSummary] = useState('');
  const [learnerFeedback, setLearnerFeedback] = useState('');
  const [mentorPrivateNotes, setMentorPrivateNotes] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');

  // Add Action Item modal
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionPriority, setActionPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionRole, setActionRole] = useState<'learner' | 'mentor'>('learner');

  const fetchSessionDetails = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/${id}`);
      if (res.data.success) {
        const s: Session = res.data.session;
        setSession(s);
        setActions(res.data.actions || []);
        setTitle(s.title || '');
        setScheduledDate(s.scheduledDate ? new Date(s.scheduledDate).toISOString().slice(0, 16) : '');
        setDurationMinutes(s.durationMinutes || 60);
        setNextSessionDate(s.nextSessionDate ? new Date(s.nextSessionDate).toISOString().slice(0, 10) : '');
        setAgenda(s.agenda || '');
        setTopicsDiscussed(s.topicsDiscussed || '');
        setKeyTakeaways(s.keyTakeaways || '');
        setSharedSummary(s.sharedSummary || '');
        setLearnerFeedback(s.learnerFeedback || '');
        setMentorPrivateNotes(s.mentorPrivateNotes || '');
        setSessionStatus(s.status || 'scheduled');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  const isMentor = user?.role === 'mentor';

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      const payload = isMentor
        ? {
            title,
            scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
            durationMinutes,
            nextSessionDate: nextSessionDate ? new Date(nextSessionDate).toISOString() : null,
            agenda,
            topicsDiscussed,
            keyTakeaways,
            sharedSummary,
            learnerFeedback,
            mentorPrivateNotes,
            status: sessionStatus,
          }
        : {
            learnerFeedback,
          };

      const res = await api.put(`/sessions/${id}`, payload);
      if (res.data.success) {
        setSession(res.data.session);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message || 'Failed to save session'
        : 'Failed to save session';
      setSaveError(msg);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteSession = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/sessions/${id}`);
      if (res.data.success) {
        navigate('/sessions');
      }
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  const handleActionStatusChange = async (actionId: string, status: string) => {
    try {
      await api.patch(`/actions/${actionId}/status`, { status });
      fetchSessionDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    try {
      const partner = isMentor ? session.relationship?.learner : session.relationship?.mentor;
      const assignedToId = actionRole === 'mentor' ? session.relationship?.mentor._id : partner?._id;

      await api.post('/actions', {
        relationshipId: session.relationship._id,
        sessionId: session._id,
        title: actionTitle,
        description: actionDesc,
        priority: actionPriority,
        dueDate: actionDueDate || undefined,
        assignedTo: assignedToId,
        assignedToRole: actionRole,
      });

      setShowAddActionModal(false);
      setActionTitle('');
      setActionDesc('');
      setActionDueDate('');
      fetchSessionDetails();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Session Workspace..." />;
  if (!session) return <p className="text-center p-8 text-slate-600">Session not found</p>;

  const carriedItems = actions.filter((a) => a.carryCount > 0);

  return (
    <div className="space-y-6">
      {/* Top Bar with back link and save actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/sessions"
            className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                Session #{session.sessionNumber}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {session.title}
              </h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled on {new Date(session.scheduledDate).toLocaleString()} · Duration: {session.durationMinutes} mins
              {session.nextSessionDate && (
                <> · Next Session: {new Date(session.nextSessionDate).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMentor && (
            <>
              <select
                value={sessionStatus}
                onChange={(e) => setSessionStatus(e.target.value as 'scheduled' | 'completed' | 'cancelled')}
                className="text-xs font-semibold rounded-xl border border-slate-300 bg-white py-2 px-3 shadow-2xs"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> {savingNotes ? 'Saving...' : 'Save Workspace'}
              </>
            )}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {saveError}
        </div>
      )}

      {/* Automatic Action Carry-Forward Banner */}
      {carriedItems.length > 0 && (
        <CarryForwardBanner
          carriedActions={carriedItems}
          currentSessionNumber={session.sessionNumber}
        />
      )}

      {/* Agenda & Summary Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Session Schedule & Metadata (Mentor Editable) */}
          {isMentor && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" /> Session Details
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Session Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Session Date</label>
                  <input
                    type="date"
                    value={nextSessionDate}
                    onChange={(e) => setNextSessionDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Session Agenda</label>
                <textarea
                  rows={2}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Outline the session agenda..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Discussion Notes Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> Discussion & Shared Notes
            </h2>

            {!isMentor && session.agenda && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="font-bold text-slate-700 block mb-1">Session Agenda:</span>
                <p className="text-slate-600 whitespace-pre-line">{session.agenda}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Topics Discussed
              </label>
              {isMentor ? (
                <textarea
                  rows={3}
                  value={topicsDiscussed}
                  onChange={(e) => setTopicsDiscussed(e.target.value)}
                  placeholder="Log key topics, concepts explored, and discussion points..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line">
                  {topicsDiscussed || 'No topics logged yet.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Key Takeaways
              </label>
              {isMentor ? (
                <textarea
                  rows={3}
                  value={keyTakeaways}
                  onChange={(e) => setKeyTakeaways(e.target.value)}
                  placeholder="Important conclusions and next steps agreed upon..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line">
                  {keyTakeaways || 'No takeaways logged yet.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Shared Session Summary
              </label>
              {isMentor ? (
                <textarea
                  rows={3}
                  value={sharedSummary}
                  onChange={(e) => setSharedSummary(e.target.value)}
                  placeholder="Overall summary shared with the learner..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line">
                  {sharedSummary || 'No shared summary logged yet.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Learner Visible Feedback & Reflections
              </label>
              <textarea
                rows={2}
                value={learnerFeedback}
                onChange={(e) => setLearnerFeedback(e.target.value)}
                placeholder="Actionable feedback and session reflections..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Private Mentor Notes (Strictly hidden from learner!) */}
          {isMentor && (
            <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600" /> Private Mentor Notes
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  Confidential
                </span>
              </div>
              <p className="text-xs text-indigo-800/80">
                🔒 These notes are scrubbed in the backend API and never accessible by learners.
              </p>
              <textarea
                rows={3}
                value={mentorPrivateNotes}
                onChange={(e) => setMentorPrivateNotes(e.target.value)}
                placeholder="Private mentor observations, candid progress assessment, reminders for future sessions..."
                className="w-full text-xs p-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Action Items Column */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Session Action Items</h3>
                <p className="text-xs text-slate-500">
                  {actions.length} {actions.length === 1 ? 'task' : 'tasks'} assigned
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddActionModal(true)}
                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors"
                title="Add new action item"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {actions.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No action items assigned for this session yet.
                </p>
              ) : (
                actions.map((action) => (
                  <ActionCard
                    key={action._id}
                    action={action}
                    onStatusChange={handleActionStatusChange}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Action Item Modal */}
      <Modal
        isOpen={showAddActionModal}
        onClose={() => setShowAddActionModal(false)}
        title="Add Action Item"
        subtitle={`Assign task for Session #${session.sessionNumber}`}
      >
        <form onSubmit={handleCreateAction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Task Title</label>
            <input
              type="text"
              required
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              placeholder="e.g. Implement JWT authentication guard"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <textarea
              rows={2}
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
              placeholder="Detailed acceptance criteria or guidance..."
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Priority</label>
              <select
                value={actionPriority}
                onChange={(e) => setActionPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Due Date</label>
              <input
                type="date"
                value={actionDueDate}
                onChange={(e) => setActionDueDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Assign To</label>
            <select
              value={actionRole}
              onChange={(e) => setActionRole(e.target.value as 'learner' | 'mentor')}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              <option value="learner">Learner ({session.relationship?.learner?.name})</option>
              <option value="mentor">Mentor ({session.relationship?.mentor?.name})</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddActionModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Add Action Item
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Session Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Mentoring Session"
        subtitle="Are you sure you want to remove this session?"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Deleting <strong>{session.title}</strong> will permanently remove this session and its session-specific actions. Any tasks carried forward into this session will be restored on their previous session.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Keep Session
            </button>
            <button
              type="button"
              onClick={handleDeleteSession}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-60"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
