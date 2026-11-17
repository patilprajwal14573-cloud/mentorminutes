export type UserRole = 'mentor' | 'learner';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  bio?: string;
  avatar?: string;
  companyOrSchool?: string;
  expertise?: string[];
  interests?: string[];
  inviteCode?: string;
  settings?: {
    emailNotifications: boolean;
    sessionReminders: boolean;
    theme: 'light' | 'dark' | 'system';
  };
  createdAt: string;
}

export interface MentoringRelationship {
  _id: string;
  mentor: User;
  learner: User;
  topic: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  meetingFrequency: 'Weekly' | 'Bi-weekly' | 'Monthly' | 'As-needed';
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  _id: string;
  relationship: MentoringRelationship;
  sessionNumber: number;
  title: string;
  scheduledDate: string;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  agenda?: string;
  topicsDiscussed?: string;
  keyTakeaways?: string;
  sharedSummary?: string;
  learnerFeedback?: string;
  mentorPrivateNotes?: string; // Only present if requesting user is mentor
  nextSessionDate?: string;
  carriedActionsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CarryHistoryEntry {
  carriedAt: string;
  fromSession: { _id: string; sessionNumber: number; title: string } | string;
  toSession: { _id: string; sessionNumber: number; title: string } | string;
  reason: string;
}

export interface ActionItem {
  _id: string;
  relationship: string | MentoringRelationship;
  session: { _id: string; sessionNumber: number; title: string; scheduledDate: string };
  title: string;
  description?: string;
  assignedTo: User;
  assignedToRole: 'mentor' | 'learner';
  createdBy: User;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  completedAt?: string;
  carried: boolean;
  carriedForwardFrom?: ActionItem | string;
  originalSession?: { _id: string; sessionNumber: number; title: string; scheduledDate: string };
  carryCount: number;
  carryHistory?: CarryHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  _id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  completedAt?: string;
}

export interface Goal {
  _id: string;
  relationship: string | MentoringRelationship;
  createdBy: User;
  title: string;
  description?: string;
  category: 'technical' | 'career' | 'project' | 'soft-skills' | 'academic' | 'other';
  priority: 'low' | 'medium' | 'high';
  startDate: string;
  targetDate?: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold';
  progress: number;
  milestones: Milestone[];
  completionNotes?: string;
  completedAt?: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  recipient: string;
  title: string;
  message: string;
  type: 'session' | 'action' | 'goal' | 'relationship' | 'system';
  link?: string;
  read: boolean;
  createdAt: string;
}
