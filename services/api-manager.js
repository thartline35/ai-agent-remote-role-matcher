// services/api-manager.js - Centralized API management and coordination

import { TheirstackApi } from './theirstack-api.js';
import { AdzunaApi } from './adzuna-api.js';
import { TheMuseApi } from './themuse-api.js';
import { ReedApi } from './reed-api.js';
import { RapidApiJSearch } from './rapidapi-jsearch.js';
import { RapidApiJobs } from './rapidapi-jobs.js';
import { apiConfig } from '../config/api-config.js';

/**
 * API Manager - Coordinates all job search APIs
 * Provides centralized management, error handling, and status tracking
 */
export class ApiManager {
    constructor() {
        this.apis = {
            theirstack: new TheirstackApi(),
            adzuna: new AdzunaApi(),
            themuse: new TheMuseApi(),
            reed: new ReedApi(),
            jsearch: new RapidApiJSearch(),
            jobs: new RapidApiJobs(),
            rapidapi: new RapidApiJSearch() // Alias for backward compatibility
        };

        this.exhaustedApis = new Set();
        this.suspiciousApis = new Map();
        this.lastResetTime = Date.now();
        this.resetInterval = 1000 * 60 * 60; // Reset every hour
        this.maxSuspiciousFailures = 3;
    }

    /**
     * Get all available API instances
     * @returns {Object} Object containing all API instances
     */
    getApis() {
        return this.apis;
    }

    /**
     * Get a specific API instance
     * @param {string} apiName - Name of the API
     * @returns {Object|null} API instance or null if not found
     */
    getApi(apiName) {
        return this.apis[apiName] || null;
    }

    /**
     * Get list of configured APIs
     * @returns {Array} Array of configured API names
     */
    getConfiguredApis() {
        return Object.keys(this.apis).filter(apiName => {
            const api = this.apis[apiName];
            return api.isConfigured();
        });
    }

    /**
     * Check if an API is exhausted
     * @param {string} apiName - Name of the API
     * @returns {boolean} True if API is exhausted
     */
    isApiExhausted(apiName) {
        return this.exhaustedApis.has(apiName);
    }

    /**
     * Mark an API as exhausted
     * @param {string} apiName - Name of the API
     * @param {string} reason - Reason for exhaustion
     */
    markApiAsExhausted(apiName, reason) {
        if (!this.exhaustedApis.has(apiName)) {
            this.exhaustedApis.add(apiName);
            console.log(`🚫 MARKED AS EXHAUSTED: ${apiName} - ${reason}`);
            console.log(`📊 Total exhausted APIs: ${this.exhaustedApis.size}`);
            console.log(`📋 Currently exhausted APIs: [${Array.from(this.exhaustedApis).join(', ')}]`);
        }
    }

