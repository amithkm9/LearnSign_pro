import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from 'mongoose';
import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from "./config/database.js";
import { Course, Package, User, UserProgress, LearningEvent, QuizAttempt } from "./models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const port = process.env.API_PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Connect to database and start server
await connectDB();

// Get a single course by ID
app.get("/videolib/:id", async (req, res) => {
    try {
        const course = await Course.findOne({ id: req.params.id });
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        
        // Increment views
        await course.incrementViews();
        
        console.log(`Course ${req.params.id} requested:`, course.title);
        res.json(course);
    } catch (error) {
        console.error("Error fetching course:", error);
        res.status(500).json({ 
            message: "Error fetching course", 
            error: error.message 
        });
    }
});



// Course categories configuration (static data for UI)
const courseCategories = {
    "1-4": {
        title: "Early Learners (Ages 1-4)",
        description: "Foundational sign language through play and basic gestures",
        color: "#FF9F4A"
    },
    "5-10": {
        title: "Young Explorers (Ages 5-10)", 
        description: "Building vocabulary and simple conversations",
        color: "#4A6FFF"
    },
    "15+": {
        title: "Advanced Learners (Ages 15+)",
        description: "Complex communication and everyday conversations",
        color: "#36B37E"
    }
};

// ========== COURSE ENDPOINTS ==========

// Get courses by age group
app.get("/courses/:ageGroup", async (req, res) => {
    try {
        const ageGroup = req.params.ageGroup;
        
        if (!courseCategories[ageGroup]) {
            return res.status(404).json({ message: "Invalid age group" });
        }
        
        const courses = await Course.findByAgeGroup(ageGroup);
        
        res.json({
            category: courseCategories[ageGroup],
            courses: courses
        });
    } catch (error) {
        console.error("Error fetching courses by age group:", error);
        res.status(500).json({ 
            message: "Error fetching courses", 
            error: error.message 
        });
    }
});

// Get all course categories with course counts
app.get("/categories", async (req, res) => {
    try {
        const categoriesWithCounts = await Promise.all(
            Object.keys(courseCategories).map(async (key) => {
                const courseCount = await Course.countDocuments({ 
                    ageGroup: key, 
                    isPublished: true 
                });
                
                return {
                    id: key,
                    ...courseCategories[key],
                    courseCount
                };
            })
        );
        
        res.json(categoriesWithCounts);
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ 
            message: "Error fetching categories", 
            error: error.message 
        });
    }
});

// Get all courses
app.get("/courses", async (req, res) => {
    try {
        const { 
            ageGroup, 
            category, 
            difficulty, 
            limit = 50, 
            page = 1,
            search 
        } = req.query;
        
        let query = { isPublished: true };
        
        // Add filters
        if (ageGroup) query.ageGroup = ageGroup;
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const courses = await Course.find(query)
            .sort({ 'analytics.enrollments': -1, createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);
            
        const total = await Course.countDocuments(query);
        
        res.json({
            courses,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({ 
            message: "Error fetching courses", 
            error: error.message 
        });
    }
});

// Get popular courses
app.get("/courses/popular", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const courses = await Course.getPopular(limit);
        res.json(courses);
    } catch (error) {
        console.error("Error fetching popular courses:", error);
        res.status(500).json({ 
            message: "Error fetching popular courses", 
            error: error.message 
        });
    }
});

// ========== PACKAGE ENDPOINTS ==========

// Get all packages
app.get("/packages", async (req, res) => {
    try {
        const { 
            ageGroup, 
            targetAudience, 
            popular,
            limit,
            search 
        } = req.query;
        
        let query = { isActive: true };
        
        // Add filters
        if (ageGroup) query.ageGroups = ageGroup;
        if (targetAudience) query.targetAudience = targetAudience;
        if (popular === 'true') query.popular = true;
        if (search) query = { ...query, ...Package.searchPackages(search) };
        
        let packagesQuery = Package.find(query).sort({ popular: -1, 'analytics.enrollments': -1 });
        
        if (limit) packagesQuery = packagesQuery.limit(parseInt(limit));
        
        const packages = await packagesQuery;
        
        // Increment views for each package
        await Promise.all(packages.map(pkg => pkg.incrementViews()));
        
        res.json(packages);
    } catch (error) {
        console.error("Error fetching packages:", error);
        res.status(500).json({ 
            message: "Error fetching packages", 
            error: error.message 
        });
    }
});

// ========== LEARNING EVENTS & QUIZ ENDPOINTS ==========

// Post learning event / heartbeat
app.post("/learning/events", async (req, res) => {
    try {
        const { userId, courseId, type, sessionId, activeMs = 0, progressPercentage, source, meta } = req.body;
        if (!userId || !courseId || !type) {
            return res.status(400).json({ message: "userId, courseId and type are required" });
        }

        const event = await LearningEvent.create({ userId, courseId, type, sessionId, activeMs, progressPercentage, source, userAgent: req.headers['user-agent'], meta });

        // rollup to UserProgress (guarded)
        let progress = await UserProgress.findUserProgress(userId, courseId);
        if (!progress) {
            progress = new UserProgress({ userId, courseId, status: 'in_progress', startedAt: new Date() });
        }
        // convert ms to minutes for the rollup
        const deltaMinutes = Math.max(0, Math.round((activeMs || 0) / 60000));
        const pct = typeof progressPercentage === 'number' ? progressPercentage : progress.progressPercentage;
        await progress.updateProgress(pct, deltaMinutes);

        // streak update
        await User.findByIdAndUpdate(userId, { $set: { 'progress.lastActivityDate': new Date() } });

        res.status(201).json({ eventId: event._id });
    } catch (error) {
        console.error("Learning event error:", error);
        res.status(500).json({ message: "Failed to record learning event", error: error.message });
    }
});

// Submit quiz attempt
app.post("/quizzes/:courseId/:quizId/attempts", async (req, res) => {
    try {
        const { courseId, quizId } = req.params;
        const { userId, score, totalQuestions, correct, timeMs, answers } = req.body;
        if (!userId) return res.status(400).json({ message: "userId is required" });

        const lastAttempt = await QuizAttempt.findOne({ userId, courseId, quizId }).sort({ attemptNo: -1 });
        const attemptNo = (lastAttempt?.attemptNo || 0) + 1;
        const passed = typeof score === 'number' ? score >= 70 : false;

        const attempt = await QuizAttempt.create({ userId, courseId, quizId, attemptNo, submittedAt: new Date(), score, totalQuestions, correct, timeMs, passed, answers });

        // update UserProgress rollup
        let progress = await UserProgress.findUserProgress(userId, courseId);
        if (!progress) progress = new UserProgress({ userId, courseId, status: 'in_progress', startedAt: new Date() });
        await progress.addQuizResult({ score, totalQuestions, correctAnswers: correct, timeSpent: Math.round((timeMs || 0) / 60000) });

        res.status(201).json({ attemptId: attempt._id, attemptNo });
    } catch (error) {
        console.error("Quiz attempt error:", error);
        res.status(500).json({ message: "Failed to record quiz attempt", error: error.message });
    }
});

// Dashboard analytics quick summary
app.get("/analytics/summary/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const since = new Date();
        since.setDate(since.getDate() - 7);

        const [user, progressDocs, weeklyMsAgg, quizAgg, quizPassAgg] = await Promise.all([
            User.findById(userId).select('progress'),
            UserProgress.find({ userId }).select('courseId status progressPercentage timeSpent completedAt updatedAt'),
            LearningEvent.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), ts: { $gte: since } } },
                { $group: { _id: null, totalMs: { $sum: "$activeMs" } } }
            ]),
            QuizAttempt.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                { $group: { _id: null, attempts: { $sum: 1 }, avgScore: { $avg: "$score" } } }
            ]),
            QuizAttempt.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), passed: true } },
                { $group: { _id: null, passed: { $sum: 1 } } }
            ])
        ]);

        const weeklyMs = weeklyMsAgg[0]?.totalMs || 0;
        const totalCompleted = progressDocs.filter(p => p.status === 'completed').length;
        const totalStarted = progressDocs.length;
        const completionPct = totalStarted ? Math.round((totalCompleted / totalStarted) * 100) : 0;
        const quizAttempts = quizAgg[0]?.attempts || 0;
        const avgQuiz = Math.round(quizAgg[0]?.avgScore || 0);
        const quizPassed = quizPassAgg[0]?.passed || 0;
        const quizPassRate = quizAttempts ? Math.round((quizPassed / quizAttempts) * 100) : 0;
        const currentStreak = user?.progress?.currentStreak || 0;

        res.json({
            weeklyMinutes: Math.round(weeklyMs / 60000),
            completionPct,
            totalCompleted,
            avgQuiz,
            quizAttempts,
            quizPassRate,
            currentStreak,
            coursesInProgress: progressDocs.filter(p => p.status === 'in_progress').length
        });
    } catch (error) {
        console.error("Analytics summary error:", error);
        res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
    }
});

