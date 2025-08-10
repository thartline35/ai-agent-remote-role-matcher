// index.js - Updated with Reporting API implementation

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: './local.env' });

const app = express();
const port = process.env.PORT || 3000;

// Determine base URL for reporting endpoints
const getBaseUrl = (req) => {
    // In production, this would be your actual domain
    if (process.env.NODE_ENV === 'production') {
        return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app';
    }
    return `http://localhost:${port}`;
};

// Middleware with enhanced configuration
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// REPORTING API MIDDLEWARE
app.use((req, res, next) => {
    const baseUrl = getBaseUrl(req);
    
    // Configure Reporting-Endpoints header
    const reportingEndpoints = [
        `main-endpoint="${baseUrl}/api/reports"`,
        `default="${baseUrl}/api/reports"`,
        `csp-endpoint="${baseUrl}/api/reports"`,
        `security-endpoint="${baseUrl}/api/reports"`
    ].join(', ');
    
    res.setHeader('Reporting-Endpoints', reportingEndpoints);
    
    // Content Security Policy with reporting
    const cspPolicy = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://api.anthropic.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.anthropic.com https://*.rapidapi.com https://api.adzuna.com https://www.themuse.com https://www.reed.co.uk https://api.theirstack.com https://jsearch.p.rapidapi.com https://jobs-api14.p.rapidapi.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
        "report-to csp-endpoint"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', cspPolicy);
    
    // Document Policy with reporting
    res.setHeader('Document-Policy', 'document-write=?0, js-profiling=?0; report-to=main-endpoint');
    
    // Cross-Origin Policies with reporting
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin; report-to=security-endpoint');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp; report-to=security-endpoint');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'speaker=()',
        'ambient-light-sensor=()',
        'accelerometer=()',
        'battery=()',
        'display-capture=()',
        'document-domain=()'
    ].join(', '));
    
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    next();
});

// Serve static files
app.use(express.static(__dirname));

// Enhanced timeout middleware
app.use((req, res, next) => {
    let timeout;
    
    if (req.path === '/api/search-jobs') {
        timeout = 600000; // 10 minutes for job search
    } else if (req.path === '/api/analyze-resume') {
        timeout = 60000; // 1 minute for resume analysis
    } else if (req.path === '/api/reports') {
        timeout = 10000; // 10 seconds for report collection
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

    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));

    next();
});

// Health check endpoint with reporting status
app.get('/api/health', (req, res) => {
    const baseUrl = getBaseUrl(req);
    
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
        },
        reporting: {
            enabled: true,
            endpoint: `${baseUrl}/api/reports`,
            policies: {
                csp: 'enabled',
                documentPolicy: 'enabled',
                crossOriginPolicies: 'enabled',
                permissionsPolicy: 'enabled'
            }
        }
    };
    res.json(healthStatus);
});

// API routes for local development
import searchJobsHandler from './api/search-jobs.js';
import analyzeResumeHandler from './api/analyze-resume.js';
import parsePdfHandler from './api/parse-pdf.js';
import reportsHandler from './api/report.js';

// Main API routes
app.post('/api/search-jobs', searchJobsHandler);
app.post('/api/analyze-resume', analyzeResumeHandler);
app.post('/api/parse-pdf', parsePdfHandler);

// Reporting API routes
app.use('/api/reports', reportsHandler);

