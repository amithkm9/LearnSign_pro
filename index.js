import 'dotenv/config';
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "http://localhost:4000";
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000"; // FastAPI backend for sign language recognition
const TRANSLATE_API_URL = process.env.TRANSLATE_API_URL || "http://localhost:8001"; // FastAPI backend for sign language translation
const NUMBERS_LETTERS_API_URL = process.env.NUMBERS_LETTERS_API_URL || "http://localhost:8002"; // FastAPI backend for numbers and letters recognition

// Middleware setup
app.use(cors());
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'edusign_super_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Increase the body size limit for JSON and URL-encoded data
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Set template engine
app.set('view engine', 'ejs');

app.get("/", (req, res) => {
    res.render('home.ejs');
});



app.get("/tutorials", (req, res) => {
    res.render("tutorials.ejs");
});

// Dashboard route - show after login
app.get("/dashboard", async (req, res) => {
    try {
        // Get all course categories and combo packages
        const [categoriesResponse, packagesResponse] = await Promise.all([
            axios.get(`${API_URL}/categories`),
            axios.get(`${API_URL}/packages`)
        ]);
        
        res.render("dashboard.ejs", {
            categories: categoriesResponse.data,
            packages: packagesResponse.data,
            user: req.session?.user || null // Will implement session later
        });
    } catch (error) {
        console.error("Error loading dashboard:", error.message);
        res.render("dashboard.ejs", {
            categories: [],
            packages: [],
            user: null
        });
    }
});

// Course catalog route
app.get("/courses", async (req, res) => {
    try {
        const categoriesResponse = await axios.get(`${API_URL}/categories`);
        res.render("courses.ejs", {
            categories: categoriesResponse.data
        });
    } catch (error) {
        console.error("Error loading courses:", error.message);
        res.render("courses.ejs", {
            categories: []
        });
    }
});

// Course category route
app.get("/courses/:ageGroup", async (req, res) => {
    try {
        const ageGroup = req.params.ageGroup;
        const response = await axios.get(`${API_URL}/courses/${ageGroup}`);
        res.render("course-category.ejs", {
            data: response.data,
            ageGroup: ageGroup
        });
    } catch (error) {
        console.error("Error loading course category:", error.message);
        res.render("course-category.ejs", {
            data: null,
            ageGroup: req.params.ageGroup
        });
    }
});

// Packages route
app.get("/packages", async (req, res) => {
    try {
        const response = await axios.get(`${API_URL}/packages`);
        res.render("packages.ejs", {
            packages: response.data
        });
    } catch (error) {
        console.error("Error loading packages:", error.message);
        res.render("packages.ejs", {
            packages: []
        });
    }
});

app.get("/translate", (req, res) => {
    res.render("translate.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

// Quiz routes
app.get("/quiz", (req, res) => {
    res.render("quiz.ejs");
});

app.get("/about",(req,res)=>{
    res.render("about.ejs");
});

app.get("/community",(req,res)=>{
    res.render("community.ejs");
});

// Translation routes
app.get("/translate", (req, res) => {
    res.render("translate.ejs");
});

// New route for numbers and letters recognition
app.get("/numbers-letters", (req, res) => {
    res.render("numbers-letters.ejs");
});

// API endpoint to proxy requests to the Python backend for quiz
app.post("/api/quiz", async (req, res) => {
    try {
        // Forward the request to the Python backend
        const response = await axios.post(`${PYTHON_API_URL}/api/quiz`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        // Return the Python backend's response
        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding to Python backend:", error.message);
        res.status(500).json({
            error: "Failed to process sign language recognition",
            details: error.message
        });
    }
});

// API endpoint to proxy requests to the Python backend for translation
app.post("/api/translate", async (req, res) => {
    try {
        // Forward the request to the Translation API backend
        const response = await axios.post(`${TRANSLATE_API_URL}/api/translate`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        // Return the Translation API's response
        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding to Translation API:", error.message);
        res.status(500).json({
            error: "Failed to process sign language translation",
            details: error.message
        });
    }
});

// ========== AUTHENTICATION ENDPOINTS ==========

// Login endpoint
app.post("/api/auth/login", async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Login failed",
            error: error.message
        });
    }
});

// Register endpoint
app.post("/api/auth/register", async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/auth/register`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Registration error:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Registration failed",
            error: error.message
        });
    }
});

// API endpoint to proxy requests to the Python backend for numbers and letters recognition
app.post("/api/recognize", async (req, res) => {
    try {
        // Forward the request to the Numbers & Letters Recognition API
        const response = await axios.post(`${NUMBERS_LETTERS_API_URL}/api/recognize`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        // Return the Recognition API's response
        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding to Recognition API:", error.message);
        res.status(500).json({
            error: "Failed to process numbers and letters recognition",
            details: error.message
        });
    }
});

// ========== PROGRESS TRACKING API PROXIES ==========

// Learning events endpoint
app.post("/api/learning/events", async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/learning/events`, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding learning event:", error.message);
        res.status(500).json({ error: "Failed to record learning event" });
    }
});

