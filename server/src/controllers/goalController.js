const Goal = require('../models/Goal');
const MentoringRelationship = require('../models/MentoringRelationship');
const Notification = require('../models/Notification');

// Helper: verify requesting user is a participant in the relationship
const verifyRelationshipAccess = async (relationshipId, userId) => {
  const relationship = await MentoringRelationship.findById(relationshipId);
  if (!relationship) {
    return { errorStatus: 404, errorMessage: 'Relationship not found' };
  }
  const isParticipant =
    relationship.mentor.toString() === userId.toString() ||
    relationship.learner.toString() === userId.toString();
  if (!isParticipant) {
    return { errorStatus: 403, errorMessage: 'Not authorized to access this relationship' };
  }
  return { relationship };
};

// Recalculate progress based on milestones
const updateProgress = (goal) => {
  if (!goal.milestones || goal.milestones.length === 0) {
    return;
  }
  const completed = goal.milestones.filter((m) => m.completed).length;
  goal.progress = Math.round((completed / goal.milestones.length) * 100);

  if (goal.progress === 100 && goal.status !== 'completed') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  } else if (goal.progress < 100 && goal.status === 'completed') {
    goal.status = 'in-progress';
    goal.completedAt = null;
  }
};

// Notify mentor and learner when a goal reaches completion
const notifyGoalCompleted = async (goal, relationship, actor) => {
  if (goal.status !== 'completed') return;
  const recipients = [relationship.mentor, relationship.learner].filter(
    (id) => id.toString() !== actor._id.toString()
  );
  await Promise.all(
    recipients.map((recipient) =>
      Notification.create({
        recipient,
        title: 'Goal Completed!',
        message: `${actor.name} marked goal "${goal.title}" as completed`,
        type: 'goal',
        link: '/goals',
      })
    )
  );
};

