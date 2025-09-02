// services/rapidapi-jobs.js - RapidAPI Jobs service

import { BaseApi } from './base-api.js';

/**
 * RapidAPI Jobs service
 * Alternative job aggregator with multiple job board sources
 */
export class RapidApiJobs extends BaseApi {
    constructor() {
        super('rapidapi');
        this.serviceName = 'Jobs';
    }

    /**
     * Search for jobs using RapidAPI Jobs
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        const requestConfig = {
            method: 'GET',
            url: this.config.services.jobs.url,
            params: {
                query: query,
                location: 'Remote',
                distance: '1.0',
                language: 'en_GB',
                remoteOnly: 'true',
                datePosted: 'month',
                jobType: 'fulltime',
                index: '0'
            },
            headers: {
                'X-RapidAPI-Key': this.config.key,
                'X-RapidAPI-Host': this.config.services.jobs.host
            }
        };

        const response = await this.makeRequest(requestConfig);

        if (!response.data?.jobs) {
            throw new Error('No jobs field in response');
        }

        return response.data.jobs.map(job => this.standardizeJob(job));
    }

    /**
     * Standardize job object from RapidAPI Jobs
     * @param {Object} job - Raw job object from API
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        return {
            title: job.title,
            company: job.company || 'Unknown Company',
            location: job.location || 'Remote',
            link: job.url,
            source: 'RapidAPI-Jobs',
            description: job.description || '',
            salary: job.salary || 'Salary not specified',
            type: job.jobType || 'Full-time',
            datePosted: job.datePosted || new Date().toISOString()
        };
    }
}
