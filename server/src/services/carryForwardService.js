const mongoose = require('mongoose');
const ActionItem = require('../models/ActionItem');
const Session = require('../models/Session');
const Notification = require('../models/Notification');

const OPEN_STATUSES = ['pending', 'in-progress'];

/**
 * Preview which action items will be carried forward into the next session
 * @param {string} relationshipId
 */
async function previewCarryForward(relationshipId) {
  // Find the latest session
  const lastSession = await Session.findOne({ relationship: relationshipId })
    .sort({ sessionNumber: -1 })
    .populate('relationship');

  if (!lastSession) {
    return {
      hasPreviousSession: false,
      lastSession: null,
      eligibleActions: [],
      nextSessionNumber: 1,
    };
  }

  // Find unfinished, uncarried action items
  const eligibleActions = await ActionItem.find({
    session: lastSession._id,
    status: { $in: OPEN_STATUSES },
    carried: false,
  }).populate('assignedTo', 'name email avatar role');

  return {
    hasPreviousSession: true,
    lastSession: {
      _id: lastSession._id,
      sessionNumber: lastSession.sessionNumber,
      title: lastSession.title,
      scheduledDate: lastSession.scheduledDate,
    },
    eligibleActions,
    nextSessionNumber: lastSession.sessionNumber + 1,
  };
}

/**
 * Execute carry-forward logic when creating a new session
 * Idempotent: checks carried: false to never carry the same item twice
 * @param {string} relationshipId
 * @param {string} newSessionId
 * @param {Array<string>} [selectedActionIds] - Optional array to support mentor selecting specific items, default all
 */
async function executeCarryForward(relationshipId, newSessionId, selectedActionIds = null) {
  const newSession = await Session.findById(newSessionId);
  if (!newSession) throw new Error('New session not found');

  // Find previous session for this relationship
  const prevSession = await Session.findOne({
    relationship: relationshipId,
    _id: { $ne: newSession._id },
    sessionNumber: { $lt: newSession.sessionNumber },
  }).sort({ sessionNumber: -1 });

  if (!prevSession) {
    return [];
  }

  // Filter criteria for open items
  const filter = {
    session: prevSession._id,
    status: { $in: OPEN_STATUSES },
    carried: false,
  };

  if (selectedActionIds && Array.isArray(selectedActionIds) && selectedActionIds.length > 0) {
    filter._id = { $in: selectedActionIds };
  }

  const openActions = await ActionItem.find(filter);
  if (!openActions || openActions.length === 0) {
    return [];
  }

  const carriedItems = [];

  for (const item of openActions) {
    const originalSessionId = item.originalSession || item.session;
    const historyEntry = {
      carriedAt: new Date(),
      fromSession: item.session,
      toSession: newSession._id,
      reason: `Unfinished in Session #${prevSession.sessionNumber} (${item.status})`,
    };

    const newAction = new ActionItem({
      relationship: relationshipId,
      session: newSession._id,
      title: item.title,
      description: item.description,
      assignedTo: item.assignedTo,
      assignedToRole: item.assignedToRole,
      createdBy: item.createdBy,
      priority: item.priority,
      dueDate: item.dueDate,
      status: item.status,
      carried: false,
      carriedForwardFrom: item._id,
      originalSession: originalSessionId,
      carryCount: (item.carryCount || 0) + 1,
      carryHistory: [...(item.carryHistory || []), historyEntry],
    });

    await newAction.save();
    carriedItems.push(newAction);

    // Mark previous item as carried so it is never duplicated
    item.carried = true;
    await item.save();

    // Create notification for assigned user
    try {
      await Notification.create({
        recipient: item.assignedTo,
        title: 'Action Item Carried Forward',
        message: `Task "${item.title}" was carried forward into Session #${newSession.sessionNumber}`,
        type: 'action',
        link: `/sessions/${newSession._id}`,
      });
    } catch (notifErr) {
      console.warn('Notification failed:', notifErr.message);
    }
  }

  // Update session carriedActionsCount
  newSession.carriedActionsCount = carriedItems.length;
  await newSession.save();

  return carriedItems;
}

module.exports = {
  previewCarryForward,
  executeCarryForward,
  OPEN_STATUSES,
};
