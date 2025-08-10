// api/report.js - Report Collector for Reporting API
import { promises as fs } from 'fs';
import path from 'path';

// In-memory storage for demo purposes
// In production, use a proper database
let reports = [];
let reportStats = {
    totalReports: 0,
    reportsByType: {},
    reportsByUrl: {},
    lastReportTime: null
};

const MAX_REPORTS = 1000; // Limit stored reports

export default async function handler(req, res) {
    // Enable CORS for report collection
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        return handleReportSubmission(req, res);
    } else if (req.method === 'GET') {
        // Check if this is a dashboard summary request
        if (req.url === '/api/reports-dashboard' || req.url.endsWith('/reports-dashboard')) {
            return handleDashboardSummary(req, res);
        }
        // Check if this is a test reports request
        if (req.url === '/api/test-reports' || req.url.endsWith('/test-reports')) {
            return handleTestReports(req, res);
        }
        return handleReportRetrieval(req, res);
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}

async function handleReportSubmission(req, res) {
    try {
        // Validate Content-Type
        if (req.headers['content-type'] !== 'application/reports+json') {
            console.warn('Invalid Content-Type for report submission:', req.headers['content-type']);
            return res.status(400).json({ error: 'Invalid Content-Type. Expected application/reports+json' });
        }

        const receivedReports = req.body;
        
        // Validate that body is an array
        if (!Array.isArray(receivedReports)) {
            console.error('Invalid report format: expected array, got:', typeof receivedReports);
            return res.status(400).json({ error: 'Reports must be an array' });
        }

        const timestamp = new Date().toISOString();
        console.log(`📊 Received ${receivedReports.length} report(s) at ${timestamp}`);

        // Process each report
        for (const report of receivedReports) {
            if (isValidReport(report)) {
                const processedReport = {
                    ...report,
                    receivedAt: timestamp,
                    id: generateReportId(),
                    processed: false
                };

                // Add to storage
                reports.unshift(processedReport); // Add to beginning for latest-first order
                
                // Update statistics
                updateReportStats(processedReport);

                // Log report details
                logReport(processedReport);

                // Process specific report types
                await processReportByType(processedReport);
            } else {
                console.warn('Invalid report structure:', report);
            }
        }

        // Limit stored reports
        if (reports.length > MAX_REPORTS) {
            reports = reports.slice(0, MAX_REPORTS);
        }

        // Save reports to file for persistence (optional)
        await saveReportsToFile();

        res.status(200).json({ 
            message: 'Reports received successfully',
            count: receivedReports.length,
            timestamp 
        });

    } catch (error) {
        console.error('Error processing reports:', error);
        res.status(500).json({ error: 'Failed to process reports' });
    }
}