// Reports dashboard endpoint
app.get('/api/reports-dashboard', async (req, res) => {
    try {
        // Import the summary function
        const { getReportSummary } = await import('./api/report.js');
        const summary = getReportSummary();
        
        res.json({
            success: true,
            summary,
            endpoint: `${getBaseUrl(req)}/api/reports`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting report summary:', error);
        res.status(500).json({ error: 'Failed to get report summary' });
    }
});

// Test endpoint to generate sample reports (for testing)
app.get('/api/test-reports', (req, res) => {
    // This endpoint intentionally violates policies to generate test reports
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Report Testing Page</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .violation { background: #ffe6e6; padding: 10px; margin: 10px 0; border-left: 4px solid #ff4444; }
                button { padding: 10px 20px; margin: 10px; cursor: pointer; }
            </style>
        </head>
        <body>
            <h1>Reporting API Test Page</h1>
            <p>This page intentionally violates policies to generate test reports.</p>
            
            <div class="violation">
                <h3>CSP Violation Test</h3>
                <button onclick="testCSPViolation()">Trigger CSP Violation</button>
                <p>This will try to load a script from an unauthorized domain.</p>
            </div>
            
            <div class="violation">
                <h3>Document Policy Violation Test</h3>
                <button onclick="testDocumentPolicyViolation()">Trigger Document Policy Violation</button>
                <p>This will try to use document.write which is blocked by our policy.</p>
            </div>
            
            <div class="violation">
                <h3>Deprecation Warning Test</h3>
                <button onclick="testDeprecationWarning()">Trigger Deprecation Warning</button>
                <p>This will use a deprecated API.</p>
            </div>

            <script>
                function testCSPViolation() {
                    // This will violate the CSP and generate a report
                    const script = document.createElement('script');
                    script.src = 'https://malicious.example.com/evil.js';
                    document.head.appendChild(script);
                }
                
                function testDocumentPolicyViolation() {
                    try {
                        // This will violate the Document Policy
                        document.write('<p>This should not work!</p>');
                    } catch (e) {
                        console.log('Document.write blocked:', e);
                    }
                }
                
                function testDeprecationWarning() {
                    // Use a deprecated API
                    if (window.webkitStorageInfo) {
                        const info = window.webkitStorageInfo;
                        console.log('Using deprecated webkitStorageInfo:', info);
                    }
                    
                    // Another deprecated API
                    if (navigator.getUserMedia) {
                        console.log('Using deprecated getUserMedia');
                    }
                }
                
                // Automatically generate some test violations
                setTimeout(() => {
                    console.log('Auto-generating test violations...');
                    testDocumentPolicyViolation();
                }, 2000);
            </script>
        </body>
        </html>
    `);
});

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
    app.listen(port, () => {
        const baseUrl = `http://localhost:${port}`;
        
        console.log('\n' + '='.repeat(60));
        console.log('🚀 AI JOB MATCHER SERVER WITH REPORTING API');
        console.log('='.repeat(60));
        console.log(`📍 Server URL: ${baseUrl}`);
        console.log(`⏰ Started at: ${new Date().toISOString()}`);
        console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
        
        console.log('\n📋 AVAILABLE ENDPOINTS:');
        console.log('  GET  /api/health              - Health check with reporting status');
        console.log('  POST /api/parse-pdf           - Parse PDF resume');
        console.log('  POST /api/analyze-resume      - Analyze resume text');
        console.log('  POST /api/search-jobs         - Search for matching jobs');
        console.log('  POST /api/reports             - Receive browser reports');
        console.log('  GET  /api/reports             - View collected reports');
        console.log('  GET  /api/reports-dashboard   - Reports dashboard data');
        console.log('  GET  /api/test-reports        - Generate test reports');
        
        console.log('\n📊 REPORTING API FEATURES:');
        console.log('  ✅ Content Security Policy reporting');
        console.log('  ✅ Document Policy violation reporting'); 
        console.log('  ✅ Cross-Origin Policy reporting');
        console.log('  ✅ Deprecation warning reporting');
        console.log('  ✅ Browser intervention reporting');
        console.log('  ✅ Permissions Policy violations');
        
        console.log('\n🔍 MONITORING:');
        console.log(`  Reports Endpoint: ${baseUrl}/api/reports`);
        console.log(`  Dashboard Data:   ${baseUrl}/api/reports-dashboard`);
        console.log(`  Test Reports:     ${baseUrl}/api/test-reports`);
        
        console.log('\n🛡️ SECURITY POLICIES ENABLED:');
        console.log('  🔒 Content Security Policy (with reporting)');
        console.log('  📋 Document Policy (blocks document.write)');
        console.log('  🌐 Cross-Origin-Opener-Policy');
        console.log('  🔗 Cross-Origin-Embedder-Policy');
        console.log('  🚫 Permissions Policy (restrictive)');
        console.log('  🛡️ Additional security headers');
        
        console.log('\n' + '='.repeat(60));
        console.log('Ready to process requests and collect reports! 📈');
        console.log('='.repeat(60) + '\n');
    });
}

// Export for Vercel
export default app;