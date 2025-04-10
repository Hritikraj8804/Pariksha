const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pug = require('pug');
const path = require('path');
const dev = require('dotenv').config();
const app = express();
const morgan = require('morgan');
const winston = require('winston');
const fs = require('fs').promises; // Use promises for cleaner async/await
const fileUpload = require('express-fileupload'); // Middleware for handling file uploads
const logger = require('./logger.js'); 

morgan.format('simple-dev', ':method :url :status - :response-time ms');

app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json());
app.use(fileUpload()); // Enable file upload middleware
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '../frontend/views'));

app.use(session({
    secret: "meanstack",
    saveUninitialized: false,
    resave: false
}));

mongoose.connect('mongodb://127.0.0.1:27017/devexam')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

const cseschema = new mongoose.Schema({
    _id: Number,
    username: { type: String, minLength: 3, unique: true },
    name: { type: String, minLength: 4},
    password: { type: String, required: true },
    email : String,
    mobile: { type: String, minLength: 10, maxLength: 10 },
    roles: {
        type: [String],
        default: ['student'],
        enum: ['student', 'admin', 'teacher']
    },
    profileImage: {
        data: Buffer,
        contentType: String
    }
}, { versionKey: false });

let csemodel = mongoose.model('project', cseschema, 'projectdatabase');

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/home.html'));
});

app.post('/post', async (req, res) => {
    try {
        const { id, username, name, password, email, mobile, roles } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = { _id: id, username: username, name: name, password: hashedPassword, email: email, mobile: mobile, roles: roles };

        if (req.files && req.files.file) {
            const imagefile = req.files.file;
            userData.profileImage = {
                data: imagefile.data,
                contentType: imagefile.mimetype
            };
        }

        const m = new csemodel(userData);
        await m.save();
        res.sendFile(path.join(__dirname, '../frontend/public/login.html'));

    } catch (err) {
        if (err.username === 'ValidationError') {
            if (err.errors && err.errors.username && err.errors.username.kind === 'unique') {
                return res.status(400).json({ error: "This username is already taken. Please choose a different one." });
            }
            return res.status(400).json({ error: "Username is too short (minimum 3 characters)." });
        } else if (err.code === 11000 && err.keyPattern && err.keyPattern._id) {
            return res.status(400).json({ error: "ID already exists. Please use a different ID." });
        } else if (err.name === 'ValidationError' && err.errors && err.errors.roles) {
            return res.status(400).json({ error: "Invalid role provided." });
        }
        console.error("Error saving user:", err);
        res.status(500).send("Error saving user.");
    }
});

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.post('/check', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await csemodel.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        } else {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                req.session.user = { _id: user._id, username: user.username, roles: user.roles, name: user.name };
                if (req.session.user && req.session.user.roles.includes('admin')) {
                    res.redirect(`/admin/dashboard`);
                } else if (req.session.user && req.session.user.roles.includes('teacher')) {
                    res.redirect(`/teacher/dashboard`);
                }  else if (req.session.user && req.session.user.roles.includes('student')) {
                    res.redirect(`/student/dashboard`);
                }
                else {
                    res.redirect('/login.html');
                }

            } else {
                res.status(401).json({ error: "Invalid credentials" });
            }
        }
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({error:"Internal server error"});
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.send(err);
        } else {
            res.clearCookie('connect.sid');
            res.send('logout successful.');
        }
    });
});