// Get a specific package by ID
app.get("/packages/:id", async (req, res) => {
    try {
        const packageData = await Package.findOne({ 
            id: req.params.id, 
            isActive: true 
        });
        
        if (!packageData) {
            return res.status(404).json({ message: "Package not found" });
        }
        
        // Increment views
        await packageData.incrementViews();
        
        res.json(packageData);
    } catch (error) {
        console.error("Error fetching package:", error);
        res.status(500).json({ 
            message: "Error fetching package", 
            error: error.message 
        });
    }
});

// Get popular packages
app.get("/packages/popular", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const packages = await Package.getPopular(limit);
        res.json(packages);
    } catch (error) {
        console.error("Error fetching popular packages:", error);
        res.status(500).json({ 
            message: "Error fetching popular packages", 
            error: error.message 
        });
    }
});

// ========== AUTHENTICATION ENDPOINTS ==========

// Login endpoint
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        
        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        // For demo purposes, we'll do a simple password check
        // In production, you should hash passwords and compare hashes
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        // Return user data (excluding password)
        const userData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            ageGroup: user.ageGroup,
            userType: user.userType
        };
        
        res.json({ 
            message: "Login successful", 
            user: userData 
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ 
            message: "Login failed", 
            error: error.message 
        });
    }
});

// Register endpoint
app.post("/auth/register", async (req, res) => {
    try {
        const userData = req.body;
        
        // Check if user already exists
        const existingUser = await User.findByEmail(userData.email);
        if (existingUser) {
            return res.status(409).json({ message: "User already exists with this email" });
        }
        
        // Create new user
        const user = new User(userData);
        await user.save();
        
        // Return user data (excluding password)
        const responseData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            ageGroup: user.ageGroup,
            userType: user.userType
        };
        
        res.status(201).json({ 
            message: "Registration successful", 
            user: responseData 
        });
    } catch (error) {
        console.error("Registration error:", error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: "Validation error", 
                errors: error.errors 
            });
        }
        
        res.status(500).json({ 
            message: "Registration failed", 
            error: error.message 
        });
    }
});

// ========== USER MANAGEMENT ENDPOINTS ==========

// Create/Update user profile
app.post("/users", async (req, res) => {
    try {
        const userData = req.body;
        
        // Check if user exists by email or firebaseUid
        let user;
        if (userData.firebaseUid) {
            user = await User.findByFirebaseUid(userData.firebaseUid);
        } else if (userData.email) {
            user = await User.findByEmail(userData.email);
        }
        
        if (user) {
            // Update existing user
            Object.assign(user, userData);
            await user.save();
            res.json({ user, message: "User updated successfully" });
        } else {
            // Create new user
            user = new User(userData);
            await user.save();
            res.status(201).json({ user, message: "User created successfully" });
        }
    } catch (error) {
        console.error("Error creating/updating user:", error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: "Validation error", 
                errors: error.errors 
            });
        }
        
        if (error.code === 11000) {
            return res.status(409).json({ 
                message: "User already exists with this email" 
            });
        }
        
        res.status(500).json({ 
            message: "Error creating/updating user", 
            error: error.message 
        });
    }
});

// Get user profile
app.get("/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ 
            message: "Error fetching user", 
            error: error.message 
        });
    }
});

// Enroll user in package
app.post("/users/:userId/enroll/:packageId", async (req, res) => {
    try {
        const { userId, packageId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const packageData = await Package.findOne({ id: packageId });
        if (!packageData) {
            return res.status(404).json({ message: "Package not found" });
        }
        
        // Enroll user in package
        await user.enrollInPackage(packageId);
        await packageData.addEnrollment();
        
        res.json({ 
            message: "Successfully enrolled in package",
            package: packageData
        });
    } catch (error) {
        console.error("Error enrolling user:", error);
        res.status(500).json({ 
            message: "Error enrolling user", 
            error: error.message 
        });
    }
});

// ========== USER PROGRESS ENDPOINTS ==========

// Get user progress for a course
app.get("/users/:userId/progress/:courseId", async (req, res) => {
    try {
        const { userId, courseId } = req.params;
        
        const progress = await UserProgress.findUserProgress(userId, courseId);
        if (!progress) {
            return res.status(404).json({ message: "Progress not found" });
        }
        
        res.json(progress);
    } catch (error) {
        console.error("Error fetching user progress:", error);
        res.status(500).json({ 
            message: "Error fetching progress", 
            error: error.message 
        });
    }
});

// Update user progress
app.post("/users/:userId/progress/:courseId", async (req, res) => {
    try {
        const { userId, courseId } = req.params;
        const { progressPercentage, timeSpent } = req.body;
        
        let progress = await UserProgress.findUserProgress(userId, courseId);
        
        if (!progress) {
            // Create new progress record
            progress = new UserProgress({
                userId,
                courseId,
                progressPercentage: 0,
                timeSpent: 0
            });
        }
        
        // Update progress
        await progress.updateProgress(progressPercentage, timeSpent);
        
        // Update user and course analytics
        const user = await User.findById(userId);
        const course = await Course.findOne({ id: courseId });
        
        if (user && progress.status === 'completed' && progress.progressPercentage === 100) {
            user.progress.totalCoursesCompleted += 1;
            await user.save();
            
            if (course) {
                await course.addCompletion();
            }
        }
        
        res.json({
            progress,
            message: "Progress updated successfully"
        });
    } catch (error) {
        console.error("Error updating progress:", error);
        res.status(500).json({ 
            message: "Error updating progress", 
            error: error.message 
        });
    }
});

// ========== ANALYTICS ENDPOINTS ==========

// Get dashboard stats
app.get("/analytics/dashboard", async (req, res) => {
    try {
        const [
            totalCourses,
            totalPackages,
            totalUsers,
            popularCourses,
            popularPackages
        ] = await Promise.all([
            Course.countDocuments({ isPublished: true }),
            Package.countDocuments({ isActive: true }),
            User.countDocuments({ isActive: true }),
            Course.getPopular(5),
            Package.getPopular(3)
        ]);
        
        res.json({
            stats: {
                totalCourses,
                totalPackages,
                totalUsers
            },
            popularCourses,
            popularPackages
        });
    } catch (error) {
        console.error("Error fetching dashboard analytics:", error);
        res.status(500).json({ 
            message: "Error fetching analytics", 
            error: error.message 
        });
    }
});
// ========== TRANSLATION ENDPOINTS ==========

// Simple admin probe to view recent learning events (last 20)
app.get('/admin/learning-events/:userId', async (req, res) => {
    try {
        const events = await LearningEvent.find({ userId: req.params.userId }).sort({ ts: -1 }).limit(20);
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch events', error: error.message });
    }
});

// Text translation endpoint
app.post("/translate", async (req, res) => {
    try {
        const { text, source_lang, target_lang } = req.body;
        
        if (!text) {
            return res.status(400).json({ 
                error: "Text is required" 
            });
        }
        
        // Use Google Translate API or similar service
        // For now, we'll return a mock response
        // In production, integrate with a translation service like Google Translate API
        
        // Simple mock translation for demonstration
        let translated_text = text;
        
        // You can integrate with deep-translator or Google Translate API here
        // Example with fetch to external API:
        /*
        const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: text,
                source: source_lang,
                target: target_lang,
                key: process.env.GOOGLE_TRANSLATE_API_KEY
            })
        });
        const data = await response.json();
        translated_text = data.data.translations[0].translatedText;
        */
        
        res.json({
            original_text: text,
            translated_text: translated_text,
            source_lang: source_lang,
            target_lang: target_lang
        });
    } catch (error) {
        console.error("Translation error:", error);
        res.status(500).json({ 
            error: "Translation failed", 
            details: error.message 
        });
    }
});

// Text summarization endpoint
app.post("/summarize", async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ 
                error: "Text is required" 
            });
        }
        
        // Simple summarization: take first 50 words
        const words = text.split(/\s+/);
        const summary = words.slice(0, 50).join(' ') + (words.length > 50 ? '...' : '');
        
        // In production, you can integrate with OpenAI API, Hugging Face, or other NLP services
        
        res.json({
            original_text: text,
            summary_text: summary,
            word_count: words.length,
            summary_word_count: Math.min(50, words.length)
        });
    } catch (error) {
        console.error("Summarization error:", error);
        res.status(500).json({ 
            error: "Summarization failed", 
            details: error.message 
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "healthy",
        message: "API is running",
        timestamp: new Date().toISOString()
    });
});

