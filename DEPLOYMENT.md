# 🚀 Vercel Deployment Guide

## **Prerequisites**
- Vercel account (free tier works)
- All environment variables configured
- Git repository with your code

## **Step 1: Environment Variables Setup**

In your Vercel dashboard, go to **Settings > Environment Variables** and add:

### **Required:**
```
OPENAI_API_KEY=your_openai_api_key_here
```

### **Optional (for job search):**
```
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_API_KEY=your_adzuna_api_key
THEMUSE_API_KEY=your_themuse_api_key
REED_API_KEY=your_reed_api_key
RAPIDAPI_KEY=your_rapidapi_key
```

## **Step 2: Deploy to Vercel**

### **Option A: Vercel CLI (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: ai-job-matcher
# - Directory: ./ (current directory)
# - Override settings? No
```

### **Option B: GitHub Integration**
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables
6. Deploy

## **Step 3: Verify Deployment**

After deployment, test these endpoints:

### **Health Check:**
```
GET https://your-app.vercel.app/api/health
```

### **Frontend:**
```
GET https://your-app.vercel.app/
```

## **Step 4: Troubleshooting**

### **404 Errors:**
- ✅ Check `vercel.json` configuration
- ✅ Ensure `api/index.js` exists
- ✅ Verify environment variables are set

### **Timeout Errors:**
- ✅ Function timeout is set to 300 seconds (5 minutes)
- ✅ Job search should complete within this time

### **Environment Variable Issues:**
- ✅ All variables must be set in Vercel dashboard
- ✅ No local `.env` files in production
- ✅ Check variable names match exactly

## **Step 5: Custom Domain (Optional)**

1. Go to Vercel dashboard
2. Select your project
3. Go to **Settings > Domains**
4. Add your custom domain
5. Configure DNS records

## **File Structure for Vercel:**

```
ai-agent/
├── api/
│   └── index.js          # Vercel API handler
├── index.html            # Frontend
├── frontend.js           # Frontend logic
├── index.css             # Styles
├── tools.js              # Job search logic
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies
└── DEPLOYMENT.md         # This guide
```

## **Environment Variables Reference:**

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | ✅ Yes | Resume analysis |
| `ADZUNA_APP_ID` | ❌ No | Adzuna job search |
| `ADZUNA_API_KEY` | ❌ No | Adzuna job search |
| `THEMUSE_API_KEY` | ❌ No | TheMuse job search |
| `REED_API_KEY` | ❌ No | Reed job search |
| `RAPIDAPI_KEY` | ❌ No | RapidAPI job search |

## **Performance Notes:**

- **Function timeout**: 300 seconds (5 minutes)
- **File upload limit**: 5MB
- **Memory limit**: 1024MB (Vercel Pro)
- **Cold starts**: ~1-2 seconds

## **Monitoring:**

Check Vercel dashboard for:
- Function execution logs
- Error rates
- Response times
- Memory usage

## **Support:**

If you encounter issues:
1. Check Vercel function logs
2. Verify environment variables
3. Test endpoints individually
4. Check `vercel.json` configuration 