app.get('/student/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        try {
            const user = await csemodel.findById(req.session.user._id).lean(); // Still fetch user details by _id
            const studentId = req.session.user._id;
            console.log("Student ID in /student/dashboard:", studentId);

            if (!user) {
                return res.redirect('/logout');
            }

            let profileImage = null;
            if (user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                profileImage = `data:${imageContentType};base64,${imageData}`;
            }

            // Fetch performance data from the Result model using the numerical studentId
            const performanceData = await Result.findOne({ studentId: studentId }).lean();


            const performance = {
                totalExams: performanceData ? performanceData.totalExamsTaken : 0,
                lastExamScore: performanceData ? performanceData.lastExamScore : 0,
            };

            res.render('student/studentview', {
                user: req.session.user,
                profileImage: profileImage,
                performance: performance,
                errorMessage: null,
            });

        } catch (error) {
            console.error("Error fetching student dashboard data:", error);
            res.render('student/studentview', {
                user: req.session.user,
                profileImage: null,
                performance: { totalExams: 0, lastExamScore: 0},
                errorMessage: 'Could not load dashboard information.',
            });
        }
    } else {
        res.redirect('/login.html');
    }
});
app.get('/student/tests', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            let profileImageBase64 = null;
            let imageContentType = null;
            if (user && user.profileImage && user.profileImage.data) {
                profileImageBase64 = user.profileImage.data.toString('base64');
                imageContentType = user.profileImage.contentType;
            }

            // Fetch all exams and their question counts
            const exams = await Exam.aggregate([
                { $match: {} },
                {
                    $lookup: {
                        from: 'questions',
                        localField: 'examId',
                        foreignField: 'examId',
                        as: 'examQuestions'
                    }
                },
                { $addFields: { questionsCount: { $size: '$examQuestions' } } },
                { $project: { _id: 1, title: 1, examId: 1, questionsCount: 1 } }
            ]);
        
            console.log("Exams array in /student/tests:", exams);
            res.render('student/tests', {
                user: req.session.user,
                profileImage: profileImageBase64 ? `data:${imageContentType};base64,${profileImageBase64}` : null,
                exams: exams
            });

        } catch (error) {
            console.error("Error fetching tests:", error);
            res.render('student/tests', {
                user: req.session.user,
                profileImage: null,
                exams: [],
                errorMessage: 'Could not load available tests.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
});


app.get('/student/start-test/:examId', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        const examId = parseInt(req.params.examId);
        console.log("examId in /student/start-test:", examId);

        try {
            const questions = await Question.find({ examId: examId });
            const exam = await Exam.findOne({ examId: examId }).select('title course teacherId difficulty');
            const user = await csemodel.findById(req.session.user._id);

            if (!exam) {
                return res.status(404).send('Exam not found.');
            }

            console.log("Teacher ID found for exam:", exam.teacherId); // Log the teacherId fetched from the database

            if (questions.length > 0 && user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('student/start-exam', {
                    user: req.session.user,
                    name: user.name,
                    examId: req.params.examId,
                    exam: exam,
                    questions: questions,
                    difficulty: exam.difficulty,
                    profileImage: `data:${imageContentType};base64,${imageData}`,
                    teacherId: exam.teacherId // Explicitly pass teacherId to the template
                });
            } else if (questions.length > 0) {
                res.render('student/start-exam', {
                    user: req.session.user,
                    examId: req.params.examId,
                    name: user.name,
                    exam: exam,
                    questions: questions,
                    difficulty: exam.difficulty,
                    profileImage: null,
                    teacherId: exam.teacherId // Explicitly pass teacherId to the template
                });
            } else {
                res.send('No questions found for this exam.');
            }
        } catch (error) {
            console.error("Error starting test:", error);
            res.status(500).send('Error starting the test.');
        }
    } else {
        res.redirect('/login.html');
    }
});

const StudentScore = require('./models/score.js');

