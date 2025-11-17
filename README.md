# LearnSign 🤟

<div align="center">
  <img src="public/assets/imgs/image.png" alt="LearnSign Logo" width="300"/>
  
  **Interactive AI-Powered Sign Language Learning Platform**
  
  *Empowering children with innovative sign language education*

  [![GitHub](https://img.shields.io/badge/GitHub-LearnSign-blue?logo=github)](https://github.com/amithkm9/LearnSign_pro)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-brightgreen?logo=node.js)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-5.0-green?logo=mongodb)](https://www.mongodb.com/)
  [![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange?logo=tensorflow)](https://www.tensorflow.org/)
</div>

---

## 📖 Table of Contents

- [About](#about)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Sign Recognition System](#sign-recognition-system)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🎯 About

**LearnSign** is a comprehensive, AI-powered platform designed to teach sign language to children ages 1-15+. The platform combines interactive video lessons, gamified learning experiences, real-time sign language recognition, and detailed progress tracking to make learning sign language engaging, effective, and accessible.

### Mission

To bridge communication gaps and empower deaf and hard-of-hearing children through innovative, accessible, and engaging sign language education.

### Vision

Create an inclusive world where every child can communicate effectively through sign language, breaking down barriers and fostering understanding.

---

## ✨ Features

### 🎓 **Comprehensive Course Catalog**

- **Age-Appropriate Learning Paths**
  - Early Learners (Ages 1-4): Foundational signs through play
  - Young Explorers (Ages 5-10): Vocabulary building and conversations
  - Advanced Learners (Ages 15+): Complex communication and cultural context

- **Structured Curriculum**
  - 50+ interactive lessons
  - Video demonstrations for every sign
  - Quizzes and assessments
  - Progress tracking per course

### 🤖 **AI-Powered Sign Recognition**

Our cutting-edge machine learning system provides:

- **Real-Time Recognition**
  - Live webcam-based sign detection
  - Instant feedback on sign accuracy
  - Support for 350+ common signs

- **Three Recognition Modes**
  1. **Alphabet Recognition**: Learn A-Z fingerspelling
  2. **Number Recognition**: Master numbers 0-9
  3. **Word Recognition**: Common words and phrases

- **Advanced ML Features**
  - MediaPipe hand landmark detection
  - LSTM neural network for sequence recognition
  - 95%+ accuracy on trained signs
  - Real-time pose estimation

### 📊 **Progress Tracking & Analytics**

- **Personalized Dashboard**
  - Overall learning progress percentage
  - Lessons completed counter
  - Total time spent learning
  - Last activity tracking

- **Visual Analytics**
  - Weekly activity charts
  - Progress by category (pie charts)
  - Achievement metrics
  - Performance trends

### 🎮 **Interactive Learning Experience**

- **Translator Tool**
  - Type any word to see its sign
  - Video demonstrations with loop functionality
  - Quick example phrases
  - Search through 350+ sign database

- **Gamification Elements**
  - Achievement badges
  - Streak tracking
  - Quiz challenges
  - Progress milestones

### 👨‍👩‍👧‍👦 **Community Features**

- **Inspiring Journeys**
  - Success stories from deaf achievers
  - Role models and inspiration
  - Real-world impact stories

- **User Testimonials**
  - Parent feedback
  - Teacher reviews
  - Student experiences

---

## 📸 Screenshots

### Home Page
<div align="center">
  <img src="docs/screenshots/home.png" alt="Home Page" width="800"/>
  <p><i>Beautiful landing page with mission statement and call-to-action</i></p>
</div>

### Dashboard & Progress Tracking
<div align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="800"/>
  <p><i>Comprehensive learning analytics and progress visualization</i></p>
</div>

### Sign Language Translator
<div align="center">
  <img src="docs/screenshots/translator.png" alt="Translator" width="800"/>
  <p><i>Real-time sign language recognition and demonstration</i></p>
</div>

### Course Catalog
<div align="center">
  <img src="docs/screenshots/courses.png" alt="Courses" width="800"/>
  <p><i>Age-appropriate learning paths with progress indicators</i></p>
</div>

### Community Section
<div align="center">
  <img src="docs/screenshots/community.png" alt="Community" width="800"/>
  <p><i>Inspiring stories from successful deaf individuals</i></p>
</div>

---

## 🛠 Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with responsive design
- **JavaScript (ES6+)** - Interactive features
- **EJS** - Server-side templating

### Backend
- **Node.js** (v18+) - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB

### Machine Learning & AI
- **Python 3.12** - ML runtime
- **TensorFlow 2.x** - Deep learning framework
- **Keras** - Neural network API
- **MediaPipe** - Hand tracking and pose estimation
- **OpenCV** - Computer vision processing
- **FastAPI** - Python API framework

### Authentication & Security
- **bcryptjs** - Password hashing
- **express-session** - Session management
- **CORS** - Cross-origin resource sharing

### Development Tools
- **Nodemon** - Auto-restart development server
- **Concurrently** - Run multiple processes
- **dotenv** - Environment variable management

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LearnSign Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Frontend   │         │   Backend    │                 │
│  │   (EJS)      │◄───────►│  (Express)   │                 │
│  │              │         │              │                 │
│  │  - Views     │         │  - REST APIs │                 │
│  │  - CSS       │         │  - Sessions  │                 │
│  │  - JS Client │         │  - Auth      │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                  │                          │
│                                  ▼                          │
│                          ┌──────────────┐                  │
│                          │   MongoDB    │                  │
│                          │              │                  │
│                          │  - Users     │                  │
│                          │  - Courses   │                  │
│                          │  - Progress  │                  │
│                          │  - Quizzes   │                  │
│                          └──────────────┘                  │
│                                                              │
│  ┌─────────────────────────────────────────────────┐      │
│  │         AI/ML Recognition Services               │      │
│  │              (Python + FastAPI)                  │      │
│  ├─────────────────────────────────────────────────┤      │
│  │                                                   │      │
│  │  ┌──────────────┐  ┌──────────────┐             │      │
│  │  │   MediaPipe  │  │  TensorFlow  │             │      │
│  │  │   Hand       │  │    LSTM      │             │      │
│  │  │   Tracking   │  │    Model     │             │      │
│  │  └──────┬───────┘  └──────┬───────┘             │      │
│  │         │                  │                      │      │
│  │         ▼                  ▼                      │      │
│  │  ┌────────────────────────────────┐             │      │
│  │  │   Sign Recognition Engine       │             │      │
│  │  │                                 │             │      │
│  │  │  1. Alphabet Recognition       │             │      │
│  │  │  2. Number Recognition         │             │      │
│  │  │  3. Word/Phrase Recognition    │             │      │
│  │  └────────────────────────────────┘             │      │
│  │                                                   │      │
│  └─────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 Sign Recognition System

### Overview

The LearnSign platform features a sophisticated, real-time sign language recognition system powered by advanced machine learning algorithms. This system is the core innovation that enables interactive learning and immediate feedback.

### Technical Architecture

#### 1. **Hand Tracking with MediaPipe**

```python
# Hand landmark detection
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5
)
```

**Features:**
- Detects 21 hand landmarks per hand
- Real-time tracking at 30+ FPS
- Robust to varying lighting conditions
- Works with single or both hands

**Landmarks Tracked:**
- Thumb (4 points)
- Index finger (4 points)
- Middle finger (4 points)
- Ring finger (4 points)
- Pinky (4 points)
- Palm (1 point)

#### 2. **Feature Extraction**

The system extracts and normalizes hand coordinates:

```python
def extract_features(landmarks):
    # Extract x, y, z coordinates
    features = []
    for landmark in landmarks:
        features.extend([landmark.x, landmark.y, landmark.z])
    
    # Normalize coordinates
    features = normalize(features)
    
    return np.array(features)
```

**Feature Vector:**
- 63 features per hand (21 landmarks × 3 coordinates)
- 126 features for two-hand signs
- Normalized to [0, 1] range
- Invariant to hand position and size

#### 3. **LSTM Neural Network**

```python
model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(sequence_length, num_features)),
    Dropout(0.3),
    LSTM(64, return_sequences=False),
    Dropout(0.3),
    Dense(64, activation='relu'),
    Dense(num_classes, activation='softmax')
])
```

**Model Architecture:**
- **Input Layer**: Sequence of hand landmarks over time
- **LSTM Layers**: Capture temporal patterns in sign movements
- **Dropout**: Prevents overfitting (30% dropout rate)
- **Dense Layers**: Final classification
- **Output**: Probability distribution over sign classes

**Training Details:**
- **Dataset**: 20+ samples per sign class
- **Sequence Length**: 30 frames
- **Training Epochs**: 50-100
- **Optimizer**: Adam (learning rate: 0.001)
- **Loss Function**: Categorical crossentropy
- **Accuracy**: 95%+ on validation set

#### 4. **Three Recognition Modules**

##### **A. Alphabet Recognition** (`/sign_recognition/numbers_letters_api.py`)

```python
# Trained on A-Z fingerspelling
classes = ['A', 'B', 'C', ..., 'Z']
model = load_model('models/sign_language_numbers_letters.h5')
```

- Static hand poses for each letter
- Real-time classification
- Visual feedback with predicted letter
- Confidence score display

##### **B. Number Recognition** (`/sign_recognition/numbers_letters_api.py`)

```python
# Trained on 0-9 number signs
classes = ['0', '1', '2', ..., '9']
```

- Single-hand and two-hand numbers
- Sequential number recognition
- Practice mode with target numbers

##### **C. Word/Phrase Recognition** (`/sign_recognition/translate_api.py`)

```python
# Trained on 350+ common words
classes = ['HELLO', 'THANK_YOU', 'PLEASE', 'YES', 'NO', ...]
```

- Dynamic sign sequences
- Context-aware recognition
- Phrase composition
- Real-world vocabulary

#### 5. **Real-Time Pipeline**

```javascript
// Client-side webcam capture
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    // Capture frame
    const frame = captureFrame(video);
    
    // Send to Python backend
    fetch('/recognize', {
      method: 'POST',
      body: JSON.stringify({ frame }),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
      // Display recognition result
      displayResult(data.sign, data.confidence);
    });
  });
```

**Processing Flow:**
1. **Capture**: Webcam captures video frame
2. **Send**: Frame sent to FastAPI backend
3. **Detect**: MediaPipe detects hand landmarks
4. **Extract**: Features extracted from landmarks
5. **Predict**: LSTM model predicts sign
6. **Return**: Result sent back to client
7. **Display**: Visual feedback shown to user

**Performance:**
- Latency: < 100ms per frame
- Throughput: 10-15 FPS
- Accuracy: 95%+ for trained signs
- CPU Usage: Moderate (optimized with TensorFlow Lite)

### Data Collection & Training

#### Training Data Structure

```
sign_recognition/training_data/
├── a/
│   ├── seq_0.npy
│   ├── seq_1.npy
│   └── ...
├── b/
│   ├── seq_0.npy
│   └── ...
├── hello/
├── thank_you/
└── ...
```

Each `.npy` file contains:
- 30 frames of hand landmark data
- Shape: (30, 63) for single hand
- Shape: (30, 126) for two hands

#### Data Collection Tool

```bash
# Collect training data for new signs
cd sign_recognition
python collect_gesture_data.py

# Follow prompts to record sequences
# Press 'Q' to start recording
# Press 'ESC' to stop
```

#### Training New Signs

```bash
# Train model on collected data
python train_gesture_model.py

# Model saved to models/sign_language_model.h5
```

### API Endpoints

#### **1. Alphabet/Number Recognition**

```http
POST http://localhost:8002/recognize
Content-Type: application/json

{
  "frame": "base64_encoded_image"
}

Response:
{
  "sign": "A",
  "confidence": 0.98,
  "landmarks": [...],
  "timestamp": "2025-01-17T10:30:00Z"
}
```

#### **2. Word/Phrase Recognition**

```http
POST http://localhost:8001/translate
Content-Type: application/json

{
  "sequence": [[...], [...], ...],  # 30 frames of landmarks
  "mode": "word"
}

Response:
{
  "recognized_sign": "HELLO",
  "confidence": 0.95,
  "alternatives": [
    {"sign": "HI", "confidence": 0.87},
    {"sign": "WELCOME", "confidence": 0.76}
  ]
}
```

### Future Enhancements

1. **Sentence Recognition**: Chain multiple signs together
2. **Grammar Support**: Add sign language grammar rules
3. **Facial Expression**: Incorporate facial features for emotion
4. **Two-Hand Coordination**: Better support for complex two-hand signs
5. **Regional Variations**: Support for different sign language dialects
6. **Continuous Recognition**: Real-time streaming without frame-by-frame
7. **Mobile Optimization**: TensorFlow Lite for mobile deployment

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MongoDB** (v5.0 or higher)
- **Python** (v3.12 or higher)
- **pip** (Python package manager)
- **Git**

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/amithkm9/LearnSign_pro.git
cd LearnSign_pro

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
cd sign_recognition
python -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate
pip install -r requirements.txt
cd ..

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 5. Start MongoDB
mongod --dbpath ./data/db

# 6. Seed the database
npm run seed

# 7. Start the application
npm run dev:full
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Python ML API**: http://localhost:8000-8002

---

## 📦 Installation

### Detailed Installation Steps

#### 1. **Clone the Repository**

```bash
git clone https://github.com/amithkm9/LearnSign_pro.git
cd LearnSign_pro
```

#### 2. **Install Node.js Dependencies**

```bash
npm install
```

This installs:
- express
- mongoose
- ejs
- bcryptjs
- express-session
- body-parser
- cors
- axios
- dotenv
- uuid

#### 3. **Set Up Python Environment**

```bash
cd sign_recognition

# Create virtual environment
python -m venv env

# Activate virtual environment
# On macOS/Linux:
source env/bin/activate

# On Windows:
env\Scripts\activate

# Install Python packages
pip install -r requirements.txt
```

Python packages installed:
- tensorflow
- keras
- opencv-python
- mediapipe
- numpy
- fastapi
- uvicorn
- python-multipart

#### 4. **Configure MongoDB**

**Option A: Local MongoDB**

```bash
# Install MongoDB Community Edition
# macOS:
brew tap mongodb/brew
brew install mongodb-community

# Ubuntu:
sudo apt-get install mongodb

# Start MongoDB
mongod --dbpath ./data/db
```

**Option B: MongoDB Atlas (Cloud)**

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Update `.env` file:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/learnsign
```

#### 5. **Environment Configuration**

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/learnsign
DB_NAME=learnsign

# Server
PORT=3000
NODE_ENV=development

# Session
SESSION_SECRET=your_random_secret_key_here

# API URLs
API_URL=http://localhost:4000
PYTHON_API_URL=http://localhost:8000
TRANSLATE_API_URL=http://localhost:8001
NUMBERS_LETTERS_API_URL=http://localhost:8002
```

#### 6. **Seed Database**

```bash
npm run seed
```

This creates:
- Sample users
- Course catalog
- Video lessons
- Quiz questions
- Learning packages

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/learnsign` |
| `DB_NAME` | Database name | `learnsign` |
| `PORT` | Main app port | `3000` |
| `API_PORT` | API server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |
| `SESSION_SECRET` | Session encryption key | Required |
| `PYTHON_API_URL` | ML API base URL | `http://localhost:8000` |

### Database Schema

#### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String (hashed),
  age: Number,
  createdAt: Date,
  lastLogin: Date
}
```

#### Courses Collection

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: String,
  ageGroup: String,
  difficulty: String,
  videos: [
    {
      title: String,
      url: String,
      duration: Number,
      order: Number
    }
  ],
  totalLessons: Number,
  estimatedTime: Number
}
```

#### UserProgress Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  courseId: ObjectId,
  completedLessons: [Number],
  quizScores: [
    {
      quizId: ObjectId,
      score: Number,
      completedAt: Date
    }
  ],
  progressPercentage: Number,
  lastAccessedAt: Date,
  totalTimeSpent: Number
}
```

---

## 💻 Usage

### Running the Application

#### Development Mode

```bash
# Run full stack (frontend + backend + Python services)
npm run dev:full

# Or run individually:
# Terminal 1: Main app
npm run dev

# Terminal 2: API server
npm run api:dev

# Terminal 3: Python ML services
cd sign_recognition
source env/bin/activate
uvicorn main:app --reload --port 8000
```

#### Production Mode

```bash
# Start all services
npm start

# Or use PM2 for process management
pm2 start ecosystem.config.js
```

### User Workflows

#### 1. **New User Registration**

1. Navigate to `/login`
2. Click "Sign Up"
3. Fill registration form
4. Automatically logged in
5. Redirected to dashboard

#### 2. **Browse & Enroll in Courses**

1. Go to `/courses`
2. Select age-appropriate course
3. Click "Start Learning"
4. Access video lessons
5. Complete quizzes

#### 3. **Use Sign Translator**

1. Navigate to `/translate`
2. Type a word (e.g., "hello")
3. Click "Show Sign Language"
4. Watch video demonstration
5. Loop video for practice

#### 4. **Practice with AI Recognition**

1. Go to `/translator` page
2. Enable webcam
3. Perform sign in front of camera
4. Receive instant feedback
5. See accuracy score

#### 5. **Track Progress**

1. Visit `/dashboard`
2. View overall progress
3. Check weekly activity
4. See achievements
5. Identify areas for improvement

---

## 📚 API Documentation

### REST API Endpoints

#### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

#### Courses

```http
GET    /api/courses
GET    /api/courses/:id
GET    /api/courses/category/:category
GET    /api/courses/age/:ageGroup
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id
```

#### User Progress

```http
GET  /api/progress/:userId
GET  /api/progress/:userId/:courseId
POST /api/progress/update
POST /api/progress/lesson-complete
GET  /api/progress/stats/:userId
```

#### Quizzes

```http
GET  /api/quizzes/:courseId
POST /api/quizzes/submit
GET  /api/quizzes/results/:userId
```

### Python ML API Endpoints

#### Sign Recognition

```http
POST /recognize
POST /translate
POST /validate-sign
GET  /supported-signs
GET  /model-info
```

---

## 🌐 Deployment

### Railway Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Railway deployment guide.

Quick steps:

```bash
# 1. Push to GitHub
git push origin main

# 2. Connect to Railway
# - Sign up at railway.app
# - Connect GitHub repository
# - Add environment variables
# - Deploy automatically

# 3. Add MongoDB
# - Add MongoDB plugin in Railway
# - Copy connection string to env vars

# 4. Deploy Python services
# - Create separate service for ML APIs
# - Set root directory to sign_recognition
# - Add start command
```

### Docker Deployment

```dockerfile
# Dockerfile provided
docker-compose up -d
```

---

## 📁 Project Structure

```
LearnSign/
├── config/
│   ├── config.js              # Application configuration
│   └── database.js            # MongoDB connection
├── models/
│   ├── User.js                # User schema
│   ├── Course.js              # Course schema
│   ├── UserProgress.js        # Progress tracking schema
│   ├── QuizAttempt.js         # Quiz results schema
│   └── LearningEvent.js       # Activity logging schema
├── views/
│   ├── partials/
│   │   ├── head.ejs
│   │   ├── header.ejs
│   │   └── footer.ejs
│   ├── home.ejs               # Landing page
│   ├── courses.ejs            # Course catalog
│   ├── dashboard.ejs          # User dashboard
│   ├── translate.ejs          # Sign translator
│   ├── about.ejs              # About page
│   └── community.ejs          # Community section
├── public/
│   ├── css/
│   │   ├── home.css
│   │   ├── dashboard.css
│   │   ├── courses.css
│   │   └── translate.css
│   ├── js/
│   │   ├── auth.js
│   │   ├── translate.js
│   │   ├── quiz.js
│   │   └── heartbeat.js
│   └── assets/
│       ├── imgs/              # Images and logo
│       └── videos/
│           ├── signs/         # 350+ sign videos
│           └── courses/       # Course videos
├── sign_recognition/
│   ├── models/
│   │   └── sign_language_numbers_letters.h5
│   ├── training_data/
│   │   ├── a/
│   │   ├── b/
│   │   └── .../
│   ├── main.py                # Primary ML API
│   ├── translate_api.py       # Translation service
│   ├── numbers_letters_api.py # Alphabet/numbers
│   ├── train.py               # Training script
│   ├── collect_data.py        # Data collection
│   └── requirements.txt       # Python dependencies
├── seeds/
│   └── seedData.js            # Database seeding
├── index.js                   # Main application
├── api.js                     # API server
├── package.json               # Node dependencies
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── DEPLOYMENT.md              # Deployment guide
└── README.md                  # This file
```

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### How to Contribute

1. **Fork the repository**

```bash
git clone https://github.com/YOUR_USERNAME/LearnSign_pro.git
```

2. **Create a feature branch**

```bash
git checkout -b feature/amazing-feature
```

3. **Make your changes**

4. **Commit with clear messages**

```bash
git commit -m "Add: New sign recognition feature"
```

5. **Push to your fork**

```bash
git push origin feature/amazing-feature
```

6. **Open a Pull Request**

### Contribution Guidelines

- Follow existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation
- Be respectful and collaborative

### Areas for Contribution

- 🎨 UI/UX improvements
- 🤖 ML model enhancements
- 🌍 Internationalization
- 📝 Documentation
- 🐛 Bug fixes
- ✨ New features
- 🧪 Testing

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 LearnSign Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 👥 Team

### Core Contributors

- **Amith KM** - Lead Developer & ML Engineer
- **Adarsh** - Backend Developer
- **Prajwal** - Frontend Developer
- **Bindu** - UI/UX Designer
- **Chandana** - Content Creator

---

## 📞 Contact

- **Email**: learnsign.support@gmail.com
- **Phone**: +91 7022955705
- **Website**: [Coming Soon]
- **GitHub**: [@amithkm9](https://github.com/amithkm9)
- **Issues**: [Report Issues](https://github.com/amithkm9/LearnSign_pro/issues)

---

## 🙏 Acknowledgments

- **MediaPipe Team** - Hand tracking technology
- **TensorFlow Team** - Deep learning framework
- **MongoDB** - Database platform
- **Express.js Community** - Web framework
- **All contributors** - For making this possible
- **Deaf community** - For inspiration and feedback

---

## 🗺 Roadmap

### Phase 1: Core Platform (✅ Completed)
- [x] User authentication system
- [x] Course catalog
- [x] Video lessons
- [x] Progress tracking
- [x] Basic sign translator

### Phase 2: AI Integration (✅ Completed)
- [x] Hand tracking with MediaPipe
- [x] LSTM model training
- [x] Real-time recognition
- [x] Alphabet recognition
- [x] Number recognition
- [x] Word recognition

### Phase 3: Enhanced Features (🚧 In Progress)
- [ ] Mobile responsive design
- [ ] Gamification enhancements
- [ ] Social features
- [ ] Parent dashboard
- [ ] Teacher portal

### Phase 4: Scaling (📋 Planned)
- [ ] Multi-language support
- [ ] Mobile apps (iOS/Android)
- [ ] Offline mode
- [ ] Advanced analytics
- [ ] API for third-party integration

### Phase 5: Innovation (🔮 Future)
- [ ] AR/VR integration
- [ ] Voice-to-sign translation
- [ ] Sign-to-voice translation
- [ ] AI chatbot tutor
- [ ] Community features

---

## 📊 Project Stats

- **Lines of Code**: ~30,000+
- **Sign Language Videos**: 350+
- **Courses**: 50+ lessons
- **Age Groups Supported**: 3 (1-4, 5-10, 15+)
- **ML Model Accuracy**: 95%+
- **API Endpoints**: 25+
- **Database Collections**: 7
- **Contributors**: 5+

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=amithkm9/LearnSign_pro&type=Date)](https://star-history.com/#amithkm9/LearnSign_pro&Date)

---

<div align="center">
  
  **Made with ❤️ for the deaf and hard-of-hearing community**
  
  *Breaking barriers, one sign at a time* 🤟
  
  [⬆ Back to Top](#learnsign-)
  
</div>