// Quiz attempts endpoint
app.post("/api/quizzes/:courseId/:quizId/attempts", async (req, res) => {
    try {
        const { courseId, quizId } = req.params;
        const response = await axios.post(`${API_URL}/quizzes/${courseId}/${quizId}/attempts`, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error forwarding quiz attempt:", error.message);
        res.status(500).json({ error: "Failed to record quiz attempt" });
    }
});

// Analytics summary endpoint
app.get("/api/analytics/summary/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const response = await axios.get(`${API_URL}/analytics/summary/${userId}`);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching analytics:", error.message);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// Admin learning events endpoint
app.get("/api/admin/learning-events/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const response = await axios.get(`${API_URL}/admin/learning-events/${userId}`);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching learning events:", error.message);
        res.status(500).json({ error: "Failed to fetch learning events" });
    }
});

// Existing routes for tutorials
app.get("/tutorials/basics", async (req, res) => {
    try {
        // By default, load the Introduction video (001)
        const response = await axios.get(`${API_URL}/videolib/001`);
        res.render("basics.ejs", {
            videos: response.data
        });
    } catch (error) {
        console.error("Error fetching default video:", error.message);
        res.render("basics.ejs", {
            videos: null
        });
    }
});

app.get("/tutorials/basics/:id", async (req,res) => {
    const videoId = req.params.id;
    try {
        const response = await axios.get(`${API_URL}/videolib/${videoId}`);
        
        // Check if this is an AJAX request (looks for XHR header or accepts JSON)
        const isAjaxRequest = req.xhr || req.headers.accept.indexOf('json') > -1;
        
        if (isAjaxRequest) {
            // Return JSON for AJAX requests
            res.json({
                videos: response.data
            });
        } else {
            // Return full page for direct access
            res.render("basics.ejs", {
                videos: response.data
            });
        }
    } catch(error) {
        console.error("Error fetching video:", error.message);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({message: "Error fetching the video"});
        } else {
            res.status(500).render("error.ejs", {message: "Error fetching the video"});
        }
    }
});

app.get("/tutorials/family-signs", async (req, res) => {
    try {
        // By default, load the Family Signs video (004)
        const response = await axios.get(`${API_URL}/videolib/004`);
        res.render("family-signs.ejs", {
            videos: response.data
        });
    } catch (error) {
        console.error("Error fetching default video:", error.message);
        res.render("family-signs.ejs", {
            videos: null
        });
    }
});

app.get("/tutorials/family-signs/:id", async (req, res) => {
    const videoId = req.params.id;
    try {
        const response = await axios.get(`${API_URL}/videolib/${videoId}`);
        
        // Check if this is an AJAX request
        const isAjaxRequest = req.xhr || req.headers.accept.indexOf('json') > -1;
        
        if (isAjaxRequest) {
            // Return JSON for AJAX requests
            res.json({
                videos: response.data
            });
        } else {
            // Return full page for direct access
            res.render("family-signs.ejs", {
                videos: response.data
            });
        }
    } catch(error) {
        console.error("Error fetching video:", error.message);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({message: "Error fetching the video"});
        } else {
            res.status(500).render("error.ejs", {message: "Error fetching the video"});
        }
    }
});

app.get("/tutorials/emotions-expressions", async (req, res) => {
    try {
        // By default, load the Emotions Introduction video (007)
        const response = await axios.get(`${API_URL}/videolib/005`);
        res.render("emotions-expressions.ejs", {
            videos: response.data
        });
    } catch (error) {
        console.error("Error fetching default video:", error.message);
        res.render("emotions-expressions.ejs", {
            videos: null
        });
    }
});

app.get("/tutorials/emotions-expressions/:id", async (req, res) => {
    const videoId = req.params.id;
    try {
        const response = await axios.get(`${API_URL}/videolib/${videoId}`);
        
        // Check if this is an AJAX request
        const isAjaxRequest = req.xhr || req.headers.accept.indexOf('json') > -1;
        
        if (isAjaxRequest) {
            // Return JSON for AJAX requests
            res.json({
                videos: response.data
            });
        } else {
            // Return full page for direct access
            res.render("emotions-expressions.ejs", {
                videos: response.data
            });
        }
    } catch(error) {
        console.error("Error fetching video:", error.message);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({message: "Error fetching the video"});
        } else {
            res.status(500).render("error.ejs", {message: "Error fetching the video"});
        }
    }
});

// Add Quiz Endpoints
app.get("/tutorials/quiz", (req, res) => {
    res.render("quiz.ejs");
});

app.get("/tutorials/quiz/:category", (req, res) => {
    const category = req.params.category;
    res.render("quiz.ejs", { category: category });
});

// ========== SPEECH TRANSLATION ENDPOINTS ==========

// Speech translation endpoint
app.post("/api/speech/translate", async (req, res) => {
    try {
        const { text, source_lang, target_lang } = req.body;
        
        // Use the existing translate API endpoint
        const response = await axios.post(`${API_URL}/translate`, {
            text: text,
            source_lang: source_lang || 'en',
            target_lang: target_lang || 'en'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error("Speech translation error:", error.message);
        res.status(500).json({
            error: "Failed to translate speech",
            details: error.message
        });
    }
});

// Summarization endpoint
app.post("/api/speech/summarize", async (req, res) => {
    try {
        const { text } = req.body;
        
        // Use the existing summarize API endpoint
        const response = await axios.post(`${API_URL}/summarize`, {
            text: text
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error("Summarization error:", error.message);
        res.status(500).json({
            error: "Failed to summarize text",
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log("Server listening on port " + port);
});