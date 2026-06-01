# UrbanFitz OMS — Deployment Guide

## What This Is
A complete Order Management System for UrbanFitz Clothings.
- Node.js + Express backend
- SQLite database (orders saved permanently)
- Real PDF invoice download
- Mobile-optimized frontend
- Login: admin@urbanfitz.ng / admin123

---

## DEPLOY TO RAILWAY (Free, 5 minutes)

### Step 1 — Create a GitHub account (if you don't have one)
Go to: https://github.com → Sign up (free)

### Step 2 — Upload your code to GitHub
1. Go to https://github.com/new
2. Repository name: `urbanfitz-oms`
3. Set to **Private**
4. Click **Create repository**
5. Click **uploading an existing file**
6. Drag and drop ALL the files from this folder
7. Click **Commit changes**

### Step 3 — Deploy on Railway
1. Go to: https://railway.app
2. Click **Sign in with GitHub**
3. Click **New Project**
4. Click **Deploy from GitHub repo**
5. Select your `urbanfitz-oms` repository
6. Railway will auto-detect Node.js and deploy it
7. Click **Generate Domain**
8. You get a URL like: `https://urbanfitz-oms.up.railway.app`

### Step 4 — Open on your phone
- Visit your Railway URL in Safari
- Tap **Share → Add to Home Screen**
- It works like a real app!

---

## CHANGE YOUR PASSWORD
After logging in, the default password is: **admin123**
To change it, call the API:
POST /api/change-password
{ "currentPassword": "admin123", "newPassword": "yournewpassword" }

---

## RUN LOCALLY (optional)
```bash
npm install
npm start
# Open http://localhost:3000
```

---

## FEATURES
- ✅ Login / Logout
- ✅ Dashboard with stats
- ✅ Create / Edit / Delete orders
- ✅ Search and filter orders
- ✅ Customer database
- ✅ PDF Invoice download (real PDF!)
- ✅ Orders saved permanently in SQLite
- ✅ Mobile-optimized UI

---

## SUPPORT
Business: UrbanFitz Clothings
Location: 3 Ajibode Street, Yaba, Lagos
Phone: 07038245181
