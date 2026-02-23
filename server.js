const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config();

const bcrypt = require('bcrypt');
const saltRounds = 10; // The "strength" of the hashing

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

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next(); // They are logged in! Proceed to the next function.
    }
    res.redirect('/'); // Not logged in? Send them back to the login page (index.html).
}

// 3. Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 4. Auth Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            // This compares the plain text input to the hashed password in the DB
            const match = await bcrypt.compare(password, user.password_hash);
            
            if (match) {
                req.session.user = user; 
                return res.json({ success: true });
            }
        }
        res.status(401).json({ success: false, message: "Invalid credentials" });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 5. AI Generation Route (Now uses Database Info)
app.post('/generate-review-reply', async (req, res) => {
    console.log("Current Session User:", req.session.user); // Check if this is undefined!
    
    if (!req.session.user) {
        console.log("Access denied: No session found");
        return res.status(401).json({ success: false });
    }
    const { customerReview, starRating } = req.body;
    const { owner_name, restaurant_name, cuisine_type, vibe, usp } = req.session.user;

    try {
        const prompt = `
            You are ${owner_name}, the owner of ${restaurant_name}. 
            We are a ${vibe} ${cuisine_type} business known for ${usp}. 
            
            Write a professional reply to this ${starRating}-star review: "${customerReview}"
            If it's 3 stars or less, be apologetic. If 4+, be thankful.
        `;
        
        const result = await model.generateContent(prompt);
        res.json({ success: true, draft: result.response.text() });
    } catch (error) {
        console.error("DETAILED SERVER ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Inside server.js
app.get('/api/user-data', isAuthenticated, (req, res) => {
    if (req.session.user) {
        // Double check your DB column name! Is it 'restaurant_name'?
        res.json({ 
            restaurant_name: req.session.user.restaurant_name 
        });
    } else {
        res.status(401).json({ error: "Not authenticated" });
    }
});

// The Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Error destroying session:", err);
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid'); // Clears the session cookie from the browser
        res.redirect('/'); // Sends them back to the login page
    });
});

// 6. The Protected Dashboard Routes

// This is the dashboard's homepage
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// This is the reviews page
app.get('/reviews-page', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reviews.html'));
});

app.listen(port, () => console.log(`✅ Server at http://localhost:${port}`));