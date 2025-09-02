# Web Scraping Integration Guide

## Overview

The AI Agent Remote Role Matcher now includes comprehensive web scraping capabilities to provide additional job results without relying on API quotas or tokens. This system scrapes major job boards and aggregators to give users more comprehensive job search results.

## Scraping Architecture

### Base Scraper Class (`services/base-scraper.js`)

The base scraper provides common functionality for all scrapers:

- **Browser Management**: Puppeteer integration for JavaScript-heavy sites
- **HTTP Requests**: Axios fallback for simple sites
- **User Agent Rotation**: Prevents detection and blocking
- **Error Handling**: Comprehensive error detection and retry logic
- **Data Normalization**: Consistent job data format across all sources

### Individual Scrapers

#### 1. Indeed Scraper (`services/scrapers/indeed-scraper.js`)
- **Source**: Indeed.com
- **Focus**: General job listings with remote filter
- **Features**: Salary detection, company information, location parsing
- **Rate Limiting**: Built-in delays and user agent rotation

#### 2. Jooble Scraper (`services/scrapers/jooble-scraper.js`)
- **Source**: Jooble.org
- **Focus**: Global job aggregator
- **Features**: International job listings, salary information
- **Advantages**: Generally scraper-friendly

#### 3. ZipRecruiter Scraper (`services/scrapers/ziprecruiter-scraper.js`)
- **Source**: ZipRecruiter.com
- **Focus**: US-focused job board
- **Features**: Employer-verified listings, salary data
- **Note**: May require additional headers for full access

#### 4. We Work Remotely Scraper (`services/scrapers/weworkremotely-scraper.js`)
- **Source**: WeWorkRemotely.com
- **Focus**: Remote-only jobs
- **Features**: High-quality remote job listings
- **Advantages**: All jobs are remote by default

#### 5. CareerJet Scraper (`services/scrapers/careerjet-scraper.js`)
- **Source**: CareerJet.com
- **Focus**: International job aggregator
- **Features**: Multi-language support, global coverage
- **Advantages**: Structured data format

### Scraper Manager (`services/scraper-manager.js`)

The scraper manager coordinates all scrapers:

- **Parallel Execution**: All scrapers run simultaneously for faster results
- **Error Handling**: Individual scraper failures don't affect others
- **Deduplication**: Removes duplicate jobs across sources
- **Status Tracking**: Monitors scraper health and availability
- **User Messages**: Provides friendly status updates

## Integration with Job Search Service

The scraping system is fully integrated with the existing job search service:

1. **API Search First**: Traditional APIs are searched first
2. **Scraping Enhancement**: Web scraping adds additional results
3. **Combined Results**: All results are merged and deduplicated
4. **Unified Interface**: Same endpoint and response format

## User Experience

### Real-Time Updates

Users receive real-time updates about scraping progress:

```json
{
  "type": "scraper_start",
  "scraper": "indeed",
  "message": "Starting Indeed scraper..."
}
```

```json
{
  "type": "scraper_complete",
  "scraper": "indeed",
  "message": "Found 25 jobs from Indeed",
  "count": 25
}
```

### Status Messages

Users are informed about scraper availability:

```json
{
  "type": "user_message",
  "messageType": "info",
  "title": "Some Scraping Sources Unavailable",
  "message": "4 out of 5 scraping sources are working. You're getting results from available sources.",
  "action": "continue_search"
}
```

## Technical Implementation

### Dependencies

The scraping system uses these npm packages:

```json
{
  "puppeteer": "^21.0.0",
  "cheerio": "^1.0.0",
  "axios": "^1.6.0",
  "user-agents": "^1.0.0"
}
```

### Error Handling

The system includes comprehensive error handling:

1. **HTTP Errors**: 403, 429, 500 responses are handled gracefully
2. **Timeout Handling**: Requests timeout after 30 seconds
3. **Browser Crashes**: Puppeteer failures fall back to HTTP requests
4. **Rate Limiting**: Built-in delays prevent overwhelming target sites
5. **User Agent Rotation**: Prevents detection and blocking

