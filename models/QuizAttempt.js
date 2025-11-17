import mongoose from 'mongoose';

const quizAttemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: String, required: true, index: true },
    quizId: { type: String, required: true },
    attemptNo: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    score: { type: Number, min: 0, max: 100 },
    totalQuestions: { type: Number },
    correct: { type: Number },
    timeMs: { type: Number, default: 0 },
    passed: { type: Boolean },
    answers: [{ questionId: String, correct: Boolean, timeMs: Number, choice: String }]
}, {
    timestamps: true,
    toJSON: { virtuals: true, transform: function(doc, ret) { delete ret.__v; return ret; } }
});

quizAttemptSchema.index({ userId: 1, courseId: 1, quizId: 1, submittedAt: -1 });

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;


