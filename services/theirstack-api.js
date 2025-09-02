// services/theirstack-api.js - Theirstack API service

import { BaseApi } from './base-api.js';

/**
 * Theirstack API service
 * Primary job search source with comprehensive listings
 */
export class TheirstackApi extends BaseApi {
    constructor() {
        super('theirstack');
        this.usageLimit = 200; // Free tier limit
    }

    /**
     * Search for jobs using Theirstack API
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        if (this.usageCount >= this.usageLimit) {
            throw new Error(`Theirstack usage limit reached (${this.usageLimit} requests)`);
        }

        const requestConfig = {
            method: 'GET',
            url: `${this.config.baseUrl}/jobs/search`,
            params: {
                query: query,
                location: 'Remote',
                limit: 50
            },
            headers: {
                'Authorization': `Bearer ${this.config.key}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await this.makeRequest(requestConfig);

        if (!response.data?.jobs) {
            throw new Error('No jobs field in response');
        }

        return response.data.jobs.map(job => this.standardizeJob(job));
    }

    /**
     * Standardize job object from Theirstack API
     * @param {Object} job - Raw job object from API
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        return {
            title: job.title,
            company: job.company?.name || 'Unknown Company',
            location: job.location || 'Remote',
            link: job.url,
            source: 'Theirstack',
            description: job.description || '',
            salary: job.salary?.range ? 
                `${job.salary.range.min}-${job.salary.range.max} ${job.salary.currency}` : 
                'Salary not specified',
            type: job.type || 'Full-time',
            datePosted: job.posted_at || new Date().toISOString()
        };
    }

    /**
     * Get remaining usage quota
     * @returns {number} Remaining requests
     */
    getRemainingQuota() {
        return Math.max(0, this.usageLimit - this.usageCount);
    }

    /**
     * Check if quota is available
     * @returns {boolean} True if quota available
     */
    hasQuotaAvailable() {
        return this.usageCount < this.usageLimit;
    }
}
