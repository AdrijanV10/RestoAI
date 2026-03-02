// Imports and Setup
const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = 3000;

// 1. Database Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// 2. Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'resto-ai-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// 3. Authentication
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        // User is logged in
        return next();
    }
    // Not logged in, send to home page
    res.redirect('/');
}

// 4. Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 5. Page routes to html files
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/reviews-page', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reviews.html'));
});

app.get('/settings', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// 6. Auth Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                req.session.user = user; // Stores the whole user object in session
                return res.json({ success: true });
            }
        }
        res.status(401).json({ success: false, message: "Invalid credentials" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 7. API Routes

// GET Route
app.get('/api/user-data', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT restaurant_name, owner_name, email, cuisine_type, vibe, usp FROM users WHERE id = $1', 
            [req.session.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

// POST Route
app.post('/api/update-settings', isAuthenticated, async (req, res) => {
    const { restaurant_name, owner_name, email, cuisine_type, vibe, usp } = req.body;
    try {
        await pool.query(
            'UPDATE users SET restaurant_name=$1, owner_name=$2, email=$3, cuisine_type=$4, vibe=$5, usp=$6 WHERE id=$7',
            [restaurant_name, owner_name, email, cuisine_type, vibe, usp, req.session.user.id]
        );
        
        // Update session so AI prompt is fresh
        Object.assign(req.session.user, req.body);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send("Update Error");
    }
});

// AI Generation route
app.post('/generate-review-reply', isAuthenticated, async (req, res) => {
    const { customerReview, starRating } = req.body;
    // Pulls latest info from session
    const { owner_name, restaurant_name } = req.session.user;

    try {
        const prompt = `You are ${owner_name}, the owner of ${restaurant_name}. 
                        Write a professional ${starRating}-star reply to: "${customerReview}"`;
        
        const result = await model.generateContent(prompt);
        res.json({ success: true, draft: result.response.text() });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

// Start Server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));