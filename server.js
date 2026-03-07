// Imports and setup
const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const bcrypt = require('bcrypt');
const passport = require('passport'); 
const GoogleStrategy = require('passport-google-oauth20').Strategy; 
require('dotenv').config();

const app = express();
const port = 3000;

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'adrialogic-secret-key', // Updated for your new brand
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// GOOGLE OAUTH - Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback: true 
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
        const userId = req.session.user.id;
        await pool.query(
            'UPDATE users SET google_id = $1, google_refresh_token = $2 WHERE id = $3',
            [profile.id, refreshToken, userId]
        );
        return done(null, profile);
    } catch (err) {
        return done(err);
    }
  }
));

// Authentication check
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/');
}

// Initialize Google AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel(
    { model: "gemini-2.5-flash" }, 
    { apiVersion: "v1" } 
);

// Page routes
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/reviews-page', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reviews.html'));
});

app.get('/settings', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// GOOGLE OAUTH - Auth Routes
app.get('/auth/google', isAuthenticated, (req, res, next) => {
    passport.authenticate('google', { 
        scope: [
            'profile', 
            'email', 
            'https://www.googleapis.com/auth/business.manage' 
        ],
        accessType: 'offline', 
        prompt: 'consent'      
    })(req, res, next);
});

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/settings' }),
    (req, res) => {
        res.redirect('/settings?status=google_connected');
    }
);

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
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

// API routes
app.get('/api/user-data', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT restaurant_name, owner_name, email, cuisine_type, vibe, usp, google_refresh_token FROM users WHERE id = $1', 
            [req.session.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

app.post('/api/update-settings', isAuthenticated, async (req, res) => {
    const { restaurant_name, owner_name, email, cuisine_type, vibe, usp } = req.body;
    try {
        await pool.query(
            'UPDATE users SET restaurant_name=$1, owner_name=$2, email=$3, cuisine_type=$4, vibe=$5, usp=$6 WHERE id=$7',
            [restaurant_name, owner_name, email, cuisine_type, vibe, usp, req.session.user.id]
        );
        Object.assign(req.session.user, req.body);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send("Update Error");
    }
});

// AI generation route
app.post('/generate-review-reply', isAuthenticated, async (req, res) => {
    const { customerReview, starRating } = req.body;
    const { owner_name, restaurant_name, cuisine_type, vibe, usp } = req.session.user;

    try {
        // Optimized prompt for AdriaLogic branding
        const prompt = `You are ${owner_name || 'the manager'} at ${restaurant_name || 'AdriaLogic'}. 
                        We are a ${cuisine_type || 'service-oriented brand'} known for ${usp || 'quality'}. 
                        Our tone is ${vibe || 'professional'}. 
                        Draft a polite, brand-consistent reply to this ${starRating}-star review: "${customerReview}"`;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        res.json({ success: true, draft: responseText });
    } catch (error) {
        console.error("AI Error Details:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));