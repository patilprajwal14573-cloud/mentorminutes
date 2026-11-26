const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/register',
  authRateLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['mentor', 'learner']).withMessage('Role must be mentor or learner'),
    validate,
  ],
  register
);

router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  login
);

router.get('/me', protect, getMe);
router.put(
  '/profile',
  protect,
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
router.put(
  '/password',
  protect,
  authRateLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validate,
  ],
  changePassword
);

module.exports = router;
