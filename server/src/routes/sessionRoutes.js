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
    validate,
  ],
  createSession
);

router.put('/:id', updateSession);
router.delete('/:id', deleteSession);

module.exports = router;
