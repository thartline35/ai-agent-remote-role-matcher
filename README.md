# AI Job Matcher 🚀

**Enhanced Remote Job Matching with AI-Powered Resume Analysis**

An intelligent web application that analyzes your resume, extracts your skills, and finds high-quality remote job opportunities that match your expertise. Powered by OpenAI GPT and real-time job scraping with advanced filtering.

## ✨ Enhanced Features

📄 **Smart PDF Parsing**: Advanced PDF text extraction using pdf2json for reliable resume parsing on all platforms

🎯 **AI-Powered Resume Analysis**: Extracts technical skills, soft skills, work experience, education, and qualifications with enhanced accuracy

🔍 **Sequential Processing with 70% Threshold**: Smart system processes each API source individually, immediately filtering for jobs with 70%+ match rate

🌍 **Multi-Source Job Search**: Searches 6+ job sources including APIs (Theirstack, Adzuna, TheMuse, Reed, JSearch-RapidAPI, RapidAPI-Jobs)

⚡ **Real Application Links**: Direct links to actual job application pages from all sources

💰 **Working Salary Filtering**: Advanced salary parsing and filtering that works - filter by $50k+, $75k+, $100k+, $125k+, $150k+

📊 **Enhanced Experience Filtering**: Smart filtering by experience level (Entry, Mid, Senior, Lead) with description-based matching

🌐 **Timezone Filtering**: Filter by EST, CST, MST, PST, GTM/UTC, or Any Timezone

🎨 **Modern UI**: Beautiful, responsive interface with drag-and-drop file upload and categorized skill display

⚡ **Optimized Performance**: Sequential processing helps prevent timeouts while ensuring high-quality results

🚫 **Zero Dummy Data**: All features work with real data only - no test or hardcoded information

🤖 **Automated API Exhaustion Detection**: Intelligent system that automatically detects when job APIs are out of credits or experiencing issues, marks them as exhausted, and skips them in future searches until they reset (hourly)

## ⚠️ Known Issues

### **Occasional Timeout Bug**
- **Issue**: The application may occasionally experience timeouts during job search, particularly when processing multiple API sources simultaneously
- **Frequency**: Occurs in approximately 10-15% of searches, especially during peak usage times
- **Workaround**: If a timeout occurs, simply refresh the page and try the search again. The sequential processing system will automatically retry with different sources
- **Root Cause**: Some external job APIs have variable response times and rate limiting that can cause intermittent timeouts
- **Status**: This is a known limitation with external API dependencies and doesn't affect the core functionality

## 🎯 Key Fixes Applied

### 1. **FIXED: Too Many Results**
- **Problem**: System collected ALL jobs from all sources, then filtered
- **Solution**: Sequential processing with immediate 70% threshold filtering
- **Result**: Returns manageable number of high-quality matches (50-400 instead of thousands)

### 2. **FIXED: Salary Filter Not Working**
- **Problem**: Frontend logic was not fully developed, causing the code to return true for all jobs
- **Solution**: Proper salary extraction and filtering logic
- **Result**: Working filter logic for $50k+, $75k+, $100k+, $125k+, $150k+

### 3. **FIXED: Enhanced Role Matching**
- **Problem**: Basic matching was too simplistic, and then advanced matching was overfitting.
- **Solution**: Weighted scoring system using resume analysis data
- **Result**: Technical Skills (35%), Work Experience (30%), Industry Match (20%), Responsibilities (15%)

## 🔑 Real Job Data Setup
This application supports real job data from multiple sources with intelligent filtering. You need to set up API keys for the job sources you want to use:

**Required API Keys**
- **OpenAI API** (Required for AI features)
  - Get API key from: https://platform.openai.com/api-keys
  - Add to your .env file:
    ```
    OPENAI_API_KEY=your_openai_api_key_here
    ```

- **Theirstack API** (Recommended primary source)
  - Get API key from: https://theirstack.com/
  - Add to your .env file:
    ```
    THEIRSTACK_API_KEY=your_theirstack_api_key_here
    ```

