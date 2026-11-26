const Notification = require('../models/Notification');
const ActionItem = require('../models/ActionItem');
const Goal = require('../models/Goal');
const MentoringRelationship = require('../models/MentoringRelationship');

/**
 * Idempotently generates in-app reminders for overdue action items
 * and approaching goal deadlines (within 48 hours).
 */
async function syncDueReminders(userId) {
  const now = new Date();
  const fortyEightHoursOut = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [overdueActions, userRels] = await Promise.all([
    ActionItem.find({
      assignedTo: userId,
      status: { $in: ['pending', 'in-progress'] },
      dueDate: { $lt: now },
    }).select('title session dueDate'),
    MentoringRelationship.find({
      $or: [{ mentor: userId }, { learner: userId }],
      status: 'active',
    }).select('_id'),
  ]);

  const relIds = userRels.map((r) => r._id);
  const approachingGoals =
    relIds.length > 0
      ? await Goal.find({
          relationship: { $in: relIds },
          status: { $ne: 'completed' },
          targetDate: { $gte: now, $lte: fortyEightHoursOut },
        }).select('title targetDate')
      : [];

  for (const action of overdueActions) {
    const title = 'Overdue Action Item';
    const message = `Task "${action.title}" is past its due date (${new Date(
      action.dueDate
    ).toLocaleDateString()})`;
    const exists = await Notification.exists({
      recipient: userId,
      title,
      message,
      createdAt: { $gte: sevenDaysAgo },
    });
    if (!exists) {
      await Notification.create({
        recipient: userId,
        title,
        message,
        type: 'action',
        link: `/sessions/${action.session}`,
      });
    }
  }

  for (const goal of approachingGoals) {
    const title = 'Goal Deadline Approaching';
    const message = `Goal "${goal.title}" is due by ${new Date(
      goal.targetDate
    ).toLocaleDateString()}`;
    const exists = await Notification.exists({
      recipient: userId,
      title,
      message,
      createdAt: { $gte: sevenDaysAgo },
    });
    if (!exists) {
      await Notification.create({
        recipient: userId,
        title,
        message,
        type: 'goal',
        link: '/goals',
      });
    }
  }
}

// @route   GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    await syncDueReminders(req.user._id);

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(40);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    if (req.params.id === 'all') {
      await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (err) {
    next(err);
  }
};

// @route   DELETE /api/notifications/:id
exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.status(200).json({
      success: true,
      message: 'Notification removed',
    });
  } catch (err) {
    next(err);
  }
};