// ========== SIGN VIDEO LIBRARY ==========

// Cache for available sign videos
let availableSignVideos = null;

// Load available sign videos from the directory
function loadAvailableSignVideos() {
    const signsDir = path.join(__dirname, 'public', 'assets', 'videos', 'signs');
    try {
        const files = fs.readdirSync(signsDir);
        const videos = {};
        
        files.forEach(file => {
            if (file.endsWith('.webm')) {
                const signName = file.replace('.webm', '');
                // Store both original and uppercase versions for matching
                videos[signName.toUpperCase()] = {
                    filename: file,
                    path: `/assets/videos/signs/${file}`,
                    name: signName
                };
            }
        });
        
        availableSignVideos = videos;
        console.log(`Loaded ${Object.keys(videos).length} sign videos`);
        return videos;
    } catch (error) {
        console.error('Error loading sign videos:', error);
        return {};
    }
}

// Initialize sign videos on startup
loadAvailableSignVideos();

// Find video for a given sign/word
function findSignVideo(word) {
    if (!availableSignVideos) {
        loadAvailableSignVideos();
    }
    
    if (!word) return null;
    
    // Normalize the word - try uppercase first
    const normalizedWord = word.toUpperCase().trim();
    
    // Direct match
    if (availableSignVideos[normalizedWord]) {
        return availableSignVideos[normalizedWord];
    }
    
    // Try without special characters
    const cleanWord = normalizedWord.replace(/[^A-Z0-9]/g, '');
    if (availableSignVideos[cleanWord]) {
        return availableSignVideos[cleanWord];
    }
    
    return null;
}

// Get list of all available signs
function getAllAvailableSigns() {
    if (!availableSignVideos) {
        loadAvailableSignVideos();
    }
    return Object.keys(availableSignVideos || {});
}

// API endpoint to get all available sign videos
app.get("/signs/available", (req, res) => {
    const signs = getAllAvailableSigns();
    res.json({
        count: signs.length,
        signs: signs.sort()
    });
});

// API endpoint to check if a specific sign video exists
app.get("/signs/check/:word", (req, res) => {
    const word = req.params.word;
    const video = findSignVideo(word);
    
    if (video) {
        res.json({
            found: true,
            sign: word,
            video: video
        });
    } else {
        res.json({
            found: false,
            sign: word,
            suggestions: findSimilarSigns(word)
        });
    }
});

// Find similar signs for suggestions
function findSimilarSigns(word) {
    const signs = getAllAvailableSigns();
    const normalizedWord = word.toUpperCase();
    
    // Find signs that start with the same letters
    const startsWith = signs.filter(s => s.startsWith(normalizedWord.slice(0, 2))).slice(0, 5);
    
    // Find signs that contain the word
    const contains = signs.filter(s => s.includes(normalizedWord)).slice(0, 5);
    
    return [...new Set([...startsWith, ...contains])].slice(0, 5);
}

// ========== AI TUTOR (SignMentor) ENDPOINTS ==========

