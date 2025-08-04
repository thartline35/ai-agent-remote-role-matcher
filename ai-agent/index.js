// Enhanced index.js with better error handling, timeout management, and API optimization

import OpenAI from "openai";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import PDFParser from 'pdf2json';
import { analyzeResume, scrapeJobListings } from "./tools.js";

dotenv.config({ path: './local.env' });

const app = express();
const port = 3000;

// Middleware with enhanced configuration
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Configure multer for file uploads with enhanced security
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only allow 1 file
    },
    fileFilter: (req, file, cb) => {
        // Enhanced file type validation
        const allowedMimeTypes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload PDF, TXT, DOC, or DOCX files only.'));
        }
    }
});

// Enhanced timeout middleware with different timeouts for different endpoints
app.use((req, res, next) => {
    let timeout;
    
    // Set different timeouts based on endpoint
    if (req.path === '/api/search-jobs') {
        timeout = 180000; // 3 minutes for job search
    } else if (req.path === '/api/analyze-resume') {
        timeout = 60000; // 1 minute for resume analysis
    } else {
        timeout = 30000; // 30 seconds for other requests
    }
    
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            console.log(`Request timeout after ${timeout/1000}s for ${req.path}`);
            res.status(408).json({ 
                error: `Request timeout. Operation took longer than ${timeout/1000} seconds.` 
            });
        }
    }, timeout);

    res.on('finish', () => {
        clearTimeout(timeoutId);
    });

    res.on('close', () => {
        clearTimeout(timeoutId);
    });

    next();
});

// Initialize OpenAI with enhanced configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout for OpenAI requests
    maxRetries: 2   // Retry failed requests up to 2 times
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        apis: {
            openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
            adzuna: (process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY) ? 'configured' : 'missing',
            themuse: process.env.THEMUSE_API_KEY ? 'configured' : 'missing',
            reed: process.env.REED_API_KEY ? 'configured' : 'missing',
            rapidapi: process.env.RAPIDAPI_KEY ? 'configured' : 'missing'
        }
    };
    res.json(healthStatus);
});

