// services/rapidapi-jsearch.js - RapidAPI JSearch service

import { BaseApi } from './base-api.js';

/**
 * RapidAPI JSearch service
 * Job search aggregator with multiple job board sources
 */
export class RapidApiJSearch extends BaseApi {
    constructor() {
        super('rapidapi');
        this.serviceName = 'JSearch';
    }

    /**
     * Search for jobs using RapidAPI JSearch
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        const requestConfig = {
            method: 'GET',
            url: this.config.services.jsearch.url,
            params: {
                query: query,
                page: '1',
                num_pages: '2',
                remote_jobs_only: 'true'
            },
            headers: {
                'X-RapidAPI-Key': this.config.key,
                'X-RapidAPI-Host': this.config.services.jsearch.host
            }
        };

        const response = await this.makeRequest(requestConfig);

        // Log quota information if available
        if (response.headers['x-rapidapi-quota-left']) {
            const quotaLeft = parseInt(response.headers['x-rapidapi-quota-left']);
            console.log(`📊 RapidAPI quota remaining: ${quotaLeft}`);
            
            if (quotaLeft <= 5) {
                console.log(`⚠️ RapidAPI quota very low: ${quotaLeft} requests left`);
            }
        }

        if (!response.data?.data) {
            throw new Error('No data field in response');
        }

        return response.data.data
            .filter(job => job && job.job_title && job.employer_name)
            .map(job => this.standardizeJob(job));
    }

    /**
     * Standardize job object from RapidAPI JSearch
     * @param {Object} job - Raw job object from API
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        return {
            title: job.job_title,
            company: job.employer_name,
            location: job.job_city ? 
                `${job.job_city}, ${job.job_state || job.job_country}` : 
                'Remote',
            link: job.job_apply_link || job.job_url || '#',
            source: 'JSearch-RapidAPI',
            description: job.job_description || '',
            salary: this.formatSalary(job.job_min_salary, job.job_max_salary),
            type: job.job_employment_type || 'Full-time',
            datePosted: job.job_posted_at_datetime_utc || new Date().toISOString()
        };
    }

    /**
     * Format salary from min/max values
     * @param {number|string} minSalary - Minimum salary
     * @param {number|string} maxSalary - Maximum salary
     * @returns {string} Formatted salary string
     */
    formatSalary(minSalary, maxSalary) {
        let min = null, max = null;
        
        try {
            if (typeof minSalary === 'number' && minSalary > 0) {
                min = minSalary;
            } else if (typeof minSalary === 'string' && minSalary.trim()) {
                const parsed = parseFloat(minSalary.replace(/[^0-9.]/g, ''));
                if (!isNaN(parsed) && parsed > 0) {
                    min = parsed;
                }
            }
            
            if (typeof maxSalary === 'number' && maxSalary > 0) {
                max = maxSalary;
            } else if (typeof maxSalary === 'string' && maxSalary.trim()) {
                const parsed = parseFloat(maxSalary.replace(/[^0-9.]/g, ''));
                if (!isNaN(parsed) && parsed > 0) {
                    max = parsed;
                }
            }
        } catch (error) {
            return 'Salary not specified';
        }
        
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