// AI Tutor System Prompt Template
const AI_TUTOR_SYSTEM_PROMPT = `You are SignMentor, an expert and compassionate sign language tutor for the LearnSign platform.

═══════════════════════════════════════════════════════════════
ABOUT YOU:
═══════════════════════════════════════════════════════════════
- Expert in Indian Sign Language (ISL) with 10+ years teaching experience
- Warm, encouraging, patient, and culturally sensitive
- Specialized in teaching children, teens, and adults
- Deep knowledge of Deaf culture, history, and community
- Skilled at breaking down complex movements into simple steps
- Passionate about making sign language accessible to everyone

═══════════════════════════════════════════════════════════════
CURRENT STUDENT PROFILE:
═══════════════════════════════════════════════════════════════
Name: {{userName}}
Age Group: {{ageGroup}}
Account Created: {{accountAge}} days ago
Total Courses Enrolled: {{totalCourses}}
Courses Completed: {{coursesCompleted}}
Overall Progress: {{progressPercentage}}%
Total Learning Time: {{totalMinutes}} minutes
Recent Quiz Scores: {{recentQuizScores}}
Average Quiz Score: {{avgQuizScore}}%
Current Streak: {{currentStreak}} days
Last Active: {{lastActive}}
Struggling Areas: {{weakAreas}}
Strong Areas: {{strongAreas}}
Preferred Language: {{language}}
Learning Style: {{learningStyle}}

═══════════════════════════════════════════════════════════════
YOUR TEACHING CAPABILITIES:
═══════════════════════════════════════════════════════════════
1. SIGN INSTRUCTION
   - Explain hand shapes, positions, and movements
   - Break down complex signs into simple steps
   - Provide memory tricks and mnemonics
   - Describe common mistakes and how to avoid them
   - Reference our 350+ video library when applicable

2. LEARNING SUPPORT
   - Answer questions about lessons and quizzes
   - Clarify confusing concepts
   - Provide additional practice exercises
   - Suggest learning strategies based on individual needs
   - Help with time management and study planning

3. PROGRESS GUIDANCE
   - Analyze student's learning patterns
   - Recommend personalized next steps
   - Identify knowledge gaps
   - Celebrate achievements and milestones
   - Provide constructive feedback on quiz performance

4. CULTURAL EDUCATION
   - Share Deaf culture history and etiquette
   - Explain regional sign variations
   - Discuss famous Deaf individuals and their contributions
   - Teach respectful communication practices
   - Provide context for why certain signs exist

5. MOTIVATION & SUPPORT
   - Encourage struggling learners
   - Celebrate small wins
   - Provide emotional support for challenging topics
   - Share inspiring success stories
   - Build confidence through positive reinforcement

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (ALWAYS RETURN JSON):
═══════════════════════════════════════════════════════════════
You MUST respond with valid JSON in one of these formats:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT 1: When user asks about a SPECIFIC SIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "type": "sign_instruction",
  "sign": "hello",
  "response": "Detailed explanation in 2-3 paragraphs",
  "stepByStep": [
    "Step 1: Starting hand position",
    "Step 2: The movement",
    "Step 3: Ending position"
  ],
  "commonMistakes": [
    "Mistake 1 and how to fix it",
    "Mistake 2 and how to fix it"
  ],
  "memoryTrick": "Easy way to remember this sign",
  "culturalNote": "Cultural or historical context (optional)",
  "practiceExercise": "Specific exercise to practice",
  "relatedSigns": ["hi", "goodbye", "welcome"],
  "videoAvailable": true,
  "difficultyLevel": "beginner",
  "estimatedPracticeTime": "5-10 minutes"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT 2: For GENERAL QUESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "type": "general_help",
  "response": "Helpful answer in 2-3 paragraphs",
  "keyPoints": [
    "Main point 1",
    "Main point 2",
    "Main point 3"
  ],
  "actionableAdvice": "One specific action they can take now",
  "resources": ["Link to relevant lesson", "Suggested practice"],
  "encouragement": "Motivational message"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT 3: For PROGRESS/RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "type": "recommendation",
  "progressAssessment": "Brief honest assessment of their progress",
  "strengths": [
    "Area where they excel",
    "Another strength"
  ],
  "areasToImprove": [
    "Specific area needing work",
    "Why it's important"
  ],
  "recommendedCourses": [
    {
      "courseId": "005",
      "title": "Emotions & Expressions",
      "reason": "Why this course is perfect for them now",
      "estimatedTime": "2 weeks"
    }
  ],
  "weeklyGoal": "Achievable goal for next 7 days",
  "motivationMessage": "Personalized encouragement"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT 4: For QUIZ HELP / STRUGGLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "type": "support",
  "empathy": "Acknowledge their struggle",
  "diagnosis": "What might be causing the difficulty",
  "solutions": [
    {
      "solution": "Specific strategy",
      "howTo": "Step-by-step implementation",
      "timeNeeded": "10 minutes"
    }
  ],
  "encouragement": "Strong motivational message",
  "reminderOfProgress": "Reference their past successes"
}

═══════════════════════════════════════════════════════════════
RESPONSE GUIDELINES:
═══════════════════════════════════════════════════════════════
LENGTH & STYLE:
✓ Keep responses concise (2-4 paragraphs maximum)
✓ Use clear, simple language appropriate for {{ageGroup}}
✓ Be conversational and warm, not robotic
✓ Use second person ("you") to make it personal
✓ Break complex ideas into digestible chunks

TONE & APPROACH:
✓ Always encouraging and supportive
✓ Never condescending or overly technical
✓ Celebrate effort, not just results
✓ Acknowledge struggles with empathy
✓ Balance honesty with kindness
✓ Use appropriate emojis (max 2-3 per response)

PERSONALIZATION:
✓ Reference the student's name naturally
✓ Mention their specific progress/achievements
✓ Connect advice to their current level
✓ Adjust complexity based on age group
✓ Acknowledge their learning pace

ACTIONABILITY:
✓ Always provide at least ONE specific action
✓ Give concrete examples, not vague advice
✓ Include estimated time for suggestions
✓ Make recommendations achievable
✓ Connect to available platform resources

═══════════════════════════════════════════════════════════════
SIGN LANGUAGE VIDEO LIBRARY (350+ Signs Available):
═══════════════════════════════════════════════════════════════
BASICS: hello, hi, goodbye, please, thank you, sorry, yes, no, help, stop, go, come, wait
FAMILY: mother, mom, father, dad, sister, brother, family, baby, grandmother, grandfather, aunt, uncle, cousin
EMOTIONS: happy, sad, angry, excited, scared, worried, tired, bored, surprised, love, like, hate, feel
DAILY LIFE: eat, drink, sleep, wake up, shower, brush teeth, get dressed, hungry, thirsty, hot, cold
SCHOOL: learn, teach, student, teacher, school, class, homework, test, read, write, book, pencil
NUMBERS: 0-100 (all available)
ALPHABET: A-Z (all available)

When a sign is available, set "videoAvailable": true

═══════════════════════════════════════════════════════════════
REMEMBER:
═══════════════════════════════════════════════════════════════
- You're not just teaching signs - you're building confidence and enabling communication
- Every student learns at their own pace - meet them where they are
- Mistakes are part of learning - celebrate attempts, not just perfection
- ISL is a beautiful language with rich culture - share that passion
- Your encouragement might be what keeps someone learning when they want to quit
- ALWAYS return valid JSON
- Keep responses in {{language}} language

You are making a real difference in breaking down communication barriers! 🤟`;

// Helper function to fetch user profile data for AI tutor
async function getUserTutorProfile(userId) {
    try {
        const [user, progressDocs, quizAttempts, recentEvents] = await Promise.all([
            User.findById(userId),
            UserProgress.find({ userId }),
            QuizAttempt.find({ userId }).sort({ submittedAt: -1 }).limit(10),
            LearningEvent.find({ userId }).sort({ ts: -1 }).limit(20)
        ]);

        if (!user) {
            return null;
        }

        // Calculate account age
        const accountAge = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        // Calculate course stats
        const totalCourses = progressDocs.length;
        const coursesCompleted = progressDocs.filter(p => p.status === 'completed').length;
        const avgProgress = totalCourses > 0 
            ? Math.round(progressDocs.reduce((sum, p) => sum + p.progressPercentage, 0) / totalCourses) 
            : 0;

        // Calculate total learning time
        const totalMinutes = progressDocs.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

        // Get recent quiz scores
        const recentQuizScores = quizAttempts.slice(0, 5).map(q => `${q.score}%`).join(', ') || 'No quizzes taken yet';
        const avgQuizScore = quizAttempts.length > 0 
            ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score || 0), 0) / quizAttempts.length)
            : 0;

        // Identify weak and strong areas based on quiz performance
        const courseQuizPerformance = {};
        quizAttempts.forEach(q => {
            if (!courseQuizPerformance[q.courseId]) {
                courseQuizPerformance[q.courseId] = { scores: [], passed: 0, failed: 0 };
            }
            courseQuizPerformance[q.courseId].scores.push(q.score || 0);
            if (q.passed) courseQuizPerformance[q.courseId].passed++;
            else courseQuizPerformance[q.courseId].failed++;
        });

        const weakAreas = [];
        const strongAreas = [];
        Object.entries(courseQuizPerformance).forEach(([courseId, data]) => {
            const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            if (avgScore < 70) weakAreas.push(courseId);
            else if (avgScore >= 85) strongAreas.push(courseId);
        });

        // Determine last active
        const lastActive = user.progress?.lastActivityDate 
            ? formatTimeAgo(new Date(user.progress.lastActivityDate))
            : 'Never';

        // Determine learning style based on behavior
        const learningStyle = determineLearningStyle(recentEvents, quizAttempts);

        return {
            userName: user.name || 'Learner',
            ageGroup: user.ageGroup || '15+',
            accountAge,
            totalCourses,
            coursesCompleted,
            progressPercentage: avgProgress,
            totalMinutes,
            recentQuizScores,
            avgQuizScore,
            currentStreak: user.progress?.currentStreak || 0,
            lastActive,
            weakAreas: weakAreas.length > 0 ? weakAreas.join(', ') : 'None identified yet',
            strongAreas: strongAreas.length > 0 ? strongAreas.join(', ') : 'Keep learning to find your strengths!',
            language: user.preferences?.language || 'en',
            learningStyle
        };
    } catch (error) {
        console.error('Error fetching user tutor profile:', error);
        return null;
    }
}

