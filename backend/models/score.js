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
    course: { // Add the course field
        type: String,
        required: true
    },
    score: Number,
    submissionTime: Date,
    submittedAnswers: [Object] // You can define a more specific schema for submitted answers if needed
}, { versionKey: false });

const StudentScore = mongoose.model('StudentScore', studentScoreSchema, 'studentScores'); // Assuming your collection name is 'studentScores'

module.exports = StudentScore;