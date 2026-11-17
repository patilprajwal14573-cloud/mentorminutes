const Goal = require('../models/Goal');
const MentoringRelationship = require('../models/MentoringRelationship');
const Notification = require('../models/Notification');

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

// @route   GET /api/goals
exports.getGoals = async (req, res, next) => {
  try {
    const { relationshipId, status, category, priority } = req.query;
    const filter = {};

    if (relationshipId) filter.relationship = relationshipId;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    if (!relationshipId) {
      const userRelationships = await MentoringRelationship.find({
        $or: [{ mentor: req.user._id }, { learner: req.user._id }],
      }).select('_id');
      filter.relationship = { $in: userRelationships.map((r) => r._id) };
    }

    const goals = await Goal.find(filter)
      .populate('createdBy', 'name email avatar role')
      .populate({
        path: 'relationship',
        populate: [
          { path: 'mentor', select: 'name email avatar' },
          { path: 'learner', select: 'name email avatar' },
        ],
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: goals.length,
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
      milestones = [],
      progress = 0,
    } = req.body;

    const relationship = await MentoringRelationship.findById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ success: false, message: 'Relationship not found' });
    }

    const formattedMilestones = Array.isArray(milestones)
      ? milestones.map((m) => (typeof m === 'string' ? { title: m, completed: false } : m))
      : [];

    const goal = new Goal({
      relationship: relationshipId,
      createdBy: req.user._id,
      title,
      description,
      category,
      priority,
      startDate: startDate || new Date(),
      targetDate,
      milestones: formattedMilestones,
      progress,
    });

    updateProgress(goal);
    await goal.save();

    // Notify other party
    const recipientId =
      req.user.role === 'mentor' ? relationship.learner : relationship.mentor;
    await Notification.create({
      recipient: recipientId,
      title: 'New Goal Created',
      message: `${req.user.name} created goal: "${title}"`,
      type: 'goal',
      link: `/goals`,
    });

    const populated = await Goal.findById(goal._id).populate(
      'createdBy',
      'name email avatar'
    );

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
    if (progress !== undefined) goal.progress = progress;
    if (targetDate !== undefined) goal.targetDate = targetDate;
    if (completionNotes !== undefined) goal.completionNotes = completionNotes;

    if (status === 'completed' && !goal.completedAt) {
      goal.completedAt = new Date();
      goal.progress = 100;
    }

    await goal.save();

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
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    milestone.completed = !milestone.completed;
    milestone.completedAt = milestone.completed ? new Date() : null;

    updateProgress(goal);
    await goal.save();

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
    const { title, dueDate } = req.body;
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
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

// @route   DELETE /api/goals/:id
exports.deleteGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
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
