const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    teacherId: { // Add this field to track the creator
        type: Number, // Assuming your teacher IDs in 'project' are Numbers
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
    correctOption: {
        type: Number,
        required: true,
        min: 0,
        max: 3
    }
}, { versionKey: false });

const examSchema = new mongoose.Schema({
    teacherId: {
        type: Number, // Assuming your teacher IDs in 'project' are Numbers
        ref: 'project',
        required: true
    },
    title: {
        type: String,
        required: true,
        unique: true
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
        ref: 'Question'
    }]
}, { versionKey: false });

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
    teacherId: { 
        type: Number, 
        ref: 'project', 
        required: true 
    },
    examId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Exam', 
        required: true 
    },
    studentId: { 
        type: Number, 
        ref: 'project', 
        required: true 
    },
    score: Number,
}, { versionKey: false });

const Exam = mongoose.model('Exam', examSchema, 'exams');
const Question = mongoose.model('Question', questionSchema, 'questions');
const Activity = mongoose.model('Activity', activitySchema, 'activities');
const Result = mongoose.model('Result', resultSchema, 'results');

module.exports = { Exam, Question, Activity, Result };