// Helper function to format time ago
function formatTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
}

// Helper function to determine learning style
function determineLearningStyle(events, quizAttempts) {
    if (!events || events.length === 0) return 'Visual learner (default)';
    
    const avgSessionLength = events.reduce((sum, e) => sum + (e.activeMs || 0), 0) / events.length / 60000;
    const quizFrequency = quizAttempts.length;
    
    if (avgSessionLength > 30 && quizFrequency > 5) {
        return 'Deep learner - prefers thorough understanding';
    } else if (avgSessionLength < 10 && quizFrequency > 3) {
        return 'Quick learner - prefers short bursts with frequent testing';
    } else if (avgSessionLength > 20) {
        return 'Focused learner - enjoys longer study sessions';
    } else {
        return 'Visual learner - benefits from video demonstrations';
    }
}

// Populate system prompt with user data
function populateSystemPrompt(profile) {
    let prompt = AI_TUTOR_SYSTEM_PROMPT;
    
    const replacements = {
        '{{userName}}': profile.userName,
        '{{ageGroup}}': profile.ageGroup,
        '{{accountAge}}': profile.accountAge.toString(),
        '{{totalCourses}}': profile.totalCourses.toString(),
        '{{coursesCompleted}}': profile.coursesCompleted.toString(),
        '{{progressPercentage}}': profile.progressPercentage.toString(),
        '{{totalMinutes}}': profile.totalMinutes.toString(),
        '{{recentQuizScores}}': profile.recentQuizScores,
        '{{avgQuizScore}}': profile.avgQuizScore.toString(),
        '{{currentStreak}}': profile.currentStreak.toString(),
        '{{lastActive}}': profile.lastActive,
        '{{weakAreas}}': profile.weakAreas,
        '{{strongAreas}}': profile.strongAreas,
        '{{language}}': profile.language,
        '{{learningStyle}}': profile.learningStyle
    };
    
    for (const [placeholder, value] of Object.entries(replacements)) {
        prompt = prompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    return prompt;
}

// Extract sign words from user message - now accepts ANY word
function extractSignWords(message) {
    if (!message) return null;
    
    const cleanMessage = message.trim();
    
    // First, try common patterns for explicit requests
    const patterns = [
        /how (?:do i |to |can i )?sign [""']?([a-zA-Z0-9]+)[""']?/i,
        /sign (?:for |the word )?[""']?([a-zA-Z0-9]+)[""']?/i,
        /what(?:'s| is) the sign for [""']?([a-zA-Z0-9]+)[""']?/i,
        /show me [""']?([a-zA-Z0-9]+)[""']?/i,
        /teach me [""']?([a-zA-Z0-9]+)[""']?/i,
        /learn [""']?([a-zA-Z0-9]+)[""']?/i
    ];
    
    for (const pattern of patterns) {
        const match = cleanMessage.match(pattern);
        if (match && match[1]) {
            return match[1].toUpperCase();
        }
    }
    
    // If message is just 1-2 words, treat the whole thing as a sign request
    const words = cleanMessage.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 2) {
        // Join words (for compound signs like "THANK YOU")
        const potentialSign = words.join(' ').toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
        if (potentialSign.length > 0) {
            return potentialSign;
        }
    }
    
    // Try to find any word that matches a sign in our library
    const upperMessage = cleanMessage.toUpperCase();
    const allSigns = getAllAvailableSigns();
    
    // Check for exact matches first
    for (const sign of allSigns) {
        if (upperMessage === sign || upperMessage.includes(sign)) {
            return sign;
        }
    }
    
    // If nothing found, return the first word
    if (words.length > 0) {
        return words[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    
    return null;
}

// AI Tutor Chat Endpoint - Supports sentences with multiple videos + OpenAI intelligence
app.post("/tutor/chat", async (req, res) => {
    try {
        const { userId, message, conversationHistory = [] } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ 
                error: "userId and message are required" 
            });
        }

        const cleanMessage = message.trim().toUpperCase();
        const originalMessage = message.trim();
        
        // Check if it's a sign/word request (short message or explicit request)
        const isSignRequest = cleanMessage.split(/\s+/).length <= 3 || 
            /how (do i |to |can i )?sign|show me|teach me|what('s| is) the sign/i.test(originalMessage);
        
        // Split message into words and find videos for each
        const words = cleanMessage.split(/\s+/).filter(w => w.length > 0);
        const videoSequence = [];
        const notFoundWords = [];
        
        for (const word of words) {
            const cleanWord = word.replace(/[^A-Z0-9]/g, '');
            if (cleanWord.length === 0) continue;
            
            const video = findSignVideo(cleanWord);
            if (video) {
                videoSequence.push({
                    word: cleanWord,
                    video: video
                });
            } else {
                notFoundWords.push(cleanWord);
            }
        }
        
        // If we found videos, return them
        if (videoSequence.length > 0 && isSignRequest) {
            const isSentence = videoSequence.length > 1;
            const foundWords = videoSequence.map(v => v.word).join(' ');
            
            const response = {
                type: "sign_sequence",
                isSentence: isSentence,
                sentence: foundWords,
                response: isSentence 
                    ? `Here's how to sign "${foundWords}" 👇`
                    : `Here's how to sign "${foundWords}" 👇`,
                videoSequence: videoSequence.map(v => ({
                    word: v.word,
                    path: v.video.path
                })),
                notFoundWords: notFoundWords,
                totalVideos: videoSequence.length
            };
            
            // Add warning if some words weren't found
            if (notFoundWords.length > 0) {
                response.warning = `Note: No video for: ${notFoundWords.join(', ')}`;
            }
            
            return res.json({
                success: true,
                response: response,
                userProfile: { name: 'Learner', streak: 0, progress: 0 }
            });
        }
        
        // For general questions or no videos found, use OpenAI
        try {
            const userProfile = await getUserTutorProfile(userId);
            const systemPrompt = userProfile ? populateSystemPrompt(userProfile) : AI_TUTOR_SYSTEM_PROMPT;
            
            // Get available signs for context
            const availableSigns = getAllAvailableSigns().slice(0, 50);
            
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: systemPrompt + `\n\nAvailable sign videos: ${availableSigns.join(', ')}...` 
                    },
                    ...conversationHistory.slice(-6).map(msg => ({
                        role: msg.role,
                        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                    })),
                    { role: "user", content: originalMessage }
                ],
                max_tokens: 800,
                temperature: 0.7
            });
            
            let aiResponse = completion.choices[0].message.content;
            
            // Try to parse as JSON, otherwise wrap in general_help format
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(aiResponse);
            } catch {
                parsedResponse = {
                    type: "general_help",
                    response: aiResponse,
                    availableSigns: findSimilarSigns(words[0] || 'hello').slice(0, 8)
                };
            }
            
            return res.json({
                success: true,
                response: parsedResponse,
                userProfile: userProfile || { name: 'Learner', streak: 0, progress: 0 }
            });
            
        } catch (aiError) {
            console.error("OpenAI error:", aiError.message);
            
            // Fallback to suggestions if OpenAI fails
            const suggestions = words.length > 0 ? findSimilarSigns(words[0]) : [];
            const availableSigns = getAllAvailableSigns();
            const randomSigns = availableSigns.sort(() => 0.5 - Math.random()).slice(0, 8);
            
            return res.json({
                success: true,
                response: {
                    type: "not_found",
                    sign: cleanMessage,
                    response: `I couldn't find videos for "${message}". Try one of these signs instead!`,
                    suggestions: suggestions.length > 0 ? suggestions : randomSigns,
                    totalAvailable: availableSigns.length
                },
                userProfile: { name: 'Learner', streak: 0, progress: 0 }
            });
        }
        
    } catch (error) {
        console.error("AI Tutor error:", error);
        res.status(500).json({ 
            error: "Failed to process request",
            details: error.message
        });
    }
});

