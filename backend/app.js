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

app.get('/student/tests', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('student/tests', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('student/tests', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('student/tests', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
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

app.get('/teacher/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('teacher/teacherview', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('teacher/teacherview', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('teacher/teacherview', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/teacher/courses', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('teacher/mycourses', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('teacher/mycourses', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('teacher/mycourses', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/teacher/exams/create', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('teacher/createexam', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('teacher/createexam', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('teacher/createexam', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        }
    } else {
        res.redirect('/login.html');
    }
});

app.get('/teacher/questions', async(req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        try {
            const user = await csemodel.findById(req.session.user._id);
            if (user && user.profileImage && user.profileImage.data) {
                const imageData = user.profileImage.data.toString('base64');
                const imageContentType = user.profileImage.contentType;
                res.render('teacher/managequestions', { user: req.session.user, profileImage: `data:${imageContentType};base64,${imageData}` });
            } else {
                res.render('teacher/managequestions', { user: req.session.user, profileImage: null });
            }
        } catch (error) {
            console.error("Error fetching user data for dashboard:", error);
            res.render('teacher/managequestions', { user: req.session.user, profileImage: null, errorMessage: 'Could not load profile information.' });
        }
    } else {
        res.redirect('/login.html');
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