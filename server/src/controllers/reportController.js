const MentoringRelationship = require('../models/MentoringRelationship');
const Session = require('../models/Session');
const ActionItem = require('../models/ActionItem');
const Goal = require('../models/Goal');

// @route   GET /api/reports/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const isMentor = req.user.role === 'mentor';
    const now = new Date();

    // Find relationships
    const relFilter = isMentor ? { mentor: req.user._id } : { learner: req.user._id };
    const relationships = await MentoringRelationship.find(relFilter)
      .populate('mentor', 'name email avatar title')
      .populate('learner', 'name email avatar title');

    const relationshipIds = relationships.map((r) => r._id);

    // Queries scoped to user's relationships
    const [
      totalSessions,
      upcomingSessions,
      completedSessions,
      allActions,
      allGoals,
    ] = await Promise.all([
      Session.countDocuments({ relationship: { $in: relationshipIds } }),
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
      Session.countDocuments({
        relationship: { $in: relationshipIds },
        status: 'completed',
      }),
      ActionItem.find({ relationship: { $in: relationshipIds } }).populate('assignedTo', 'name role'),
      Goal.find({ relationship: { $in: relationshipIds } }),
    ]);

    // Action calculations
    const pendingActions = allActions.filter((a) => a.status === 'pending').length;
    const inProgressActions = allActions.filter((a) => a.status === 'in-progress').length;
    const completedActions = allActions.filter((a) => a.status === 'completed').length;
    const overdueActions = allActions.filter(
      (a) => ['pending', 'in-progress'].includes(a.status) && a.dueDate && new Date(a.dueDate) < now
    ).length;
    const carriedActions = allActions.filter((a) => a.carryCount > 0).length;

    // Goal calculations
    const activeGoals = allGoals.filter((g) => ['not-started', 'in-progress'].includes(g.status)).length;
    const completedGoals = allGoals.filter((g) => g.status === 'completed').length;
    const avgGoalProgress =
      allGoals.length > 0
        ? Math.round(allGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / allGoals.length)
        : 0;

    // Category breakdown
    const goalCategories = allGoals.reduce((acc, g) => {
      acc[g.category] = (acc[g.category] || 0) + 1;
      return acc;
    }, {});

    // Action priority breakdown
    const actionPriorities = allActions.reduce((acc, a) => {
      acc[a.priority] = (acc[a.priority] || 0) + 1;
      return acc;
    }, {});

    // Recent activity list
    const recentCompletedActions = allActions
      .filter((a) => a.status === 'completed' && a.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5);

    // Recent sessions with feedback
    const recentFeedbackSessions = await Session.find({
      relationship: { $in: relationshipIds },
      learnerFeedback: { $ne: '' },
    })
      .sort({ scheduledDate: -1 })
      .limit(3)
      .select('title scheduledDate learnerFeedback');

    const stats = {
      isMentor,
      totalLearners: isMentor ? relationships.length : 1,
      totalRelationships: relationships.length,
      relationships,
      totalSessions,
      completedSessions,
      upcomingSessions,
      actions: {
        total: allActions.length,
        pending: pendingActions,
        inProgress: inProgressActions,
        completed: completedActions,
        overdue: overdueActions,
        carriedForward: carriedActions,
        completionRate:
          allActions.length > 0 ? Math.round((completedActions / allActions.length) * 100) : 0,
      },
      goals: {
        total: allGoals.length,
        active: activeGoals,
        completed: completedGoals,
        averageProgress: avgGoalProgress,
        categories: goalCategories,
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
    const relIds = relationships.map((r) => r._id);

    const [sessions, actions, goals] = await Promise.all([
      Session.find({ relationship: { $in: relIds } }).sort({ scheduledDate: -1 }),
      ActionItem.find({ relationship: { $in: relIds } }).populate('session', 'sessionNumber title'),
      Goal.find({ relationship: { $in: relIds } }),
    ]);

    // Build unified chronological timeline events
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
          sessionNumber: s.sessionNumber,
          duration: s.durationMinutes,
          carriedCount: s.carriedActionsCount,
        },
      });
    });

    // Action carry forward events
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
          description: `Completed task originally from Session`,
          date: a.completedAt,
          metadata: {
            priority: a.priority,
          },
        });
      }
    });

    // Goal achievements
    goals.forEach((g) => {
      if (g.status === 'completed' && g.completedAt) {
        timeline.push({
          id: `goal-done-${g._id}`,
          type: 'goal_completed',
          title: `Goal Achieved: "${g.title}" 🎯`,
          description: g.completionNotes || `Finished with 100% progress`,
          date: g.completedAt,
          metadata: {
            category: g.category,
          },
        });
      }
    });

    // Sort descending by date
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
