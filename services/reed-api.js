// services/reed-api.js - Reed API service

import { BaseApi } from './base-api.js';

/**
 * Reed API service
 * UK and international job listings
 */
export class ReedApi extends BaseApi {
    constructor() {
        super('reed');
    }

    /**
     * Search for jobs using Reed API
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        const requestConfig = {
            method: 'GET',
            url: `${this.config.baseUrl}/search`,
            params: {
                keywords: query.replace('remote ', ''),
                locationName: 'Remote',
                distanceFromLocation: 0,
                resultsToTake: 50
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(`${this.config.key}:`).toString('base64')}`,
                'User-Agent': 'JobMatcher/1.0'
            }
        };

        const response = await this.makeRequest(requestConfig);

        if (!response.data?.results) {
            throw new Error('No results field in response');
        }

        return response.data.results.map(job => this.standardizeJob(job));
    }

    /**
     * Standardize job object from Reed API
     * @param {Object} job - Raw job object from API
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        return {
            title: job.jobTitle,
            company: job.employerName || 'Unknown Company',
            location: 'Remote',
            link: job.jobUrl,
            source: 'Reed',
            description: job.jobDescription || '',
            salary: job.maximumSalary ? 
                `${job.minimumSalary}-${job.maximumSalary} ${job.currency}` : 
                'Salary not specified',
            type: job.employmentType || 'Full-time',
            datePosted: job.datePosted || new Date().toISOString()
        };
    }
}
