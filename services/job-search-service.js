// services/job-search-service.js - Modular job search service

import { apiManager } from './api-manager.js';
import { scraperManager } from './scraper-manager.js';
import { cacheManager } from './cache-manager.js';
import { apiConfig } from '../config/api-config.js';
import OpenAI from 'openai';

/**
 * Job Search Service - High-level service for job searching
 * Coordinates multiple APIs and provides unified interface
 */
export class JobSearchService {
    constructor() {
        this.openai = null;
        this.initializeOpenAI();
    }

    /**
     * Initialize OpenAI client
     */
    initializeOpenAI() {
        const openaiConfig = apiConfig.getConfig('openai');
        if (openaiConfig && openaiConfig.key) {
            this.openai = new OpenAI({
                apiKey: openaiConfig.key,
                timeout: openaiConfig.timeout,
                maxRetries: openaiConfig.maxRetries
            });
        }
    }

    /**
     * Generate focused search queries based on resume analysis
     * @param {Object} analysis - Resume analysis object
     * @returns {Array} Array of search queries
     */
    generateSearchQueries(analysis) {
        const queries = new Set();
        
        // Generate queries from work experience
        if (analysis.workExperience && analysis.workExperience.length > 0) {
            analysis.workExperience.slice(0, 3).forEach(exp => {
                let expStr = '';
                if (typeof exp === 'string') {
                    expStr = exp.toLowerCase();
                } else if (exp && typeof exp === 'object') {
                    if (exp.jobTitle) {
                        expStr = exp.jobTitle.toLowerCase();
                    } else if (exp.title) {
                        expStr = exp.title.toLowerCase();
                    } else if (exp.role) {
                        expStr = exp.role.toLowerCase();
                    } else {
                        const values = Object.values(exp).filter(v => v && typeof v === 'string');
                        expStr = values.length > 0 ? values[0].toLowerCase() : '';
                    }
                } else {
                    expStr = String(exp || '').toLowerCase();
                }
                
                if (expStr.includes('engineer')) queries.add('remote software engineer');
                else if (expStr.includes('developer')) queries.add('remote developer');
                else if (expStr.includes('manager')) queries.add('remote manager');
                else if (expStr.includes('analyst')) queries.add('remote analyst');
                else if (expStr.includes('designer')) queries.add('remote designer');
                else if (expStr.includes('consultant')) queries.add('remote consultant');
                else if (expStr.length > 0) queries.add(`remote ${expStr.split(' ')[0]}`);
            });
        }
        
        // Generate queries from technical skills
        if (analysis.technicalSkills && analysis.technicalSkills.length > 0) {
            const topSkills = analysis.technicalSkills.slice(0, 2);
            topSkills.forEach(skill => {
                let skillStr = '';
                if (typeof skill === 'string') {
                    skillStr = skill.toLowerCase();
                } else if (skill && typeof skill === 'object') {
                    const values = Object.values(skill).filter(v => v && typeof v === 'string');
                    skillStr = values.length > 0 ? values[0].toLowerCase() : '';
                } else {
                    skillStr = String(skill || '').toLowerCase();
                }
                
                if (skillStr === 'javascript') queries.add('remote javascript developer');
                else if (skillStr === 'python') queries.add('remote python developer');
                else if (skillStr === 'react') queries.add('remote react developer');
                else if (skillStr.length > 2) queries.add(`remote ${skillStr}`);
            });
        }
        
        // Add default queries if not enough generated
        if (queries.size < 3) {
            queries.add('remote software engineer');
            queries.add('remote developer');
            queries.add('remote manager');
        }
        
        return Array.from(queries).slice(0, 6);
    }

    /**
     * Check if job is remote
     * @param {Object} job - Job object
     * @returns {boolean} True if job is remote
     */
    isRemoteJob(job) {
        if (!job) return false;
        
        const title = (job.title || '').toLowerCase();
        const location = (job.location || '').toLowerCase();
        const description = (job.description || '').toLowerCase().substring(0, 800);
        
        if (location.includes('remote') || 
            location.includes('anywhere') || 
            location.includes('worldwide') ||
            location.includes('global') ||
            location.includes('flexible') ||
            location === '') {
            return true;
        }
        
        const remoteKeywords = [
            'remote', 'work from home', 'wfh', 'anywhere', 'distributed',
            'fully remote', '100% remote', 'remote-first', 'remote only',
            'virtual', 'telecommute', 'work remotely', 'remote work',
            'home-based', 'home based', 'flexible location'
        ];
        
        for (const keyword of remoteKeywords) {
            if (title.includes(keyword) || description.includes(keyword)) {
                return true;
            }
        }
        
        if (title.includes('developer') || 
            title.includes('engineer') || 
            title.includes('analyst') ||
            title.includes('designer')) {
            return true;
        }
        
        return false;
    }

