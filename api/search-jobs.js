import OpenAI from "openai";
import { scrapeJobListings } from "../tools.js";

// Initialize OpenAI with enhanced configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout for OpenAI requests
    maxRetries: 2   // Retry failed requests up to 2 times
});

// Vercel serverless function handler
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

        // Validate API configurations - INCLUDING THEIRSTACK
        const missingAPIs = [];
        if (!process.env.OPENAI_API_KEY) missingAPIs.push('OpenAI');
        if (!process.env.THEIRSTACK_API_KEY) missingAPIs.push('Theirstack');
        if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_API_KEY) missingAPIs.push('Adzuna');
        if (!process.env.THEMUSE_API_KEY) missingAPIs.push('TheMuse');
        if (!process.env.REED_API_KEY) missingAPIs.push('Reed');
        if (!process.env.RAPIDAPI_KEY) missingAPIs.push('RapidAPI');

        if (missingAPIs.length === 6) {
            throw new Error('No job search APIs are configured. Please check API credentials.');
        }

        console.log('Analysis validation passed:', {
            technicalSkills: analysis.technicalSkills?.length || 0,
            workExperience: analysis.workExperience?.length || 0,
            industries: analysis.industries?.length || 0,
            responsibilities: analysis.responsibilities?.length || 0,
            seniorityLevel: analysis.seniorityLevel || 'unknown',
            filters: filters,
            availableAPIs: 6 - missingAPIs.length
        });

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
            availableAPIs: 6 - missingAPIs.length
        })}\n\n`);

        let totalJobsFound = 0;
        const searchStartTime = Date.now();

        // Enhanced callback function with detailed logging
        const onJobFound = (jobs, sourceName) => {
            try {
                console.log(`=== JOB BATCH RECEIVED ===`);
                console.log(`Source: ${sourceName}`);
                console.log(`Jobs in this batch: ${jobs.length}`);
                console.log(`Search time elapsed: ${((Date.now() - searchStartTime) / 1000).toFixed(1)}s`);

                if (jobs.length > 0) {
                    totalJobsFound += jobs.length;
                    const firstJob = jobs[0];
                    console.log(`Sample job: "${firstJob.title}" at ${firstJob.company} (${firstJob.source})`);
                    console.log(`Total jobs found so far: ${totalJobsFound}`);

                    // Send real-time update with job batch
                    const updateData = {
                        type: 'jobs_found',
                        jobs: jobs,
                        source: sourceName,
                        totalFound: totalJobsFound,
                        searchTimeElapsed: Math.round((Date.now() - searchStartTime) / 1000)
                    };

                    res.write(`data: ${JSON.stringify(updateData)}\n\n`);
                    console.log(`SSE update sent successfully for ${sourceName}`);
                } else {
                    console.log(`No jobs in batch from ${sourceName}`);
                }

            } catch (sseError) {
                console.error('Error in onJobFound callback:', sseError);
            }
        };

        console.log('Starting enhanced job search with comprehensive matching...');

        // Start job search with enhanced error handling and timeout management
        const searchPromise = scrapeJobListings(analysis, filters, openai, onJobFound);
        
        // Set up search timeout
        const searchTimeout = setTimeout(() => {
            console.log('Job search timeout reached');
            if (!res.headersSent) {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Job search is taking too long. We found some results but stopped to prevent timeout. Please try again with different criteria.'
                })}\n\n`);
                res.end();
            }
        }, 170000); // 170 seconds, slightly less than the global timeout

        try {
            const result = await searchPromise;
            clearTimeout(searchTimeout);

            const searchEndTime = Date.now();
            const totalSearchTime = ((searchEndTime - searchStartTime) / 1000).toFixed(1);

            console.log(`=== JOB SEARCH COMPLETED ===`);
            console.log(`Total search time: ${totalSearchTime}s`);
            console.log(`Jobs found: ${result.totalJobs || 0}`);
            console.log(`Initial jobs for display: ${result.initialJobs?.length || 0}`);
            console.log(`Remaining jobs for pagination: ${result.remainingJobs?.length || 0}`);

            // Validate results
            if (!result || (!result.initialJobs && !result.jobs)) {
                throw new Error('No job results received from search');
            }

            // Ensure we have the expected structure
            const finalData = {
                type: 'search_complete',
                initialJobs: result.initialJobs || result.jobs || [],
                remainingJobs: result.remainingJobs || [],
                totalJobs: result.totalJobs || (result.initialJobs?.length || 0) + (result.remainingJobs?.length || 0),
                totalFound: totalJobsFound,
                searchTimeSeconds: parseFloat(totalSearchTime),
                message: `Found ${result.totalJobs || 0} remote jobs matching your profile`
            };

            console.log('Sending final results:', {
                initialJobs: finalData.initialJobs.length,
                remainingJobs: finalData.remainingJobs.length,
                totalJobs: finalData.totalJobs
            });

            res.write(`data: ${JSON.stringify(finalData)}\n\n`);
            res.end();

            console.log('=== JOB SEARCH REQUEST COMPLETED SUCCESSFULLY ===');

        } catch (searchError) {
            clearTimeout(searchTimeout);
            
            console.error('=== JOB SEARCH ERROR ===');
            console.error('Error type:', searchError.name);
            console.error('Error message:', searchError.message);
            console.error('Stack trace:', searchError.stack);

            let userFriendlyMessage = 'Failed to search for jobs. ';

            // Enhanced error categorization
            if (searchError.message.includes('No remote jobs found')) {
                userFriendlyMessage = 'No remote jobs found matching your profile. This could be due to API rate limits or no current openings matching your skills. Please try again in a few minutes or update your resume with more diverse skills.';
            } else if (searchError.message.includes('API credentials') || searchError.message.includes('unauthorized')) {
                userFriendlyMessage = 'Job search service temporarily unavailable due to API configuration. Please try again later.';
            } else if (searchError.message.includes('timeout') || searchError.message.includes('ECONNABORTED')) {
                userFriendlyMessage = 'Job search timed out. The search was taking too long. Please try again with more specific criteria.';
            } else if (searchError.message.includes('network') || searchError.message.includes('ENOTFOUND') || searchError.message.includes('ECONNREFUSED')) {
                userFriendlyMessage = 'Network connection issue with job search services. Please check your internet connection and try again.';
            } else if (searchError.message.includes('OpenAI') || searchError.message.includes('rate limit')) {
                userFriendlyMessage = 'AI matching service temporarily overloaded. Please wait a moment and try again.';
            } else if (searchError.message.includes('No job results received')) {
                userFriendlyMessage = 'Job search completed but no results were returned. Please try different search criteria or try again later.';
            }

            console.log(`Sending error response: ${userFriendlyMessage}`);

            // Send error via SSE if connection is still open
            if (!res.headersSent) {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: userFriendlyMessage,
                    errorCode: searchError.code || 'SEARCH_ERROR'
                })}\n\n`);
                res.end();
            }
        }

    } catch (generalError) {
        console.error('=== GENERAL REQUEST ERROR ===');
        console.error('Error type:', generalError.name);
        console.error('Error message:', generalError.message);
        console.error('Stack trace:', generalError.stack);

        // Try to send error response if headers not sent
        if (!res.headersSent) {
            if (res.getHeader('Content-Type') === 'text/event-stream') {
                // Send via SSE if already in streaming mode
                try {
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'Unexpected server error occurred. Please try again.',
                        errorCode: 'SERVER_ERROR'
                    })}\n\n`);
                    res.end();
                } catch (sseError) {
                    console.error('Failed to send SSE error:', sseError);
                }
            } else {
                // Send regular JSON error
                res.status(500).json({ 
                    error: 'Server error occurred. Please try again.',
                    errorCode: 'SERVER_ERROR'
                });
            }
        }
    }
} 