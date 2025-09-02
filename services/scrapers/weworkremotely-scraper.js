// weworkremotely-scraper.js - We Work Remotely job scraper

import { BaseScraper } from '../base-scraper.js';

export class WeWorkRemotelyScraper extends BaseScraper {
    constructor() {
        super('We Work Remotely', 'https://weworkremotely.com');
    }

    buildSearchUrl(query, filters = {}) {
        const params = new URLSearchParams();
        params.set('utf8', '✓');
        params.set('term', query);
        
        // We Work Remotely categories
        if (filters.category) {
            params.set('category', filters.category);
        }

        return `${this.baseUrl}/remote-jobs/search?${params.toString()}`;
    }

    extractJobs($) {
        const jobs = [];
        
        // We Work Remotely job listings
        $('.jobs .job').each((index, element) => {
            try {
                const $job = $(element);
                
                const title = $job.find('.title a').text().trim();
                const company = $job.find('.company').text().trim();
                const location = 'Remote'; // All jobs on this site are remote
                const description = $job.find('.description').text().trim();
                
                const url = $job.find('.title a').attr('href');
                const fullUrl = url ? `${this.baseUrl}${url}` : '';
                
                if (title && company) {
                    jobs.push({
                        id: this.generateJobId({ title, company, url: fullUrl }),
                        title,
                        company,
                        location,
                        description,
                        salary: null, // Usually not provided
                        url: fullUrl,
                        postedDate: this.extractPostedDate($job),
                        remote: true // All jobs are remote
                    });
                }
            } catch (error) {
                console.error('Error extracting We Work Remotely job:', error.message);
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
