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
                            // FIXED: Add basic match percentage quickly
                            const jobsWithQuickMatch = filteredJobs.map(job => ({
                                ...job,
                                matchPercentage: calculateQuickMatch(job, analysis),
                                source: source.name
                            }));
                            
                            sourceJobs.push(...jobsWithQuickMatch);
                            allJobs.push(...jobsWithQuickMatch);
                            
                            // FIXED: Stream jobs immediately
                            const sourceProgress = sourceStartProgress + ((i + 1) / maxQueries) * source.weight;
                            onJobFound(jobsWithQuickMatch, source.name, Math.round(sourceProgress));
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

// FIXED: Quick remote job check (faster than before)
function isQuickRemoteCheck(job) {
    if (!job) return false;
    
    const title = (job.title || '').toLowerCase();
    const location = (job.location || '').toLowerCase();
    const description = (job.description || '').toLowerCase().substring(0, 500); // Only check first 500 chars
    
    const allText = `${title} ${location} ${description}`;
    
    // Quick remote indicators
    const remoteKeywords = ['remote', 'work from home', 'wfh', 'anywhere', 'distributed'];
    const hasRemote = remoteKeywords.some(keyword => allText.includes(keyword));
    
    // Quick exclusions
    const nonRemoteKeywords = ['on-site only', 'office required', 'relocation required'];
    const hasNonRemote = nonRemoteKeywords.some(keyword => allText.includes(keyword));
    
    return hasRemote && !hasNonRemote;
}

// FIXED: Quick match calculation (faster than AI analysis)
function calculateQuickMatch(job, analysis) {
    if (!job) return 0;
    
    const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    let score = 0;
    let maxScore = 0;
    
    // Technical skills match (40% weight)
    const techSkills = analysis.technicalSkills || [];
    if (techSkills.length > 0) {
        let matchCount = 0;
        techSkills.slice(0, 10).forEach(skill => { // Only check top 10 skills for speed
            const skillStr = String(skill || '').toLowerCase();
            if (skillStr.length > 2 && jobText.includes(skillStr)) {
                matchCount++;
            }
        });
        score += (matchCount / Math.min(techSkills.length, 10)) * 40;
        maxScore += 40;
    }
    
    // Work experience match (35% weight)
    const workExp = analysis.workExperience || [];
    if (workExp.length > 0) {
        let roleMatch = 0;
        const jobTitle = job.title.toLowerCase();
        
        workExp.slice(0, 5).forEach(exp => { // Only check top 5 for speed
            const expStr = String(exp || '').toLowerCase();
            const expWords = expStr.split(' ').filter(w => w.length > 2);
            
            expWords.forEach(word => {
                if (jobTitle.includes(word)) {
                    roleMatch += 1;
                }
            });
        });
        
        score += Math.min(roleMatch * 5, 35); // Cap at 35
        maxScore += 35;
    }
    
    // Industry/keyword match (25% weight)
    const industries = analysis.industries || [];
    const responsibilities = analysis.responsibilities || [];
    
    [...industries.slice(0, 3), ...responsibilities.slice(0, 5)].forEach(item => {
        const itemStr = String(item || '').toLowerCase();
        if (itemStr.length > 3 && jobText.includes(itemStr)) {
            score += 3;
        }
    });
    maxScore += 25;
    
    const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
    return Math.min(Math.max(finalScore, 45), 95); // Ensure score is between 45-95
}

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