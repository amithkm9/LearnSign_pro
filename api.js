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

        const [user, progressDocs, weeklyMsAgg, weeklySessionsAgg, quizAgg, quizPassAgg, totalDaysAgg, weeklyActivityAgg] = await Promise.all([
            User.findById(userId).select('progress name'),
            UserProgress.find({ userId }).select('courseId status progressPercentage timeSpent completedAt updatedAt'),
            LearningEvent.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), ts: { $gte: since } } },
                { $group: { _id: null, totalMs: { $sum: "$activeMs" } } }
            ]),
            // Count weekly sessions for avg session calculation
            LearningEvent.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), ts: { $gte: since }, type: 'start' } },
                { $group: { _id: null, count: { $sum: 1 } } }
            ]),
            QuizAttempt.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                { $group: { _id: null, attempts: { $sum: 1 }, avgScore: { $avg: "$score" } } }
            ]),
            QuizAttempt.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), passed: true } },
                { $group: { _id: null, passed: { $sum: 1 } } }
            ]),
            // Count total unique active days
            LearningEvent.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } } } },
                { $count: "totalDays" }
            ]),
            // Weekly activity breakdown by day
            LearningEvent.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), ts: { $gte: since } } },
                { $group: { 
                    _id: { $dayOfWeek: "$ts" }, 
                    totalMs: { $sum: "$activeMs" } 
                }},
                { $sort: { _id: 1 } }
            ])
        ]);

        const weeklyMs = weeklyMsAgg[0]?.totalMs || 0;
        const weeklySessions = weeklySessionsAgg[0]?.count || 1;
        const totalCompleted = progressDocs.filter(p => p.status === 'completed').length;
        const totalStarted = progressDocs.length;
        const completionPct = totalStarted ? Math.round((totalCompleted / totalStarted) * 100) : 0;
        const quizAttempts = quizAgg[0]?.attempts || 0;
        const avgQuiz = Math.round(quizAgg[0]?.avgScore || 0);
        const quizPassed = quizPassAgg[0]?.passed || 0;
        const quizPassRate = quizAttempts ? Math.round((quizPassed / quizAttempts) * 100) : 0;
        const currentStreak = user?.progress?.currentStreak || 0;
        const longestStreak = user?.progress?.longestStreak || 0;
        const totalDaysActive = totalDaysAgg[0]?.totalDays || 0;
        const totalLearningTime = user?.progress?.totalLearningTime || 0;
        const achievements = user?.progress?.achievements || [];
        
        // Calculate average session time
        const avgSessionMinutes = weeklySessions > 0 ? Math.round((weeklyMs / 60000) / weeklySessions) : 0;
        
        // Calculate estimated signs learned (based on completed courses * avg signs per course)
        const signsPerCourse = 15; // estimate
        const estimatedSignsLearned = totalCompleted * signsPerCourse;
        
        // Build weekly activity array [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
        // MongoDB dayOfWeek: 1=Sunday, 2=Monday, ..., 7=Saturday
        const weeklyActivity = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
        weeklyActivityAgg.forEach(day => {
            // Convert MongoDB dayOfWeek (1=Sun) to our format (0=Mon)
            const dayIndex = day._id === 1 ? 6 : day._id - 2; // Sun=6, Mon=0, Tue=1, etc.
            if (dayIndex >= 0 && dayIndex < 7) {
                weeklyActivity[dayIndex] = Math.round(day.totalMs / 60000);
            }
        });
        
        // Calculate days practiced this week
        const daysPracticedThisWeek = weeklyActivity.filter(m => m > 0).length;

        res.json({
            weeklyMinutes: Math.round(weeklyMs / 60000),
            completionPct,
            totalCompleted,
            avgQuiz,
            quizAttempts,
            quizPassRate,
            currentStreak,
            longestStreak,
            totalDaysActive,
            totalLearningTime,
            achievementsCount: achievements.length,
            avgSessionMinutes,
            estimatedSignsLearned,
            weeklyActivity,
            daysPracticedThisWeek,
            coursesInProgress: progressDocs.filter(p => p.status === 'in_progress').length,
            userName: user?.name || 'Learner'
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
// FULL MULTILINGUAL SUPPORT with AUTO-DETECTION (Hindi, Kannada, Telugu)
app.post("/tutor/chat", async (req, res) => {
    try {
        const { userId, message, conversationHistory = [], language = 'en' } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ 
                error: "userId and message are required" 
            });
        }

        const originalMessage = message.trim();
        
        // Use dropdown selection as primary, auto-detect as fallback
        const detectedLanguage = detectLanguage(originalMessage);
        // Prefer user's dropdown selection, fallback to auto-detection
        const validLanguage = SUPPORTED_LANGUAGES[language] ? language : 
                              (SUPPORTED_LANGUAGES[detectedLanguage] ? detectedLanguage : 'en');
        
        console.log(`[Chat] Dropdown: ${language}, Auto-detected: ${detectedLanguage}, Using: ${validLanguage}`);
        console.log(`[Chat] Message: "${originalMessage}"`);
        
        // Translate regional language input to English sign names
        // Use detected language for translation (not dropdown) to handle input correctly
        const translationLang = detectedLanguage !== 'en' ? detectedLanguage : validLanguage;
        const translatedMessage = translateSentenceToEnglishSigns(originalMessage, translationLang);
        const cleanMessage = translatedMessage.toUpperCase();
        
        console.log(`[Chat] Translation lang: ${translationLang}, Translated: "${cleanMessage}"`);
        
        // Check if it's a sign/word request
        // For regional languages: if translation produced valid sign words, treat as sign request
        const translationSuccessful = cleanMessage !== originalMessage.toUpperCase() && cleanMessage.length > 0;
        const isShortMessage = cleanMessage.split(/\s+/).length <= 6;
        
        const isSignRequest = isShortMessage || translationSuccessful ||
            /how (do i |to |can i )?sign|show me|teach me|what('s| is) the sign/i.test(originalMessage) ||
            // Hindi patterns - greeting and question words
            /का साइन|साइन दिखाओ|कैसे करें|सिखाओ|कैसे हो|क्या हाल|नमस्ते|धन्यवाद/i.test(originalMessage) ||
            // Kannada patterns - greeting and question words
            /ಸೈನ್|ತೋರಿಸಿ|ಕಲಿಸಿ|ಹೇಗೆ|ಹೇಗಿದ್ದೀ|ನಮಸ್ಕಾರ|ಧನ್ಯವಾದ|ಚೆನ್ನಾಗಿ|ಏನು|ಯಾರು/i.test(originalMessage) ||
            // Telugu patterns - greeting and question words  
            /సైన్|చూపించు|నేర్పించు|ఎలా|నమస్కారం|ధన్యవాదాలు|బాగున్నారా|ఏమిటి/i.test(originalMessage);
        
        console.log(`[Chat] isSignRequest: ${isSignRequest}, translationSuccessful: ${translationSuccessful}, isShortMessage: ${isShortMessage}`);
        
        // Split translated message into words and find videos for each
        const words = cleanMessage.split(/\s+/).filter(w => w.length > 0);
        const videoSequence = [];
        const notFoundWords = [];
        
        for (const word of words) {
            const cleanWord = word.replace(/[^A-Z0-9_]/g, '');
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
        
        // If we found videos, return them with language-appropriate response
        if (videoSequence.length > 0 && isSignRequest) {
            const isSentence = videoSequence.length > 1;
            const foundWords = videoSequence.map(v => v.word).join(' ');
            
            // Language-specific responses
            const responseMessages = {
                'en': isSentence 
                    ? `Here's how to sign "${foundWords}" 👇`
                    : `Here's how to sign "${foundWords}" 👇`,
                'hi': isSentence
                    ? `यहाँ "${foundWords}" का साइन है 👇`
                    : `यहाँ "${foundWords}" का साइन है 👇`,
                'kn': isSentence
                    ? `ಇಲ್ಲಿ "${foundWords}" ಸೈನ್ ಇದೆ 👇`
                    : `ಇಲ್ಲಿ "${foundWords}" ಸೈನ್ ಇದೆ 👇`,
                'te': isSentence
                    ? `ఇక్కడ "${foundWords}" సైన్ ఉంది 👇`
                    : `ఇక్కడ "${foundWords}" సైన్ ఉంది 👇`
            };
            
            const warningMessages = {
                'en': `Note: No video for: ${notFoundWords.join(', ')}`,
                'hi': `नोट: इनके लिए वीडियो नहीं है: ${notFoundWords.join(', ')}`,
                'kn': `ಗಮನಿಸಿ: ಇವುಗಳಿಗೆ ವೀಡಿಯೋ ಇಲ್ಲ: ${notFoundWords.join(', ')}`,
                'te': `గమనిక: వీటికి వీడియో లేదు: ${notFoundWords.join(', ')}`
            };
            
            const response = {
                type: "sign_sequence",
                isSentence: isSentence,
                sentence: foundWords,
                originalQuery: originalMessage,
                response: responseMessages[validLanguage] || responseMessages['en'],
                videoSequence: videoSequence.map(v => ({
                    word: v.word,
                    path: v.video.path
                })),
                notFoundWords: notFoundWords,
                totalVideos: videoSequence.length,
                language: validLanguage
            };
            
            // Add warning if some words weren't found
            if (notFoundWords.length > 0) {
                response.warning = warningMessages[validLanguage] || warningMessages['en'];
            }
            
            return res.json({
                success: true,
                response: response,
                userProfile: { name: 'Learner', streak: 0, progress: 0 },
                language: validLanguage
            });
        }
        
        // For general questions or no videos found, use OpenAI with language instruction
        try {
            const userProfile = await getUserTutorProfile(userId);
            let systemPrompt = userProfile ? populateSystemPrompt(userProfile) : AI_TUTOR_SYSTEM_PROMPT;
            
            // Add language-specific instruction
            const languageInstruction = LANGUAGE_INSTRUCTIONS[validLanguage] || LANGUAGE_INSTRUCTIONS['en'];
            systemPrompt += `\n\n🌐 IMPORTANT LANGUAGE INSTRUCTION: ${languageInstruction}`;
            
            // Add instruction to include sign-able words
            systemPrompt += `\n\nWhen responding, try to naturally include these common words that have sign videos available: GOOD, FINE, HAPPY, THANK, HELLO, YES, NO, HELP, PLEASE, LOVE, LEARN, FRIEND, FAMILY, MOTHER, FATHER, SCHOOL, HOME, EAT, DRINK, UNDERSTAND, MORNING, EVENING, TODAY.`;
            
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
            
            // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
            let cleanedResponse = aiResponse.trim();
            if (cleanedResponse.startsWith('```')) {
                // Remove opening ``` (with optional language tag like ```json)
                cleanedResponse = cleanedResponse.replace(/^```[a-z]*\n?/i, '');
                // Remove closing ```
                cleanedResponse = cleanedResponse.replace(/\n?```$/i, '');
                cleanedResponse = cleanedResponse.trim();
            }
            
            // Try to parse as JSON, otherwise wrap in general_help format
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(cleanedResponse);
            } catch {
                parsedResponse = {
                    type: "general_help",
                    response: cleanedResponse,
                    availableSigns: findSimilarSigns(words[0] || 'hello').slice(0, 8)
                };
            }
            
            // Add language info to response
            parsedResponse.language = validLanguage;
            
            // ENABLED: Smart sign extraction for non-English responses
            // Translate regional language response to English and find matching sign videos
            if (validLanguage !== 'en') {
                try {
                    const responseText = parsedResponse.response || cleanedResponse;
                    const extractedSigns = await translateAndExtractSignsFromResponse(
                        responseText, 
                        validLanguage, 
                        originalMessage
                    );
                    
                    if (extractedSigns && extractedSigns.length > 0) {
                        parsedResponse.hasResponseSigns = true;
                        parsedResponse.responseSigns = extractedSigns;
                        console.log(`[Chat] Found ${extractedSigns.length} signs from ${validLanguage} response`);
                    }
                } catch (extractError) {
                    console.error('[Chat] Sign extraction error:', extractError.message);
                }
            }
            
            console.log(`[Chat] AI response ready (language: ${validLanguage})`);
            
            return res.json({
                success: true,
                response: parsedResponse,
                userProfile: userProfile || { name: 'Learner', streak: 0, progress: 0 },
                language: validLanguage,
                detectedLanguage: validLanguage
            });
            
        } catch (aiError) {
            console.error("OpenAI error:", aiError.message);
            
            // Fallback to suggestions if OpenAI fails - with language-appropriate message
            const suggestions = words.length > 0 ? findSimilarSigns(words[0]) : [];
            const availableSigns = getAllAvailableSigns();
            const randomSigns = availableSigns.sort(() => 0.5 - Math.random()).slice(0, 8);
            
            const fallbackMessages = {
                'en': `I couldn't find videos for "${message}". Try one of these signs instead!`,
                'hi': `"${message}" के लिए वीडियो नहीं मिला। इनमें से कोई साइन आज़माएं!`,
                'kn': `"${message}" ಗೆ ವೀಡಿಯೋ ಸಿಗಲಿಲ್ಲ. ಈ ಸೈನ್‌ಗಳನ್ನು ಪ್ರಯತ್ನಿಸಿ!`,
                'te': `"${message}" కోసం వీడియో దొరకలేదు. ఈ సైన్‌లను ప్రయత్నించండి!`
            };
            
            return res.json({
                success: true,
                response: {
                    type: "not_found",
                    sign: cleanMessage,
                    response: fallbackMessages[validLanguage] || fallbackMessages['en'],
                    suggestions: suggestions.length > 0 ? suggestions : randomSigns,
                    totalAvailable: availableSigns.length,
                    language: validLanguage
                },
                userProfile: { name: 'Learner', streak: 0, progress: 0 },
                language: validLanguage,
                detectedLanguage: validLanguage
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

// ========== MULTILINGUAL SIGN TRANSLATION MAPPINGS ==========
// Maps regional language words to English sign names
const SIGN_TRANSLATIONS = {
    // Hindi translations
    'hi': {
        // Greetings
        'नमस्ते': 'HELLO', 'नमस्कार': 'HELLO', 'हाय': 'HI', 'हैलो': 'HELLO',
        'अलविदा': 'BYE', 'बाय': 'BYE', 'धन्यवाद': 'GRATEFUL', 'शुक्रिया': 'GRATEFUL',
        'स्वागत': 'WELCOME', 'कृपया': 'PLEASE',
        
        // Family
        'माँ': 'MOTHER', 'मां': 'MOTHER', 'मम्मी': 'MOTHER', 'माता': 'MOTHER',
        'पापा': 'FATHER', 'पिता': 'FATHER', 'बाबा': 'FATHER',
        'भाई': 'BROTHER', 'बहन': 'SISTER', 'दीदी': 'SISTER',
        'बेटा': 'SON', 'बेटी': 'DAUGHTER', 'बच्चा': 'CHILD', 'बच्ची': 'CHILD', 'शिशु': 'BABY',
        'लड़का': 'BOY', 'लड़की': 'GIRL', 'दोस्त': 'FRIEND',
        'पुरुष': 'MALE', 'महिला': 'FEMALE', 'आदमी': 'MEN', 'औरत': 'WOMEN',
        
        // Emotions
        'खुश': 'HAPPY', 'खुशी': 'HAPPY', 'दुखी': 'SAD', 'उदास': 'SAD',
        'गुस्सा': 'ANGRY', 'नाराज': 'ANGRY', 'थका': 'TIRED', 'थकान': 'TIRED',
        'उत्साहित': 'EXCITED', 'चिंतित': 'WORRIED', 'परेशान': 'WORRIED',
        'आश्चर्य': 'SURPRISED', 'हैरान': 'SURPRISED', 'निराश': 'DISAPPOINTED',
        'शांत': 'CALM', 'आराम': 'RELAXED', 'बहादुर': 'BRAVE', 'गर्व': 'PROUD',
        'उबाऊ': 'BORING', 'मजेदार': 'FUNNY', 'अजीब': 'WEIRD', 'पागल': 'CRAZY',
        'घबराया': 'NERVOUS', 'उत्सुक': 'CURIOUS', 'भ्रमित': 'CONFUSED',
        'आभारी': 'GRATEFUL', 'संतुष्ट': 'SATISFIED', 'भाग्यशाली': 'LUCKY',
        
        // Common words
        'हाँ': 'YES', 'हां': 'YES', 'नहीं': 'NO', 'ठीक': 'OKAY', 'अच्छा': 'GOOD',
        'बुरा': 'BAD', 'बड़ा': 'BIG', 'छोटा': 'SMALL', 'लंबा': 'TALL', 'नया': 'NEW', 'पुराना': 'OLD',
        'गर्म': 'HOT', 'ठंडा': 'COLD', 'तेज': 'FAST', 'धीमा': 'SLOW',
        'आसान': 'EASY', 'कठिन': 'HARD', 'ऊंचा': 'HIGH', 'नीचा': 'LOW_0A',
        'सूखा': 'DRY', 'गीला': 'WET', 'साफ': 'CLEAN', 'छोटा': 'SHORT',
        
        // Actions
        'खाना': 'EAT', 'खाओ': 'EAT', 'पीना': 'DRINK', 'पीओ': 'DRINK',
        'सोना': 'SLEEP', 'सो': 'SLEEP', 'देखना': 'SEE', 'देखो': 'LOOK',
        'सुनना': 'LISTEN', 'सुनो': 'LISTEN', 'पढ़ना': 'READ', 'पढ़ो': 'READ',
        'लिखना': 'WRITE', 'लिखो': 'WRITE', 'बोलना': 'VOICE', 'बैठना': 'SIT', 'बैठो': 'SIT',
        'खड़े': 'STAND', 'चलना': 'Walk', 'चलो': 'Walk', 'दौड़ना': 'RUN', 'दौड़ो': 'RUN',
        'कूदना': 'JUMP', 'कूदो': 'JUMP', 'खेलना': 'PLAY_0A', 'खेलो': 'PLAY_0A',
        'मदद': 'HELP', 'मदद करो': 'HELP', 'रुको': 'STOP', 'रुकना': 'STOP', 'इंतजार': 'WAIT',
        'आना': 'ARRIVE', 'आओ': 'ARRIVE', 'जाना': 'LEAVE', 'जाओ': 'LEAVE',
        'देना': 'GIVE_0A', 'दो': 'GIVE_0A', 'लेना': 'TAKE', 'लो': 'TAKE',
        'खोलना': 'OPEN', 'खोलो': 'OPEN', 'बंद': 'CLOSE', 'धोना': 'WASH',
        'पकाना': 'COOK', 'खरीदना': 'BUY', 'बेचना': 'SELL', 'मिलना': 'MEET',
        'याद': 'REMEMBER', 'भूलना': 'FORGET', 'समझना': 'UNDERSTAND', 'समझो': 'UNDERSTAND',
        'पूछना': 'ASK', 'पूछो': 'ASK', 'जवाब': 'ANSWER', 'बताना': 'EXPLAIN',
        'शुरू': 'START', 'कोशिश': 'TRY', 'सोचना': 'THOUGHT', 'फैसला': 'DECIDE',
        
        // Places
        'घर': 'HOME', 'स्कूल': 'SCHOOL', 'दफ्तर': 'OFFICE', 'बाजार': 'MARKET',
        'शहर': 'CITY', 'पार्क': 'PARK', 'किचन': 'KITCHEN', 'बाथरूम': 'BATHROOM',
        'कमरा': 'BEDROOM', 'सड़क': 'STREET',
        
        // Objects
        'पानी': 'WATER', 'खाना': 'FOOD', 'रोटी': 'BREAD', 'फल': 'FRUIT',
        'किताब': 'BOOK', 'कागज': 'PAPER', 'कुर्सी': 'CHAIR', 'मेज': 'TABLE',
        'दरवाजा': 'DOOR', 'खिड़की': 'WINDOW', 'दीवार': 'WALL', 'छत': 'ROOF', 'फर्श': 'FLOOR',
        'घड़ी': 'CLOCK', 'फोन': 'PHONE', 'मोबाइल': 'MOBILE', 'कंप्यूटर': 'COMPUTER',
        'चाबी': 'KEY', 'प्लेट': 'PLATE', 'गिलास': 'GLASS', 'चम्मच': 'SPOON',
        'कपड़े': 'SHIRT', 'पैंट': 'PANTS', 'जूते': 'SHOES',
        'पैसा': 'MONEY', 'कीमत': 'PRICE',
        
        // Animals
        'कुत्ता': 'DOG', 'बिल्ली': 'CAT', 'पक्षी': 'BIRD', 'मछली': 'FISH', 'घोड़ा': 'HORSE',
        
        // Nature
        'सूरज': 'SUN', 'चांद': 'MOON', 'बादल': 'CLOUD', 'बारिश': 'RAIN', 'फूल': 'FLOWER',
        
        // Time
        'समय': 'TIME', 'दिन': 'DAY', 'रात': 'NIGHT', 'सुबह': 'MORNING',
        'दोपहर': 'AFTERNOON', 'शाम': 'EVENING', 'घंटा': 'HOUR', 'मिनट': 'MINUTE_0A',
        'आज': 'TODAY', 'कल': 'TOMORROW', 'बीता कल': 'YESTERDAY', 'साल': 'YEAR',
        'जल्दी': 'EARLY', 'देर': 'LATE', 'पहले': 'BEFORE', 'बाद': 'AFTER',
        'कभी नहीं': 'NEVER', 'हमेशा': 'ALWAYS', 'कभी-कभी': 'SOMETIMES',
        
        // Questions
        'क्या': 'WHAT', 'कौन': 'WHO', 'कब': 'WHEN', 'कहाँ': 'WHERE', 'कैसे': 'HOW', 'क्यों': 'WHY',
        
        // People
        'डॉक्टर': 'DOCTOR', 'बच्चे': 'CHILD',
        
        // Numbers (already in English but adding Hindi)
        'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4',
        'पांच': '5', 'छह': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
        
        // Common phrases recognition
        'कैसे हो': 'HOW', 'क्या हाल': 'HOW', 'सब ठीक': 'OKAY',
        'मैं ठीक हूं': 'GOOD', 'मैं अच्छा हूं': 'GOOD', 'बहुत अच्छा': 'GOOD',
        'मैं': 'I', 'तुम': 'YOU', 'आप': 'YOU', 'वह': 'WHO',
        'प्यार': 'LOVE', 'पसंद': 'LIKE', 'चाहिए': 'WANT'
    },
    
    // Kannada translations
    'kn': {
        // Greetings
        'ನಮಸ್ಕಾರ': 'HELLO', 'ಹಲೋ': 'HELLO', 'ಹಾಯ್': 'HI',
        'ಬೈ': 'BYE', 'ವಿದಾಯ': 'BYE', 'ಧನ್ಯವಾದ': 'GRATEFUL', 'ಧನ್ಯವಾದಗಳು': 'GRATEFUL',
        'ಸ್ವಾಗತ': 'WELCOME', 'ದಯವಿಟ್ಟು': 'PLEASE',
        
        // Family
        'ಅಮ್ಮ': 'MOTHER', 'ತಾಯಿ': 'MOTHER', 'ಅಪ್ಪ': 'FATHER', 'ತಂದೆ': 'FATHER',
        'ಅಣ್ಣ': 'BROTHER', 'ತಮ್ಮ': 'BROTHER', 'ಅಕ್ಕ': 'SISTER', 'ತಂಗಿ': 'SISTER',
        'ಮಗ': 'SON', 'ಮಗಳು': 'DAUGHTER', 'ಮಗು': 'CHILD', 'ಶಿಶು': 'BABY',
        'ಹುಡುಗ': 'BOY', 'ಹುಡುಗಿ': 'GIRL', 'ಸ್ನೇಹಿತ': 'FRIEND', 'ಗೆಳೆಯ': 'FRIEND',
        'ಪುರುಷ': 'MALE', 'ಮಹಿಳೆ': 'FEMALE',
        
        // Emotions
        'ಸಂತೋಷ': 'HAPPY', 'ಖುಷಿ': 'HAPPY', 'ದುಃಖ': 'SAD', 'ಬೇಸರ': 'SAD',
        'ಕೋಪ': 'ANGRY', 'ಸಿಟ್ಟು': 'ANGRY', 'ಆಯಾಸ': 'TIRED', 'ದಣಿವು': 'TIRED',
        'ಉತ್ಸಾಹ': 'EXCITED', 'ಚಿಂತೆ': 'WORRIED', 'ಆಶ್ಚರ್ಯ': 'SURPRISED',
        'ನಿರಾಶೆ': 'DISAPPOINTED', 'ಶಾಂತ': 'CALM', 'ಧೈರ್ಯ': 'BRAVE',
        'ಹೆಮ್ಮೆ': 'PROUD', 'ಬೋರ್': 'BORING', 'ತಮಾಷೆ': 'FUNNY',
        
        // Common words
        'ಹೌದು': 'YES', 'ಇಲ್ಲ': 'NO', 'ಸರಿ': 'OKAY', 'ಒಳ್ಳೆಯ': 'GOOD', 'ಚೆನ್ನಾಗಿ': 'GOOD',
        'ಕೆಟ್ಟ': 'BAD', 'ದೊಡ್ಡ': 'BIG', 'ಚಿಕ್ಕ': 'SMALL', 'ಎತ್ತರ': 'TALL',
        'ಹೊಸ': 'NEW', 'ಹಳೆಯ': 'OLD', 'ಬಿಸಿ': 'HOT', 'ತಂಪು': 'COLD',
        'ವೇಗ': 'FAST', 'ನಿಧಾನ': 'SLOW', 'ಸುಲಭ': 'EASY', 'ಕಷ್ಟ': 'HARD',
        
        // Actions
        'ತಿನ್ನು': 'EAT', 'ಊಟ': 'EAT', 'ಕುಡಿ': 'DRINK', 'ನಿದ್ರೆ': 'SLEEP', 'ಮಲಗು': 'SLEEP',
        'ನೋಡು': 'SEE', 'ಕೇಳು': 'LISTEN', 'ಓದು': 'READ', 'ಬರೆ': 'WRITE',
        'ಕೂರು': 'SIT', 'ನಿಲ್ಲು': 'STAND', 'ನಡೆ': 'Walk', 'ಓಡು': 'RUN', 'ಜಿಗಿ': 'JUMP',
        'ಆಟ': 'PLAY_0A', 'ಸಹಾಯ': 'HELP', 'ನಿಲ್ಲಿಸು': 'STOP', 'ಕಾಯಿ': 'WAIT',
        'ಬಾ': 'ARRIVE', 'ಹೋಗು': 'LEAVE', 'ಕೊಡು': 'GIVE_0A', 'ತೆಗೆ': 'TAKE',
        'ತೆರೆ': 'OPEN', 'ಮುಚ್ಚು': 'CLOSE', 'ತೊಳೆ': 'WASH', 'ಅಡುಗೆ': 'COOK',
        'ನೆನಪು': 'REMEMBER', 'ಮರೆತು': 'FORGET', 'ಅರ್ಥ': 'UNDERSTAND',
        'ಕೇಳು': 'ASK', 'ಉತ್ತರ': 'ANSWER', 'ಪ್ರಾರಂಭ': 'START', 'ಪ್ರಯತ್ನ': 'TRY',
        
        // Places
        'ಮನೆ': 'HOME', 'ಶಾಲೆ': 'SCHOOL', 'ಕಚೇರಿ': 'OFFICE', 'ಮಾರುಕಟ್ಟೆ': 'MARKET',
        'ನಗರ': 'CITY', 'ಉದ್ಯಾನ': 'PARK', 'ಅಡುಗೆಮನೆ': 'KITCHEN', 'ಸ್ನಾನಗೃಹ': 'BATHROOM',
        
        // Objects
        'ನೀರು': 'WATER', 'ಆಹಾರ': 'FOOD', 'ರೊಟ್ಟಿ': 'BREAD', 'ಹಣ್ಣು': 'FRUIT',
        'ಪುಸ್ತಕ': 'BOOK', 'ಕಾಗದ': 'PAPER', 'ಕುರ್ಚಿ': 'CHAIR', 'ಮೇಜು': 'TABLE',
        'ಬಾಗಿಲು': 'DOOR', 'ಕಿಟಕಿ': 'WINDOW', 'ಗೋಡೆ': 'WALL',
        'ಗಡಿಯಾರ': 'CLOCK', 'ಫೋನ್': 'PHONE', 'ಮೊಬೈಲ್': 'MOBILE',
        'ಹಣ': 'MONEY', 'ಬೆಲೆ': 'PRICE',
        
        // Animals
        'ನಾಯಿ': 'DOG', 'ಬೆಕ್ಕು': 'CAT', 'ಹಕ್ಕಿ': 'BIRD', 'ಮೀನು': 'FISH', 'ಕುದುರೆ': 'HORSE',
        
        // Nature
        'ಸೂರ್ಯ': 'SUN', 'ಚಂದ್ರ': 'MOON', 'ಮೋಡ': 'CLOUD', 'ಮಳೆ': 'RAIN', 'ಹೂವು': 'FLOWER',
        
        // Time
        'ಸಮಯ': 'TIME', 'ದಿನ': 'DAY', 'ರಾತ್ರಿ': 'NIGHT', 'ಬೆಳಿಗ್ಗೆ': 'MORNING',
        'ಮಧ್ಯಾಹ್ನ': 'AFTERNOON', 'ಸಂಜೆ': 'EVENING', 'ಇಂದು': 'TODAY',
        'ನಾಳೆ': 'TOMORROW', 'ನಿನ್ನೆ': 'YESTERDAY', 'ವರ್ಷ': 'YEAR',
        'ಯಾವಾಗಲೂ': 'ALWAYS', 'ಎಂದಿಗೂ': 'NEVER', 'ಕೆಲವೊಮ್ಮೆ': 'SOMETIMES',
        
        // Questions
        'ಏನು': 'WHAT', 'ಯಾರು': 'WHO', 'ಯಾವಾಗ': 'WHEN', 'ಎಲ್ಲಿ': 'WHERE', 'ಹೇಗೆ': 'HOW', 'ಏಕೆ': 'WHY',
        
        // Numbers
        'ಸೊನ್ನೆ': '0', 'ಒಂದು': '1', 'ಎರಡು': '2', 'ಮೂರು': '3', 'ನಾಲ್ಕು': '4',
        'ಐದು': '5', 'ಆರು': '6', 'ಏಳು': '7', 'ಎಂಟು': '8', 'ಒಂಬತ್ತು': '9',
        
        // Common phrases - "How are you" variations (ALL possible spellings)
        'ಹೇಗಿದ್ದೀರಾ': 'HOW ARE YOU', 'ಹೇಗಿದ್ದೀಯಾ': 'HOW ARE YOU', 
        'ಹೇಗಿದಿರಾ': 'HOW ARE YOU', 'ಹೇಗಿದಿರ': 'HOW ARE YOU',
        'ಹೇಗಿದೀರಾ': 'HOW ARE YOU', 'ಹೇಗಿದೀರ': 'HOW ARE YOU',
        'ಹೇಗಿದ್ರಾ': 'HOW ARE YOU', 'ಹೇಗಿದ್ರ': 'HOW ARE YOU',
        'ನೀವು ಹೇಗಿದ್ದೀರಾ': 'HOW ARE YOU', 'ನೀ ಹೇಗಿದ್ದೀಯಾ': 'HOW ARE YOU',
        'ಹೇಗಿದ್ದೀರಿ': 'HOW ARE YOU', 'ಹೇಗಿದೆ': 'HOW ARE YOU',
        'ಏನು ಸಮಾಚಾರ': 'HOW ARE YOU', 'ಕುಶಲವೇ': 'HOW ARE YOU',
        'ಹೇಗಿದ್ದೀಯ': 'HOW ARE YOU', 'ಹೇಗಿದಿಯ': 'HOW ARE YOU',
        
        // Response phrases
        'ಚೆನ್ನಾಗಿದ್ದೇನೆ': 'GOOD', 'ಚೆನ್ನಾಗಿದೆ': 'GOOD', 'ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ': 'I GOOD',
        'ಒಳ್ಳೆಯದಾಗಿದೆ': 'GOOD', 'ಸಂತೋಷವಾಗಿದ್ದೇನೆ': 'HAPPY',
        
        // Pronouns and common words
        'ನಾನು': 'I', 'ನೀನು': 'YOU', 'ನೀವು': 'YOU', 'ಅವನು': 'HE', 'ಅವಳು': 'SHE',
        'ಅವರು': 'THEY', 'ನಾವು': 'WE', 'ಇದು': 'THIS', 'ಅದು': 'THAT',
        
        // More common questions
        'ನಿಮ್ಮ ಹೆಸರೇನು': 'WHAT YOUR NAME', 'ನಿನ್ನ ಹೆಸರೇನು': 'WHAT YOUR NAME',
        'ಹೆಸರು': 'NAME', 'ಹೆಸರೇನು': 'WHAT NAME',
        
        // Learning related
        'ಕಲಿಯಿರಿ': 'LEARN', 'ಕಲಿಸಿ': 'TEACH', 'ತೋರಿಸಿ': 'SHOW',
        'ಸೈನ್': 'SIGN', 'ಸೈನ್ ಭಾಷೆ': 'SIGN LANGUAGE',
        
        // Greetings and daily - multiple spelling variations
        'ಶುಭೋದಯ': 'GOOD MORNING', 'ಶುಭೋದಾಯ': 'GOOD MORNING', 'ಶುಭೋದಾಯಾ': 'GOOD MORNING',
        'ಶುಭೋಧಯ': 'GOOD MORNING', 'ಶುಭೋಧಾಯ': 'GOOD MORNING',
        'ಶುಭ ಬೆಳಿಗ್ಗೆ': 'GOOD MORNING', 'ಶುಭ ಮುಂಜಾನೆ': 'GOOD MORNING',
        'ಶುಭ ಮಧ್ಯಾಹ್ನ': 'GOOD AFTERNOON', 
        'ಶುಭ ಸಂಜೆ': 'GOOD EVENING', 'ಶುಭಸಂಜೆ': 'GOOD EVENING',
        'ಶುಭ ರಾತ್ರಿ': 'GOOD NIGHT', 'ಶುಭರಾತ್ರಿ': 'GOOD NIGHT',
        'ಒಳ್ಳೆಯ ದಿನ': 'GOOD DAY', 'ಒಳ್ಳೆ ದಿನ': 'GOOD DAY',
        
        // TRANSLITERATED Kannada (English letters) - for users typing in English
        'shubodaya': 'GOOD MORNING', 'shubhodaya': 'GOOD MORNING', 'subhodaya': 'GOOD MORNING',
        'namaskara': 'HELLO', 'namaskaara': 'HELLO', 'namaste': 'HELLO',
        'dhanyavada': 'GRATEFUL', 'dhanyavaada': 'GRATEFUL', 'thanks': 'GRATEFUL',
        'hegiddira': 'HOW ARE YOU', 'hegidira': 'HOW ARE YOU', 'hegiddiya': 'HOW ARE YOU',
        'chennagiddene': 'GOOD', 'chennagide': 'GOOD', 'olleya': 'GOOD',
        'amma': 'MOTHER', 'appa': 'FATHER', 'anna': 'BROTHER', 'akka': 'SISTER',
        'tangi': 'SISTER', 'tamma': 'BROTHER', 'maga': 'SON', 'magalu': 'DAUGHTER',
        'sneha': 'FRIEND', 'snehita': 'FRIEND', 'geleya': 'FRIEND',
        'mane': 'HOME', 'shale': 'SCHOOL', 'neeru': 'WATER', 'oota': 'EAT', 'aahara': 'FOOD',
        'santhosha': 'HAPPY', 'santosha': 'HAPPY', 'dukkha': 'SAD', 'koppa': 'ANGRY',
        'houdu': 'YES', 'illa': 'NO', 'sari': 'OKAY', 'dayavittu': 'PLEASE',
        'shubha ratri': 'GOOD NIGHT', 'shubha sanje': 'GOOD EVENING',
        'naanu': 'I', 'neevu': 'YOU', 'neenu': 'YOU', 'avaru': 'THEY',
        'yenu': 'WHAT', 'yaaru': 'WHO', 'yelli': 'WHERE', 'yaavaga': 'WHEN', 'hege': 'HOW', 'yeke': 'WHY'
    },
    
    // Telugu translations
    'te': {
        // Greetings
        'నమస్కారం': 'HELLO', 'హలో': 'HELLO', 'హాయ్': 'HI',
        'బై': 'BYE', 'వీడ్కోలు': 'BYE', 'ధన్యవాదాలు': 'GRATEFUL', 'థాంక్స్': 'GRATEFUL',
        'స్వాగతం': 'WELCOME', 'దయచేసి': 'PLEASE',
        
        // Family
        'అమ్మ': 'MOTHER', 'తల్లి': 'MOTHER', 'నాన్న': 'FATHER', 'తండ్రి': 'FATHER',
        'అన్న': 'BROTHER', 'తమ్ముడు': 'BROTHER', 'అక్క': 'SISTER', 'చెల్లి': 'SISTER',
        'కొడుకు': 'SON', 'కూతురు': 'DAUGHTER', 'పిల్ల': 'CHILD', 'బిడ్డ': 'BABY', 'శిశువు': 'BABY',
        'అబ్బాయి': 'BOY', 'అమ్మాయి': 'GIRL', 'స్నేహితుడు': 'FRIEND', 'మిత్రుడు': 'FRIEND',
        'పురుషుడు': 'MALE', 'స్త్రీ': 'FEMALE', 'మహిళ': 'WOMEN',
        
        // Emotions
        'సంతోషం': 'HAPPY', 'ఆనందం': 'HAPPY', 'దుఃఖం': 'SAD', 'బాధ': 'SAD',
        'కోపం': 'ANGRY', 'అలసట': 'TIRED', 'ఉత్సాహం': 'EXCITED',
        'ఆందోళన': 'WORRIED', 'ఆశ్చర్యం': 'SURPRISED', 'నిరాశ': 'DISAPPOINTED',
        'ప్రశాంతం': 'CALM', 'ధైర్యం': 'BRAVE', 'గర్వం': 'PROUD',
        'బోరింగ్': 'BORING', 'నవ్వు': 'FUNNY',
        
        // Common words
        'అవును': 'YES', 'కాదు': 'NO', 'లేదు': 'NO', 'సరే': 'OKAY', 'మంచి': 'GOOD', 'బాగుంది': 'GOOD',
        'చెడ్డ': 'BAD', 'పెద్ద': 'BIG', 'చిన్న': 'SMALL', 'పొడవు': 'TALL',
        'కొత్త': 'NEW', 'పాత': 'OLD', 'వేడి': 'HOT', 'చల్లని': 'COLD',
        'వేగం': 'FAST', 'నెమ్మది': 'SLOW', 'సులభం': 'EASY', 'కష్టం': 'HARD',
        
        // Actions
        'తిను': 'EAT', 'భోజనం': 'EAT', 'తాగు': 'DRINK', 'నిద్ర': 'SLEEP', 'పడుకో': 'SLEEP',
        'చూడు': 'SEE', 'విను': 'LISTEN', 'చదువు': 'READ', 'రాయి': 'WRITE',
        'కూర్చో': 'SIT', 'నిలబడు': 'STAND', 'నడువు': 'Walk', 'పరుగెత్తు': 'RUN', 'దూకు': 'JUMP',
        'ఆడు': 'PLAY_0A', 'సహాయం': 'HELP', 'ఆపు': 'STOP', 'వేచి ఉండు': 'WAIT',
        'రా': 'ARRIVE', 'వెళ్ళు': 'LEAVE', 'ఇవ్వు': 'GIVE_0A', 'తీసుకో': 'TAKE',
        'తెరువు': 'OPEN', 'మూయు': 'CLOSE', 'కడుగు': 'WASH', 'వంట': 'COOK',
        'గుర్తు': 'REMEMBER', 'మర్చిపో': 'FORGET', 'అర్థం': 'UNDERSTAND',
        'అడుగు': 'ASK', 'జవాబు': 'ANSWER', 'మొదలు': 'START', 'ప్రయత్నం': 'TRY',
        
        // Places
        'ఇల్లు': 'HOME', 'బడి': 'SCHOOL', 'పాఠశాల': 'SCHOOL', 'కార్యాలయం': 'OFFICE',
        'మార్కెట్': 'MARKET', 'నగరం': 'CITY', 'పార్క్': 'PARK',
        'వంటగది': 'KITCHEN', 'బాత్రూమ్': 'BATHROOM',
        
        // Objects
        'నీళ్ళు': 'WATER', 'ఆహారం': 'FOOD', 'రొట్టె': 'BREAD', 'పండు': 'FRUIT',
        'పుస్తకం': 'BOOK', 'కాగితం': 'PAPER', 'కుర్చీ': 'CHAIR', 'బల్ల': 'TABLE',
        'తలుపు': 'DOOR', 'కిటికీ': 'WINDOW', 'గోడ': 'WALL',
        'గడియారం': 'CLOCK', 'ఫోన్': 'PHONE', 'మొబైల్': 'MOBILE',
        'డబ్బు': 'MONEY', 'ధర': 'PRICE',
        
        // Animals
        'కుక్క': 'DOG', 'పిల్లి': 'CAT', 'పక్షి': 'BIRD', 'చేప': 'FISH', 'గుర్రం': 'HORSE',
        
        // Nature
        'సూర్యుడు': 'SUN', 'చంద్రుడు': 'MOON', 'మేఘం': 'CLOUD', 'వర్షం': 'RAIN', 'పువ్వు': 'FLOWER',
        
        // Time
        'సమయం': 'TIME', 'రోజు': 'DAY', 'రాత్రి': 'NIGHT', 'ఉదయం': 'MORNING',
        'మధ్యాహ్నం': 'AFTERNOON', 'సాయంత్రం': 'EVENING', 'ఈ రోజు': 'TODAY',
        'రేపు': 'TOMORROW', 'నిన్న': 'YESTERDAY', 'సంవత్సరం': 'YEAR',
        'ఎప్పుడూ': 'ALWAYS', 'ఎప్పుడూ కాదు': 'NEVER', 'కొన్నిసార్లు': 'SOMETIMES',
        
        // Questions
        'ఏమిటి': 'WHAT', 'ఎవరు': 'WHO', 'ఎప్పుడు': 'WHEN', 'ఎక్కడ': 'WHERE', 'ఎలా': 'HOW', 'ఎందుకు': 'WHY',
        
        // Numbers
        'సున్నా': '0', 'ఒకటి': '1', 'రెండు': '2', 'మూడు': '3', 'నాలుగు': '4',
        'ఐదు': '5', 'ఆరు': '6', 'ఏడు': '7', 'ఎనిమిది': '8', 'తొమ్మిది': '9',
        
        // Common phrases
        'ఎలా ఉన్నారు': 'HOW', 'ఎలా ఉన్నావు': 'HOW', 'బాగున్నాను': 'GOOD',
        'నేను': 'I', 'నువ్వు': 'YOU', 'మీరు': 'YOU'
    }
};

// Language-specific AI response instructions
const LANGUAGE_INSTRUCTIONS = {
    'en': 'Respond in English.',
    'hi': 'Respond in Hindi (हिंदी में जवाब दें). Use Devanagari script. Be warm and friendly.',
    'kn': 'Respond in Kannada (ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ). Use Kannada script. Be warm and friendly.',
    'te': 'Respond in Telugu (తెలుగులో సమాధానం ఇవ్వండి). Use Telugu script. Be warm and friendly.'
};

/**
 * Auto-detect language from text content
 * Returns detected language code: 'en', 'hi', 'kn', 'te'
 */
function detectLanguage(text) {
    if (!text) return 'en';
    
    // Check for Devanagari (Hindi) - Unicode range: 0900-097F
    const hindiPattern = /[\u0900-\u097F]/;
    if (hindiPattern.test(text)) return 'hi';
    
    // Check for Kannada - Unicode range: 0C80-0CFF
    const kannadaPattern = /[\u0C80-\u0CFF]/;
    if (kannadaPattern.test(text)) return 'kn';
    
    // Check for Telugu - Unicode range: 0C00-0C7F
    const teluguPattern = /[\u0C00-\u0C7F]/;
    if (teluguPattern.test(text)) return 'te';
    
    // Default to English
    return 'en';
}

/**
 * Find sign videos for words in a text response
 * Returns array of available signs with their video paths
 * EXCLUDES common filler words that appear in explanations
 */
function findSignsInResponse(text) {
    if (!text) return [];
    
    // Blacklist: Words that shouldn't be extracted from AI explanations
    // These appear in explanatory text but aren't the main teaching topic
    const FILLER_WORDS = new Set([
        // Articles, prepositions, conjunctions
        'A', 'AN', 'THE', 'IS', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'BEING',
        'HAVE', 'HAS', 'HAD', 'DO', 'DOES', 'DID', 'WILL', 'WOULD', 'COULD', 'SHOULD',
        'MAY', 'MIGHT', 'MUST', 'SHALL', 'CAN', 'NEED', 'DARE', 'OUGHT', 'USED',
        'TO', 'OF', 'IN', 'FOR', 'ON', 'WITH', 'AT', 'BY', 'FROM', 'AS', 'INTO',
        'THROUGH', 'DURING', 'BEFORE', 'AFTER', 'ABOVE', 'BELOW', 'BETWEEN',
        'AND', 'BUT', 'OR', 'NOR', 'SO', 'YET', 'BOTH', 'EITHER', 'NEITHER',
        'NOT', 'ONLY', 'OWN', 'SAME', 'THAN', 'TOO', 'VERY', 'JUST', 'ALSO',
        'WHICH', 'THAT', 'THESE', 'THOSE', 'SUCH', 'WAY', 'WAYS',
        'IT', 'ITS', 'THEM', 'THEIR', 'THERE', 'HERE', 'OTHER', 'SOME', 'ANY',
        'EACH', 'EVERY', 'ALL', 'MANY', 'MOST', 'FEW', 'MORE', 'LESS',
        'MAKE', 'MADE', 'MAKING', 'USE', 'USING', 'GET', 'GETTING', 'GOT',
        'ABOUT', 'LIKE', 'WELL', 'BACK', 'EVEN', 'STILL', 'AGAIN', 'ALREADY',
        // Common verbs/words that appear in explanations but aren't topic-related
        'HELP', 'HAPPY', 'FEEL', 'GREAT', 'WONDERFUL', 'LOVELY', 'NICE',
        'CONNECT', 'EXPRESS', 'COMMUNICATE', 'SKILL', 'PRACTICE', 'LEARN',
        'SIGN', 'LANGUAGE', 'VIDEO', 'WATCH', 'SEE', 'SHOW', 'TRY',
        'I', 'YOU', 'WE', 'HE', 'SHE', 'THEY', 'ME', 'US', 'HIM', 'HER',
        'YOUR', 'MY', 'OUR', 'HIS', 'ITS', 'WHO', 'WHAT', 'HOW', 'WHY', 'WHEN', 'WHERE',
        'START', 'BEGIN', 'END', 'CONTINUE', 'KEEP', 'STOP', 'GO', 'COME',
        'WANT', 'HOPE', 'WISH', 'THINK', 'KNOW', 'UNDERSTAND', 'REMEMBER',
        'SAY', 'TELL', 'ASK', 'ANSWER', 'MEAN', 'MEANS', 'CALLED'
    ]);
    
    const foundSigns = [];
    const seenWords = new Set();
    
    // Extract potential sign words from text
    const words = text.toUpperCase()
        .replace(/[।॥?!,.'"():;-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);
    
    for (const word of words) {
        const cleanWord = word.replace(/[^A-Z0-9]/g, '');
        if (cleanWord.length < 2 || seenWords.has(cleanWord)) continue;
        
        // Skip filler words
        if (FILLER_WORDS.has(cleanWord)) continue;
        
        const video = findSignVideo(cleanWord);
        if (video) {
            seenWords.add(cleanWord);
            foundSigns.push({
                word: cleanWord,
                path: video.path
            });
        }
    }
    
    return foundSigns;
}

/**
 * Extract English words from regional language AI response for sign matching
 * Also finds English words embedded in regional language responses
 */
function extractEnglishWordsFromResponse(text, detectedLanguage) {
    if (!text) return [];
    
    // Common response words that might have signs - prioritized by usefulness
    const priorityWords = [
        'GOOD', 'FINE', 'HAPPY', 'THANK', 'WELCOME', 'HELLO', 'HI', 'YES', 'NO',
        'HELP', 'PLEASE', 'LOVE', 'LEARN', 'FRIEND', 'FAMILY', 'I', 'YOU'
    ];
    
    const secondaryWords = [
        'SORRY', 'PRACTICE', 'WATCH', 'VIDEO', 'SIGN', 'LANGUAGE', 
        'MOTHER', 'FATHER', 'SCHOOL', 'HOME', 'EAT', 'DRINK', 'SLEEP', 
        'PLAY', 'READ', 'WRITE', 'UNDERSTAND', 'HOW', 'WHAT', 'WHEN', 
        'WHERE', 'WHO', 'WHY', 'MORNING', 'EVENING', 'TODAY', 'TOMORROW', 
        'TIME', 'DAY', 'NIGHT', 'WATER', 'FOOD', 'GREAT', 'AMAZING'
    ];
    
    const foundSigns = [];
    const seenWords = new Set();
    
    // First, check for English words embedded in the text (common in mixed responses)
    const englishWordPattern = /\b[A-Z]{2,}\b/g;
    const englishMatches = text.toUpperCase().match(englishWordPattern) || [];
    
    for (const word of englishMatches) {
        if (seenWords.has(word)) continue;
        const video = findSignVideo(word);
        if (video) {
            seenWords.add(word);
            foundSigns.push({
                word: word,
                path: video.path
            });
        }
    }
    
    // For regional language responses, find translations
    const translations = SIGN_TRANSLATIONS[detectedLanguage];
    if (translations) {
        // Check priority words first
        for (const word of [...priorityWords, ...secondaryWords]) {
            if (seenWords.has(word)) continue;
            
            const video = findSignVideo(word);
            if (video) {
                // Reverse lookup - find if any translation key maps to this word
                for (const [regional, english] of Object.entries(translations)) {
                    if (english === word && text.includes(regional)) {
                        seenWords.add(word);
                        foundSigns.push({
                            word: word,
                            regionalWord: regional,
                            path: video.path
                        });
                        break;
                    }
                }
            }
            
            // Limit to prevent too many signs
            if (foundSigns.length >= 8) break;
        }
    }
    
    // If response is in regional language and mentions "how are you" type questions,
    // add relevant response signs like GOOD, FINE, HAPPY
    const greetingPatterns = {
        'hi': /कैसे|हाल|ठीक|अच्छ/,
        'kn': /ಹೇಗಿ|ಚೆನ್ನಾ|ಒಳ್ಳೆ/,
        'te': /ఎలా|బాగ|మంచి/
    };
    
    if (greetingPatterns[detectedLanguage]?.test(text)) {
        const greetingSigns = ['GOOD', 'FINE', 'HAPPY', 'THANK'];
        for (const word of greetingSigns) {
            if (seenWords.has(word)) continue;
            const video = findSignVideo(word);
            if (video) {
                seenWords.add(word);
                foundSigns.push({
                    word: word,
                    path: video.path
                });
            }
        }
    }
    
    return foundSigns;
}

/**
 * Translate non-English AI response to English and extract sign-worthy words using OpenAI
 * This enables showing sign videos for concepts discussed in Hindi/Kannada/Telugu responses
 * 
 * @param {string} responseText - The AI response text (in any language)
 * @param {string} language - The detected language of the response ('hi', 'kn', 'te', 'en')
 * @param {string} originalQuery - The user's original question
 * @returns {Promise<Array>} Array of sign objects with word and video path
 */
async function translateAndExtractSignsFromResponse(responseText, language, originalQuery = '') {
    if (!responseText) return [];
    
    // If already English, use direct sign extraction
    if (language === 'en') {
        return findSignsInResponse(responseText);
    }
    
    try {
        // Get available signs for context
        const availableSigns = getAllAvailableSigns().slice(0, 100);
        
        // Use OpenAI to translate and identify key sign-worthy concepts
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a sign language expert. Given a response text in a regional Indian language (Hindi/Kannada/Telugu), identify the KEY CONCEPTS that should be demonstrated as sign language videos.

IMPORTANT RULES:
1. Translate the main concepts/words to English (not the full text)
2. Return ONLY words that are meaningful for sign language learning
3. Focus on: greetings, emotions, actions, nouns, key verbs
4. IGNORE: filler words, pronouns, articles, conjunctions
5. Return words that match available sign videos

Available sign videos: ${availableSigns.join(', ')}

Return JSON format:
{
  "translatedConcepts": ["HELLO", "THANK", "GOOD"],
  "explanation": "Brief note on why these concepts were chosen"
}`
                },
                {
                    role: "user",
                    content: `Original question: "${originalQuery}"
                    
Response text (${language}): "${responseText}"

Extract key concepts that should have sign demonstrations.`
                }
            ],
            max_tokens: 200,
            temperature: 0.3
        });
        
        let result = completion.choices[0].message.content;
        
        // Clean markdown if present
        if (result.startsWith('```')) {
            result = result.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        }
        
        // Parse JSON response
        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch {
            console.log('[TranslateExtract] Failed to parse OpenAI response:', result);
            return [];
        }
        
        const concepts = parsed.translatedConcepts || [];
        console.log(`[TranslateExtract] Extracted concepts: ${concepts.join(', ')}`);
        
        // Find videos for each concept
        const foundSigns = [];
        const seenWords = new Set();
        
        for (const concept of concepts) {
            const cleanWord = concept.toUpperCase().replace(/[^A-Z0-9_]/g, '');
            if (cleanWord.length < 2 || seenWords.has(cleanWord)) continue;
            
            const video = findSignVideo(cleanWord);
            if (video) {
                seenWords.add(cleanWord);
                foundSigns.push({
                    word: cleanWord,
                    path: video.path
                });
            }
        }
        
        console.log(`[TranslateExtract] Found ${foundSigns.length} sign videos for concepts`);
        return foundSigns;
        
    } catch (error) {
        console.error('[TranslateExtract] Error:', error.message);
        // Fallback to basic extraction
        return extractEnglishWordsFromResponse(responseText, language);
    }
}

/**
 * Translate a word from regional language to English sign name
 */
function translateToEnglishSign(word, language) {
    if (!word || !language || language === 'en') return word;
    
    const translations = SIGN_TRANSLATIONS[language];
    if (!translations) return word;
    
    // Try exact match first
    const upperWord = word.toUpperCase();
    const lowerWord = word.toLowerCase();
    
    // Check exact match
    if (translations[word]) return translations[word];
    if (translations[lowerWord]) return translations[lowerWord];
    
    // For each word in the input, try to translate
    const words = word.split(/\s+/);
    const translatedWords = words.map(w => {
        return translations[w] || translations[w.toLowerCase()] || w.toUpperCase();
    });
    
    return translatedWords.join(' ');
}

/**
 * Translate multiple words in a sentence
 * Handles both single words and multi-word phrases
 */
function translateSentenceToEnglishSigns(sentence, language) {
    if (!sentence || !language || language === 'en') return sentence;
    
    const translations = SIGN_TRANSLATIONS[language];
    if (!translations) return sentence;
    
    // Clean the entire sentence first (remove ALL punctuation including multiple dots)
    let cleanSentence = sentence
        .replace(/[।॥？।?!,.\-:;'"()[\]{}।॥…·•]+/g, '')  // Remove punctuation
        .replace(/\.{2,}/g, '')  // Remove multiple dots
        .trim();
    let lowerSentence = cleanSentence.toLowerCase();
    
    // First, check if the ENTIRE sentence is a phrase match (try both cases)
    if (translations[cleanSentence]) {
        console.log(`[Translate] Full phrase match: "${cleanSentence}" → "${translations[cleanSentence]}"`);
        return translations[cleanSentence];
    }
    if (translations[lowerSentence]) {
        console.log(`[Translate] Full phrase match (lowercase): "${lowerSentence}" → "${translations[lowerSentence]}"`);
        return translations[lowerSentence];
    }
    
    // Also try without spaces for compound phrases
    const noSpaceSentence = cleanSentence.replace(/\s+/g, '');
    const noSpaceLower = noSpaceSentence.toLowerCase();
    if (translations[noSpaceSentence]) {
        console.log(`[Translate] No-space phrase match: "${noSpaceSentence}" → "${translations[noSpaceSentence]}"`);
        return translations[noSpaceSentence];
    }
    if (translations[noSpaceLower]) {
        console.log(`[Translate] No-space phrase match (lowercase): "${noSpaceLower}" → "${translations[noSpaceLower]}"`);
        return translations[noSpaceLower];
    }
    
    // Try to match multi-word phrases (2-3 words at a time)
    const words = cleanSentence.split(/\s+/);
    const translatedWords = [];
    let i = 0;
    
    while (i < words.length) {
        let matched = false;
        
        // Try 3-word phrase
        if (i + 2 < words.length) {
            const threeWord = `${words[i]} ${words[i+1]} ${words[i+2]}`;
            if (translations[threeWord]) {
                translatedWords.push(translations[threeWord]);
                i += 3;
                matched = true;
                continue;
            }
        }
        
        // Try 2-word phrase
        if (i + 1 < words.length) {
            const twoWord = `${words[i]} ${words[i+1]}`;
            if (translations[twoWord]) {
                translatedWords.push(translations[twoWord]);
                i += 2;
                matched = true;
                continue;
            }
        }
        
        // Single word
        const word = words[i];
        const cleanWord = word.replace(/[।॥？।?!,.\-:;'"()[\]{}…·•]+/g, '').trim();
        if (cleanWord.length === 0) {
            i++;
            continue;
        }
        
        // Try to translate single word
        const translated = translations[cleanWord] || translations[cleanWord.toLowerCase()];
        if (translated) {
            translatedWords.push(translated);
        } else {
            // Check if it's already English (A-Z characters)
            if (/^[A-Za-z]+$/.test(cleanWord)) {
                translatedWords.push(cleanWord.toUpperCase());
            }
            // Skip non-translatable regional words (don't add garbage)
            // This prevents Kannada/Telugu/Hindi characters from being passed through
        }
        i++;
    }
    
    const result = translatedWords.join(' ');
    console.log(`[Translate] "${sentence}" (${language}) → "${result}"`);
    return result || sentence; // Return original if no translation found
}

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
 * FULL MULTILINGUAL SUPPORT: English, Hindi, Kannada, Telugu
 */
app.post("/voice/chat", async (req, res) => {
    try {
        const { userId, audio, language = 'en', conversationHistory = [], voiceEnabled = true } = req.body;
        
        if (!userId || !audio) {
            return res.status(400).json({ error: "userId and audio are required" });
        }
        
        // Step 1: Transcribe audio to text (use hint language for better accuracy)
        const hintLanguage = SUPPORTED_LANGUAGES[language] ? language : 'en';
        const audioBuffer = Buffer.from(audio, 'base64');
        const audioFile = await toFile(audioBuffer, 'audio.webm', { type: 'audio/webm' });
        
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: hintLanguage  // Use as hint, but we'll auto-detect from result
        });
        
        const userMessage = transcription.text;
        console.log('[VoiceChat] User said:', userMessage);
        
        // Use dropdown selection as primary, auto-detect as fallback
        const detectedLanguage = detectLanguage(userMessage);
        // Prefer user's dropdown selection, fallback to auto-detection
        const validLanguage = SUPPORTED_LANGUAGES[language] ? language : 
                              (SUPPORTED_LANGUAGES[detectedLanguage] ? detectedLanguage : 'en');
        console.log(`[VoiceChat] Dropdown: ${language}, Auto-detected: ${detectedLanguage}, Using: ${validLanguage}`);
        
        if (!userMessage || userMessage.trim().length === 0) {
            const emptyMessages = {
                'en': "I couldn't hear that. Please try speaking again.",
                'hi': "मुझे सुनाई नहीं दिया। कृपया फिर से बोलें।",
                'kn': "ನನಗೆ ಕೇಳಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಮಾತನಾಡಿ.",
                'te': "నాకు వినబడలేదు. దయచేసి మళ్ళీ మాట్లాడండి."
            };
            return res.json({
                success: true,
                transcription: "",
                response: { type: "error", response: emptyMessages[validLanguage] || emptyMessages['en'] },
                audio: null,
                language: validLanguage
            });
        }
        
        // Step 2: Translate regional language to English sign names
        // Use detected language for translation to handle input correctly
        const translationLang = detectedLanguage !== 'en' ? detectedLanguage : validLanguage;
        const translatedMessage = translateSentenceToEnglishSigns(userMessage.trim(), translationLang);
        const cleanMessage = translatedMessage.toUpperCase();
        
        console.log(`[VoiceChat] Translation lang: ${translationLang}, Translated: "${cleanMessage}"`);
        
        // Check if it's a sign request
        // For regional languages: if translation produced valid sign words, treat as sign request
        const translationSuccessful = cleanMessage !== userMessage.trim().toUpperCase() && cleanMessage.length > 0;
        const isShortMessage = cleanMessage.split(/\s+/).length <= 6;
        
        const isSignRequest = isShortMessage || translationSuccessful ||
            // Hindi patterns - greeting and question words
            /का साइन|साइन दिखाओ|कैसे करें|सिखाओ|कैसे हो|क्या हाल|नमस्ते|धन्यवाद/i.test(userMessage) ||
            // Kannada patterns - greeting and question words
            /ಸೈನ್|ತೋರಿಸಿ|ಕಲಿಸಿ|ಹೇಗೆ|ಹೇಗಿದ್ದೀ|ನಮಸ್ಕಾರ|ಧನ್ಯವಾದ|ಚೆನ್ನಾಗಿ|ಏನು|ಯಾರು/i.test(userMessage) ||
            // Telugu patterns - greeting and question words
            /సైన్|చూపించు|నేర్పించు|ఎలా|నమస్కారం|ధన్యవాదాలు|బాగున్నారా|ఏమిటి/i.test(userMessage);
        
        console.log(`[VoiceChat] isSignRequest: ${isSignRequest}, translationSuccessful: ${translationSuccessful}`);
        
        const words = cleanMessage.split(/\s+/).filter(w => w.length > 0);
        const videoSequence = [];
        const notFoundWords = [];
        
        for (const word of words) {
            const cleanWord = word.replace(/[^A-Z0-9_]/g, '');
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
            
            // Language-specific responses
            const responseMessages = {
                'en': `Here's how to sign "${foundWords}"`,
                'hi': `यहाँ "${foundWords}" का साइन है`,
                'kn': `ಇಲ್ಲಿ "${foundWords}" ಸೈನ್ ಇದೆ`,
                'te': `ఇక్కడ "${foundWords}" సైన్ ఉంది`
            };
            
            const speechMessages = {
                'en': `Here's how to sign ${foundWords}. Watch the video to learn!`,
                'hi': `यहाँ ${foundWords} का साइन है। सीखने के लिए वीडियो देखें!`,
                'kn': `ಇಲ್ಲಿ ${foundWords} ಸೈನ್ ಇದೆ. ಕಲಿಯಲು ವೀಡಿಯೋ ನೋಡಿ!`,
                'te': `ఇక్కడ ${foundWords} సైన్ ఉంది. నేర్చుకోవడానికి వీడియో చూడండి!`
            };
            
            const warningMessages = {
                'en': `Note: No video for: ${notFoundWords.join(', ')}`,
                'hi': `नोट: इनके लिए वीडियो नहीं है: ${notFoundWords.join(', ')}`,
                'kn': `ಗಮನಿಸಿ: ಇವುಗಳಿಗೆ ವೀಡಿಯೋ ಇಲ್ಲ: ${notFoundWords.join(', ')}`,
                'te': `గమనిక: వీటికి వీడియో లేదు: ${notFoundWords.join(', ')}`
            };
            
            tutorResponse = {
                type: "sign_sequence",
                isSentence: videoSequence.length > 1,
                sentence: foundWords,
                originalQuery: userMessage,
                response: responseMessages[validLanguage] || responseMessages['en'],
                videoSequence: videoSequence.map(v => ({
                    word: v.word,
                    path: v.video.path
                })),
                notFoundWords: notFoundWords,
                totalVideos: videoSequence.length,
                language: validLanguage
            };
            
            textForSpeech = speechMessages[validLanguage] || speechMessages['en'];
            
            if (notFoundWords.length > 0) {
                tutorResponse.warning = warningMessages[validLanguage] || warningMessages['en'];
            }
        } else {
            // Use OpenAI for general questions with language instruction
            try {
                const userProfile = await getUserTutorProfile(userId);
                let systemPrompt = userProfile ? populateSystemPrompt(userProfile) : AI_TUTOR_SYSTEM_PROMPT;
                
                // Add language-specific instruction
                const languageInstruction = LANGUAGE_INSTRUCTIONS[validLanguage] || LANGUAGE_INSTRUCTIONS['en'];
                systemPrompt += `\n\n🌐 IMPORTANT LANGUAGE INSTRUCTION: ${languageInstruction}`;
                
                // Add instruction to include sign-able words
                systemPrompt += `\n\nWhen responding, try to naturally include these common words that have sign videos: GOOD, FINE, HAPPY, THANK, HELLO, YES, NO, HELP, PLEASE, LOVE, LEARN, FRIEND, FAMILY.`;
                
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
                
                // Strip markdown code blocks if present
                let cleanedResponse = aiResponse.trim();
                if (cleanedResponse.startsWith('```')) {
                    cleanedResponse = cleanedResponse.replace(/^```[a-z]*\n?/i, '');
                    cleanedResponse = cleanedResponse.replace(/\n?```$/i, '');
                    cleanedResponse = cleanedResponse.trim();
                }
                
                try {
                    tutorResponse = JSON.parse(cleanedResponse);
                    textForSpeech = tutorResponse.response || cleanedResponse;
                } catch {
                    tutorResponse = { type: "general_help", response: cleanedResponse };
                    textForSpeech = cleanedResponse;
                }
                
                tutorResponse.language = validLanguage;
                
                // ENABLED: Smart sign extraction for non-English responses
                if (validLanguage !== 'en') {
                    try {
                        const responseText = tutorResponse.response || cleanedResponse;
                        const extractedSigns = await translateAndExtractSignsFromResponse(
                            responseText, 
                            validLanguage, 
                            userMessage
                        );
                        
                        if (extractedSigns && extractedSigns.length > 0) {
                            tutorResponse.hasResponseSigns = true;
                            tutorResponse.responseSigns = extractedSigns;
                            console.log(`[VoiceChat] Found ${extractedSigns.length} signs from ${validLanguage} response`);
                        }
                    } catch (extractError) {
                        console.error('[VoiceChat] Sign extraction error:', extractError.message);
                    }
                }
                
                console.log(`[VoiceChat] AI response ready (language: ${validLanguage})`);
                
            } catch (aiError) {
                console.error("OpenAI error in voice chat:", aiError.message);
                
                const errorMessages = {
                    'en': "I'm having trouble understanding. Could you try asking again?",
                    'hi': "मुझे समझने में परेशानी हो रही है। क्या आप फिर से पूछ सकते हैं?",
                    'kn': "ನನಗೆ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ. ಮತ್ತೆ ಕೇಳಬಹುದೇ?",
                    'te': "నాకు అర్థం చేసుకోవడంలో ఇబ్బంది ఉంది. మళ్ళీ అడగగలరా?"
                };
                
                tutorResponse = {
                    type: "not_found",
                    response: errorMessages[validLanguage] || errorMessages['en'],
                    language: validLanguage
                };
                textForSpeech = tutorResponse.response;
            }
        }
        
        // Step 3: Generate TTS audio if voice is enabled
        // OpenAI TTS auto-detects language from text content
        let audioResponse = null;
        if (voiceEnabled && textForSpeech) {
            try {
                // Clean text for speech (keep Unicode for regional languages)
                const cleanTextForSpeech = textForSpeech
                    .replace(/[*_`#]/g, '')
                    .replace(/\[.*?\]/g, '')
                    .replace(/👇|🎥|📝|⚠️|💡|🌟|✅|🎯|💪|📚|🏋️|🌍|🤟/g, '') // Remove emojis
                    .slice(0, 1000);
                
                const mp3Response = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: "nova",
                    input: cleanTextForSpeech
                });
                
                const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
                audioResponse = audioBuffer.toString('base64');
                
                console.log(`[VoiceChat] TTS generated in ${validLanguage}`);
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
            userProfile: { name: 'Learner', streak: 0, progress: 0 },
            language: validLanguage
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

// Report cache to avoid regenerating frequently (cache for 5 minutes)
const reportCache = new Map();
const REPORT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clean expired cache entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of reportCache.entries()) {
        if (now - value.timestamp > REPORT_CACHE_TTL) {
            reportCache.delete(key);
        }
    }
}, 60000); // Clean every minute

/**
 * Generate comprehensive learning report for parents
 * Uses OpenAI to create personalized insights and recommendations
 * 
 * Improvements:
 * - Authentication check via X-User-Id header
 * - Batch loading courses to avoid N+1 queries
 * - Increased OpenAI tokens with better JSON parsing
 * - Report caching to avoid regeneration
 */
app.get("/report/generate/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUserId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        
        // Authentication check: verify requesting user matches report user
        // Allow access if: same user, or user is a parent of this child (future feature)
        if (requestingUserId && requestingUserId !== userId) {
            // Check if requesting user is a parent of this child
            const requestingUser = await User.findById(requestingUserId);
            const targetUser = await User.findById(userId);
            
            // For now, only allow parents to view their children's reports
            // or users to view their own reports
            const isParentOfChild = requestingUser?.role === 'parent' && 
                targetUser?.parentId?.toString() === requestingUserId;
            
            if (!isParentOfChild) {
                console.log('[Report] Unauthorized access attempt:', { requestingUserId, targetUserId: userId });
                return res.status(403).json({ error: "You don't have permission to view this report" });
            }
        }
        
        // Check cache first
        const cacheKey = `report_${userId}`;
        const cachedReport = reportCache.get(cacheKey);
        if (cachedReport && (Date.now() - cachedReport.timestamp < REPORT_CACHE_TTL)) {
            console.log('[Report] Returning cached report for user:', userId);
            return res.json({
                success: true,
                report: cachedReport.data,
                cached: true
            });
        }
        
        console.log('[Report] Generating report for user:', userId);
        
        // Fetch all user data in parallel
        const [user, progressDocs, quizAttempts, learningEvents] = await Promise.all([
            User.findById(userId),
            UserProgress.find({ userId }),
            QuizAttempt.find({ userId }).sort({ submittedAt: -1 }),
            LearningEvent.find({ userId }).sort({ ts: -1 }).limit(100)
        ]);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Batch load all courses needed (fix N+1 query problem)
        const courseIds = [
            ...new Set([
                ...progressDocs.map(p => p.courseId),
                ...quizAttempts.map(q => q.courseId)
            ])
        ].filter(Boolean);
        
        const courses = await Course.find({ id: { $in: courseIds } });
        const courseMap = new Map(courses.map(c => [c.id, c]));
        
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
        
        // Course progress breakdown (using cached courses - no N+1 queries)
        const courseProgress = progressDocs.map(p => {
            const course = courseMap.get(p.courseId);
            return {
                courseName: course?.title || `Course ${p.courseId}`,
                progress: p.progressPercentage || 0,
                status: p.status,
                timeSpent: p.timeSpent || 0
            };
        });
        
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
            const course = courseMap.get(courseId); // Use cached course (no extra query)
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

CRITICAL: Return ONLY valid JSON with no additional text or markdown. The response must be parseable JSON.

JSON format:
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
                max_tokens: 1200, // Increased from 800 for more complete responses
                temperature: 0.7,
                response_format: { type: "json_object" } // Force JSON response
            });
            
            // Parse with better error handling
            const responseContent = completion.choices[0].message.content;
            try {
                aiInsights = JSON.parse(responseContent);
                
                // Validate required fields exist
                if (!aiInsights.overallSummary) {
                    throw new Error('Missing overallSummary');
                }
            } catch (parseError) {
                console.error('[Report] JSON parse error:', parseError.message);
                // Try to extract JSON from markdown code blocks
                const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    aiInsights = JSON.parse(jsonMatch[1].trim());
                } else {
                    // Use response as summary if parsing fails
                    aiInsights = {
                        overallSummary: responseContent.substring(0, 500),
                        achievements: [],
                        parentTips: [],
                        encouragement: "Keep up the great work!"
                    };
                }
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
        
        // Cache the report
        reportCache.set(cacheKey, {
            data: report,
            timestamp: Date.now()
        });
        
        console.log('[Report] Report generated and cached successfully');
        
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

/**
 * Force refresh report (bypass cache)
 */
app.get("/report/generate/:userId/refresh", async (req, res) => {
    const { userId } = req.params;
    const cacheKey = `report_${userId}`;
    reportCache.delete(cacheKey);
    
    // Redirect to main report endpoint
    res.redirect(`/report/generate/${userId}`);
});

/**
 * Generate PDF report server-side
 * Returns a downloadable PDF file
 */
app.get("/report/pdf/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUserId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }
        
        // Authentication check
        if (requestingUserId && requestingUserId !== userId) {
            const requestingUser = await User.findById(requestingUserId);
            const targetUser = await User.findById(userId);
            const isParentOfChild = requestingUser?.role === 'parent' && 
                targetUser?.parentId?.toString() === requestingUserId;
            
            if (!isParentOfChild) {
                return res.status(403).json({ error: "You don't have permission to download this report" });
            }
        }
        
        console.log('[Report PDF] Generating PDF for user:', userId);
        
        // Get cached report or generate new one
        const cacheKey = `report_${userId}`;
        let report;
        
        const cachedReport = reportCache.get(cacheKey);
        if (cachedReport && (Date.now() - cachedReport.timestamp < REPORT_CACHE_TTL)) {
            report = cachedReport.data;
        } else {
            // Fetch fresh data (simplified version for PDF)
            const [user, progressDocs, quizAttempts] = await Promise.all([
                User.findById(userId),
                UserProgress.find({ userId }),
                QuizAttempt.find({ userId }).sort({ submittedAt: -1 }).limit(10)
            ]);
            
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            
            const totalCourses = progressDocs.length;
            const completedCourses = progressDocs.filter(p => p.status === 'completed').length;
            const totalTimeMinutes = progressDocs.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
            const avgProgress = totalCourses > 0 
                ? Math.round(progressDocs.reduce((sum, p) => sum + p.progressPercentage, 0) / totalCourses) 
                : 0;
            const totalQuizzes = quizAttempts.length;
            const avgQuizScore = totalQuizzes > 0 
                ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.score || 0), 0) / totalQuizzes) 
                : 0;
            
            report = {
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
                    totalQuizzes,
                    avgQuizScore
                }
            };
        }
        
        // Generate HTML for PDF
        const reportDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const hours = Math.floor(report.statistics.totalTimeMinutes / 60);
        const minutes = report.statistics.totalTimeMinutes % 60;
        const timeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>LearnSign Progress Report - ${report.student.name}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: #f5f7fa; 
                    color: #2d3748;
                    padding: 40px;
                }
                .container { 
                    max-width: 800px; 
                    margin: 0 auto; 
                    background: white; 
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #667eea;
                }
                .logo { 
                    font-size: 32px; 
                    font-weight: bold; 
                    color: #667eea;
                    margin-bottom: 10px;
                }
                .title { 
                    font-size: 24px; 
                    color: #4a5568; 
                    margin-bottom: 5px;
                }
                .date { 
                    color: #718096; 
                    font-size: 14px;
                }
                .student-card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 25px;
                    border-radius: 12px;
                    margin-bottom: 30px;
                }
                .student-name { 
                    font-size: 28px; 
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .student-meta { 
                    display: flex; 
                    gap: 20px; 
                    flex-wrap: wrap;
                    font-size: 14px;
                    opacity: 0.9;
                }
                .section { 
                    margin-bottom: 30px; 
                }
                .section-title { 
                    font-size: 20px; 
                    color: #667eea;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .stats-grid { 
                    display: grid; 
                    grid-template-columns: repeat(3, 1fr); 
                    gap: 15px;
                }
                .stat-card { 
                    background: #f7fafc; 
                    padding: 20px; 
                    border-radius: 10px;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                }
                .stat-value { 
                    font-size: 32px; 
                    font-weight: bold; 
                    color: #667eea;
                }
                .stat-label { 
                    font-size: 12px; 
                    color: #718096;
                    text-transform: uppercase;
                    margin-top: 5px;
                }
                .summary-card {
                    background: #f0fff4;
                    border: 1px solid #9ae6b4;
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .summary-text {
                    font-size: 16px;
                    line-height: 1.6;
                    color: #2d3748;
                }
                .tips-list {
                    list-style: none;
                    padding: 0;
                }
                .tips-list li {
                    padding: 12px 15px;
                    background: #fffaf0;
                    border-left: 4px solid #ed8936;
                    margin-bottom: 10px;
                    border-radius: 0 8px 8px 0;
                }
                .footer { 
                    text-align: center; 
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    color: #718096;
                    font-size: 12px;
                }
                .encouragement {
                    background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    font-size: 18px;
                    font-weight: 500;
                    color: #744210;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🤟 LearnSign</div>
                    <div class="title">Learning Progress Report</div>
                    <div class="date">${reportDate}</div>
                </div>
                
                <div class="student-card">
                    <div class="student-name">${report.student.name}</div>
                    <div class="student-meta">
                        <span>🎂 ${report.student.ageGroup}</span>
                        <span>📅 Member since ${report.student.memberSince}</span>
                        <span>🔥 ${report.student.currentStreak} day streak</span>
                    </div>
                </div>
                
                ${report.aiInsights?.overallSummary ? `
                <div class="section">
                    <div class="section-title">🤖 AI Summary</div>
                    <div class="summary-card">
                        <p class="summary-text">${report.aiInsights.overallSummary}</p>
                    </div>
                </div>
                ` : ''}
                
                <div class="section">
                    <div class="section-title">📊 Learning Statistics</div>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${report.statistics.completedCourses}/${report.statistics.totalCourses}</div>
                            <div class="stat-label">Courses Completed</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${timeDisplay}</div>
                            <div class="stat-label">Learning Time</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${report.statistics.avgProgress}%</div>
                            <div class="stat-label">Overall Progress</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${report.statistics.totalQuizzes}</div>
                            <div class="stat-label">Quizzes Taken</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${report.statistics.avgQuizScore}%</div>
                            <div class="stat-label">Avg Quiz Score</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${report.statistics.passRate || 0}%</div>
                            <div class="stat-label">Pass Rate</div>
                        </div>
                    </div>
                </div>
                
                ${report.aiInsights?.parentTips?.length > 0 ? `
                <div class="section">
                    <div class="section-title">💡 Tips for Parents</div>
                    <ul class="tips-list">
                        ${report.aiInsights.parentTips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${report.aiInsights?.encouragement ? `
                <div class="encouragement">
                    ✨ ${report.aiInsights.encouragement}
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>Generated by LearnSign AI • ${reportDate}</p>
                    <p>Breaking barriers, one sign at a time 🤟</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
        // Set headers for HTML response (can be converted to PDF by browser print)
        // For true server-side PDF, would need puppeteer or similar
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="LearnSign_Report_${report.student.name}_${new Date().toISOString().split('T')[0]}.html"`);
        
        res.send(htmlContent);
        
    } catch (error) {
        console.error('[Report PDF] Error:', error);
        res.status(500).json({ 
            error: "Failed to generate PDF report", 
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });