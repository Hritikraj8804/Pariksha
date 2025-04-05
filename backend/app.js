const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pug = require('pug');
const path = require('path');
const dev = require('dotenv').config(); 
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 
app.set('view engine', 'pug'); 
app.set('views', path.join(__dirname, 'views'));

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
        }
    }, { versionKey: false });    

let csemodel = mongoose.model('project', cseschema, 'projectdatabase');

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});

app.get('/home', (req, res) => { 
    res.sendFile(path.join(__dirname, 'public/home.html'));
});

app.post('/post', async (req, res) => {
    try {
        const { id, username, name, password, email, mobile, roles } = req.body; 
        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = { _id: id, username: username, name: name, password: hashedPassword, email: email, mobile: mobile, roles: roles };
        const m = new csemodel(userData);
        await m.save();
        res.sendFile(path.join(__dirname, '/public/login.html'));
    } catch (err) {
        if (err.username === 'ValidationError') {
            if (err.errors && err.errors.username && err.errors.username.kind === 'unique') {
                return res.status(400).json({ error: "This username is already taken. Please choose a different one." });
            }
            return res.status(400).json({ error: "Username is to short username should be of 3 character and more" });
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
                req.session.user = { _id: user._id, username: user.username, roles: user.roles };
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


app.get('/student/dashboard', (req, res) => {
    if (req.session.user && req.session.user.roles.includes('student')) {
        res.sendFile(path.join(__dirname, '/public/studentview.html'));
    } else {
        res.redirect('/login.html');
    }
});

app.get('/teacher/dashboard', (req, res) => {
    if (req.session.user && req.session.user.roles.includes('teacher')) {
        res.sendFile(path.join(__dirname, '/public/teacherview.html'));
    } else {
        res.redirect('/login.html');
    }
});

app.get('/admin/dashboard', (req, res) => {
    if (req.session.user && req.session.user.roles.includes('admin')) {
        res.sendFile(path.join(__dirname, '/public/adminview.html'));
    } else {
        res.redirect('/login.html');
    }
});

