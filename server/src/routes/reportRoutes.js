const express = require('express');
const { getDashboardStats, getTimeline } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/timeline', getTimeline);

module.exports = router;
