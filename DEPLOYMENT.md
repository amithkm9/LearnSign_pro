# LearnSign - Railway Deployment Guide

## 📋 Prerequisites
- GitHub account
- Railway account (sign up at https://railway.app)
- MongoDB Atlas account (free tier: https://www.mongodb.com/cloud/atlas)

---

## 🚀 Step-by-Step Deployment

### **Step 1: Prepare Your Code**

1. Make sure all your changes are committed to Git:
```bash
cd /Users/amithkm/Desktop/LearnSign
git init  # if not already a git repo
git add .
git commit -m "Prepare for Railway deployment"
```

2. Create a GitHub repository and push your code:
```bash
# Create a new repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/LearnSign.git
git branch -M main
git push -u origin main
```

---

### **Step 2: Set Up MongoDB Atlas (Free Database)**

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up/Login
3. Create a **FREE** cluster:
   - Click "Build a Database"
   - Select **FREE** (M0) tier
   - Choose a cloud provider (AWS recommended)
   - Select a region close to you
   - Click "Create Cluster"

4. Create a database user:
   - Go to "Database Access" in left sidebar
   - Click "Add New Database User"
   - Create username & strong password (SAVE THESE!)
   - Grant "Read and write to any database"

5. Whitelist all IPs (for Railway):
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Confirm

6. Get your connection string:
   - Go to "Database" → Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - It looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`
   - Replace `<username>` and `<password>` with your actual credentials
   - Add `/learnsign` at the end

---

### **Step 3: Deploy to Railway**

#### **Deploy Node.js App (Frontend + Backend)**

1. Go to https://railway.app
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your `LearnSign` repository
6. Railway will automatically detect it's a Node.js app

7. **Add Environment Variables:**
   - Click on your deployment
   - Go to "Variables" tab
   - Add these variables:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/learnsign
DB_NAME=learnsign
SESSION_SECRET=your_random_secret_here_12345
NODE_ENV=production
PORT=3000
API_PORT=4000
```

8. **Generate Domain:**
   - Go to "Settings" tab
   - Click "Generate Domain"
   - Copy your Railway URL (e.g., `learnsign.up.railway.app`)

9. Wait for deployment to complete (2-5 minutes)

---

### **Step 4: Deploy Python ML Service (Optional but Recommended)**

You have 3 Python services. Let's deploy them:

#### **Option A: Deploy as Separate Railway Service**

1. In Railway dashboard, click "New"
2. Select "Empty Service"
3. Click "+ New" → "GitHub Repo" → Select LearnSign again
4. Click "Settings" → "Root Directory" → Set to `sign_recognition`
5. Add these variables:
```bash
PORT=8000
```
6. In Settings → "Start Command", set:
```bash
pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port $PORT
```

7. Generate domain for Python service
8. Copy the URL and add to your main Node.js service variables:
```bash
PYTHON_API_URL=https://your-python-service.up.railway.app
```

#### **Option B: Deploy All Python Services**
Repeat above for each service:
- `main.py` → PYTHON_API_URL
- `translate_api.py` → TRANSLATE_API_URL
- `numbers_letters_api.py` → NUMBERS_LETTERS_API_URL

---

### **Step 5: Update Environment Variables**

Go back to your main Node.js service and update:

```bash
API_URL=https://your-app-url.up.railway.app
PYTHON_API_URL=https://your-python-service.up.railway.app
TRANSLATE_API_URL=https://your-translate-service.up.railway.app
NUMBERS_LETTERS_API_URL=https://your-numbers-service.up.railway.app
```

---

### **Step 6: Seed Database (First Time Only)**

1. Go to Railway dashboard
2. Click on your main service
3. Go to "Deployments" tab
4. Click on the three dots → "View Logs"
5. Once deployed, you might need to manually seed:

**Option: Use Railway CLI**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run seed command
railway run npm run seed
```

---

## ✅ Verification

Your app should be live! Test:

1. **Main App**: `https://your-app.up.railway.app`
2. **API**: `https://your-app.up.railway.app/api/health`
3. Check all features work:
   - Sign up/Login
   - Courses
   - Translator
   - Dashboard

---

## 🎯 Final Architecture

```
┌─────────────────────────────────────┐
│     Railway Project: LearnSign      │
├─────────────────────────────────────┤
│                                     │
│  Service 1: Node.js App (Main)      │
│  ├── Frontend (EJS views)           │
│  ├── Backend API (Express)          │
│  └── Port: 3000, 4000               │
│                                     │
│  Service 2: Python ML (Optional)    │
│  ├── Sign Recognition               │
│  └── Port: 8000                     │
│                                     │
│  Service 3: Python Translate        │
│  └── Port: 8001                     │
│                                     │
│  Service 4: Python Numbers/Letters  │
│  └── Port: 8002                     │
│                                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│    MongoDB Atlas (Database)         │
│    Free Tier: 512MB                 │
└─────────────────────────────────────┘
```

---

## 💰 Cost Estimate

- **Railway Free Tier**: $5 credit/month (enough for 1-2 small services)
- **Paid Plan**: $5/month per service after free credits
- **MongoDB Atlas**: FREE forever (M0 tier)

**Total for Full Stack**: ~$10-20/month after free credits

---

## 🔧 Troubleshooting

### App won't start:
- Check logs in Railway dashboard
- Verify all environment variables are set
- Check MongoDB connection string is correct

### Database connection error:
- Verify MongoDB Atlas IP whitelist includes 0.0.0.0/0
- Check username/password are correct
- Ensure connection string includes `/learnsign` at end

### Python service errors:
- Verify requirements.txt is in sign_recognition folder
- Check start command is correct
- Ensure models folder is included in repo

---

## 🔄 Continuous Deployment

Railway auto-deploys when you push to GitHub:

```bash
git add .
git commit -m "Update features"
git push origin main
```

Railway will automatically deploy the new version!

---

## 📚 Additional Resources

- Railway Docs: https://docs.railway.app
- MongoDB Atlas: https://docs.atlas.mongodb.com
- Railway Discord: https://discord.gg/railway

---

## 🎉 That's It!

Your LearnSign app is now live and accessible worldwide!

Need help? Check Railway logs or ask in their Discord community.

