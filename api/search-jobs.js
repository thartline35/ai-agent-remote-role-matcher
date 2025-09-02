// api/search-jobs.js - COMPLETE VERSION
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';

// Export functions needed by other modules
export { getApiKeyWithBackup, rotateToNextApiKey, makeApiCallWithExhaustionDetectionEnhanced };

// Load environment variables
dotenv.config({ path: './local.env' });

// Initialize OpenAI client - will be created when needed
let openai = null;

function getOpenAIClient() {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openai;
}

// Theirstack usage tracking (free tier has 200 request limit)
let theirstackUsageCount = 0;

// AUTOMATED API EXHAUSTION DETECTION SYSTEM
const apiStatus = {
    exhaustedApis: new Set(),
    suspiciousApis: new Map(),
    lastResetTime: Date.now(),
    resetInterval: 1000 * 60 * 60, // Reset every hour
    maxSuspiciousFailures: 3,
    currentTokenIndex: {}, // Track which token is currently in use for each API
    tokenRotationEnabled: true // Enable/disable token rotation feature
};

function detectApiExhaustion(error, response, sourceName) {
    console.log(`🔍 Analyzing ${sourceName} response for exhaustion patterns...`);
    
    const exhaustionIndicators = {
        httpStatuses: [429, 403, 402, 509],
        errorMessages: [
            'quota', 'limit', 'exceeded', 'exhausted', 'credits', 'usage',
            'rate limit', 'too many requests', 'api limit', 'monthly limit',
            'subscription', 'billing', 'payment', 'insufficient', 'balance'
        ],
        emptyResponsePatterns: [
            'no data available', 'service unavailable', 'temporarily unavailable'
        ]
    };
    
    let isExhausted = false;
    let reason = '';
    
    // Check HTTP status codes
    if (error?.response?.status && exhaustionIndicators.httpStatuses.includes(error.response.status)) {
        isExhausted = true;
        reason = `HTTP ${error.response.status}`;
        console.log(`🚫 ${sourceName}: Exhaustion detected - ${reason}`);
    }
    
    // Check error messages
    const errorText = (error?.message || error?.response?.data?.error || error?.response?.data?.message || '').toLowerCase();
    if (errorText && exhaustionIndicators.errorMessages.some(indicator => errorText.includes(indicator))) {
        isExhausted = true;
        reason = `Error message contains quota indicator: "${errorText.substring(0, 100)}"`;
        console.log(`🚫 ${sourceName}: Exhaustion detected - ${reason}`);
    }
    
    // Check response data for exhaustion indicators
    if (response?.data) {
        const responseText = JSON.stringify(response.data).toLowerCase();
        if (exhaustionIndicators.errorMessages.some(indicator => responseText.includes(indicator))) {
            isExhausted = true;
            reason = `Response contains quota indicator`;
            console.log(`🚫 ${sourceName}: Exhaustion detected - ${reason}`);
        }
    }
    
    // Check for suspicious empty responses
    if (!error && response?.status === 200 && (!response.data || 
        (Array.isArray(response.data) && response.data.length === 0) ||
        (response.data.results && response.data.results.length === 0) ||
        (response.data.data && response.data.data.length === 0))) {
        
        const currentCount = apiStatus.suspiciousApis.get(sourceName) || 0;
        apiStatus.suspiciousApis.set(sourceName, currentCount + 1);
        
        console.log(`⚠️ ${sourceName}: Empty response (${currentCount + 1}/${apiStatus.maxSuspiciousFailures} suspicious failures)`);
        
        if (currentCount + 1 >= apiStatus.maxSuspiciousFailures) {
            isExhausted = true;
            reason = `Too many consecutive empty responses (${currentCount + 1})`;
            console.log(`🚫 ${sourceName}: Marked as exhausted due to suspicious pattern`);
        }
    }
    
    return { isExhausted, reason };
}

function markApiAsExhausted(sourceName, reason) {
    if (!apiStatus.exhaustedApis.has(sourceName)) {
        apiStatus.exhaustedApis.add(sourceName);
        console.log(`🚫 MARKED AS EXHAUSTED: ${sourceName} - ${reason}`);
        console.log(`📊 Total exhausted APIs: ${apiStatus.exhaustedApis.size}`);
        console.log(`📋 Currently exhausted APIs: [${Array.from(apiStatus.exhaustedApis).join(', ')}]`);
    }
}

function resetApiStatusIfNeeded() {
    const timeSinceReset = Date.now() - apiStatus.lastResetTime;
    
    if (timeSinceReset > apiStatus.resetInterval) {
        console.log(`🔄 Resetting API exhaustion status (${Math.round(timeSinceReset / 1000 / 60)} minutes since last reset)`);
        
        const previouslyExhausted = Array.from(apiStatus.exhaustedApis);
        apiStatus.exhaustedApis.clear();
        apiStatus.suspiciousApis.clear();
        apiStatus.lastResetTime = Date.now();
        
        if (previouslyExhausted.length > 0) {
            console.log(`♻️ Reset exhaustion status for: [${previouslyExhausted.join(', ')}]`);
        }
        
        return true;
    }
    
    return false;
}

// Helper function to get API key with backup support
function getApiKeyWithBackup(sourceName) {
    // Define backup keys configuration
    const apiKeysConfig = {
        'OpenAI': {
            keys: [
                process.env.OPENAI_API_KEY,
                process.env.OPENAI_API_KEY_BACKUP_1,
                process.env.OPENAI_API_KEY_BACKUP_2
            ],
            currentIndex: apiStatus.currentTokenIndex['OpenAI'] || 0
        },
        'Theirstack': {
            keys: [
                process.env.THEIRSTACK_API_KEY,
                process.env.THEIRSTACK_API_KEY_BACKUP_1
            ],
            currentIndex: apiStatus.currentTokenIndex['Theirstack'] || 0
        },
        'Adzuna': {
            // For APIs with multiple credentials, we store objects
            keys: [
                { appId: process.env.ADZUNA_APP_ID, apiKey: process.env.ADZUNA_API_KEY },
                { appId: process.env.ADZUNA_APP_ID_BACKUP_1, apiKey: process.env.ADZUNA_API_KEY_BACKUP_1 }
            ],
            currentIndex: apiStatus.currentTokenIndex['Adzuna'] || 0
        },
        'TheMuse': {
            keys: [
                process.env.THEMUSE_API_KEY,
                process.env.THEMUSE_API_KEY_BACKUP_1
            ],
            currentIndex: apiStatus.currentTokenIndex['TheMuse'] || 0
        },
        'Reed': {
            keys: [
                process.env.REED_API_KEY,
                process.env.REED_API_KEY_BACKUP_1
            ],
            currentIndex: apiStatus.currentTokenIndex['Reed'] || 0
        },
        'RapidAPI': {
            keys: [
                process.env.RAPIDAPI_KEY,
                process.env.RAPIDAPI_KEY_BACKUP_1
            ],
            currentIndex: apiStatus.currentTokenIndex['RapidAPI'] || 0
        },
        'JobsMulti': {
            keys: [
                process.env.JOBSMULTI_API_KEY,
                process.env.JOBSMULTI_API_KEY_BACKUP_1
            ],
            currentIndex: apiStatus.currentTokenIndex['JobsMulti'] || 0
        },
        'Jobber': {
            keys: [
                process.env.JOBBER_API_KEY,
                process.env.JOBBER_API_KEY_BACKUP_1
            ],
            currentIndex: apiStatus.currentTokenIndex['Jobber'] || 0
        }
    };
    
    // Get config for the requested source
    let config;
    
    // Handle RapidAPI services that share the same key
    if (sourceName === 'JSearch-RapidAPI' || sourceName === 'RapidAPI-Jobs') {
        config = apiKeysConfig['RapidAPI'];
    } else {
        config = apiKeysConfig[sourceName];
    }
    
    if (!config) {
        console.log(`⚠️ No API key configuration found for ${sourceName}`);
        return null;
    }
    
    // Filter out undefined/null keys
    const validKeys = config.keys.filter(key => {
        if (key === null || key === undefined) return false;
        if (typeof key === 'object') {
            // For composite keys like Adzuna
            return Object.values(key).every(val => val !== null && val !== undefined && val !== '');
        }
        return key !== '';
    });
    
    if (validKeys.length === 0) {
        console.log(`⚠️ No valid API keys found for ${sourceName}`);
        return null;
    }
    
    // Get current key based on the rotation index
    const currentKey = validKeys[config.currentIndex % validKeys.length];
    
    // Store the current index for this API
    apiStatus.currentTokenIndex[sourceName] = config.currentIndex;
    
    return {
        key: currentKey,
        index: config.currentIndex,
        total: validKeys.length
    };
}

