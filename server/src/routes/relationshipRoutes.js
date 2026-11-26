const express = require('express');
const { body } = require('express-validator');
const {
  getRelationships,
  getRelationshipById,
  getRelationshipProgress,
  createRelationship,
  joinByInviteCode,
  regenerateInviteCode,
  updateRelationship,
} = require('../controllers/relationshipController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getRelationships);
router.get('/:id', getRelationshipById);
router.get('/:id/progress', getRelationshipProgress);

router.post(
  '/',
  authorize('mentor'),
  [
    body('topic').trim().notEmpty().withMessage('Mentoring topic is required'),
    body('meetingFrequency')
      .optional()
      .isIn(['Weekly', 'Bi-weekly', 'Monthly', 'As-needed'])
      .withMessage('Invalid meeting frequency'),
    validate,
  ],
  createRelationship
);

router.post(
  '/join-by-code',
  authorize('learner'),
  [
    body('inviteCode').trim().notEmpty().withMessage('Mentor invite code is required'),
    validate,
  ],
  joinByInviteCode
);

router.post('/regenerate-invite', authorize('mentor'), regenerateInviteCode);

router.put(
  '/:id',
  [
    body('status').optional().isIn(['active', 'paused', 'completed']).withMessage('Invalid status'),
    body('meetingFrequency')
      .optional()
      .isIn(['Weekly', 'Bi-weekly', 'Monthly', 'As-needed'])
      .withMessage('Invalid meeting frequency'),
    validate,
  ],
  updateRelationship
);

module.exports = router;
