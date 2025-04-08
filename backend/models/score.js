// models/score.js
const mongoose = require('mongoose');

const studentScoreSchema = new mongoose.Schema({
    studentId: {
        type: Number,
        ref: 'project', // Assuming 'project' is your student model
        required: true
    },
    examId: {
        type: Number,
        ref: 'Exam',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

const StudentScore = mongoose.model('StudentScore', studentScoreSchema, 'studentScores');

module.exports = StudentScore; // Use CommonJS export