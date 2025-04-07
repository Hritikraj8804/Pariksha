const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
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
    correctOption: {
        type: Number,
        required: true,
        min: 0,
        max: 3
    }
}, { versionKey: false });

const examSchema = new mongoose.Schema({
    teacherId: {
        type: Number, // Assuming your teacher IDs in the 'projectdatabase' are numbers
        ref: 'project', // Reference to your user collection
        required: true
    },
    title: {
        type: String,
        required: true
    },
    course: String,
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
        ref: 'Question' // Reference to the Question model
    }]
}, { versionKey: false });

const Exam = mongoose.model('Exam', examSchema, 'exams'); // 'exams' will be the name of your new collection
const Question = mongoose.model('Question', questionSchema, 'questions'); // 'questions' will be the name of your new collection

module.exports = { Exam, Question };