const MentoringRelationship = require('../models/MentoringRelationship');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @route   GET /api/relationships
exports.getRelationships = async (req, res, next) => {
  try {
    const filter =
      req.user.role === 'mentor'
        ? { mentor: req.user._id }
        : { learner: req.user._id };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const relationships = await MentoringRelationship.find(filter)
      .populate('mentor', 'name email avatar title companyOrSchool expertise')
      .populate('learner', 'name email avatar title companyOrSchool interests')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: relationships.length,
      relationships,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/relationships/:id
exports.getRelationshipById = async (req, res, next) => {
  try {
    const relationship = await MentoringRelationship.findById(req.params.id)
      .populate('mentor', 'name email avatar title companyOrSchool bio expertise inviteCode')
      .populate('learner', 'name email avatar title companyOrSchool bio interests');

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Mentoring relationship not found',
      });
    }

    // Access control: must be mentor or learner
    const isMentor = relationship.mentor._id.toString() === req.user._id.toString();
    const isLearner = relationship.learner._id.toString() === req.user._id.toString();

    if (!isMentor && !isLearner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this mentoring relationship',
      });
    }

    res.status(200).json({
      success: true,
      relationship,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/relationships
exports.createRelationship = async (req, res, next) => {
  try {
    const { learnerId, learnerEmail, topic, description, meetingFrequency } = req.body;

    if (req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only mentors can create a mentoring relationship directly',
      });
    }

    let learner;
    if (learnerId) {
      learner = await User.findById(learnerId);
    } else if (learnerEmail) {
      learner = await User.findOne({ email: learnerEmail.toLowerCase().trim() });
    }

    if (!learner) {
      return res.status(404).json({
        success: false,
        message: 'Learner user not found. Check the email or have them register first.',
      });
    }

    if (learner.role !== 'learner') {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not registered as a learner',
      });
    }

    // Check if relationship already exists
    const existing = await MentoringRelationship.findOne({
      mentor: req.user._id,
      learner: learner._id,
      status: 'active',
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An active relationship already exists with this learner',
      });
    }

    const relationship = await MentoringRelationship.create({
      mentor: req.user._id,
      learner: learner._id,
      topic,
      description: description || '',
      meetingFrequency: meetingFrequency || 'Weekly',
    });

    // Notify learner
    await Notification.create({
      recipient: learner._id,
      title: 'New Mentoring Relationship',
      message: `${req.user.name} created a new mentorship with you on "${topic}"`,
      type: 'relationship',
      link: `/relationships/${relationship._id}`,
    });

    const populated = await MentoringRelationship.findById(relationship._id)
      .populate('mentor', 'name email avatar title')
      .populate('learner', 'name email avatar title');

    res.status(201).json({
      success: true,
      relationship: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/relationships/join-by-code
exports.joinByInviteCode = async (req, res, next) => {
  try {
    const { inviteCode, topic = 'General Mentorship' } = req.body;

    if (req.user.role !== 'learner') {
      return res.status(403).json({
        success: false,
        message: 'Only learners can join via mentor invite code',
      });
    }

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide mentor invite code',
      });
    }

    const mentor = await User.findOne({
      inviteCode: inviteCode.trim().toUpperCase(),
      role: 'mentor',
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite code. No mentor found with this code.',
      });
    }

    // Check existing
    const existing = await MentoringRelationship.findOne({
      mentor: mentor._id,
      learner: req.user._id,
      status: 'active',
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active relationship with this mentor',
        relationship: existing,
      });
    }

    const relationship = await MentoringRelationship.create({
      mentor: mentor._id,
      learner: req.user._id,
      topic,
    });

    // Notify mentor
    await Notification.create({
      recipient: mentor._id,
      title: 'New Learner Connected',
      message: `${req.user.name} joined your mentorship using your invite code`,
      type: 'relationship',
      link: `/relationships/${relationship._id}`,
    });

    const populated = await MentoringRelationship.findById(relationship._id)
      .populate('mentor', 'name email avatar title')
      .populate('learner', 'name email avatar title');

    res.status(201).json({
      success: true,
      message: `Successfully connected with mentor ${mentor.name}`,
      relationship: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PUT /api/relationships/:id
exports.updateRelationship = async (req, res, next) => {
  try {
    const relationship = await MentoringRelationship.findById(req.params.id);
    if (!relationship) {
      return res.status(404).json({ success: false, message: 'Relationship not found' });
    }

    // Only mentor or learner involved
    const isMentor = relationship.mentor.toString() === req.user._id.toString();
    const isLearner = relationship.learner.toString() === req.user._id.toString();
    if (!isMentor && !isLearner) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { topic, description, status, meetingFrequency, notes } = req.body;
    if (topic !== undefined) relationship.topic = topic;
    if (description !== undefined) relationship.description = description;
    if (status !== undefined) relationship.status = status;
    if (meetingFrequency !== undefined) relationship.meetingFrequency = meetingFrequency;
    if (notes !== undefined) relationship.notes = notes;

    await relationship.save();

    const updated = await MentoringRelationship.findById(relationship._id)
      .populate('mentor', 'name email avatar title')
      .populate('learner', 'name email avatar title');

    res.status(200).json({
      success: true,
      relationship: updated,
    });
  } catch (err) {
    next(err);
  }
};