// Get user tutor profile (for frontend display)
app.get("/tutor/profile/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const profile = await getUserTutorProfile(userId);
        
        if (!profile) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json(profile);
    } catch (error) {
        console.error("Error fetching tutor profile:", error);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// ========== OPENAI-POWERED ENDPOINTS ==========

/**
 * Generate personalized quiz questions using OpenAI
 */
app.post("/ai/generate-quiz", async (req, res) => {
    try {
        const { userId, topic, difficulty = 'medium', questionCount = 5 } = req.body;
        
        if (!topic) {
            return res.status(400).json({ error: "Topic is required" });
        }
        
        // Get available signs for the topic
        const availableSigns = getAllAvailableSigns();
        const topicSigns = availableSigns.filter(s => 
            s.toLowerCase().includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(s.toLowerCase())
        );
        
        const signsToUse = topicSigns.length > 0 ? topicSigns : availableSigns.slice(0, 20);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a sign language quiz generator. Create engaging multiple-choice questions about sign language.
                    
Available signs for questions: ${signsToUse.join(', ')}

Return ONLY valid JSON in this format:
{
    "quiz": {
        "title": "Quiz title",
        "questions": [
            {
                "question": "Question text",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": 0,
                "explanation": "Why this is correct"
            }
        ]
    }
}`
                },
                {
                    role: "user",
                    content: `Generate ${questionCount} ${difficulty} difficulty quiz questions about "${topic}" in sign language. Include questions about hand shapes, movements, and common mistakes.`
                }
            ],
            max_tokens: 1500,
            temperature: 0.8
        });
        
        let quizData;
        try {
            quizData = JSON.parse(completion.choices[0].message.content);
        } catch {
            quizData = { error: "Failed to parse quiz", raw: completion.choices[0].message.content };
        }
        
        res.json({
            success: true,
            ...quizData
        });
        
    } catch (error) {
        console.error("Quiz generation error:", error);
        res.status(500).json({ error: "Failed to generate quiz", details: error.message });
    }
});

/**
 * Get personalized learning recommendations using OpenAI
 */
app.post("/ai/recommendations", async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        
        const userProfile = await getUserTutorProfile(userId);
        const availableCourses = await Course.find({ isPublished: true }).limit(10);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a learning advisor for sign language students. Analyze the user's progress and recommend next steps.
                    
Return ONLY valid JSON:
{
    "summary": "Brief progress summary",
    "strengths": ["strength1", "strength2"],
    "focusAreas": ["area1", "area2"],
    "recommendedActions": [
        {"action": "What to do", "reason": "Why", "priority": "high/medium/low"}
    ],
    "motivationalMessage": "Encouraging message",
    "weeklyGoal": "Specific achievable goal"
}`
                },
                {
                    role: "user",
                    content: `User Profile:
- Name: ${userProfile?.userName || 'Learner'}
- Learning Time: ${userProfile?.totalMinutes || 0} minutes
- Courses Completed: ${userProfile?.coursesCompleted || 0}
- Current Streak: ${userProfile?.currentStreak || 0} days
- Quiz Average: ${userProfile?.avgQuizScore || 0}%
- Weak Areas: ${userProfile?.weakAreas || 'None identified'}
- Strong Areas: ${userProfile?.strongAreas || 'Still learning'}

Available courses: ${availableCourses.map(c => c.title).join(', ')}

Provide personalized learning recommendations.`
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });
        
        let recommendations;
        try {
            recommendations = JSON.parse(completion.choices[0].message.content);
        } catch {
            recommendations = { 
                summary: completion.choices[0].message.content,
                recommendedActions: []
            };
        }
        
        res.json({
            success: true,
            recommendations
        });
        
    } catch (error) {
        console.error("Recommendations error:", error);
        res.status(500).json({ error: "Failed to get recommendations", details: error.message });
    }
});

/**
 * Explain how to sign a word/phrase using OpenAI
 */
app.post("/ai/explain-sign", async (req, res) => {
    try {
        const { sign } = req.body;
        
        if (!sign) {
            return res.status(400).json({ error: "Sign is required" });
        }
        
        // Check if video exists
        const video = findSignVideo(sign);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert sign language instructor. Explain how to perform signs clearly and concisely.
                    
Return ONLY valid JSON:
{
    "sign": "the sign word",
    "handShape": "Description of hand shape",
    "position": "Where hands should be",
    "movement": "How hands move",
    "steps": ["Step 1", "Step 2", "Step 3"],
    "commonMistakes": ["Mistake 1", "Mistake 2"],
    "memoryTip": "Easy way to remember",
    "funFact": "Interesting fact about this sign"
}`
                },
                {
                    role: "user",
                    content: `Explain how to sign "${sign}" in Indian Sign Language (ISL). Be specific about hand shapes and movements.`
                }
            ],
            max_tokens: 600,
            temperature: 0.7
        });
        
        let explanation;
        try {
            explanation = JSON.parse(completion.choices[0].message.content);
        } catch {
            explanation = { 
                sign: sign,
                explanation: completion.choices[0].message.content
            };
        }
        
        res.json({
            success: true,
            videoAvailable: !!video,
            videoPath: video?.path || null,
            ...explanation
        });
        
    } catch (error) {
        console.error("Sign explanation error:", error);
        res.status(500).json({ error: "Failed to explain sign", details: error.message });
    }
});

/**
 * Translate sentence to sign language order using OpenAI
 */
app.post("/ai/translate-to-signs", async (req, res) => {
    try {
        const { sentence } = req.body;
        
        if (!sentence) {
            return res.status(400).json({ error: "Sentence is required" });
        }
        
        const availableSigns = getAllAvailableSigns();
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a sign language translator. Convert English sentences to sign language word order.
                    
Sign language often uses different word order than spoken English (e.g., Topic-Comment structure).
Available signs in our library: ${availableSigns.slice(0, 100).join(', ')}...

Return ONLY valid JSON:
{
    "originalSentence": "The original sentence",
    "signOrder": ["WORD1", "WORD2", "WORD3"],
    "explanation": "Why this word order",
    "unavailableSigns": ["words not in library"],
    "alternatives": {"unavailable_word": "suggested_alternative"}
}`
                },
                {
                    role: "user",
                    content: `Convert this sentence to sign language order: "${sentence}"`
                }
            ],
            max_tokens: 500,
            temperature: 0.5
        });
        
        let translation;
        try {
            translation = JSON.parse(completion.choices[0].message.content);
            
            // Check which signs have videos
            if (translation.signOrder) {
                translation.signOrder = translation.signOrder.map(word => {
                    const video = findSignVideo(word);
                    return {
                        word: word,
                        hasVideo: !!video,
                        videoPath: video?.path || null
                    };
                });
            }
        } catch {
            translation = { 
                originalSentence: sentence,
                explanation: completion.choices[0].message.content
            };
        }
        
        res.json({
            success: true,
            ...translation
        });
        
    } catch (error) {
        console.error("Translation error:", error);
        res.status(500).json({ error: "Failed to translate", details: error.message });
    }
});

// ========== VOICE-ENABLED AI TUTOR ENDPOINTS ==========

// Supported languages for Whisper
const SUPPORTED_LANGUAGES = {
    'en': 'English',
    'hi': 'Hindi',
    'kn': 'Kannada', 
    'te': 'Telugu'
};