- **Adzuna API** (Free with registration)
  - Get API keys from: https://developer.adzuna.com/
  - Add to your .env file:
    ```
    ADZUNA_APP_ID=your_app_id_here
    ADZUNA_API_KEY=your_api_key_here
    ```

- **TheMuse API** (Free with registration)
  - Get API key from: https://www.themuse.com/developers
  - Add to your .env file:
    ```
    THEMUSE_API_KEY=your_themuse_api_key_here
    ```

- **Reed API** (Free with registration)
  - Get API key from: https://www.reed.co.uk/developers/
  - Add to your .env file:
    ```
    REED_API_KEY=your_reed_api_key_here
    ```

**API-Based Job Sources** (API keys required)
- Theirstack API (recommended primary source)
- Adzuna API, TheMuse API, Reed API
- RapidAPI job aggregators (JSearch, Jobs API)
- All sources provide real-time job data with intelligent filtering 

**Environment Variables**
Update your local.env file to include:

```
OPENAI_API_KEY=your_openai_api_key_here
THEIRSTACK_API_KEY=your_theirstack_api_key_here
ADZUNA_APP_ID=your_adzuna_app_id_here
ADZUNA_API_KEY=your_adzuna_api_key_here
THEMUSE_API_KEY=your_themuse_api_key_here
REED_API_KEY=your_reed_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here
```

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **AI**: OpenAI GPT-3.5-turbo for resume analysis and job matching
- **PDF Parsing**: pdf2json for reliable PDF text extraction
- **Job APIs**: Theirstack API, Adzuna API, TheMuse API, Reed API, RapidAPI
- **Styling**: Modern CSS with gradients, animations, and responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- OpenAI API key and tokens purchase (I purchased the $5.00 package to start.)
- Modern web browser

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/thartline35/ai-agent-remote-role-matcher.git
   cd ai-agent-remote-role-matcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `local.env` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ADZUNA_APP_ID=your_adzuna_app_id_here
   ADZUNA_API_KEY=your_adzuna_api_key_here
   THEMUSE_API_KEY=your_themuse_api_key_here
   REED_API_KEY=your_reed_api_key_here
   RAPIDAPI_KEY=your_rapidapi_key_here
   ```

4. **Get API Keys**:
   - OpenAI: https://platform.openai.com/api-keys
   - Theirstack: https://theirstack.com/
   - Adzuna: https://developer.adzuna.com/
   - TheMuse: https://www.themuse.com/developers
   - Reed: https://www.reed.co.uk/developers/
   - RapidAPI: https://www.rapidapi.com/console/

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open the application**
   Navigate to http://localhost:3000 in your browser

## 📋 Usage

1. **Upload Your Resume**
   - Drag and drop or click to upload your resume (PDF, DOC, DOCX, TXT)
   - Maximum file size: 5MB
   - The AI will analyze your resume and extract technical skills

2. **Review Extracted Skills & Experience**
   View the comprehensive analysis including:
   - **Technical Skills**: Programming languages, frameworks, tools, and technologies
   - **Soft Skills**: Leadership, communication, teamwork, problem-solving, and other interpersonal skills
   - **Work Experience**: Prior roles, industries, domains, and responsibilities

3. **Set Job Preferences**
   - Choose experience level (Entry, Mid, Senior, Lead)
   - Select salary range
   - Pick preferred timezone for remote work

4. **Find Matching Jobs**
   - Click "Start Job Search" to find remote opportunities
   - Results are sorted by skill match percentage
   - Each job includes direct application links

5. **Apply to Jobs**
   - Click "Apply Now" to go directly to the job application page
   - Save interesting positions for later review

## 🤖 Automated API Exhaustion Detection System

The application includes an intelligent system that automatically detects and handles API exhaustion to ensure reliable job searches.

### How It Works

**1. Dynamic Status Tracking**
- Tracks which APIs are exhausted (out of credits)
- Monitors suspicious failure patterns
- Automatically resets status every hour
- Persists across server restarts

**2. Exhaustion Detection Patterns**
- **HTTP Status Codes**: 429 (Rate Limited), 403 (Forbidden), 402 (Payment Required), 509 (Bandwidth Exceeded)
- **Error Messages**: Detects quota, limit, exceeded, exhausted, credits, usage, rate limit, etc.
- **Response Patterns**: Identifies empty responses that might indicate soft limits
- **Suspicious Failures**: Marks APIs as exhausted after 3 consecutive empty responses

**3. Automatic Handling**
- Exhausted APIs are automatically skipped in future searches
- System continues with available APIs
- Status resets hourly to retry previously exhausted APIs
- Real-time logging of exhaustion events

**4. Status Monitoring**
- View current API status via `/api-status` endpoint
- Manual reset available via `/reset-api-status` endpoint
- Status included in final job search response

### API Status Endpoints

**Get Current Status**
```bash
GET /api-status
```
Returns:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "exhaustedApis": ["Adzuna", "TheMuse"],
  "suspiciousApis": {"Reed": 2},
  "lastResetTime": "2024-01-01T11:00:00.000Z",
  "nextResetIn": 45,
  "totalExhausted": 2
}
```

