const mongoose = require('mongoose');

const studentScoreSchema = new mongoose.Schema({
    studentId: {
        type: Number,
        ref: 'project',
        required: true
    },
    examId: {
        type: Number,
        ref: 'Exam',
        required: true
    },
    teacherId: {
        type: Number,
        ref: 'project',
        required: true
    },
    course: {
        type: String,
        required: true
    },
    score: Number,
    submissionTime: Date,
    submittedAnswers: [Object],
    percentage: Number, // Add the percentage field
    passed: Boolean    // Add the passed field
}, { versionKey: false });

const StudentScore = mongoose.model('StudentScore', studentScoreSchema, 'studentScores');

module.exports = StudentScore;