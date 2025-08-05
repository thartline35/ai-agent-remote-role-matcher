import OpenAI from "openai";
import { analyzeResume } from "../tools.js";

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
} 