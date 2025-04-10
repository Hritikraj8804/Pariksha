const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionId: {
        type: Number,
        unique: true // Ensure uniqueness for the numerical ID
    },
    examId: {
        type: Number,
        ref: 'Exam',
        required: true
    },
    course: {
        type: String,
        required: true
    },
    teacherId: {
        type: Number,
        ref: 'project',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    options: {
        type: [String],
        required: true,
        validate: [array => array.length === 4, 'Must have exactly 4 options']
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    correctOption: {
        type: Number,
        required: true,
        min: 0,
        max: 3
    }
}, { versionKey: false });

// Pre-save hook to auto-increment questionId
questionSchema.pre('save', async function(next) {
    if (!this.isNew) {
        return next(); // Don't auto-increment on update
    }
    try {
        const lastQuestion = await this.constructor.findOne({}, {}, { sort: { 'questionId': -1 } });
        this.questionId = lastQuestion ? lastQuestion.questionId + 1 : 1;
        next();
    } catch (error) {
        next(error);
    }
});

const examSchema = new mongoose.Schema({
    examId: {
        type: Number,
        unique: true // Ensure uniqueness for the numerical ID
    },
    teacherId: {
        type: Number,
        ref: 'project',
        required: true
    },
    title: {
        type: String,
        required: true,
        unique: true
    },
    course: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        min: 15,
        default: 60
    },
    description: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    limit: {
        type: Number,
        min: 1,
        default: 10
    }
}, { versionKey: false });

// Pre-save hook to auto-increment examId
examSchema.pre('save', async function(next) {
    if (!this.isNew) {
        return next(); // Don't auto-increment on update
    }
    try {
        const lastExam = await this.constructor.findOne({}, {}, { sort: { 'examId': -1 } });
        this.examId = lastExam ? lastExam.examId + 1 : 1;
        next();
    } catch (error) {
        next(error);
    }
});
const activitySchema = new mongoose.Schema({
    teacherId: { 
        type: Number,
        ref: 'project', 
        required: true 
    },
    description: String,
    date: { 
        type: Date, 
        default: Date.now 
    },
}, { versionKey: false });


const resultSchema = new mongoose.Schema({
    studentId: {
        type: Number,
        ref: 'project',
        required: true,
        unique: true // Each student should have only one total score record
    },
    totalScore: {
        type: Number,
        default: 0
    },
    totalTests: {
        type: Number,
        default: 0
    },
    totalExamsTaken: {
        type: Number,
        default: 0
    },
    lastExamScore: {
        type: Number,
        default: 0
    },
    lastExamDate: {
        type: Date
    },
    lastSubmissionTime: {
        type: Date
    },
    lastExamId: {
        type: Number
    },
    examsGiven: [{ // Array to store IDs of exams taken
        examId: Number,
        examName: String // Optional: Store the name directly for efficiency
    }]
}, { versionKey: false });

const Exam = mongoose.model('Exam', examSchema, 'exams');
const Question = mongoose.model('Question', questionSchema, 'questions');
const Activity = mongoose.model('Activity', activitySchema, 'activities');
const Result = mongoose.model('Result', resultSchema, 'results');

module.exports = { Exam, Question, Activity, Result };