import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Package title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Package description is required'],
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    subtitle: {
        type: String,
        trim: true,
        maxlength: [200, 'Subtitle cannot exceed 200 characters']
    },
    price: {
        type: String,
        required: true,
        default: 'FREE'
    },
    originalPrice: {
        type: String,
        default: null
    },
    savings: {
        type: String,
        default: null
    },
    includes: [{
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Include item cannot exceed 200 characters']
    }],
    ageGroups: [{
        type: String,
        required: true,
        enum: ['1-4', '5-10', '15+']
    }],
    features: [{
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Feature cannot exceed 100 characters']
    }],
    popular: {
        type: Boolean,
        default: false
    },
    courseIds: [{
        type: String,
        required: true
    }],
    targetAudience: {
        type: String,
        enum: ['families', 'parents', 'educators', 'individuals', 'students', 'all'],
        default: 'families'
    },
    benefits: [{
        title: String,
        description: String,
        icon: String
    }],
    pricing: {
        type: {
            type: String,
            enum: ['free', 'one_time', 'subscription', 'freemium'],
            default: 'free'
        },
        amount: {
            type: Number,
            default: 0,
            min: [0, 'Amount cannot be negative']
        },
        currency: {
            type: String,
            default: 'USD',
            uppercase: true,
            minlength: 3,
            maxlength: 3
        },
        billingPeriod: {
            type: String,
            enum: ['monthly', 'yearly', 'lifetime', 'one_time'],
            default: 'one_time'
        }
    },
    analytics: {
        enrollments: { type: Number, default: 0 },
        completions: { type: Number, default: 0 },
        averageRating: { type: Number, default: 4.8, min: 0, max: 5 },
        totalRatings: { type: Number, default: 0 },
        conversionRate: { type: Number, default: 0 }, // percentage of views that become enrollments
        views: { type: Number, default: 0 }
    },
    requirements: {
        minimumAge: {
            type: Number,
            default: 1,
            min: [1, 'Minimum age must be at least 1']
        },
        maximumAge: {
            type: Number,
            default: null
        },
        prerequisites: [String],
        recommendedDevices: [{
            type: String,
            enum: ['desktop', 'tablet', 'mobile', 'smart_tv']
        }]
    },
    content: {
        duration: {
            estimated: String, // e.g., "2-3 months"
            totalHours: Number
        },
        modules: [{
            name: String,
            description: String,
            courseIds: [String],
            order: Number
        }],
        bonusMaterials: [{
            name: String,
            description: String,
            type: { type: String, enum: ['pdf', 'video', 'interactive', 'worksheet'] },
            url: String
        }]
    },
    testimonials: [{
        userName: String,
        userType: String,
        rating: { type: Number, min: 1, max: 5 },
        review: String,
        date: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
        avatar: String
    }],
    stats: {
        familiesEnrolled: { type: Number, default: 0 },
        completionRate: { type: Number, default: 95 }, // percentage
        averageRating: { type: Number, default: 4.8 }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    availableFrom: {
        type: Date,
        default: Date.now
    },
    availableUntil: {
        type: Date,
        default: null
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    icon: {
        type: String,
        default: '🎓'
    },
    seoData: {
        metaTitle: String,
        metaDescription: String,
        keywords: [String],
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true
        }
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
packageSchema.virtual('completionRate').get(function() {
    if (this.analytics.enrollments === 0) return 0;
    return Math.round((this.analytics.completions / this.analytics.enrollments) * 100);
});

// Virtual for popularity score (based on enrollments and ratings)
packageSchema.virtual('popularityScore').get(function() {
    const enrollmentWeight = 0.7;
    const ratingWeight = 0.3;
    const enrollmentScore = Math.min(this.analytics.enrollments / 100, 1); // Normalize to 0-1
    const ratingScore = this.analytics.averageRating / 5; // Normalize to 0-1
    return (enrollmentScore * enrollmentWeight + ratingScore * ratingWeight) * 100;
});

// Virtual for total course count
packageSchema.virtual('totalCourses').get(function() {
    return this.courseIds ? this.courseIds.length : 0;
});

// Virtual for display price
packageSchema.virtual('displayPrice').get(function() {
    if (this.pricing.type === 'free' || this.price === 'FREE') {
        return 'FREE';
    }
    return `$${this.pricing.amount} ${this.pricing.currency}`;
});

// Virtual for formatted stats
packageSchema.virtual('formattedStats').get(function() {
    return {
        enrollments: this.stats.familiesEnrolled > 1000 ? 
            `${Math.floor(this.stats.familiesEnrolled / 100) / 10}k+` : 
            `${this.stats.familiesEnrolled}+`,
        completionRate: `${this.stats.completionRate}%`,
        rating: `${this.stats.averageRating}★`
    };
});

// Instance methods
packageSchema.methods.incrementViews = function() {
    this.analytics.views += 1;
    return this.save();
};

packageSchema.methods.addEnrollment = function() {
    this.analytics.enrollments += 1;
    this.stats.familiesEnrolled += 1;
    this.analytics.conversionRate = (this.analytics.enrollments / this.analytics.views) * 100;
    return this.save();
};

packageSchema.methods.addCompletion = function() {
    this.analytics.completions += 1;
    return this.save();
};

packageSchema.methods.addRating = function(rating) {
    const totalScore = this.analytics.averageRating * this.analytics.totalRatings;
    this.analytics.totalRatings += 1;
    this.analytics.averageRating = (totalScore + rating) / this.analytics.totalRatings;
    this.stats.averageRating = this.analytics.averageRating;
    return this.save();
};

packageSchema.methods.addTestimonial = function(testimonial) {
    this.testimonials.push({
        ...testimonial,
        date: new Date()
    });
    return this.save();
};

packageSchema.methods.isAvailable = function() {
    const now = new Date();
    const availableFrom = this.availableFrom || new Date(0);
    const availableUntil = this.availableUntil || new Date('2099-12-31');
    
    return this.isActive && now >= availableFrom && now <= availableUntil;
};

packageSchema.methods.getAgeGroupInfo = function() {
    const ageGroupLabels = {
        '1-4': 'Early Learners (Ages 1-4)',
        '5-10': 'Young Explorers (Ages 5-10)',
        '15+': 'Advanced Learners (Ages 15+)'
    };
    
    return this.ageGroups.map(group => ({
        id: group,
        label: ageGroupLabels[group] || group
    }));
};

packageSchema.methods.getCoursesByAgeGroup = function() {
    const courses = {
        '1-4': {
            title: 'Early Learners (1-4)',
            description: 'Basic signs and gestures',
            lessons: 12,
            icon: '🧸'
        },
        '5-10': {
            title: 'Young Explorers (5-10)',
            description: 'Vocabulary building',
            lessons: 18,
            icon: '🎒'
        },
        '15+': {
            title: 'Advanced (15+)',
            description: 'Complex conversations',
            lessons: 24,
            icon: '🎓'
        }
    };
    
    return this.ageGroups.map(group => ({
        ageGroup: group,
        ...courses[group]
    }));
};

// Static methods
packageSchema.statics.findByAgeGroup = function(ageGroup) {
    return this.find({ 
        ageGroups: ageGroup, 
        isActive: true 
    }).sort({ popular: -1, 'analytics.enrollments': -1 });
};

packageSchema.statics.getPopular = function(limit = 5) {
    return this.find({ isActive: true })
        .sort({ popular: -1, 'analytics.enrollments': -1 })
        .limit(limit);
};

packageSchema.statics.getFree = function() {
    return this.find({ 
        $or: [
            { price: 'FREE' },
            { 'pricing.type': 'free' }
        ],
        isActive: true 
    }).sort({ popular: -1 });
};

packageSchema.statics.searchPackages = function(query) {
    return this.find({
        $and: [
            { isActive: true },
            {
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } }
                ]
            }
        ]
    }).sort({ popular: -1, 'analytics.enrollments': -1 });
};

// Pre-save middleware
packageSchema.pre('save', function(next) {
    // Generate slug from title if not provided
    if (!this.seoData.slug && this.title) {
        this.seoData.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // Set meta title if not provided
    if (!this.seoData.metaTitle && this.title) {
        this.seoData.metaTitle = this.title + ' - learnSign Learning Package';
    }
    
    // Set meta description if not provided
    if (!this.seoData.metaDescription && this.description) {
        this.seoData.metaDescription = this.description.substring(0, 160);
    }
    
    next();
});

// Indexes for better performance
packageSchema.index({ isActive: 1, popular: -1 });
packageSchema.index({ ageGroups: 1, isActive: 1 });
packageSchema.index({ 'analytics.enrollments': -1 });
packageSchema.index({ tags: 1 });
packageSchema.index({ 'seoData.slug': 1 }, { unique: true });

const Package = mongoose.model('Package', packageSchema);
export default Package;