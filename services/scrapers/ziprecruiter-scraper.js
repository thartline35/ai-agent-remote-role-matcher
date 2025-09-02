// ziprecruiter-scraper.js - ZipRecruiter job scraper

import { BaseScraper } from '../base-scraper.js';

export class ZipRecruiterScraper extends BaseScraper {
    constructor() {
        super('ZipRecruiter', 'https://www.ziprecruiter.com');
    }

    buildSearchUrl(query, filters = {}) {
        const params = new URLSearchParams();
        params.set('search', query);
        params.set('location', filters.location || '');
        params.set('radius', filters.radius || '25');
        params.set('days', filters.days || '7');
        
        if (filters.remote) {
            params.set('remote', '1');
        }

        return `${this.baseUrl}/jobs?${params.toString()}`;
    }

    extractJobs($) {
        const jobs = [];
        
        // ZipRecruiter job cards
        $('.job_content').each((index, element) => {
            try {
                const $job = $(element);
                
                const title = $job.find('.job_link').text().trim();
                const company = $job.find('.company_name').text().trim();
                const location = $job.find('.job_location').text().trim();
                const salary = $job.find('.job_salary').text().trim();
                const description = $job.find('.job_snippet').text().trim();
                
                const url = $job.find('.job_link').attr('href');
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
                console.error('Error extracting ZipRecruiter job:', error.message);
            }
        });

        return jobs;
    }

    extractPostedDate($job) {
        const postedText = $job.find('.job_posted_date').text().trim();
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
