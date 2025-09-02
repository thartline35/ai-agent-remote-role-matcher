// api/search-jobs-modular.js - Modular job search endpoint

import { jobSearchService } from '../services/job-search-service.js';
import { apiManager } from '../services/api-manager.js';
import { scraperManager } from '../services/scraper-manager.js';
import { cacheManager } from '../services/cache-manager.js';

/**
 * Modular job search endpoint
 * Uses the new modular architecture for better debugging and maintainability
 */
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
        const apiStatus = apiManager.getApiStatusReport();
        const scraperStatus = scraperManager.getStatusReport();
        return res.status(200).json({
            apiStatus,
            scraperStatus,
            timestamp: new Date().toISOString()
        });
    }
    
            if (req.method === 'POST' && req.url?.includes('/reset-api-status')) {
            apiManager.manualResetApiStatus();
            scraperManager.resetScraperStatus();
            return res.status(200).json({ message: 'API and scraper status reset successfully' });
        }

        // Cache management endpoints
        if (req.method === 'GET' && req.url?.includes('/cache-status')) {
            const cacheStats = cacheManager.getStats();
            return res.status(200).json({
                cacheStats,
                timestamp: new Date().toISOString()
            });
        }

        if (req.method === 'POST' && req.url?.includes('/clear-cache')) {
            await cacheManager.clearAll();
            return res.status(200).json({ message: 'Cache cleared successfully' });
        }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== MODULAR JOB SEARCH REQUEST STARTED ===');
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
            message: 'Starting modular job search with real-time results...',
            timestamp: new Date().toISOString()
        })}\n\n`);

        let totalJobsFound = 0;
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

        console.log('🚀 Starting modular job search with REAL-TIME streaming...');

        const result = await jobSearchService.searchJobs(analysis, filters, onJobFound, onProgress);

        const totalSearchTime = ((Date.now() - searchStartTime) / 1000).toFixed(1);
        console.log(`=== MODULAR JOB SEARCH COMPLETED ===`);
        console.log(`Total search time: ${totalSearchTime}s`);
        console.log(`Jobs found: ${totalJobsFound}`);

        // Stream user messages if any
        if (result.userMessages && result.userMessages.length > 0) {
            console.log(`📢 Streaming ${result.userMessages.length} user messages`);
            result.userMessages.forEach(message => {
                const messageData = {
                    type: 'user_message',
                    messageType: message.type,
                    title: message.title,
                    message: message.message,
                    apiName: message.apiName,
                    action: message.action,
                    timestamp: new Date().toISOString()
                };
                res.write(`data: ${JSON.stringify(messageData)}\n\n`);
            });
        }
        
        const finalData = {
            type: 'search_complete',
            allJobs: allJobs,
            totalJobs: totalJobsFound,
            searchTimeSeconds: parseFloat(totalSearchTime),
            message: `Found ${totalJobsFound} remote jobs matching your profile`,
            userMessages: result.userMessages || [],
            apiStatus: result.apiStatus,
            scraperStatus: result.scraperStatus,
            timestamp: new Date().toISOString()
        };

        res.write(`data: ${JSON.stringify(finalData)}\n\n`);
        res.end();

        console.log('=== MODULAR JOB SEARCH REQUEST COMPLETED SUCCESSFULLY ===');

    } catch (error) {
        console.error('=== MODULAR JOB SEARCH ERROR ===');
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
            // Stream user messages if available in error
            if (error.userMessages && error.userMessages.length > 0) {
                console.log(`📢 Streaming ${error.userMessages.length} user messages from error`);
                error.userMessages.forEach(message => {
                    const messageData = {
                        type: 'user_message',
                        messageType: message.type,
                        title: message.title,
                        message: message.message,
                        apiName: message.apiName,
                        action: message.action,
                        timestamp: new Date().toISOString()
                    };
                    res.write(`data: ${JSON.stringify(messageData)}\n\n`);
                });
            }

            const errorData = {
                type: 'error',
                error: userFriendlyMessage,
                userMessages: error.userMessages || [],
                apiStatus: error.apiStatus || null,
                timestamp: new Date().toISOString()
            };

            res.write(`data: ${JSON.stringify(errorData)}\n\n`);
            res.end();
        }
    }
}
