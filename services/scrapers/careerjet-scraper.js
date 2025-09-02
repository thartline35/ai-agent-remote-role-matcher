// careerjet-scraper.js - CareerJet job scraper

import { BaseScraper } from '../base-scraper.js';

export class CareerJetScraper extends BaseScraper {
    constructor() {
        super('CareerJet', 'https://www.careerjet.com');
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

        return `${this.baseUrl}/search/jobs?${params.toString()}`;
    }

    extractJobs($) {
        const jobs = [];
        
        // CareerJet job listings
        $('.job').each((index, element) => {
            try {
                const $job = $(element);
                
                const title = $job.find('.job-title a').text().trim();
                const company = $job.find('.company').text().trim();
                const location = $job.find('.location').text().trim();
                const salary = $job.find('.salary').text().trim();
                const description = $job.find('.job-description').text().trim();
                
                const url = $job.find('.job-title a').attr('href');
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
                console.error('Error extracting CareerJet job:', error.message);
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