/**
 * Speech-to-Text using OpenAI Whisper API
 * Converts audio blob to text transcription
 * Supports: English, Hindi, Kannada, Telugu
 */
app.post("/voice/speech-to-text", async (req, res) => {
    try {
        const { audio, language = 'en' } = req.body;
        
        if (!audio) {
            return res.status(400).json({ error: "Audio data is required" });
        }
        
        // Validate language
        const validLanguage = SUPPORTED_LANGUAGES[language] ? language : 'en';
        
        // Convert base64 audio to buffer
        const audioBuffer = Buffer.from(audio, 'base64');
        
        // Create a file object compatible with OpenAI SDK (Node.js)
        const audioFile = await toFile(audioBuffer, 'audio.webm', { type: 'audio/webm' });
        
        // Transcribe using Whisper with selected language
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: validLanguage,
            response_format: "json"
        });
        
        console.log(`[Voice] Transcription (${validLanguage}):`, transcription.text);
        
        res.json({
            success: true,
            text: transcription.text,
            language: validLanguage,
            languageName: SUPPORTED_LANGUAGES[validLanguage]
        });
        
    } catch (error) {
        console.error("Speech-to-text error:", error);
        res.status(500).json({ 
            error: "Failed to transcribe audio", 
            details: error.message 
        });
    }
});

/**
 * Text-to-Speech using OpenAI TTS API
 * Converts text response to audio for playback
 */
app.post("/voice/text-to-speech", async (req, res) => {
    try {
        const { text, voice = "nova" } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }
        
        // Limit text length to avoid excessive costs
        const truncatedText = text.slice(0, 4000);
        
        // Generate speech using OpenAI TTS
        const mp3Response = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice, // Options: alloy, echo, fable, onyx, nova, shimmer
            input: truncatedText,
            response_format: "mp3"
        });
        
        // Convert to buffer and then to base64
        const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
        const audioBase64 = audioBuffer.toString('base64');
        
        console.log('[Voice] TTS generated:', truncatedText.slice(0, 50) + '...');
        
        res.json({
            success: true,
            audio: audioBase64,
            format: "mp3",
            voice: voice
        });
        
    } catch (error) {
        console.error("Text-to-speech error:", error);
        res.status(500).json({ 
            error: "Failed to generate speech", 
            details: error.message 
        });
    }
});

/**
 * Combined Voice Chat endpoint
 * Transcribes audio → Gets AI response → Generates speech
 * Supports: English, Hindi, Kannada, Telugu
 */
