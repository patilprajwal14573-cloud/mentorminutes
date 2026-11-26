const Session = require('../models/Session');
const MentoringRelationship = require('../models/MentoringRelationship');
const ActionItem = require('../models/ActionItem');
const Notification = require('../models/Notification');
const {
  previewCarryForward,
  executeCarryForward,
} = require('../services/carryForwardService');

// Helper to sanitize private mentor notes if requesting user is learner
const sanitizeSession = (session, isLearner) => {
  const obj = session.toObject ? session.toObject() : { ...session };
  if (isLearner) {
    delete obj.mentorPrivateNotes;
  }
  return obj;
};

// @route   GET /api/sessions
exports.getSessions = async (req, res, next) => {
  try {
    const { relationshipId, status, q } = req.query;
    const filter = {};

    if (relationshipId) {
      const rel = await MentoringRelationship.findById(relationshipId);
      if (!rel) {
        return res.status(404).json({ success: false, message: 'Relationship not found' });
      }
      const isParticipant =
        rel.mentor.toString() === req.user._id.toString() ||
        rel.learner.toString() === req.user._id.toString();
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view sessions for this relationship',
        });
      }
      filter.relationship = relationshipId;
    } else {
      // Find all relationships user is part of
      const userRelationships = await MentoringRelationship.find({
        $or: [{ mentor: req.user._id }, { learner: req.user._id }],
      }).select('_id');
      filter.relationship = { $in: userRelationships.map((r) => r._id) };
    }

    if (status) {
      filter.status = status;
    }

    if (q && q.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: regex },
        { agenda: regex },
        { topicsDiscussed: regex },
        { sharedSummary: regex },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .populate({
          path: 'relationship',
          populate: [
            { path: 'mentor', select: 'name email avatar title' },
            { path: 'learner', select: 'name email avatar title' },
          ],
        })
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit),
      Session.countDocuments(filter),
    ]);

    const isLearner = req.user.role === 'learner';
    const sanitized = sessions.map((s) => sanitizeSession(s, isLearner));

    res.status(200).json({
      success: true,
      count: sanitized.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      sessions: sanitized,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/sessions/preview-carry-forward
exports.getPreviewCarryForward = async (req, res, next) => {
  try {
    const { relationshipId } = req.query;
    if (!relationshipId) {
      return res.status(400).json({
        success: false,
        message: 'relationshipId query parameter is required',
      });
    }

    const relationship = await MentoringRelationship.findById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ success: false, message: 'Relationship not found' });
    }

    const isParticipant =
      relationship.mentor.toString() === req.user._id.toString() ||
      relationship.learner.toString() === req.user._id.toString();
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to preview carry-forward for this relationship',
      });
    }

    const preview = await previewCarryForward(relationshipId);
    res.status(200).json({
      success: true,
      preview,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/sessions/:id
exports.getSessionById = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).populate({
      path: 'relationship',
      populate: [
        { path: 'mentor', select: 'name email avatar title' },
        { path: 'learner', select: 'name email avatar title' },
      ],
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const rel = session.relationship;
    const isMentor = rel.mentor._id.toString() === req.user._id.toString();
    const isLearner = rel.learner._id.toString() === req.user._id.toString();

    if (!isMentor && !isLearner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this session',
      });
    }

    // Get all actions for this session
    const actions = await ActionItem.find({ session: session._id })
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('carriedForwardFrom', 'title session status')
      .populate('originalSession', 'sessionNumber title scheduledDate')
      .sort({ createdAt: 1 });

    const sanitized = sanitizeSession(session, isLearner);

    res.status(200).json({
      success: true,
      session: sanitized,
      actions,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/sessions
exports.createSession = async (req, res, next) => {
  try {
    const {
      relationshipId,
      title,
      scheduledDate,
      durationMinutes = 60,
      agenda = '',
      topicsDiscussed = '',
      keyTakeaways = '',
      sharedSummary = '',
      mentorPrivateNotes = '',
      learnerFeedback = '',
      nextSessionDate,
      selectedCarryActionIds,
    } = req.body;

    const relationship = await MentoringRelationship.findById(relationshipId);
    if (!relationship) {
      return res.status(404).json({ success: false, message: 'Relationship not found' });
    }

    if (relationship.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the mentor of this relationship can create and schedule new sessions',
      });
    }

    // Determine sessionNumber
    const lastSession = await Session.findOne({ relationship: relationshipId }).sort({
      sessionNumber: -1,
    });
    const nextNumber = lastSession ? lastSession.sessionNumber + 1 : 1;

    const session = await Session.create({
      relationship: relationshipId,
      sessionNumber: nextNumber,
      title: title || `Session #${nextNumber}`,
      scheduledDate: scheduledDate || new Date(),
      durationMinutes,
      agenda,
      topicsDiscussed,
      keyTakeaways,
      sharedSummary,
      mentorPrivateNotes,
      learnerFeedback,
      nextSessionDate,
      status: 'scheduled',
    });

    // Execute Automatic Carry-Forward of unfinished action items from last session
    const carriedActions = await executeCarryForward(
      relationshipId,
      session._id,
      selectedCarryActionIds
    );

    // Notify learner
    await Notification.create({
      recipient: relationship.learner,
      title: 'New Session Scheduled',
      message: `${req.user.name} scheduled Session #${nextNumber}: "${session.title}" for ${new Date(
        session.scheduledDate
      ).toLocaleDateString()}`,
      type: 'session',
      link: `/sessions/${session._id}`,
    });

    const populated = await Session.findById(session._id).populate({
      path: 'relationship',
      populate: [
        { path: 'mentor', select: 'name email avatar title' },
        { path: 'learner', select: 'name email avatar title' },
      ],
    });

    res.status(201).json({
      success: true,
      session: populated,
      carriedActionsCount: carriedActions.length,
      carriedActions,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PUT /api/sessions/:id
exports.updateSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).populate('relationship');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const isMentor = session.relationship.mentor.toString() === req.user._id.toString();
    const isLearner = session.relationship.learner.toString() === req.user._id.toString();

    if (!isMentor && !isLearner) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const {
      title,
      scheduledDate,
      durationMinutes,
      status,
      agenda,
      topicsDiscussed,
      keyTakeaways,
      sharedSummary,
      mentorPrivateNotes,
      learnerFeedback,
      nextSessionDate,
    } = req.body;

    if (isMentor) {
      if (title !== undefined) session.title = title;
      if (scheduledDate !== undefined) session.scheduledDate = scheduledDate;
      if (durationMinutes !== undefined) session.durationMinutes = durationMinutes;
      if (status !== undefined) session.status = status;
      if (agenda !== undefined) session.agenda = agenda;
      if (topicsDiscussed !== undefined) session.topicsDiscussed = topicsDiscussed;
      if (keyTakeaways !== undefined) session.keyTakeaways = keyTakeaways;
      if (sharedSummary !== undefined) session.sharedSummary = sharedSummary;
      if (mentorPrivateNotes !== undefined) session.mentorPrivateNotes = mentorPrivateNotes;
      if (learnerFeedback !== undefined) session.learnerFeedback = learnerFeedback;
      if (nextSessionDate !== undefined) session.nextSessionDate = nextSessionDate;
    } else if (isLearner) {
      // Learners can contribute learnerFeedback
      if (learnerFeedback !== undefined) session.learnerFeedback = learnerFeedback;
    }

    await session.save();

    const sanitized = sanitizeSession(session, isLearner);

    res.status(200).json({
      success: true,
      session: sanitized,
    });
  } catch (err) {
    next(err);
  }
};

// @route   DELETE /api/sessions/:id
exports.deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).populate('relationship');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.relationship.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only mentors can delete a session',
      });
    }

    // Reset carried status on original items carried into this session
    const actionsInSession = await ActionItem.find({ session: session._id });
    for (const a of actionsInSession) {
      if (a.carriedForwardFrom) {
        await ActionItem.findByIdAndUpdate(a.carriedForwardFrom, { carried: false });
      }
    }

    // Delete actions in this session
    await ActionItem.deleteMany({ session: session._id });

    // Delete session
    await Session.findByIdAndDelete(session._id);

    res.status(200).json({
      success: true,
      message: 'Session and its actions removed successfully. Carried items restored.',
    });
  } catch (err) {
    next(err);
  }
};
