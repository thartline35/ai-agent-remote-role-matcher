# API Setup Guide for AI Job Matcher

This guide will help you set up all the required APIs for the AI Job Matcher application.

## Required APIs

### 1. OpenAI API (REQUIRED)
- **Purpose**: Resume analysis and job matching
- **Setup**: 
  1. Go to [OpenAI Platform](https://platform.openai.com/)
  2. Create an account and get your API key
  3. Add to environment variables: `OPENAI_API_KEY=your_key_here`

### 2. Theirstack API (RECOMMENDED)
- **Purpose**: Primary job search source
- **Setup**:
  1. Go to [Theirstack](https://theirstack.com/)
  2. Sign up for an account
  3. Get your API key from the dashboard
  4. Add to environment variables: `THEIRSTACK_API_KEY=your_key_here`

### 3. Adzuna API (Optional)
- **Purpose**: Additional job search source
- **Setup**:
  1. Go to [Adzuna](https://developer.adzuna.com/)
  2. Register for an account
  3. Get your App ID and API Key
  4. Add to environment variables: `ADZUNA_APP_ID=your_app_id` and `ADZUNA_API_KEY=your_api_key`

### 4. TheMuse API (Optional)
- **Purpose**: Additional job search source
- **Setup**:
  1. Go to [TheMuse API](https://www.themuse.com/developers/api/v2)
  2. Register for an account
  3. Get your API key
  4. Add to environment variables: `THEMUSE_API_KEY=your_key_here`

### 5. Reed API (Optional)
- **Purpose**: Additional job search source (UK-focused)
- **Setup**:
  1. Go to [Reed API](https://www.reed.co.uk/developers/)
  2. Register for an account
  3. Get your API key
  4. Add to environment variables: `REED_API_KEY=your_key_here`

### 6. RapidAPI (Optional)
- **Purpose**: Additional job search sources
- **Setup**:
  1. Go to [RapidAPI](https://rapidapi.com/)
  2. Create an account
  3. Subscribe to job search APIs (JSearch, Jobs API)
  4. Get your API key
  5. Add to environment variables: `RAPIDAPI_KEY=your_key_here`

## Environment Variables Setup

Create a `.env` file in your project root with the following variables:

```env
# Required
OPENAI_API_KEY=your_openai_key_here

# Recommended
THEIRSTACK_API_KEY=your_theirstack_key_here

# Optional
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_API_KEY=your_adzuna_api_key
THEMUSE_API_KEY=your_themuse_key
REED_API_KEY=your_reed_key
RAPIDAPI_KEY=your_rapidapi_key
```

## Features by API Configuration

### Minimum Setup (OpenAI only)
- ✅ Resume analysis
- ❌ Job search (will fail)

### Basic Setup (OpenAI + 1 job API)
- ✅ Resume analysis
- ✅ Basic job search
- ⚠️ Limited job sources

### Recommended Setup (OpenAI + Theirstack)
- ✅ Resume analysis
- ✅ Good job search coverage
- ✅ High-quality job matches

### Full Setup (All APIs)
- ✅ Resume analysis
- ✅ Maximum job search coverage
- ✅ Best job matching results
- ✅ Redundancy if some APIs fail

## Testing Your Setup

1. Start the application
2. Check the console output for API configuration status
3. Visit `/api/health` endpoint to verify all APIs
4. Upload a resume to test the full workflow

## Troubleshooting

### Common Issues:
- **"No job search APIs configured"**: Add at least one job search API key
- **"OpenAI API key is missing"**: Add your OpenAI API key
- **API rate limits**: Some APIs have usage limits, check your account dashboard
- **Network issues**: Ensure your server can reach the API endpoints

### API Status Check:
The application will show the status of each API in the console when starting:
- ✅ Configured: API key is present
- ❌ Missing: API key is not configured

## Cost Considerations

- **OpenAI**: Pay per API call (resume analysis)
- **Theirstack**: Usually free tier available
- **Adzuna**: Free tier available
- **TheMuse**: Free tier available
- **Reed**: Free tier available
- **RapidAPI**: Pay per API call

## Security Notes

- Never commit your `.env` file to version control
- Use environment variables in production
- Rotate API keys regularly
- Monitor API usage to avoid unexpected charges 
