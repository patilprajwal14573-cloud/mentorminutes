const express = require('express');
const { body } = require('express-validator');
const {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  toggleMilestone,
  addMilestone,
  deleteGoal,
} = require('../controllers/goalController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getGoals);
router.get('/:id', getGoalById);

router.post(
  '/',
  [
    body('relationshipId').notEmpty().withMessage('relationshipId is required'),
    body('title').trim().notEmpty().withMessage('Goal title is required'),
    validate,
  ],
  createGoal
);

router.put('/:id', updateGoal);
router.patch('/:id/milestones/:milestoneId', toggleMilestone);
router.post(
  '/:id/milestones',
  [body('title').trim().notEmpty().withMessage('Milestone title is required'), validate],
  addMilestone
);
router.delete('/:id', deleteGoal);

module.exports = router;