    /**
     * Reset API exhaustion status if needed
     * @returns {boolean} True if reset was performed
     */
    resetApiStatusIfNeeded() {
        const timeSinceReset = Date.now() - this.lastResetTime;
        
        if (timeSinceReset > this.resetInterval) {
            console.log(`🔄 Resetting API exhaustion status (${Math.round(timeSinceReset / 1000 / 60)} minutes since last reset)`);
            
            const previouslyExhausted = Array.from(this.exhaustedApis);
            this.exhaustedApis.clear();
            this.suspiciousApis.clear();
            this.lastResetTime = Date.now();
            
            if (previouslyExhausted.length > 0) {
                console.log(`♻️ Reset exhaustion status for: [${previouslyExhausted.join(', ')}]`);
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Check if API should be used (configured and not exhausted)
     * @param {string} apiName - Name of the API
     * @returns {Object} Check result with details
     */
    checkApiAvailability(apiName) {
        const checkId = `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`\n🔑 [${checkId}] === CHECKING ${apiName} ===`);
        
        this.resetApiStatusIfNeeded();
        
        if (this.exhaustedApis.has(apiName)) {
            const timeSinceReset = Math.round((Date.now() - this.lastResetTime) / 1000 / 60);
            const nextResetIn = Math.round((this.resetInterval / 1000 / 60) - timeSinceReset);
            console.log(`⏭️ [${checkId}] ${apiName}: Skipping - marked as exhausted`);
            console.log(`   [${checkId}] Time since reset: ${timeSinceReset} minutes`);
            console.log(`   [${checkId}] Will retry in: ${nextResetIn} minutes`);
            return {
                available: false,
                reason: 'exhausted',
                nextResetIn,
                checkId
            };
        }
        
        const api = this.apis[apiName];
        if (!api || !api.isConfigured()) {
            console.log(`❌ [${checkId}] ${apiName}: API not configured`);
            return {
                available: false,
                reason: 'not_configured',
                checkId
            };
        }
        
        console.log(`✅ [${checkId}] ${apiName}: Available and configured`);
        return {
            available: true,
            reason: 'available',
            checkId
        };
    }

    /**
     * Make API call with exhaustion detection
     * @param {string} apiName - Name of the API
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async makeApiCall(apiName, query, filters) {
        const availability = this.checkApiAvailability(apiName);
        if (!availability.available) {
            return [];
        }

        const api = this.apis[apiName];
        const startTime = Date.now();
        const callId = `${apiName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`📞 [${callId}] Making API call to ${apiName}...`);
        
        try {
            const jobs = await api.searchJobs(query, filters);
            const duration = Date.now() - startTime;
            
            // Clear suspicious count on success
            if (this.suspiciousApis.has(apiName)) {
                console.log(`✅ [${callId}] ${apiName}: Successful response - clearing suspicious count`);
                this.suspiciousApis.delete(apiName);
            }
            
            // Check for suspicious empty responses
            if (jobs.length === 0) {
                const currentCount = this.suspiciousApis.get(apiName) || 0;
                this.suspiciousApis.set(apiName, currentCount + 1);
                
                console.log(`⚠️ [${callId}] ${apiName}: Empty response (${currentCount + 1}/${this.maxSuspiciousFailures} suspicious failures)`);
                
                if (currentCount + 1 >= this.maxSuspiciousFailures) {
                    this.markApiAsExhausted(apiName, `Too many consecutive empty responses (${currentCount + 1})`);
                    return [];
                }
            }
            
            console.log(`✅ [${callId}] ${apiName}: API call successful in ${duration}ms, returned ${jobs.length} jobs`);
            return jobs;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ [${callId}] ${apiName}: API call failed after ${duration}ms`);
            console.log(`🔍 [${callId}] Error details:`, {
                message: error.message,
                code: error.code || 'unknown',
                status: error.response?.status || 'unknown'
            });
            
            // Check for exhaustion patterns
            const exhaustionCheck = api.detectExhaustion(error);
            if (exhaustionCheck.isExhausted) {
                this.markApiAsExhausted(apiName, exhaustionCheck.reason);
                return [];
            }
            
            console.log(`⚠️ [${callId}] ${apiName}: Non-exhaustion error - ${error.message}`);
            return [];
        }
    }

    /**
     * Get comprehensive API status report
     * @returns {Object} Detailed status report
     */
    getApiStatusReport() {
        const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const currentTime = Date.now();
        const timeSinceReset = currentTime - this.lastResetTime;
        const nextResetIn = Math.round((this.resetInterval - timeSinceReset) / 1000 / 60);
        
        const report = {
            reportId: reportId,
            timestamp: new Date().toISOString(),
            exhaustedApis: Array.from(this.exhaustedApis),
            suspiciousApis: Object.fromEntries(this.suspiciousApis),
            lastResetTime: new Date(this.lastResetTime).toISOString(),
            nextResetIn: nextResetIn,
            totalExhausted: this.exhaustedApis.size,
            totalSuspicious: this.suspiciousApis.size,
            resetIntervalMinutes: Math.round(this.resetInterval / 1000 / 60),
            timeSinceResetMinutes: Math.round(timeSinceReset / 1000 / 60),
            systemHealth: {
                totalApis: Object.keys(this.apis).length,
                healthyApis: Object.keys(this.apis).length - this.exhaustedApis.size - this.suspiciousApis.size,
                exhaustedPercentage: Math.round((this.exhaustedApis.size / Object.keys(this.apis).length) * 100),
                suspiciousPercentage: Math.round((this.suspiciousApis.size / Object.keys(this.apis).length) * 100),
                healthyPercentage: Math.round(((Object.keys(this.apis).length - this.exhaustedApis.size - this.suspiciousApis.size) / Object.keys(this.apis).length) * 100)
            },
            detailedStatus: {
                exhausted: Array.from(this.exhaustedApis).map(api => ({
                    name: api,
                    status: 'exhausted',
                    estimatedRecovery: nextResetIn > 0 ? `${nextResetIn} minutes` : 'immediate'
                })),
                suspicious: Array.from(this.suspiciousApis.entries()).map(([api, count]) => ({
                    name: api,
                    status: 'suspicious',
                    suspiciousCount: count,
                    maxSuspiciousFailures: this.maxSuspiciousFailures,
                    remainingFailuresBeforeExhaustion: this.maxSuspiciousFailures - count
                })),
                healthy: Object.keys(this.apis)
                    .filter(api => !this.exhaustedApis.has(api) && !this.suspiciousApis.has(api))
                    .map(api => ({
                        name: api,
                        status: 'healthy',
                        available: true
                    }))
            }
        };
        
        console.log(`\n📊 [${reportId}] === API STATUS REPORT ===`);
        console.log(`📅 [${reportId}] Report generated at: ${report.timestamp}`);
        console.log(`🔄 [${reportId}] Last reset: ${report.timeSinceResetMinutes} minutes ago`);
        console.log(`⏰ [${reportId}] Next reset in: ${report.nextResetIn} minutes`);
        console.log(`📊 [${reportId}] System health: ${report.systemHealth.healthyPercentage}% healthy, ${report.systemHealth.exhaustedPercentage}% exhausted, ${report.systemHealth.suspiciousPercentage}% suspicious`);
        console.log(`🚫 [${reportId}] Exhausted APIs (${report.totalExhausted}): [${report.exhaustedApis.join(', ')}]`);
        console.log(`⚠️ [${reportId}] Suspicious APIs (${report.totalSuspicious}): ${JSON.stringify(report.suspiciousApis)}`);
        console.log(`✅ [${reportId}] Healthy APIs (${report.systemHealth.healthyApis}): [${report.detailedStatus.healthy.map(h => h.name).join(', ')}]`);
        console.log(`==========================================\n`);
        
        return report;
    }

    /**
     * Manually reset all API status
     */
    manualResetApiStatus() {
        console.log('🔄 MANUAL RESET: Clearing all API exhaustion status');
        this.exhaustedApis.clear();
        this.suspiciousApis.clear();
        this.lastResetTime = Date.now();
        console.log('✅ All APIs reset and available for retry');
    }

    /**
     * Get usage statistics for all APIs
     * @returns {Object} Usage statistics for all APIs
     */
    getAllUsageStats() {
        const stats = {};
        Object.keys(this.apis).forEach(apiName => {
            const api = this.apis[apiName];
            stats[apiName] = api.getUsageStats();
        });
        return stats;
    }
}

// Export singleton instance
export const apiManager = new ApiManager();
