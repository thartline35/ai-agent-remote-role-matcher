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

### 7. JobsMulti API (Optional)
- **Purpose**: Aggregated job search from multiple sources
- **Setup**:
  1. Go to [JobsMulti API](https://jobapis.com/)
  2. Register for an account
  3. Get your API key
  4. Add to environment variables: `JOBSMULTI_API_KEY=your_key_here`

### 8. Jobber API (Optional)
- **Purpose**: Additional job search source
- **Setup**:
  1. Go to [Jobber API](https://jobber.io/)
  2. Register for an account
  3. Get your API key
  4. Add to environment variables: `JOBBER_API_KEY=your_key_here`

## Environment Variables Setup

Create a `.env` file in your project root with the following variables:

```env
# Required Primary API Keys
OPENAI_API_KEY=your_openai_key_here

# Recommended
THEIRSTACK_API_KEY=your_theirstack_key_here

# Optional Primary API Keys
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_API_KEY=your_adzuna_api_key
THEMUSE_API_KEY=your_themuse_key
REED_API_KEY=your_reed_key
RAPIDAPI_KEY=your_rapidapi_key
JOBSMULTI_API_KEY=your_jobsmulti_key_here
JOBBER_API_KEY=your_jobber_key_here

# Backup API Keys (Optional but recommended for high-volume usage)
# The system will automatically rotate to these keys when primary keys reach quota limits
OPENAI_API_KEY_BACKUP_1=your_openai_backup_key_1_here
OPENAI_API_KEY_BACKUP_2=your_openai_backup_key_2_here

ADZUNA_API_KEY_BACKUP_1=your_adzuna_backup_key_1_here
ADZUNA_APP_ID_BACKUP_1=your_adzuna_backup_app_id_1_here

THEMUSE_API_KEY_BACKUP_1=your_themuse_backup_key_1_here

RAPIDAPI_KEY_BACKUP_1=your_rapidapi_backup_key_1_here
RAPIDAPI_KEY_BACKUP_2=your_rapidapi_backup_key_2_here

REED_API_KEY_BACKUP_1=your_reed_backup_key_1_here

JOBSMULTI_API_KEY_BACKUP_1=your_jobsmulti_backup_key_1_here

JOBBER_API_KEY_BACKUP_1=your_jobber_backup_key_1_here
```

## API Key Rotation Feature

The application now supports automatic API key rotation when a key reaches its quota limit or encounters errors. This feature helps maintain uninterrupted service by switching to backup API keys when needed.

### How It Works

1. When an API call fails due to quota limits or certain errors, the system automatically tries the next available backup key
2. The system tracks which key is currently in use for each API service
3. If all keys for a service are exhausted, the service is marked as unavailable until the next reset period
4. API status reports include information about key rotation status

### Benefits

- Increased reliability during high-volume usage periods
- Reduced service interruptions due to API quota limits
- Better distribution of API calls across multiple accounts
- Automatic fallback to primary keys after reset periods

## Features by API Configuration

### Minimum Setup (OpenAI only)
- ✅ Resume analysis
- ❌ Job search (will fail)

### Basic Setup (OpenAI + 1 job API)
- ✅ Resume analysis
- ✅ Basic job search

### Recommended Setup (OpenAI + multiple job APIs + backup keys)
- ✅ Resume analysis
- ✅ Comprehensive job search
- ✅ High reliability with automatic key rotation
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
