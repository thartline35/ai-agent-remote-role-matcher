// Simple command-line script to test JSearch API integration
import { searchJobs } from './api/jsearch-test.js';

// Parse command line arguments
const args = process.argv.slice(2);
const query = args[0] || 'javascript developer';
const location = args[1] || 'remote';
const page = parseInt(args[2]) || 1;
const numPages = parseInt(args[3]) || 1;

console.log(`\n🔍 JSearch API Test`);
console.log(`Query: ${query}`);
console.log(`Location: ${location}`);
console.log(`Page: ${page}`);
console.log(`Number of pages: ${numPages}\n`);

// Run the search
searchJobs(query, location, page, numPages)
  .then(results => {
    console.log('\n✅ Search completed successfully!');
    console.log(`Found ${results.data?.length || 0} jobs\n`);
    
    // Display job results in a simplified format
    if (results.data && results.data.length > 0) {
      console.log('📋 Job Results:\n');
      results.data.forEach((job, index) => {
        console.log(`Job #${index + 1}:`);
        console.log(`Title: ${job.job_title || 'N/A'}`);
        console.log(`Company: ${job.employer_name || 'N/A'}`);
        console.log(`Location: ${job.job_city || 'N/A'}, ${job.job_country || 'N/A'}`);
        console.log(`Remote: ${job.job_is_remote ? 'Yes' : 'No'}`);
        console.log(`URL: ${job.job_apply_link || 'N/A'}`);
        console.log('-----------------------------------');
      });
    } else {
      console.log('No jobs found matching your criteria.');
    }
  })
  .catch(error => {
    console.error('\n❌ Search failed:');
    console.error(error.message);
    
    if (error.message.includes('All RapidAPI keys exhausted')) {
      console.log('\n💡 Tip: Add valid backup API keys in your local.env file:');
      console.log('RAPIDAPI_KEY_BACKUP_1 = "your_backup_key_1"');
      console.log('RAPIDAPI_KEY_BACKUP_2 = "your_backup_key_2"');
    }
  });