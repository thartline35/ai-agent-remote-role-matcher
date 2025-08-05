// Enhanced index.js with better error handling, timeout management, and API optimization

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - use local.env for development, Vercel env vars for production
dotenv.config({ path: './local.env' });

const app = express();
const port = process.env.PORT || 3000;

// Middleware with enhanced configuration
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files from root directory for Vercel
// REMOVE the problematic line above and replace with:

// Serve specific files only
app.get('/frontend.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'frontend.js'));
});

app.get('/index.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'index.css'));
});

// Also serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
    }
}));



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

// Add body parsing middleware for API routes
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// Health check endpoint
app.get('/api/health', (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        apis: {
            openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
            theirstack: process.env.THEIRSTACK_API_KEY ? 'configured' : 'missing',
            adzuna: (process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY) ? 'configured' : 'missing',
            themuse: process.env.THEMUSE_API_KEY ? 'configured' : 'missing',
            reed: process.env.REED_API_KEY ? 'configured' : 'missing',
            rapidapi: process.env.RAPIDAPI_KEY ? 'configured' : 'missing'
        }
    };
    res.json(healthStatus);
});

// API routes are now handled by separate files in the /api directory for Vercel deployment





// Root route - serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
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

// Start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
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
        console.log('  POST /api/parse-pdf        - Parse PDF resume (Vercel API)');
        console.log('  POST /api/analyze-resume   - Analyze resume text (Vercel API)');
        console.log('  POST /api/search-jobs      - Search for matching jobs (Vercel API)');
        
        console.log('\n🔑 API CONFIGURATION STATUS:');
        console.log(`  OpenAI API Key:     ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing (REQUIRED)'}`);
        console.log(`  Theirstack API Key: ${process.env.THEIRSTACK_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
        console.log(`  Adzuna App ID:      ${process.env.ADZUNA_APP_ID ? '✅ Configured' : '❌ Missing (Optional)'}`);
        console.log(`  Adzuna API Key:     ${process.env.ADZUNA_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
        console.log(`  TheMuse API Key:    ${process.env.THEMUSE_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
        console.log(`  Reed API Key:       ${process.env.REED_API_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
        console.log(`  RapidAPI Key:       ${process.env.RAPIDAPI_KEY ? '✅ Configured' : '❌ Missing (Optional)'}`);
        
        // Count configured APIs
        const configuredAPIs = [
            process.env.OPENAI_API_KEY,
            process.env.THEIRSTACK_API_KEY,
            process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY,
            process.env.THEMUSE_API_KEY,
            process.env.REED_API_KEY,
            process.env.RAPIDAPI_KEY
        ].filter(Boolean).length;
        
        console.log(`\n📊 JOB SEARCH CAPABILITY: ${configuredAPIs}/6 APIs configured`);
        
        if (!process.env.OPENAI_API_KEY) {
            console.log('\n⚠️  WARNING: OpenAI API key is missing! Resume analysis will fail.');
        }
        
        if (configuredAPIs === 0) {
            console.log('⚠️  WARNING: No job search APIs configured! Job search will fail.');
        } else if (configuredAPIs < 6) {
            console.log(`ℹ️  INFO: ${6 - configuredAPIs} job search APIs are missing. Some job sources won't be available.`);
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
}

// Export for Vercel
export default app;