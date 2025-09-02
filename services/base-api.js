// services/base-api.js - Base class for all API services

import axios from 'axios';
import { apiConfig } from '../config/api-config.js';

/**
 * Base API class with common functionality
 * All job search APIs should extend this class
 */
export class BaseApi {
    constructor(apiName) {
        this.apiName = apiName;
        this.config = apiConfig.getConfig(apiName);
        this.validation = apiConfig.validateApi(apiName);
        this.usageCount = 0;
        this.lastCallTime = null;
        this.errorCount = 0;
        this.maxErrors = 3;
    }

    /**
     * Check if API is properly configured
     * @returns {boolean} True if API is configured
     */
    isConfigured() {
        return this.validation.isValid;
    }

    /**
     * Get API configuration details
     * @returns {Object} API configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get validation details
     * @returns {Object} Validation result
     */
    getValidation() {
        return this.validation;
    }

    /**
     * Make HTTP request with common error handling
     * @param {Object} requestConfig - Axios request configuration
     * @returns {Promise} HTTP response
     */
    async makeRequest(requestConfig) {
        if (!this.isConfigured()) {
            throw new Error(`API ${this.apiName} is not properly configured: ${this.validation.error}`);
        }

        const startTime = Date.now();
        const callId = `${this.apiName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`📞 [${callId}] Making API call to ${this.apiName}...`);

        try {
            // Add default timeout if not specified
            if (!requestConfig.timeout) {
                requestConfig.timeout = this.config.timeout || 15000;
            }

            const response = await axios(requestConfig);
            const duration = Date.now() - startTime;
            
            this.usageCount++;
            this.lastCallTime = new Date();
            this.errorCount = 0; // Reset error count on success

            console.log(`✅ [${callId}] ${this.apiName}: API call successful in ${duration}ms`);
            return response;

        } catch (error) {
            const duration = Date.now() - startTime;
            this.errorCount++;
            
            console.log(`❌ [${callId}] ${this.apiName}: API call failed after ${duration}ms`);
            console.log(`🔍 [${callId}] Error details:`, {
                message: error.message,
                code: error.code || 'unknown',
                status: error.response?.status || 'unknown',
                statusText: error.response?.statusText || 'unknown',
                data: error.response?.data || 'no data'
            });

            // Check if this is an exhaustion error
            const exhaustionCheck = this.detectExhaustion(error);
            if (exhaustionCheck.isExhausted) {
                console.log(`🚫 [${callId}] ${this.apiName}: Marked as exhausted - ${exhaustionCheck.reason}`);
                throw new Error(`API exhausted: ${exhaustionCheck.reason}`);
            }

            throw error;
        }
    }

    /**
     * Detect if API is exhausted based on error response
     * @param {Error} error - Error object
     * @returns {Object} Exhaustion detection result
     */
    detectExhaustion(error) {
        const exhaustionIndicators = {
            httpStatuses: [429, 403, 402, 509],
            errorMessages: [
                'quota', 'limit', 'exceeded', 'exhausted', 'credits', 'usage',
                'rate limit', 'too many requests', 'api limit', 'monthly limit',
                'subscription', 'billing', 'payment', 'insufficient', 'balance'
            ]
        };

        let isExhausted = false;
        let reason = '';

        // Check HTTP status codes
        if (error?.response?.status && exhaustionIndicators.httpStatuses.includes(error.response.status)) {
            isExhausted = true;
            reason = `HTTP ${error.response.status}`;
        }

        // Check error messages
        const errorText = (error?.message || error?.response?.data?.error || error?.response?.data?.message || '').toLowerCase();
        if (errorText && exhaustionIndicators.errorMessages.some(indicator => errorText.includes(indicator))) {
            isExhausted = true;
            reason = `Error message contains quota indicator: "${errorText.substring(0, 100)}"`;
        }

        return { isExhausted, reason };
    }

    /**
     * Check if API has exceeded error threshold
     * @returns {boolean} True if too many errors
     */
    hasExceededErrorThreshold() {
        return this.errorCount >= this.maxErrors;
    }

    /**
     * Get API usage statistics
     * @returns {Object} Usage statistics
     */
    getUsageStats() {
        return {
            apiName: this.apiName,
            configured: this.isConfigured(),
            usageCount: this.usageCount,
            lastCallTime: this.lastCallTime,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            hasExceededErrorThreshold: this.hasExceededErrorThreshold()
        };
    }

    /**
     * Reset error count
     */
    resetErrorCount() {
        this.errorCount = 0;
        console.log(`🔄 ${this.apiName}: Error count reset`);
    }

    /**
     * Abstract method - must be implemented by subclasses
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of job objects
     */
    async searchJobs(query, filters) {
        throw new Error(`searchJobs method must be implemented by ${this.apiName} class`);
    }

    /**
     * Abstract method - must be implemented by subclasses
     * @param {Object} job - Job object from API response
     * @returns {Object} Standardized job object
     */
    standardizeJob(job) {
        throw new Error(`standardizeJob method must be implemented by ${this.apiName} class`);
    }
}
