const express = require('express');
const { body } = require('express-validator');
const {
  addMilestone,
  toggleMilestone,
  deleteMilestone,
} = require('../controllers/goalController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.post(
  '/:goalId',
  [body('title').trim().notEmpty().withMessage('Milestone title is required'), validate],
  addMilestone
);

router.patch('/:goalId/:milestoneId', toggleMilestone);
router.delete('/:goalId/:milestoneId', deleteMilestone);

module.exports = router;
