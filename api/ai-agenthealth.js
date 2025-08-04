// Health check endpoint for Vercel
export default function handler(req, res) {
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
    
    res.status(200).json(healthStatus);
} 