// Function to rotate to the next API key when current one is exhausted
function rotateToNextApiKey(sourceName) {
    if (!apiStatus.tokenRotationEnabled) {
        console.log(`🔄 Token rotation disabled for ${sourceName}`);
        return false;
    }
    
    // Initialize if not exists
    if (apiStatus.currentTokenIndex[sourceName] === undefined) {
        apiStatus.currentTokenIndex[sourceName] = 0;
    }
    
    // Increment the index to use the next key
    apiStatus.currentTokenIndex[sourceName]++;
    
    // Get the new key details
    const keyInfo = getApiKeyWithBackup(sourceName);
    
    if (!keyInfo || !keyInfo.key) {
        console.log(`⚠️ No more backup keys available for ${sourceName}`);
        return false;
    }
    
    console.log(`🔄 Rotated to backup key ${keyInfo.index + 1}/${keyInfo.total} for ${sourceName}`);
    return true;
}

function checkApiKeyForSourceEnhanced(sourceName) {
    const checkId = `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`\n🔑 [${checkId}] === CHECKING ${sourceName} ===`);
    
    resetApiStatusIfNeeded();
    
    if (apiStatus.exhaustedApis.has(sourceName)) {
        const timeSinceReset = Math.round((Date.now() - apiStatus.lastResetTime) / 1000 / 60);
        const nextResetIn = Math.round((apiStatus.resetInterval / 1000 / 60) - timeSinceReset);
        
        // Try rotating to a backup key if available
        if (rotateToNextApiKey(sourceName)) {
            console.log(`🔄 [${checkId}] ${sourceName}: Trying backup API key`);
            // Remove from exhausted list since we're trying a backup key
            apiStatus.exhaustedApis.delete(sourceName);
        } else {
            console.log(`⏭️ [${checkId}] ${sourceName}: Skipping - marked as exhausted`);
            console.log(`   [${checkId}] Time since reset: ${timeSinceReset} minutes`);
            console.log(`   [${checkId}] Will retry in: ${nextResetIn} minutes`);
            console.log(`   [${checkId}] Reset interval: ${Math.round(apiStatus.resetInterval / 1000 / 60)} minutes`);
            return false;
        }
    }
    
    let hasKey = false;
    let keyDetails = {};
    
    // Get key info with backup support
    const keyInfo = getApiKeyWithBackup(sourceName);
    
    // If we have key info from the backup system, use it
    if (keyInfo && keyInfo.key) {
        hasKey = true;
        
        // Handle different key formats
        if (typeof keyInfo.key === 'object' && keyInfo.key.appId && keyInfo.key.apiKey) {
            // For composite keys like Adzuna
            keyDetails = {
                appIdExists: true,
                appIdLength: keyInfo.key.appId.length,
                apiKeyExists: true,
                apiKeyLength: keyInfo.key.apiKey.length,
                appIdPrefix: keyInfo.key.appId.substring(0, 8) + '...',
                apiKeyPrefix: keyInfo.key.apiKey.substring(0, 8) + '...',
                usingBackup: keyInfo.index > 0,
                backupIndex: keyInfo.index,
                totalBackups: keyInfo.total
            };
        } else if (typeof keyInfo.key === 'string') {
            // For simple string keys
            keyDetails = {
                keyExists: true,
                keyLength: keyInfo.key.length,
                keyPrefix: keyInfo.key.substring(0, 8) + '...',
                usingBackup: keyInfo.index > 0,
                backupIndex: keyInfo.index,
                totalBackups: keyInfo.total
            };
        }
    } else {
        // Fallback to the old method if backup system doesn't have a key
        switch (sourceName) {
            case 'Theirstack':
                hasKey = !!process.env.THEIRSTACK_API_KEY;
                keyDetails = {
                    keyExists: !!process.env.THEIRSTACK_API_KEY,
                    keyLength: process.env.THEIRSTACK_API_KEY ? process.env.THEIRSTACK_API_KEY.length : 0,
                    keyPrefix: process.env.THEIRSTACK_API_KEY ? process.env.THEIRSTACK_API_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'Adzuna':
                hasKey = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY);
                keyDetails = {
                    appIdExists: !!process.env.ADZUNA_APP_ID,
                    appIdLength: process.env.ADZUNA_APP_ID ? process.env.ADZUNA_APP_ID.length : 0,
                    apiKeyExists: !!process.env.ADZUNA_API_KEY,
                    apiKeyLength: process.env.ADZUNA_API_KEY ? process.env.ADZUNA_API_KEY.length : 0,
                    appIdPrefix: process.env.ADZUNA_APP_ID ? process.env.ADZUNA_APP_ID.substring(0, 8) + '...' : 'none',
                    apiKeyPrefix: process.env.ADZUNA_API_KEY ? process.env.ADZUNA_API_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'TheMuse':
                hasKey = !!process.env.THEMUSE_API_KEY;
                keyDetails = {
                    keyExists: !!process.env.THEMUSE_API_KEY,
                    keyLength: process.env.THEMUSE_API_KEY ? process.env.THEMUSE_API_KEY.length : 0,
                    keyPrefix: process.env.THEMUSE_API_KEY ? process.env.THEMUSE_API_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'Reed':
                hasKey = !!process.env.REED_API_KEY;
                keyDetails = {
                    keyExists: !!process.env.REED_API_KEY,
                    keyLength: process.env.REED_API_KEY ? process.env.REED_API_KEY.length : 0,
                    keyPrefix: process.env.REED_API_KEY ? process.env.REED_API_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'JSearch-RapidAPI':
            case 'RapidAPI-Jobs':
                hasKey = !!process.env.RAPIDAPI_KEY;
                keyDetails = {
                    keyExists: !!process.env.RAPIDAPI_KEY,
                    keyLength: process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.length : 0,
                    keyPrefix: process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'JobsMulti':
                hasKey = !!process.env.JOBSMULTI_API_KEY;
                keyDetails = {
                    keyExists: !!process.env.JOBSMULTI_API_KEY,
                    keyLength: process.env.JOBSMULTI_API_KEY ? process.env.JOBSMULTI_API_KEY.length : 0,
                    keyPrefix: process.env.JOBSMULTI_API_KEY ? process.env.JOBSMULTI_API_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            case 'Jobber':
                hasKey = !!process.env.JOBBER_API_KEY;
                keyDetails = {
                    keyExists: !!process.env.JOBBER_API_KEY,
                    keyLength: process.env.JOBBER_API_KEY ? process.env.JOBBER_API_KEY.length : 0,
                    keyPrefix: process.env.JOBBER_API_KEY ? process.env.JOBBER_API_KEY.substring(0, 8) + '...' : 'none'
                };
                break;
            default:
                hasKey = false;
                keyDetails = { error: 'Unknown source' };
                break;
        }
    }
    
    if (!hasKey) {
        console.log(`❌ [${checkId}] ${sourceName}: API key missing`);
        console.log(`🔍 [${checkId}] Key details:`, JSON.stringify(keyDetails, null, 2));
        return false;
    }
    
    console.log(`✅ [${checkId}] ${sourceName}: API key exists - proceeding`);
    console.log(`🔍 [${checkId}] Key details:`, JSON.stringify(keyDetails, null, 2));
    return true;
}

async function makeApiCallWithExhaustionDetectionEnhanced(sourceName, apiCallFunction, ...args) {
    const startTime = Date.now();
    const callId = `${sourceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📞 [${callId}] Making API call to ${sourceName}...`);
    
    try {
        const result = await apiCallFunction(...args);
        const duration = Date.now() - startTime;
        
        if (apiStatus.suspiciousApis.has(sourceName)) {
            console.log(`✅ [${callId}] ${sourceName}: Successful response - clearing suspicious count`);
            apiStatus.suspiciousApis.delete(sourceName);
        }
        
        if (Array.isArray(result) && result.length === 0) {
            const exhaustionCheck = detectApiExhaustion(null, { status: 200, data: result }, sourceName);
            if (exhaustionCheck.isExhausted) {
                // Try to rotate to next API key before marking as exhausted
                const rotated = rotateToNextApiKey(sourceName);
                if (rotated) {
                    console.log(`🔄 [${callId}] ${sourceName}: Rotated to next API key due to possible exhaustion`);
                    // Don't mark as exhausted since we've rotated to a new key
                } else {
                    markApiAsExhausted(sourceName, exhaustionCheck.reason);
                }
            }
        }
        
        console.log(`✅ [${callId}] ${sourceName}: API call successful in ${duration}ms, returned ${Array.isArray(result) ? result.length : 'non-array'} items`);
        return result;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            message: error.message,
            code: error.code || 'unknown',
            status: error.response?.status || 'unknown',
            statusText: error.response?.statusText || 'unknown',
            data: error.response?.data || 'no data',
            headers: error.response?.headers ? Object.keys(error.response.headers) : 'no headers',
            url: error.config?.url || 'unknown',
            method: error.config?.method || 'unknown',
            timeout: error.config?.timeout || 'unknown'
        };
        
        console.log(`❌ [${callId}] ${sourceName}: API call failed after ${duration}ms`);
        console.log(`🔍 [${callId}] Error details:`, JSON.stringify(errorDetails, null, 2));
        
        const exhaustionCheck = detectApiExhaustion(error, error.response, sourceName);
        
        if (exhaustionCheck.isExhausted) {
            // Try to rotate to next API key before marking as exhausted
            const rotated = rotateToNextApiKey(sourceName);
            if (rotated) {
                console.log(`🔄 [${callId}] ${sourceName}: Rotated to next API key due to exhaustion`);
                // Try the API call again with the new key
                console.log(`🔁 [${callId}] ${sourceName}: Retrying API call with new key...`);
                return makeApiCallWithExhaustionDetectionEnhanced(sourceName, apiCallFunction, ...args);
            } else {
                markApiAsExhausted(sourceName, exhaustionCheck.reason);
                console.log(`🚫 [${callId}] ${sourceName}: Marked as exhausted - ${exhaustionCheck.reason}`);
                return [];
            }
        }
        
        // For suspicious errors (non-exhaustion), also try rotating keys
        if (!apiStatus.exhaustedApis.has(sourceName)) {
            const rotated = rotateToNextApiKey(sourceName);
            if (rotated) {
                console.log(`🔄 [${callId}] ${sourceName}: Rotated to next API key due to error`);
                // Try the API call again with the new key
                console.log(`🔁 [${callId}] ${sourceName}: Retrying API call with new key...`);
                return makeApiCallWithExhaustionDetectionEnhanced(sourceName, apiCallFunction, ...args);
            }
        }
        
        console.log(`⚠️ [${callId}] ${sourceName}: Non-exhaustion error - ${error.message}`);
        return [];
    }
}

function getApiStatusReportEnhanced() {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = Date.now();
    const timeSinceReset = currentTime - apiStatus.lastResetTime;
    const nextResetIn = Math.round((apiStatus.resetInterval - timeSinceReset) / 1000 / 60);
    
    // Get all API sources for the report
    const allApiSources = ['JSearch-RapidAPI', 'Adzuna', 'TheMuse', 'Reed', 'RapidAPI-Jobs', 'Theirstack', 'JobsMulti', 'Jobber'];
    
    const report = {
        reportId: reportId,
        timestamp: new Date().toISOString(),
        exhaustedApis: Array.from(apiStatus.exhaustedApis),
        suspiciousApis: Object.fromEntries(apiStatus.suspiciousApis),
        lastResetTime: new Date(apiStatus.lastResetTime).toISOString(),
        nextResetIn: nextResetIn,
        totalExhausted: apiStatus.exhaustedApis.size,
        totalSuspicious: apiStatus.suspiciousApis.size,
        resetIntervalMinutes: Math.round(apiStatus.resetInterval / 1000 / 60),
        timeSinceResetMinutes: Math.round(timeSinceReset / 1000 / 60),
        tokenRotationStatus: {
            enabled: apiStatus.tokenRotationEnabled,
            sourcesWithBackupTokens: Object.keys(apiStatus.currentTokenIndex || {})
        },
        systemHealth: {
            totalApis: allApiSources.length,
            healthyApis: allApiSources.length - apiStatus.exhaustedApis.size - apiStatus.suspiciousApis.size,
            exhaustedPercentage: Math.round((apiStatus.exhaustedApis.size / allApiSources.length) * 100),
            suspiciousPercentage: Math.round((apiStatus.suspiciousApis.size / allApiSources.length) * 100),
            healthyPercentage: Math.round(((allApiSources.length - apiStatus.exhaustedApis.size - apiStatus.suspiciousApis.size) / allApiSources.length) * 100)
        },
        detailedStatus: {
            exhausted: Array.from(apiStatus.exhaustedApis).map(api => ({
                name: api,
                status: 'exhausted',
                timeSinceExhaustion: 'unknown', // Could be enhanced to track individual exhaustion times
                estimatedRecovery: nextResetIn > 0 ? `${nextResetIn} minutes` : 'immediate',
                tokenRotation: {
                    enabled: apiStatus.tokenRotationEnabled && apiStatus.currentTokenIndex && api in apiStatus.currentTokenIndex,
                    currentTokenIndex: apiStatus.currentTokenIndex?.[api] || 0
                }
            })),
            suspicious: Array.from(apiStatus.suspiciousApis.entries()).map(([api, count]) => ({
                name: api,
                status: 'suspicious',
                suspiciousCount: count,
                maxSuspiciousFailures: apiStatus.maxSuspiciousFailures,
                remainingFailuresBeforeExhaustion: apiStatus.maxSuspiciousFailures - count,
                tokenRotation: {
                    enabled: apiStatus.tokenRotationEnabled && apiStatus.currentTokenIndex && api in apiStatus.currentTokenIndex,
                    currentTokenIndex: apiStatus.currentTokenIndex?.[api] || 0
                }
            })),
            healthy: allApiSources
                .filter(api => !apiStatus.exhaustedApis.has(api) && !apiStatus.suspiciousApis.has(api))
                .map(api => ({
                    name: api,
                    status: 'healthy',
                    tokenRotation: {
                        enabled: apiStatus.tokenRotationEnabled && apiStatus.currentTokenIndex && api in apiStatus.currentTokenIndex,
                        currentTokenIndex: apiStatus.currentTokenIndex?.[api] || 0
                    },
                    available: true
                }))
        }
    };
    
    console.log(`\n📊 [${reportId}] === ENHANCED API STATUS REPORT ===`);
    console.log(`📅 [${reportId}] Report generated at: ${report.timestamp}`);
    console.log(`🔄 [${reportId}] Last reset: ${report.timeSinceResetMinutes} minutes ago`);
    console.log(`⏰ [${reportId}] Next reset in: ${report.nextResetIn} minutes`);
    console.log(`📊 [${reportId}] System health: ${report.systemHealth.healthyPercentage}% healthy, ${report.systemHealth.exhaustedPercentage}% exhausted, ${report.systemHealth.suspiciousPercentage}% suspicious`);
    console.log(`🚫 [${reportId}] Exhausted APIs (${report.totalExhausted}): [${report.exhaustedApis.join(', ')}]`);
    console.log(`⚠️ [${reportId}] Suspicious APIs (${report.totalSuspicious}): ${JSON.stringify(report.suspiciousApis)}`);
    console.log(`✅ [${reportId}] Healthy APIs (${report.systemHealth.healthyApis}): [${report.detailedStatus.healthy.map(h => h.name).join(', ')}]`);
    console.log(`🔍 [${reportId}] Detailed status available in report object`);
    console.log(`==========================================\n`);
    
    return report;
}

function manualResetApiStatus() {
    console.log('🔄 MANUAL RESET: Clearing all API exhaustion status');
    apiStatus.exhaustedApis.clear();
    apiStatus.suspiciousApis.clear();
    apiStatus.lastResetTime = Date.now();
    
    // Reset token rotation indices if enabled
    if (apiStatus.tokenRotationEnabled && apiStatus.currentTokenIndex) {
        console.log('🔄 MANUAL RESET: Resetting all API token rotation indices');
        for (const source in apiStatus.currentTokenIndex) {
            apiStatus.currentTokenIndex[source] = 0;
        }
    }
    
    console.log('✅ All APIs reset and available for retry');
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle different request methods
    if (req.method === 'GET' && req.url?.includes('/api-status')) {
        const statusReport = getApiStatusReportEnhanced();
        return res.status(200).json(statusReport);
    }
    
    if (req.method === 'POST' && req.url?.includes('/reset-api-status')) {
        manualResetApiStatus();
        return res.status(200).json({ message: 'API status reset successfully' });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== ENHANCED JOB SEARCH REQUEST STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    try {
        const { analysis, filters } = req.body;

        if (!analysis) {
            console.error('No analysis object provided');
            return res.status(400).json({ error: 'Resume analysis is required' });
        }

        const hasData = (analysis.technicalSkills && analysis.technicalSkills.length > 0) ||
                       (analysis.workExperience && analysis.workExperience.length > 0) ||
                       (analysis.responsibilities && analysis.responsibilities.length > 0);

        if (!hasData) {
            return res.status(400).json({ 
                error: 'Unable to extract sufficient information from resume for job matching. Please ensure your resume contains clear work experience, skills, or responsibilities.' 
            });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        res.write(`data: ${JSON.stringify({
            type: 'search_started',
            message: 'Starting job search with real-time results...',
            timestamp: new Date().toISOString()
        })}\n\n`);

        let totalJobsFound = 0;
        let processedJobs = 0;
        const searchStartTime = Date.now();
        const allJobs = [];

        const onJobFound = (jobs, sourceName, sourceProgress) => {
            try {
                console.log(`=== STREAMING: ${sourceName} ===`);
                console.log(`Jobs in this batch: ${jobs.length}`);

                if (jobs.length > 0) {
                    totalJobsFound += jobs.length;
                    allJobs.push(...jobs);

                    const updateData = {
                        type: 'jobs_found',
                        jobs: jobs,
                        source: sourceName,
                        sourceProgress: sourceProgress,
                        timestamp: new Date().toISOString()
                    };

                    res.write(`data: ${JSON.stringify(updateData)}\n\n`);
                    console.log(`✅ STREAMED: ${jobs.length} jobs from ${sourceName} (Total: ${totalJobsFound})`);
                }

            } catch (sseError) {
                console.error('Error in onJobFound callback:', sseError);
            }
        };

        const onProgress = (message, percentage) => {
            try {
                const progressData = {
                    type: 'progress_update',
                    message: message,
                    percentage: percentage,
                    timestamp: new Date().toISOString()
                };
                res.write(`data: ${JSON.stringify(progressData)}\n\n`);
            } catch (error) {
                console.error('Progress update error:', error);
            }
        };

        console.log('🚀 Starting enhanced job search with REAL-TIME streaming...');

        // First try using the Jobs Collector for faster results
        onProgress('Starting Jobs Collector for faster results...', 10);
        
        try {
            const collectedJobs = await collectJobsFromAllSources(analysis, filters);
            
            if (collectedJobs.length > 0) {
                console.log(`✅ Using Jobs Collector results: ${collectedJobs.length} jobs found`);
                totalJobsFound = collectedJobs.length;
                allJobs.push(...collectedJobs);
                
                // Send all collected jobs to the client
                onJobFound(collectedJobs, 'JobsCollector', 100);
                onProgress(`Found ${totalJobsFound} jobs using Jobs Collector`, 90);
            } else {
                console.log('⚠️ Jobs Collector returned no results, falling back to standard search');
                // Fall back to the standard search process
                await scrapeJobListingsWithStreaming(analysis, filters, onJobFound, onProgress);
            }
        } catch (collectorError) {
            console.error('❌ Jobs Collector error:', collectorError.message);
            console.log('⚠️ Falling back to standard search process');
            // Fall back to the standard search process
            await scrapeJobListingsWithStreaming(analysis, filters, onJobFound, onProgress);
        }

        const totalSearchTime = ((Date.now() - searchStartTime) / 1000).toFixed(1);
        console.log(`=== JOB SEARCH COMPLETED ===`);
        console.log(`Total search time: ${totalSearchTime}s`);
        console.log(`Jobs found: ${totalJobsFound}`);

        const apiStatusReport = getApiStatusReportEnhanced();
        
        const finalData = {
            type: 'search_complete',
            allJobs: allJobs,
            totalJobs: totalJobsFound,
            searchTimeSeconds: parseFloat(totalSearchTime),
            message: `Found ${totalJobsFound} remote jobs matching your profile`,
            apiStatus: apiStatusReport,
            timestamp: new Date().toISOString()
        };

        res.write(`data: ${JSON.stringify(finalData)}\n\n`);
        res.end();

        console.log('=== JOB SEARCH REQUEST COMPLETED SUCCESSFULLY ===');

    } catch (error) {
        console.error('=== JOB SEARCH ERROR ===');
        console.error('Error:', error.message);

        let userFriendlyMessage = 'Failed to search for jobs. Please try again.';

        if (error.message.includes('No jobs found')) {
            userFriendlyMessage = error.message;
        } else if (error.message.includes('timeout')) {
            userFriendlyMessage = 'Job search timed out. Please try again.';
        } else if (error.message.includes('API')) {
            userFriendlyMessage = 'Job search service temporarily unavailable. Please try again later.';
        }

        if (!res.headersSent) {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: userFriendlyMessage,
                timestamp: new Date().toISOString()
            })}\n\n`);
            res.end();
        }
    }
}

