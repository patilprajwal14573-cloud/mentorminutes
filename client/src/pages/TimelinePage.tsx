import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  History,
  Target,
  Award,
  ExternalLink,
} from 'lucide-react';
import api from '@/services/api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

interface TimelineEvent {
  id: string;
  type: 'session' | 'carry_forward' | 'action_completed' | 'goal_created' | 'goal_completed';
  title: string;
  description?: string;
  date: string;
  status?: string;
  metadata?: {
    sessionId?: string;
    carriedCount?: number;
    priority?: string;
    category?: string;
    progress?: number;
  };
}

export const TimelinePage: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await api.get('/reports/timeline');
        if (res.data.success) {
          setTimeline(res.data.timeline || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, []);

  if (loading) return <LoadingSpinner text="Loading Mentoring Journey Timeline..." />;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'session':
        return <Calendar className="w-4 h-4 text-indigo-600" />;
      case 'carry_forward':
        return <History className="w-4 h-4 text-amber-600" />;
      case 'action_completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'goal_created':
        return <Target className="w-4 h-4 text-sky-600" />;
      case 'goal_completed':
        return <Award className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'session':
        return 'border-indigo-500 bg-indigo-50';
      case 'carry_forward':
        return 'border-amber-500 bg-amber-50';
      case 'action_completed':
        return 'border-emerald-500 bg-emerald-50';
      case 'goal_created':
        return 'border-sky-500 bg-sky-50';
      case 'goal_completed':
        return 'border-purple-500 bg-purple-50';
      default:
        return 'border-slate-300 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mentoring Journey Timeline</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Chronological record of sessions held, goals created & reached, and actions carried forward
        </p>
      </div>

      {timeline.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Timeline is empty"
          description="As you schedule sessions and complete milestones, your journey will unfold here."
        />
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:inset-0 before:left-3 sm:before:left-4 before:w-0.5 before:bg-slate-200">
          {timeline.map((event) => (
            <div key={event.id} className="relative flex items-start gap-4 group">
              {/* Dot node */}
              <div
                className={`absolute -left-6 sm:-left-8 w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10 shadow-xs ${getNodeColor(
                  event.type
                )}`}
              >
                {getEventIcon(event.type)}
              </div>

              {/* Event card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <h3 className="text-sm font-bold text-slate-900">{event.title}</h3>
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(event.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {event.description && (
                  <p className="text-xs text-slate-600 line-clamp-3">{event.description}</p>
                )}

                {/* Additional event tags & link */}
                {(event.metadata || event.status) && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.metadata?.carriedCount !== undefined && event.metadata.carriedCount > 0 && (
                        <span className="bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-md border border-amber-200">
                          {event.metadata.carriedCount} tasks carried
                        </span>
                      )}
                      {event.metadata?.priority && (
                        <span className="capitalize font-medium">Priority: {event.metadata.priority}</span>
                      )}
                      {event.metadata?.category && (
                        <span className="capitalize font-medium">Category: {event.metadata.category}</span>
                      )}
                    </div>
                    {event.metadata?.sessionId && (
                      <Link
                        to={`/sessions/${event.metadata.sessionId}`}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Open Session <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
