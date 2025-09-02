// jooble-scraper.js - Jooble job scraper

import { BaseScraper } from '../base-scraper.js';

export class JoobleScraper extends BaseScraper {
    constructor() {
        super('Jooble', 'https://us.jooble.org');
    }

    buildSearchUrl(query, filters = {}) {
        const params = new URLSearchParams();
        params.set('keywords', query);
        params.set('location', filters.location || '');
        params.set('radius', filters.radius || '25');
        params.set('sort', 'date');
        
        if (filters.remote) {
            params.set('remote', '1');
        }

        return `${this.baseUrl}/jobs?${params.toString()}`;
    }

    extractJobs($) {
        const jobs = [];
        
        // Jooble job listings
        $('.vacancy').each((index, element) => {
            try {
                const $job = $(element);
                
                const title = $job.find('.vacancy-title a').text().trim();
                const company = $job.find('.company-name').text().trim();
                const location = $job.find('.location').text().trim();
                const salary = $job.find('.salary').text().trim();
                const description = $job.find('.vacancy-description').text().trim();
                
                const url = $job.find('.vacancy-title a').attr('href');
                const fullUrl = url ? (url.startsWith('http') ? url : `${this.baseUrl}${url}`) : '';
                
                if (title && company) {
                    jobs.push({
                        id: this.generateJobId({ title, company, url: fullUrl }),
                        title,
                        company,
                        location,
                        description,
                        salary,
                        url: fullUrl,
                        postedDate: this.extractPostedDate($job)
                    });
                }
            } catch (error) {
                console.error('Error extracting Jooble job:', error.message);
            }
        });

        return jobs;
    }

    extractPostedDate($job) {
        const postedText = $job.find('.date').text().trim();
        if (!postedText) return new Date().toISOString();
        
        // Parse relative dates
        const now = new Date();
        if (postedText.includes('day')) {
            const days = parseInt(postedText.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        } else if (postedText.includes('week')) {
            const weeks = parseInt(postedText.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        return new Date().toISOString();
    }
}
