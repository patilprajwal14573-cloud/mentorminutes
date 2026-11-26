const mongoose = require('mongoose');

let mongodInstance = null;

async function connectDB() {
  const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mentorminutes';
  const uri = rawUri.replace(/[\r\n]+/g, '').trim();

  try {
    // Attempt standard connection (allow longer timeout in production across regions)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: process.env.NODE_ENV === 'production' ? 10000 : 2500,
    });
    console.log(`[Database] Connected to MongoDB at: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
    return;
  } catch (err) {
    console.warn(`[Database] Standard MongoDB connection failed: ${err.message}`);

    if (process.env.NODE_ENV === 'production') {
      console.error('[Database] Production mode requires a valid MONGODB_URI connection.');
      throw err;
    }

    // If local dev/test and MongoDB is not running, fallback to mongodb-memory-server
    try {
      console.log('[Database] Starting in-memory embedded MongoDB fallback for seamless local development...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      const inMemUri = mongodInstance.getUri();
      await mongoose.connect(inMemUri);
      console.log(`[Database] Connected to In-Memory MongoDB fallback: ${inMemUri}`);
    } catch (memErr) {
      console.error('[Database] In-memory MongoDB fallback also failed:', memErr.message);
      console.error('Please ensure MongoDB is running locally or set MONGODB_URI in server/.env');
      throw err;
    }
  }
}

async function closeDB() {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}

module.exports = { connectDB, closeDB };
