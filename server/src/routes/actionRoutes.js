const express = require('express');
const { body } = require('express-validator');
const {
  getActionItems,
  getActionItemById,
  createActionItem,
  updateActionStatus,
  updateActionItem,
  deleteActionItem,
} = require('../controllers/actionController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getActionItems);
router.get('/:id', getActionItemById);

router.post(
  '/',
  [
    body('relationshipId').notEmpty().withMessage('relationshipId is required'),
    body('sessionId').notEmpty().withMessage('sessionId is required'),
    body('title').trim().notEmpty().withMessage('Action title is required'),
    validate,
  ],
  createActionItem
);

router.patch(
  '/:id/status',
  [
    body('status').isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status'),
    validate,
  ],
  updateActionStatus
);

router.put(
  '/:id',
  [
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('assignedToRole').optional().isIn(['mentor', 'learner']),
    validate,
  ],
  updateActionItem
);
router.delete('/:id', deleteActionItem);

module.exports = router;
