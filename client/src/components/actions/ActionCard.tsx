import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  History,
  CheckCircle2,
  Clock,
  Circle,
  MoreVertical,
  Trash2,
  Edit2,
} from 'lucide-react';
import { ActionItem } from '../../types';
import { PriorityBadge, CarryForwardBadge } from '../common/Badge';

interface ActionCardProps {
  action: ActionItem;
  onStatusChange: (actionId: string, status: string) => Promise<void>;
  onEdit?: (action: ActionItem) => void;
  onDelete?: (actionId: string) => void;
  onViewLineage?: (action: ActionItem) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  onStatusChange,
  onEdit,
  onDelete,
  onViewLineage,
}) => {
  const [updating, setUpdating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    !['completed', 'cancelled'].includes(action.status);

  const handleToggleCompleted = async () => {
    setUpdating(true);
    const newStatus = action.status === 'completed' ? 'pending' : 'completed';
    await onStatusChange(action._id, newStatus);
    setUpdating(false);
  };

  return (
    <div
      className={`group relative bg-white rounded-2xl p-4 border transition-all duration-200 shadow-2xs hover:shadow-md ${
        action.status === 'completed'
          ? 'border-emerald-200/60 bg-emerald-50/20'
          : isOverdue
          ? 'border-rose-200 bg-rose-50/10'
          : 'border-slate-200/90 hover:border-indigo-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Quick Checkbox button */}
        <button
          onClick={handleToggleCompleted}
          disabled={updating}
          className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
            action.status === 'completed'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
              : 'border-slate-300 hover:border-indigo-600 text-transparent hover:text-indigo-600'
          }`}
          title={action.status === 'completed' ? 'Mark uncompleted' : 'Mark completed'}
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4
              className={`text-sm font-semibold truncate ${
                action.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
              }`}
            >
              {action.title}
            </h4>

            {/* Menu options */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {onEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(action);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(action._id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {action.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{action.description}</p>
          )}

          {/* Badges & Meta Row */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-100">
            <PriorityBadge priority={action.priority} />

            {/* Status selector */}
            <select
              value={action.status}
              onChange={(e) => onStatusChange(action._id, e.target.value)}
              disabled={updating}
              className="text-[11px] font-medium rounded-lg border-slate-200 bg-slate-50 text-slate-700 px-2 py-0.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Carry Forward Badge */}
            {action.carryCount > 0 && (
              <button
                onClick={() => onViewLineage && onViewLineage(action)}
                className="hover:opacity-80 transition-opacity"
                title="Click to view full carry-forward history"
              >
                <CarryForwardBadge count={action.carryCount} />
              </button>
            )}

            {/* Due Date Alert */}
            {action.dueDate && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ml-auto ${
                  isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-500'
                }`}
              >
                {isOverdue ? (
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                ) : (
                  <Calendar className="w-3 h-3 text-slate-400" />
                )}
                {new Date(action.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