app.post('/student/submit-test', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        const studentId = req.session.user._id;
        const examId = parseInt(req.body.examId);
        const submittedAnswers = req.body.questions;
        const submissionTime = new Date();
        let teacherId = parseInt(req.body.teacherId);
        const course = req.body.course;

        console.log("Raw teacherId from form:", req.body.teacherId);
        console.log("Parsed teacherId:", teacherId);

        if (isNaN(teacherId)) {
            console.error("Error: Received NaN for teacherId:", req.body.teacherId);
            return res.status(400).json({ error: 'Invalid teacherId received.' });
        }

        try {
            const correctQuestions = await Question.find({ examId: examId }).select('_id questionId correctOption').lean();
            console.log('correctQuestions:', correctQuestions);
            const totalQuestions = correctQuestions.length;
            let score = 0;

            if (submittedAnswers && totalQuestions > 0) {
                console.log('submittedAnswers:', submittedAnswers);
                submittedAnswers.forEach(submittedAnswer => {
                    const correctAnswerObject = correctQuestions.find(q => q.questionId === parseInt(submittedAnswer.questionId));
                    if (correctAnswerObject && parseInt(submittedAnswer.selectedOption) === correctAnswerObject.correctOption) {
                        score++;
                    }
                });

                const percentageScore = (score / totalQuestions) * 100;
                console.log('percentageScore:', percentageScore);
                const passingThreshold = 75;
                const passed = percentageScore >= passingThreshold;

                // Fetch student name and exam details
                const student = await csemodel.findById(studentId).select('name').lean();
                const exam = await Exam.findOne({ examId: examId }).select('title difficulty questionCount').lean(); // Fetch questionCount

                if (!student || !exam) {
                    return res.status(404).json({ error: 'Student or Exam data not found.' });
                }

                const studentScoreRecord = await StudentScore.findOneAndUpdate(
                    { studentId: studentId, examId: examId, teacherId: teacherId, course: course },
                    {
                        $set: {
                            name: student.name, // Save student name
                            title: exam.title,   // Save exam title
                            difficulty: exam.difficulty, // Save exam difficulty
                            score: score,
                            submissionTime: submissionTime,
                            submittedAnswers: submittedAnswers,
                            percentage: percentageScore,
                            passed: passed
                        }
                    },
                    { upsert: true, new: true } // Return the new or updated document
                );

                // Update overall performance in the Result model by recalculating
                const resultUpdate = await Result.findOneAndUpdate(
                    { studentId: studentId },
                    {
                        $inc: { totalScore: score, totalTests: 1, totalExamsTaken: 1 }, // Re-introduce increment
                        $set: {
                            lastExamScore: score,
                            lastSubmissionTime: submissionTime,
                            lastExamId: examId
                        },
                        $push: {
                            examsGiven: {
                                examId: examId,
                                examName: exam ? exam.title : 'Unknown Exam',
                                scoreObtained: score,
                                totalPossible: exam ? exam.questionCount : totalQuestions
                            }
                        }
                    },
                    { upsert: true, new: true }
                );

                console.log('Student Score Record:', studentScoreRecord);
                console.log('Result Record Updated:', resultUpdate);

                if (studentScoreRecord && studentScoreRecord._id) {
                    res.redirect(`/student/results/${studentScoreRecord._id}`);
                } else {
                    res.send('Error retrieving or creating the submission record.');
                }

            } else {
                res.send('No submitted answers or questions found for this exam.');
            }

        } catch (error) {
            console.error("Error submitting test and saving/updating score:", error);
            res.status(500).send('Error submitting the test and saving/updating the score.');
        }
    } else {
        res.redirect('/login.html');
    }
});



