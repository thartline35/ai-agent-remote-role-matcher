// api/analyze-resume.js
import OpenAI from "openai";

// Initialize OpenAI with enhanced configuration - lazy loading
let openai = null;

function getOpenAIClient() {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 30000, // 30 second timeout for OpenAI requests
            maxRetries: 2   // Retry failed requests up to 2 times
        });
    }
    return openai;
}

// Enhanced Resume Analysis Function with better role extraction
async function analyzeResume(resumeText, openai) {
    try {
        console.log('Starting comprehensive resume analysis...');
        const truncatedText = resumeText.length > 8000 ? resumeText.substring(0, 8000) + '...' : resumeText;

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an expert resume analyzer specializing in extracting comprehensive job-relevant information. Your job is to deeply analyze resumes and extract ALL relevant information for job matching, regardless of how it's presented.

INSTRUCTIONS:
- Extract technical skills from ANY mention (tools used, software, programming languages, platforms, etc.)
- Extract soft skills from descriptions of achievements, leadership, collaboration, etc.
- Extract work experience including job titles, responsibilities, achievements, and implied roles
- Look for education, certifications, and training
- Identify seniority level and qualifications from context
- Consider role descriptions and responsibilities, not just job titles
- Extract industry experience and domain knowledge

For work experience, don't just look for formal job titles - extract:
- What they actually DID (responsibilities, tasks, projects)
- What roles they performed (even if not in the title)
- What industries they worked in
- What level of responsibility they had
- What achievements they accomplished

Return ONLY a valid JSON object:
{
  "technicalSkills": ["list of all technical skills, tools, software, languages"],
  "softSkills": ["list of soft skills, leadership qualities, interpersonal skills"], 
  "workExperience": ["list of job titles, roles, responsibilities, and functions performed"],
  "education": ["list of degrees, certifications, courses, training"],
  "qualifications": ["list of experience levels, specializations, achievements"],
  "industries": ["list of industries worked in"],
  "responsibilities": ["list of key responsibilities and functions"],
  "achievements": ["list of key achievements and accomplishments"],
  "seniorityLevel": "entry|mid|senior|lead|executive"
}`
                },
                {
                    role: "user",
                    content: `Analyze this resume comprehensively and extract ALL relevant information for job matching. Look beyond job titles to understand what this person actually does and is capable of: ${truncatedText}`
                }
            ],
            temperature: 0.1,
            max_tokens: 1500
        });

        const analysisText = response.choices[0].message.content;
        const cleanedText = analysisText.replace(/```json\s*|\s*```/g, '').trim();

        try {
            const analysis = JSON.parse(cleanedText);
            console.log('AI analysis completed:', {
                technical: analysis.technicalSkills?.length || 0,
                soft: analysis.softSkills?.length || 0,
                experience: analysis.workExperience?.length || 0,
                education: analysis.education?.length || 0,
                qualifications: analysis.qualifications?.length || 0,
                industries: analysis.industries?.length || 0,
                responsibilities: analysis.responsibilities?.length || 0,
                achievements: analysis.achievements?.length || 0,
                seniorityLevel: analysis.seniorityLevel || 'none'
            });
            
            // Merge with enhanced fallback extraction
            const fallbackAnalysis = extractEnhancedSkillsFromText(resumeText);
            const mergedAnalysis = {
                technicalSkills: [...new Set([...(analysis.technicalSkills || []), ...(fallbackAnalysis.technicalSkills || [])])],
                softSkills: [...new Set([...(analysis.softSkills || []), ...(fallbackAnalysis.softSkills || [])])],
                workExperience: [...new Set([...(analysis.workExperience || []), ...(fallbackAnalysis.workExperience || [])])],
                education: [...new Set([...(analysis.education || []), ...(fallbackAnalysis.education || [])])],
                qualifications: [...new Set([...(analysis.qualifications || []), ...(fallbackAnalysis.qualifications || [])])],
                industries: [...new Set([...(analysis.industries || []), ...(fallbackAnalysis.industries || [])])],
                responsibilities: [...new Set([...(analysis.responsibilities || []), ...(fallbackAnalysis.responsibilities || [])])],
                achievements: [...new Set([...(analysis.achievements || []), ...(fallbackAnalysis.achievements || [])])],
                seniorityLevel: (analysis.seniorityLevel && analysis.seniorityLevel.trim()) || fallbackAnalysis.seniorityLevel || 'mid'
            };

            return mergedAnalysis;
        } catch (parseError) {
            console.log('AI parsing failed, using enhanced fallback extraction');
            return extractEnhancedSkillsFromText(resumeText);
        }
    } catch (error) {
        console.error('Error analyzing resume:', error);
        return extractEnhancedSkillsFromText(resumeText);
    }
}

// Enhanced skill extraction with better role understanding
function extractEnhancedSkillsFromText(resumeText) {
    const text = resumeText.toLowerCase();
    const analysis = {
        technicalSkills: [],
        softSkills: [],
        workExperience: [],
        education: [],
        qualifications: [],
        industries: [],
        responsibilities: [],
        achievements: [],
        seniorityLevel: 'mid'
    };

    // Comprehensive technical skills
    const techSkills = [
        // Programming & Development
        'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'php', 'ruby', 'go', 'swift', 'kotlin', 'scala', 'rust',
        'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'laravel', 'rails',
        'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind',
        'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'oracle', 'cassandra',
        'aws', 'azure', 'google cloud', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git', 'gitlab', 'github',
        'linux', 'unix', 'windows server', 'apache', 'nginx', 'terraform', 'ansible',
        
        // Data & Analytics
        'excel', 'google sheets', 'tableau', 'power bi', 'looker', 'qlik', 'r', 'stata', 'spss', 'sas',
        'google analytics', 'mixpanel', 'amplitude', 'hotjar', 'segment', 'databricks', 'snowflake',
        'pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'jupyter', 'hadoop', 'spark',
        
        // Design & Creative
        'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator', 'indesign', 'after effects',
        'canva', 'invision', 'principle', 'framer', 'zeplin', 'adobe creative suite',
        
        // Marketing & Sales
        'google ads', 'facebook ads', 'instagram ads', 'linkedin ads', 'twitter ads', 'tiktok ads',
        'hubspot', 'salesforce', 'marketo', 'mailchimp', 'constant contact', 'pardot', 'klaviyo',
        'seo', 'sem', 'ppc', 'social media marketing', 'email marketing', 'content marketing',
        'google tag manager', 'facebook pixel', 'conversion tracking',
        
        // Project Management & Productivity
        'jira', 'asana', 'trello', 'monday.com', 'notion', 'confluence', 'slack', 'teams',
        'basecamp', 'wrike', 'smartsheet', 'airtable', 'clickup', 'linear',
        
        // Business & Finance
        'quickbooks', 'sage', 'xero', 'freshbooks', 'netsuite', 'sap', 'oracle financials',
        'bloomberg terminal', 'thomson reuters', 'factset', 'morningstar', 'workday',
        
        // CRM & Customer Service
        'zendesk', 'freshdesk', 'intercom', 'drift', 'livechat', 'helpscout', 'servicenow',
        'pipedrive', 'copper', 'zoho', 'insightly', 'dynamics 365'
    ];

    // Enhanced soft skills
    const softSkills = [
        'leadership', 'management', 'team leadership', 'people management',
        'communication', 'verbal communication', 'written communication', 'presentation skills',
        'teamwork', 'collaboration', 'cross-functional collaboration',
        'problem solving', 'analytical thinking', 'critical thinking', 'creative thinking',
        'project management', 'program management', 'time management', 'organization', 'planning',
        'customer service', 'client relations', 'stakeholder management', 'relationship management',
        'public speaking', 'writing', 'editing', 'technical writing',
        'negotiation', 'sales', 'marketing', 'business development', 'account management',
        'training', 'mentoring', 'coaching', 'teaching', 'knowledge transfer',
        'adaptability', 'flexibility', 'innovation', 'creativity', 'entrepreneurship',
        'attention to detail', 'quality assurance', 'process improvement', 'continuous improvement',
        'strategic planning', 'strategic thinking', 'decision making', 'risk management'
    ];

    // Enhanced work experience patterns with responsibilities
    const experiencePatterns = [
        // Technology roles
        'software engineer', 'software developer', 'web developer', 'mobile developer', 'app developer',
        'full stack developer', 'frontend developer', 'backend developer', 'fullstack engineer',
        'data scientist', 'data analyst', 'data engineer', 'machine learning engineer', 'ai engineer',
        'devops engineer', 'cloud engineer', 'infrastructure engineer', 'site reliability engineer',
        'system administrator', 'network administrator', 'database administrator',
        'cybersecurity analyst', 'information security', 'security engineer',
        'it support', 'technical support', 'help desk', 'system analyst',
        'product manager', 'project manager', 'program manager', 'scrum master', 'agile coach',
        'ux designer', 'ui designer', 'product designer', 'graphic designer', 'web designer',
        'technical lead', 'engineering manager', 'cto', 'vp engineering',
        
        // Business & Operations
        'business analyst', 'systems analyst', 'process analyst', 'operations analyst',
        'financial analyst', 'investment analyst', 'research analyst', 'credit analyst',
        'accountant', 'bookkeeper', 'controller', 'cfo', 'finance manager', 'finance director',
        'operations manager', 'operations director', 'general manager', 'ceo', 'coo', 'president',
        'consultant', 'business consultant', 'management consultant', 'strategy consultant',
        'human resources', 'hr manager', 'hr director', 'recruiter', 'talent acquisition',
        'training manager', 'learning and development', 'organizational development',
        
        // Sales & Marketing
        'marketing manager', 'marketing director', 'digital marketing manager', 'growth manager',
        'content marketing manager', 'social media manager', 'brand manager', 'product marketing',
        'marketing coordinator', 'marketing specialist', 'marketing analyst',
        'sales manager', 'sales director', 'sales representative', 'account manager', 'account executive',
        'business development manager', 'partnerships manager', 'channel manager',
        'customer success manager', 'customer service manager', 'support manager',
        
        // Creative & Content
        'creative director', 'art director', 'design director', 'brand designer',
        'copywriter', 'content writer', 'technical writer', 'content creator', 'content strategist',
        'video editor', 'photographer', 'animator', 'motion graphics designer',
        
        // Industry-specific
        'nursing', 'physician', 'pharmaceutical', 'biotech', 'clinical research',
        'education', 'academic', 'research', 'scientific research', 'mental health',
        'legal', 'compliance', 'regulatory', 'audit', 'risk management',
        'retail', 'e-commerce', 'supply chain', 'logistics', 'procurement'
    ];

    // Industry patterns
    const industryPatterns = [
        'technology', 'software', 'saas', 'fintech', 'healthtech', 'edtech',
        'nursing', 'physician', 'therapist', 'pharmaceutical', 'biotechnology',
        'finance', 'banking', 'insurance', 'investment', 'venture capital',
        'e-commerce', 'retail', 'consumer goods', 'marketplace',
        'education', 'academic', 'research', 'non-profit',
        'media', 'entertainment', 'advertising', 'marketing',
        'manufacturing', 'automotive', 'aerospace', 'energy',
        'real estate', 'construction', 'architecture',
        'consulting', 'professional services', 'legal'
    ];

    // Responsibility patterns
    const responsibilityPatterns = [
        'developed', 'built', 'created', 'designed', 'implemented', 'deployed',
        'managed', 'led', 'supervised', 'coordinated', 'organized',
        'analyzed', 'researched', 'evaluated', 'assessed', 'reviewed',
        'improved', 'optimized', 'streamlined', 'automated', 'enhanced',
        'collaborated', 'partnered', 'worked with', 'liaised',
        'trained', 'mentored', 'coached', 'taught', 'guided',
        'planned', 'strategized', 'executed', 'delivered', 'launched',
        'maintained', 'supported', 'troubleshot', 'resolved',
        'increased', 'grew', 'expanded', 'scaled', 'boosted',
        'reduced', 'decreased', 'minimized', 'cut', 'saved'
    ];

    // Check for matches
    techSkills.forEach(skill => {
        if (text.includes(skill)) analysis.technicalSkills.push(skill);
    });

    softSkills.forEach(skill => {
        if (text.includes(skill)) analysis.softSkills.push(skill);
    });

    experiencePatterns.forEach(exp => {
        if (text.includes(exp)) analysis.workExperience.push(exp);
    });

    industryPatterns.forEach(industry => {
        if (text.includes(industry)) analysis.industries.push(industry);
    });

    responsibilityPatterns.forEach(resp => {
        if (text.includes(resp)) analysis.responsibilities.push(resp);
    });

    // Determine seniority level
    if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('architect')) {
        analysis.seniorityLevel = 'senior';
    } else if (text.includes('director') || text.includes('vp') || text.includes('head of') || text.includes('chief')) {
        analysis.seniorityLevel = 'executive';
    } else if (text.includes('junior') || text.includes('entry') || text.includes('associate') || text.includes('intern')) {
        analysis.seniorityLevel = 'entry';
    } else if (text.includes('manager') || text.includes('lead') || text.includes('coordinator')) {
        analysis.seniorityLevel = 'lead';
    }

    // Education patterns
    const educationPatterns = [
        'bachelor', 'bs', 'ba', 'master', 'ms', 'ma', 'mba', 'phd', 'doctorate', 'associate',
        'computer science', 'engineering', 'business', 'marketing', 'finance', 'economics',
        'psychology', 'communications', 'design', 'art', 'science', 'mathematics',
        'certification', 'certified', 'license', 'training', 'course', 'bootcamp',
        'aws certified', 'microsoft certified', 'google certified', 'salesforce certified',
        'pmp', 'scrum master', 'agile', 'six sigma', 'lean'
    ];
    
    educationPatterns.forEach(edu => {
        if (text.includes(edu)) analysis.education.push(edu);
    });

    // Qualification patterns
    const qualificationPatterns = [
        'years experience', 'years of experience', 'experienced', 'expert', 'specialist',
        'professional', 'leadership experience', 'management experience',
        'team lead', 'project lead', 'technical lead', 'thought leader'
    ];
    
    qualificationPatterns.forEach(qual => {
        if (text.includes(qual)) analysis.qualifications.push(qual);
    });

    console.log('Enhanced skill extraction results:', {
        technical: analysis.technicalSkills.length,
        soft: analysis.softSkills.length,
        experience: analysis.workExperience.length,
        education: analysis.education.length,
        qualifications: analysis.qualifications.length,
        industries: analysis.industries.length,
        responsibilities: analysis.responsibilities.length,
        seniorityLevel: analysis.seniorityLevel
    });

    return analysis;
}

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
            console.error('OpenAI API key is not configured');
            return res.status(500).json({ error: 'AI analysis service is not configured. Please try again later.' });
        }
        
        const analysis = await analyzeResume(resumeText, getOpenAIClient());
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