// @route   GET /api/goals
exports.getGoals = async (req, res, next) => {
  try {
    const { relationshipId, status, category, priority, overdue } = req.query;
    const filter = {};

    if (relationshipId) {
      const access = await verifyRelationshipAccess(relationshipId, req.user._id);
      if (access.errorStatus) {
        return res.status(access.errorStatus).json({
          success: false,
          message: access.errorMessage,
        });
      }
      filter.relationship = relationshipId;
    } else {
      const userRelationships = await MentoringRelationship.find({
        $or: [{ mentor: req.user._id }, { learner: req.user._id }],
      }).select('_id');
      filter.relationship = { $in: userRelationships.map((r) => r._id) };
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (overdue === 'true') {
      filter.status = { $ne: 'completed' };
      filter.targetDate = { $lt: new Date() };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [goals, total] = await Promise.all([
      Goal.find(filter)
        .populate('createdBy', 'name email avatar role')
        .populate('assignedTo', 'name email avatar role')
        .populate({
          path: 'relationship',
          populate: [
            { path: 'mentor', select: 'name email avatar' },
            { path: 'learner', select: 'name email avatar' },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Goal.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: goals.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      goals,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/goals/:id
exports.getGoalById = async (req, res, next) => {
  try {
    const goal = await Goal.findById(req.params.id)
      .populate('createdBy', 'name email avatar role')
      .populate('assignedTo', 'name email avatar role')
      .populate({
        path: 'relationship',
        populate: [
          { path: 'mentor', select: 'name email avatar' },
          { path: 'learner', select: 'name email avatar' },
        ],
      });

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const isParticipant =
      goal.relationship.mentor._id.toString() === req.user._id.toString() ||
      goal.relationship.learner._id.toString() === req.user._id.toString();
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this goal' });
    }

    res.status(200).json({
      success: true,
      goal,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/goals
exports.createGoal = async (req, res, next) => {
  try {
    const {
      relationshipId,
      title,
      description = '',
      category = 'technical',
      priority = 'medium',
      startDate,
      targetDate,
      assignedTo,
      milestones = [],
      progress = 0,
    } = req.body;

    const access = await verifyRelationshipAccess(relationshipId, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({
        success: false,
        message: access.errorMessage,
      });
    }
    const { relationship } = access;

    const formattedMilestones = Array.isArray(milestones)
      ? milestones.map((m) => (typeof m === 'string' ? { title: m, completed: false } : m))
      : [];

    const clampedProgress = Math.min(100, Math.max(0, Number(progress) || 0));

    const goal = new Goal({
      relationship: relationshipId,
      createdBy: req.user._id,
      assignedTo: assignedTo || relationship.learner,
      title,
      description,
      category,
      priority,
      startDate: startDate || new Date(),
      targetDate,
      milestones: formattedMilestones,
      progress: clampedProgress,
    });

    updateProgress(goal);
    if (goal.milestones.length === 0 && clampedProgress > 0) {
      goal.status = clampedProgress === 100 ? 'completed' : 'in-progress';
      if (clampedProgress === 100) goal.completedAt = new Date();
    }
    await goal.save();

    const recipientId =
      req.user.role === 'mentor' ? relationship.learner : relationship.mentor;
    await Notification.create({
      recipient: recipientId,
      title: 'New Goal Created',
      message: `${req.user.name} created goal: "${title}"`,
      type: 'goal',
      link: '/goals',
    });

    const populated = await Goal.findById(goal._id)
      .populate('createdBy', 'name email avatar')
      .populate('assignedTo', 'name email avatar role');

    res.status(201).json({
      success: true,
      goal: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PUT /api/goals/:id
exports.updateGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const access = await verifyRelationshipAccess(goal.relationship, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({
        success: false,
        message: access.errorMessage,
      });
    }

    const wasCompleted = goal.status === 'completed';
    const {
      title,
      description,
      category,
      priority,
      status,
      progress,
      targetDate,
      completionNotes,
    } = req.body;

    if (title !== undefined) goal.title = title;
    if (description !== undefined) goal.description = description;
    if (category !== undefined) goal.category = category;
    if (priority !== undefined) goal.priority = priority;
    if (status !== undefined) goal.status = status;
    if (progress !== undefined && (!goal.milestones || goal.milestones.length === 0)) {
      goal.progress = Math.min(100, Math.max(0, Number(progress)));
    }
    if (targetDate !== undefined) goal.targetDate = targetDate;
    if (completionNotes !== undefined) goal.completionNotes = completionNotes;

    if (status === 'completed') {
      if (!goal.completedAt) goal.completedAt = new Date();
      goal.progress = 100;
    } else if (status && status !== 'completed') {
      goal.completedAt = null;
    }

    await goal.save();

    if (!wasCompleted && goal.status === 'completed') {
      await notifyGoalCompleted(goal, access.relationship, req.user);
    }

    res.status(200).json({
      success: true,
      goal,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PATCH /api/goals/:id/milestones/:milestoneId
exports.toggleMilestone = async (req, res, next) => {
  try {
    const goalId = req.params.id || req.params.goalId;
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const access = await verifyRelationshipAccess(goal.relationship, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({
        success: false,
        message: access.errorMessage,
      });
    }

    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    const wasCompleted = goal.status === 'completed';
    milestone.completed = !milestone.completed;
    milestone.completedAt = milestone.completed ? new Date() : null;

    updateProgress(goal);
    await goal.save();

    if (!wasCompleted && goal.status === 'completed') {
      await notifyGoalCompleted(goal, access.relationship, req.user);
    }

    res.status(200).json({
      success: true,
      goal,
      message: `Milestone "${milestone.title}" ${milestone.completed ? 'completed' : 'uncompleted'}`,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/goals/:id/milestones
exports.addMilestone = async (req, res, next) => {
  try {
    const goalId = req.params.id || req.params.goalId;
    const { title, dueDate } = req.body;
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const access = await verifyRelationshipAccess(goal.relationship, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({
        success: false,
        message: access.errorMessage,
      });
    }

    goal.milestones.push({
      title,
      dueDate: dueDate || null,
      completed: false,
    });

    updateProgress(goal);
    await goal.save();

    res.status(201).json({
      success: true,
      goal,
    });
  } catch (err) {
    next(err);
  }
};

// @route   DELETE /api/goals/:id/milestones/:milestoneId
exports.deleteMilestone = async (req, res, next) => {
  try {
    const goalId = req.params.id || req.params.goalId;
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const access = await verifyRelationshipAccess(goal.relationship, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({
        success: false,
        message: access.errorMessage,
      });
    }

    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    milestone.deleteOne();
    updateProgress(goal);
    await goal.save();

    res.status(200).json({
      success: true,
      goal,
    });
  } catch (err) {
    next(err);
  }
};

// @route   DELETE /api/goals/:id
exports.deleteGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const access = await verifyRelationshipAccess(goal.relationship, req.user._id);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({
        success: false,
        message: access.errorMessage,
      });
    }

    await Goal.findByIdAndDelete(goal._id);

    res.status(200).json({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};
