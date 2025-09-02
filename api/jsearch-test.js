// JSearch RapidAPI Test Implementation
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApiKeyWithBackup, rotateToNextApiKey } from './search-jobs.js';

// Setup environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../local.env') });

/**
 * Makes a search request to JSearch API with automatic key rotation
 * @param {string} query - The job search query
 * @param {string} location - Location to search in
 * @param {number} page - Page number
 * @param {number} numPages - Number of pages to fetch
 * @param {string} country - Country code (e.g., 'us')
 * @param {string} datePosted - Filter by date posted (e.g., 'all', 'today', 'week')
 * @returns {Promise<Object>} - The API response
 */
async function searchJobs(query, location = '', page = 1, numPages = 1, country = 'us', datePosted = 'all') {
  // Format the search query
  let formattedQuery = query;
  if (location) {
    formattedQuery += ` in ${location}`;
  }
  
  // Get API key with backup support
  const keyInfo = getApiKeyWithBackup('RapidAPI');
  if (!keyInfo || !keyInfo.key) {
    throw new Error('No valid RapidAPI key available');
  }
  
  const options = {
    method: 'GET',
    url: 'https://jsearch.p.rapidapi.com/search',
    params: {
      query: formattedQuery,
      page: page.toString(),
      num_pages: numPages.toString(),
      country: country,
      date_posted: datePosted
    },
    headers: {
      'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      'x-rapidapi-key': keyInfo.key
    }
  };
  
  try {
    console.log(`Making JSearch API call for query: "${formattedQuery}"`);
    const response = await axios.request(options);
    console.log(`JSearch API call successful, found ${response.data.data?.length || 0} jobs`);
    return response.data;
  } catch (error) {
    console.error(`JSearch API call failed: ${error.message}`);
    
    // Check for quota exhaustion (HTTP 429)
    if (error.response && error.response.status === 429) {
      console.log('API quota exhausted, attempting to rotate to next key...');
      const rotated = rotateToNextApiKey('RapidAPI');
      
      if (rotated) {
        console.log('Rotated to next API key, retrying request...');
        // Retry the request with the new key
        return searchJobs(query, location, page, numPages, country, datePosted);
      } else {
        console.error('No more backup keys available');
        throw new Error('All RapidAPI keys exhausted');
      }
    }
    
    throw error;
  }
}

/**
 * Run a test search
 */
async function runTest() {
  try {
    const results = await searchJobs('javascript developer', 'remote', 1, 1);
    console.log('Search results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Execute the test if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTest();
}

export { searchJobs };