const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const errorHandler = require('./middleware/error');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const actionRoutes = require('./routes/actionRoutes');
const goalRoutes = require('./routes/goalRoutes');
const milestoneRoutes = require('./routes/milestoneRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// Security middleware (allow external HTTPS avatar images and configured API origins)
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", ...configuredOrigins, 'https:'],
      },
    },
  })
);

// CORS configuration (supports comma-separated CLIENT_URL origins in production)
const allowedOrigins = [
  ...configuredOrigins,
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or tests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS blocked origin'), false);
    },
    credentials: true,
  })
);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.use('/api', healthRoutes);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found`,
  });
});

// Serve static client production build if present
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
