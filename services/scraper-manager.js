// scraper-manager.js - Manager for web scraping services

import { IndeedScraper } from './scrapers/indeed-scraper.js';
import { JoobleScraper } from './scrapers/jooble-scraper.js';
import { ZipRecruiterScraper } from './scrapers/ziprecruiter-scraper.js';
import { WeWorkRemotelyScraper } from './scrapers/weworkremotely-scraper.js';
import { CareerJetScraper } from './scrapers/careerjet-scraper.js';

/**
 * Manager for web scraping services
 * Coordinates multiple scrapers and provides unified interface
 */
export class ScraperManager {
    constructor() {
        this.scrapers = {
            indeed: new IndeedScraper(),
            jooble: new JoobleScraper(),
            ziprecruiter: new ZipRecruiterScraper(),
            weworkremotely: new WeWorkRemotelyScraper(),
            careerjet: new CareerJetScraper()
        };
        
        this.scraperStatus = {
            indeed: { available: true, lastUsed: null, errors: 0 },
            jooble: { available: true, lastUsed: null, errors: 0 },
            ziprecruiter: { available: true, lastUsed: null, errors: 0 },
            weworkremotely: { available: true, lastUsed: null, errors: 0 },
            careerjet: { available: true, lastUsed: null, errors: 0 }
        };
    }

    /**
     * Get available scrapers
     */
    getAvailableScrapers() {
        return Object.keys(this.scrapers).filter(name => 
            this.scraperStatus[name].available
        );
    }

    /**
     * Get scraper status report
     */
    getStatusReport() {
        const total = Object.keys(this.scrapers).length;
        const available = this.getAvailableScrapers().length;
        const unavailable = total - available;
        
        return {
            totalScrapers: total,
            availableScrapers: available,
            unavailableScrapers: unavailable,
            healthPercentage: Math.round((available / total) * 100),
            scrapers: this.scraperStatus,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Search jobs using all available scrapers
     */
    async searchJobs(query, filters = {}, onProgress = null) {
        const availableScrapers = this.getAvailableScrapers();
        const allJobs = [];
        const results = {};

        console.log(`🔍 Starting web scraping with ${availableScrapers.length} scrapers`);
        console.log(`   Query: "${query}"`);
        console.log(`   Filters:`, filters);

        // Search with each scraper in parallel
        const searchPromises = availableScrapers.map(async (scraperName) => {
            try {
                if (onProgress) {
                    onProgress({
                        type: 'scraper_start',
                        scraper: scraperName,
                        message: `Starting ${scraperName} scraper...`
                    });
                }

                const scraper = this.scrapers[scraperName];
                const jobs = await scraper.searchJobs(query, filters);
                
                this.scraperStatus[scraperName].lastUsed = new Date().toISOString();
                this.scraperStatus[scraperName].errors = 0;
                
                results[scraperName] = {
                    success: true,
                    jobs: jobs,
                    count: jobs.length
                };

                if (onProgress) {
                    onProgress({
                        type: 'scraper_complete',
                        scraper: scraperName,
                        message: `Found ${jobs.length} jobs from ${scraperName}`,
                        count: jobs.length
                    });
                }

                return jobs;
            } catch (error) {
                console.error(`❌ Scraper ${scraperName} failed:`, error.message);
                
                this.scraperStatus[scraperName].errors++;
                if (this.scraperStatus[scraperName].errors >= 3) {
                    this.scraperStatus[scraperName].available = false;
                    console.log(`⚠️ Disabling ${scraperName} scraper due to repeated failures`);
                }
                
                results[scraperName] = {
                    success: false,
                    error: error.message,
                    jobs: [],
                    count: 0
                };

                if (onProgress) {
                    onProgress({
                        type: 'scraper_error',
                        scraper: scraperName,
                        message: `${scraperName} scraper failed: ${error.message}`,
                        error: error.message
                    });
                }

                return [];
            }
        });

        // Wait for all scrapers to complete
        const scraperResults = await Promise.allSettled(searchPromises);
        
        // Collect all jobs
        scraperResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allJobs.push(...result.value);
            }
        });

        // Remove duplicates based on title and company
        const uniqueJobs = this.removeDuplicates(allJobs);
        
        console.log(`🎯 Scraping completed: ${uniqueJobs.length} unique jobs from ${availableScrapers.length} sources`);

        return {
            jobs: uniqueJobs,
            totalJobs: uniqueJobs.length,
            results: results,
            scrapersUsed: availableScrapers.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Remove duplicate jobs
     */
    removeDuplicates(jobs) {
        const seen = new Set();
        const unique = [];

        jobs.forEach(job => {
            // Create a key based on title and company
            const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(job);
            }
        });

        return unique;
    }

    /**
     * Get user-friendly messages for scraper status
     */
    getUserFriendlyMessages() {
        const messages = [];
        const status = this.getStatusReport();
        
        if (status.healthPercentage < 50) {
            messages.push({
                type: 'warning',
                title: 'Limited Scraping Sources',
                message: `Only ${status.availableScrapers} out of ${status.totalScrapers} scraping sources are available. Results may be limited.`,
                action: 'continue_search'
            });
        } else if (status.healthPercentage < 80) {
            messages.push({
                type: 'info',
                title: 'Some Scraping Sources Unavailable',
                message: `${status.availableScrapers} out of ${status.totalScrapers} scraping sources are working. You're getting results from available sources.`,
                action: 'continue_search'
            });
        }

        // Check for specific scraper issues
        Object.entries(this.scraperStatus).forEach(([name, status]) => {
            if (!status.available) {
                const displayName = this.getScraperDisplayName(name);
                messages.push({
                    type: 'warning',
                    title: `${displayName} Temporarily Unavailable`,
                    message: `${displayName} scraper is temporarily unavailable due to technical issues. Please try again later.`,
                    action: 'try_again_later',
                    scraper: name
                });
            }
        });

        return messages;
    }

    /**
     * Get display name for scraper
     */
    getScraperDisplayName(name) {
        const names = {
            indeed: 'Indeed',
            jooble: 'Jooble',
            ziprecruiter: 'ZipRecruiter',
            weworkremotely: 'We Work Remotely',
            careerjet: 'CareerJet'
        };
        return names[name] || name;
    }

    /**
     * Reset scraper status
     */
    resetScraperStatus() {
        Object.keys(this.scraperStatus).forEach(name => {
            this.scraperStatus[name] = {
                available: true,
                lastUsed: null,
                errors: 0
            };
        });
        
        console.log('🔄 Scraper status reset');
    }

    /**
     * Close all scrapers
     */
    async close() {
        const closePromises = Object.values(this.scrapers).map(scraper => 
            scraper.close().catch(error => 
                console.error('Error closing scraper:', error.message)
            )
        );
        
        await Promise.allSettled(closePromises);
        console.log('🔒 All scrapers closed');
    }
}

// Export singleton instance
export const scraperManager = new ScraperManager();
