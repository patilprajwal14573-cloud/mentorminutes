import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Users,
  Plus,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  Link2,
  RefreshCw,
  BarChart2,
  Settings2,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { MentoringRelationship } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/Badge';

interface RelationshipProgress {
  relationshipId: string;
  sessions: { total: number; completed: number; scheduled: number };
  goals: { total: number; completed: number; averageProgress: number };
  actions: { total: number; completed: number; open: number; overdue: number; completionRate: number };
}

type FrequencyType = 'Weekly' | 'Bi-weekly' | 'Monthly' | 'As-needed';
type RelStatusType = 'active' | 'paused' | 'completed';

const getApiError = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message || fallback;
  }
  return fallback;
};

export const RelationshipsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [relationships, setRelationships] = useState<MentoringRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Invite form state (for mentor)
  const [learnerEmail, setLearnerEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [meetingFrequency, setMeetingFrequency] = useState<FrequencyType>('Weekly');
  const [inviteError, setInviteError] = useState('');

  // Join form state (for learner)
  const [inviteCode, setInviteCode] = useState('');
  const [joinTopic, setJoinTopic] = useState('');
  const [joinError, setJoinError] = useState('');

  // Manage / Progress modal state
  const [selectedRel, setSelectedRel] = useState<MentoringRelationship | null>(null);
  const [editStatus, setEditStatus] = useState<RelStatusType>('active');
  const [editTopic, setEditTopic] = useState('');
  const [editFrequency, setEditFrequency] = useState<FrequencyType>('Weekly');
  const [manageError, setManageError] = useState('');
  const [savingManage, setSavingManage] = useState(false);

  const [progressRel, setProgressRel] = useState<MentoringRelationship | null>(null);
  const [progressData, setProgressData] = useState<RelationshipProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchRelationships = async () => {
    try {
      const res = await api.get('/relationships');
      if (res.data.success) {
        setRelationships(res.data.relationships);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelationships();
  }, []);

  // Pre-fill join modal if ?invite=CODE is passed via invitation link
  useEffect(() => {
    const inviteParam = searchParams.get('invite');
    if (inviteParam && user?.role === 'learner') {
      setInviteCode(inviteParam.toUpperCase());
      setShowJoinModal(true);
      searchParams.delete('invite');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, user?.role]);

  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    try {
      const res = await api.post('/relationships', {
        learnerEmail,
        topic,
        description,
        meetingFrequency,
      });
      if (res.data.success) {
        setShowInviteModal(false);
        setLearnerEmail('');
        setTopic('');
        setDescription('');
        fetchRelationships();
      }
    } catch (err: unknown) {
      setInviteError(getApiError(err, 'Failed to create relationship'));
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    try {
      const res = await api.post('/relationships/join-by-code', {
        inviteCode,
        topic: joinTopic || 'General Mentorship',
      });
      if (res.data.success) {
        setShowJoinModal(false);
        setInviteCode('');
        setJoinTopic('');
        fetchRelationships();
      }
    } catch (err: unknown) {
      setJoinError(getApiError(err, 'Failed to join with code'));
    }
  };

  const handleOpenManage = (rel: MentoringRelationship) => {
    setSelectedRel(rel);
    setEditStatus(rel.status);
    setEditTopic(rel.topic);
    setEditFrequency(rel.meetingFrequency);
    setManageError('');
  };

  const handleUpdateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRel) return;
    setSavingManage(true);
    setManageError('');
    try {
      const res = await api.put(`/relationships/${selectedRel._id}`, {
        topic: editTopic,
        status: editStatus,
        meetingFrequency: editFrequency,
      });
      if (res.data.success) {
        setSelectedRel(null);
        fetchRelationships();
      }
    } catch (err: unknown) {
      setManageError(getApiError(err, 'Failed to update relationship'));
    } finally {
      setSavingManage(false);
    }
  };

  const handleViewProgress = async (rel: MentoringRelationship) => {
    setProgressRel(rel);
    setProgressData(null);
    setProgressLoading(true);
    try {
      const res = await api.get(`/relationships/${rel._id}/progress`);
      if (res.data.success) {
        setProgressData(res.data.progress);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProgressLoading(false);
    }
  };

  const copyInviteCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyInviteLink = () => {
    if (user?.inviteCode) {
      const link = `${window.location.origin}/join/${user.inviteCode}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!window.confirm('Generate a new invite code? Your previous invite code and link will stop working.')) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await api.post('/relationships/regenerate-invite');
      if (res.data.success && res.data.user) {
        updateUser(res.data.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Mentorships..." />;

  const isMentor = user?.role === 'mentor';
  const filteredRelationships =
    statusFilter === 'all' ? relationships : relationships.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mentoring Connections</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isMentor
              ? 'Manage your mentees, invitation codes & links, and relationship status'
              : 'Your assigned mentors and learning workspaces'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMentor ? (
            <>
              {user?.inviteCode && (
                <>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                    title="Click to copy your mentor invite code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    Code: <span className="font-mono font-bold text-indigo-700">{user.inviteCode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-all"
                    title="Copy direct invitation link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Link Copied' : 'Copy Invite Link'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateInvite}
                    disabled={regenerating}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                    title="Regenerate invite code"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Learner
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <KeyRound className="w-4 h-4" /> Join via Code
            </button>
          )}
        </div>
      </div>

      {/* Status Filter */}
      {relationships.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'paused', 'completed'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {/* Relationships Grid */}
      {filteredRelationships.length === 0 ? (
        <EmptyState
          icon={Users}
          title={relationships.length === 0 ? 'No mentoring connections yet' : 'No relationships match this filter'}
          description={
            isMentor
              ? 'Invite a learner by email or share your mentor invite code/link to begin mentoring.'
              : 'Join a mentor using their unique invitation code or link.'
          }
          actionText={relationships.length === 0 ? (isMentor ? 'Add Learner' : 'Enter Invite Code') : undefined}
          onAction={
            relationships.length === 0
              ? () => (isMentor ? setShowInviteModal(true) : setShowJoinModal(true))
              : undefined
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredRelationships.map((rel) => {
            const partner = isMentor ? rel.learner : rel.mentor;
            return (
              <div
                key={rel._id}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {partner?.avatar ? (
                      <img
                        src={partner.avatar}
                        alt={partner.name}
                        className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-bold text-base flex items-center justify-center">
                        {partner?.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{partner?.name}</h3>
                      <p className="text-xs text-slate-500">{partner?.title || (isMentor ? 'Learner' : 'Mentor')}</p>
                      {partner?.companyOrSchool && (
                        <p className="text-[11px] text-slate-400">{partner.companyOrSchool}</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={rel.status} />
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 mb-4 text-xs space-y-1.5 border border-slate-100">
                  <p className="font-semibold text-slate-800">
                    Topic: <span className="font-normal text-slate-600">{rel.topic}</span>
                  </p>
                  {rel.description && (
                    <p className="text-slate-500 line-clamp-2">{rel.description}</p>
                  )}
                  <p className="text-slate-500">
                    Cadence: <strong className="text-slate-700">{rel.meetingFrequency}</strong>
                  </p>
                </div>

                <div className="mt-auto pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    Started {new Date(rel.startDate).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleViewProgress(rel)}
                      className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-indigo-700"
                    >
                      <BarChart2 className="w-3.5 h-3.5" /> Progress
                    </button>
                    {isMentor && (
                      <button
                        type="button"
                        onClick={() => handleOpenManage(rel)}
                        className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-indigo-700"
                      >
                        <Settings2 className="w-3.5 h-3.5" /> Manage
                      </button>
                    )}
                    <Link
                      to={`/sessions?relationshipId=${rel._id}`}
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Sessions <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Learner Modal (Mentor) */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Add Learner to Mentorship"
        subtitle="Establish a new 1:1 mentoring relationship"
      >
        <form onSubmit={handleCreateRelationship} className="space-y-4">
          {inviteError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {inviteError}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">Learner Email Address</label>
            <input
              type="email"
              required
              value={learnerEmail}
              onChange={(e) => setLearnerEmail(e.target.value)}
              placeholder="e.g. emily.chen@mentorminutes.dev"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Mentorship Topic / Focus</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Full-Stack Architecture & Career Prep"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Meeting Frequency</label>
            <select
              value={meetingFrequency}
              onChange={(e) => setMeetingFrequency(e.target.value as FrequencyType)}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Weekly">Weekly</option>
              <option value="Bi-weekly">Bi-weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="As-needed">As-needed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Objectives / Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key expectations and goals..."
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Create Mentorship
            </button>
          </div>
        </form>
      </Modal>

      {/* Join via Invite Code Modal (Learner) */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Connect via Mentor Invite Code"
        subtitle="Enter the code provided by your mentor (e.g. MM-ARCH99)"
      >
        <form onSubmit={handleJoinByCode} className="space-y-4">
          {joinError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {joinError}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">Mentor Invite Code</label>
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. MM-ARCH99"
              className="mt-1 block w-full font-mono uppercase px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Your Learning Focus</label>
            <input
              type="text"
              value={joinTopic}
              onChange={(e) => setJoinTopic(e.target.value)}
              placeholder="e.g. Backend Engineering & Mentorship"
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowJoinModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
            >
              Connect with Mentor
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Relationship Modal (Mentor) */}
      <Modal
        isOpen={!!selectedRel}
        onClose={() => setSelectedRel(null)}
        title="Manage Mentorship"
        subtitle={selectedRel ? `Learner: ${selectedRel.learner.name}` : ''}
      >
        <form onSubmit={handleUpdateRelationship} className="space-y-4">
          {manageError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {manageError}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">Mentorship Topic</label>
            <input
              type="text"
              required
              value={editTopic}
              onChange={(e) => setEditTopic(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as RelStatusType)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Frequency</label>
              <select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value as FrequencyType)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Weekly">Weekly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="As-needed">As-needed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedRel(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingManage}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-60"
            >
              {savingManage ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Progress Summary Modal */}
      <Modal
        isOpen={!!progressRel}
        onClose={() => setProgressRel(null)}
        title="Mentorship Progress Overview"
        subtitle={
          progressRel
            ? `${isMentor ? progressRel.learner.name : progressRel.mentor.name} — ${progressRel.topic}`
            : ''
        }
      >
        {progressLoading ? (
          <LoadingSpinner text="Calculating progress..." />
        ) : progressData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] text-slate-500">Sessions</p>
                <p className="text-xl font-black text-slate-900">{progressData.sessions.total}</p>
                <p className="text-[11px] text-emerald-600">{progressData.sessions.completed} completed</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] text-slate-500">Goal Progress</p>
                <p className="text-xl font-black text-indigo-600">{progressData.goals.averageProgress}%</p>
                <p className="text-[11px] text-slate-500">
                  {progressData.goals.completed}/{progressData.goals.total} goals done
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] text-slate-500">Action Rate</p>
                <p className="text-xl font-black text-emerald-600">{progressData.actions.completionRate}%</p>
                <p className="text-[11px] text-amber-600">{progressData.actions.overdue} overdue</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Link
                to={`/goals?relationshipId=${progressData.relationshipId}`}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                View Goals
              </Link>
              <Link
                to={`/sessions?relationshipId=${progressData.relationshipId}`}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
              >
                Open Sessions
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Unable to load progress details.</p>
        )}
      </Modal>
    </div>
  );
};
