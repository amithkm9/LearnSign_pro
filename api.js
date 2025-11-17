import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from 'mongoose';
import { connectDB } from "./config/database.js";
import { Course, Package, User, UserProgress, LearningEvent, QuizAttempt } from "./models/index.js";

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

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });