import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    courseId: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'paused'],
        default: 'not_started',
        index: true
    },
    progressPercentage: {
        type: Number,
        default: 0,
        min: [0, 'Progress cannot be negative'],
        max: [100, 'Progress cannot exceed 100%']
    },
    startedAt: {
        type: Date,
        default: null
    },
    lastAccessedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },
    timeSpent: {
        type: Number, // in minutes
        default: 0,
        min: [0, 'Time spent cannot be negative']
    },
    sectionsCompleted: [{
        sectionId: String,
        completedAt: { type: Date, default: Date.now },
        timeSpent: { type: Number, default: 0 } // in minutes
    }],
    quizResults: [{
        attemptNumber: { type: Number, required: true },
        score: { type: Number, required: true, min: 0, max: 100 },
        totalQuestions: { type: Number, required: true },
        correctAnswers: { type: Number, required: true },
        completedAt: { type: Date, default: Date.now },
        timeSpent: { type: Number, default: 0 }, // in minutes
        passed: { type: Boolean, required: true },
        answers: [{
            questionId: String,
            selectedAnswer: String,
            isCorrect: Boolean,
            timeSpent: Number
        }]
    }],
    notes: [{
        content: { type: String, maxlength: 1000 },
        timestamp: { type: Number, required: true }, // video timestamp in seconds
        createdAt: { type: Date, default: Date.now }
    }],
    bookmarks: [{
        title: { type: String, maxlength: 100 },
        timestamp: { type: Number, required: true }, // video timestamp in seconds
        createdAt: { type: Date, default: Date.now }
    }],
    rating: {
        stars: { type: Number, min: 1, max: 5 },
        review: { type: String, maxlength: 500 },
        ratedAt: { type: Date }
    },
    achievements: [{
        id: String,
        name: String,
        description: String,
        earnedAt: { type: Date, default: Date.now }
    }],
    streakData: {
        currentStreak: { type: Number, default: 0 },
        lastActivityDate: { type: Date, default: Date.now }
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// Compound index to ensure one progress record per user per course
userProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Additional indexes for queries
userProgressSchema.index({ userId: 1, status: 1 });
userProgressSchema.index({ courseId: 1, status: 1 });
userProgressSchema.index({ lastAccessedAt: -1 });

// Virtual for best quiz score
userProgressSchema.virtual('bestQuizScore').get(function() {
    if (!this.quizResults || this.quizResults.length === 0) return null;
    return Math.max(...this.quizResults.map(result => result.score));
});

// Virtual for total quiz attempts
userProgressSchema.virtual('totalQuizAttempts').get(function() {
    return this.quizResults ? this.quizResults.length : 0;
});

// Virtual for completion status
userProgressSchema.virtual('isCompleted').get(function() {
    return this.status === 'completed';
});

// Virtual for time spent in hours
userProgressSchema.virtual('timeSpentHours').get(function() {
    return Math.round((this.timeSpent / 60) * 100) / 100;
});

// Instance methods
userProgressSchema.methods.startCourse = function() {
    if (this.status === 'not_started') {
        this.status = 'in_progress';
        this.startedAt = new Date();
        this.lastAccessedAt = new Date();
    }
    return this.save();
};

userProgressSchema.methods.updateProgress = function(percentage, timeSpent = 0) {
    this.progressPercentage = Math.min(100, Math.max(0, percentage));
    this.timeSpent += timeSpent;
    this.lastAccessedAt = new Date();
    
    if (this.status === 'not_started' && percentage > 0) {
        this.status = 'in_progress';
        this.startedAt = new Date();
    }
    
    if (percentage >= 100) {
        this.completeCourse();
    }
    
    return this.save();
};

userProgressSchema.methods.completeCourse = function() {
    this.status = 'completed';
    this.progressPercentage = 100;
    this.completedAt = new Date();
    this.lastAccessedAt = new Date();
    return this.save();
};

userProgressSchema.methods.pauseCourse = function() {
    if (this.status === 'in_progress') {
        this.status = 'paused';
        this.lastAccessedAt = new Date();
    }
    return this.save();
};

userProgressSchema.methods.resumeCourse = function() {
    if (this.status === 'paused') {
        this.status = 'in_progress';
        this.lastAccessedAt = new Date();
    }
    return this.save();
};

userProgressSchema.methods.addQuizResult = function(quizResult) {
    const attemptNumber = this.quizResults.length + 1;
    const passed = quizResult.score >= (quizResult.passingScore || 70);
    
    this.quizResults.push({
        ...quizResult,
        attemptNumber,
        passed,
        completedAt: new Date()
    });
    
    this.lastAccessedAt = new Date();
    
    // If passed and course not completed, mark as completed
    if (passed && this.status !== 'completed') {
        this.completeCourse();
    }
    
    return this.save();
};

userProgressSchema.methods.addNote = function(content, timestamp) {
    this.notes.push({
        content: content.trim(),
        timestamp,
        createdAt: new Date()
    });
    this.lastAccessedAt = new Date();
    return this.save();
};

userProgressSchema.methods.addBookmark = function(title, timestamp) {
    this.bookmarks.push({
        title: title.trim(),
        timestamp,
        createdAt: new Date()
    });
    this.lastAccessedAt = new Date();
    return this.save();
};

userProgressSchema.methods.rateCourse = function(stars, review = '') {
    this.rating = {
        stars,
        review: review.trim(),
        ratedAt: new Date()
    };
    return this.save();
};

userProgressSchema.methods.addAchievement = function(achievement) {
    // Check if achievement already exists
    const exists = this.achievements.find(a => a.id === achievement.id);
    if (!exists) {
        this.achievements.push(achievement);
        return this.save();
    }
    return Promise.resolve(this);
};

// Static methods
userProgressSchema.statics.findUserProgress = function(userId, courseId) {
    return this.findOne({ userId, courseId });
};

userProgressSchema.statics.getUserCoursesByStatus = function(userId, status) {
    return this.find({ userId, status }).populate('courseId');
};

userProgressSchema.statics.getUserCompletedCourses = function(userId) {
    return this.find({ userId, status: 'completed' }).select('courseId completedAt');
};

userProgressSchema.statics.getUserInProgressCourses = function(userId) {
    return this.find({ userId, status: 'in_progress' }).select('courseId progressPercentage lastAccessedAt');
};

userProgressSchema.statics.getCourseAnalytics = function(courseId) {
    return this.aggregate([
        { $match: { courseId } },
        {
            $group: {
                _id: '$courseId',
                totalEnrollments: { $sum: 1 },
                completions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                averageProgress: { $avg: '$progressPercentage' },
                averageTimeSpent: { $avg: '$timeSpent' },
                averageRating: { $avg: '$rating.stars' }
            }
        }
    ]);
};

// Pre-save middleware
userProgressSchema.pre('save', function(next) {
    // Update lastAccessedAt when progress is updated
    if (this.isModified('progressPercentage') || this.isModified('timeSpent')) {
        this.lastAccessedAt = new Date();
    }
    
    next();
});

const UserProgress = mongoose.model('UserProgress', userProgressSchema);
export default UserProgress;
