import type Mongoose from "mongoose";
import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: typeof Mongoose | null;
    promise: Promise<typeof Mongoose> | null;
  };
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function getDb() {
  const databaseUrl = process.env.MONGODB_URI;
  if (!databaseUrl) throw new Error("MONGODB_URI is not defined");

  if (process.env.NODE_ENV !== 'production') {
    cached.conn = null;
    cached.promise = null;
  }

  if (cached.conn) {
    // Check if connection is ready
    if (cached.conn.connection?.readyState === 1) {
      return cached.conn;
    }
    // If not ready, clear the cache
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable buffering to fail fast
      serverSelectionTimeoutMS: 15000, // Increase timeout
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
    };

    cached.promise = mongoose
      .connect(databaseUrl, opts)
      .then((mongoose) => {
        console.log('MongoDB connected successfully');
        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error.message);
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Failed to establish MongoDB connection:', e instanceof Error ? e.message : e);
    throw e;
  }

  return cached.conn;
}

export default getDb;
