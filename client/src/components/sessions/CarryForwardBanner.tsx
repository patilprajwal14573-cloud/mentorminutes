import React, { useState } from 'react';
import { ArrowRight, History, CheckCircle2, AlertCircle } from 'lucide-react';
import { ActionItem } from '../../types';
import { Modal } from '../common/Modal';
import { PriorityBadge, StatusBadge } from '../common/Badge';

interface CarryForwardBannerProps {
  carriedActions: ActionItem[];
  currentSessionNumber: number;
}

export const CarryForwardBanner: React.FC<CarryForwardBannerProps> = ({
  carriedActions,
  currentSessionNumber,
}) => {
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);

  if (!carriedActions || carriedActions.length === 0) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-900">
                  Automatic Action Carry-Forward
                </h4>
                <span className="bg-amber-200/80 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {carriedActions.length} {carriedActions.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              <p className="text-xs text-amber-700/90 mt-0.5">
                Unfinished actions from the previous session were automatically transferred to Session #{currentSessionNumber} follow-up.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {carriedActions.map((item) => (
              <button
                key={item._id}
                onClick={() => setSelectedAction(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium shadow-2xs transition-all shrink-0"
              >
                <span className="truncate max-w-[140px]">{item.title}</span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                  x{item.carryCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lineage & History Modal */}
      {selectedAction && (
        <Modal
          isOpen={!!selectedAction}
          onClose={() => setSelectedAction(null)}
          title="Action Item Carry-Forward Lineage"
          subtitle={`Tracking the lifecycle and session continuity of this action`}
        >
          <div className="space-y-5">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-base font-semibold text-slate-900">
                  {selectedAction.title}
                </h4>
                <StatusBadge status={selectedAction.status} />
              </div>
              {selectedAction.description && (
                <p className="text-xs text-slate-600 mb-3">{selectedAction.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <PriorityBadge priority={selectedAction.priority} />
                <span>
                  Assigned to: <strong className="text-slate-700">{selectedAction.assignedTo?.name || 'Learner'}</strong>
                </span>
                <span>
                  Total Carries: <strong className="text-amber-700 font-bold">{selectedAction.carryCount}</strong>
                </span>
              </div>
            </div>

            {/* Carry History Trail */}
            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Lifecycle & Carry-Forward Timeline
              </h5>
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {/* Original Creation */}
                <div className="relative flex items-start gap-3 pl-1">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 border-2 border-indigo-500 text-indigo-600 flex items-center justify-center shrink-0 z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 w-full text-xs shadow-2xs">
                    <p className="font-semibold text-slate-800">
                      Originally Created in Session #{selectedAction.originalSession?.sessionNumber || 1}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Session: {selectedAction.originalSession?.title || 'Initial Session'}
                    </p>
                  </div>
                </div>

                {/* Historical Carries */}
                {selectedAction.carryHistory?.map((hist, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 pl-1">
                    <div className="w-6 h-6 rounded-full bg-amber-50 border-2 border-amber-500 text-amber-600 flex items-center justify-center shrink-0 z-10">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/70 w-full text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-900">
                          Carried Forward #{idx + 1}
                        </span>
                        <span className="text-[11px] text-amber-700">
                          {new Date(hist.carriedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-amber-800 mt-1">{hist.reason}</p>
                    </div>
                  </div>
                ))}

                {/* Current State in this Session */}
                <div className="relative flex items-start gap-3 pl-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center shrink-0 z-10">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-200/80 w-full text-xs shadow-2xs">
                    <p className="font-semibold text-emerald-900">
                      Active in Current Session #{currentSessionNumber}
                    </p>
                    <p className="text-emerald-700 text-[11px] mt-0.5">
                      Status: <strong className="capitalize">{selectedAction.status}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