    /**
     * Apply user filters to jobs
     * @param {Array} jobs - Array of job objects
     * @param {Object} filters - User filters
     * @returns {Array} Filtered jobs
     */
    applyFilters(jobs, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return jobs;
        }

        console.log(`🔍 Applying filters:`, filters);
        console.log(`📊 Initial jobs count: ${jobs.length}`);
        
        let filteredJobs = [...jobs];

        // Salary filter
        if (filters.salary && filters.salary !== '') {
            const salaryThreshold = this.getSalaryThreshold(filters.salary);
            console.log(`💰 Salary threshold: ${salaryThreshold} (${filters.salary})`);
            
            if (salaryThreshold > 0) {
                const beforeSalaryFilter = filteredJobs.length;
                filteredJobs = filteredJobs.filter(job => {
                    const salaryNumbers = this.extractSalaryNumbers(job.salary);
                    
                    let passes = true;
                    
                    if (salaryNumbers.min > 0 || salaryNumbers.max > 0) {
                        if (salaryNumbers.min > 0 && salaryNumbers.max > 0) {
                            passes = salaryNumbers.max >= salaryThreshold;
                        } else if (salaryNumbers.min > 0) {
                            passes = salaryNumbers.min >= salaryThreshold;
                        } else if (salaryNumbers.max > 0) {
                            passes = salaryNumbers.max >= salaryThreshold;
                        }
                    }
                    
                    return passes;
                });
                console.log(`💰 Salary filter: ${beforeSalaryFilter} -> ${filteredJobs.length} jobs`);
            }
        }

        // Experience filter
        if (filters.experience && filters.experience !== '') {
            const beforeExperienceFilter = filteredJobs.length;
            console.log(`👔 Experience filter: ${filters.experience}`);
            
            filteredJobs = filteredJobs.filter(job => {
                const title = job.title.toLowerCase();
                const description = (job.description || '').toLowerCase();
                
                let passes = false;
                
                if (filters.experience === 'entry') {
                    passes = title.includes('junior') || title.includes('entry') || title.includes('associate') || 
                           description.includes('entry level') || description.includes('junior');
                } else if (filters.experience === 'mid') {
                    passes = !title.includes('senior') && !title.includes('lead') && !title.includes('principal') &&
                           !title.includes('junior') && !title.includes('entry') && !title.includes('director');
                } else if (filters.experience === 'senior') {
                    passes = title.includes('senior') || title.includes('lead') || title.includes('principal') ||
                           description.includes('senior') || description.includes('5+ years');
                } else if (filters.experience === 'lead') {
                    passes = title.includes('lead') || title.includes('manager') || title.includes('principal') || 
                           title.includes('architect') || title.includes('director') || title.includes('head of');
                } else {
                    passes = true;
                }
                
                return passes;
            });
            console.log(`👔 Experience filter: ${beforeExperienceFilter} -> ${filteredJobs.length} jobs`);
        }

        // Timezone filter
        if (filters.timezone && filters.timezone !== '') {
            const beforeTimezoneFilter = filteredJobs.length;
            console.log(`🌍 Timezone filter: ${filters.timezone}`);
            
            filteredJobs = filteredJobs.filter(job => {
                const description = (job.description || '').toLowerCase();
                const location = (job.location || '').toLowerCase();
                
                let passes = false;
                
                if (filters.timezone === 'us-only') {
                    passes = description.includes('us') || description.includes('united states') || 
                           location.includes('us') || description.includes('est') || description.includes('pst');
                } else if (filters.timezone === 'global') {
                    passes = description.includes('global') || description.includes('worldwide') || 
                           description.includes('international') || description.includes('any timezone');
                } else if (filters.timezone === 'europe') {
                    passes = description.includes('europe') || description.includes('eu') || 
                           description.includes('cet') || description.includes('gmt');
                } else {
                    passes = true;
                }
                
                return passes;
            });
            console.log(`🌍 Timezone filter: ${beforeTimezoneFilter} -> ${filteredJobs.length} jobs`);
        }

