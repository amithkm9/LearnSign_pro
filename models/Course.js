import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Course title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Course description is required'],
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    video: {
        type: String,
        required: [true, 'Video URL is required']
    },
    thumbnail: {
        type: String,
        default: null
    },
    ageGroup: {
        type: String,
        required: true,
        enum: ['1-4', '5-10', '15+'],
        index: true
    },
    category: {
        type: String,
        required: true,
        enum: ['basics', 'numbers', 'letters', 'family', 'emotions', 'play', 'education', 'conversation'],
        index: true
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        index: true
    },
    duration: {
        type: String,
        required: true,
        match: [/^\d+\s(min|mins|minutes?|hrs?|hours?)$/i, 'Duration must be in format "X min" or "X hrs"']
    },
    durationMinutes: {
        type: Number,
        required: true,
        min: [1, 'Duration must be at least 1 minute']
    },
    skills: [{
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Skill name cannot exceed 100 characters']
    }],
    prerequisites: [{
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                // Validate that prerequisites are valid course IDs
                return /^\d{3}$/.test(v);
            },
            message: 'Prerequisites must be valid course IDs (3 digits)'
        }
    }],
    price: {
        type: String,
        default: 'FREE',
        enum: ['FREE', 'PREMIUM']
    },
    learningObjectives: [{
        type: String,
        trim: true,
        maxlength: [200, 'Learning objective cannot exceed 200 characters']
    }],
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    resources: {
        worksheets: [{
            name: String,
            url: String,
            downloadable: { type: Boolean, default: false }
        }],
        practiceExercises: [{
            name: String,
            description: String,
            type: { type: String, enum: ['video', 'quiz', 'interactive'] }
        }],
        additionalVideos: [{
            name: String,
            url: String,
            duration: String
        }]
    },
    analytics: {
        enrollments: { type: Number, default: 0 },
        completions: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0, min: 0, max: 5 },
        totalRatings: { type: Number, default: 0 },
        averageCompletionTime: { type: Number, default: 0 }, // in minutes
        views: { type: Number, default: 0 }
    },
    content: {
        sections: [{
            title: String,
            description: String,
            videoUrl: String,
            duration: Number, // in minutes
            order: Number
        }],
        quiz: {
            questions: [{
                question: String,
                type: { type: String, enum: ['multiple-choice', 'video-response', 'matching'] },
                options: [String],
                correctAnswer: String,
                explanation: String
            }],
            passingScore: { type: Number, default: 70 }
        }
    },
    accessibility: {
        closedCaptions: { type: Boolean, default: true },
        transcription: String,
        audioDescription: { type: Boolean, default: false },
        keyboardNavigation: { type: Boolean, default: true }
    },
    isPublished: {
        type: Boolean,
        default: true
    },
    publishedAt: {
        type: Date,
        default: Date.now
    },
    instructor: {
        name: String,
        bio: String,
        credentials: [String]
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

// Virtual for completion rate
courseSchema.virtual('completionRate').get(function() {
    if (this.analytics.enrollments === 0) return 0;
    return Math.round((this.analytics.completions / this.analytics.enrollments) * 100);
});

// Virtual for difficulty level number
courseSchema.virtual('difficultyLevel').get(function() {
    const levels = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
    return levels[this.difficulty];
});

// Instance methods
courseSchema.methods.incrementViews = function() {
    this.analytics.views += 1;
    return this.save();
};

courseSchema.methods.addEnrollment = function() {
    this.analytics.enrollments += 1;
    return this.save();
};

courseSchema.methods.addCompletion = function() {
    this.analytics.completions += 1;
    return this.save();
};

courseSchema.methods.addRating = function(rating) {
    const totalScore = this.analytics.averageRating * this.analytics.totalRatings;
    this.analytics.totalRatings += 1;
    this.analytics.averageRating = (totalScore + rating) / this.analytics.totalRatings;
    return this.save();
};

// Static methods
courseSchema.statics.findByAgeGroup = function(ageGroup) {
    return this.find({ ageGroup, isPublished: true }).sort({ order: 1 });
};

courseSchema.statics.findByCategory = function(category) {
    return this.find({ category, isPublished: true }).sort({ order: 1 });
};

courseSchema.statics.findByDifficulty = function(difficulty) {
    return this.find({ difficulty, isPublished: true }).sort({ order: 1 });
};

courseSchema.statics.getPopular = function(limit = 10) {
    return this.find({ isPublished: true })
        .sort({ 'analytics.enrollments': -1 })
        .limit(limit);
};

courseSchema.statics.getRecommendedForUser = function(ageGroup, completedCourses = []) {
    // Get courses for age group that user hasn't completed
    return this.find({ 
        ageGroup, 
        isPublished: true,
        id: { $nin: completedCourses }
    }).sort({ difficultyLevel: 1, order: 1 });
};

// Pre-save middleware
courseSchema.pre('save', function(next) {
    // Convert duration to minutes for sorting/filtering
    if (this.isModified('duration')) {
        const duration = this.duration.toLowerCase();
        const match = duration.match(/(\d+)\s*(min|mins|minutes?|hrs?|hours?)/);
        if (match) {
            let minutes = parseInt(match[1]);
            const unit = match[2];
            if (unit.startsWith('hr') || unit.startsWith('hour')) {
                minutes *= 60;
            }
            this.durationMinutes = minutes;
        }
    }
    
    next();
});

// Indexes for better performance
courseSchema.index({ ageGroup: 1, category: 1 });
courseSchema.index({ difficulty: 1, ageGroup: 1 });
courseSchema.index({ 'analytics.enrollments': -1 });
courseSchema.index({ publishedAt: -1 });
courseSchema.index({ tags: 1 });

const Course = mongoose.model('Course', courseSchema);
export default Course;