**Manual Reset**
```bash
POST /reset-api-status
```
Returns:
```json
{
  "message": "API status reset successfully"
}
```

### Benefits
- **Reliability**: No more failed searches due to exhausted APIs
- **Efficiency**: Automatically focuses on working APIs
- **Transparency**: Clear visibility into API status
- **Self-Healing**: Automatic recovery when APIs become available again

## 🔧 API Endpoints

### Resume Analysis
```
POST /api/analyze-resume
Content-Type: application/json

{
  "resumeText": "Your resume content here..."
}
```

### Job Search
```
POST /api/search-jobs
Content-Type: application/json

{
  "analysis": {
    "technicalSkills": ["JavaScript", "React", "Node.js"],
    "softSkills": ["leadership", "communication", "teamwork"],
    "workExperience": ["full-stack development", "team leadership"],
    "industries": ["Technology", "Finance"],
    "responsibilities": ["led development team", "architected solutions"]
  },
  "filters": {
    "experience": "senior",
    "salary": "100k",
    "timezone": "us-only"
  }
}
```

### Response Format
```json
{
  "initialJobs": [...],      // First 12 jobs for immediate display
  "remainingJobs": [...],    // Additional jobs for pagination
  "totalJobs": 150          // Total number of high-quality matches
}
```

## 📁 Project Structure
```
ai-agent/
├── index.js          # Express server and API routes
├── tools.js          # AI functions for resume analysis and job scraping
├── frontend.js       # Client-side JavaScript
├── index.html        # Main web interface
├── index.css         # Styling and responsive design
├── package.json      # Dependencies and scripts
├── local.env         # Environment variables (not in git)
└── README.md         # This file
```

## 🔑 API Keys Required

### OpenAI API
- **Purpose**: Resume analysis and job matching
- **Get it**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Cost**: Pay-per-use (very affordable for this use case)

