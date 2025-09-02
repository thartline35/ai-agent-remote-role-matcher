// config/api-config.js - Centralized API configuration and validation

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './local.env' });

/**
 * API Configuration and Validation
 * Centralized configuration for all job search APIs
 */
export class ApiConfig {
    constructor() {
        this.configs = {
            openai: {
                name: 'OpenAI',
                required: true,
                key: process.env.OPENAI_API_KEY,
                timeout: 30000,
                maxRetries: 2,
                model: 'gpt-3.5-turbo'
            },
            theirstack: {
                name: 'Theirstack',
                required: false,
                key: process.env.THEIRSTACK_API_KEY,
                baseUrl: 'https://api.theirstack.com/v1',
                timeout: 15000,
                rateLimit: 200, // requests per day
                usageCount: 0
            },
            adzuna: {
                name: 'Adzuna',
                required: false,
                appId: process.env.ADZUNA_APP_ID,
                apiKey: process.env.ADZUNA_API_KEY,
                baseUrl: 'https://api.adzuna.com/v1',
                timeout: 15000,
                rateLimit: 1000 // requests per day
            },
            themuse: {
                name: 'TheMuse',
                required: false,
                key: process.env.THEMUSE_API_KEY,
                baseUrl: 'https://www.themuse.com/api/public',
                timeout: 15000,
                rateLimit: 1000 // requests per day
            },
            reed: {
                name: 'Reed',
                required: false,
                key: process.env.REED_API_KEY,
                baseUrl: 'https://www.reed.co.uk/api/1.0',
                timeout: 15000,
                rateLimit: 1000 // requests per day
            },
            rapidapi: {
                name: 'RapidAPI',
                required: false,
                key: process.env.RAPIDAPI_KEY,
                timeout: 15000,
                services: {
                    jsearch: {
                        host: 'jsearch.p.rapidapi.com',
                        url: 'https://jsearch.p.rapidapi.com/search'
                    },
                    jobs: {
                        host: 'jobs-api14.p.rapidapi.com',
                        url: 'https://jobs-api14.p.rapidapi.com/list'
                    }
                },
                rateLimit: 500 // requests per month (free tier)
            }
        };
    }

    /**
     * Get configuration for a specific API
     * @param {string} apiName - Name of the API
     * @returns {Object} API configuration
     */
    getConfig(apiName) {
        return this.configs[apiName] || null;
    }

    /**
     * Check if an API is properly configured
     * @param {string} apiName - Name of the API
     * @returns {Object} Validation result
     */
    validateApi(apiName) {
        const config = this.getConfig(apiName);
        if (!config) {
            return {
                isValid: false,
                error: `Unknown API: ${apiName}`,
                hasKey: false
            };
        }

        let hasKey = false;
        let keyDetails = {};

        switch (apiName) {
            case 'openai':
                hasKey = !!config.key;
                keyDetails = {
                    keyExists: !!config.key,
                    keyLength: config.key ? config.key.length : 0,
                    keyPrefix: config.key ? config.key.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'theirstack':
                hasKey = !!config.key;
                keyDetails = {
                    keyExists: !!config.key,
                    keyLength: config.key ? config.key.length : 0,
                    keyPrefix: config.key ? config.key.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'adzuna':
                hasKey = !!(config.appId && config.apiKey);
                keyDetails = {
                    appIdExists: !!config.appId,
                    appIdLength: config.appId ? config.appId.length : 0,
                    apiKeyExists: !!config.apiKey,
                    apiKeyLength: config.apiKey ? config.apiKey.length : 0,
                    appIdPrefix: config.appId ? config.appId.substring(0, 8) + '...' : 'none',
                    apiKeyPrefix: config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'themuse':
            case 'reed':
                hasKey = !!config.key;
                keyDetails = {
                    keyExists: !!config.key,
                    keyLength: config.key ? config.key.length : 0,
                    keyPrefix: config.key ? config.key.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'rapidapi':
                hasKey = !!config.key;
                keyDetails = {
                    keyExists: !!config.key,
                    keyLength: config.key ? config.key.length : 0,
                    keyPrefix: config.key ? config.key.substring(0, 8) + '...' : 'none'
                };
                break;
        }

        return {
            isValid: hasKey,
            hasKey,
            keyDetails,
            config,
            error: hasKey ? null : `Missing API key for ${config.name}`
        };
    }

    /**
     * Get all available APIs with their status
     * @returns {Object} Status of all APIs
     */
    getAllApiStatus() {
        const status = {};
        
        Object.keys(this.configs).forEach(apiName => {
            const validation = this.validateApi(apiName);
            status[apiName] = {
                name: this.configs[apiName].name,
                required: this.configs[apiName].required,
                configured: validation.isValid,
                hasKey: validation.hasKey,
                keyDetails: validation.keyDetails
            };
        });

        return status;
    }

    /**
     * Get list of configured APIs
     * @returns {Array} List of configured API names
     */
    getConfiguredApis() {
        return Object.keys(this.configs).filter(apiName => {
            const validation = this.validateApi(apiName);
            return validation.isValid;
        });
    }

    /**
     * Get list of required APIs that are missing
     * @returns {Array} List of missing required APIs
     */
    getMissingRequiredApis() {
        return Object.keys(this.configs).filter(apiName => {
            const config = this.configs[apiName];
            const validation = this.validateApi(apiName);
            return config.required && !validation.isValid;
        });
    }

    /**
     * Log API configuration status
     */
    logApiStatus() {
        console.log('\n🔑 API CONFIGURATION STATUS:');
        console.log('================================');
        
        const allStatus = this.getAllApiStatus();
        Object.keys(allStatus).forEach(apiName => {
            const status = allStatus[apiName];
            const icon = status.configured ? '✅' : (status.required ? '❌' : '⚠️');
            const required = status.required ? ' (REQUIRED)' : '';
            console.log(`${icon} ${status.name}${required}: ${status.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
        });

        const missingRequired = this.getMissingRequiredApis();
        if (missingRequired.length > 0) {
            console.log('\n❌ MISSING REQUIRED APIs:');
            missingRequired.forEach(apiName => {
                console.log(`   - ${this.configs[apiName].name}`);
            });
        }

        const configured = this.getConfiguredApis();
        console.log(`\n📊 Summary: ${configured.length}/${Object.keys(this.configs).length} APIs configured`);
        console.log('================================\n');
    }
}

// Export singleton instance
export const apiConfig = new ApiConfig();
