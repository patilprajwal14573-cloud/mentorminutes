import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MentorDashboard } from './MentorDashboard';
import { LearnerDashboard } from './LearnerDashboard';

export const DashboardDispatcher: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'mentor') {
    return <MentorDashboard />;
  }
  return <LearnerDashboard />;
};
