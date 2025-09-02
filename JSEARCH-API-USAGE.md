# JSearch RapidAPI Integration Guide

This guide explains how to use the JSearch API from RapidAPI in the AI Remote Job Finder project.

## Overview

The JSearch API provides access to job listings from multiple sources. This integration includes:

1. A reusable module for making JSearch API calls (`api/jsearch-test.js`)
2. Support for API key rotation when quota limits are reached
3. A simple command-line test script (`test-jsearch.js`)

## Setup

### 1. Get RapidAPI Keys

1. Go to [RapidAPI](https://rapidapi.com/)
2. Create an account and subscribe to the [JSearch API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
3. Get your API key from the RapidAPI dashboard

### 2. Configure API Keys

Add your API keys to the `local.env` file:

```env
# Primary API Key
RAPIDAPI_KEY = "your_primary_api_key_here"

# Backup API Keys (optional but recommended)
RAPIDAPI_KEY_BACKUP_1 = "your_backup_key_1_here"
RAPIDAPI_KEY_BACKUP_2 = "your_backup_key_2_here"
```

**Important:** You must replace the placeholder values with actual API keys. The system will automatically rotate to backup keys when the primary key reaches its quota limit.

For backup keys, you can create additional RapidAPI accounts to get separate API keys. Each account will have its own quota limit, allowing you to make more API calls.

## Usage

### Using the API Module

Import the `searchJobs` function in your code:

```javascript
import { searchJobs } from './api/jsearch-test.js';

// Basic usage
searchJobs('javascript developer', 'remote')
  .then(results => console.log(results))
  .catch(error => console.error(error));

// Advanced usage with all parameters
searchJobs(
  'javascript developer', // query
  'remote',               // location
  1,                      // page
  1,                      // numPages
  'us',                   // country
  'all'                   // datePosted
).then(results => console.log(results));
```

### Command-line Testing

Use the included test script to quickly test the API:

```bash
node test-jsearch.js "javascript developer" "remote" 1 1
```

Parameters:
1. Search query (default: "javascript developer")
2. Location (default: "remote")
3. Page number (default: 1)
4. Number of pages (default: 1)

## API Key Rotation

The integration automatically handles API key rotation:

1. When an API call fails with a quota limit error (HTTP 429)
2. The system tries the next available backup key
3. If all keys are exhausted, an error is thrown

This ensures maximum availability of the API service.

## Error Handling

The module includes comprehensive error handling:

- Quota exhaustion detection and key rotation
- Detailed error messages
- Automatic retries with backup keys

## Integration with Main Application

The JSearch API is already integrated with the main application through the API key rotation system in `search-jobs.js`. The test module demonstrates how to leverage this system for reliable API calls.