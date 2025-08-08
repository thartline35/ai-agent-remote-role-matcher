export default function handler(req, res) {
    try {
        console.log('Health check endpoint called');
        
        // Check if environment variables exist
        const envStatus = {
            OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
            RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
            ADZUNA_APP_ID: !!process.env.ADZUNA_APP_ID,
            ADZUNA_API_KEY: !!process.env.ADZUNA_API_KEY,
            THEMUSE_API_KEY: !!process.env.THEMUSE_API_KEY,
            REED_API_KEY: !!process.env.REED_API_KEY,
            THEIRSTACK_API_KEY: !!process.env.THEIRSTACK_API_KEY
        };

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.VERCEL_ENV || 'unknown',
            region: process.env.VERCEL_REGION || 'unknown',
            envVariables: envStatus,
            nodeVersion: process.version
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            stack: error.stack
        });
    }
}