import mongoose from 'mongoose';

const learningEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: String, required: true, index: true },
    type: { type: String, enum: ['start', 'pause', 'resume', 'heartbeat', 'end'], required: true },
    sessionId: { type: String, index: true },
    activeMs: { type: Number, default: 0, min: 0 },
    progressPercentage: { type: Number, min: 0, max: 100 },
    ts: { type: Date, default: Date.now, index: true },
    source: { type: String, default: 'web' },
    userAgent: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed }
}, {
    timestamps: true,
    toJSON: { virtuals: true, transform: function(doc, ret) { delete ret.__v; return ret; } }
});

learningEventSchema.index({ userId: 1, courseId: 1, ts: -1 });

const LearningEvent = mongoose.model('LearningEvent', learningEventSchema);
export default LearningEvent;


