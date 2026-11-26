const express = require('express');
const { body } = require('express-validator');
const {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  toggleMilestone,
  addMilestone,
  deleteMilestone,
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

router.put(
  '/:id',
  [
    body('status').optional().isIn(['not-started', 'in-progress', 'completed', 'on-hold']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('category')
      .optional()
      .isIn(['technical', 'career', 'project', 'soft-skills', 'academic', 'other']),
    body('progress').optional().isInt({ min: 0, max: 100 }),
    validate,
  ],
  updateGoal
);
router.patch('/:id/milestones/:milestoneId', toggleMilestone);
router.post(
  '/:id/milestones',
  [body('title').trim().notEmpty().withMessage('Milestone title is required'), validate],
  addMilestone
);
router.delete('/:id/milestones/:milestoneId', deleteMilestone);
router.delete('/:id', deleteGoal);

module.exports = router;
