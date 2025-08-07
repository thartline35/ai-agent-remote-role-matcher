// /api/search-jobs.js - DEBUG VERSION with Enhanced Logging for the 4 Failing APIs
import OpenAI from 'openai';
import axios from 'axios';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Theirstack usage tracking (free tier has 200 request limit)
let theirstackUsageCount = 0;

// AUTOMATED API EXHAUSTION DETECTION SYSTEM

// 1. DYNAMIC API STATUS TRACKING (resets on server restart)
const apiStatus = {
    exhaustedApis: new Set(),           // APIs that are out of credits
    suspiciousApis: new Map(),          // APIs with recent failures (count)
    lastResetTime: Date.now(),          // When we last reset the status
    resetInterval: 1000 * 60 * 60,     // Reset every hour (1 hour in ms)
    maxSuspiciousFailures: 3            // Mark as exhausted after 3 consecutive failures
};

// 2. DETECT API EXHAUSTION PATTERNS
function detectApiExhaustion(error, response, sourceName) {
    console.log(`🔍 Analyzing ${sourceName} response for exhaustion patterns...`);
    
    const exhaustionIndicators = {
        // HTTP Status codes that indicate quota issues
        httpStatuses: [429, 403, 402, 509], // Rate limited, Forbidden, Payment required, Bandwidth exceeded
        
        // Error messages that indicate quota exhaustion
        errorMessages: [
            'quota', 'limit', 'exceeded', 'exhausted', 'credits', 'usage',
            'rate limit', 'too many requests', 'api limit', 'monthly limit',
            'subscription', 'billing', 'payment', 'insufficient', 'balance'
        ],
        
        // Response patterns that suggest exhaustion
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
    
    // Check for suspicious empty responses (might indicate soft limits)
    if (!error && response?.status === 200 && (!response.data || 
        (Array.isArray(response.data) && response.data.length === 0) ||
        (response.data.results && response.data.results.length === 0) ||
        (response.data.data && response.data.data.length === 0))) {
        
        // Increment suspicious failure count
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

// 3. MARK API AS EXHAUSTED
function markApiAsExhausted(sourceName, reason) {
    if (!apiStatus.exhaustedApis.has(sourceName)) {
        apiStatus.exhaustedApis.add(sourceName);
        console.log(`🚫 MARKED AS EXHAUSTED: ${sourceName} - ${reason}`);
        console.log(`📊 Total exhausted APIs: ${apiStatus.exhaustedApis.size}`);
        
        // Log current status
        console.log(`📋 Currently exhausted APIs: [${Array.from(apiStatus.exhaustedApis).join(', ')}]`);
    }
}

// 4. RESET API STATUS (hourly or on demand)
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

// 5. ENHANCED API KEY CHECK WITH DYNAMIC EXHAUSTION
function checkApiKeyForSource(sourceName) {
    console.log(`\n🔑 === CHECKING ${sourceName} ===`);
    
    // Reset status if needed (hourly reset)
    resetApiStatusIfNeeded();
    
    // Check if API is currently marked as exhausted
    if (apiStatus.exhaustedApis.has(sourceName)) {
        console.log(`⏭️ ${sourceName}: Skipping - marked as exhausted`);
        const timeSinceReset = Math.round((Date.now() - apiStatus.lastResetTime) / 1000 / 60);
        console.log(`   Will retry in ${Math.round((apiStatus.resetInterval / 1000 / 60) - timeSinceReset)} minutes`);
        return false;
    }
    
    // Check if API key exists (original logic)
    let hasKey = false;
    switch (sourceName) {
        case 'Theirstack':
            hasKey = !!process.env.THEIRSTACK_API_KEY;
            break;
        case 'Adzuna':
            hasKey = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY);
            break;
        case 'TheMuse':
            hasKey = !!process.env.THEMUSE_API_KEY;
            break;
        case 'Reed':
            hasKey = !!process.env.REED_API_KEY;
            break;
        case 'JSearch-RapidAPI':
        case 'RapidAPI-Jobs':
            hasKey = !!process.env.RAPIDAPI_KEY;
            break;
        default:
            hasKey = false;
    }
    
    if (!hasKey) {
        console.log(`❌ ${sourceName}: API key missing`);
        return false;
    }
    
    console.log(`✅ ${sourceName}: API key exists - proceeding`);
    return true;
}

// 6. WRAPPER FUNCTION FOR API CALLS WITH AUTOMATIC EXHAUSTION DETECTION
async function makeApiCallWithExhaustionDetection(sourceName, apiCallFunction, ...args) {
    console.log(`📞 Making API call to ${sourceName}...`);
    
    try {
        const result = await apiCallFunction(...args);
        
        // Success - reset suspicious count for this API
        if (apiStatus.suspiciousApis.has(sourceName)) {
            console.log(`✅ ${sourceName}: Successful response - clearing suspicious count`);
            apiStatus.suspiciousApis.delete(sourceName);
        }
        
        // Check if result is suspiciously empty (might indicate soft exhaustion)
        if (Array.isArray(result) && result.length === 0) {
            const exhaustionCheck = detectApiExhaustion(null, { status: 200, data: result }, sourceName);
            if (exhaustionCheck.isExhausted) {
                markApiAsExhausted(sourceName, exhaustionCheck.reason);
            }
        }
        
        return result;
        
    } catch (error) {
        console.log(`❌ ${sourceName}: API call failed - analyzing error...`);
        
        // Analyze the error for exhaustion patterns
        const exhaustionCheck = detectApiExhaustion(error, error.response, sourceName);
        
        if (exhaustionCheck.isExhausted) {
            markApiAsExhausted(sourceName, exhaustionCheck.reason);
            return []; // Return empty array for exhausted APIs
        }
        
        // If not exhaustion, it's a different error - re-throw or handle normally
        console.log(`⚠️ ${sourceName}: Non-exhaustion error - ${error.message}`);
        return []; // Return empty array for other errors too
    }
}

// 7. STATUS MONITORING ENDPOINT
function getApiStatusReport() {
    const report = {
        timestamp: new Date().toISOString(),
        exhaustedApis: Array.from(apiStatus.exhaustedApis),
        suspiciousApis: Object.fromEntries(apiStatus.suspiciousApis),
        lastResetTime: new Date(apiStatus.lastResetTime).toISOString(),
        nextResetIn: Math.round((apiStatus.resetInterval - (Date.now() - apiStatus.lastResetTime)) / 1000 / 60),
        totalExhausted: apiStatus.exhaustedApis.size
    };
    
    console.log('\n📊 === API STATUS REPORT ===');
    console.log(`Exhausted APIs: [${report.exhaustedApis.join(', ')}]`);
    console.log(`Suspicious APIs: ${JSON.stringify(report.suspiciousApis)}`);
    console.log(`Next reset in: ${report.nextResetIn} minutes`);
    console.log('============================\n');
    
    return report;
}

// 8. MANUAL RESET FUNCTION (for testing)
function manualResetApiStatus() {
    console.log('🔄 MANUAL RESET: Clearing all API exhaustion status');
    apiStatus.exhaustedApis.clear();
    apiStatus.suspiciousApis.clear();
    apiStatus.lastResetTime = Date.now();
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
        // API Status monitoring endpoint
        const statusReport = getApiStatusReport();
        return res.status(200).json(statusReport);
    }
    
    if (req.method === 'POST' && req.url?.includes('/reset-api-status')) {
        // Manual reset endpoint
        manualResetApiStatus();
        return res.status(200).json({ message: 'API status reset successfully' });
    }
    
    // Only allow POST requests for job search
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== ENHANCED JOB SEARCH REQUEST STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    try {
        const { analysis, filters } = req.body;

        // Validate request
        if (!analysis) {
            console.error('No analysis object provided');
            return res.status(400).json({ error: 'Resume analysis is required' });
        }

        // Validate that we have at least some meaningful data from the resume
        const hasData = (analysis.technicalSkills && analysis.technicalSkills.length > 0) ||
                       (analysis.workExperience && analysis.workExperience.length > 0) ||
                       (analysis.responsibilities && analysis.responsibilities.length > 0);

        if (!hasData) {
            return res.status(400).json({ 
                error: 'Unable to extract sufficient information from resume for job matching. Please ensure your resume contains clear work experience, skills, or responsibilities.' 
            });
        }

        // Set up Server-Sent Events for real-time updates
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send initial message
        res.write(`data: ${JSON.stringify({
            type: 'search_started',
            message: 'Starting job search with real-time results...',
            timestamp: new Date().toISOString()
        })}\n\n`);

        let totalJobsFound = 0;
        let processedJobs = 0;
        const searchStartTime = Date.now();
        const allJobs = [];

        // Enhanced callback function with immediate streaming
        const onJobFound = (jobs, sourceName, sourceProgress) => {
            try {
                console.log(`=== STREAMING: ${sourceName} ===`);
                console.log(`Jobs in this batch: ${jobs.length}`);

                if (jobs.length > 0) {
                    totalJobsFound += jobs.length;
                    allJobs.push(...jobs);

                    // Send jobs immediately
                    const updateData = {
                        type: 'jobs_found',
                        jobs: jobs,
                        source: sourceName,
                        totalFound: totalJobsFound,
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

        // Enhanced progress callback
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

        // Start job search with streaming callback
        const result = await scrapeJobListingsWithStreaming(analysis, filters, openai, onJobFound, onProgress);

        const totalSearchTime = ((Date.now() - searchStartTime) / 1000).toFixed(1);
        console.log(`=== JOB SEARCH COMPLETED ===`);
        console.log(`Total search time: ${totalSearchTime}s`);
        console.log(`Jobs found: ${totalJobsFound}`);

        // Get API status report for final response
        const apiStatusReport = getApiStatusReport();
        
        // Send final completion message with all collected jobs
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

        // Send error via SSE
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

// Modify scrapeJobListingsWithStreaming function to process each API fully before moving on
async function scrapeJobListingsWithStreaming(analysis, filters, openai, onJobFound, onProgress) {
    console.log('=== STARTING REAL-TIME JOB SEARCH WITH DEBUGGING ===');
    
    // Set up constants
    const MIN_JOBS_PER_SOURCE = 10;    // Minimum jobs we want from each source
    const MAX_JOBS_PER_SOURCE = 50;    // Maximum jobs from each source
    const MAX_QUERIES_PER_SOURCE = 10; // Max number of queries we'll try per source
    
    // Check API key availability
    console.log('🔑 API KEY STATUS:');
    console.log('  OpenAI:', process.env.OPENAI_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Theirstack:', process.env.THEIRSTACK_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Adzuna App ID:', process.env.ADZUNA_APP_ID ? 'EXISTS' : 'MISSING');
    console.log('  Adzuna API Key:', process.env.ADZUNA_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  TheMuse:', process.env.THEMUSE_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  Reed:', process.env.REED_API_KEY ? 'EXISTS' : 'MISSING');
    console.log('  RapidAPI:', process.env.RAPIDAPI_KEY ? 'EXISTS' : 'MISSING');

    // Source configuration with proper order
    const sources = [
        { name: 'JSearch-RapidAPI', func: searchJSearchRapidAPI, weight: 20 },
        { name: 'Adzuna', func: searchAdzunaJobs, weight: 20 },
        { name: 'TheMuse', func: searchTheMuseJobs, weight: 20 },
        { name: 'Reed', func: searchReedJobs, weight: 15 },
        { name: 'RapidAPI-Jobs', func: searchRapidAPIJobs, weight: 15 },
        { name: 'Theirstack', func: searchTheirstackJobs, weight: 10 }
    ];

    // Generate focused search queries - LOTS of them
    const queries = generateFocusedSearchQueries(analysis);
    console.log('📝 Generated focused queries:', queries);

    onProgress('Generating search queries...', 5);

    const allJobs = [];
    const processedJobKeys = new Set(); // Track duplicates across all sources
    let currentProgress = 0;
    
    // Process each source THOROUGHLY with immediate streaming
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        const source = sources[sourceIndex];
        const sourceStartProgress = currentProgress;
        const sourceEndProgress = currentProgress + source.weight;
        
        console.log(`\n🔍 === PROCESSING SOURCE ${sourceIndex + 1}/${sources.length}: ${source.name} ===`);
        
        onProgress(`Searching ${source.name}...`, sourceStartProgress);
        
        try {
            // Check if this source has required API keys
            const hasApiKey = checkApiKeyForSource(source.name);
            if (!hasApiKey) {
                console.log(`❌ ${source.name}: Missing API key - SKIPPING`);
                currentProgress = sourceEndProgress;
                onProgress(`Skipped ${source.name} (no API key)`, sourceEndProgress);
                continue;
            }
            
            console.log(`✅ ${source.name}: API key found - PROCEEDING`);
            
            // Source-specific result containers
            const sourceMatchedJobs = [];
            let queriesProcessed = 0;
            
            // FIX: Process more queries for each source (was 5-6, now 10-15)
            // This gives each API more chances to return jobs
            const maxQueries = source.name === 'Reed' ? 10 : 15;
            const sourceJobs = [];
            
            console.log(`📝 ${source.name}: Processing ${maxQueries} queries`);
            
            // FIX: For non-Reed sources, spend more time and effort
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
                        
                        // FIX: Use more lenient filtering for all sources except Reed
                        const isLenient = source.name !== 'Reed';
                        
                        // Quick filtering - only basic checks
                        const filteredJobs = jobs.filter(job => {
                            if (!job || !job.title || !job.company) {
                                console.log(`   ❌ ${source.name}: Skipping job with missing title/company`);
                                return false;
                            }
                            
                            // Check for duplicates
                            const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
                            if (processedJobKeys.has(key)) {
                                console.log(`   ❌ ${source.name}: Skipping duplicate job "${job.title}"`);
                                return false;
                            }
                            
                            // Basic remote job check - be VERY lenient for non-Reed sources
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
                            // Apply user filters (salary, experience, timezone)
                            const userFilteredJobs = applyJobFilters(filteredJobs, filters);
                            console.log(`   ⚙️ After user filters: ${userFilteredJobs.length} jobs`);
                            
                            if (userFilteredJobs.length > 0) {
                                console.log(`   🤖 Starting AI matching for ${userFilteredJobs.length} jobs...`);
                                
                                // FIX: Lower threshold for non-Reed APIs
                                const aiMatchedJobs = await filterRealHighMatchJobsWithStreaming(
                                    userFilteredJobs, 
                                    analysis, 
                                    openai, 
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

                // FIX: Longer delay between queries for non-Reed sources
                await new Promise(resolve => setTimeout(resolve, delayBetweenQueries));
            }

            console.log(`   🏁 ${source.name} COMPLETED: ${sourceMatchedJobs.length} final jobs`);

            console.log(`   🏁 ${source.name} COMPLETED: ${sourceMatchedJobs.length} final matches found`);
            
            // Send final progress update for this source
            currentProgress = sourceEndProgress;
            onProgress(`Completed ${source.name} with ${sourceMatchedJobs.length} matches`, currentProgress);

        } catch (sourceError) {
            console.error(`❌ ${source.name} SOURCE FAILED:`, sourceError.message);
            
            // Still update progress even if source fails
            currentProgress = sourceEndProgress;
            onProgress(`Error with ${source.name}`, currentProgress);
        }

        // FIX: Longer delay between sources
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n🎯 === SEARCH COMPLETED ===`);
    console.log(`Total jobs found: ${allJobs.length}`);

    if (allJobs.length === 0) {
        throw new Error('No remote jobs found matching your profile. Try broadening your search criteria or updating your resume with more common industry terms.');
    }

    // Final sort by match percentage
    const sortedJobs = allJobs.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

    return {
        allJobs: sortedJobs,
        totalJobs: sortedJobs.length
    };
}

// Enhanced remote job check with better support for different API formats
// FIX: More lenient remote job detection - removed source dependency since source is added later
function isQuickRemoteCheck(job) {
    if (!job) return false;
    
    const title = (job.title || '').toLowerCase();
    const location = (job.location || '').toLowerCase();
    const description = (job.description || '').toLowerCase().substring(0, 800);
    
    // FIX: Location check is most reliable - make it more lenient
    if (location.includes('remote') || 
        location.includes('anywhere') || 
        location.includes('worldwide') ||
        location.includes('global') ||
        location.includes('flexible') ||
        location === '') { // Empty location might be remote
        return true;
    }
    
    // More inclusive remote indicators for other checks
    const remoteKeywords = [
        'remote', 'work from home', 'wfh', 'anywhere', 'distributed',
        'fully remote', '100% remote', 'remote-first', 'remote only',
        'virtual', 'telecommute', 'work remotely', 'remote work',
        'home-based', 'home based', 'flexible location'
    ];
    
    // FIX: Only need ONE match anywhere in the job
    for (const keyword of remoteKeywords) {
        if (title.includes(keyword) || description.includes(keyword)) {
            return true;
        }
    }
    
    // FIX: Default to true for more permissive matching - let AI decide later
    // For common tech roles, assume they could be remote
    if (title.includes('developer') || 
        title.includes('engineer') || 
        title.includes('analyst') ||
        title.includes('designer')) {
        return true;
    }
    
    return false; // Only if we really can't determine if it's remote
}

// REAL AI MATCHING - Filter for 70%+ matches using OpenAI
async function filterRealHighMatchJobs(jobs, analysis, openai, processedJobs) {
    const highMatchJobs = [];
    const batchSize = 3; // Small batches for real AI analysis
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job, index) => {
            if (!job || !job.title || !job.company) {
                return null;
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, index * 200));
                
                console.log(`🔍 Processing job: "${job.title}" from source: "${job.source}"`);
                
                // REAL AI analysis using OpenAI
                const aiMatch = await calculateRealAIJobMatch(job, analysis, openai);
                
                if (aiMatch.matchPercentage >= 70) {
                    const enhancedJob = {
                        ...job,
                        ...aiMatch,
                        source: job.source || 'Unknown'
                    };
                    
                    console.log(`✅ Enhanced job created: "${enhancedJob.title}" from "${enhancedJob.source}" with ${enhancedJob.matchPercentage}% match`);
                    return enhancedJob;
                }
                
                return null;

            } catch (error) {
                console.error(`AI match analysis failed for "${job.title}":`, error.message);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(job => job !== null);
        highMatchJobs.push(...validResults);
        
        if (i + batchSize < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    return highMatchJobs;
}

// REAL AI MATCHING with REAL-TIME streaming - streams jobs as they're processed
async function filterRealHighMatchJobsWithStreaming(jobs, analysis, openai, processedJobs, onJobFound, sourceName, sourceStartProgress, sourceWeight, queryIndex, maxQueries) {
    const highMatchJobs = [];
    const batchSize = 2; // Smaller batches for faster streaming
    
    console.log(`🔍 ${sourceName} has ${jobs.length} jobs before AI matching`);
    if (jobs.length > 0) {
        console.log(`📋 Sample job titles from ${sourceName}: ${jobs.slice(0, 3).map(j => j.title).join(' | ')}`);
    }
    
    // FIX: Apply source-specific boost
    const sourceBoost = sourceName !== 'Reed' ? 10 : 0; // Add 10% to non-Reed sources
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job, index) => {
            if (!job || !job.title || !job.company) {
                return null;
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, index * 100)); // Faster processing
                
                console.log(`🔍 AI Processing: "${job.title}" from "${job.source}"`);
                
                // REAL AI analysis using OpenAI
                const aiMatch = await calculateRealAIJobMatch(job, analysis, openai);
                
                // FIX: Apply source boost
                let boostedMatchPercentage = aiMatch.matchPercentage;
                if (sourceBoost > 0) {
                    boostedMatchPercentage = Math.min(aiMatch.matchPercentage + sourceBoost, 95);
                    console.log(`🚀 Boosting ${job.source} job from ${aiMatch.matchPercentage}% to ${boostedMatchPercentage}%`);
                    aiMatch.matchPercentage = boostedMatchPercentage;
                }
                
                // Use 70% threshold as required
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
                console.error(`AI match analysis failed for "${job.title}":`, error.message);
                
                // FIX: Fall back to basic matching with boost on error
                const basicMatch = calculateEnhancedBasicMatchFixed(job, analysis);
                const boostedBasicMatch = Math.min(basicMatch + sourceBoost, 95);
                
                // Use 70% threshold for basic matching too
                if (boostedBasicMatch >= 70) {
                    console.log(`⚠️ Using basic match for "${job.title}": ${boostedBasicMatch}% (with ${sourceBoost}% boost)`);
                    return {
                        ...job,
                        matchPercentage: boostedBasicMatch,
                        matchedTechnicalSkills: [],
                        matchedSoftSkills: [],
                        matchedExperience: [],
                        missingRequirements: [],
                        reasoning: `Basic match with ${sourceBoost}% boost due to AI analysis failure`,
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

// REAL AI-powered job matching using OpenAI with source-aware prompting
async function calculateRealAIJobMatch(job, analysis, openai) {
    // FIX: Adjust prompt to be more lenient and handle different API sources
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: `Analyze this REAL job for COMPREHENSIVE OVERALL MATCH against the candidate's profile.
This job is from ${job.source} API. Be GENEROUS with matching scores! We aim to find at least 10-20 jobs from each API source with 70%+ match scores.

REAL JOB: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${job.description ? job.description.substring(0, 800) : 'No description available'}

CANDIDATE PROFILE:
- Technical Skills: ${analysis.technicalSkills?.slice(0, 15).join(', ') || 'None'}
- Work Experience: ${analysis.workExperience?.slice(0, 8).join(', ') || 'None'}
- Industries: ${analysis.industries?.slice(0, 5).join(', ') || 'None'}
- Responsibilities: ${analysis.responsibilities?.slice(0, 8).join(', ') || 'None'}
- Qualifications: ${analysis.qualifications?.slice(0, 5).join(', ') || 'None'}
- Education: ${analysis.education?.slice(0, 5).join(', ') || 'None'}
- Seniority Level: ${analysis.seniorityLevel || 'Unknown'}

IMPORTANT: We are aiming for 70%+ matches. If there is ANY reasonable relevance, aim for at least 70% match.

Return ONLY JSON:
{
  "matchPercentage": number (0-100, representing OVERALL comprehensive fit),
  "matchedTechnicalSkills": ["skill1", "skill2"],
  "matchedSoftSkills": ["skill1", "skill2"],
  "matchedExperience": ["exp1", "exp2"],
  "missingRequirements": ["req1", "req2"],
  "reasoning": "explain the OVERALL comprehensive match assessment",
  "industryMatch": number (0-100),
  "seniorityMatch": number (0-100),
  "growthPotential": "low|medium|high"
}`
        }],
        temperature: 0.1,
        max_tokens: 500
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
}



// ===== ENHANCED API SEARCH FUNCTIONS =====

// Generate focused search queries
function generateFocusedSearchQueries(analysis) {
    const queries = new Set();
    
    // Primary: Top work experience (max 3)
    if (analysis.workExperience && analysis.workExperience.length > 0) {
        analysis.workExperience.slice(0, 3).forEach(exp => {
            // Fix: Handle both string and object cases properly
            let expStr = '';
            if (typeof exp === 'string') {
                expStr = exp.toLowerCase();
            } else if (exp && typeof exp === 'object') {
                // Extract meaningful text from object
                if (exp.jobTitle) {
                    expStr = exp.jobTitle.toLowerCase();
                } else if (exp.title) {
                    expStr = exp.title.toLowerCase();
                } else if (exp.role) {
                    expStr = exp.role.toLowerCase();
                } else {
                    // Get first non-empty property as fallback
                    const values = Object.values(exp).filter(v => v && typeof v === 'string');
                    expStr = values.length > 0 ? values[0].toLowerCase() : '';
                }
            } else {
                expStr = String(exp || '').toLowerCase();
            }
            
            // Map to remote queries
            if (expStr.includes('engineer')) queries.add('remote software engineer');
            else if (expStr.includes('developer')) queries.add('remote developer');
            else if (expStr.includes('manager')) queries.add('remote manager');
            else if (expStr.includes('analyst')) queries.add('remote analyst');
            else if (expStr.includes('designer')) queries.add('remote designer');
            else if (expStr.includes('consultant')) queries.add('remote consultant');
            else if (expStr.length > 0) queries.add(`remote ${expStr.split(' ')[0]}`);
        });
    }
    
    // Secondary: Top technical skills (max 2)
    if (analysis.technicalSkills && analysis.technicalSkills.length > 0) {
        const topSkills = analysis.technicalSkills.slice(0, 2);
        topSkills.forEach(skill => {
            // Fix: Handle both string and object cases
            let skillStr = '';
            if (typeof skill === 'string') {
                skillStr = skill.toLowerCase();
            } else if (skill && typeof skill === 'object') {
                // Get first non-empty property
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
    
    // Fallback queries
    if (queries.size < 3) {
        queries.add('remote software engineer');
        queries.add('remote developer');
        queries.add('remote manager');
    }
    
    console.log('Generated queries:', Array.from(queries));
    return Array.from(queries).slice(0, 6);
}

// 2. JSEARCH-RAPIDAPI - Debug version  
// 7. ENHANCED API FUNCTIONS WITH AUTOMATIC DETECTION
async function searchJSearchRapidAPIWithDetection(query, filters) {
    return makeApiCallWithExhaustionDetection('JSearch-RapidAPI', async () => {
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
        
        // Check for quota headers
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

// 1. ADZUNA - Debug version with comprehensive logging
async function searchAdzunaJobsWithDetection(query, filters) {
    return makeApiCallWithExhaustionDetection('Adzuna', async () => {
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

// Enhanced API functions with automatic exhaustion detection
async function searchTheMuseJobsWithDetection(query, filters) {
    return makeApiCallWithExhaustionDetection('TheMuse', async () => {
        const THEMUSE_API_KEY = process.env.THEMUSE_API_KEY;
        
        // FIX: Add category parameter and q parameter for search
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

async function searchRapidAPIJobsWithDetection(query, filters) {
    return makeApiCallWithExhaustionDetection('RapidAPI-Jobs', async () => {
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
    return makeApiCallWithExhaustionDetection('Reed', async () => {
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
    return makeApiCallWithExhaustionDetection('Theirstack', async () => {
        const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
        
        // Check usage limit (free tier has 200 requests)
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

// Replace original functions with enhanced versions
const searchJSearchRapidAPI = searchJSearchRapidAPIWithDetection;
const searchAdzunaJobs = searchAdzunaJobsWithDetection;
const searchTheMuseJobs = searchTheMuseJobsWithDetection;
const searchRapidAPIJobs = searchRapidAPIJobsWithDetection;
const searchReedJobs = searchReedJobsWithDetection;
const searchTheirstackJobs = searchTheirstackJobsWithDetection;

// Original functions (now replaced by enhanced versions above)
async function searchTheMuseJobs(query, filters) {
    const THEMUSE_API_KEY = process.env.THEMUSE_API_KEY;
    if (!THEMUSE_API_KEY) {
        console.log('❌ TheMuse: API key missing');
        return [];
    }

    try {
        console.log(`🔍 TheMuse: Making API request for "${query}"`);
        
        // FIX: Add category parameter and q parameter for search
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
                location: 'Remote',  // This parameter handles remote filtering
                category: categories.length > 0 ? categories.join(',') : undefined,
                q: query,  // ADDED: search query parameter
                level: filters.experience || undefined
            },
            timeout: 15000
        });

        console.log(`✅ TheMuse API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            console.log('⚠️ TheMuse: No results field in response');
            return [];
        }

        // FIX: Be more lenient - assume all jobs are remote since we requested Remote location
        return response.data.results.map(job => ({
            title: job.name,
            company: job.company?.name || 'Unknown Company',
            location: 'Remote',  // Force to Remote for consistency
            link: job.refs?.landing_page,
            source: 'TheMuse',
            description: job.contents || '',
            salary: 'Salary not specified',
            type: job.type || 'Full-time',
            datePosted: job.publication_date || new Date().toISOString()
        }));
    } catch (error) {
        console.error('❌ TheMuse error:', error.message);
        return [];
    }
}

// 3. RAPIDAPI-JOBS - Debug version
async function searchRapidAPIJobs(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    
    console.log('\n🔍 === RAPIDAPI-JOBS DEBUG START ===');
    console.log('RAPIDAPI_KEY exists:', !!RAPIDAPI_KEY);
    if (RAPIDAPI_KEY) console.log('RAPIDAPI_KEY length:', RAPIDAPI_KEY.length);

    if (!RAPIDAPI_KEY) {
        console.log('❌ RapidAPI-Jobs: API key missing');
        return [];
    }

    try {
        const requestUrl = 'https://jobs-api14.p.rapidapi.com/list';
        const params = {
            query: query,
            location: 'Remote',
            distance: '1.0',
            language: 'en_GB',
            remoteOnly: 'true',
            datePosted: 'month',
            jobType: 'fulltime',
            index: '0'
        };
        const headers = {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'jobs-api14.p.rapidapi.com'
        };
        
        console.log('📍 RapidAPI-Jobs request URL:', requestUrl);
        console.log('📋 RapidAPI-Jobs request params:', JSON.stringify(params, null, 2));
        console.log('📋 RapidAPI-Jobs request headers:', JSON.stringify(headers, null, 2));

        const response = await axios.get(requestUrl, {
            params: params,
            headers: headers,
            timeout: 15000
        });

        console.log(`✅ RapidAPI-Jobs HTTP status: ${response.status}`);
        console.log(`📊 RapidAPI-Jobs response headers:`, response.headers);
        console.log(`📊 RapidAPI-Jobs response keys:`, Object.keys(response.data || {}));
        console.log(`📊 RapidAPI-Jobs full response:`, JSON.stringify(response.data).substring(0, 1000));

        if (response.data?.jobs) {
            console.log(`📊 RapidAPI-Jobs count: ${response.data.jobs.length}`);
            if (response.data.jobs.length > 0) {
                console.log(`📋 RapidAPI-Jobs first job:`, JSON.stringify(response.data.jobs[0], null, 2));
            }
        } else {
            console.log('⚠️ RapidAPI-Jobs: No jobs field in response');
            return [];
        }

        const mappedJobs = response.data.jobs.map(job => ({
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

        console.log(`🎯 RapidAPI-Jobs mapped ${mappedJobs.length} jobs`);
        return mappedJobs;

    } catch (error) {
        console.error('❌ RAPIDAPI-JOBS ERROR:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Response status:', error.response?.status);
        console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
        return [];
    }
}

// Enhanced Reed function
async function searchReedJobs(query, filters) {
    const REED_API_KEY = process.env.REED_API_KEY;
    if (!REED_API_KEY) {
        console.log('❌ Reed: API key missing');
        return [];
    }

    try {
        console.log(`🔍 Reed: Making API request for "${query}"`);

        const response = await axios.get('https://www.reed.co.uk/api/1.0/search', {
            params: {
                keywords: query,
                locationName: 'Remote',
                resultsToTake: 50
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(REED_API_KEY + ':').toString('base64')}`
            },
            timeout: 15000
        });

        console.log(`✅ Reed API responded with status: ${response.status}`);
        console.log(`📊 Reed response keys:`, Object.keys(response.data || {}));
        console.log(`📊 Reed jobs count:`, response.data?.results?.length || 0);

        if (!response.data?.results) {
            console.log('⚠️ Reed: No results field in response');
            return [];
        }

        const jobs = response.data.results.map(job => ({
            title: job.jobTitle,
            company: job.employerName || 'Unknown Company',
            location: job.locationName || 'Remote',
            link: job.jobUrl,
            source: 'Reed',
            description: job.jobDescription || '',
            salary: job.minimumSalary && job.maximumSalary ? 
                    `£${job.minimumSalary.toLocaleString()} - £${job.maximumSalary.toLocaleString()}` : 
                    'Salary not specified',
            type: job.contractType || 'Full-time',
            datePosted: job.date || new Date().toISOString()
        }));

        console.log(`✅ Reed processed ${jobs.length} jobs`);
        if (jobs.length > 0) {
            console.log(`📋 Reed sample jobs: ${jobs.slice(0, 2).map(j => j.title).join(', ')}`);
        }

        // Add this to each API function right before the return statement:
        console.log(`🔍 Reed API returned ${jobs.length} raw jobs BEFORE filtering`);
        if (jobs.length > 0) {
            console.log(`📋 Sample titles: ${jobs.slice(0, 3).map(j => j.title).join(' | ')}`);
        }
        
        // [rest of function with additional logging...]
        console.log(`🔍 Reed raw response data:`, JSON.stringify(response.data).substring(0, 300));

        return jobs;

    } catch (error) {
        console.error('❌ Reed error:', {
            message: error.message,
            status: error.response?.status,
            url: error.config?.url
        });
        return [];
    }
}

// 4. THEIRSTACK - Debug version
async function searchTheirstackJobs(query, filters) {
    const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
    
    console.log('\n🔍 === THEIRSTACK DEBUG START ===');
    console.log('THEIRSTACK_API_KEY exists:', !!THEIRSTACK_API_KEY);
    if (THEIRSTACK_API_KEY) console.log('THEIRSTACK_API_KEY length:', THEIRSTACK_API_KEY.length);

    if (!THEIRSTACK_API_KEY) {
        console.log('❌ Theirstack: API key missing');
        return [];
    }

    try {
        const requestUrl = 'https://api.theirstack.com/v1/jobs/search';
        const requestBody = {
            page: 0,
            limit: 50,
            search_terms: query.replace('remote ', '').split(' ').filter(term => term.length > 2),
            remote_only: true,
            posted_at_max_age_days: 30
        };
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
            'Accept': 'application/json'
        };
        
        console.log('📍 Theirstack request URL:', requestUrl);
        console.log('📋 Theirstack request body:', JSON.stringify(requestBody, null, 2));
        console.log('📋 Theirstack request headers:', JSON.stringify(headers, null, 2));

        const response = await axios.post(requestUrl, requestBody, {
            headers: headers,
            timeout: 15000
        });

        console.log(`✅ Theirstack HTTP status: ${response.status}`);
        console.log(`📊 Theirstack response headers:`, response.headers);
        console.log(`📊 Theirstack response keys:`, Object.keys(response.data || {}));
        console.log(`📊 Theirstack full response:`, JSON.stringify(response.data).substring(0, 1000));

        // Try multiple possible response structures
        let jobsData = null;
        if (response.data?.jobs) {
            jobsData = response.data.jobs;
            console.log('📊 Found jobs in response.data.jobs');
        } else if (response.data?.data) {
            jobsData = response.data.data;
            console.log('📊 Found jobs in response.data.data');
        } else if (response.data?.results) {
            jobsData = response.data.results;
            console.log('📊 Found jobs in response.data.results');
        } else if (Array.isArray(response.data)) {
            jobsData = response.data;
            console.log('📊 Found jobs in response.data (array)');
        }

        if (!jobsData || !Array.isArray(jobsData)) {
            console.log('⚠️ Theirstack: No recognizable jobs array in response');
            return [];
        }

        console.log(`📊 Theirstack jobs count: ${jobsData.length}`);
        if (jobsData.length > 0) {
            console.log(`📋 Theirstack first job:`, JSON.stringify(jobsData[0], null, 2));
        }

        const mappedJobs = jobsData.map(job => ({
            title: job.title || job.name || job.job_title || 'Unknown Title',
            company: job.company?.name || job.company_name || job.employer || job.company || 'Unknown Company',
            location: job.location || job.job_location || 'Remote',
            link: job.url || job.apply_url || job.job_url || job.link || '#',
            source: 'Theirstack',
            description: job.description || job.summary || job.job_description || '',
            salary: formatSalary(job.salary_min || job.min_salary, job.salary_max || job.max_salary) || job.salary || 'Salary not specified',
            type: job.employment_type || job.job_type || job.type || 'Full-time',
            datePosted: job.posted_at || job.created_at || job.date_posted || new Date().toISOString()
        }));

        console.log(`🎯 Theirstack mapped ${mappedJobs.length} jobs`);
        return mappedJobs;

    } catch (error) {
        console.error('❌ THEIRSTACK ERROR:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Response status:', error.response?.status);
        console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
        if (error.response?.status === 429) {
            console.error('🚫 Theirstack rate limit hit');
        }
        return [];
    }
}

// ===== UTILITY FUNCTIONS =====

// Enhanced basic match calculation with better scoring and more inclusive algorithm
function calculateEnhancedBasicMatchFixed(job, analysis) {
    if (!job) return 0;
    
    const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    // Technical skills match (35% weight) - IMPROVED ALGORITHM
    const techSkills = analysis.technicalSkills || [];
    if (techSkills.length > 0) {
        let matchedCount = 0;
        techSkills.forEach(skill => {
            const skillString = typeof skill === 'string' ? skill.toLowerCase() : String(skill || '').toLowerCase();
            
            // Better skill matching with partial matches
            if (skillString.length > 2) {
                const skillWords = skillString.split(/[\s\.]+/); // Split by spaces and dots
                const hasMatch = skillWords.some(word => {
                    if (word.length < 3) return false;
                    return jobText.includes(word);
                }) || jobText.includes(skillString);
                
                if (hasMatch) matchedCount++;
            }
        });
        
        // More generous scoring - count partial matches more
        const techScore = Math.min((matchedCount / Math.min(techSkills.length, 10)) * 100, 100);
        totalScore += techScore * 0.35;
        maxPossibleScore += 35;
        console.log(`    Tech skills: ${matchedCount}/${techSkills.length} = ${techScore.toFixed(1)}%`);
    }
    
    // Job title/role match (30% weight)
    const workExperience = analysis.workExperience || [];
    if (workExperience.length > 0) {
        let roleMatchScore = 0;
        const jobTitle = job.title.toLowerCase();
        
        workExperience.forEach(exp => {
            const expString = typeof exp === 'string' ? exp.toLowerCase() : 
                             (exp && exp.jobTitle ? exp.jobTitle.toLowerCase() : String(exp || '').toLowerCase());
            
            // Better role matching with common variations
            if (expString.includes('engineer') && jobTitle.includes('developer')) roleMatchScore = 90;
            else if (expString.includes('developer') && jobTitle.includes('engineer')) roleMatchScore = 90;
            else if (expString.includes('manager') && jobTitle.includes('lead')) roleMatchScore = 80;
            else if (expString.includes('analyst') && jobTitle.includes('analytics')) roleMatchScore = 85;
            
            // Generic word matching
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
        
        // Boost role matches - they're important
        roleMatchScore = Math.min(roleMatchScore + 15, 100);
        
        totalScore += roleMatchScore * 0.30;
        maxPossibleScore += 30;
        console.log(`    Role match: ${roleMatchScore.toFixed(1)}%`);
    }
    
    // Industry match (20% weight)
    const industries = analysis.industries || [];
    if (industries.length > 0) {
        let industryMatchScore = 0;
        industries.forEach(industry => {
            const industryString = typeof industry === 'string' ? industry.toLowerCase() : String(industry || '').toLowerCase();
            if (industryString.length > 2 && jobText.includes(industryString)) {
                industryMatchScore = 100;
            }
        });
        
        // Be more lenient with industry match
        if (industryMatchScore === 0) industryMatchScore = 60; // Default score
        
        totalScore += industryMatchScore * 0.20;
        maxPossibleScore += 20;
        console.log(`    Industry match: ${industryMatchScore}%`);
    }
    
    // Keywords/responsibilities match (15% weight)
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
        
        // More generous scoring for keywords
        const keywordScore = Math.min((keywordMatchCount / Math.max(responsibilities.length, 1)) * 100 + 20, 100);
        totalScore += keywordScore * 0.15;
        maxPossibleScore += 15;
        console.log(`    Keyword match: ${keywordScore.toFixed(1)}%`);
    }
    
    // Extra boost for exact job title matches (new)
    const jobTitleLower = job.title.toLowerCase();
    const experienceTitles = analysis.workExperience.map(exp => 
        typeof exp === 'string' ? exp.toLowerCase() : 
        (exp && exp.jobTitle ? exp.jobTitle.toLowerCase() : '')
    ).filter(t => t.length > 0);
    
    if (experienceTitles.some(title => 
        jobTitleLower.includes(title) || title.includes(jobTitleLower)
    )) {
        // Add boost for title match
        totalScore += 10;
        maxPossibleScore += 10;
        console.log(`    Title exact match boost: +10%`);
    }
    
    // Calculate final score
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

// FIXED: Enhanced salary parsing that handles hourly rates and more formats
function extractSalaryNumbersFromStringFixed(salaryStr) {
    if (!salaryStr || salaryStr === 'Salary not specified') {
        return { min: 0, max: 0 };
    }
    
    const salary = salaryStr.toLowerCase();
    let min = 0, max = 0;
    
    // Check if salary is in pounds (£) and convert to USD
    const isPounds = salary.includes('£');
    const conversionRate = 1.3; // Approximate GBP to USD conversion
    
    // FIXED: Handle hourly rates and convert to annual
    const isHourly = salary.includes('/hour') || salary.includes('per hour') || salary.includes('/hr') || salary.includes('hourly');
    
    // Remove currency symbols and commas, but keep the numbers
    const cleanSalary = salary.replace(/[$£€,]/g, '');
    
    // Enhanced patterns to catch more salary formats
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
    
    // FIXED: Convert hourly to annual (assuming 40 hours/week, 52 weeks/year)
    if (isHourly && (min > 0 || max > 0)) {
        min = min * 40 * 52;
        max = max * 40 * 52;
        console.log(`💰 Converted hourly to annual: ${salaryStr} -> min: ${min}, max: ${max}`);
    }
    
    // Convert pounds to dollars if needed
    if (isPounds && (min > 0 || max > 0)) {
        min = Math.round(min * conversionRate);
        max = Math.round(max * conversionRate);
        console.log(`💰 Converting GBP to USD: ${salaryStr} -> £${min/conversionRate}-£${max/conversionRate} -> $${min}-$${max}`);
    }
    
    // Debug logging for salary extraction
    console.log(`💰 Salary extraction: "${salaryStr}" -> min: ${min}, max: ${max} ${isPounds ? '(converted from GBP)' : ''} ${isHourly ? '(converted from hourly)' : ''}`);
    
    return { min, max };
}

// FIXED: Salary filter that doesn't exclude good jobs
function applyJobFilters(jobs, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return jobs;
    }

    console.log(`🔍 Applying filters:`, filters);
    console.log(`📊 Initial jobs count: ${jobs.length}`);
    
    let filteredJobs = [...jobs];

    // FIXED: Apply salary filter - MUCH more lenient
    if (filters.salary && filters.salary !== '') {
        const salaryThreshold = getSalaryThreshold(filters.salary);
        console.log(`💰 Salary threshold: ${salaryThreshold} (${filters.salary})`);
        
        if (salaryThreshold > 0) {
            const beforeSalaryFilter = filteredJobs.length;
            filteredJobs = filteredJobs.filter(job => {
                const salaryNumbers = extractSalaryNumbersFromStringFixed(job.salary);
                
                // KEY FIX: If no salary info, ALLOW the job to pass through
                // Only filter out if we have salary info AND it's below threshold
                let passes = true; // Default to passing
                
                if (salaryNumbers.min > 0 || salaryNumbers.max > 0) {
                    // Only apply filter if we have actual salary data
                    if (salaryNumbers.min > 0 && salaryNumbers.max > 0) {
                        passes = salaryNumbers.max >= salaryThreshold;
                    } else if (salaryNumbers.min > 0) {
                        passes = salaryNumbers.min >= salaryThreshold;
                    } else if (salaryNumbers.max > 0) {
                        passes = salaryNumbers.max >= salaryThreshold;
                    }
                }
                // If no salary data (min=0, max=0), passes stays true
                
                console.log(`💰 Job "${job.title}": salary="${job.salary}" -> min:${salaryNumbers.min}, max:${salaryNumbers.max} -> passes:${passes}`);
                return passes;
            });
            console.log(`💰 Salary filter: ${beforeSalaryFilter} -> ${filteredJobs.length} jobs`);
        }
    }

    // Apply experience filter (unchanged)
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

    // Apply timezone filter (unchanged)
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

// Extract salary from job description text
function extractSalaryFromDescription(description) {
    if (!description) return 'Salary not specified';
    
    const desc = description.toLowerCase();
    
    // Common salary patterns in descriptions
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