async function collectJobsFromAllSources(analysis, filters) {
    console.log('🔄 Jobs Collector: Starting job collection from all sources...');
    const allJobs = [];
    const sourceResults = {};
    
    // Get available sources with API keys
    const availableSources = sources.filter(source => {
        const hasKey = checkApiKeyForSourceEnhanced(source.name).hasKey;
        if (!hasKey) {
            console.log(`⚠️ Jobs Collector: Skipping ${source.name} - API key missing`);
        }
        return hasKey;
    });
    
    if (availableSources.length === 0) {
        console.log('❌ Jobs Collector: No sources available with valid API keys');
        return [];
    }
    
    console.log(`✅ Jobs Collector: Found ${availableSources.length} available sources`);
    
    // Collect jobs from all available sources in parallel
    const results = await Promise.allSettled(
        availableSources.map(async (source) => {
            try {
                console.log(`🔍 Jobs Collector: Collecting from ${source.name}...`);
                const jobs = await source.func(analysis, filters);
                sourceResults[source.name] = {
                    count: jobs.length,
                    success: true
                };
                console.log(`✅ Jobs Collector: ${source.name} returned ${jobs.length} jobs`);
                return jobs;
            } catch (error) {
                console.error(`❌ Jobs Collector: Error collecting from ${source.name}:`, error.message);
                sourceResults[source.name] = {
                    count: 0,
                    success: false,
                    error: error.message
                };
                return [];
            }
        })
    );
    
    // Process results
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            allJobs.push(...result.value);
        }
    });
    
    // Remove duplicates based on title and company
    const uniqueJobs = [];
    const jobMap = new Map();
    
    allJobs.forEach(job => {
        const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
        if (!jobMap.has(key)) {
            jobMap.set(key, true);
            uniqueJobs.push(job);
        }
    });
    
    console.log(`✅ Jobs Collector: Collected ${uniqueJobs.length} unique jobs from ${availableSources.length} sources`);
    
    // Log source statistics
    console.log('📊 Jobs Collector: Source statistics:');
    Object.entries(sourceResults).forEach(([source, result]) => {
        console.log(`  - ${source}: ${result.count} jobs, ${result.success ? 'Success' : 'Failed'}`); 
    });
    
    return uniqueJobs;
}