app.get('/student/results/:resultId', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        const resultId = req.params.resultId;

        try {
            const studentResult = await StudentScore.findById(resultId); // Assuming 'StudentScore' is your model
            const user = await csemodel.findById(req.session.user._id);
            const exam = await Exam.findOne({ examId: studentResult.examId }).select('title');

            if (!studentResult) {
                return res.status(404).send('Result not found.');
            }

            let profileImage = null;
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                profileImage = `data:${imageContentType};base64,${imageData}`;
            }

            console.log("studentResult being passed to template:", studentResult); // For debugging

            res.render('student/results', {
                user: req.session.user,
                result: studentResult,
                exam: exam,
                profileImage: profileImage,
            });

        } catch (error) {
            console.error("Error fetching student result:", error);
            res.status(500).send('Error fetching the result.');
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/student/leaderboard', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        try {
            const user = await csemodel.findById(req.session.user._id);

            const leaderboardData = await Result.find({})
                .sort({ totalScore: -1 }) // Sort by total score instead of overallPercentage
                .populate('studentId', 'name')
                .select('studentId totalScore totalTests'); // Select only necessary fields

            let profileImageBase64 = null;
            let imageContentType = null;
            if (user && user.profileImage && user.profileImage.data) {
                profileImageBase64 = user.profileImage.data.toString('base64');
                imageContentType = user.profileImage.contentType;
            }

            res.render('student/leaderboard', {
                user: req.session.user,
                profileImage: profileImageBase64 ? `data:${imageContentType};base64,${profileImageBase64}` : null,
                leaderboard: leaderboardData
            });

        } catch (error) {
            console.error("Error fetching leaderboard data:", error);
            res.render('student/leaderboard', {
                user: req.session.user,
                profileImage: null,
                leaderboard: [],
                errorMessage: 'Could not load leaderboard data.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/student/performance', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        const studentId = req.session.user._id;

        try {
            const user = await csemodel.findById(studentId);
            const studentScores = await StudentScore.find({ studentId: studentId })
                .populate({
                    path: 'examId',
                    select: 'title course',
                    foreignField: 'examId', // Field in the Exam model
                    localField: 'examId'   // Field in the StudentScore model
                });

            let profileImage = null;
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                profileImage = `data:${imageContentType};base64,${imageData}`;
            }

            // Calculate overall completion rate (you might need to define what this means)
            const totalTestsTaken = studentScores.length;
            const overallCompletionRate = totalTestsTaken > 0 ? 100 : 0; // Example: Assuming they've started if they have scores

            // Organize subject-wise performance
            const subjectPerformance = {};
            studentScores.forEach(score => {
                if (score.examId && score.examId.course) {
                    const courseName = score.examId.course;
                    if (!subjectPerformance[courseName]) {
                        subjectPerformance[courseName] = { totalScore: 0, count: 0 };
                    }
                    subjectPerformance[courseName].totalScore += score.percentage || 0;
                    subjectPerformance[courseName].count++;
                }
            });

            const subjects = Object.keys(subjectPerformance).map(course => ({
                name: course,
                score: subjectPerformance[course].count > 0 ? (subjectPerformance[course].totalScore / subjectPerformance[course].count).toFixed(2) : 'N/A'
            }));

            // Organize recent test history
            const testHistory = studentScores.map(score => ({
                name: score.examId ? score.examId.title : 'Unknown Test',
                score: score.percentage ? score.percentage.toFixed(2) : 'N/A',
                date: score.submissionTime ? score.submissionTime.toLocaleDateString() : 'N/A'
            }));

            res.render('student/performance', {
                user: req.session.user,
                profileImage: profileImage,
                performance: {
                    overallCompletionRate: overallCompletionRate.toFixed(2),
                    subjects: subjects,
                    testHistory: testHistory.slice(-5).reverse() // Show the last 5 recent tests
                }
            });

        } catch (error) {
            console.error("Error fetching student performance data:", error);
            res.render('student/performance', {
                user: req.session.user,
                profileImage: null,
                errorMessage: 'Could not load performance data.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
});

const { Exam, Question, Activity, Result } = require('./models/exam');

app.get('/teacher/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const teacherId = req.session.user._id;

            // Fetch teacher's user data
            const user = await csemodel.findById(teacherId);

            // Fetch exams created by the logged-in teacher (only title and _id for listing)
            const createdExams = await Exam.find({ teacherId: teacherId }).select('_id title');

            // Fetch total questions created by the logged-in teacher
            const totalQuestionsCount = await Question.countDocuments({ teacherId: teacherId });

            // Fetch recent activity related to the logged-in teacher
            const recentActivities = await Activity.find({ teacherId: teacherId })
                .sort({ date: -1 })
                .limit(5);

            let profileImageBase64 = null;
            let imageContentType = null;
            if (user && user.profileImage && user.profileImage.data) {
                profileImageBase64 = user.profileImage.data.toString('base64');
                imageContentType = user.profileImage.contentType;
            }

            res.render('teacher/teacherview', {
                user: req.session.user,
                profileImage: profileImageBase64 ? `data:${imageContentType};base64,${profileImageBase64}` : null,
                createdExams: createdExams || [], // Pass the list of created exams
                totalQuestionsCount: totalQuestionsCount || 0,
                recentActivities: recentActivities || []
            });

        } catch (error) {
            console.error("Error fetching data for teacher dashboard:", error);
            res.render('teacher/teacherview', {
                user: req.session.user,
                profileImage: null,
                errorMessage: 'Could not load dashboard data.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/teacher/exams/create', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            let profileImageBase64 = null;
            let imageContentType = null;
            if (user && user.profileImage && user.profileImage.data) {
                profileImageBase64 = user.profileImage.data.toString('base64');
                imageContentType = user.profileImage.contentType;
            }
            res.render('teacher/createexam', {
                id: req.session.user._id,
                user: req.session.user,
                profileImage: profileImageBase64 ? `data:${imageContentType};base64,${profileImageBase64}` : null,
                errorMessage: null // Ensure errorMessage is initially null
            });
        } catch (error) {
            console.error("Error fetching user data for create exam:", error);
            res.render('teacher/createexam', {
                id: req.session.user._id,
                user: req.session.user,
                profileImage: null,
                errorMessage: 'Could not load profile information.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
});


app.post('/teacher/exams', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            console.log("Entire req.body:", req.body);
            const { teacherId, title, course, duration, description, questionSource, difficulty, limit } = req.body;
            const teacher_id = parseInt(teacherId); // Parse the string to a number
            const examLimit = parseInt(limit);

            const newExam = new Exam({
                teacherId: teacher_id, // Use the parsed number here
                title: title,
                course: course,
                duration: parseInt(duration),
                description: description,
                difficulty: difficulty,
                limit: examLimit
            });

            let savedExam = await newExam.save();
            const currentExamId = savedExam.examId; // Get the numerical examId
            const createdQuestions = [];

            if (questionSource === 'custom' && req.body.customQuestions) {
                for (const questionData of Object.values(req.body.customQuestions)) {
                    const newQuestion = new Question({
                        examId: currentExamId, // Use the numerical examId here
                        teacherId: teacher_id,
                        text: questionData.text,
                        options: questionData.options,
                        correctOption: parseInt(questionData.correctOption),
                        course: course // Add the course here
                    });
                    const savedQuestion = await newQuestion.save();
                    createdQuestions.push(savedQuestion._id);
                }
            } else if (questionSource === 'internet' && req.body.internetTopic && req.body.internetDifficulty && req.body.internetLimit) {
                // Placeholder for fetching internet questions - REPLACE WITH YOUR LOGIC
                async function fetchInternetQuestions(topic, difficulty, limit) {
                    // Simulate fetching questions
                    const questions = [];
                    for (let i = 0; i < limit; i++) {
                        questions.push({
                            text: `Internet Question about ${topic} (${difficulty}) ${i + 1}`,
                            options: ["Option A", "Option B", "Option C", "Option D"],
                            correctOptionIndex: Math.floor(Math.random() * 4)
                        });
                    }
                    return questions;
                }

                const fetchedQuestions = await fetchInternetQuestions(
                    req.body.internetTopic,
                    req.body.internetDifficulty,
                    parseInt(req.body.internetLimit)
                );
                for (const fetchedQuestion of fetchedQuestions) {
                    const newQuestion = new Question({
                        examId: currentExamId, // Use the numerical examId here
                        teacherId: teacher_id,
                        text: fetchedQuestion.text,
                        options: fetchedQuestion.options,
                        correctOption: fetchedQuestion.correctOptionIndex
                    });
                    const savedQuestion = await newQuestion.save();
                    createdQuestions.push(savedQuestion._id);
                }
            }

            savedExam.questions = createdQuestions;
            await savedExam.save();

            const newActivity = new Activity({
                teacherId: req.session.user._id,
                description: `Created a new exam: ${savedExam.title}`
            });
            await newActivity.save();

            res.redirect('/teacher/dashboard');

        } catch (error) {
            let errorMessage = 'Error creating exam.';
            if (error.code === 11000 && error.keyPattern && error.keyPattern.title) {
                errorMessage = 'Exam title already exists. Please choose a different title.';
            } else if (error.errors && Object.keys(error.errors).length > 0) {
                // Extract specific validation errors
                errorMessage = Object.values(error.errors).map(err => err.message).join('<br>');
            }
            console.error('Error creating exam:', error);

            // Re-render the createexam form with the error message
            try {
                const user = await csemodel.findById(req.session.user._id);
                let profileImageBase64 = null;
                let imageContentType = null;
                if (user && user.profileImage && user.profileImage.data) {
                    profileImageBase64 = user.profileImage.data.toString('base64');
                    imageContentType = user.profileImage.contentType;
                }
                res.render('teacher/createexam', {
                    id: req.session.user._id,
                    user: req.session.user,
                    profileImage: profileImageBase64 ? `data:${imageContentType};base64,${profileImageBase64}` : null,
                    errorMessage: errorMessage
                });
            } catch (userError) {
                console.error("Error fetching user data for re-rendering:", userError);
                res.render('teacher/createexam', {
                    id: req.session.user._id,
                    user: req.session.user,
                    profileImage: null,
                    errorMessage: 'Could not load profile information and exam creation failed.'
                });
            }
        }
    } else {
        res.redirect('/login.html');
    }
});

// Dummy function for fetching internet questions (replace with your actual logic)
async function fetchInternetQuestions(topic, difficulty, limit) {
    // Simulate fetching questions from an external source or your data
    const dummyQuestions = [];
    for (let i = 0; i < limit; i++) {
        dummyQuestions.push({
            text: `Internet Question ${i + 1} about ${topic} (${difficulty})`,
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: Math.floor(Math.random() * 4)
        });
    }
    return dummyQuestions;
}

app.get('/teacher/questions', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const teacherId = req.session.user._id;

            // Fetch all exams created by the logged-in teacher, including difficulty and limit
            const exams = await Exam.find({ teacherId: teacherId }).select('_id title difficulty limit');

            // Initially, no exam is selected
            const selectedExam = null;
            const questions = [];

            // Fetch the teacher's user data for profile image (optional)
            const user = await csemodel.findById(teacherId);
            let profileImageBase64 = null;
            let imageContentType = null;
            if (user && user.profileImage && user.profileImage.data) {
                profileImageBase64 = user.profileImage.data.toString('base64');
                imageContentType = user.profileImage.contentType;
            }

            res.render('teacher/managequestions', {
                user: req.session.user,
                profileImage: profileImageBase64 ? `data:${imageContentType};base64,${profileImageBase64}` : null,
                exams: exams,
                selectedExam: selectedExam,
                questions: questions
            });

        } catch (error) {
            console.error("Error fetching exams:", error);
            res.render('teacher/managequestions', {
                user: req.session.user,
                profileImage: null,
                exams: [],
                selectedExam: null,
                questions: [],
                errorMessage: 'Could not load exams.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
});

// Route to fetch details of a specific exam (including difficulty and limit)
app.get('/teacher/questions/:examId/details', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const teacherId = req.session.user._id;
            const examId = req.params.examId;

            const exam = await Exam.findOne({ _id: examId, teacherId: teacherId }).select('_id title difficulty limit');

            if (exam) {
                res.json({ success: true, examDetails: exam });
            } else {
                res.status(404).json({ success: false, message: 'Exam not found or unauthorized.' });
            }
        } catch (error) {
            console.error("Error fetching exam details:", error);
            res.status(500).json({ success: false, message: 'Could not load exam details.' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
});

// Route to fetch questions for a specific exam
app.get('/teacher/questions/:examId/questions', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const teacherId = req.session.user._id;
            const examId = req.params.examId;

            const exam = await Exam.findOne({ _id: examId, teacherId: teacherId }).populate('questions');

            if (exam) {
                res.json({ success: true, questions: exam.questions, selectedExam: { _id: exam._id, title: exam.title } });
            } else {
                res.status(404).json({ success: false, message: 'Exam not found or unauthorized.' });
            }
        } catch (error) {
            console.error("Error fetching questions for exam:", error);
            res.status(500).json({ success: false, message: 'Could not load questions for this exam.' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
});

app.get('/teacher/students', async (req, res) => {
  if (req.session.user && req.session.user.roles.includes('teacher')) {
    try {
      // Fetch all users from the 'projectdatabase' collection who have the 'student' role
      const studentsData = await csemodel.find({ roles: 'student' }); // Adjust the filter based on how you identify students

      const studentsWithImages = studentsData.map(student => ({
        _id: student._id,
        name: student.name,
        email: student.email,
        profileImage: student.profileImageBase64
          ? `data:${student.imageContentType};base64,${student.profileImageBase64}`
          : null,
        // Add other relevant student properties
      }));
      const user = await csemodel.findById(req.session.user._id);

      if (user && user.profileImage && user.profileImage.data) {
        const imageData = user.profileImage.data.toString('base64');
        const imageContentType = user.profileImage.contentType;
        res.render('teacher/students', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}`, students: studentsWithImages });
        } else {
            res.render('teacher/students', { user: req.session.user, profileImage: null, students: studentsWithImages });
        }
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).send('Could not load students.');
    }
  } else {
    res.redirect('/login.html');
  }
});

app.get('/teacher/results', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            const teacherId = req.session.user._id;

            const studentScores = await StudentScore.find({ teacherId: teacherId });

            // Extract unique student and exam IDs
            const studentIds = [...new Set(studentScores.map(score => score.studentId))];
            const examIds = [...new Set(studentScores.map(score => score.examId))];

            // Fetch related student and exam data
            const students = await csemodel.find({ studentId: { $in: studentIds } }); // Assuming 'studentId' is the field in your student model
            const exams = await Exam.find({ examId: { $in: examIds } }).select('title'); // Assuming 'examId' is the field in your exam model

            // Combine the data
            const results = studentScores.map(score => {
                const student = students.find(s => s.studentId === score.studentId);
                const exam = exams.find(e => e.examId === score.examId);
                return {
                    ...score.toObject(), // Convert Mongoose document to plain object
                    student: student || { name: 'Unknown Student' },
                    exam: exam || { title: 'Unknown Exam' }
                };
            });

            let profileImage = null;
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                profileImage = `data:${imageContentType};base64,${imageData}`;
            }

            res.render('teacher/viewresults', {
                user: req.session.user,
                profileImage: profileImage,
                results: results
            });

        } catch (error) {
            console.error("Error fetching exam results:", error);
            res.render('teacher/viewresults', {
                user: req.session.user,
                profileImage: null,
                errorMessage: 'Could not load exam results.'
            });
        }
    } else {
        res.redirect('/login.html');
    }
}); 

app.get('/admin/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('admin')) {
      try {
        const user = await csemodel.findById(req.session.user._id).lean();
        const students = await csemodel.find({ roles: 'student' }).lean();
        const teachers = await csemodel.find({ roles: 'teacher' }).lean();
        const exams = await Exam.find().populate('teacherId', 'name').lean(); // Populate teacher's name
        const totalUsers = await csemodel.countDocuments();
        const totalExams = await Exam.countDocuments();
        const totalSubmissions = await StudentScore.countDocuments(); // Assuming StudentScore tracks submissions
  
        let profileImage = null;
        if (user && user.profileImage && user.profileImage.data) {
          const imageData = user.profileImage.data.toString('base64');
          const imageContentType = user.profileImage.contentType;
          profileImage = `data:${imageContentType};base64,${imageData}`;
        }
  
        res.render('admin/adminview', {
          user: req.session.user,
          profileImage: profileImage,
          students: students,
          teachers: teachers,
          exams: exams,
          totalUsers: totalUsers,
          totalExams: totalExams,
          totalSubmissions: totalSubmissions,
          errorMessage: null,
        });
      } catch (error) {
        console.error("Error fetching data for admin dashboard:", error);
        res.render('admin/adminview', {
          user: req.session.user,
          profileImage: null,
          students: [],
          teachers: [],
          exams: [],
          totalUsers: 0,
          totalExams: 0,
          totalSubmissions: 0,
          errorMessage: 'Could not load dashboard information.',
        });
      }
    } else {
      res.redirect('/login.html');
    }
  });


  app.get('/admin/logs', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('admin')) {
      const logFilePath = path.join(__dirname, 'logs', 'access.log');
      try {
        const logs = await fs.readFile(logFilePath, 'utf8');
        const logLines = logs.split('\n').reverse();
        res.render('admin/logs', { user: req.session.user, logs: logLines });
      } catch (error) {
        console.error('Error reading log file:', error);
        res.render('admin/logs', { user: req.session.user, logs: [], error: 'Could not read log file.' });
      }
    } else {
      res.redirect('/login.html');
    }
  });