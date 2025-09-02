// services/adzuna-api.js - Adzuna API service

import { BaseApi } from './base-api.js';

/**
 * Adzuna API service
 * Real job listings from multiple sources
 */
export class AdzunaApi extends BaseApi {
    constructor() {
        super('adzuna');
    }

    /**
     * Search for jobs using Adzuna API
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        const requestConfig = {
            method: 'GET',
            url: `${this.config.baseUrl}/api/jobs/us/search/1`,
            params: {
                app_id: this.config.appId,
                app_key: this.config.apiKey,
                what: query.replace('remote ', ''),
                where: 'remote',
                results_per_page: 50,
                sort_by: 'relevance'
            }
        };

        const response = await this.makeRequest(requestConfig);

        if (!response.data?.results) {
            throw new Error('No results field in response');
        }

        return response.data.results.map(job => this.standardizeJob(job));
    }

    /**
     * Standardize job object from Adzuna API
     * @param {Object} job - Raw job object from API
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        return {
            title: job.title,
            company: job.company?.display_name || 'Unknown Company',
            location: job.location?.display_name || 'Remote',
            link: job.redirect_url,
            source: 'Adzuna',
            description: job.description || '',
            salary: this.formatSalary(job.salary_min, job.salary_max),
            type: job.contract_time || 'Full-time',
            datePosted: job.created || new Date().toISOString()
        };
    }

    /**
     * Format salary from min/max values
     * @param {number} min - Minimum salary
     * @param {number} max - Maximum salary
     * @returns {string} Formatted salary string
     */
    formatSalary(min, max) {
        if (min && max) {
            const minFormatted = min >= 1000 ? `${Math.round(min/1000)}k` : min.toLocaleString();
            const maxFormatted = max >= 1000 ? `${Math.round(max/1000)}k` : max.toLocaleString();
            return `$${minFormatted} - $${maxFormatted}`;
        } else if (min) {
            const minFormatted = min >= 1000 ? `${Math.round(min/1000)}k` : min.toLocaleString();
            return `From $${minFormatted}`;
        } else if (max) {
            const maxFormatted = max >= 1000 ? `${Math.round(max/1000)}k` : max.toLocaleString();
            return `Up to $${maxFormatted}`;
        }
        return 'Salary not specified';
    }
}
