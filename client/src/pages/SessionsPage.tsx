import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  Plus,
  History,
  CheckCircle2,
  ArrowRight,
  Filter,
  Search,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Session, MentoringRelationship, ActionItem } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge, CarryForwardBadge } from '@/components/common/Badge';

interface CarryPreviewResponse {
  hasPreviousSession: boolean;
  lastSession: {
    _id: string;
    sessionNumber: number;
    title: string;
    scheduledDate: string;
  } | null;
  eligibleActions: ActionItem[];
  nextSessionNumber: number;
}

export const SessionsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialRelId = searchParams.get('relationshipId') || '';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [relationships, setRelationships] = useState<MentoringRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRelFilter, setSelectedRelFilter] = useState<string>(initialRelId);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New session modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [relationshipId, setRelationshipId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [agenda, setAgenda] = useState('');
  const [mentorPrivateNotes, setMentorPrivateNotes] = useState('');

  // Carry forward preview state
  const [carryPreview, setCarryPreview] = useState<CarryPreviewResponse | null>(null);
  const [selectedCarryIds, setSelectedCarryIds] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, relRes] = await Promise.all([
        api.get('/sessions', {
          params: {
            relationshipId: selectedRelFilter || undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            q: searchQuery.trim() || undefined,
          },
        }),
        api.get('/relationships'),
      ]);

      if (sessRes.data.success) setSessions(sessRes.data.sessions);
      if (relRes.data.success) {
        setRelationships(relRes.data.relationships);
        setRelationshipId((prev) => prev || relRes.data.relationships[0]?._id || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedRelFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When mentor selects a relationship in New Session modal, preview carry-forward tasks
  useEffect(() => {
    if (!relationshipId || !showNewModal) return;

    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const res = await api.get('/sessions/preview-carry-forward', {
          params: { relationshipId },
        });
        if (res.data.success) {
          const preview: CarryPreviewResponse = res.data.preview;
          setCarryPreview(preview);
          setSelectedCarryIds(preview.eligibleActions.map((a) => a._id));
          setTitle((prev) => prev || `Session #${preview.nextSessionNumber}`);
        }
      } catch (err) {
        console.error('Carry preview error:', err);
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [relationshipId, showNewModal]);

  const toggleCarryItem = (actionId: string) => {
    setSelectedCarryIds((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    try {
      const res = await api.post('/sessions', {
        relationshipId,
        title,
        scheduledDate: new Date(scheduledDate).toISOString(),
        durationMinutes,
        nextSessionDate: nextSessionDate ? new Date(nextSessionDate).toISOString() : undefined,
        agenda,
        mentorPrivateNotes,
        selectedCarryActionIds: carryPreview?.eligibleActions?.length ? selectedCarryIds : undefined,
      });

      if (res.data.success) {
        setShowNewModal(false);
        setTitle('');
        setAgenda('');
        setMentorPrivateNotes('');
        setNextSessionDate('');
        setDurationMinutes(60);
        fetchData();
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message || 'Failed to schedule session'
        : 'Failed to schedule session';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Mentoring Sessions..." />;

  const isMentor = user?.role === 'mentor';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mentoring Sessions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize discussions, track session notes, and review automatic task carry-forward
          </p>
        </div>

        {isMentor && (
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Schedule Session
          </button>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions by title, agenda, or topics..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {relationships.length > 1 && (
          <select
            value={selectedRelFilter}
            onChange={(e) => setSelectedRelFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl bg-slate-50 py-1.5 px-3 font-medium text-slate-700 max-w-xs truncate"
          >
            <option value="">All Mentorships</option>
            {relationships.map((r) => (
              <option key={r._id} value={r._id}>
                {isMentor ? r.learner.name : r.mentor.name} — {r.topic}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No sessions found"
          description={
            isMentor
              ? 'Schedule your first session with your mentee to start logging agenda and actions.'
              : 'Your mentor will schedule upcoming sessions for your mentorship.'
          }
          actionText={isMentor ? 'Schedule Session' : undefined}
          onAction={() => setShowNewModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const partner = isMentor
              ? session.relationship?.learner
              : session.relationship?.mentor;

            return (
              <div
                key={session._id}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  {/* Date badge */}
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">
                      {new Date(session.scheduledDate).toLocaleString('default', { month: 'short' })}
                    </span>
                    <span className="text-base font-extrabold text-indigo-950 leading-none">
                      {new Date(session.scheduledDate).getDate()}
                    </span>
                  </div>

                  {/* Title & info */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Session #{session.sessionNumber}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{session.title}</h3>
                      <StatusBadge status={session.status} />
                      {session.carriedActionsCount && session.carriedActionsCount > 0 ? (
                        <CarryForwardBadge count={session.carriedActionsCount} />
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-500">
                      With <strong className="text-slate-700">{partner?.name}</strong> ·{' '}
                      {session.relationship?.topic} · Duration: {session.durationMinutes} mins
                    </p>

                    {session.agenda && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <strong className="text-slate-700">Agenda:</strong> {session.agenda}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <Link
                    to={`/sessions/${session._id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-2xs transition-all"
                  >
                    Open Session <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Session Modal with Carry-Forward Preview */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Schedule Mentoring Session"
        subtitle="Automatic Action Carry-Forward is active for this session"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          {createError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {createError}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">Mentorship Relationship</label>
            <select
              value={relationshipId}
              onChange={(e) => {
                setRelationshipId(e.target.value);
                setTitle('');
              }}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              {relationships.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.learner?.name} — {r.topic}
                </option>
              ))}
            </select>
          </div>

          {/* Automatic Carry-Forward Live Review Box */}
          {loadingPreview ? (
            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
              Checking previous session for unfinished actions...
            </div>
          ) : carryPreview && carryPreview.eligibleActions.length > 0 ? (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <History className="w-4 h-4 text-amber-600" />
                  Review Carry-Forward Tasks ({selectedCarryIds.length}/{carryPreview.eligibleActions.length} selected)
                </div>
              </div>
              <p className="text-[11px] text-amber-800">
                Unfinished tasks from Session #{carryPreview.lastSession?.sessionNumber} ready to transfer into this session:
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {carryPreview.eligibleActions.map((a) => (
                  <label
                    key={a._id}
                    className="flex items-center justify-between gap-2 text-xs bg-white/90 px-2.5 py-1.5 rounded-lg border border-amber-200/60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedCarryIds.includes(a._id)}
                        onChange={() => toggleCarryItem(a._id)}
                        className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium text-slate-800 truncate">{a.title}</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                      {a.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>No unfinished actions to carry forward. Clean slate for this session!</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Session Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Session #3: REST APIs & Auth"
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Duration (minutes)</label>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Next Session Date (Optional)</label>
              <input
                type="date"
                value={nextSessionDate}
                onChange={(e) => setNextSessionDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Agenda / Discussion Topics</label>
            <textarea
              rows={3}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Outline what will be discussed during this session..."
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Private Mentor Notes (strictly hidden from learner) */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <label className="block text-xs font-bold text-indigo-900 mb-1">
              Private Mentor Notes (Confidential)
            </label>
            <p className="text-[11px] text-indigo-700/80 mb-2">
              🔒 Strictly invisible to learner. Only you will be able to see these private thoughts.
            </p>
            <textarea
              rows={2}
              value={mentorPrivateNotes}
              onChange={(e) => setMentorPrivateNotes(e.target.value)}
              placeholder="Private observations, areas to challenge the mentee on..."
              className="block w-full px-3 py-2 text-sm bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-60"
            >
              {creating ? 'Scheduling...' : 'Confirm & Schedule Session'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