async function handleReportRetrieval(req, res) {
    try {
        const { type, limit = 50, offset = 0 } = req.query;
        
        let filteredReports = reports;
        
        // Filter by type if specified
        if (type) {
            filteredReports = reports.filter(report => report.type === type);
        }

        // Apply pagination
        const paginatedReports = filteredReports.slice(
            parseInt(offset), 
            parseInt(offset) + parseInt(limit)
        );

        // Get unique report types for filters
        const reportTypes = [...new Set(reports.map(r => r.type))];

        res.json({
            reports: paginatedReports,
            stats: reportStats,
            pagination: {
                total: filteredReports.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: filteredReports.length > parseInt(offset) + parseInt(limit)
            },
            availableTypes: reportTypes,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving reports:', error);
        res.status(500).json({ error: 'Failed to retrieve reports' });
    }
}

async function handleDashboardSummary(req, res) {
    try {
        const summary = getReportSummary();
        
        res.status(200).json({
            success: true,
            summary
        });
        
    } catch (error) {
        console.error('Error generating dashboard summary:', error);
        res.status(500).json({ error: 'Failed to generate dashboard summary' });
    }
}

async function handleTestReports(req, res) {
    try {
        // Generate some test reports for demonstration
        const testReports = [
            {
                type: 'csp-violation',
                url: 'https://example.com/page1',
                user_agent: 'Mozilla/5.0 (Test Browser)',
                body: {
                    blockedURL: 'https://malicious.com/script.js',
                    effectiveDirective: 'script-src',
                    disposition: 'enforce'
                }
            },
            {
                type: 'deprecation',
                url: 'https://example.com/page2',
                user_agent: 'Mozilla/5.0 (Test Browser)',
                body: {
                    id: 'deprecated-api',
                    message: 'The WebSQL API is deprecated and will be removed'
                }
            },
            {
                type: 'intervention',
                url: 'https://example.com/page3',
                user_agent: 'Mozilla/5.0 (Test Browser)',
                body: {
                    message: 'Autoplay was blocked due to user preferences'
                }
            }
        ];

        // Submit these as real reports
        for (const report of testReports) {
            if (isValidReport(report)) {
                const processedReport = {
                    ...report,
                    receivedAt: new Date().toISOString(),
                    id: generateReportId(),
                    processed: false
                };

                reports.unshift(processedReport);
                updateReportStats(processedReport);
                logReport(processedReport);
            }
        }

        // Save reports to file for persistence
        await saveReportsToFile();

        // Return HTML page showing test reports were generated
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Reports Generated</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .success { color: green; }
                    .info { color: blue; }
                </style>
            </head>
            <body>
                <h1 class="success">✅ Test Reports Generated Successfully!</h1>
                <p class="info">Generated ${testReports.length} test reports.</p>
                <p>You can now return to the dashboard to see these reports.</p>
                <script>
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                </script>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Error generating test reports:', error);
        res.status(500).json({ error: 'Failed to generate test reports' });
    }
}

function isValidReport(report) {
    return (
        report &&
        typeof report === 'object' &&
        typeof report.type === 'string' &&
        typeof report.url === 'string' &&
        typeof report.user_agent === 'string' &&
        report.body &&
        typeof report.body === 'object'
    );
}

function generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function updateReportStats(report) {
    reportStats.totalReports++;
    reportStats.lastReportTime = report.receivedAt;
    
    // Count by type
    reportStats.reportsByType[report.type] = (reportStats.reportsByType[report.type] || 0) + 1;
    
    // Count by URL
    const url = new URL(report.url).pathname;
    reportStats.reportsByUrl[url] = (reportStats.reportsByUrl[url] || 0) + 1;
}

function logReport(report) {
    const logData = {
        id: report.id,
        type: report.type,
        url: report.url,
        userAgent: report.user_agent?.substr(0, 50) + '...',
        age: report.age,
        bodyPreview: getBodyPreview(report.body, report.type)
    };

    console.log('📋 Report Details:', JSON.stringify(logData, null, 2));
}

function getBodyPreview(body, type) {
    switch (type) {
        case 'csp-violation':
            return {
                blockedURL: body.blockedURL,
                violatedDirective: body.effectiveDirective,
                disposition: body.disposition
            };
        case 'coep':
            return {
                blockedURL: body.blockedURL,
                destination: body.destination,
                type: body.type
            };
        case 'coop':
            return {
                disposition: body.disposition,
                effectivePolicy: body.effectivePolicy
            };
        case 'document-policy-violation':
            return {
                policyId: body.policyId,
                message: body.message,
                sourceFile: body.sourceFile
            };
        case 'deprecation':
            return {
                feature: body.id,
                message: body.message,
                sourceFile: body.sourceFile
            };
        case 'intervention':
            return {
                message: body.message,
                sourceFile: body.sourceFile
            };
        default:
            return body;
    }
}

async function processReportByType(report) {
    switch (report.type) {
        case 'csp-violation':
            await processCspViolation(report);
            break;
        case 'coep':
        case 'coop':
            await processCrossOriginPolicyViolation(report);
            break;
        case 'deprecation':
            await processDeprecationReport(report);
            break;
        case 'intervention':
            await processInterventionReport(report);
            break;
        case 'document-policy-violation':
            await processDocumentPolicyViolation(report);
            break;
        default:
            console.log(`⚠️ Unknown report type: ${report.type}`);
    }
}

async function processCspViolation(report) {
    const { body } = report;
    console.log(`🚫 CSP Violation: ${body.effectiveDirective} blocked ${body.blockedURL}`);
    
    // You could add specific logic here:
    // - Send alerts for critical violations
    // - Track repeat offenders
    // - Update security policies automatically
}

async function processCrossOriginPolicyViolation(report) {
    const { body, type } = report;
    console.log(`🔒 ${type.toUpperCase()} Violation:`, body);
    
    // Track cross-origin policy issues
    // This might indicate iframe integration problems
}

async function processDeprecationReport(report) {
    const { body } = report;
    console.log(`⚠️ Deprecated API used: ${body.id} - ${body.message}`);
    
    // Track deprecated APIs for migration planning
    // You might want to create tickets or send notifications
}

async function processInterventionReport(report) {
    const { body } = report;
    console.log(`🚨 Browser Intervention: ${body.message}`);
    
    // Track browser interventions - these often indicate UX issues
}

async function processDocumentPolicyViolation(report) {
    const { body } = report;
    console.log(`📋 Document Policy Violation: ${body.policyId} - ${body.message}`);
}

async function saveReportsToFile() {
    try {
        // Only save recent reports to avoid huge files
        const recentReports = reports.slice(0, 100);
        const data = {
            reports: recentReports,
            stats: reportStats,
            lastSaved: new Date().toISOString()
        };
        
        // In a real application, you'd save to a database
        // For demo purposes, we could save to a file
        // await fs.writeFile('./reports-backup.json', JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.error('Error saving reports:', error);
    }
}

// Utility function to get report summary for dashboard
export function getReportSummary() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentReports = reports.filter(r => new Date(r.receivedAt) > last24Hours);
    const weeklyReports = reports.filter(r => new Date(r.receivedAt) > lastWeek);

    return {
        total: reports.length,
        last24Hours: recentReports.length,
        lastWeek: weeklyReports.length,
        byType: reportStats.reportsByType,
        byUrl: reportStats.reportsByUrl,
        mostRecentReport: reports[0]?.receivedAt || null
    };
}