### Theirstack API
- **Purpose**: Primary job search source with comprehensive listings
- **Get it**: [Theirstack](https://theirstack.com/)
- **Cost**: Usually free tier available
- **Rate Limit**: Varies by plan

### Adzuna API
- **Purpose**: Real job listings from multiple sources
- **Get it**: [Adzuna Developer Portal](https://developer.adzuna.com/)
- **Cost**: Free with registration
- **Rate Limit**: 1000 requests per day

### TheMuse API
- **Purpose**: Company culture-focused job listings
- **Get it**: [TheMuse Developer Portal](https://www.themuse.com/developers)
- **Cost**: Free with registration
- **Rate Limit**: 1000 requests per day

### Reed API
- **Purpose**: UK and international job listings
- **Get it**: [Reed Developer Portal](https://www.reed.co.uk/developers/)
- **Cost**: Free with registration
- **Rate Limit**: 1000 requests per day

### RapidAPI (JSearch & Jobs APIs)
- **Purpose**: Job search aggregators with multiple job board sources
- **Get it**: [RapidAPI Platform](https://rapidapi.com/) - Subscribe to JSearch and Jobs API services
- **Cost**: Free tier available (100-500 requests/month), paid plans from ~$10-20/month
- **Rate Limit**: 100-500 requests/month (free tier), 1,000-10,000+ requests/month (paid tiers)

## 🎯 How It Works

### **Enhanced Resume Analysis**
AI analyzes uploaded resume text and extracts:
- **Technical skills** (programming languages, frameworks, tools, development practices)
- **Soft skills** (leadership, communication, teamwork, adaptability, creativity, critical thinking, emotional intelligence)
- **Work experience** (roles, industries, domains, responsibilities, team sizes, methodologies, achievements, metrics)
- **Education and certifications** with enhanced accuracy

### **Sequential Processing with 70% Threshold**
1. **Source-by-Source Processing**: Each API source is processed individually
2. **Immediate Filtering**: Jobs are scored immediately and only 70%+ matches are kept
3. **Maximum Quality**: Maximum 100 high-quality matches per source
4. **Enhanced Basic Scoring**: Fast pre-filtering before AI analysis

### **Advanced Skill Matching**
AI calculates comprehensive match percentages using weighted scoring:
- **Technical Skills** (35% weight): Direct matches, related technologies, skill families
- **Work Experience** (30% weight): Role relevance, industry experience, responsibility level
- **Industry Match** (20% weight): Company industry alignment
- **Responsibilities** (15% weight): Job responsibility alignment

### **Enhanced Salary Processing**
- **Multiple Format Support**: Handles "$50k", "$50,000", ranges, "From $50k", "Up to $75k"
- **Description Extraction**: Extracts salary info from job descriptions when API data is missing
- **Working Filters**: Proper numerical comparison for all salary ranges

### **Smart Result Ranking**
- Jobs are sorted by overall match percentage and relevance
- Only high-quality matches (70%+) are returned
- Detailed breakdown of technical, experience, and responsibility matches
- Direct application links for all results

## 🚀 Deployment

### Local Development
```bash
npm run dev  # Starts with auto-reload
```

### Production
```bash
npm start    # Starts production server
```

## 🔒 Security Notes
- Never commit your `local.env` file to version control
- The `.gitignore` file excludes sensitive files
- API keys are stored securely in environment variables
- File uploads are validated for type and size

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License
MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

**"Failed to analyze resume"**
- Check your OpenAI API key is valid
- Ensure resume file is under 5MB
- Try a different file format

**"No jobs found"**
- Try adjusting your filters
- Check your internet connection
- The system will fall back to demo data if APIs are unavailable

**Port 3000 already in use**
- Kill existing Node processes: `taskkill /f /im node.exe`
- Or change the port in `index.js`

**Timeout during job search**
- This is a known issue (see Known Issues section above)
- Simply refresh the page and try again
- The system will automatically retry with different sources

## 🎉 What's Next?

### ✅ **Recently Completed**
- ✅ **Sequential processing with 70% threshold** - Implemented with immediate filtering
- ✅ **Working salary filtering** - Implemented with advanced parsing and extraction
- ✅ **Enhanced role matching** - Implemented with weighted scoring system
- ✅ **Multi-source job search** - Implemented with smart filtering
- ✅ **PDF parsing** - Implemented with pdf2json
- ✅ **Enhanced resume analysis** - Implemented with comprehensive skill extraction
- ✅ **Performance optimization** - Implemented with intelligent filtering

### 🔄 **Future Enhancements**
- 🔄 **Job alerts and notifications**
- 🔄 **Resume optimization suggestions**
- 🔄 **User accounts and job history**
- 🔄 **Salary negotiation insights**
- 🔄 **ATS system integration**
- 🔄 **Additional job sources** (We Work Remotely, Remotive, Built In, Arc.dev, FlexJobs, Upwork)
- 🔄 **Timeout handling improvements** - Better error recovery and retry mechanisms

---

**Built with ❤️ for remote job seekers everywhere**

*Last updated: August 3, 2025*
