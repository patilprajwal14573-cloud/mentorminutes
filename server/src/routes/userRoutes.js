const express = require('express');
const { body } = require('express-validator');
const { getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const User = require('../models/User');

const router = express.Router();

// Public invite code preview (returns minimal non-sensitive mentor card info)
router.get('/invite-preview/:code', async (req, res, next) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    const mentor = await User.findOne({ inviteCode: code, role: 'mentor' }).select(
      'name title companyOrSchool expertise avatar inviteCode'
    );
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Invitation code is invalid or expired',
      });
    }
    res.status(200).json({
      success: true,
      mentor,
    });
  } catch (err) {
    next(err);
  }
});

router.use(protect);

router.get('/me', getMe);

router.put(
  '/profile',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
    body('bio').optional().isLength({ max: 1000 }),
    body('settings.theme').optional().isIn(['light', 'dark', 'system']),
    body('settings.emailNotifications').optional().isBoolean(),
    body('settings.sessionReminders').optional().isBoolean(),
    validate,
  ],
  updateProfile
);

module.exports = router;
