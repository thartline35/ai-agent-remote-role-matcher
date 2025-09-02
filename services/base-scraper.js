// base-scraper.js - Base class for web scraping job boards

import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import UserAgent from 'user-agents';

/**
 * Base class for web scraping job boards
 * Provides common functionality for all scrapers
 */
export class BaseScraper {
    constructor(name, baseUrl) {
        this.name = name;
        this.baseUrl = baseUrl;
        this.userAgent = new UserAgent();
        this.browser = null;
        this.page = null;
    }

    /**
     * Initialize browser for scraping
     */
    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }

    /**
     * Create a new page with proper headers
     */
    async createPage() {
        const browser = await this.initBrowser();
        this.page = await browser.newPage();
        
        // Set user agent and headers
        await this.page.setUserAgent(this.userAgent.toString());
        await this.page.setViewport({ width: 1366, height: 768 });
        
        // Set extra headers
        await this.page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });

        return this.page;
    }

    /**
     * Make HTTP request with proper headers
     */
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'User-Agent': this.userAgent.toString(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            timeout: 30000,
            ...options
        };

        try {
            const response = await axios.get(url, defaultOptions);
            return response.data;
        } catch (error) {
            console.error(`HTTP request failed for ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Scrape page using Puppeteer
     */
    async scrapeWithPuppeteer(url, waitForSelector = null) {
        try {
            const page = await this.createPage();
            
            // Navigate to the page
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for specific selector if provided
            if (waitForSelector) {
                await page.waitForSelector(waitForSelector, { timeout: 10000 });
            }

            // Get page content
            const content = await page.content();
            await page.close();
            
            return content;
        } catch (error) {
            console.error(`Puppeteer scraping failed for ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Parse HTML content with Cheerio
     */
    parseHTML(html) {
        return cheerio.load(html);
    }

    /**
     * Clean and normalize job data
     */
    normalizeJobData(job) {
        return {
            id: job.id || this.generateJobId(job),
            title: this.cleanText(job.title),
            company: this.cleanText(job.company),
            location: this.cleanText(job.location),
            description: this.cleanText(job.description),
            url: job.url,
            salary: job.salary ? this.cleanText(job.salary) : null,
            postedDate: job.postedDate || new Date().toISOString(),
            source: this.name,
            type: 'scraped',
            remote: this.detectRemote(job.title, job.description, job.location)
        };
    }

    /**
     * Clean text content
     */
    cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();
    }

    /**
     * Generate unique job ID
     */
    generateJobId(job) {
        const title = job.title || '';
        const company = job.company || '';
        const url = job.url || '';
        return Buffer.from(`${title}-${company}-${url}`).toString('base64').slice(0, 20);
    }

    /**
     * Detect if job is remote
     */
    detectRemote(title, description, location) {
        const remoteKeywords = [
            'remote', 'work from home', 'wfh', 'virtual', 'telecommute',
            'distributed', 'anywhere', 'flexible location'
        ];
        
        const text = `${title} ${description} ${location}`.toLowerCase();
        return remoteKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Build search URL with parameters
     */
    buildSearchUrl(query, filters = {}) {
        throw new Error('buildSearchUrl must be implemented by subclass');
    }

    /**
     * Extract jobs from page content
     */
    extractJobs($) {
        throw new Error('extractJobs must be implemented by subclass');
    }

    /**
     * Search for jobs
     */
    async searchJobs(query, filters = {}) {
        try {
            console.log(`🔍 Scraping ${this.name} for: "${query}"`);
            
            const searchUrl = this.buildSearchUrl(query, filters);
            console.log(`   URL: ${searchUrl}`);
            
            // Try HTTP request first, fallback to Puppeteer
            let content;
            try {
                content = await this.makeRequest(searchUrl);
            } catch (error) {
                console.log(`   HTTP failed, trying Puppeteer...`);
                content = await this.scrapeWithPuppeteer(searchUrl);
            }
            
            const $ = this.parseHTML(content);
            const jobs = this.extractJobs($);
            
            console.log(`   Found ${jobs.length} jobs`);
            return jobs.map(job => this.normalizeJobData(job));
            
        } catch (error) {
            console.error(`❌ Scraping failed for ${this.name}:`, error.message);
            return [];
        }
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
