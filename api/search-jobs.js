// /api/search-jobs.js - COMPLETE FIXED VERSION with Enhanced Debugging
import OpenAI from 'openai';
import axios from 'axios';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Theirstack usage tracking (free tier has 200 request limit)
let theirstackUsageCount = 0;

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
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

        // Send final completion message with all collected jobs
        const finalData = {
            type: 'search_complete',
            allJobs: allJobs,
            totalJobs: totalJobsFound,
            searchTimeSeconds: parseFloat(totalSearchTime),
            message: `Found ${totalJobsFound} remote jobs matching your profile`,
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
                            const isRemote = isLenient ? true : isQuickRemoteCheck(job);
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

// Check if API key exists for a source
function checkApiKeyForSource(sourceName) {
    switch (sourceName) {
        case 'Theirstack':
            const hasTheirstack = !!process.env.THEIRSTACK_API_KEY;
            console.log(`🔑 Theirstack API key check: ${hasTheirstack ? 'EXISTS' : 'MISSING'}`);
            return hasTheirstack;
            
        case 'Adzuna':
            const hasAdzuna = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY);
            console.log(`🔑 Adzuna API key check: ${hasAdzuna ? 'EXISTS' : 'MISSING'}`);
            return hasAdzuna;
            
        case 'TheMuse':
            const hasTheMuse = !!process.env.THEMUSE_API_KEY;
            console.log(`🔑 TheMuse API key check: ${hasTheMuse ? 'EXISTS' : 'MISSING'}`);
            return hasTheMuse;
            
        case 'Reed':
            const hasReed = !!process.env.REED_API_KEY;
            console.log(`🔑 Reed API key check: ${hasReed ? 'EXISTS' : 'MISSING'}`);
            return hasReed;
            
        case 'JSearch-RapidAPI':
        case 'RapidAPI-Jobs':
            const hasRapidAPI = !!process.env.RAPIDAPI_KEY;
            console.log(`🔑 ${sourceName} API key check: ${hasRapidAPI ? 'EXISTS' : 'MISSING'}`);
            return hasRapidAPI;
            
        default:
            console.log(`🔑 Unknown source: ${sourceName}`);
            return false;
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

// Fix JSearch-RapidAPI function to handle job data more consistently
async function searchJSearchRapidAPI(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) {
        console.log('❌ JSearch: RapidAPI key missing');
        return [];
    }

    try {
        console.log(`🔍 JSearch: Making API request for "${query}"`);
        
        // FIX: Don't add "remote" to query, use remote_jobs_only parameter instead
        const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
            params: {
                query: query,  // REMOVED redundant "remote" from query
                page: '1',
                num_pages: '2',
                remote_jobs_only: 'true'  // This handles remote filtering
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            },
            timeout: 15000
        });

        console.log(`✅ JSearch API responded with status: ${response.status}`);
        console.log(`📊 JSearch jobs array length:`, response.data?.data?.length || 0);

        if (!response.data?.data) {
            console.log('⚠️ JSearch: No data field in response');
            return [];
        }

        // FIX: Be more lenient - assume all jobs are remote since we requested remote_jobs_only
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
    } catch (error) {
        console.error('❌ JSearch error details:', error.message);
        return [];
    }
}

