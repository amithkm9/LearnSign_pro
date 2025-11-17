import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true // Allow null values but ensure uniqueness when present
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s-()]{10,15}$/, 'Please enter a valid phone number']
    },
    userType: {
        type: String,
        enum: ['parent', 'educator', 'student', 'other'],
        default: 'parent'
    },
    ageGroup: {
        type: String,
        enum: ['1-4', '5-10', '15+'],
        required: false
    },
    dateOfBirth: {
        type: Date
    },
    preferences: {
        language: {
            type: String,
            default: 'en'
        },
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true }
        },
        learningGoals: [{
            type: String,
            enum: ['basic_communication', 'family_bonding', 'professional_development', 'personal_interest', 'accessibility_support']
        }]
    },
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'family-starter', 'parent-child-duo', 'comprehensive-learning'],
            default: 'free'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        features: [{
            type: String
        }]
    },
    progress: {
        totalCoursesStarted: { type: Number, default: 0 },
        totalCoursesCompleted: { type: Number, default: 0 },
        totalLearningTime: { type: Number, default: 0 }, // in minutes
        currentStreak: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        lastActivityDate: { type: Date, default: Date.now },
        achievements: [{
            id: String,
            name: String,
            description: String,
            earnedAt: { type: Date, default: Date.now },
            icon: String
        }]
    },
    familyMembers: [{
        name: String,
        relationship: String,
        age: Number,
        learningLevel: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
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

// Virtual for user's age
userSchema.virtual('age').get(function() {
    if (this.dateOfBirth) {
        return Math.floor((Date.now() - this.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    return null;
});

// Virtual for completion percentage
userSchema.virtual('completionPercentage').get(function() {
    if (this.progress.totalCoursesStarted === 0) return 0;
    return Math.round((this.progress.totalCoursesCompleted / this.progress.totalCoursesStarted) * 100);
});

// Instance methods
userSchema.methods.updateStreak = function() {
    const today = new Date();
    const lastActivity = this.progress.lastActivityDate;
    const diffTime = Math.abs(today - lastActivity);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        // Continue streak
        this.progress.currentStreak += 1;
        this.progress.longestStreak = Math.max(this.progress.longestStreak, this.progress.currentStreak);
    } else if (diffDays > 1) {
        // Break streak
        this.progress.currentStreak = 1;
    }
    // If same day, don't change streak
    
    this.progress.lastActivityDate = today;
    return this.save();
};

userSchema.methods.addAchievement = function(achievement) {
    // Check if achievement already exists
    const exists = this.progress.achievements.find(a => a.id === achievement.id);
    if (!exists) {
        this.progress.achievements.push(achievement);
        return this.save();
    }
    return Promise.resolve(this);
};

userSchema.methods.enrollInPackage = function(packageId) {
    this.subscription.plan = packageId;
    this.subscription.startDate = new Date();
    
    // Set package features based on package
    switch(packageId) {
        case 'family-starter':
            this.subscription.features = ['parent-guide', 'progress-tracking', 'community-access', 'mobile-app'];
            break;
        case 'parent-child-duo':
            this.subscription.features = ['duo-learning', 'weekly-challenges', 'achievement-badges'];
            break;
        case 'comprehensive-learning':
            this.subscription.features = ['unlimited-access', 'expert-support', 'downloadable-content', 'certificate-program'];
            break;
        default:
            this.subscription.features = [];
    }
    
    return this.save();
};

// Static methods
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByFirebaseUid = function(firebaseUid) {
    return this.findOne({ firebaseUid });
};

// Pre-save middleware
userSchema.pre('save', function(next) {
    // Update lastLogin if user is logging in
    if (this.isNew || this.isModified('lastLogin')) {
        this.lastLogin = new Date();
    }
    
    next();
});

// Export the model
const User = mongoose.model('User', userSchema);
export default User;
