import mongoose from 'mongoose';

// Database configuration
const DB_CONFIG = {
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/learnsign',
    DB_NAME: process.env.DB_NAME || 'learnsign'
};

// Connect to MongoDB
export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(DB_CONFIG.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            family: 4, // prefer IPv4 to avoid ::1 connection issues
            dbName: DB_CONFIG.DB_NAME // Force database name to learnsign
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Using database: ${conn.connection.db.databaseName}`);
        
        // Create indexes for better performance
        console.log('Setting up database indexes...');
        await setupIndexes();
        console.log('Database indexes created successfully');
        
        return conn;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

// Setup database indexes
const setupIndexes = async () => {
    try {
        const db = mongoose.connection.db;
        
        // Users collection indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ createdAt: -1 });
        
        // Courses collection indexes
        await db.collection('courses').createIndex({ ageGroup: 1 });
        await db.collection('courses').createIndex({ category: 1 });
        await db.collection('courses').createIndex({ difficulty: 1 });
        
        // User progress collection indexes
        await db.collection('userprogresses').createIndex({ userId: 1, courseId: 1 }, { unique: true });
        await db.collection('userprogresses').createIndex({ userId: 1 });
        
        console.log('All indexes created successfully');
    } catch (error) {
        console.log('Some indexes may already exist, continuing...');
    }
};

// Disconnect from MongoDB
export const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('MongoDB Disconnected');
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error.message);
    }
};

export default { connectDB, disconnectDB };
