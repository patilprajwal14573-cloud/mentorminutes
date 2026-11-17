const ActionItem = require('../models/ActionItem');
const Session = require('../models/Session');
const MentoringRelationship = require('../models/MentoringRelationship');
const Notification = require('../models/Notification');

// @route   GET /api/actions
exports.getActionItems = async (req, res, next) => {
  try {
    const { relationshipId, sessionId, status, priority, assignedTo, overdue } = req.query;
    const filter = {};

    if (relationshipId) filter.relationship = relationshipId;
    if (sessionId) filter.session = sessionId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Filter by overdue
    if (overdue === 'true') {
      filter.status = { $in: ['pending', 'in-progress'] };
      filter.dueDate = { $lt: new Date() };
    }

    // Access control: only actions for user's relationships
    if (!relationshipId) {
      const userRelationships = await MentoringRelationship.find({
        $or: [{ mentor: req.user._id }, { learner: req.user._id }],
      }).select('_id');
      filter.relationship = { $in: userRelationships.map((r) => r._id) };
    }

    const actions = await ActionItem.find(filter)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('session', 'sessionNumber title scheduledDate')
      .populate('originalSession', 'sessionNumber title scheduledDate')
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: actions.length,
      actions,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/actions/:id
exports.getActionItemById = async (req, res, next) => {
  try {
    const action = await ActionItem.findById(req.params.id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('session', 'sessionNumber title scheduledDate')
      .populate('originalSession', 'sessionNumber title scheduledDate')
      .populate('carriedForwardFrom')
      .populate('carryHistory.fromSession', 'sessionNumber title')
      .populate('carryHistory.toSession', 'sessionNumber title');

    if (!action) {
      return res.status(404).json({ success: false, message: 'Action item not found' });
    }

    res.status(200).json({
      success: true,
      action,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/actions
exports.createActionItem = async (req, res, next) => {
  try {
    const {
      relationshipId,
      sessionId,
      title,
      description = '',
      assignedTo,
      assignedToRole = 'learner',
      priority = 'medium',
      dueDate,
    } = req.body;

    const relationship = await MentoringRelationship.findById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ success: false, message: 'Relationship not found' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const assigneeId = assignedTo || (assignedToRole === 'mentor' ? relationship.mentor : relationship.learner);

    const action = await ActionItem.create({
      relationship: relationshipId,
      session: sessionId,
      title,
      description,
      assignedTo: assigneeId,
      assignedToRole,
      createdBy: req.user._id,
      priority,
      dueDate: dueDate || null,
      status: 'pending',
      originalSession: sessionId,
      carryCount: 0,
      carried: false,
    });

    // Notify assignee if not the creator
    if (assigneeId.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: assigneeId,
        title: 'New Action Item Assigned',
        message: `${req.user.name} assigned you a task: "${title}"`,
        type: 'action',
        link: `/sessions/${sessionId}`,
      });
    }

    const populated = await ActionItem.findById(action._id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('session', 'sessionNumber title scheduledDate');

    res.status(201).json({
      success: true,
      action: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PATCH /api/actions/:id/status
exports.updateActionStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, in-progress, completed, or cancelled',
      });
    }

    const action = await ActionItem.findById(req.params.id).populate('relationship');
    if (!action) {
      return res.status(404).json({ success: false, message: 'Action item not found' });
    }

    action.status = status;
    if (status === 'completed') {
      action.completedAt = new Date();
    } else {
      action.completedAt = null;
    }

    await action.save();

    // Notify creator if completed by another person
    if (status === 'completed' && action.createdBy.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: action.createdBy,
        title: 'Action Item Completed! 🎉',
        message: `${req.user.name} marked "${action.title}" as completed`,
        type: 'action',
        link: `/sessions/${action.session}`,
      });
    }

    const updated = await ActionItem.findById(action._id)
      .populate('assignedTo', 'name email avatar role')
      .populate('session', 'sessionNumber title');

    res.status(200).json({
      success: true,
      action: updated,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PUT /api/actions/:id
exports.updateActionItem = async (req, res, next) => {
  try {
    const { title, description, priority, dueDate, assignedTo, assignedToRole } = req.body;

    const action = await ActionItem.findById(req.params.id);
    if (!action) {
      return res.status(404).json({ success: false, message: 'Action item not found' });
    }

    if (title !== undefined) action.title = title;
    if (description !== undefined) action.description = description;
    if (priority !== undefined) action.priority = priority;
    if (dueDate !== undefined) action.dueDate = dueDate;
    if (assignedTo !== undefined) action.assignedTo = assignedTo;
    if (assignedToRole !== undefined) action.assignedToRole = assignedToRole;

    await action.save();

    const populated = await ActionItem.findById(action._id)
      .populate('assignedTo', 'name email avatar role')
      .populate('session', 'sessionNumber title');

    res.status(200).json({
      success: true,
      action: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @route   DELETE /api/actions/:id
exports.deleteActionItem = async (req, res, next) => {
  try {
    const action = await ActionItem.findById(req.params.id);
    if (!action) {
      return res.status(404).json({ success: false, message: 'Action item not found' });
    }

    // If carried forward from previous item, reset carried status on previous item
    if (action.carriedForwardFrom) {
      await ActionItem.findByIdAndUpdate(action.carriedForwardFrom, { carried: false });
    }

    await ActionItem.findByIdAndDelete(action._id);

    res.status(200).json({
      success: true,
      message: 'Action item deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};
