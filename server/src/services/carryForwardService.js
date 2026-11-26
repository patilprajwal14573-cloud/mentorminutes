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

  // If mentor explicitly passed an empty selection array, carry nothing
  if (Array.isArray(selectedActionIds) && selectedActionIds.length === 0) {
    return [];
  }

  // Filter criteria for open items
  const filter = {
    session: prevSession._id,
    status: { $in: OPEN_STATUSES },
    carried: false,
  };

  if (Array.isArray(selectedActionIds) && selectedActionIds.length > 0) {
    filter._id = { $in: selectedActionIds };
  }

  const openActions = await ActionItem.find(filter);
  if (!openActions || openActions.length === 0) {
    return [];
  }

  const carriedItems = [];

  for (const item of openActions) {
    // Check if already carried into this target session
    const alreadyInTarget = await ActionItem.exists({
      session: newSession._id,
      carriedForwardFrom: item._id,
    });
    if (alreadyInTarget) continue;

    // Atomically claim source item so concurrent requests cannot duplicate it
    const claimedItem = await ActionItem.findOneAndUpdate(
      { _id: item._id, carried: false },
      { $set: { carried: true } },
      { new: true }
    );
    if (!claimedItem) continue;

    const originalSessionId = claimedItem.originalSession || claimedItem.session;
    const historyEntry = {
      carriedAt: new Date(),
      fromSession: claimedItem.session,
      toSession: newSession._id,
      reason: `Unfinished in Session #${prevSession.sessionNumber} (${claimedItem.status})`,
    };

    const newAction = new ActionItem({
      relationship: relationshipId,
      session: newSession._id,
      title: claimedItem.title,
      description: claimedItem.description,
      assignedTo: claimedItem.assignedTo,
      assignedToRole: claimedItem.assignedToRole,
      createdBy: claimedItem.createdBy,
      priority: claimedItem.priority,
      dueDate: claimedItem.dueDate,
      status: claimedItem.status,
      carried: false,
      carriedForwardFrom: claimedItem._id,
      originalSession: originalSessionId,
      carryCount: (claimedItem.carryCount || 0) + 1,
      carryHistory: [...(claimedItem.carryHistory || []), historyEntry],
    });

    try {
      await newAction.save();
    } catch (saveErr) {
      // Restore carried flag if save failed unexpectedly (unless duplicate key)
      if (saveErr.code !== 11000) {
        await ActionItem.findByIdAndUpdate(claimedItem._id, { $set: { carried: false } });
      }
      throw saveErr;
    }
    carriedItems.push(newAction);

    // Create notification for assigned user
    try {
      await Notification.create({
        recipient: claimedItem.assignedTo,
        title: 'Action Item Carried Forward',
        message: `Task "${claimedItem.title}" was carried forward into Session #${newSession.sessionNumber}`,
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
