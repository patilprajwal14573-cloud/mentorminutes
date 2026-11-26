const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/env');

const signToken = (id) => {
  return jwt.sign(
    { id },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = 'learner',
      title = '',
      bio = '',
      companyOrSchool = '',
      expertise = [],
      interests = [],
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with that email already exists',
      });
    }

    const userData = {
      name,
      email,
      password,
      role,
      title,
      bio,
      companyOrSchool,
      expertise: Array.isArray(expertise) ? expertise : [],
      interests: Array.isArray(interests) ? interests : [],
    };

    // If mentor, generate invite code
    if (role === 'mentor') {
      let code;
      let isUnique = false;
      while (!isUnique) {
        code = User.generateInviteCode();
        const existing = await User.findOne({ inviteCode: code });
        if (!existing) isUnique = true;
      }
      userData.inviteCode = code;
    }

    const user = await User.create(userData);
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = signToken(user._id);

    // Remove password before sending
    user.password = undefined;

    res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      bio,
      title,
      avatar,
      companyOrSchool,
      expertise,
      interests,
      settings,
    } = req.body;

    const fieldsToUpdate = {};
    if (name !== undefined) fieldsToUpdate.name = name;
    if (bio !== undefined) fieldsToUpdate.bio = bio;
    if (title !== undefined) fieldsToUpdate.title = title;
    if (avatar !== undefined) fieldsToUpdate.avatar = avatar;
    if (companyOrSchool !== undefined) fieldsToUpdate.companyOrSchool = companyOrSchool;
    if (expertise !== undefined) fieldsToUpdate.expertise = expertise;
    if (interests !== undefined) fieldsToUpdate.interests = interests;

    if (settings && typeof settings === 'object') {
      const existingUser = await User.findById(req.user.id);
      fieldsToUpdate.settings = {
        emailNotifications:
          settings.emailNotifications !== undefined
            ? Boolean(settings.emailNotifications)
            : existingUser?.settings?.emailNotifications ?? true,
        sessionReminders:
          settings.sessionReminders !== undefined
            ? Boolean(settings.sessionReminders)
            : existingUser?.settings?.sessionReminders ?? true,
        theme: ['light', 'dark', 'system'].includes(settings.theme)
          ? settings.theme
          : existingUser?.settings?.theme ?? 'light',
      };
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @route   PUT /api/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new passwords',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password',
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password successfully updated',
    });
  } catch (err) {
    next(err);
  }
};