async function scrapeJobListingsWithStreaming(analysis, filters, onJobFound, onProgress) {
    console.log('=== STARTING REAL-TIME JOB SEARCH WITH DEBUGGING ===');
    
    const MIN_JOBS_PER_SOURCE = 10;
    const MAX_JOBS_PER_SOURCE = 50;
    const MAX_QUERIES_PER_SOURCE = 10;
    
    console.log('🔑 API KEY STATUS:');
    console.log('  OpenAI:', process.env.OPENAI_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Theirstack:', process.env.THEIRSTACK_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Adzuna App ID:', process.env.ADZUNA_APP_ID ? 'EXISTS' : 'MISSING');
    console.log('  Adzuna API Key:', process.env.ADZUNA_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  JobsMulti:', process.env.JOBSMULTI_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Jobber:', process.env.JOBBER_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  TheMuse:', process.env.THEMUSE_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Reed:', process.env.REED_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  RapidAPI:', process.env.RAPIDAPI_KEY ? 'EXISTS' : 'MISSING');

    const sources = [
        { name: 'JSearch-RapidAPI', func: searchJSearchRapidAPIWithDetection, weight: 20 },
        { name: 'Adzuna', func: searchAdzunaJobsWithDetection, weight: 20 },
        { name: 'TheMuse', func: searchTheMuseJobsWithDetection, weight: 20 },
        { name: 'Reed', func: searchReedJobsWithDetection, weight: 15 },
        { name: 'RapidAPI-Jobs', func: searchRapidAPIJobsWithDetection, weight: 15 },
        { name: 'Theirstack', func: searchTheirstackJobsWithDetection, weight: 10 },
        { name: 'JobsMulti', func: searchJobsMultiWithDetection, weight: 25 },
        { name: 'Jobber', func: searchJobberWithDetection, weight: 20 }
    ];

    const queries = generateFocusedSearchQueries(analysis);
    console.log('📝 Generated focused queries:', queries);

    onProgress('Generating search queries...', 5);

    const allJobs = [];
    const processedJobKeys = new Set();
    let currentProgress = 0;
    
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        const source = sources[sourceIndex];
        const sourceStartProgress = currentProgress;
        const sourceEndProgress = currentProgress + source.weight;
        
        console.log(`\n🔍 === PROCESSING SOURCE ${sourceIndex + 1}/${sources.length}: ${source.name} ===`);
        
        onProgress(`Searching ${source.name}...`, sourceStartProgress);
        
        try {
            const hasApiKey = checkApiKeyForSourceEnhanced(source.name);
            if (!hasApiKey) {
                console.log(`❌ ${source.name}: Missing API key - SKIPPING`);
                currentProgress = sourceEndProgress;
                onProgress(`Skipped ${source.name} (no API key)`, sourceEndProgress);
                continue;
            }
            
            console.log(`✅ ${source.name}: API key found - PROCEEDING`);
            
            const sourceMatchedJobs = [];
            let queriesProcessed = 0;
            
            const maxQueries = source.name === 'Reed' ? 10 : 15;
            const sourceJobs = [];
            
            console.log(`📝 ${source.name}: Processing ${maxQueries} queries`);
            
            const delayBetweenQueries = source.name === 'Reed' ? 300 : 500;
            
            for (let i = 0; i < Math.min(queries.length, maxQueries); i++) {
                const query = queries[i];
                console.log(`   🔎 Query ${i + 1}/${maxQueries}: "${query}"`);

                try {
                    console.log(`   📞 Calling ${source.name} API...`);
                    const jobs = await source.func(query, filters);
                    
                    console.log(`   📥 ${source.name} returned ${jobs.length} raw jobs`);
                    if (jobs.length > 0) {
                        console.log(`   📋 Sample job titles: ${jobs.slice(0, 3).map(j => j?.title || 'No title').join(', ')}`);
                        
                        const isLenient = source.name !== 'Reed';
                        
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
                            
                            const isRemote = isQuickRemoteCheck(job);
                            if (!isRemote) {
                                console.log(`   ❌ ${source.name}: Skipping non-remote job "${job.title}" (location: ${job.location})`);
                                return false;
                            }
                            
                            processedJobKeys.add(key);
                            return true;
                        });
                        
                        console.log(`   🔍 After filtering: ${filteredJobs.length} jobs`);
                        
                        if (filteredJobs.length > 0) {
                            const userFilteredJobs = applyJobFilters(filteredJobs, filters);
                            console.log(`   ⚙️ After user filters: ${userFilteredJobs.length} jobs`);
                            
                            if (userFilteredJobs.length > 0) {
                                console.log(`   🤖 Starting AI matching for ${userFilteredJobs.length} jobs...`);
                                
                                const aiMatchedJobs = await filterRealHighMatchJobsWithStreaming(
                                    userFilteredJobs, 
                                    analysis, 
                                    processedJobKeys, 
                                    onJobFound, 
                                    source.name, 
                                    sourceStartProgress, 
                                    source.weight, 
                                    i, 
                                    maxQueries
                                );
                                
                                console.log(`   🎯 AI matched: ${aiMatchedJobs.length} jobs with 70%+ match`);
                                
                                if (aiMatchedJobs.length > 0) {
                                    sourceMatchedJobs.push(...aiMatchedJobs);
                                    allJobs.push(...aiMatchedJobs);
                                }
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

    console.log(`\n🎯 === SEARCH COMPLETED ===`);
    console.log(`Total jobs found: ${allJobs.length}`);

    if (allJobs.length === 0) {
        throw new Error('No remote jobs found matching your profile. Try broadening your search criteria or updating your resume with more common industry terms.');
    }

    const sortedJobs = allJobs.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

    return {
        allJobs: sortedJobs,
        totalJobs: sortedJobs.length
    };
}

function isQuickRemoteCheck(job) {
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

async function filterRealHighMatchJobsWithStreaming(jobs, analysis, processedJobs, onJobFound, sourceName, sourceStartProgress, sourceWeight, queryIndex, maxQueries) {
    const highMatchJobs = [];
    const batchSize = 2;
    
    console.log(`🔍 ${sourceName} has ${jobs.length} jobs before AI matching`);
    if (jobs.length > 0) {
        console.log(`📋 Sample job titles from ${sourceName}: ${jobs.slice(0, 3).map(j => j.title).join(' | ')}`);
    }
    
    const sourceBoost = sourceName !== 'Reed' ? 10 : 0;
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job, index) => {
            if (!job || !job.title || !job.company) {
                return null;
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, index * 100));
                
                console.log(`🔍 AI Processing: "${job.title}" from "${job.source}"`);
                
                const aiMatch = await calculateRealAIJobMatch(job, analysis);
                
                let boostedMatchPercentage = aiMatch.matchPercentage;
                if (sourceBoost > 0) {
                    boostedMatchPercentage = Math.min(aiMatch.matchPercentage + sourceBoost, 95);
                    console.log(`🚀 Boosting ${job.source} job from ${aiMatch.matchPercentage}% to ${boostedMatchPercentage}%`);
                    aiMatch.matchPercentage = boostedMatchPercentage;
                }
                
                if (aiMatch.matchPercentage >= 70) {
                    const enhancedJob = {
                        ...job,
                        ...aiMatch,
                        source: job.source || 'Unknown'
                    };
                    
                    console.log(`✅ AI Match: "${enhancedJob.title}" with ${enhancedJob.matchPercentage}% match`);
                    return enhancedJob;
                } else {
                    console.log(`❌ AI filtered out: "${job.title}" from "${job.source}" with ${aiMatch.matchPercentage}% match (below 70% threshold)`);
                }
                
                return null;
            } catch (error) {
                console.error(`❌ AI match analysis failed for "${job.title}":`, {
                    error: error.message,
                    stack: error.stack?.substring(0, 200),
                    jobTitle: job.title,
                    jobSource: job.source
                });
                
                const basicMatch = calculateEnhancedBasicMatchFixed(job, analysis);
                const boostedBasicMatch = Math.min(basicMatch + sourceBoost, 95);
                
                if (boostedBasicMatch >= 70) {
                    console.log(`⚠️ Using basic match for "${job.title}": ${boostedBasicMatch}% (with ${sourceBoost}% boost)`);
                    return {
                        ...job,
                        matchPercentage: boostedBasicMatch,
                        matchedTechnicalSkills: [],
                        matchedSoftSkills: [],
                        matchedExperience: [],
                        missingRequirements: [],
                        reasoning: `Basic match with ${sourceBoost}% boost due to AI analysis failure: ${error.message}`,
                        industryMatch: Math.min(boostedBasicMatch, 90),
                        seniorityMatch: Math.min(boostedBasicMatch - 5, 85),
                        growthPotential: boostedBasicMatch >= 80 ? 'high' : 'medium'
                    };
                }
                
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(job => job !== null);
        
        if (validResults.length > 0) {
            highMatchJobs.push(...validResults);
            
            const currentProgress = sourceStartProgress + ((queryIndex + 1) / maxQueries) * sourceWeight;
            console.log(`📡 STREAMING ${validResults.length} AI-matched jobs from ${sourceName}`);
            onJobFound(validResults, sourceName, Math.round(currentProgress));
        }
        
        if (i + batchSize < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return highMatchJobs;
}

async function calculateRealAIJobMatch(job, analysis) {
    const openai = getOpenAIClient();
    
    try {
        const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are a job matching expert. Your PRIMARY RESPONSIBILITY is to correctly identify missing requirements.

CRITICAL RULE FOR MISSING REQUIREMENTS:
- Only list things the JOB REQUIRES that the CANDIDATE DOES NOT HAVE
- Do NOT list candidate skills that aren't mentioned in the job
- Do NOT list "nice to have" or "preferred" requirements
- If no requirements are missing, return ["None"] and set matchPercentage to 100

SCORING LOGIC:
- If missingRequirements = ["None"] → matchPercentage should be 100
- If candidate meets all job requirements → perfect match = 100%
- Be generous with scores (aim for 70%+ minimum) but reward complete matches with 100%

EXAMPLES:
✅ CORRECT: Job requires "Python", candidate has no Python → missing: ["Python"], score: 70-85%
✅ CORRECT: Job requires "Master's degree", candidate has Bachelor's → missing: ["Master's degree"], score: 75-90%
✅ CORRECT: Candidate meets ALL job requirements → missing: ["None"], score: 100%
❌ WRONG: Job doesn't mention "Java", candidate has Java → DO NOT include Java as missing
❌ WRONG: Job says "PhD preferred", candidate has Master's → DO NOT include PhD as missing

You must be generous with match scores (aim for 70%+) but strict about only listing actual missing requirements.`
            },
            {
                role: "user",
                content: `I need you to analyze how well this candidate matches this job posting.

JOB POSTING: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${job.description ? job.description.substring(0, 800) : 'No description available'}

CANDIDATE PROFILE:
- Technical Skills: ${analysis.technicalSkills?.slice(0, 15).join(', ') || 'None'}
- Work Experience: ${analysis.workExperience?.slice(0, 8).join(', ') || 'None'}
- Industries: ${analysis.industries?.slice(0, 5).join(', ') || 'None'}
- Responsibilities: ${analysis.responsibilities?.slice(0, 8).join(', ') || 'None'}
- Qualifications: ${analysis.qualifications?.slice(0, 5).join(', ') || 'None'}
- Education: ${analysis.education?.slice(0, 5).join(', ') || 'None'}
- Seniority Level: ${analysis.seniorityLevel || 'None'}

Please analyze this match following these steps:
1. First, identify what the job posting REQUIRES (ignore "nice to have" or "preferred")
2. Then, check if the candidate has each of those requirements
3. For missingRequirements: ONLY list job requirements the candidate lacks. Do NOT list candidate skills that aren't mentioned in the job.
4. If the candidate has ALL job requirements, set missingRequirements to ["None"] and matchPercentage to 100

Return your analysis as JSON:
{
  "matchPercentage": number (0-100, representing OVERALL comprehensive fit),
  "matchedTechnicalSkills": ["candidate skills that match job requirements"],
  "matchedSoftSkills": ["candidate soft skills that match job needs"],
  "matchedExperience": ["candidate experience that aligns with job"],
  "missingRequirements": ["None" if candidate has all requirements, otherwise list only what job requires that candidate lacks],
  "reasoning": "explain the OVERALL comprehensive match assessment",
  "industryMatch": number (0-100),
  "seniorityMatch": number (0-100),
  "growthPotential": "low|medium|high"
}`
            }
        ],
        temperature: 0.1,
        max_tokens: 600
    });

    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            matchPercentage: parsed.matchPercentage || 0,
            matchedTechnicalSkills: parsed.matchedTechnicalSkills || [],
            matchedSoftSkills: parsed.matchedSoftSkills || [],
            matchedExperience: parsed.matchedExperience || [],
            missingRequirements: parsed.missingRequirements || [],
            reasoning: parsed.reasoning || 'Comprehensive AI analysis completed',
            industryMatch: parsed.industryMatch || 0,
            seniorityMatch: parsed.seniorityMatch || 0,
            growthPotential: parsed.growthPotential || 'medium'
        };
    } else {
        throw new Error('No valid JSON found in AI response');
    }
    
    } catch (openaiError) {
        console.error(`🤖 OpenAI API Error for "${job.title}":`, {
            error: openaiError.message,
            type: openaiError.type || 'unknown',
            code: openaiError.code || 'unknown',
            status: openaiError.status || 'unknown'
        });
        
        throw new Error(`OpenAI API failed: ${openaiError.message}`);
    }
}

// Enhanced API functions with automatic exhaustion detection
async function searchJSearchRapidAPIWithDetection(query, filters) {
            return makeApiCallWithExhaustionDetectionEnhanced('JSearch-RapidAPI', async () => {
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
        
        const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
            params: {
                query: query,
                page: '1',
                num_pages: '2', 
                remote_jobs_only: 'true'
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            },
            timeout: 15000
        });

        console.log(`✅ JSearch responded: ${response.status}`);
        
        if (response.headers['x-rapidapi-quota-left']) {
            const quotaLeft = parseInt(response.headers['x-rapidapi-quota-left']);
            console.log(`📊 RapidAPI quota remaining: ${quotaLeft}`);
            
            if (quotaLeft <= 5) {
                console.log(`⚠️ RapidAPI quota very low: ${quotaLeft} requests left`);
            }
        }

        if (!response.data?.data) {
            throw new Error('No data field in response');
        }

        return response.data.data
            .filter(job => job && job.job_title && job.employer_name)
            .map(job => ({
                title: job.job_title,
                company: job.employer_name,
                location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country}` : 'Remote',
                link: job.job_apply_link || job.job_url || '#',
                source: 'JSearch-RapidAPI',
                description: job.job_description || '',
                salary: formatRapidAPISalary(job.job_min_salary, job.job_max_salary),
                type: job.job_employment_type || 'Full-time',
                datePosted: job.job_posted_at_datetime_utc || new Date().toISOString()
            }));
    });
}

async function searchAdzunaJobsWithDetection(query, filters) {
            return makeApiCallWithExhaustionDetectionEnhanced('Adzuna', async () => {
        const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
        const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;
        
        const response = await axios.get('https://api.adzuna.com/v1/api/jobs/us/search/1', {
            params: {
                app_id: ADZUNA_APP_ID,
                app_key: ADZUNA_API_KEY,
                what: query.replace('remote ', ''),
                where: 'remote',
                results_per_page: 50,
                sort_by: 'relevance'
            },
            timeout: 15000
        });

        console.log(`✅ Adzuna responded: ${response.status}`);

        if (!response.data?.results) {
            throw new Error('No results field in response');
        }

        return response.data.results.map(job => ({
            title: job.title,
            company: job.company?.display_name || 'Unknown Company',
            location: job.location?.display_name || 'Remote',
            link: job.redirect_url,
            source: 'Adzuna',
            description: job.description || '',
            salary: formatSalary(job.salary_min, job.salary_max),
            type: job.contract_time || 'Full-time',
            datePosted: job.created || new Date().toISOString()
        }));
    });
}

async function searchTheMuseJobsWithDetection(query, filters) {
            return makeApiCallWithExhaustionDetectionEnhanced('TheMuse', async () => {
        const THEMUSE_API_KEY = process.env.THEMUSE_API_KEY;
        
        const categories = [];
        if (query.includes('developer') || query.includes('engineer') || query.includes('programming')) {
            categories.push('Engineering');
        }
        if (query.includes('data') || query.includes('analyst')) {
            categories.push('Data Science');
        }
        if (query.includes('manager') || query.includes('product')) {
            categories.push('Product');
        }
        if (query.includes('design')) {
            categories.push('Design');
        }
        
        const response = await axios.get('https://www.themuse.com/api/public/jobs', {
            params: {
                api_key: THEMUSE_API_KEY,
                page: 0,
                limit: 50,
                location: 'Remote',
                category: categories.length > 0 ? categories.join(',') : undefined,
                q: query,
                level: filters.experience || undefined
            },
            timeout: 15000
        });

        console.log(`✅ TheMuse responded: ${response.status}`);

        if (!response.data?.results) {
            throw new Error('No results field in response');
        }

        return response.data.results.map(job => ({
            title: job.name,
            company: job.company?.name || 'Unknown Company',
            location: 'Remote',
            link: job.refs?.landing_page,
            source: 'TheMuse',
            description: job.contents || '',
            salary: 'Salary not specified',
            type: job.type || 'Full-time',
            datePosted: job.publication_date || new Date().toISOString()
        }));
    });
}

async function searchJobberWithDetection(query, filters) {
    return makeApiCallWithExhaustionDetectionEnhanced('Jobber', async () => {
        const JOBBER_API_KEY = process.env.JOBBER_API_KEY;
        
        if (!JOBBER_API_KEY) {
            console.log('❌ Jobber API key missing');
            return [];
        }
        
        console.log('🔍 Jobber: Making API request...');
        
        try {
            // Jobber API endpoint
            const response = await axios.get('https://api.jobber.io/v1/jobs', {
                params: {
                    query: query,
                    remote: true,
                    page: 1,
                    per_page: 50
                },
                headers: {
                    'X-API-Key': JOBBER_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            
            console.log(`✅ Jobber responded with ${response.data?.jobs?.length || 0} jobs`);
            
            if (!response.data?.jobs) {
                return [];
            }
            
            return response.data.jobs.map(job => ({
                title: job.title,
                company: job.company_name || 'Unknown Company',
                location: job.location || 'Remote',
                link: job.apply_url || '#',
                source: 'Jobber',
                description: job.description || '',
                salary: job.salary_range || 'Salary not specified',
                type: job.employment_type || 'Full-time',
                datePosted: job.posted_date || new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Jobber API error:', error.message);
            return [];
        }
    });
}

async function searchJobsMultiWithDetection(query, filters) {
    return makeApiCallWithExhaustionDetectionEnhanced('JobsMulti', async () => {
        const JOBSMULTI_API_KEY = process.env.JOBSMULTI_API_KEY;
        
        if (!JOBSMULTI_API_KEY) {
            console.log('❌ JobsMulti API key missing');
            return [];
        }
        
        console.log('🔍 JobsMulti: Making API request...');
        
        try {
            // JobsMulti API endpoint
            const response = await axios.get('https://api.jobapis.com/v1/search', {
                params: {
                    q: query,
                    location: filters.location || 'Remote',
                    remote: true,
                    page: 1,
                    limit: 50
                },
                headers: {
                    'Authorization': `Bearer ${JOBSMULTI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            
            console.log(`✅ JobsMulti responded with ${response.data?.jobs?.length || 0} jobs`);
            
            if (!response.data?.jobs) {
                return [];
            }
            
            return response.data.jobs.map(job => ({
                title: job.title,
                company: job.company || 'Unknown Company',
                location: job.location || 'Remote',
                link: job.url || job.apply_url || '#',
                source: 'JobsMulti',
                description: job.description || '',
                salary: job.salary || 'Salary not specified',
                type: job.job_type || 'Full-time',
                datePosted: job.date_posted || new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ JobsMulti API error:', error.message);
            return [];
        }
    });
}

async function searchRapidAPIJobsWithDetection(query, filters) {
            return makeApiCallWithExhaustionDetectionEnhanced('RapidAPI-Jobs', async () => {
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
        
        const response = await axios.get('https://jobs-api14.p.rapidapi.com/list', {
            params: {
                query: query,
                location: 'Remote',
                distance: '1.0',
                language: 'en_GB',
                remoteOnly: 'true',
                datePosted: 'month',
                jobType: 'fulltime',
                index: '0'
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jobs-api14.p.rapidapi.com'
            },
            timeout: 15000
        });

        console.log(`✅ RapidAPI-Jobs responded: ${response.status}`);

        if (!response.data?.jobs) {
            throw new Error('No jobs field in response');
        }

        return response.data.jobs.map(job => ({
            title: job.title,
            company: job.company || 'Unknown Company',
            location: job.location || 'Remote',
            link: job.url,
            source: 'RapidAPI-Jobs',
            description: job.description || '',
            salary: job.salary || 'Salary not specified',
            type: job.jobType || 'Full-time',
            datePosted: job.datePosted || new Date().toISOString()
        }));
    });
}

async function searchReedJobsWithDetection(query, filters) {
            return makeApiCallWithExhaustionDetectionEnhanced('Reed', async () => {
        const REED_API_KEY = process.env.REED_API_KEY;
        
        const response = await axios.get('https://www.reed.co.uk/api/1.0/search', {
            params: {
                keywords: query.replace('remote ', ''),
                locationName: 'Remote',
                distanceFromLocation: 0,
                resultsToTake: 50
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(`${REED_API_KEY}:`).toString('base64')}`,
                'User-Agent': 'JobMatcher/1.0'
            },
            timeout: 15000
        });

        console.log(`✅ Reed responded: ${response.status}`);

        if (!response.data?.results) {
            throw new Error('No results field in response');
        }

        return response.data.results.map(job => ({
            title: job.jobTitle,
            company: job.employerName || 'Unknown Company',
            location: 'Remote',
            link: job.jobUrl,
            source: 'Reed',
            description: job.jobDescription || '',
            salary: job.maximumSalary ? `${job.minimumSalary}-${job.maximumSalary} ${job.currency}` : 'Salary not specified',
            type: job.employmentType || 'Full-time',
            datePosted: job.datePosted || new Date().toISOString()
        }));
    });
}

async function searchTheirstackJobsWithDetection(query, filters) {
            return makeApiCallWithExhaustionDetectionEnhanced('Theirstack', async () => {
        const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
        
        if (theirstackUsageCount >= 200) {
            throw new Error('Theirstack usage limit reached (200 requests)');
        }
        
        const response = await axios.get('https://api.theirstack.com/v1/jobs/search', {
            params: {
                query: query,
                location: 'Remote',
                limit: 50
            },
            headers: {
                'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log(`✅ Theirstack responded: ${response.status}`);
        theirstackUsageCount++;

        if (!response.data?.jobs) {
            throw new Error('No jobs field in response');
        }

        return response.data.jobs.map(job => ({
            title: job.title,
            company: job.company?.name || 'Unknown Company',
            location: job.location || 'Remote',
            link: job.url,
            source: 'Theirstack',
            description: job.description || '',
            salary: job.salary?.range ? `${job.salary.range.min}-${job.salary.range.max} ${job.salary.currency}` : 'Salary not specified',
            type: job.type || 'Full-time',
            datePosted: job.posted_at || new Date().toISOString()
        }));
    });
}

// Utility functions
function generateFocusedSearchQueries(analysis) {
    const queries = new Set();
    
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
    
    if (queries.size < 3) {
        queries.add('remote software engineer');
        queries.add('remote developer');
        queries.add('remote manager');
    }
    
    console.log('Generated queries:', Array.from(queries));
    return Array.from(queries).slice(0, 6);
}

function calculateEnhancedBasicMatchFixed(job, analysis) {
    if (!job) return 0;
    
    const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    const techSkills = analysis.technicalSkills || [];
    if (techSkills.length > 0) {
        let matchedCount = 0;
        techSkills.forEach(skill => {
            const skillString = typeof skill === 'string' ? skill.toLowerCase() : String(skill || '').toLowerCase();
            
            if (skillString.length > 2) {
                const skillWords = skillString.split(/[\s\.]+/);
                const hasMatch = skillWords.some(word => {
                    if (word.length < 3) return false;
                    return jobText.includes(word);
                }) || jobText.includes(skillString);
                
                if (hasMatch) matchedCount++;
            }
        });
        
        const techScore = Math.min((matchedCount / Math.min(techSkills.length, 10)) * 100, 100);
        totalScore += techScore * 0.35;
        maxPossibleScore += 35;
        console.log(`    Tech skills: ${matchedCount}/${techSkills.length} = ${techScore.toFixed(1)}%`);
    }
    
    const workExperience = analysis.workExperience || [];
    if (workExperience.length > 0) {
        let roleMatchScore = 0;
        const jobTitle = job.title.toLowerCase();
        
        workExperience.forEach(exp => {
            const expString = typeof exp === 'string' ? exp.toLowerCase() : 
                             (exp && exp.jobTitle ? exp.jobTitle.toLowerCase() : String(exp || '').toLowerCase());
            
            if (expString.includes('engineer') && jobTitle.includes('developer')) roleMatchScore = 90;
            else if (expString.includes('developer') && jobTitle.includes('engineer')) roleMatchScore = 90;
            else if (expString.includes('manager') && jobTitle.includes('lead')) roleMatchScore = 80;
            else if (expString.includes('analyst') && jobTitle.includes('analytics')) roleMatchScore = 85;
            
            const expWords = expString.split(' ').filter(word => word.length > 2);
            const titleWords = jobTitle.split(' ').filter(word => word.length > 2);
            
            const matchingWords = expWords.filter(word => 
                titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
            );
            
            if (matchingWords.length > 0) {
                const wordMatchScore = (matchingWords.length / Math.max(expWords.length, 1)) * 100;
                roleMatchScore = Math.max(roleMatchScore, wordMatchScore);
            }
        });
        
        roleMatchScore = Math.min(roleMatchScore + 15, 100);
        
        totalScore += roleMatchScore * 0.30;
        maxPossibleScore += 30;
        console.log(`    Role match: ${roleMatchScore.toFixed(1)}%`);
    }
    
    const industries = analysis.industries || [];
    if (industries.length > 0) {
        let industryMatchScore = 0;
        industries.forEach(industry => {
            const industryString = typeof industry === 'string' ? industry.toLowerCase() : String(industry || '').toLowerCase();
            if (industryString.length > 2 && jobText.includes(industryString)) {
                industryMatchScore = 100;
            }
        });
        
        if (industryMatchScore === 0) industryMatchScore = 60;
        
        totalScore += industryMatchScore * 0.20;
        maxPossibleScore += 20;
        console.log(`    Industry match: ${industryMatchScore}%`);
    }
    
    const responsibilities = analysis.responsibilities || [];
    if (responsibilities.length > 0) {
        let keywordMatchCount = 0;
        responsibilities.forEach(resp => {
            const respString = typeof resp === 'string' ? resp.toLowerCase() : String(resp || '').toLowerCase();
            const keywords = respString.split(' ').filter(word => word.length > 3);
            
            keywords.forEach(keyword => {
                if (jobText.includes(keyword)) {
                    keywordMatchCount++;
                }
            });
        });
        
        const keywordScore = Math.min((keywordMatchCount / Math.max(responsibilities.length, 1)) * 100 + 20, 100);
        totalScore += keywordScore * 0.15;
        maxPossibleScore += 15;
        console.log(`    Keyword match: ${keywordScore.toFixed(1)}%`);
    }
    
    const jobTitleLower = job.title.toLowerCase();
    const experienceTitles = analysis.workExperience.map(exp => 
        typeof exp === 'string' ? exp.toLowerCase() : 
        (exp && exp.jobTitle ? exp.jobTitle.toLowerCase() : '')
    ).filter(t => t.length > 0);
    
    if (experienceTitles.some(title => 
        jobTitleLower.includes(title) || title.includes(jobTitleLower)
    )) {
        totalScore += 10;
        maxPossibleScore += 10;
        console.log(`    Title exact match boost: +10%`);
    }
    
    const finalScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    
    console.log(`    Final basic match for "${job.title}": ${finalScore}%`);
    
    return Math.min(finalScore, 95);
}

function formatSalary(min, max) {
    if (min && max) {
        const minFormatted = min >= 1000 ? `${Math.round(min/1000)}k` : min.toLocaleString();
        const maxFormatted = max >= 1000 ? `${Math.round(max/1000)}k` : max.toLocaleString();
        return `$${minFormatted} - $${maxFormatted}`;
    } else if (min) {
        const minFormatted = min >= 1000 ? `${Math.round(min/1000)}k` : min.toLocaleString();
        return `From $${minFormatted}`;
    } else if (max) {
        const maxFormatted = max >= 1000 ? `${Math.round(max/1000)}k` : max.toLocaleString();
        return `Up to $${maxFormatted}`;
    }
    return 'Salary not specified';
}

function formatRapidAPISalary(minSalary, maxSalary) {
    let min = null, max = null;
    
    try {
        if (typeof minSalary === 'number' && minSalary > 0) {
            min = minSalary;
        } else if (typeof minSalary === 'string' && minSalary.trim()) {
            const parsed = parseFloat(minSalary.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
                min = parsed;
            }
        }
        
        if (typeof maxSalary === 'number' && maxSalary > 0) {
            max = maxSalary;
        } else if (typeof maxSalary === 'string' && maxSalary.trim()) {
            const parsed = parseFloat(maxSalary.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
                max = parsed;
            }
        }
    } catch (error) {
        return 'Salary not specified';
    }
    
    return formatSalary(min, max);
}

function getSalaryThreshold(salaryFilter) {
    const thresholds = {
        '50k': 50000,
        '75k': 75000,
        '100k': 100000,
        '125k': 125000,
        '150k': 150000
    };
    return thresholds[salaryFilter] || 0;
}

function extractSalaryNumbersFromStringFixed(salaryStr) {
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
        console.log(`💰 Converted hourly to annual: ${salaryStr} -> min: ${min}, max: ${max}`);
    }
    
    if (isPounds && (min > 0 || max > 0)) {
        min = Math.round(min * conversionRate);
        max = Math.round(max * conversionRate);
        console.log(`💰 Converting GBP to USD: ${salaryStr} -> £${min/conversionRate}-£${max/conversionRate} -> $${min}-$${max}`);
    }
    
    console.log(`💰 Salary extraction: "${salaryStr}" -> min: ${min}, max: ${max} ${isPounds ? '(converted from GBP)' : ''} ${isHourly ? '(converted from hourly)' : ''}`);
    
    return { min, max };
}

function applyJobFilters(jobs, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return jobs;
    }

    console.log(`🔍 Applying filters:`, filters);
    console.log(`📊 Initial jobs count: ${jobs.length}`);
    
    let filteredJobs = [...jobs];

    if (filters.salary && filters.salary !== '') {
        const salaryThreshold = getSalaryThreshold(filters.salary);
        console.log(`💰 Salary threshold: ${salaryThreshold} (${filters.salary})`);
        
        if (salaryThreshold > 0) {
            const beforeSalaryFilter = filteredJobs.length;
            filteredJobs = filteredJobs.filter(job => {
                const salaryNumbers = extractSalaryNumbersFromStringFixed(job.salary);
                
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
                
                console.log(`💰 Job "${job.title}": salary="${job.salary}" -> min:${salaryNumbers.min}, max:${salaryNumbers.max} -> passes:${passes}`);
                return passes;
            });
            console.log(`💰 Salary filter: ${beforeSalaryFilter} -> ${filteredJobs.length} jobs`);
        }
    }

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
            
            console.log(`👔 Job "${job.title}": experience="${filters.experience}" -> passes:${passes}`);
            return passes;
        });
        console.log(`👔 Experience filter: ${beforeExperienceFilter} -> ${filteredJobs.length} jobs`);
    }

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
            
            console.log(`🌍 Job "${job.title}": timezone="${filters.timezone}" -> passes:${passes}`);
            return passes;
        });
        console.log(`🌍 Timezone filter: ${beforeTimezoneFilter} -> ${filteredJobs.length} jobs`);
    }

    console.log(`✅ Final filtered jobs count: ${filteredJobs.length}`);
    return filteredJobs;
}

function extractSalaryFromDescription(description) {
    if (!description) return 'Salary not specified';
    
    const desc = description.toLowerCase();
    
    const patterns = [
        /\$(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–to]\s*\$(\d{1,3}(?:,\d{3})*(?:k)?)/i,
        /(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–to]\s*(\d{1,3}(?:,\d{3})*(?:k)?)\s*(?:usd|dollars?)/i,
        /salary[:\s]*\$(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–to]\s*\$(\d{1,3}(?:,\d{3})*(?:k)?)/i,
        /compensation[:\s]*\$(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–to]\s*\$(\d{1,3}(?:,\d{3})*(?:k)?)/i,
        /pay[:\s]*\$(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–to]\s*\$(\d{1,3}(?:,\d{3})*(?:k)?)/i
    ];
    
    for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
            let min = parseInt(match[1].replace(/[k,]/g, ''));
            let max = parseInt(match[2].replace(/[k,]/g, ''));
            
            if (match[1].includes('k')) min *= 1000;
            if (match[2].includes('k')) max *= 1000;
            
            return formatSalary(min, max);
        }
    }
    
    return 'Salary not specified';
}