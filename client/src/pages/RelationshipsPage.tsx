import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Plus,
  KeyRound,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Mail,
} from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { MentoringRelationship } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge, StatusBadge } from '@/components/common/Badge';

export const RelationshipsPage: React.FC = () => {
  const { user } = useAuth();
  const [relationships, setRelationships] = useState<MentoringRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Invite form state (for mentor)
  const [learnerEmail, setLearnerEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [meetingFrequency, setMeetingFrequency] = useState<'Weekly' | 'Bi-weekly' | 'Monthly' | 'As-needed'>('Weekly');
  const [inviteError, setInviteError] = useState('');

  // Join form state (for learner)
  const [inviteCode, setInviteCode] = useState('');
  const [joinTopic, setJoinTopic] = useState('');
  const [joinError, setJoinError] = useState('');

  const [copiedCode, setCopiedCode] = useState(false);

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
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Failed to create relationship');
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
    } catch (err: any) {
      setJoinError(err.response?.data?.message || 'Failed to join with code');
    }
  };

  const copyInviteCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Mentorships..." />;

  const isMentor = user?.role === 'mentor';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mentoring Connections</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isMentor
              ? 'Manage your active mentees, invitation codes, and relationship agendas'
              : 'Your assigned mentors and learning workspaces'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isMentor ? (
            <>
              {user?.inviteCode && (
                <button
                  onClick={copyInviteCode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                  title="Click to copy your mentor invite code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Code: <span className="font-mono font-bold text-indigo-700">{user.inviteCode}</span>
                </button>
              )}
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Learner
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowJoinModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <KeyRound className="w-4 h-4" /> Join via Code
            </button>
          )}
        </div>
      </div>

      {/* Relationships Grid */}
      {relationships.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No mentoring connections yet"
          description={
            isMentor
              ? 'Invite a learner by email or share your mentor invite code to begin mentoring.'
              : 'Join a mentor using their unique invitation code (e.g. MM-ARCH99).'
          }
          actionText={isMentor ? 'Add Learner' : 'Enter Invite Code'}
          onAction={() => (isMentor ? setShowInviteModal(true) : setShowJoinModal(true))}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {relationships.map((rel) => {
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

                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Started {new Date(rel.startDate).toLocaleDateString()}
                  </span>
                  <Link
                    to={`/sessions?relationshipId=${rel._id}`}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    View Sessions <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
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
              onChange={(e) => setMeetingFrequency(e.target.value as any)}
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
    </div>
  );
};
