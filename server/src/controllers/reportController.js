const MentoringRelationship = require('../models/MentoringRelationship');
const Session = require('../models/Session');
const ActionItem = require('../models/ActionItem');
const Goal = require('../models/Goal');

// @route   GET /api/reports/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const isMentor = req.user.role === 'mentor';
    const now = new Date();
    const { relationshipId, learnerId, startDate, endDate, goalStatus, sessionStatus } = req.query;

    const relFilter = isMentor ? { mentor: req.user._id } : { learner: req.user._id };
    if (learnerId && isMentor) {
      relFilter.learner = learnerId;
    }

    const allUserRelationships = await MentoringRelationship.find(
      isMentor ? { mentor: req.user._id } : { learner: req.user._id }
    )
      .populate('mentor', 'name email avatar title')
      .populate('learner', 'name email avatar title');

    let scopedRelationships = allUserRelationships;
    if (relationshipId) {
      const match = allUserRelationships.find((r) => r._id.toString() === relationshipId);
      if (!match) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view reports for this relationship',
        });
      }
      scopedRelationships = [match];
    } else if (learnerId && isMentor) {
      scopedRelationships = allUserRelationships.filter(
        (r) => r.learner && r.learner._id.toString() === learnerId
      );
    }

    const relationshipIds = scopedRelationships.map((r) => r._id);

    // Build optional date range filters
    const dateQuery = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) dateQuery.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
    }
    const hasDateFilter = Object.keys(dateQuery).length > 0;

    const sessionFilter = { relationship: { $in: relationshipIds } };
    if (sessionStatus && sessionStatus !== 'all') sessionFilter.status = sessionStatus;
    if (hasDateFilter) sessionFilter.scheduledDate = dateQuery;

    const actionFilter = { relationship: { $in: relationshipIds } };
    if (hasDateFilter) actionFilter.createdAt = dateQuery;

    const goalFilter = { relationship: { $in: relationshipIds } };
    if (goalStatus && goalStatus !== 'all') goalFilter.status = goalStatus;
    if (hasDateFilter) goalFilter.createdAt = dateQuery;

    const [allScopedSessions, upcomingSessions, allActions, allGoals] = await Promise.all([
      Session.find(sessionFilter).select('status scheduledDate learnerFeedback title'),
      Session.find({
        relationship: { $in: relationshipIds },
        scheduledDate: { $gte: now },
        status: 'scheduled',
      })
        .populate({
          path: 'relationship',
          populate: [
            { path: 'mentor', select: 'name email avatar' },
            { path: 'learner', select: 'name email avatar' },
          ],
        })
        .sort({ scheduledDate: 1 })
        .limit(5),
      ActionItem.find(actionFilter).populate('assignedTo', 'name role'),
      Goal.find(goalFilter),
    ]);

    const totalSessions = allScopedSessions.length;
    const completedSessions = allScopedSessions.filter((s) => s.status === 'completed').length;
    const scheduledSessions = allScopedSessions.filter((s) => s.status === 'scheduled').length;
    const cancelledSessions = allScopedSessions.filter((s) => s.status === 'cancelled').length;

    // Action calculations
    const pendingActions = allActions.filter((a) => a.status === 'pending').length;
    const inProgressActions = allActions.filter((a) => a.status === 'in-progress').length;
    const completedActions = allActions.filter((a) => a.status === 'completed').length;
    const cancelledActions = allActions.filter((a) => a.status === 'cancelled').length;
    const overdueActions = allActions.filter(
      (a) => ['pending', 'in-progress'].includes(a.status) && a.dueDate && new Date(a.dueDate) < now
    ).length;
    const carriedActions = allActions.filter((a) => a.carryCount > 0).length;

    // Goal calculations
    const activeGoals = allGoals.filter((g) => ['not-started', 'in-progress'].includes(g.status)).length;
    const completedGoals = allGoals.filter((g) => g.status === 'completed').length;
    const overdueGoals = allGoals.filter(
      (g) => g.status !== 'completed' && g.targetDate && new Date(g.targetDate) < now
    ).length;
    const avgGoalProgress =
      allGoals.length > 0
        ? Math.round(allGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / allGoals.length)
        : 0;

    const recentlyCompletedGoals = allGoals
      .filter((g) => g.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt))
      .slice(0, 5);

    const goalCategories = allGoals.reduce((acc, g) => {
      acc[g.category] = (acc[g.category] || 0) + 1;
      return acc;
    }, {});

    const actionPriorities = allActions.reduce((acc, a) => {
      acc[a.priority] = (acc[a.priority] || 0) + 1;
      return acc;
    }, {});

    const recentCompletedActions = allActions
      .filter((a) => a.status === 'completed' && a.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5);

    const recentFeedbackSessions = await Session.find({
      relationship: { $in: relationshipIds },
      learnerFeedback: { $ne: '' },
    })
      .sort({ scheduledDate: -1 })
      .limit(3)
      .select('title scheduledDate learnerFeedback');

    const stats = {
      isMentor,
      totalLearners: isMentor ? scopedRelationships.length : 1,
      totalRelationships: scopedRelationships.length,
      relationships: allUserRelationships,
      totalSessions,
      completedSessions,
      scheduledSessions,
      cancelledSessions,
      upcomingSessions,
      actions: {
        total: allActions.length,
        pending: pendingActions,
        inProgress: inProgressActions,
        completed: completedActions,
        cancelled: cancelledActions,
        overdue: overdueActions,
        carriedForward: carriedActions,
        completionRate:
          allActions.length > 0 ? Math.round((completedActions / allActions.length) * 100) : 0,
      },
      goals: {
        total: allGoals.length,
        active: activeGoals,
        completed: completedGoals,
        overdue: overdueGoals,
        averageProgress: avgGoalProgress,
        categories: goalCategories,
        recentlyCompleted: recentlyCompletedGoals,
      },
      actionPriorities,
      recentCompletedActions,
      recentFeedbackSessions,
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/reports/timeline
exports.getTimeline = async (req, res, next) => {
  try {
    const { relationshipId } = req.query;
    const relFilter = req.user.role === 'mentor' ? { mentor: req.user._id } : { learner: req.user._id };

    if (relationshipId) {
      relFilter._id = relationshipId;
    }

    const relationships = await MentoringRelationship.find(relFilter);
    if (relationshipId && relationships.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view timeline for this relationship',
      });
    }

    const relIds = relationships.map((r) => r._id);

    const [sessions, actions, goals] = await Promise.all([
      Session.find({ relationship: { $in: relIds } }).sort({ scheduledDate: -1 }),
      ActionItem.find({ relationship: { $in: relIds } }).populate('session', 'sessionNumber title'),
      Goal.find({ relationship: { $in: relIds } }),
    ]);

    const timeline = [];

    // Session events
    sessions.forEach((s) => {
      timeline.push({
        id: `session-${s._id}`,
        type: 'session',
        title: `Session #${s.sessionNumber}: ${s.title}`,
        description: s.sharedSummary || s.agenda || 'Mentoring session',
        date: s.scheduledDate,
        status: s.status,
        metadata: {
          sessionId: s._id,
          sessionNumber: s.sessionNumber,
          duration: s.durationMinutes,
          carriedCount: s.carriedActionsCount,
        },
      });
    });

    // Action carry-forward & completion events
    actions.forEach((a) => {
      if (a.carryHistory && a.carryHistory.length > 0) {
        a.carryHistory.forEach((h, idx) => {
          timeline.push({
            id: `carry-${a._id}-${idx}`,
            type: 'carry_forward',
            title: `Action Carried Forward: "${a.title}"`,
            description: h.reason,
            date: h.carriedAt,
            metadata: {
              actionId: a._id,
              sessionId: a.session?._id || a.session,
              carryCount: a.carryCount,
              priority: a.priority,
            },
          });
        });
      }
      if (a.completedAt) {
        timeline.push({
          id: `action-done-${a._id}`,
          type: 'action_completed',
          title: `Action Completed: "${a.title}"`,
          description: a.session?.title
            ? `Completed task from ${a.session.title}`
            : 'Completed action item',
          date: a.completedAt,
          metadata: {
            priority: a.priority,
            sessionId: a.session?._id || a.session,
          },
        });
      }
    });

    // Goal creation & completion events
    goals.forEach((g) => {
      timeline.push({
        id: `goal-created-${g._id}`,
        type: 'goal_created',
        title: `Goal Created: "${g.title}"`,
        description: `${g.category} goal (${g.progress}% progress)`,
        date: g.createdAt,
        metadata: {
          category: g.category,
          progress: g.progress,
        },
      });
      if (g.status === 'completed' && g.completedAt) {
        timeline.push({
          id: `goal-done-${g._id}`,
          type: 'goal_completed',
          title: `Goal Achieved: "${g.title}"`,
          description: g.completionNotes || 'Finished with 100% progress',
          date: g.completedAt,
          metadata: {
            category: g.category,
          },
        });
      }
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      count: timeline.length,
      timeline,
    });
  } catch (err) {
    next(err);
  }
};