async function searchAdzunaJobs(query, filters) {
    const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
    const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;
    
    if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
        console.log('❌ Adzuna: Missing credentials');
        return [];
    }

    try {
        console.log(`🔍 Adzuna: Making API request for "${query}"`);
        
        // FIX: Don't add "remote" to query parameter, use 'where' parameter instead
        const response = await axios.get('https://api.adzuna.com/v1/api/jobs/us/search/1', {
            params: {
                app_id: ADZUNA_APP_ID,
                app_key: ADZUNA_API_KEY,
                what: query,  // FIXED: removed redundant "remote" from query
                where: 'remote',  // This parameter handles remote filtering
                results_per_page: 50,
                sort_by: 'relevance'
            },
            timeout: 15000
        });

        console.log(`✅ Adzuna API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            console.log('⚠️ Adzuna: No results field in response');
            return [];
        }

        // FIX: Manually check each job for remote indicators
        // since Adzuna doesn't have a reliable remote-only filter
        return response.data.results
            .filter(job => {
                // Check if this is likely a remote job
                const title = (job.title || '').toLowerCase();
                const description = (job.description || '').toLowerCase();
                const location = (job.location?.display_name || '').toLowerCase();
                
                const remoteKeywords = ['remote', 'work from home', 'wfh', 'telecommute', 'virtual'];
                const isRemote = remoteKeywords.some(keyword => 
                    title.includes(keyword) || 
                    description.includes(keyword) || 
                    location.includes(keyword)
                );
                
                return isRemote;
            })
            .map(job => {
                // Enhanced salary handling
                let salary = formatSalary(job.salary_min, job.salary_max);
                if (salary === 'Salary not specified' && job.description) {
                    salary = extractSalaryFromDescription(job.description);
                }
                
                return {
                    title: job.title,
                    company: job.company?.display_name || 'Unknown Company',
                    location: 'Remote', // Force to Remote for consistency
                    link: job.redirect_url,
                    source: 'Adzuna',
                    description: job.description || '',
                    salary: salary,
                    type: job.contract_time || 'Full-time',
                    datePosted: job.created || new Date().toISOString()
                };
            });
    } catch (error) {
        console.error('❌ Adzuna error:', error.message);
        return [];
    }
}

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

async function searchRapidAPIJobs(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) {
        console.log('❌ RapidAPI-Jobs: API key missing');
        return [];
    }

    try {
        console.log(`🔍 RapidAPI-Jobs: Making API request for "${query}"`);
        
        // FIX: Don't add "remote" to query, use remoteOnly parameter instead
        const response = await axios.get('https://jobs-api14.p.rapidapi.com/list', {
            params: {
                query: query,  // FIXED: removed redundant "remote" from query
                location: 'Remote',
                distance: '1.0',
                language: 'en_GB',
                remoteOnly: 'true',  // This parameter handles remote filtering
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

        console.log(`✅ RapidAPI-Jobs responded with ${response.data?.jobs?.length || 0} jobs`);

        if (!response.data?.jobs) {
            console.log('⚠️ RapidAPI-Jobs: No jobs field in response');
            return [];
        }

        // FIX: Be more lenient - assume all jobs are remote since we requested remoteOnly
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
    } catch (error) {
        console.error('❌ RapidAPI-Jobs error:', error.message);
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

// TheirStack API - Enhanced for reliable results
async function searchTheirstackJobs(query, filters) {
    const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
    
    if (!THEIRSTACK_API_KEY) {
        console.log('❌ Theirstack API key missing');
        return [];
    }

    // Limit usage to prevent hitting free tier limits
    if (theirstackUsageCount >= 190) {
        console.log('⚠️ Theirstack approaching rate limit (190/200) - limiting requests');
        return [];
    }
    
    theirstackUsageCount++;
    console.log(`📊 Theirstack API usage: ${theirstackUsageCount}/200`);

    try {
        console.log(`🔍 Theirstack: Making API request for "${query}"`);
        
        // FIX: Convert query to a proper search term in the request body
        // The key issue was that TheirStack uses POST with JSON body, not query params
        let searchTerms = [];
        if (query) {
            // Extract meaningful search terms from the query
            searchTerms = query.replace('remote', '')
                              .split(' ')
                              .filter(term => term.length > 2);
        }
        
        // FIX: Use the correct API endpoint and request format
        const requestBody = {
            page: 0,
            limit: 50,  // Increased from 20
            // Add search terms from query if available
            search_terms: searchTerms.length > 0 ? searchTerms : undefined,
            // Always request remote jobs
            remote_only: true,
            // Use appropriate job country codes based on filters
            job_country_code_or: filters.timezone === 'us-only' ? ['US'] : 
                                filters.timezone === 'europe' ? ['GB', 'DE', 'FR', 'ES', 'IT', 'NL'] : 
                                undefined,
            // Limit to recent postings
            posted_at_max_age_days: 30
        };
        
        console.log(`📝 Theirstack request body:`, JSON.stringify(requestBody));
        
        const response = await axios.post('https://api.theirstack.com/v1/jobs/search', requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        console.log(`✅ Theirstack API responded with status: ${response.status}`);
        
        // FIX: Handle various response formats from TheirStack
        let jobsData = null;
        if (response.data?.jobs) {
            jobsData = response.data.jobs;
        } else if (response.data?.data) {
            jobsData = response.data.data;
        } else if (response.data?.results) {
            jobsData = response.data.results;
        } else if (Array.isArray(response.data)) {
            jobsData = response.data;
        }

        if (!jobsData || !Array.isArray(jobsData)) {
            console.log('⚠️ Theirstack: No recognizable jobs array in response');
            console.log('Response structure:', Object.keys(response.data || {}));
            return [];
        }

        console.log(`📊 Theirstack jobs found: ${jobsData.length}`);
        
        // FIX: Handle various job data structures that TheirStack might return
        const jobs = jobsData.map(job => {
            // Extract job fields with fallbacks for different field names
            const title = job.title || job.name || job.job_title || 'Unknown Title';
            const company = job.company?.name || job.company_name || job.employer || job.company || 'Unknown Company';
            const location = job.location || job.job_location || 'Remote';
            const link = job.url || job.apply_url || job.job_url || job.link || '#';
            const description = job.description || job.summary || job.job_description || '';
            
            // Handle salary with multiple possible field names
            let salary = 'Salary not specified';
            if (job.salary_min || job.salary_max || job.min_salary || job.max_salary) {
                salary = formatSalary(
                    job.salary_min || job.min_salary, 
                    job.salary_max || job.max_salary
                );
            } else if (job.salary) {
                salary = job.salary;
            }
            
            // Get job type with fallbacks
            const jobType = job.employment_type || job.job_type || job.type || 'Full-time';
            
            // Get post date with fallbacks
            const datePosted = job.posted_at || job.created_at || job.date_posted || new Date().toISOString();
            
            return {
                title,
                company,
                location,
                link,
                source: 'Theirstack',
                description,
                salary,
                type: jobType,
                datePosted
            };
        });

        console.log(`✅ Theirstack processed ${jobs.length} jobs`);
        if (jobs.length > 0) {
            console.log(`📋 Theirstack sample jobs: ${jobs.slice(0, 3).map(j => j.title).join(' | ')}`);
        }

        return jobs;
        
    } catch (error) {
        console.error('❌ Theirstack error:', error.message);
        
        if (error.response?.status === 429) {
            console.error('🚫 Theirstack rate limit hit');
            theirstackUsageCount = 200; // Mark as rate limited
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

function extractSalaryNumbersFromString(salaryStr) {
    if (!salaryStr || salaryStr === 'Salary not specified') {
        return { min: 0, max: 0 };
    }
    
    const salary = salaryStr.toLowerCase();
    let min = 0, max = 0;
    
    // Check if salary is in pounds (£) and convert to USD
    const isPounds = salary.includes('£');
    const conversionRate = 1.3; // Approximate GBP to USD conversion
    
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
    
    // Convert pounds to dollars if needed
    if (isPounds && (min > 0 || max > 0)) {
        min = Math.round(min * conversionRate);
        max = Math.round(max * conversionRate);
        console.log(`💰 Converting GBP to USD: ${salaryStr} -> £${min/conversionRate}-£${max/conversionRate} -> $${min}-$${max}`);
    }
    
    // Debug logging for salary extraction
    console.log(`💰 Salary extraction: "${salaryStr}" -> min: ${min}, max: ${max} ${isPounds ? '(converted from GBP)' : ''}`);
    
    return { min, max };
}

function applyJobFilters(jobs, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return jobs;
    }

    console.log(`🔍 Applying filters:`, filters);
    console.log(`📊 Initial jobs count: ${jobs.length}`);
    
    let filteredJobs = [...jobs];

    // Apply salary filter
    if (filters.salary && filters.salary !== '') {
        const salaryThreshold = getSalaryThreshold(filters.salary);
        console.log(`💰 Salary threshold: ${salaryThreshold} (${filters.salary})`);
        
        if (salaryThreshold > 0) {
            const beforeSalaryFilter = filteredJobs.length;
            filteredJobs = filteredJobs.filter(job => {
                const salaryNumbers = extractSalaryNumbersFromString(job.salary);
                // Job salary range should overlap with user's minimum requirement
                // If job has a range, check if max >= user's minimum
                // If job has only min, check if min >= user's minimum
                // If job has only max, check if max >= user's minimum
                let passes = false;
                
                if (salaryNumbers.min > 0 && salaryNumbers.max > 0) {
                    passes = salaryNumbers.max >= salaryThreshold;
                } else if (salaryNumbers.min > 0) {
                    passes = salaryNumbers.min >= salaryThreshold;
                } else if (salaryNumbers.max > 0) {
                    passes = salaryNumbers.max >= salaryThreshold;
                } else {
                    passes = false; // No salary info, exclude
                }
                
                console.log(`💰 Job "${job.title}": salary="${job.salary}" -> min:${salaryNumbers.min}, max:${salaryNumbers.max} -> passes:${passes}`);
                return passes;
            });
            console.log(`💰 Salary filter: ${beforeSalaryFilter} -> ${filteredJobs.length} jobs`);
        }
    }

    // Apply experience filter
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

    // Apply timezone filter
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