// /api/search-jobs.js - Complete file with streaming support
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

    console.log('=== JOB SEARCH REQUEST STARTED ===');
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

        // Send initial status
        res.write(`data: ${JSON.stringify({
            type: 'search_started',
            message: 'Starting job search with enhanced matching...',
            timestamp: new Date().toISOString()
        })}\n\n`);

        let totalJobsFound = 0;
        const searchStartTime = Date.now();

        // Enhanced callback function with detailed logging
        const onJobFound = (jobs, sourceName) => {
            try {
                console.log(`=== JOB BATCH RECEIVED ===`);
                console.log(`Source: ${sourceName}`);
                console.log(`Jobs in this batch: ${jobs.length}`);

                if (jobs.length > 0) {
                    totalJobsFound += jobs.length;
                    console.log(`Total jobs found so far: ${totalJobsFound}`);

                    // Send real-time update with job batch
                    const updateData = {
                        type: 'jobs_found',
                        jobs: jobs,
                        source: sourceName,
                        totalFound: totalJobsFound,
                        timestamp: new Date().toISOString()
                    };

                    res.write(`data: ${JSON.stringify(updateData)}\n\n`);
                    console.log(`✅ SSE update sent for ${sourceName} with ${jobs.length} jobs`);
                }

            } catch (sseError) {
                console.error('Error in onJobFound callback:', sseError);
            }
        };

        console.log('🚀 Starting enhanced job search with streaming...');

        // Start job search with streaming callback
        const result = await scrapeJobListings(analysis, filters, openai, onJobFound);

        const totalSearchTime = ((Date.now() - searchStartTime) / 1000).toFixed(1);
        console.log(`=== JOB SEARCH COMPLETED ===`);
        console.log(`Total search time: ${totalSearchTime}s`);
        console.log(`Jobs found: ${result.totalJobs || 0}`);

        // Send final completion message
        const finalData = {
            type: 'search_complete',
            initialJobs: result.initialJobs || [],
            remainingJobs: result.remainingJobs || [],
            totalJobs: result.totalJobs || 0,
            totalFound: totalJobsFound,
            searchTimeSeconds: parseFloat(totalSearchTime),
            message: `Found ${result.totalJobs || 0} remote jobs matching your profile`,
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

// ===== JOB SEARCH FUNCTIONS =====

async function scrapeJobListings(analysis, filters, openai, onJobFound) {
    console.log('=== STARTING RESUME-DRIVEN JOB SEARCH WITH STREAMING ===');
    
    const finalResults = [];
    const processedJobs = new Set();

    const sources = [
        { name: 'Theirstack', func: searchTheirstackJobs, maxQueries: 2 }, // LIMITED for free tier
        { name: 'Adzuna', func: searchAdzunaJobs, maxQueries: 5 },
        { name: 'TheMuse', func: searchTheMuseJobs, maxQueries: 5 },
        { name: 'Reed', func: searchReedJobs, maxQueries: 5 },
        { name: 'JSearch-RapidAPI', func: searchJSearchRapidAPI, maxQueries: 5 },
        { name: 'RapidAPI-Jobs', func: searchRapidAPIJobs, maxQueries: 5 }
    ];

    // Generate search queries
    const queries = generateEnhancedSearchQueries(analysis);
    console.log('📝 Generated queries:', queries.slice(0, 3));

    // Process each source individually WITH STREAMING
    for (const source of sources) {
        console.log(`\n🔍 === PROCESSING SOURCE: ${source.name} ===`);
        
        const sourceResults = [];
        const maxQueries = source.maxQueries || 5;
        
        // SPECIAL HANDLING for Theirstack (free tier)
        if (source.name === 'Theirstack') {
            console.log(`   ⚠️  Using only ${maxQueries} queries for Theirstack (FREE TIER - 200 limit)`);
        }
        
        // Process limited queries for this source
        for (let i = 0; i < Math.min(queries.length, maxQueries); i++) {
            const query = queries[i];
            console.log(`   Query ${i + 1}/${maxQueries}: "${query}"`);

            try {
                const jobs = await source.func(query, filters);
                
                if (jobs.length > 0) {
                    console.log(`   Raw jobs found: ${jobs.length}`);
                    
                    // Filter for remote jobs
                    const remoteJobs = jobs.filter(job => isRemoteJob(job));
                    console.log(`   Remote jobs: ${remoteJobs.length}`);
                    
                    // Apply additional filters
                    const filteredJobs = applyJobFilters(remoteJobs, filters);
                    console.log(`   After filter application: ${filteredJobs.length}`);
                    
                    if (filteredJobs.length > 0) {
                        sourceResults.push(...filteredJobs);
                    }
                }
            } catch (error) {
                console.error(`   ❌ ${source.name} failed for "${query}":`, error.message);
                
                // Special handling for Theirstack rate limits
                if (source.name === 'Theirstack' && error.message.includes('429')) {
                    console.error(`   🚫 Theirstack rate limit hit - stopping further queries to preserve API usage`);
                    break; // Stop making more requests to Theirstack
                }
                continue;
            }

            // LONGER delay for Theirstack to respect rate limits
            const delay = source.name === 'Theirstack' ? 1000 : 300; // 1 second for Theirstack, 300ms for others
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Process and stream results IMMEDIATELY when found
        if (sourceResults.length > 0) {
            console.log(`   📊 Processing ${sourceResults.length} jobs from ${source.name}`);
            
            // Remove duplicates within this source
            const uniqueSourceJobs = removeDuplicateJobs(sourceResults);
            console.log(`   🔄 After deduplication: ${uniqueSourceJobs.length}`);
            
            // Filter for 70%+ matches and stream immediately
            const highMatchJobs = await filterHighMatchJobs(uniqueSourceJobs, analysis, openai, processedJobs);
            console.log(`   🎯 Jobs with 70%+ match: ${highMatchJobs.length}`);
            
            if (highMatchJobs.length > 0) {
                console.log(`   ✅ Streaming ${highMatchJobs.length} jobs from ${source.name}`);
                
                // STREAM IMMEDIATELY
                if (onJobFound) {
                    onJobFound(highMatchJobs, source.name);
                }
                
                // Add to final results
                finalResults.push(...highMatchJobs);
                
                // Track to avoid duplicates
                highMatchJobs.forEach(job => {
                    const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
                    processedJobs.add(key);
                });
            }
        }

        // Rate limiting between sources (longer for Theirstack)
        const sourceDelay = source.name === 'Theirstack' ? 2000 : 800; // 2 seconds after Theirstack
        await new Promise(resolve => setTimeout(resolve, sourceDelay));
    }

    if (finalResults.length === 0) {
        throw new Error('No jobs found with 70% or higher match. Try updating your resume with more common job titles and skills.');
    }

    // Final sort by match percentage
    const sortedJobs = finalResults.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

    console.log(`\n🎯 === SEARCH COMPLETED ===`);
    console.log(`Total: ${sortedJobs.length} quality matches from all sources`);
    console.log(`Theirstack API usage: Conservative (FREE TIER protected - ${theirstackUsageCount}/200 used)`);

    return {
        initialJobs: sortedJobs.slice(0, 12),
        remainingJobs: sortedJobs.slice(12),
        totalJobs: sortedJobs.length
    };
}

// Filter for 70%+ matches
async function filterHighMatchJobs(jobs, analysis, openai, processedJobs) {
    const highMatchJobs = [];
    const batchSize = 4; // Smaller batches for faster streaming
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job, index) => {
            if (!job || !job.title || !job.company) {
                return null;
            }
            
            const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
            if (processedJobs.has(key)) {
                return null;
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, index * 100));
                
                // Calculate basic match first
                const basicMatch = calculateEnhancedBasicMatch(job, analysis);
                
                if (basicMatch >= 70) {
                    try {
                        const enhancedMatch = await calculateSingleEnhancedJobMatch(job, analysis, openai);
                        const finalJob = { ...job, ...enhancedMatch };
                        
                        if (finalJob.matchPercentage >= 70) {
                            return finalJob;
                        }
                    } catch (aiError) {
                        console.warn(`AI match failed for "${job.title}", using basic match: ${basicMatch}%`);
                        return {
                            ...job,
                            matchPercentage: basicMatch,
                            matchedTechnicalSkills: [],
                            matchedSoftSkills: [],
                            matchedExperience: [],
                            missingRequirements: [],
                            reasoning: `Basic algorithm match: ${basicMatch}% (AI analysis unavailable)`,
                            industryMatch: Math.min(basicMatch + 5, 95),
                            seniorityMatch: Math.min(basicMatch, 90),
                            growthPotential: basicMatch >= 85 ? 'high' : basicMatch >= 75 ? 'medium' : 'low'
                        };
                    }
                }
                
                return null;

            } catch (error) {
                console.error(`Match calculation failed for "${job.title}":`, error.message);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(job => job !== null);
        highMatchJobs.push(...validResults);
        
        if (i + batchSize < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    return highMatchJobs;
}

// Enhanced basic matching with better scoring
function calculateEnhancedBasicMatch(job, analysis) {
    if (!job) return 0;
    
    const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    // Technical skills match (35% weight)
    const techSkills = analysis.technicalSkills || [];
    if (techSkills.length > 0) {
        let matchedCount = 0;
        techSkills.forEach(skill => {
            const skillString = typeof skill === 'string' ? skill.toLowerCase() : String(skill || '').toLowerCase();
            
            if (skillString.length > 2) {
                if (jobText.includes(skillString) || 
                    jobText.includes(skillString.replace(/[^a-z0-9]/g, '')) ||
                    (skillString.includes('.') && jobText.includes(skillString.replace('.', '')))) {
                    matchedCount++;
                }
            }
        });
        
        const techScore = Math.min((matchedCount / Math.max(techSkills.length, 1)) * 100, 100);
        totalScore += techScore * 0.35;
        maxPossibleScore += 35;
    }
    
    // Job title/role match (30% weight)
    const workExperience = analysis.workExperience || [];
    if (workExperience.length > 0) {
        let roleMatchScore = 0;
        const jobTitle = job.title.toLowerCase();
        
        workExperience.forEach(exp => {
            const expString = typeof exp === 'string' ? exp.toLowerCase() : 
                             (exp && exp.jobTitle ? exp.jobTitle.toLowerCase() : String(exp || '').toLowerCase());
            
            const expWords = expString.split(' ').filter(word => word.length > 2);
            const titleWords = jobTitle.split(' ').filter(word => word.length > 2);
            
            const matchingWords = expWords.filter(word => 
                titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
            );
            
            if (matchingWords.length > 0) {
                roleMatchScore = Math.max(roleMatchScore, (matchingWords.length / Math.max(expWords.length, 1)) * 100);
            }
        });
        
        totalScore += roleMatchScore * 0.30;
        maxPossibleScore += 30;
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
        
        totalScore += industryMatchScore * 0.20;
        maxPossibleScore += 20;
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
        
        const keywordScore = Math.min((keywordMatchCount / Math.max(responsibilities.length * 2, 1)) * 100, 100);
        totalScore += keywordScore * 0.15;
        maxPossibleScore += 15;
    }
    
    const finalScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    return Math.min(finalScore, 95);
}

// AI-powered enhanced job matching
async function calculateSingleEnhancedJobMatch(job, analysis, openai) {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: `Analyze this job match comprehensively.

Job: ${job.title} at ${job.company}
Description: ${job.description.substring(0, 800)}

Candidate Profile:
- Technical Skills: ${analysis.technicalSkills?.slice(0, 15).join(', ') || 'None'}
- Work Experience: ${analysis.workExperience?.slice(0, 8).join(', ') || 'None'}
- Industries: ${analysis.industries?.slice(0, 5).join(', ') || 'None'}
- Responsibilities: ${analysis.responsibilities?.slice(0, 8).join(', ') || 'None'}
- Seniority Level: ${analysis.seniorityLevel || 'Unknown'}

Return ONLY JSON:
{
  "matchPercentage": number (0-100),
  "matchedTechnicalSkills": ["skill1", "skill2"],
  "matchedSoftSkills": ["skill1", "skill2"],
  "matchedExperience": ["exp1", "exp2"],
  "missingRequirements": ["req1", "req2"],
  "reasoning": "brief explanation",
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
            reasoning: parsed.reasoning || 'No reasoning provided',
            industryMatch: parsed.industryMatch || 0,
            seniorityMatch: parsed.seniorityMatch || 0,
            growthPotential: parsed.growthPotential || 'medium'
        };
    } else {
        throw new Error('No valid JSON found in AI response');
    }
}

// Generate search queries based on resume analysis
function generateEnhancedSearchQueries(analysis) {
    const queries = [];

    // Work Experience-based queries
    if (analysis.workExperience && analysis.workExperience.length > 0) {
        analysis.workExperience.slice(0, 8).forEach(exp => {
            let expString = '';
            if (typeof exp === 'string') {
                expString = exp;
            } else if (exp && typeof exp === 'object') {
                if (exp.jobTitle) {
                    expString = exp.jobTitle;
                } else if (exp.title) {
                    expString = exp.title;
                } else if (exp.role) {
                    expString = exp.role;
                } else {
                    expString = JSON.stringify(exp);
                }
            } else {
                expString = String(exp || '');
            }
            
            const expLower = expString.toLowerCase();
            
            // Map common variations
            const roleMap = {
                'software engineer': ['remote software engineer', 'remote developer', 'remote backend engineer'],
                'software developer': ['remote software developer', 'remote developer', 'remote engineer'],
                'data scientist': ['remote data scientist', 'remote data analyst', 'remote analytics'],
                'product manager': ['remote product manager', 'remote pm', 'remote product'],
                'marketing manager': ['remote marketing manager', 'remote marketing', 'remote digital marketing'],
                'project manager': ['remote project manager', 'remote pm', 'remote program manager'],
                'business analyst': ['remote business analyst', 'remote analyst', 'remote ba'],
                'ux designer': ['remote ux designer', 'remote designer', 'remote product designer'],
                'sales manager': ['remote sales manager', 'remote sales', 'remote account manager'],
                'customer success': ['remote customer success', 'remote cs', 'remote account management'],
                'devops engineer': ['remote devops', 'remote infrastructure', 'remote cloud engineer'],
                'frontend developer': ['remote frontend', 'remote ui developer', 'remote react developer'],
                'backend developer': ['remote backend', 'remote api developer', 'remote server developer'],
                'full stack': ['remote fullstack', 'remote full-stack', 'remote web developer']
            };

            Object.keys(roleMap).forEach(role => {
                if (expLower.includes(role)) {
                    queries.push(...roleMap[role]);
                }
            });

            // Generic role-based queries
            if (expLower.includes('manager')) queries.push('remote manager');
            if (expLower.includes('engineer')) queries.push('remote engineer');
            if (expLower.includes('developer')) queries.push('remote developer');
            if (expLower.includes('analyst')) queries.push('remote analyst');
            if (expLower.includes('designer')) queries.push('remote designer');
        });
    }

    // Technical Skills-based queries
    if (analysis.technicalSkills && analysis.technicalSkills.length > 0) {
        const topSkills = analysis.technicalSkills.slice(0, 5);
        topSkills.forEach(skill => {
            let skillString = '';
            if (typeof skill === 'string') {
                skillString = skill;
            } else if (skill && typeof skill === 'object') {
                skillString = JSON.stringify(skill);
            } else {
                skillString = String(skill || '');
            }
            
            const skillLower = skillString.toLowerCase();
            
            const skillToRole = {
                'javascript': 'remote javascript developer',
                'python': 'remote python developer',
                'react': 'remote react developer',
                'node.js': 'remote nodejs developer',
                'aws': 'remote cloud engineer',
                'sql': 'remote data analyst',
                'tableau': 'remote data analyst',
                'salesforce': 'remote salesforce admin',
                'figma': 'remote ux designer',
                'photoshop': 'remote graphic designer'
            };

            if (skillToRole[skillLower]) {
                queries.push(skillToRole[skillLower]);
            }
        });
    }

    // Fallback queries
    if (queries.length < 3) {
        queries.push('remote software engineer', 'remote developer', 'remote manager');
    }

    // Remove duplicates and limit
    const uniqueQueries = [...new Set(queries)].slice(0, 12);
    return uniqueQueries;
}

// ===== API SEARCH FUNCTIONS =====

// JSearch RapidAPI
async function searchJSearchRapidAPI(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) {
        console.log('❌ RapidAPI credentials missing for JSearch');
        return [];
    }

    try {
        console.log('🔍 JSearch-RapidAPI: Making API request...');
        
        const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
            params: {
                query: query,
                page: '1',
                num_pages: '1',
                date_posted: 'all',
                remote_jobs_only: 'true'
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            },
            timeout: 15000
        });

        console.log(`✅ JSearch-RapidAPI responded with ${response.data?.data?.length || 0} jobs`);

        if (!response.data?.data) {
            return [];
        }

        return response.data.data
            .filter(job => job && job.job_title && job.employer_name)
            .map(job => ({
                title: job.job_title || 'Job Title Not Available',
                company: job.employer_name || 'Unknown Company', 
                location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country || ''}`.trim() : 'Remote',
                link: job.job_apply_link || job.job_url || '#',
                source: 'JSearch-RapidAPI',
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

// Theirstack API - FREE TIER (200 request limit)
let theirstackUsageCount = 0;

function trackTheirstackUsage() {
    theirstackUsageCount++;
    console.log(`📊 Theirstack API Usage: ${theirstackUsageCount}/200 (FREE TIER)`);
    
    if (theirstackUsageCount >= 180) {
        console.warn('⚠️  WARNING: Approaching Theirstack rate limit (180/200 used)');
    } else if (theirstackUsageCount >= 200) {
        console.error('🚫 CRITICAL: Theirstack rate limit reached (200/200)');
    }
    
    return theirstackUsageCount;
}

async function searchTheirstackJobs(query, filters) {
    const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
    if (!THEIRSTACK_API_KEY) {
        console.log('❌ Theirstack credentials missing');
        return [];
    }

    // Check if we're close to rate limit
    if (theirstackUsageCount >= 200) {
        console.log('🚫 Theirstack rate limit reached - skipping request');
        return [];
    }

    try {
        console.log('🔍 Theirstack: Making API request (FREE TIER - conserving usage)...');
        
        // Track usage BEFORE making request
        trackTheirstackUsage();
        
        const response = await axios.get('https://api.theirstack.com/v1/jobs', {
            params: {
                query: query,
                remote: true,
                limit: 20, // REDUCED from 50 to 20 for free tier
                page: 1
            },
            headers: {
                'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`✅ Theirstack API responded with ${response.data?.data?.length || 0} jobs (Usage: ${theirstackUsageCount}/200)`);

        if (!response.data?.data) {
            return [];
        }

        return response.data.data.map(job => {
            // Enhanced salary handling
            let salary = formatSalary(job.salary_min, job.salary_max);
            if (salary === 'Salary not specified') {
                salary = extractSalaryFromDescription(job.description);
            }
            
            return {
                title: job.title,
                company: job.company?.name || 'Unknown Company',
                location: job.location || 'Remote',
                link: job.url,
                source: 'Theirstack',
                description: job.description || '',
                salary: salary,
                type: job.employment_type || 'Full-time',
                datePosted: job.posted_at || new Date().toISOString()
            };
        });
        
    } catch (error) {
        console.error('❌ Theirstack error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            
            if (error.response.status === 429) {
                console.error('🚫 Theirstack rate limit hit - FREE TIER limit reached');
                theirstackUsageCount = 200; // Mark as rate limited
            }
        }
        return [];
    }
}

// Adzuna API
async function searchAdzunaJobs(query, filters) {
    const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
    const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;
    
    if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
        console.log('❌ Adzuna credentials missing');
        return [];
    }

    try {
        console.log('🔍 Adzuna: Making API request...');
        
        const response = await axios.get('https://api.adzuna.com/v1/api/jobs/us/search/1', {
            params: {
                app_id: ADZUNA_APP_ID,
                app_key: ADZUNA_API_KEY,
                what: query,
                where: 'remote',
                results_per_page: 30,
                sort_by: 'relevance'
            },
            timeout: 15000
        });

        console.log(`✅ Adzuna API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            return [];
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
        
    } catch (error) {
        console.error('❌ Adzuna error:', error.message);
        return [];
    }
}

// TheMuse API
async function searchTheMuseJobs(query, filters) {
    const THEMUSE_API_KEY = process.env.THEMUSE_API_KEY;
    
    if (!THEMUSE_API_KEY) {
        console.log('❌ TheMuse credentials missing');
        return [];
    }
    
    try {
        console.log('🔍 TheMuse: Making API request...');
        
        const response = await axios.get('https://www.themuse.com/api/public/jobs', {
            params: {
                api_key: THEMUSE_API_KEY,
                page: 0,
                limit: 30,
                location: 'Remote',
                level: filters.experience || undefined
            },
            timeout: 15000
        });

        console.log(`✅ TheMuse API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            return [];
        }

        // Enhanced relevance filtering
        const relevantJobs = response.data.results.filter(job => {
            const jobText = `${job.name} ${job.contents || ''}`.toLowerCase();
            const queryWords = query.toLowerCase().split(' ').filter(word => word !== 'remote');
            
            if (queryWords.length === 0) return true;
            
            return queryWords.some(word => {
                if (word.length < 3) return false;
                return jobText.includes(word) || 
                       (word === 'developer' && jobText.includes('engineer')) ||
                       (word === 'engineer' && jobText.includes('developer')) ||
                       (word === 'manager' && jobText.includes('lead')) ||
                       (word === 'analyst' && jobText.includes('analytics'));
            });
        });

        return relevantJobs.map(job => ({
            title: job.name,
            company: job.company?.name || 'Unknown Company',
            location: job.locations?.[0]?.name || 'Remote',
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

// Reed API
async function searchReedJobs(query, filters) {
    const REED_API_KEY = process.env.REED_API_KEY;

    if (!REED_API_KEY) {
        console.log('❌ Reed credentials missing');
        return [];
    }

    try {
        console.log('🔍 Reed: Making API request...');

        const response = await axios.get('https://www.reed.co.uk/api/1.0/search', {
            params: {
                keywords: query,
                locationName: 'Remote',
                resultsToTake: 30,
                resultsToSkip: 0
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(REED_API_KEY + ':').toString('base64')}`
            },
            timeout: 15000
        });

        console.log(`✅ Reed API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            return [];
        }

        return response.data.results.map(job => ({
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

    } catch (error) {
        console.error('❌ Reed error:', error.message);
        return [];
    }
}

// RapidAPI Jobs API
async function searchRapidAPIJobs(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

    if (!RAPIDAPI_KEY) {
        console.log('❌ RapidAPI credentials missing for Jobs API');
        return [];
    }

    try {
        console.log('🔍 RapidAPI-Jobs: Making API request...');
        
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

        console.log(`✅ RapidAPI-Jobs responded with ${response.data?.jobs?.length || 0} jobs`);

        if (!response.data?.jobs) {
            return [];
        }

        return response.data.jobs
            .filter(job => isRemoteJob(job))
            .map(job => ({
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

// ===== UTILITY FUNCTIONS =====

// Check if job is remote
function isRemoteJob(job) {
    if (!job) return false;
    
    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase(); 
    const location = (job.location || '').toLowerCase();
    
    const allText = `${title} ${description} ${location}`;
    
    const remoteKeywords = [
        'remote', 'work from home', 'wfh', 'telecommute', 'distributed', 'anywhere',
        'virtual', 'home-based', 'location independent', 'work remotely', 'remote work',
        'fully remote', '100% remote', 'remote position', 'remote job', 'remote role'
    ];
    
    const hasRemote = remoteKeywords.some(keyword => allText.includes(keyword)) || 
                     location.includes('remote') ||
                     location.includes('anywhere') ||
                     location.includes('worldwide') ||
                     location.includes('global');
    
    const nonRemoteKeywords = ['on-site only', 'onsite only', 'office required only', 'relocation required'];
    const hasNonRemote = nonRemoteKeywords.some(keyword => allText.includes(keyword));
    
    const locationSuggestsRemote = location.includes('remote') || 
                                  location.includes('anywhere') || 
                                  location.includes('global') ||
                                  location.includes('worldwide');
    
    return (hasRemote || locationSuggestsRemote) && !hasNonRemote;
}

// Remove duplicate jobs
function removeDuplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
        const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Apply job filters
function applyJobFilters(jobs, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return jobs;
    }

    let filteredJobs = [...jobs];

    // Apply salary filter
    if (filters.salary && filters.salary !== '') {
        const salaryThreshold = getSalaryThreshold(filters.salary);
        if (salaryThreshold > 0) {
            filteredJobs = filteredJobs.filter(job => {
                const salaryNumbers = extractSalaryNumbersFromString(job.salary);
                return salaryNumbers.min >= salaryThreshold || salaryNumbers.max >= salaryThreshold;
            });
        }
    }

    // Apply experience filter
    if (filters.experience && filters.experience !== '') {
        filteredJobs = filteredJobs.filter(job => {
            const title = job.title.toLowerCase();
            const description = (job.description || '').toLowerCase();
            
            if (filters.experience === 'entry') {
                return title.includes('junior') || title.includes('entry') || title.includes('associate') || 
                       description.includes('entry level') || description.includes('junior');
            } else if (filters.experience === 'mid') {
                return !title.includes('senior') && !title.includes('lead') && !title.includes('principal') &&
                       !title.includes('junior') && !title.includes('entry') && !title.includes('director');
            } else if (filters.experience === 'senior') {
                return title.includes('senior') || title.includes('lead') || title.includes('principal') ||
                       description.includes('senior') || description.includes('5+ years');
            } else if (filters.experience === 'lead') {
                return title.includes('lead') || title.includes('manager') || title.includes('principal') || 
                       title.includes('architect') || title.includes('director') || title.includes('head of');
            }
            return true;
        });
    }

    // Apply timezone filter
    if (filters.timezone && filters.timezone !== '') {
        filteredJobs = filteredJobs.filter(job => {
            const description = (job.description || '').toLowerCase();
            const location = (job.location || '').toLowerCase();
            
            if (filters.timezone === 'us-only') {
                return description.includes('us') || description.includes('united states') || 
                       location.includes('us') || description.includes('est') || description.includes('pst');
            } else if (filters.timezone === 'global') {
                return description.includes('global') || description.includes('worldwide') || 
                       description.includes('international') || description.includes('any timezone');
            } else if (filters.timezone === 'europe') {
                return description.includes('europe') || description.includes('eu') || 
                       description.includes('cet') || description.includes('gmt');
            }
            return true;
        });
    }

    return filteredJobs;
}

// Salary utilities
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

function extractSalaryFromDescription(description) {
    if (!description) return 'Salary not specified';
    
    const text = description.toLowerCase();
    
    // Common salary patterns
    const patterns = [
        // $50k - $75k, $50,000 - $75,000
        /\$(\d+)(?:k|,000)\s*[-–to]\s*\$?(\d+)(?:k|,000)/i,
        // $50k+, $50,000+
        /\$(\d+)(?:k|,000)\+/i,
        // From $50k, Starting at $50k
        /(?:from|starting\s+at)\s+\$(\d+)(?:k|,000)/i,
        // Up to $75k
        /up\s+to\s+\$(\d+)(?:k|,000)/i,
        // Salary: $50k
        /salary:?\s*\$(\d+)(?:k|,000)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) {
                // Range found
                let min = parseInt(match[1]);
                let max = parseInt(match[2]);
                
                // Convert k to thousands if needed
                if (text.includes('k') || (min < 1000 && max < 1000)) {
                    min *= 1000;
                    max *= 1000;
                }
                
                return formatSalary(min, max);
            } else {
                // Single value found
                let value = parseInt(match[1]);
                if (text.includes('k') || value < 1000) {
                    value *= 1000;
                }
                
                if (text.includes('from') || text.includes('starting')) {
                    return formatSalary(value, null);
                } else if (text.includes('up to')) {
                    return formatSalary(null, value);
                } else if (text.includes('+')) {
                    return formatSalary(value, null);
                } else {
                    return formatSalary(value, value);
                }
            }
        }
    }
    
    return 'Salary not specified';
}

function extractSalaryNumbersFromString(salaryStr) {
    const salary = salaryStr.toLowerCase();
    let min = 0, max = 0;
    
    const cleanSalary = salary.replace(/[$£€,]/g, '');
    
    const rangeMatch = cleanSalary.match(/(\d+)(?:k|,000)?\s*[-–to]\s*(\d+)(?:k|,000)?/);
    const singleMatch = cleanSalary.match(/(\d+)(?:k|,000)?/);
    const fromMatch = cleanSalary.match(/from\s+(\d+)(?:k|,000)?/);
    const upToMatch = cleanSalary.match(/up\s+to\s+(\d+)(?:k|,000)?/);
    
    if (rangeMatch) {
        min = parseInt(rangeMatch[1]);
        max = parseInt(rangeMatch[2]);
        
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
    
    return { min, max };
}