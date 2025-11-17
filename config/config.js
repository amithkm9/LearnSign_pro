// Configuration file for environment variables
export const config = {
    // Database Configuration
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/learnsign',
    DB_NAME: process.env.DB_NAME || 'learnsign',

    // Server Configuration
    PORT: process.env.PORT || 3000,
    API_PORT: process.env.API_PORT || 4000,
    PYTHON_API_PORT: process.env.PYTHON_API_PORT || 8000,
    TRANSLATE_API_PORT: process.env.TRANSLATE_API_PORT || 8001,
    NUMBERS_LETTERS_API_PORT: process.env.NUMBERS_LETTERS_API_PORT || 8002,

    // Session Secret
    SESSION_SECRET: process.env.SESSION_SECRET || 'edusign_super_secret_key_change_in_production',

    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Frontend URL
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

    // API URLs
    API_URL: process.env.API_URL || 'http://localhost:4000',
    PYTHON_API_URL: process.env.PYTHON_API_URL || 'http://localhost:8000',
    TRANSLATE_API_URL: process.env.TRANSLATE_API_URL || 'http://localhost:8001',
    NUMBERS_LETTERS_API_URL: process.env.NUMBERS_LETTERS_API_URL || 'http://localhost:8002',

    // Firebase Configuration (for frontend)
    FIREBASE_CONFIG: {
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSyA1ELcXA-sFGJxnGUJc6U3xgWeB4-f7nxY",
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "edusign-e315e.firebaseapp.com",
        projectId: process.env.FIREBASE_PROJECT_ID || "edusign-e315e",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "edusign-e315e.firebasestorage.app",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "354617663673",
        appId: process.env.FIREBASE_APP_ID || "1:354617663673:web:d36a17e9ff19e2492f7b68",
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-XBT16KY57X"
    },

    // Feature Flags
    FEATURES: {
        ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',
        ENABLE_USER_PROGRESS: process.env.ENABLE_USER_PROGRESS !== 'false',
        ENABLE_RECOMMENDATIONS: process.env.ENABLE_RECOMMENDATIONS !== 'false',
        ENABLE_NOTIFICATIONS: process.env.ENABLE_NOTIFICATIONS !== 'false'
    },

    // Rate Limiting
    RATE_LIMIT: {
        WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limit each IP to 100 requests per windowMs
    }
};

export default config;