### Performance Optimization

- **Parallel Scraping**: All scrapers run simultaneously
- **Smart Fallbacks**: HTTP requests fall back to Puppeteer when needed
- **Caching**: Browser instances are reused when possible
- **Resource Management**: Browsers are properly closed after use

## Configuration

### Environment Variables

No additional environment variables are required for scraping. The system works out of the box.

### Customization

Scrapers can be customized by modifying:

- **Search Parameters**: Query building and filtering
- **Selectors**: HTML element selection for data extraction
- **Rate Limits**: Delays between requests
- **User Agents**: Browser identification strings

## Monitoring and Debugging

### Status Endpoints

Check scraper status via the API:

```bash
GET /api-status
```

Response includes scraper status:

```json
{
  "apiStatus": { ... },
  "scraperStatus": {
    "totalScrapers": 5,
    "availableScrapers": 4,
    "unavailableScrapers": 1,
    "healthPercentage": 80,
    "scrapers": {
      "indeed": { "available": true, "lastUsed": "2025-09-02T17:51:18.716Z", "errors": 0 },
      "jooble": { "available": true, "lastUsed": "2025-09-02T17:51:18.716Z", "errors": 0 },
      "ziprecruiter": { "available": false, "lastUsed": null, "errors": 3 }
    }
  }
}
```

### Logging

The system provides detailed logging:

```
🔍 Scraping Indeed for: "remote javascript developer"
   URL: https://www.indeed.com/jobs?q=remote+javascript+developer...
   Found 25 jobs
```

### Error Tracking

Failed scrapers are automatically tracked:

```
❌ Scraper indeed failed: Request failed with status code 403
⚠️ Disabling indeed scraper due to repeated failures
```

## Best Practices

### Ethical Scraping

The system follows ethical scraping practices:

- **Respectful Rate Limiting**: Built-in delays prevent overwhelming servers
- **User Agent Identification**: Proper browser identification
- **Error Handling**: Graceful handling of blocks and errors
- **Resource Management**: Proper cleanup of browser resources

### Legal Compliance

- **Terms of Service**: Scrapers respect site terms of service
- **Rate Limiting**: Prevents abuse and server overload
- **Data Usage**: Only extracts publicly available job data
- **Attribution**: Proper source attribution for scraped data

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Site is blocking requests
   - **Solution**: System automatically falls back to Puppeteer
   - **Prevention**: User agent rotation and rate limiting

2. **Timeout Errors**: Slow response times
   - **Solution**: 30-second timeout with graceful fallback
   - **Prevention**: Parallel execution reduces total time

3. **No Results**: Scrapers return empty results
   - **Solution**: System continues with other sources
   - **Debugging**: Check logs for specific error messages

### Performance Issues

1. **Slow Scraping**: Multiple scrapers running slowly
   - **Solution**: Parallel execution already implemented
   - **Optimization**: Consider reducing number of scrapers

2. **Memory Usage**: High memory consumption
   - **Solution**: Browsers are properly closed after use
   - **Monitoring**: Check system resources during scraping

## Future Enhancements

### Planned Features

1. **Additional Scrapers**: More job board integrations
2. **Smart Caching**: Cache results to reduce repeated requests
3. **Proxy Support**: Rotate IP addresses for better reliability
4. **Machine Learning**: Improve job matching with scraped data
5. **Real-Time Updates**: Live job feed updates

### Extensibility

The system is designed for easy extension:

1. **New Scrapers**: Extend BaseScraper class
2. **Custom Selectors**: Modify HTML parsing logic
3. **Additional Sources**: Add new job board integrations
4. **Enhanced Filtering**: Improve job matching algorithms

## Conclusion

The web scraping system provides a robust, scalable solution for gathering job data without API limitations. It seamlessly integrates with the existing job search infrastructure while providing users with more comprehensive results and better user experience through real-time updates and status messages.

The system is designed to be ethical, performant, and maintainable, following best practices for web scraping while providing maximum value to users searching for remote job opportunities.
