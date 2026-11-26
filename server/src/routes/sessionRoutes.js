const express = require('express');
const { body } = require('express-validator');
const {
  getSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  getPreviewCarryForward,
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/preview-carry-forward', getPreviewCarryForward);
router.get('/', getSessions);
router.get('/:id', getSessionById);

router.post(
  '/',
  [
    body('relationshipId').notEmpty().withMessage('relationshipId is required'),
    body('durationMinutes')
      .optional()
      .isInt({ min: 15, max: 480 })
      .withMessage('Duration must be between 15 and 480 minutes'),
    validate,
  ],
  createSession
);

router.put(
  '/:id',
  [
    body('status')
      .optional()
      .isIn(['scheduled', 'completed', 'cancelled'])
      .withMessage('Invalid session status'),
    body('durationMinutes')
      .optional()
      .isInt({ min: 15, max: 480 })
      .withMessage('Duration must be between 15 and 480 minutes'),
    validate,
  ],
  updateSession
);
router.delete('/:id', deleteSession);

module.exports = router;