// Enhanced PDF parsing endpoint with better error handling
app.post('/api/parse-pdf', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'File must be a PDF' });
        }

        console.log(`Parsing PDF file: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // Enhanced PDF parsing with better error handling
        const pdfParser = new PDFParser();
        
        const parsePDF = () => {
            return new Promise((resolve, reject) => {
                let hasResolved = false;
                
                // Set timeout for PDF parsing
                const parseTimeout = setTimeout(() => {
                    if (!hasResolved) {
                        hasResolved = true;
                        reject(new Error('PDF parsing timeout'));
                    }
                }, 45000); // 45 second timeout for PDF parsing
                
                pdfParser.on('pdfParser_dataReady', (pdfData) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    clearTimeout(parseTimeout);
                    
                    try {
                        let fullText = '';
                        let totalTextLength = 0;
                        
                        if (!pdfData.Pages || pdfData.Pages.length === 0) {
                            throw new Error('PDF appears to be empty or corrupted');
                        }
                        
                        // Extract text from all pages with better handling
                        pdfData.Pages.forEach((page, pageIndex) => {
                            if (!page.Texts) return;
                            
                            page.Texts.forEach(text => {
                                try {
                                    if (text.R && text.R[0] && text.R[0].T) {
                                        const decodedText = decodeURIComponent(text.R[0].T);
                                        fullText += decodedText + ' ';
                                        totalTextLength += decodedText.length;
                                    }
                                } catch (decodeError) {
                                    // Skip problematic text but continue processing
                                    console.warn(`Warning: Could not decode text on page ${pageIndex + 1}`);
                                }
                            });
                            fullText += '\n';
                        });
                        
                        if (totalTextLength < 50) {
                            throw new Error('PDF contains very little extractable text. Please ensure your PDF contains readable text (not just images).');
                        }
                        
                        console.log(`PDF parsed successfully: ${pdfData.Pages.length} pages, ${totalTextLength} characters extracted`);
                        resolve(fullText);
                        
                    } catch (extractError) {
                        reject(new Error(`PDF text extraction failed: ${extractError.message}`));
                    }
                });
                
                pdfParser.on('pdfParser_dataError', (error) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    clearTimeout(parseTimeout);
                    reject(new Error(`PDF parsing error: ${error.parserError || error.message || 'Unknown PDF error'}`));
                });
                
                // Parse the PDF buffer
                try {
                    pdfParser.parseBuffer(req.file.buffer);
                } catch (parseError) {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(parseTimeout);
                        reject(new Error(`Failed to start PDF parsing: ${parseError.message}`));
                    }
                }
            });
        };
        
        const fullText = await parsePDF();
        res.json({ text: fullText });
        
    } catch (error) {
        console.error('PDF parsing error:', error);
        
        let userMessage = 'Failed to parse PDF. ';
        if (error.message.includes('timeout')) {
            userMessage += 'The PDF is taking too long to process. Please try a smaller or simpler PDF.';
        } else if (error.message.includes('empty') || error.message.includes('little extractable text')) {
            userMessage += 'The PDF appears to contain mostly images or no readable text. Please use a PDF with text content.';
        } else if (error.message.includes('corrupted')) {
            userMessage += 'The PDF file appears to be corrupted. Please try re-saving or re-creating the PDF.';
        } else {
            userMessage += 'Please ensure the file is a valid PDF with readable text content.';
        }
        
        res.status(500).json({ error: userMessage });
    }
});

// Enhanced resume analysis endpoint
app.post('/api/analyze-resume', async (req, res) => {
    try {
        console.log('=== RESUME ANALYSIS REQUEST ===');
        const { resumeText } = req.body;

        if (!resumeText) {
            return res.status(400).json({ error: 'Resume text is required' });
        }

        if (resumeText.length < 100) {
            return res.status(400).json({ 
                error: 'Resume text is too short. Please provide a more detailed resume (at least 100 characters).' 
            });
        }

        console.log(`Analyzing resume: ${resumeText.length} characters`);
        
        // Validate OpenAI configuration
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }
        
        const analysis = await analyzeResume(resumeText, openai);
        console.log('Resume analysis completed successfully:', {
            technicalSkills: analysis.technicalSkills?.length || 0,
            workExperience: analysis.workExperience?.length || 0,
            industries: analysis.industries?.length || 0,
            responsibilities: analysis.responsibilities?.length || 0,
            seniorityLevel: analysis.seniorityLevel || 'unknown'
        });
        
        res.json(analysis);
        
    } catch (error) {
        console.error('Resume analysis error:', error);
        
        let userMessage = 'Failed to analyze resume. ';
        if (error.message.includes('OpenAI')) {
            userMessage += 'AI analysis service is temporarily unavailable. Please try again.';
        } else if (error.message.includes('timeout')) {
            userMessage += 'Analysis is taking too long. Please try with a shorter resume.';
        } else if (error.message.includes('rate limit')) {
            userMessage += 'Too many requests. Please wait a moment and try again.';
        } else {
            userMessage += 'Please try again or contact support if the problem persists.';
        }
        
        res.status(500).json({ error: userMessage });
    }
});

// Enhanced job search endpoint with streaming and better error handling
app.post('/api/search-jobs', async (req, res) => {
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

        // Validate API configurations - INCLUDING RAPIDAPI
        const missingAPIs = [];
        if (!process.env.OPENAI_API_KEY) missingAPIs.push('OpenAI');
        if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_API_KEY) missingAPIs.push('Adzuna');
        if (!process.env.THEMUSE_API_KEY) missingAPIs.push('TheMuse');
        if (!process.env.REED_API_KEY) missingAPIs.push('Reed');
        if (!process.env.RAPIDAPI_KEY) missingAPIs.push('RapidAPI');

        if (missingAPIs.length === 5) {
            throw new Error('No job search APIs are configured. Please check API credentials.');
        }

        console.log('Analysis validation passed:', {
            technicalSkills: analysis.technicalSkills?.length || 0,
            workExperience: analysis.workExperience?.length || 0,
            industries: analysis.industries?.length || 0,
            responsibilities: analysis.responsibilities?.length || 0,
            seniorityLevel: analysis.seniorityLevel || 'unknown',
            filters: filters,
            availableAPIs: 5 - missingAPIs.length
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
            availableAPIs: 4 - missingAPIs.length
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
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        } else if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Please upload only one file.' });
        }
    }
    
    if (!res.headersSent) {
        res.status(500).json({ 
            error: 'An unexpected error occurred. Please try again.',
            errorCode: 'UNEXPECTED_ERROR'
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server with enhanced logging
app.listen(port, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 ENHANCED AI JOB MATCHER SERVER STARTED');
    console.log('='.repeat(50));
    console.log(`📍 Server URL: http://localhost:${port}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    console.log('\n📋 AVAILABLE ENDPOINTS:');
    console.log('  GET  /api/health           - Health check');
    console.log('  POST /api/parse-pdf        - Parse PDF resume');
    console.log('  POST /api/analyze-resume   - Analyze resume text');
    console.log('  POST /api/search-jobs      - Search for matching jobs');
    
    console.log('\n🔑 API CONFIGURATION STATUS:');
    console.log(`  OpenAI API Key:     ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing (REQUIRED)'}`);
    console.log(`  Adzuna App ID:      ${process.env.ADZUNA_APP_ID ? '✅ Configured' : '❌ Missing (Optional)'}`);
    console.log(`  Adzuna API Key:     ${process.env.ADZUNA_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
    console.log(`  TheMuse API Key:    ${process.env.THEMUSE_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
    console.log(`  Reed API Key:       ${process.env.REED_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
    console.log(`  RapidAPI Key:       ${process.env.RAPIDAPI_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
    
    // Count configured APIs
    const configuredAPIs = [
        process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY,
        process.env.THEMUSE_API_KEY,
        process.env.REED_API_KEY,
        process.env.RAPIDAPI_KEY
    ].filter(Boolean).length;
    
    console.log(`\n📊 JOB SEARCH CAPABILITY: ${configuredAPIs}/4 APIs configured`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.log('\n⚠️  WARNING: OpenAI API key is missing! Resume analysis will fail.');
    }
    
    if (configuredAPIs === 0) {
        console.log('⚠️  WARNING: No job search APIs configured! Job search will fail.');
    } else if (configuredAPIs < 4) {
        console.log(`ℹ️  INFO: ${4 - configuredAPIs} job search APIs are missing. Some job sources won't be available.`);
    }
    
    console.log('\n🎯 FEATURES ENABLED:');
    console.log('  ✅ Enhanced resume analysis with role understanding');
    console.log('  ✅ Remote job filtering');
    console.log('  ✅ AI-powered job matching');
    console.log('  ✅ Real-time job search updates');
    console.log('  ✅ Comprehensive error handling');
    console.log('  ✅ Request timeout management');
    console.log('  ✅ Rate limiting protection');
    
    console.log('\n' + '='.repeat(50));
    console.log('Ready to process job matching requests! 🎉');
    console.log('='.repeat(50) + '\n');
});

export default app;
