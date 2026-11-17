require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const User = require('./models/User');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    // Auto-seed if database is completely empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Database is empty. Automatically initializing demonstration dataset...');
      const seedDatabase = require('./seed');
      await seedDatabase(false);
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 MentorMinutes Server running on port ${PORT}`);
      console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
    });

    const shutdown = async () => {
      console.log('\nShutting down server gracefully...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
