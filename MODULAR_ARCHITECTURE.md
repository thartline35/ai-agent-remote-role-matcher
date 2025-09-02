# Modular API Architecture Documentation

## Overview

Your AI Agent Remote Role Matcher has been successfully restructured into a modular, easily debuggable architecture. Each API service is now separated into its own module with comprehensive error handling, logging, and status tracking. Additionally, the system now includes web scraping capabilities to provide more job results without relying on API quotas or tokens.

## Architecture Components

### 1. Configuration Module (`config/api-config.js`)
- **Purpose**: Centralized API configuration and validation
- **Features**:
  - Environment variable management
  - API key validation
  - Configuration status reporting
  - Missing API detection

### 2. Base API Class (`services/base-api.js`)
- **Purpose**: Common functionality for all API services
- **Features**:
  - HTTP request handling with error detection
  - API exhaustion detection
  - Usage statistics tracking
  - Standardized error handling

### 3. Individual API Services
Each API has its own dedicated service module:

#### Theirstack API (`services/theirstack-api.js`)
- Primary job search source
- Usage quota tracking (200 requests/day limit)
- Comprehensive job listings

#### Adzuna API (`services/adzuna-api.js`)
- Real job listings from multiple sources
- Salary formatting and parsing
- US-focused remote jobs

#### TheMuse API (`services/themuse-api.js`)
- Company culture-focused listings
- Category-based filtering
- Engineering, Data Science, Product, Design categories

#### Reed API (`services/reed-api.js`)
- UK and international job listings
- Basic authentication handling
- Comprehensive job data

#### RapidAPI JSearch (`services/rapidapi-jsearch.js`)
- Job search aggregator
- Quota monitoring
- Multiple job board sources

#### RapidAPI Jobs (`services/rapidapi-jobs.js`)
- Alternative job aggregator
- Full-time remote job focus
- International job listings

### 4. API Manager (`services/api-manager.js`)
- **Purpose**: Centralized coordination of all APIs
- **Features**:
  - API exhaustion detection and management
  - Automatic status reset (hourly)
  - Comprehensive status reporting
  - Error threshold monitoring
  - Usage statistics aggregation

### 5. Job Search Service (`services/job-search-service.js`)
- **Purpose**: High-level job search coordination
- **Features**:
  - Query generation from resume analysis
  - Job filtering (remote, salary, experience, timezone)
  - Real-time streaming results
  - Progress tracking

### 6. Web Scraping System
- **Base Scraper** (`services/base-scraper.js`): Common functionality for all scrapers
- **Individual Scrapers** (`services/scrapers/`):
  - `indeed-scraper.js` - Indeed job board scraper
  - `jooble-scraper.js` - Jooble job aggregator scraper
  - `ziprecruiter-scraper.js` - ZipRecruiter job board scraper
  - `weworkremotely-scraper.js` - We Work Remotely remote jobs scraper
  - `careerjet-scraper.js` - CareerJet job aggregator scraper
- **Scraper Manager** (`services/scraper-manager.js`): Coordinates all scrapers
- **Features**:
  - No API quotas or tokens required
  - Parallel scraping for faster results
  - Automatic error handling and retry logic
  - Duplicate job removal
  - User-friendly status messages

### 7. Modular Endpoint (`api/search-jobs-modular.js`)
- **Purpose**: New modular job search endpoint
- **Features**:
  - Server-sent events for real-time updates
  - Comprehensive error handling
  - API status reporting
  - Progress streaming
  - Combined API and scraping results

## Key Benefits

### 🔧 **Easy Debugging**
- Each API is isolated in its own module
- Comprehensive logging with unique call IDs
- Detailed error reporting and stack traces
- API status tracking and exhaustion detection

### 📊 **Monitoring & Analytics**
- Real-time API health monitoring
- Usage statistics per API
- Exhaustion detection and automatic recovery
- Performance metrics and timing

### 🛡️ **Error Handling**
- Automatic API exhaustion detection
- Graceful fallback when APIs fail
- Retry logic with exponential backoff
- User-friendly error messages

### 🕷️ **Web Scraping Advantages**
- **No API Quotas**: Scraping doesn't consume API tokens or hit rate limits
- **More Results**: Additional job sources beyond API limitations
- **Cost Effective**: No subscription fees for scraping sources
- **Reliable**: Works even when APIs are exhausted
- **Comprehensive**: Covers major job boards and aggregators

### 🔄 **Maintainability**
- Single responsibility principle
- Easy to add new APIs
- Centralized configuration
- Consistent interface across all APIs

## Usage

### Original Endpoint (Still Available)
```
POST /api/search-jobs
```

### New Modular Endpoint
```
POST /api/search-jobs-modular
```

### API Status Endpoints
```
GET /api-status                    # Get comprehensive API status
POST /reset-api-status            # Manually reset API exhaustion status
```

## Testing

Run the test script to verify the modular structure:
```bash
node test-modular.js
```

## Configuration

All API keys are managed through the `local.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
THEIRSTACK_API_KEY=your_theirstack_api_key_here
ADZUNA_APP_ID=your_adzuna_app_id_here
ADZUNA_API_KEY=your_adzuna_api_key_here
THEMUSE_API_KEY=your_themuse_api_key_here
REED_API_KEY=your_reed_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here
```

## API Status Monitoring

The system automatically tracks:
- ✅ **Healthy APIs**: Working normally
- ⚠️ **Suspicious APIs**: Multiple empty responses
- 🚫 **Exhausted APIs**: Quota exceeded or errors detected

APIs are automatically reset every hour, or can be manually reset via the API.

## Scraping Status Monitoring

The web scraping system tracks:
- ✅ **Available Scrapers**: Working normally
- ❌ **Unavailable Scrapers**: Multiple failures detected
- 🔄 **Auto-Recovery**: Scrapers are automatically re-enabled after errors

Scrapers provide additional job results without consuming API quotas.

## Error Recovery

The system includes intelligent error recovery:
1. **Exhaustion Detection**: Automatically detects when APIs are exhausted
2. **Automatic Reset**: APIs are reset every hour
3. **Graceful Degradation**: Continues with available APIs when some fail
4. **User Feedback**: Provides clear error messages and status updates

## Performance Features

- **Parallel Processing**: Multiple APIs can be called simultaneously
- **Streaming Results**: Real-time job results via Server-Sent Events
- **Progress Tracking**: Detailed progress updates during search
- **Caching**: API status and configuration caching
- **Rate Limiting**: Built-in rate limiting and quota management

## Future Enhancements

The modular architecture makes it easy to add:
- New job search APIs
- AI-powered job matching
- Advanced filtering options
- Performance optimizations
- Additional monitoring features

## File Structure

```
├── config/
│   └── api-config.js              # Centralized configuration
├── services/
│   ├── base-api.js                # Base API class
│   ├── theirstack-api.js          # Theirstack service
│   ├── adzuna-api.js              # Adzuna service
│   ├── themuse-api.js             # TheMuse service
│   ├── reed-api.js                # Reed service
│   ├── rapidapi-jsearch.js        # RapidAPI JSearch service
│   ├── rapidapi-jobs.js           # RapidAPI Jobs service
│   ├── api-manager.js             # API coordination
│   └── job-search-service.js      # High-level job search
├── api/
│   └── search-jobs-modular.js     # New modular endpoint
├── test-modular.js                # Test script
└── MODULAR_ARCHITECTURE.md        # This documentation
```

Your code is now much more maintainable, debuggable, and scalable! 🎉