        console.log(`✅ Final filtered jobs count: ${filteredJobs.length}`);
        return filteredJobs;
    }

    /**
     * Get salary threshold from filter
     * @param {string} salaryFilter - Salary filter string
     * @returns {number} Salary threshold
     */
    getSalaryThreshold(salaryFilter) {
        const thresholds = {
            '50k': 50000,
            '75k': 75000,
            '100k': 100000,
            '125k': 125000,
            '150k': 150000
        };
        return thresholds[salaryFilter] || 0;
    }

    /**
     * Extract salary numbers from salary string
     * @param {string} salaryStr - Salary string
     * @returns {Object} Min and max salary numbers
     */
    extractSalaryNumbers(salaryStr) {
        if (!salaryStr || salaryStr === 'Salary not specified') {
            return { min: 0, max: 0 };
        }
        
        const salary = salaryStr.toLowerCase();
        let min = 0, max = 0;
        
        const isPounds = salary.includes('£');
        const conversionRate = 1.3;
        
        const isHourly = salary.includes('/hour') || salary.includes('per hour') || salary.includes('/hr') || salary.includes('hourly');
        
        const cleanSalary = salary.replace(/[$£€,]/g, '');
        
        const rangeMatch = cleanSalary.match(/(\d+)(?:k|,000)?\s*[-–to]\s*(\d+)(?:k|,000)?/);
        const singleMatch = cleanSalary.match(/(\d+)(?:k|,000)?/);
        const fromMatch = cleanSalary.match(/from\s+(\d+)(?:k|,000)?/);
        const upToMatch = cleanSalary.match(/up\s+to\s+(\d+)(?:k|,000)?/);
        const betweenMatch = cleanSalary.match(/between\s+(\d+)(?:k|,000)?\s+and\s+(\d+)(?:k|,000)?/);
        
        if (rangeMatch) {
            min = parseInt(rangeMatch[1]);
            max = parseInt(rangeMatch[2]);
            if (salary.includes('k') || min < 1000) {
                min *= 1000;
                max *= 1000;
            }
        } else if (betweenMatch) {
            min = parseInt(betweenMatch[1]);
            max = parseInt(betweenMatch[2]);
            if (salary.includes('k') || min < 1000) {
                min *= 1000;
                max *= 1000;
            }
        } else if (fromMatch) {
            min = parseInt(fromMatch[1]);
            if (salary.includes('k') || min < 1000) {
                min *= 1000;
            }
            max = min;
        } else if (upToMatch) {
            max = parseInt(upToMatch[1]);
            if (salary.includes('k') || max < 1000) {
                max *= 1000;
            }
            min = max;
        } else if (singleMatch) {
            const num = parseInt(singleMatch[1]);
            if (salary.includes('k') || num < 1000) {
                min = max = num * 1000;
            } else {
                min = max = num;
            }
        }
        
        if (isHourly && (min > 0 || max > 0)) {
            min = min * 40 * 52;
            max = max * 40 * 52;
        }
        
        if (isPounds && (min > 0 || max > 0)) {
            min = Math.round(min * conversionRate);
            max = Math.round(max * conversionRate);
        }
        
        return { min, max };
    }

    /**
     * Get user-friendly messages for API status
     * @param {Object} apiStatus - API status report
     * @returns {Array} Array of user-friendly messages
     */
    getUserFriendlyMessages(apiStatus) {
        const messages = [];
        
        // Check for exhausted APIs
        if (apiStatus.exhaustedApis && apiStatus.exhaustedApis.length > 0) {
            apiStatus.exhaustedApis.forEach(apiName => {
                const apiDisplayName = this.getApiDisplayName(apiName);
                messages.push({
                    type: 'warning',
                    title: `${apiDisplayName} Temporarily Unavailable`,
                    message: `${apiDisplayName} has reached its quota limit and is temporarily unavailable. Please try again later or consider upgrading your plan for more requests.`,
                    apiName: apiName,
                    action: 'try_again_later'
                });
            });
        }
        
        // Check for suspicious APIs (multiple empty responses)
        if (apiStatus.suspiciousApis && Object.keys(apiStatus.suspiciousApis).length > 0) {
            Object.keys(apiStatus.suspiciousApis).forEach(apiName => {
                const apiDisplayName = this.getApiDisplayName(apiName);
                const count = apiStatus.suspiciousApis[apiName];
                messages.push({
                    type: 'info',
                    title: `${apiDisplayName} Limited Results`,
                    message: `${apiDisplayName} is returning limited results. This may be due to high demand or temporary issues.`,
                    apiName: apiName,
                    action: 'continue_search'
                });
            });
        }
        
        // Add general system health message
        if (apiStatus.systemHealth) {
            const healthPercentage = apiStatus.systemHealth.healthyPercentage;
            if (healthPercentage < 50) {
                messages.push({
                    type: 'warning',
                    title: 'Limited Job Sources Available',
                    message: `Only ${healthPercentage}% of job sources are currently available. Results may be limited. Please try again later for more comprehensive results.`,
                    action: 'try_again_later'
                });
            } else if (healthPercentage < 80) {
                messages.push({
                    type: 'info',
                    title: 'Some Job Sources Unavailable',
                    message: `${healthPercentage}% of job sources are available. You're getting results from the working sources.`,
                    action: 'continue_search'
                });
            }
        }
        
        return messages;
    }

    /**
     * Get display name for API
     * @param {string} apiName - Internal API name
     * @returns {string} Display name
     */
    getApiDisplayName(apiName) {
        const displayNames = {
            'theirstack': 'Theirstack',
            'adzuna': 'Adzuna',
            'themuse': 'TheMuse',
            'reed': 'Reed',
            'jsearch': 'JSearch',
            'jobs': 'Jobs API',
            'rapidapi': 'RapidAPI'
        };
        return displayNames[apiName] || apiName;
    }

    /**
     * Search for jobs using all available APIs and scrapers
     * @param {Object} analysis - Resume analysis
     * @param {Object} filters - Search filters
     * @param {Function} onJobFound - Callback for found jobs
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<Object>} Search results
     */
    async searchJobs(analysis, filters, onJobFound, onProgress) {
        console.log('=== STARTING MODULAR JOB SEARCH ===');
        
        // Log API configuration status
        apiConfig.logApiStatus();
        
        const queries = this.generateSearchQueries(analysis);
        console.log('📝 Generated search queries:', queries);
        
        // Check cache first
        const cacheKey = cacheManager.generateCacheKey(queries[0], filters);
        const cachedResults = await cacheManager.getCachedJobSearch(queries[0], filters);
        
        if (cachedResults) {
            console.log('💾 Using cached results');
            onProgress('Loading cached results...', 100);
            
            // Stream cached jobs
            if (onJobFound && cachedResults.jobs) {
                cachedResults.jobs.forEach(job => onJobFound(job));
            }
            
            return {
                ...cachedResults,
                cached: true,
                cacheKey: cacheKey.substring(0, 8) + '...'
            };
        }
        
        onProgress('Generating search queries...', 5);
        
        const allJobs = [];
        const processedJobKeys = new Set();
        let currentProgress = 0;
        
        // Define API sources with weights
        const sources = [
            { name: 'jsearch', weight: 20 },
            { name: 'adzuna', weight: 20 },
            { name: 'themuse', weight: 20 },
            { name: 'reed', weight: 15 },
            { name: 'jobs', weight: 15 },
            { name: 'theirstack', weight: 10 }
        ];
        
        for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
            const source = sources[sourceIndex];
            const sourceStartProgress = currentProgress;
            const sourceEndProgress = currentProgress + source.weight;
            
            console.log(`\n🔍 === PROCESSING SOURCE ${sourceIndex + 1}/${sources.length}: ${source.name} ===`);
            
            onProgress(`Searching ${source.name}...`, sourceStartProgress);
            
            try {
                const sourceMatchedJobs = [];
                const maxQueries = source.name === 'reed' ? 10 : 15;
                
                console.log(`📝 ${source.name}: Processing ${maxQueries} queries`);
                
                const delayBetweenQueries = source.name === 'reed' ? 300 : 500;
                
                for (let i = 0; i < Math.min(queries.length, maxQueries); i++) {
                    const query = queries[i];
                    console.log(`   🔎 Query ${i + 1}/${maxQueries}: "${query}"`);
                    
                    try {
                        console.log(`   📞 Calling ${source.name} API...`);
                        const jobs = await apiManager.makeApiCall(source.name, query, filters);
                        
                        console.log(`   📥 ${source.name} returned ${jobs.length} raw jobs`);
                        if (jobs.length > 0) {
                            console.log(`   📋 Sample job titles: ${jobs.slice(0, 3).map(j => j?.title || 'No title').join(', ')}`);
                            
                            // Filter jobs
                            const filteredJobs = jobs.filter(job => {
                                if (!job || !job.title || !job.company) {
                                    console.log(`   ❌ ${source.name}: Skipping job with missing title/company`);
                                    return false;
                                }
                                
                                const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
                                if (processedJobKeys.has(key)) {
                                    console.log(`   ❌ ${source.name}: Skipping duplicate job "${job.title}"`);
                                    return false;
                                }
                                
                                const isRemote = this.isRemoteJob(job);
                                if (!isRemote) {
                                    console.log(`   ❌ ${source.name}: Skipping non-remote job "${job.title}" (location: ${job.location})`);
                                    return false;
                                }
                                
                                processedJobKeys.add(key);
                                return true;
                            });
                            
                            console.log(`   🔍 After filtering: ${filteredJobs.length} jobs`);
                            
                            if (filteredJobs.length > 0) {
                                const userFilteredJobs = this.applyFilters(filteredJobs, filters);
                                console.log(`   ⚙️ After user filters: ${userFilteredJobs.length} jobs`);
                                
                                if (userFilteredJobs.length > 0) {
                                    // For now, add all filtered jobs (AI matching can be added later)
                                    sourceMatchedJobs.push(...userFilteredJobs);
                                    allJobs.push(...userFilteredJobs);
                                    
                                    // Stream results
                                    const currentProgress = sourceStartProgress + ((i + 1) / maxQueries) * source.weight;
                                    onJobFound(userFilteredJobs, source.name, Math.round(currentProgress));
                                }
                            }
                        } else {
                            console.log(`   ⚠️ No jobs returned from ${source.name} for "${query}"`);
                        }
                    } catch (queryError) {
                        console.error(`   ❌ ${source.name} FAILED for "${query}":`, queryError.message);
                        continue;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delayBetweenQueries));
                }
                
                console.log(`   🏁 ${source.name} COMPLETED: ${sourceMatchedJobs.length} final jobs`);
                
                currentProgress = sourceEndProgress;
                onProgress(`Completed ${source.name} with ${sourceMatchedJobs.length} matches`, currentProgress);
                
            } catch (sourceError) {
                console.error(`❌ ${source.name} SOURCE FAILED:`, sourceError.message);
                
                currentProgress = sourceEndProgress;
                onProgress(`Error with ${source.name}`, currentProgress);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Add web scraping for additional results
        console.log(`\n🕷️ === STARTING WEB SCRAPING ===`);
        onProgress('Starting web scraping for additional results...', 90);
        
        try {
            const scrapingResults = await scraperManager.searchJobs(
                queries[0] || 'remote software engineer', 
                filters, 
                (progress) => {
                    if (onProgress) {
                        onProgress(progress.message, 90 + (progress.count || 0) * 2);
                    }
                }
            );
            
            console.log(`🕷️ Scraping found ${scrapingResults.jobs.length} additional jobs`);
            
            // Add scraped jobs to the main results
            scrapingResults.jobs.forEach(job => {
                const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
                if (!processedJobKeys.has(key)) {
                    processedJobKeys.add(key);
                    allJobs.push(job);
                    if (onJobFound) {
                        onJobFound(job);
                    }
                }
            });
            
            console.log(`🕷️ After scraping: ${allJobs.length} total jobs`);
        } catch (error) {
            console.error('❌ Web scraping failed:', error.message);
            // Continue with API results even if scraping fails
        }

        console.log(`\n🎯 === SEARCH COMPLETED ===`);
        console.log(`Total jobs found: ${allJobs.length}`);
        
        // Get API status for user messages
        const apiStatusReport = apiManager.getApiStatusReport();
        const scraperStatusReport = scraperManager.getStatusReport();
        const userMessages = this.getUserFriendlyMessages(apiStatusReport);
        
        // Add scraper messages
        const scraperMessages = scraperManager.getUserFriendlyMessages();
        userMessages.push(...scraperMessages);
        
        if (allJobs.length === 0) {
            // If no jobs found, include user messages in the error
            const errorMessage = 'No remote jobs found matching your profile. Try broadening your search criteria or updating your resume with more common industry terms.';
            const error = new Error(errorMessage);
            error.userMessages = userMessages;
            error.apiStatus = apiStatusReport;
            throw error;
        }
        
        // Sort by title for now (can be enhanced with AI matching later)
        const sortedJobs = allJobs.sort((a, b) => a.title.localeCompare(b.title));
        
        const finalResults = {
            allJobs: sortedJobs,
            totalJobs: sortedJobs.length,
            userMessages: userMessages,
            apiStatus: apiStatusReport,
            scraperStatus: scraperStatusReport
        };
        
        // Cache the results
        await cacheManager.cacheJobSearch(queries[0], filters, finalResults);
        console.log('💾 Results cached for future searches');
        
        return finalResults;
    }
}

// Export singleton instance
export const jobSearchService = new JobSearchService();
