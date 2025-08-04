// Vercel API handler - Serverless function entry point
import OpenAI from "openai";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import PDFParser from 'pdf2json';
import { analyzeResume, scrapeJobListings } from "../tools.js";

// Load environment variables for Vercel
dotenv.config();

const app = express();

// Middleware with enhanced configuration
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

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

// Initialize OpenAI with enhanced configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout for OpenAI requests
    maxRetries: 2   // Retry failed requests up to 2 times
});

// Test endpoint for Vercel
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Vercel deployment is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
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

// PDF parsing endpoint
app.post('/api/parse-pdf', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`Parsing PDF file: ${req.file.originalname} (${req.file.size} bytes)`);

        const parsePDF = () => {
            return new Promise((resolve, reject) => {
                const pdfParser = new PDFParser();
                
                pdfParser.on("pdfParser_dataReady", function(pdfData) {
                    try {
                        let text = '';
                        
                        // Extract text from all pages
                        if (pdfData.Pages && pdfData.Pages.length > 0) {
                            pdfData.Pages.forEach(page => {
                                if (page.Texts && page.Texts.length > 0) {
                                    page.Texts.forEach(textItem => {
                                        if (textItem.R && textItem.R.length > 0) {
                                            textItem.R.forEach(r => {
                                                if (r.T) {
                                                    text += decodeURIComponent(r.T) + ' ';
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                        
                        resolve({
                            text: text.trim(),
                            pages: pdfData.Pages ? pdfData.Pages.length : 0,
                            characters: text.length
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
                
                pdfParser.on("pdfParser_dataError", function(error) {
                    reject(error);
                });
                
                pdfParser.parseBuffer(req.file.buffer);
            });
        };

        const result = await parsePDF();
        console.log(`PDF parsed successfully: ${result.pages} pages, ${result.characters} characters extracted`);
        
        res.json({ text: result.text });

    } catch (error) {
        console.error('PDF parsing error:', error);
        res.status(500).json({ 
            error: 'Failed to parse PDF file',
            details: error.message 
        });
    }
});

// Resume analysis endpoint
app.post('/api/analyze-resume', async (req, res) => {
    try {
        const { resumeText } = req.body;
        
        if (!resumeText) {
            return res.status(400).json({ error: 'Resume text is required' });
        }

        console.log('=== RESUME ANALYSIS REQUEST ===');
        console.log(`Analyzing resume: ${resumeText.length} characters`);

        const analysis = await analyzeResume(resumeText, openai);
        
        console.log('Resume analysis completed successfully:', {
            technicalSkills: analysis.technicalSkills?.length || 0,
            workExperience: analysis.workExperience?.length || 0,
            industries: analysis.industries?.length || 0,
            responsibilities: analysis.responsibilities?.length || 0,
            seniorityLevel: analysis.seniorityLevel || 'unknown'
        });

        res.json({
            success: true,
            analysis: analysis
        });

    } catch (error) {
        console.error('Resume analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze resume',
            details: error.message 
        });
    }
});

// Job search endpoint with Server-Sent Events
app.post('/api/search-jobs', async (req, res) => {
    try {
        const { analysis, filters = {} } = req.body;
        
        if (!analysis) {
            return res.status(400).json({ error: 'Resume analysis is required' });
        }

        console.log('=== JOB SEARCH REQUEST STARTED ===');
        console.log('Timestamp:', new Date().toISOString());
        
        // Validate analysis data
        const validation = {
            technicalSkills: analysis.technicalSkills?.length || 0,
            workExperience: analysis.workExperience?.length || 0,
            industries: analysis.industries?.length || 0,
            responsibilities: analysis.responsibilities?.length || 0,
            seniorityLevel: analysis.seniorityLevel || 'unknown',
            filters: filters,
            availableAPIs: [
                process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY,
                process.env.THEMUSE_API_KEY,
                process.env.REED_API_KEY,
                process.env.RAPIDAPI_KEY
            ].filter(Boolean).length
        };
        
        console.log('Analysis validation passed:', validation);

        // Set up Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        const sendSSE = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const onJobFound = (jobs, sourceName) => {
            console.log('=== JOB BATCH RECEIVED ===');
            console.log('Source:', sourceName);
            console.log('Jobs in this batch:', jobs.length);
            console.log('Search time elapsed:', ((Date.now() - startTime) / 1000).toFixed(1) + 's');
            console.log('Sample job:', `"${jobs[0]?.title}" at ${jobs[0]?.company} (${jobs[0]?.source})`);
            
            sendSSE({
                type: 'jobs_found',
                jobs: jobs,
                source: sourceName,
                totalFound: jobs.length
            });
        };

        const startTime = Date.now();
        console.log('Starting enhanced job search with comprehensive matching...');

        const results = await scrapeJobListings(analysis, filters, openai, onJobFound);
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('=== JOB SEARCH COMPLETED ===');
        console.log(`Total search time: ${totalTime}s`);
        console.log(`Jobs found: ${results.length}`);
        
        // Paginate results for frontend
        const initialJobs = results.slice(0, 12);
        const remainingJobs = results.slice(12);
        
        console.log(`Initial jobs for display: ${initialJobs.length}`);
        console.log(`Remaining jobs for pagination: ${remainingJobs.length}`);
        
        const finalResults = {
            initialJobs: initialJobs,
            remainingJobs: remainingJobs,
            totalJobs: results.length
        };
        
        console.log('Sending final results:', finalResults);
        
        sendSSE({
            type: 'search_complete',
            ...finalResults
        });
        
        console.log('=== JOB SEARCH REQUEST COMPLETED SUCCESSFULLY ===');

    } catch (error) {
        console.error('❌ Job search error:', error);
        
        if (!res.headersSent) {
            res.writeHead(500, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: error.message || 'Job search failed'
            })}\n\n`);
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

// Export for Vercel
export default app; 
