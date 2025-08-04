# API Setup Guide for Real Job Data

## Quick Setup Steps

### 1. Adzuna API (Recommended - Free)
1. Go to https://developer.adzuna.com/
2. Click "Get API Keys"
3. Register for a free account
4. Create a new application
5. Copy your App ID and API Key
6. Add to your `local.env` file:
   ```env
   ADZUNA_APP_ID=your_app_id_here
   ADZUNA_API_KEY=your_api_key_here
   ```

### 2. TheMuse API (Free with registration)
1. Go to https://www.themuse.com/developers
2. Register for a free account
3. Create a new application
4. Copy your API Key
5. Add to your `local.env` file:
   ```env
   THEMUSE_API_KEY=your_themuse_api_key_here
   ```

### 3. OpenAI API (Required for AI features)
1. Go to https://platform.openai.com/api-keys
2. Create an account or sign in
3. Create a new API key
4. Add to your `local.env` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Complete .env File Example
```env
OPENAI_API_KEY=sk-your-openai-key-here
ADZUNA_APP_ID=your-adzuna-app-id
ADZUNA_API_KEY=your-adzuna-api-key
THEMUSE_API_KEY=your-themuse-api-key
```

## Testing Your Setup
1. Start the server: `npm start`
2. Upload a resume
3. Check the console for messages like:
   - "Found X real jobs from Adzuna API"
   - "Found X real jobs from TheMuse API"
   - "Found X real jobs from LinkedIn"


## Troubleshooting
- If you see "API credentials required" errors, check your .env file
- If you see "Failed to fetch real job data", check your API keys are valid
- Make sure your .env file is in the root directory of the project

## Rate Limits
- Adzuna: 1000 requests per day
- TheMuse: 1000 requests per day
- OpenAI: Varies by plan (usually sufficient for testing)
- Web Scraping: Limited by site policies and anti-bot measures

## Next Steps
Once you have real job data working, you can:
1. Web scraping is already included (LinkedIn, Glassdoor)
2. Add more job sources via web scraping
3. Add job alerts and notifications 