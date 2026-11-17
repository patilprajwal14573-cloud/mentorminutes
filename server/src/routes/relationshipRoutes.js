const express = require('express');
const { body } = require('express-validator');
const {
  getRelationships,
  getRelationshipById,
  createRelationship,
  joinByInviteCode,
  updateRelationship,
} = require('../controllers/relationshipController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getRelationships);
router.get('/:id', getRelationshipById);

router.post(
  '/',
  [
    body('topic').trim().notEmpty().withMessage('Mentoring topic is required'),
    validate,
  ],
  createRelationship
);

router.post(
  '/join-by-code',
  [
    body('inviteCode').trim().notEmpty().withMessage('Mentor invite code is required'),
    validate,
  ],
  joinByInviteCode
);

router.put('/:id', updateRelationship);

module.exports = router;
