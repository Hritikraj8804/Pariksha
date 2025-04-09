const mongoose = require('mongoose');

const studentScoreSchema = new mongoose.Schema({
    studentId: {
        type: Number,
        ref: 'project',
        required: true
    },
    name: { // Added student name
        type: String,
        ref: 'projectdatabase',
        required: true
    },
    examId: {
        type: Number,
        ref: 'Exam',
        required: true
    },
    title: { // Added exam title
        type: String,
        ref: 'Exam',
        required: true
    },
    difficulty: { // Added exam difficulty
        type: String,
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
    percentage: Number,
    passed: Boolean
}, { versionKey: false });

const StudentScore = mongoose.model('StudentScore', studentScoreSchema, 'studentScores');

module.exports = StudentScore;