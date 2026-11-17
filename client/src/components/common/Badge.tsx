import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/60',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/60',
    info: 'bg-sky-50 text-sky-700 border-sky-200/60',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/60',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'achieved':
      return <Badge variant="success">Completed</Badge>;
    case 'in-progress':
      return <Badge variant="primary">In Progress</Badge>;
    case 'pending':
    case 'scheduled':
    case 'not-started':
      return <Badge variant="warning">{status === 'scheduled' ? 'Scheduled' : 'Pending'}</Badge>;
    case 'cancelled':
    case 'dropped':
      return <Badge variant="danger">Cancelled</Badge>;
    case 'on-hold':
    case 'paused':
      return <Badge variant="neutral">On Hold</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  switch (priority.toLowerCase()) {
    case 'high':
      return <Badge variant="danger">High Priority</Badge>;
    case 'medium':
      return <Badge variant="warning">Medium</Badge>;
    case 'low':
      return <Badge variant="info">Low</Badge>;
    default:
      return <Badge variant="neutral">{priority}</Badge>;
  }
};

export const CarryForwardBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      Carried {count > 1 ? `x${count}` : ''}
    </span>
  );
};
