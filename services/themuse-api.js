// services/themuse-api.js - TheMuse API service

import { BaseApi } from './base-api.js';

/**
 * TheMuse API service
 * Company culture-focused job listings
 */
export class TheMuseApi extends BaseApi {
    constructor() {
        super('themuse');
    }

    /**
     * Search for jobs using TheMuse API
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        // Determine categories based on query
        const categories = this.getCategoriesFromQuery(query);

        const requestConfig = {
            method: 'GET',
            url: `${this.config.baseUrl}/jobs`,
            params: {
                api_key: this.config.key,
                page: 0,
                limit: 50,
                location: 'Remote',
                q: query,
                level: filters.experience || undefined,
                ...(categories.length > 0 && { category: categories.join(',') })
            }
        };

        const response = await this.makeRequest(requestConfig);

        if (!response.data?.results) {
            throw new Error('No results field in response');
        }

        return response.data.results.map(job => this.standardizeJob(job));
    }

    /**
     * Get relevant categories from search query
     * @param {string} query - Search query
     * @returns {Array} Array of category names
     */
    getCategoriesFromQuery(query) {
        const categories = [];
        const queryLower = query.toLowerCase();

        if (queryLower.includes('developer') || queryLower.includes('engineer') || queryLower.includes('programming')) {
            categories.push('Engineering');
        }
        if (queryLower.includes('data') || queryLower.includes('analyst')) {
            categories.push('Data Science');
        }
        if (queryLower.includes('manager') || queryLower.includes('product')) {
            categories.push('Product');
        }
        if (queryLower.includes('design')) {
            categories.push('Design');
        }

        return categories;
    }

    /**
     * Standardize job object from TheMuse API
     * @param {Object} job - Raw job object from API
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        return {
            title: job.name,
            company: job.company?.name || 'Unknown Company',
            location: 'Remote',
            link: job.refs?.landing_page,
            source: 'TheMuse',
            description: job.contents || '',
            salary: 'Salary not specified',
            type: job.type || 'Full-time',
            datePosted: job.publication_date || new Date().toISOString()
        };
    }
}
