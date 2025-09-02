// indeed-scraper.js - Indeed job scraper

import { BaseScraper } from '../base-scraper.js';

export class IndeedScraper extends BaseScraper {
    constructor() {
        super('Indeed', 'https://www.indeed.com');
    }

    buildSearchUrl(query, filters = {}) {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('l', filters.location || '');
        params.set('radius', filters.radius || '25');
        params.set('sort', 'date');
        params.set('fromage', filters.days || '7');
        
        if (filters.remote) {
            params.set('remotejob', '1');
        }
        
        if (filters.experience) {
            params.set('explvl', this.mapExperienceLevel(filters.experience));
        }

        return `${this.baseUrl}/jobs?${params.toString()}`;
    }

    mapExperienceLevel(level) {
        const mapping = {
            'entry': 'entry_level',
            'mid': 'mid_level', 
            'senior': 'senior_level',
            'executive': 'executive'
        };
        return mapping[level] || '';
    }

    extractJobs($) {
        const jobs = [];
        
        // Indeed job cards
        $('[data-jk]').each((index, element) => {
            try {
                const $job = $(element);
                const jobId = $job.attr('data-jk');
                
                const title = $job.find('h2 a span[title]').attr('title') || 
                             $job.find('h2 a').text().trim();
                
                const company = $job.find('[data-testid="company-name"]').text().trim() ||
                               $job.find('.companyName').text().trim();
                
                const location = $job.find('[data-testid="job-location"]').text().trim() ||
                                $job.find('.companyLocation').text().trim();
                
                const salary = $job.find('[data-testid="attribute_snippet_testid"]').text().trim() ||
                              $job.find('.salary-snippet').text().trim();
                
                const description = $job.find('.job-snippet').text().trim();
                
                const url = $job.find('h2 a').attr('href');
                const fullUrl = url ? `${this.baseUrl}${url}` : '';
                
                if (title && company) {
                    jobs.push({
                        id: jobId,
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
                console.error('Error extracting Indeed job:', error.message);
            }
        });

        return jobs;
    }

    extractPostedDate($job) {
        const postedText = $job.find('.date').text().trim();
        if (!postedText) return new Date().toISOString();
        
        // Parse relative dates like "2 days ago", "1 week ago"
        const now = new Date();
        if (postedText.includes('day')) {
            const days = parseInt(postedText.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        } else if (postedText.includes('week')) {
            const weeks = parseInt(postedText.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (postedText.includes('month')) {
            const months = parseInt(postedText.match(/(\d+)/)?.[1] || '0');
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        return new Date().toISOString();
    }
}
