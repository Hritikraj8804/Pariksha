const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pug = require('pug');
const path = require('path');
const dev = require('dotenv').config();
const app = express();
const fs = require('fs').promises; // Use promises for cleaner async/await
const fileUpload = require('express-fileupload'); // Middleware for handling file uploads

app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use(express.urlencoded({ extended: true }));
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
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('student/studentview', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('student/studentview', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('student/studentview', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
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
        const examId = parseInt(req.params.examId); // PARSE TO INTEGER
        console.log("examId in /student/start-test:", examId); // LOG THE VALUE

        try {
            const questions = await Question.find({ examId: examId }); // USE THE PARSED INTEGER
            const exam = await Exam.findOne({ examId: examId }).select('title');
            const user = await csemodel.findById(req.session.user._id);
            
            if (!exam) {
                return res.status(404).send('Exam not found.');
            }

            if (questions.length > 0 ) {
                res.render('student/start-exam', { user: req.session.user, examId : req.params.examId, exam: exam, questions: questions });
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

        try {
            const correctQuestions = await Question.find({ examId: examId }).select('questionId correctOption');

            let score = 0;
            if (submittedAnswers && correctQuestions.length > 0) {
                submittedAnswers.forEach(submittedAnswer => {
                    const correctAnswerObject = correctQuestions.find(q => q.questionId === parseInt(submittedAnswer.questionId));
                    if (correctAnswerObject && parseInt(submittedAnswer.selectedOption) === correctAnswerObject.correctOption) {
                        score++;
                    }
                });

                // Create a new StudentScore document
                const studentScore = new StudentScore({
                    studentId: studentId,
                    examId: examId,
                    score: score
                });

                await studentScore.save();

                // Optionally, you might still want to save to the 'results' collection
                // const result = new Result({ ... });
                // await result.save();

                res.redirect(`/student/results/${studentScore._id}`); // Redirect to a results page based on the StudentScore
            } else {
                res.send('No submitted answers or questions found for this exam.');
            }

        } catch (error) {
            console.error("Error submitting test and saving score:", error);
            res.status(500).send('Error submitting the test and saving the score.');
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/student/results/:resultId', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        const resultId = req.params.resultId;

        try {
            const studentResult = await StudentScore.findById(resultId);
            const user = await csemodel.findById(req.session.user._id);
            // If you are using the 'Result' model, change 'StudentScore' to 'Result'

            if (!studentResult) {
                return res.status(404).send('Result not found.');
            }

            // Now, fetch the Exam using the examId stored in the studentResult
            const exam = await Exam.findOne({ examId: studentResult.examId }).select('title');

            if (!exam) {
                console.error(`Exam with examId ${studentResult.examId} not found.`);
                // Optionally handle this error, maybe display a generic exam title
            }
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('student/results', { user: req.session.user, result: studentResult, exam: exam, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('student/results', { user: req.session.user,  result: studentResult, exam: exam,profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching student result:", error);
            res.status(500).send('Error fetching the result.');
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/student/leaderboard', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('student/leaderboard', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('student/leaderboard', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('student/leaderboard', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        } 
    } else {
        res.redirect('/login.html');
    }
});

app.get('/student/performance', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('student/performance', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('student/performance', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('student/performance', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
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
                        correctOption: parseInt(questionData.correctOption)
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

app.get('/teacher/results', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('teacher/viewresults', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('teacher/viewresults', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('teacher/viewresults', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        }
    } else {
        res.redirect('/login.html');
    }
});


app.get('/admin/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('admin')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('admin/adminview', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('admin/adminview', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('admin/adminview', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        }
    } else {
        res.redirect('/login.html');
    }
});