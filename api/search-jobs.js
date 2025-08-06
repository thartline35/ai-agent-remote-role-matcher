// /api/search-jobs.js - FIXED VERSION with Real-time Streaming
import OpenAI from 'openai';
import axios from 'axios';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

        // FIXED: Enhanced callback function with immediate streaming
        const onJobFound = (jobs, sourceName, sourceProgress) => {
            try {
                console.log(`=== STREAMING: ${sourceName} ===`);
                console.log(`Jobs in this batch: ${jobs.length}`);

                if (jobs.length > 0) {
                    totalJobsFound += jobs.length;
                    allJobs.push(...jobs);

                    // FIXED: Send jobs immediately without heavy processing
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

        // FIXED: Enhanced progress callback
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

        // FIXED: Start job search with streaming callback
        const result = await scrapeJobListingsWithStreaming(analysis, filters, openai, onJobFound, onProgress);

        const totalSearchTime = ((Date.now() - searchStartTime) / 1000).toFixed(1);
        console.log(`=== JOB SEARCH COMPLETED ===`);
        console.log(`Total search time: ${totalSearchTime}s`);
        console.log(`Jobs found: ${totalJobsFound}`);

        // FIXED: Send final completion message with all collected jobs
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

// FIXED: Enhanced job search with real-time streaming
async function scrapeJobListingsWithStreaming(analysis, filters, openai, onJobFound, onProgress) {
    console.log('=== STARTING REAL-TIME JOB SEARCH ===');
    
    const allJobs = [];
    const processedJobKeys = new Set();
    let currentProgress = 0;

    // FIXED: Optimized source configuration
    const sources = [
        { name: 'Adzuna', func: searchAdzunaJobs, weight: 20 },
        { name: 'JSearch-RapidAPI', func: searchJSearchRapidAPI, weight: 25 },
        { name: 'TheMuse', func: searchTheMuseJobs, weight: 20 },
        { name: 'RapidAPI-Jobs', func: searchRapidAPIJobs, weight: 15 },
        { name: 'Reed', func: searchReedJobs, weight: 10 },
        { name: 'Theirstack', func: searchTheirstackJobs, weight: 10 }
    ];

    // FIXED: Generate focused search queries (fewer, more targeted)
    const queries = generateFocusedSearchQueries(analysis);
    console.log('📝 Generated focused queries:', queries.slice(0, 3));

    onProgress('Generating search queries...', 5);

    // FIXED: Process each source with immediate streaming
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        const source = sources[sourceIndex];
        const sourceStartProgress = currentProgress;
        const sourceEndProgress = currentProgress + source.weight;
        
        console.log(`\n🔍 === PROCESSING SOURCE: ${source.name} (${sourceIndex + 1}/${sources.length}) ===`);
        
        onProgress(`Searching ${source.name}...`, sourceStartProgress);
        
        try {
            // FIXED: Use fewer queries per source (2-3 max) for speed
            const maxQueries = source.name === 'Theirstack' ? 2 : 3;
            const sourceJobs = [];
            
            for (let i = 0; i < Math.min(queries.length, maxQueries); i++) {
                const query = queries[i];
                console.log(`   Query ${i + 1}/${maxQueries}: "${query}"`);

                try {
                    const jobs = await source.func(query, filters);
                    
                    if (jobs.length > 0) {
                        console.log(`   Raw jobs found: ${jobs.length}`);
                        
                        // FIXED: Quick filtering - only basic checks
                        const filteredJobs = jobs.filter(job => {
                            if (!job || !job.title || !job.company) return false;
                            
                            // Check for duplicates
                            const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
                            if (processedJobKeys.has(key)) return false;
                            
                            // Basic remote job check
                            const isRemote = isQuickRemoteCheck(job);
                            if (!isRemote) return false;
                            
                            processedJobKeys.add(key);
                            return true;
                        });
                        
                        console.log(`   After quick filtering: ${filteredJobs.length}`);
                        
                        if (filteredJobs.length > 0) {
                            // REAL AI MATCHING - Only show 70%+ matches
                            const highMatchJobs = await filterRealHighMatchJobs(filteredJobs, analysis, openai);
                            
                            if (highMatchJobs.length > 0) {
                                sourceJobs.push(...highMatchJobs);
                                allJobs.push(...highMatchJobs);
                                
                                // Stream REAL 70%+ matches immediately
                                const sourceProgress = sourceStartProgress + ((i + 1) / maxQueries) * source.weight;
                                onJobFound(highMatchJobs, source.name, Math.round(sourceProgress));
                            }
                        }
                    }
                } catch (queryError) {
                    console.error(`   ❌ ${source.name} failed for "${query}":`, queryError.message);
                    continue;
                }

                // Shorter delay between queries
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            console.log(`   ✅ ${source.name} completed: ${sourceJobs.length} jobs found`);

        } catch (sourceError) {
            console.error(`❌ ${source.name} source failed:`, sourceError.message);
        }

        currentProgress = sourceEndProgress;
        onProgress(`Completed ${source.name}`, currentProgress);

        // Short delay between sources
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n🎯 === SEARCH COMPLETED ===`);
    console.log(`Total jobs found: ${allJobs.length}`);

    if (allJobs.length === 0) {
        throw new Error('No remote jobs found matching your profile. Try broadening your search criteria or updating your resume with more common industry terms.');
    }

    // FIXED: Quick sort by match percentage
    const sortedJobs = allJobs.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

    return {
        allJobs: sortedJobs,
        totalJobs: sortedJobs.length
    };
}

// FIXED: Enhanced remote job check (stricter filtering)
function isQuickRemoteCheck(job) {
    if (!job) return false;
    
    const title = (job.title || '').toLowerCase();
    const location = (job.location || '').toLowerCase();
    const description = (job.description || '').toLowerCase().substring(0, 800);
    
    // Strong remote indicators
    const strongRemoteKeywords = [
        'remote', 'work from home', 'wfh', 'anywhere', 'distributed',
        'fully remote', '100% remote', 'remote-first', 'remote only'
    ];
    
    // Check location first (most reliable)
    const hasRemoteLocation = location.includes('remote') || 
                             location.includes('anywhere') || 
                             location.includes('worldwide') ||
                             location.includes('global') ||
                             location === 'flexible / remote';
    
    // Check title and description
    const hasRemoteInContent = strongRemoteKeywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword)
    );
    
    // Must have clear remote indicators
    if (!hasRemoteLocation && !hasRemoteInContent) {
        return false;
    }
    
    // Exclude jobs with specific city requirements (unless clearly remote)
    const cityExclusions = [
        'seattle', 'boston', 'san francisco', 'new york', 'chicago', 
        'los angeles', 'atlanta', 'denver', 'austin', 'portland',
        'must be located in', 'based in', 'office in', 'headquarters'
    ];
    
    const hasLocationRestriction = cityExclusions.some(city => {
        return location.includes(city) || description.includes(city);
    });
    
    // If there's a location restriction, make sure it's still clearly remote
    if (hasLocationRestriction && !hasRemoteLocation) {
        return false;
    }
    
    // Exclude jobs with strict on-site requirements
    const nonRemoteKeywords = [
        'on-site only', 'onsite only', 'office required', 'relocation required',
        'must relocate', 'local candidates only', 'no remote work',
        'in-person required', 'office based only'
    ];
    
    const hasNonRemote = nonRemoteKeywords.some(keyword => 
        description.includes(keyword) || title.includes(keyword)
    );
    
    if (hasNonRemote) {
        return false;
    }
    
    console.log(`Remote check for "${job.title}": location="${location}" -> ${hasRemoteLocation || hasRemoteInContent}`);
    
    return hasRemoteLocation || hasRemoteInContent;
}

// REAL AI MATCHING - Filter for 70%+ matches using OpenAI
async function filterRealHighMatchJobs(jobs, analysis, openai) {
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
                        source: job.source || 'Unknown' // Explicitly preserve the source
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

// REAL AI-powered COMPREHENSIVE job matching using OpenAI
async function calculateRealAIJobMatch(job, analysis, openai) {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: `Analyze this REAL job for COMPREHENSIVE OVERALL MATCH against the candidate's complete profile.

REAL JOB: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${job.description.substring(0, 1000)}

COMPLETE CANDIDATE PROFILE:
- Technical Skills: ${analysis.technicalSkills?.slice(0, 15).join(', ') || 'None'}
- Work Experience: ${analysis.workExperience?.slice(0, 8).join(', ') || 'None'}
- Industries: ${analysis.industries?.slice(0, 5).join(', ') || 'None'}
- Responsibilities: ${analysis.responsibilities?.slice(0, 8).join(', ') || 'None'}
- Qualifications: ${analysis.qualifications?.slice(0, 5).join(', ') || 'None'}
- Education: ${analysis.education?.slice(0, 5).join(', ') || 'None'}
- Seniority Level: ${analysis.seniorityLevel || 'Unknown'}

CRITICAL: Provide a COMPREHENSIVE OVERALL MATCH assessment considering ALL aspects together:
- How well do their technical skills align with job requirements?
- How well does their work experience match the role?
- Does their seniority level fit the position level?
- Do their past responsibilities prepare them for this role?
- Would they be successful in this specific job at this specific company?
- Is this a realistic career move for them?

The matchPercentage should reflect OVERALL fit for the COMPLETE role, not just individual skill matches.

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

// ===== SIMPLIFIED API SEARCH FUNCTIONS - REAL DATA ONLY =====

// FIXED: Generate focused search queries (fewer, more targeted)
function generateFocusedSearchQueries(analysis) {
    const queries = new Set(); // Use Set to avoid duplicates
    
    // Primary: Top work experience (max 3)
    if (analysis.workExperience && analysis.workExperience.length > 0) {
        analysis.workExperience.slice(0, 3).forEach(exp => {
            const expStr = String(exp || '').toLowerCase();
            
            // Map to remote queries
            if (expStr.includes('engineer')) queries.add('remote software engineer');
            else if (expStr.includes('developer')) queries.add('remote developer');
            else if (expStr.includes('manager')) queries.add('remote manager');
            else if (expStr.includes('analyst')) queries.add('remote analyst');
            else if (expStr.includes('designer')) queries.add('remote designer');
            else if (expStr.includes('consultant')) queries.add('remote consultant');
            else queries.add(`remote ${expStr.split(' ')[0]}`);
        });
    }
    
    // Secondary: Top technical skills (max 2)
    if (analysis.technicalSkills && analysis.technicalSkills.length > 0) {
        const topSkills = analysis.technicalSkills.slice(0, 2);
        topSkills.forEach(skill => {
            const skillStr = String(skill || '').toLowerCase();
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
    
    return Array.from(queries).slice(0, 6); // Max 6 queries total
}

// ===== SIMPLIFIED API SEARCH FUNCTIONS =====

// FIXED: Simplified Adzuna function
async function searchAdzunaJobs(query, filters) {
    const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
    const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;
    
    if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
        console.log('❌ Adzuna credentials missing');
        return [];
    }

    try {
        const response = await axios.get('https://api.adzuna.com/v1/api/jobs/us/search/1', {
            params: {
                app_id: ADZUNA_APP_ID,
                app_key: ADZUNA_API_KEY,
                what: query,
                where: 'remote',
                results_per_page: 25, // Reduced for speed
                sort_by: 'relevance'
            },
            timeout: 8000 // Shorter timeout
        });

        if (!response.data?.results) return [];

        return response.data.results.map(job => ({
            title: job.title,
            company: job.company?.display_name || 'Unknown Company',
            location: job.location?.display_name || 'Remote',
            link: job.redirect_url,
            source: 'Adzuna', // Explicitly set source
            description: job.description || '',
            salary: formatSalary(job.salary_min, job.salary_max),
            type: job.contract_time || 'Full-time',
            datePosted: job.created || new Date().toISOString()
        }));
        
    } catch (error) {
        console.error('❌ Adzuna error:', error.message);
        return [];
    }
}

// FIXED: Simplified JSearch function
async function searchJSearchRapidAPI(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) return [];

    try {
        const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
            params: {
                query: query,
                page: '1',
                num_pages: '1',
                remote_jobs_only: 'true'
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            },
            timeout: 8000
        });

        if (!response.data?.data) return [];

        return response.data.data
            .filter(job => job && job.job_title && job.employer_name)
            .map(job => ({
                title: job.job_title,
                company: job.employer_name,
                location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country}` : 'Remote',
                link: job.job_apply_link || job.job_url || '#',
                source: 'JSearch-RapidAPI', // Explicitly set source
                description: job.job_description || '',
                salary: formatRapidAPISalary(job.job_min_salary, job.job_max_salary),
                type: job.job_employment_type || 'Full-time',
                datePosted: job.job_posted_at_datetime_utc || new Date().toISOString()
            }));

    } catch (error) {
        console.error('❌ JSearch-RapidAPI error:', error.message);
        return [];
    }
}

// FIXED: Simplified TheMuse function
async function searchTheMuseJobs(query, filters) {
    const THEMUSE_API_KEY = process.env.THEMUSE_API_KEY;
    if (!THEMUSE_API_KEY) return [];

    try {
        const response = await axios.get('https://www.themuse.com/api/public/jobs', {
            params: {
                api_key: THEMUSE_API_KEY,
                page: 0,
                limit: 25,
                location: 'Remote'
            },
            timeout: 8000
        });

        if (!response.data?.results) return [];

        return response.data.results.map(job => ({
            title: job.name,
            company: job.company?.name || 'Unknown Company',
            location: job.locations?.[0]?.name || 'Remote',
            link: job.refs?.landing_page,
            source: 'TheMuse', // Explicitly set source
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

// FIXED: Simplified RapidAPI Jobs function
async function searchRapidAPIJobs(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) return [];

    try {
        const response = await axios.get('https://jobs-api14.p.rapidapi.com/list', {
            params: {
                query: query,
                location: 'Remote',
                remoteOnly: 'true',
                jobType: 'fulltime'
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jobs-api14.p.rapidapi.com'
            },
            timeout: 8000
        });

        if (!response.data?.jobs) return [];

        return response.data.jobs.map(job => ({
            title: job.title,
            company: job.company || 'Unknown Company',
            location: job.location || 'Remote',
            link: job.url,
            source: 'RapidAPI-Jobs', // Explicitly set source
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

// FIXED: Simplified Reed function
async function searchReedJobs(query, filters) {
    const REED_API_KEY = process.env.REED_API_KEY;
    if (!REED_API_KEY) return [];

    try {
        const response = await axios.get('https://www.reed.co.uk/api/1.0/search', {
            params: {
                keywords: query,
                locationName: 'Remote',
                resultsToTake: 20
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(REED_API_KEY + ':').toString('base64')}`
            },
            timeout: 8000
        });

        if (!response.data?.results) return [];

        return response.data.results.map(job => ({
            title: job.jobTitle,
            company: job.employerName || 'Unknown Company',
            location: job.locationName || 'Remote',
            link: job.jobUrl,
            source: 'Reed', // Explicitly set source
            description: job.jobDescription || '',
            salary: job.minimumSalary && job.maximumSalary ? 
                    `£${job.minimumSalary.toLocaleString()} - £${job.maximumSalary.toLocaleString()}` : 
                    'Salary not specified',
            type: job.contractType || 'Full-time',
            datePosted: job.date || new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ Reed error:', error.message);
        return [];
    }
}

// FIXED: Conservative Theirstack function
async function searchTheirstackJobs(query, filters) {
    const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
    if (!THEIRSTACK_API_KEY) return [];

    try {
        const response = await axios.get('https://api.theirstack.com/v1/jobs', {
            params: {
                query: query,
                remote: true,
                limit: 15 // Very conservative for free tier
            },
            headers: {
                'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        if (!response.data?.data) return [];

        return response.data.data.map(job => ({
            title: job.title,
            company: job.company?.name || 'Unknown Company',
            location: job.location || 'Remote',
            link: job.url,
            source: 'Theirstack', // Explicitly set source
            description: job.description || '',
            salary: formatSalary(job.salary_min, job.salary_max),
            type: job.employment_type || 'Full-time',
            datePosted: job.posted_at || new Date().toISOString()
        }));
        
    } catch (error) {
        console.error('❌ Theirstack error:', error.message);
        return [];
    }
}

// ===== UTILITY FUNCTIONS =====

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