app.post("/voice/chat", async (req, res) => {
    try {
        const { userId, audio, language = 'en', conversationHistory = [], voiceEnabled = true } = req.body;
        
        if (!userId || !audio) {
            return res.status(400).json({ error: "userId and audio are required" });
        }
        
        // Validate language
        const validLanguage = SUPPORTED_LANGUAGES[language] ? language : 'en';
        console.log(`[VoiceChat] Using language: ${validLanguage} (${SUPPORTED_LANGUAGES[validLanguage]})`);
        
        // Step 1: Transcribe audio to text
        const audioBuffer = Buffer.from(audio, 'base64');
        const audioFile = await toFile(audioBuffer, 'audio.webm', { type: 'audio/webm' });
        
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: validLanguage
        });
        
        const userMessage = transcription.text;
        console.log('[VoiceChat] User said:', userMessage);
        
        if (!userMessage || userMessage.trim().length === 0) {
            return res.json({
                success: true,
                transcription: "",
                response: { type: "error", response: "I couldn't hear that. Please try speaking again." },
                audio: null
            });
        }
        
        // Step 2: Process through tutor chat logic
        const cleanMessage = userMessage.trim().toUpperCase();
        
        // Check if it's a sign request
        const isSignRequest = cleanMessage.split(/\s+/).length <= 3;
        const words = cleanMessage.split(/\s+/).filter(w => w.length > 0);
        const videoSequence = [];
        const notFoundWords = [];
        
        for (const word of words) {
            const cleanWord = word.replace(/[^A-Z0-9]/g, '');
            if (cleanWord.length === 0) continue;
            
            const video = findSignVideo(cleanWord);
            if (video) {
                videoSequence.push({ word: cleanWord, video: video });
            } else {
                notFoundWords.push(cleanWord);
            }
        }
        
        let tutorResponse;
        let textForSpeech;
        
        if (videoSequence.length > 0 && isSignRequest) {
            const foundWords = videoSequence.map(v => v.word).join(' ');
            tutorResponse = {
                type: "sign_sequence",
                isSentence: videoSequence.length > 1,
                sentence: foundWords,
                response: `Here's how to sign "${foundWords}"`,
                videoSequence: videoSequence.map(v => ({
                    word: v.word,
                    path: v.video.path
                })),
                notFoundWords: notFoundWords,
                totalVideos: videoSequence.length
            };
            textForSpeech = `Here's how to sign ${foundWords}. Watch the video to learn!`;
            
            if (notFoundWords.length > 0) {
                tutorResponse.warning = `Note: No video for: ${notFoundWords.join(', ')}`;
                textForSpeech += ` I don't have videos for ${notFoundWords.join(' and ')}.`;
            }
        } else {
            // Use OpenAI for general questions
            try {
                const userProfile = await getUserTutorProfile(userId);
                const systemPrompt = userProfile ? populateSystemPrompt(userProfile) : AI_TUTOR_SYSTEM_PROMPT;
                
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...conversationHistory.slice(-6).map(msg => ({
                            role: msg.role,
                            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                        })),
                        { role: "user", content: userMessage }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                });
                
                let aiResponse = completion.choices[0].message.content;
                
                try {
                    tutorResponse = JSON.parse(aiResponse);
                    textForSpeech = tutorResponse.response || aiResponse;
                } catch {
                    tutorResponse = { type: "general_help", response: aiResponse };
                    textForSpeech = aiResponse;
                }
            } catch (aiError) {
                console.error("OpenAI error in voice chat:", aiError.message);
                tutorResponse = {
                    type: "not_found",
                    response: "I'm having trouble understanding. Could you try asking again?"
                };
                textForSpeech = tutorResponse.response;
            }
        }
        
        // Step 3: Generate TTS audio if voice is enabled
        let audioResponse = null;
        if (voiceEnabled && textForSpeech) {
            try {
                // Clean text for speech (remove markdown, emojis, etc.)
                const cleanTextForSpeech = textForSpeech
                    .replace(/[*_`#]/g, '')
                    .replace(/\[.*?\]/g, '')
                    .replace(/[^\w\s.,!?'-]/g, ' ')
                    .slice(0, 1000);
                
                const mp3Response = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: "nova",
                    input: cleanTextForSpeech
                });
                
                const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
                audioResponse = audioBuffer.toString('base64');
            } catch (ttsError) {
                console.error("TTS error:", ttsError.message);
                // Continue without audio
            }
        }
        
        res.json({
            success: true,
            transcription: userMessage,
            response: tutorResponse,
            audio: audioResponse,
            userProfile: { name: 'Learner', streak: 0, progress: 0 }
        });
        
    } catch (error) {
        console.error("Voice chat error:", error);
        res.status(500).json({ 
            error: "Failed to process voice chat", 
            details: error.message 
        });
    }
});

// ========== PARENT REPORT GENERATION ==========

/**
 * Generate comprehensive learning report for parents
 * Uses OpenAI to create personalized insights and recommendations
 */
app.get("/report/generate/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        
        console.log('[Report] Generating report for user:', userId);
        
        // Fetch all user data
        const [user, progressDocs, quizAttempts, learningEvents] = await Promise.all([
            User.findById(userId),
            UserProgress.find({ userId }),
            QuizAttempt.find({ userId }).sort({ submittedAt: -1 }),
            LearningEvent.find({ userId }).sort({ ts: -1 }).limit(100)
        ]);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Calculate statistics
        const totalCourses = progressDocs.length;
        const completedCourses = progressDocs.filter(p => p.status === 'completed').length;
        const totalTimeMinutes = progressDocs.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
        const avgProgress = totalCourses > 0 
            ? Math.round(progressDocs.reduce((sum, p) => sum + p.progressPercentage, 0) / totalCourses) 
            : 0;
        
        // Quiz statistics
        const totalQuizzes = quizAttempts.length;
        const avgQuizScore = totalQuizzes > 0 
            ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score || 0), 0) / totalQuizzes) 
            : 0;
        const quizzesPassed = quizAttempts.filter(q => q.passed).length;
        const passRate = totalQuizzes > 0 ? Math.round((quizzesPassed / totalQuizzes) * 100) : 0;
        
        // Weekly activity breakdown
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weeklyEvents = learningEvents.filter(e => new Date(e.ts) >= weekAgo);
        const weeklyMinutes = Math.round(weeklyEvents.reduce((sum, e) => sum + (e.activeMs || 0), 0) / 60000);
        
        // Daily activity for the week
        const dailyActivity = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));
            
            const dayEvents = learningEvents.filter(e => {
                const eventDate = new Date(e.ts);
                return eventDate >= dayStart && eventDate <= dayEnd;
            });
            
            const minutes = Math.round(dayEvents.reduce((sum, e) => sum + (e.activeMs || 0), 0) / 60000);
            dailyActivity.push({
                day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                minutes
            });
        }
        
        // Get recent quiz scores for trend
        const recentQuizScores = quizAttempts.slice(0, 10).map(q => ({
            score: q.score || 0,
            date: q.submittedAt
        }));
        
        // Course progress breakdown
        const courseProgress = await Promise.all(progressDocs.map(async (p) => {
            const course = await Course.findOne({ id: p.courseId });
            return {
                courseName: course?.title || `Course ${p.courseId}`,
                progress: p.progressPercentage || 0,
                status: p.status,
                timeSpent: p.timeSpent || 0
            };
        }));
        
        // Identify strengths and areas for improvement based on quiz performance
        const courseQuizPerformance = {};
        for (const quiz of quizAttempts) {
            if (!courseQuizPerformance[quiz.courseId]) {
                courseQuizPerformance[quiz.courseId] = { scores: [], total: 0 };
            }
            courseQuizPerformance[quiz.courseId].scores.push(quiz.score || 0);
            courseQuizPerformance[quiz.courseId].total++;
        }
        
        const strengths = [];
        const improvements = [];
        for (const [courseId, data] of Object.entries(courseQuizPerformance)) {
            const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            const course = await Course.findOne({ id: courseId });
            const courseName = course?.title || courseId;
            if (avg >= 80) {
                strengths.push({ course: courseName, avgScore: Math.round(avg) });
            } else if (avg < 60) {
                improvements.push({ course: courseName, avgScore: Math.round(avg) });
            }
        }
        
        // Generate AI insights for parents
        let aiInsights = null;
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a caring educational advisor writing a report for parents about their child's sign language learning progress.

Write in a warm, encouraging, and easy-to-understand tone. Focus on:
1. Celebrating achievements and progress
2. Providing specific, actionable recommendations
3. Explaining what the data means in parent-friendly terms
4. Suggesting ways parents can help at home

Return ONLY valid JSON in this format:
{
    "overallSummary": "2-3 sentence summary of the child's progress (warm and encouraging)",
    "achievements": ["Achievement 1", "Achievement 2", "Achievement 3"],
    "strengthsAnalysis": "1-2 sentences about what they're doing well",
    "areasForGrowth": "1-2 sentences about areas to focus on (positive framing)",
    "parentTips": [
        "Specific tip 1 for parents to help at home",
        "Specific tip 2",
        "Specific tip 3"
    ],
    "weeklyGoal": "A specific, achievable goal for next week",
    "encouragement": "A motivational message for both parent and child"
}`
                    },
                    {
                        role: "user",
                        content: `Generate a parent-friendly report for this learner:

Child's Name: ${user.name || 'Learner'}
Age Group: ${user.ageGroup || 'Not specified'}
Account Created: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}

LEARNING STATS:
- Total Courses Started: ${totalCourses}
- Courses Completed: ${completedCourses}
- Overall Progress: ${avgProgress}%
- Total Learning Time: ${totalTimeMinutes} minutes
- This Week's Learning: ${weeklyMinutes} minutes
- Current Streak: ${user.progress?.currentStreak || 0} days

QUIZ PERFORMANCE:
- Quizzes Taken: ${totalQuizzes}
- Average Score: ${avgQuizScore}%
- Pass Rate: ${passRate}%
${recentQuizScores.length > 0 ? `- Recent Scores: ${recentQuizScores.slice(0, 5).map(q => q.score + '%').join(', ')}` : ''}

STRENGTHS:
${strengths.length > 0 ? strengths.map(s => `- ${s.course}: ${s.avgScore}% avg`).join('\n') : '- Still discovering strengths!'}

AREAS FOR GROWTH:
${improvements.length > 0 ? improvements.map(i => `- ${i.course}: ${i.avgScore}% avg`).join('\n') : '- Doing well across all areas!'}`
                    }
                ],
                max_tokens: 800,
                temperature: 0.7
            });
            
            try {
                aiInsights = JSON.parse(completion.choices[0].message.content);
            } catch {
                aiInsights = {
                    overallSummary: completion.choices[0].message.content,
                    achievements: [],
                    parentTips: [],
                    encouragement: "Keep up the great work!"
                };
            }
        } catch (aiError) {
            console.error('[Report] AI insights error:', aiError.message);
            aiInsights = {
                overallSummary: `${user.name || 'Your child'} has been making progress in sign language learning! They've completed ${completedCourses} courses and spent ${totalTimeMinutes} minutes learning.`,
                achievements: [
                    completedCourses > 0 ? `Completed ${completedCourses} course${completedCourses > 1 ? 's' : ''}!` : 'Started their learning journey!',
                    totalQuizzes > 0 ? `Took ${totalQuizzes} quiz${totalQuizzes > 1 ? 'zes' : ''}!` : 'Exploring the courses!',
                    weeklyMinutes > 0 ? `Active learner this week!` : 'Ready to learn more!'
                ],
                strengthsAnalysis: "Your child is building a foundation in sign language.",
                areasForGrowth: "Consistent daily practice will help reinforce learning.",
                parentTips: [
                    "Practice signs together during daily routines",
                    "Use signs for common words like 'please', 'thank you', 'hello'",
                    "Celebrate small wins to keep motivation high"
                ],
                weeklyGoal: "Complete one lesson and practice 5 new signs",
                encouragement: "Every sign learned is a step towards better communication! 🌟"
            };
        }
        
        // Compile full report
        const report = {
            generatedAt: new Date().toISOString(),
            student: {
                name: user.name || 'Learner',
                ageGroup: user.ageGroup || 'Not specified',
                memberSince: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
                currentStreak: user.progress?.currentStreak || 0
            },
            statistics: {
                totalCourses,
                completedCourses,
                avgProgress,
                totalTimeMinutes,
                weeklyMinutes,
                totalQuizzes,
                avgQuizScore,
                passRate
            },
            weeklyActivity: dailyActivity,
            quizTrend: recentQuizScores,
            courseProgress,
            strengths,
            improvements,
            aiInsights
        };
        
        console.log('[Report] Report generated successfully');
        
        res.json({
            success: true,
            report
        });
        
    } catch (error) {
        console.error("Report generation error:", error);
        res.status(500).json({ 
            error: "Failed to generate report", 
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });