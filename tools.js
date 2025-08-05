import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: './local.env' });

// Enhanced Resume Analysis Function with better role extraction
export async function analyzeResume(resumeText, openai) {
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
                seniorityLevel: analysis.seniorityLevel || 'unknown'
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
                seniorityLevel: analysis.seniorityLevel || fallbackAnalysis.seniorityLevel || 'mid'
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
        'healthcare', 'medical', 'pharmaceutical', 'biotech', 'clinical research',
        'education', 'academic', 'research', 'scientific research',
        'legal', 'compliance', 'regulatory', 'audit', 'risk management',
        'retail', 'e-commerce', 'supply chain', 'logistics', 'procurement'
    ];

    // Industry patterns
    const industryPatterns = [
        'technology', 'software', 'saas', 'fintech', 'healthtech', 'edtech',
        'healthcare', 'medical', 'pharmaceutical', 'biotechnology',
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

// Enhanced job scraping function - SEQUENTIAL PROCESSING WITH 70% THRESHOLD
export async function scrapeJobListings(analysis, filters, openai, onJobFound) {
    console.log('=== STARTING RESUME-DRIVEN JOB SEARCH ===');
    
    // Set a timeout for the entire job search process
    const searchTimeout = setTimeout(() => {
        console.error('❌ Job search timed out after 60 seconds');
        throw new Error('Job search timed out. Please try again.');
    }, 60000);
    console.log('Resume Analysis Summary:');
    console.log('- Technical Skills:', analysis.technicalSkills?.slice(0, 10) || []);
    console.log('- Work Experience:', analysis.workExperience?.slice(0, 5).map(exp => {
        if (typeof exp === 'string') return exp;
        if (exp && typeof exp === 'object' && exp.jobTitle) return exp.jobTitle;
        return JSON.stringify(exp);
    }) || []);
    console.log('- Industries:', analysis.industries?.slice(0, 3) || []);
    console.log('- Responsibilities:', analysis.responsibilities?.slice(0, 5) || []);
    console.log('- Seniority Level:', analysis.seniorityLevel || 'unknown');

    try {
        // Generate enhanced search queries
        const queries = generateEnhancedSearchQueries(analysis);
        console.log('\n📝 Enhanced Search Strategy:');
        console.log('Generated queries based on resume:', queries);

        const finalResults = [];
        const processedJobs = new Set(); // Track duplicates across all sources

        // Process each source SEQUENTIALLY with 70% threshold filtering
        const sources = [
            { name: 'Theirstack', func: searchTheirstackJobs },
            { name: 'Adzuna', func: searchAdzunaJobs },
            { name: 'TheMuse', func: searchTheMuseJobs },
            { name: 'Reed', func: searchReedJobs },
            { name: 'JSearch-RapidAPI', func: searchJSearchRapidAPI },
            { name: 'RapidAPI-Jobs', func: searchRapidAPIJobs }
        ];

        // Process each source individually
        for (const source of sources) {
            console.log(`\n🔍 === PROCESSING SOURCE: ${source.name} ===`);
            
            const sourceResults = [];
            
            // Process first 3 queries for this source
            for (let i = 0; i < Math.min(queries.length, 3); i++) {
                const query = queries[i];
                console.log(`   Query ${i + 1}: "${query}"`);

                try {
                    const jobs = await source.func(query, filters);
                    
                    if (jobs.length > 0) {
                        console.log(`   Raw jobs found: ${jobs.length}`);
                        
                        // Filter for remote jobs immediately
                        const remoteJobs = jobs.filter(job => isRemoteJob(job));
                        console.log(`   Remote jobs: ${remoteJobs.length}`);
                        
                        // Apply additional filters (salary, experience, timezone)
                        const filteredJobs = applyJobFilters(remoteJobs, filters);
                        console.log(`   After filter application: ${filteredJobs.length}`);
                        
                        if (filteredJobs.length > 0) {
                            sourceResults.push(...filteredJobs);
                        }
                    }
                } catch (error) {
                    console.error(`   ❌ ${source.name} failed for "${query}":`, error.message);
                }

                // Rate limiting between queries (reduced for faster processing)
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            if (sourceResults.length > 0) {
                console.log(`   Total jobs from ${source.name}: ${sourceResults.length}`);
                
                // Remove duplicates within this source
                const uniqueSourceJobs = removeDuplicateJobs(sourceResults);
                console.log(`   After deduplication: ${uniqueSourceJobs.length}`);
                
                // FILTER FOR 70%+ MATCHES IMMEDIATELY (maintains user-requested threshold)
                const highMatchJobs = await filterHighMatchJobs(uniqueSourceJobs, analysis, openai, processedJobs);
                console.log(`   Jobs with 70%+ match: ${highMatchJobs.length}`);
                
                if (highMatchJobs.length > 0) {
                    // Return ALL jobs with 70%+ match from this source (no limit)
                    console.log(`   Returning ${highMatchJobs.length} jobs from ${source.name}`);
                    
                    // Add to final results
                    finalResults.push(...highMatchJobs);
                    
                    // Send real-time update
                    if (onJobFound) {
                        onJobFound(highMatchJobs, `${source.name} (${highMatchJobs.length} matches)`);
                    }
                    
                    // Track these jobs to avoid duplicates from other sources
                    highMatchJobs.forEach(job => {
                        const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
                        processedJobs.add(key);
                    });
                }
            }

            // Rate limiting between sources (reduced for faster processing)
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n📊 === FINAL PROCESSING ===`);
        console.log(`Total 70%+ match jobs collected: ${finalResults.length}`);

        if (finalResults.length === 0) {
            throw new Error('No jobs found with 70% or higher match. The job market may be limited right now, or try updating your resume with more common job titles and skills that appear in job postings.');
        }

        // Final sort by match percentage
        const sortedJobs = finalResults.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

        console.log(`\n🎯 === SEARCH COMPLETED ===`);
        console.log(`Returning ${sortedJobs.length} quality matches from all sources`);
        console.log(`Top matches: ${sortedJobs.slice(0, 3).map(job => `${job.title} (${job.matchPercentage}%)`).join(' | ')}`);

        // Clear the timeout since we completed successfully
        clearTimeout(searchTimeout);
        
        // Return with pagination - only quality matches
        return {
            initialJobs: sortedJobs.slice(0, 12), // First 12 for immediate display
            remainingJobs: sortedJobs.slice(12),  // Rest for pagination
            totalJobs: sortedJobs.length
        };

    } catch (error) {
        // Clear the timeout on error
        clearTimeout(searchTimeout);
        console.error('❌ Job search error:', error);
        throw error;
    }
}

// Function to filter jobs with 70%+ match immediately
async function filterHighMatchJobs(jobs, analysis, openai, processedJobs) {
    const highMatchJobs = [];
    const batchSize = 5;
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job, index) => {
            if (!job || !job.title || !job.company) {
                return null;
            }
            
            const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
            if (processedJobs.has(key)) {
                return null;
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, index * 50));
                
                // Fast basic match first
                const basicMatch = calculateEnhancedBasicMatch(job, analysis);
                
                // Return only 70% or higher matches
                if (basicMatch >= 70) {
                    const enhancedMatch = await calculateSingleEnhancedJobMatch(job, analysis, openai);
                    const finalJob = { ...job, ...enhancedMatch };
                    
                    // Return only 70% or higher matches
                    if (finalJob.matchPercentage >= 70) {
                        return finalJob;
                    }
                } else if (basicMatch >= 75) {
                    // Use basic match if it's already very high
                    return {
                        ...job,
                        matchPercentage: basicMatch,
                        matchedTechnicalSkills: [],
                        matchedSoftSkills: [],
                        matchedExperience: [],
                        missingRequirements: [],
                        reasoning: 'High basic match - meets 70% threshold',
                        industryMatch: basicMatch,
                        seniorityMatch: basicMatch,
                        growthPotential: 'medium'
                    };
                }
                
                return null;

            } catch (error) {
                console.error(`Match calculation failed for "${job.title}":`, error.message);
                // FALLBACK: Only return if basic match is 70% or higher
                const basicMatch = calculateEnhancedBasicMatch(job, analysis);
                if (basicMatch >= 70) {
                    return {
                        ...job,
                        matchPercentage: basicMatch,
                        matchedTechnicalSkills: [],
                        matchedSoftSkills: [],
                        matchedExperience: [],
                        missingRequirements: [],
                        reasoning: 'AI analysis failed - using basic match above 70%',
                        industryMatch: basicMatch,
                        seniorityMatch: basicMatch,
                        growthPotential: 'medium'
                    };
                }
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(job => job !== null);
        highMatchJobs.push(...validResults);
        
        // No limit - return all 70%+ matches from this source
        if (i + batchSize < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    return highMatchJobs;
}

// Enhanced basic matching with better scoring
// FIXED: calculateEnhancedBasicMatch - Lower threshold and better scoring
function calculateEnhancedBasicMatch(job, analysis) {
    if (!job) return 0;
    
    const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    let score = 0;
    let totalWeight = 0;
    
    // Technical skills match (30% weight) - FIXED
    const techSkills = analysis.technicalSkills || [];
    if (techSkills.length > 0) {
        let matchedCount = 0;
        techSkills.forEach(skill => {
            let skillString = '';
            if (typeof skill === 'string') {
                skillString = skill;
            } else if (skill && typeof skill === 'object') {
                skillString = JSON.stringify(skill);
            } else {
                skillString = String(skill || '');
            }
            
            if (jobText.includes(skillString.toLowerCase())) {
                matchedCount++;
            }
        });
        
        const techScore = Math.min((matchedCount / techSkills.length) * 100, 100);
        score += techScore * 0.30;
        totalWeight += 0.30;
    }
    
    // Experience match (25% weight) - FIXED  
    const experience = analysis.workExperience || [];
    if (experience.length > 0) {
        let matchedCount = 0;
        experience.forEach(exp => {
            let expString = '';
            if (typeof exp === 'string') {
                expString = exp;
            } else if (exp && typeof exp === 'object') {
                if (exp.jobTitle) {
                    expString = exp.jobTitle;
                } else {
                    expString = JSON.stringify(exp);
                }
            } else {
                expString = String(exp || '');
            }
            
            // Look for role keywords in job text
            const roleKeywords = expString.toLowerCase().split(' ');
            if (roleKeywords.some(keyword => keyword.length > 2 && jobText.includes(keyword))) {
                matchedCount++;
            }
        });
        
        const expScore = Math.min((matchedCount / experience.length) * 100, 100);
        score += expScore * 0.25;
        totalWeight += 0.25;
    }
    
    // Industry match (20% weight) - FIXED
    const industries = analysis.industries || [];
    if (industries.length > 0) {
        let hasIndustryMatch = false;
        industries.forEach(industry => {
            let industryString = '';
            if (typeof industry === 'string') {
                industryString = industry;
            } else if (industry && typeof industry === 'object') {
                industryString = JSON.stringify(industry);
            } else {
                industryString = String(industry || '');
            }
            
            if (jobText.includes(industryString.toLowerCase())) {
                hasIndustryMatch = true;
            }
        });
        
        const industryScore = hasIndustryMatch ? 100 : 0;
        score += industryScore * 0.20;
        totalWeight += 0.20;
    }
    
    // Responsibility match (15% weight) - FIXED
    const responsibilities = analysis.responsibilities || [];
    if (responsibilities.length > 0) {
        let matchedCount = 0;
        responsibilities.forEach(resp => {
            let respString = '';
            if (typeof resp === 'string') {
                respString = resp;
            } else if (resp && typeof resp === 'object') {
                respString = JSON.stringify(resp);
            } else {
                respString = String(resp || '');
            }
            
            // Look for key responsibility words
            const respWords = respString.toLowerCase().split(' ').filter(word => word.length > 3);
            if (respWords.some(word => jobText.includes(word))) {
                matchedCount++;
            }
        });
        
        const respScore = Math.min((matchedCount / responsibilities.length) * 100, 100);
        score += respScore * 0.15;
        totalWeight += 0.15;
    }
    
    // Base score for any match (10% weight)
    const baseScore = jobText.length > 10 ? 50 : 0; // Give some base score if job has content
    score += baseScore * 0.10;
    totalWeight += 0.10;
    
    // Normalize score based on available factors
    const finalScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;
    
    // Return the calculated score without artificial minimum (maintains 70%+ threshold requirement)
    return Math.min(finalScore, 95);
}

// Enhanced search query generation
// FIXED: generateEnhancedSearchQueries - Handle object vs string work experience
function generateEnhancedSearchQueries(analysis) {
    const queries = [];

    // Primary: Work Experience-based queries - FIXED
    if (analysis.workExperience && analysis.workExperience.length > 0) {
        analysis.workExperience.slice(0, 8).forEach(exp => {
            // FIXED: Handle both object and string cases properly
            let expString = '';
            if (typeof exp === 'string') {
                expString = exp;
            } else if (exp && typeof exp === 'object') {
                // Extract meaningful text from object
                if (exp.jobTitle) {
                    expString = exp.jobTitle;
                } else if (exp.title) {
                    expString = exp.title;
                } else if (exp.role) {
                    expString = exp.role;
    } else {
                    expString = JSON.stringify(exp);
                }
            } else {
                expString = String(exp || '');
            }
            
            const expLower = expString.toLowerCase();
            
            // Map common variations
            const roleMap = {
                'software engineer': ['remote software engineer', 'remote developer', 'remote backend engineer'],
                'software developer': ['remote software developer', 'remote developer', 'remote engineer'],
                'data scientist': ['remote data scientist', 'remote data analyst', 'remote analytics'],
                'product manager': ['remote product manager', 'remote pm', 'remote product'],
                'marketing manager': ['remote marketing manager', 'remote marketing', 'remote digital marketing'],
                'project manager': ['remote project manager', 'remote pm', 'remote program manager'],
                'business analyst': ['remote business analyst', 'remote analyst', 'remote ba'],
                'ux designer': ['remote ux designer', 'remote designer', 'remote product designer'],
                'sales manager': ['remote sales manager', 'remote sales', 'remote account manager'],
                'customer success': ['remote customer success', 'remote cs', 'remote account management'],
                'devops engineer': ['remote devops', 'remote infrastructure', 'remote cloud engineer'],
                'frontend developer': ['remote frontend', 'remote ui developer', 'remote react developer'],
                'backend developer': ['remote backend', 'remote api developer', 'remote server developer'],
                'full stack': ['remote fullstack', 'remote full-stack', 'remote web developer'],
                'head of product': ['remote head of product', 'remote product director', 'remote vp product'],
                'technical lead': ['remote technical lead', 'remote tech lead', 'remote engineering lead'],
                'ai engineer': ['remote ai engineer', 'remote machine learning', 'remote ml engineer']
            };

            Object.keys(roleMap).forEach(role => {
                if (expLower.includes(role)) {
                    queries.push(...roleMap[role]);
                }
            });

            // Generic role-based queries
            if (expLower.includes('manager')) queries.push('remote manager');
            if (expLower.includes('engineer')) queries.push('remote engineer');
            if (expLower.includes('developer')) queries.push('remote developer');
            if (expLower.includes('analyst')) queries.push('remote analyst');
            if (expLower.includes('designer')) queries.push('remote designer');
            if (expLower.includes('consultant')) queries.push('remote consultant');
            if (expLower.includes('lead')) queries.push('remote lead');
            if (expLower.includes('director')) queries.push('remote director');
            if (expLower.includes('head of')) queries.push('remote head of');
        });
    }

    // Secondary: Responsibility-based queries - FIXED
    if (analysis.responsibilities && analysis.responsibilities.length > 0) {
        const responsibilityToRole = {
            'developed': 'remote developer',
            'managed': 'remote manager',
            'designed': 'remote designer',
            'analyzed': 'remote analyst',
            'led': 'remote lead',
            'coordinated': 'remote coordinator',
            'implemented': 'remote implementation specialist',
            'optimized': 'remote optimization specialist',
            'architected': 'remote architect',
            'built': 'remote developer'
        };

        analysis.responsibilities.slice(0, 5).forEach(resp => {
            // FIXED: Handle both string and object cases
            let respString = '';
            if (typeof resp === 'string') {
                respString = resp;
            } else if (resp && typeof resp === 'object') {
                respString = JSON.stringify(resp);
            } else {
                respString = String(resp || '');
            }
            
            const respLower = respString.toLowerCase();
            Object.keys(responsibilityToRole).forEach(key => {
                if (respLower.includes(key)) {
                    queries.push(responsibilityToRole[key]);
                }
            });
        });
    }

    // Tertiary: Technical Skills-based queries - FIXED
    if (analysis.technicalSkills && analysis.technicalSkills.length > 0) {
        const topSkills = analysis.technicalSkills.slice(0, 5);
        topSkills.forEach(skill => {
            // FIXED: Handle both string and object cases
            let skillString = '';
            if (typeof skill === 'string') {
                skillString = skill;
            } else if (skill && typeof skill === 'object') {
                skillString = JSON.stringify(skill);
            } else {
                skillString = String(skill || '');
            }
            
            const skillLower = skillString.toLowerCase();
            
            const skillToRole = {
                'javascript': 'remote javascript developer',
                'python': 'remote python developer',
                'react': 'remote react developer',
                'node.js': 'remote nodejs developer',
                'aws': 'remote cloud engineer',
                'sql': 'remote data analyst',
                'tableau': 'remote data analyst',
                'salesforce': 'remote salesforce admin',
                'figma': 'remote ux designer',
                'photoshop': 'remote graphic designer',
                'typescript': 'remote typescript developer',
                'postgresql': 'remote database developer',
                'mongodb': 'remote database developer',
                'docker': 'remote devops engineer',
                'kubernetes': 'remote devops engineer'
            };

            if (skillToRole[skillLower]) {
                queries.push(skillToRole[skillLower]);
            }
        });
    }

    // Quaternary: Industry-based queries - FIXED
    if (analysis.industries && analysis.industries.length > 0) {
        analysis.industries.slice(0, 3).forEach(industry => {
            // FIXED: Handle both string and object cases
            let industryString = '';
            if (typeof industry === 'string') {
                industryString = industry;
            } else if (industry && typeof industry === 'object') {
                industryString = JSON.stringify(industry);
            } else {
                industryString = String(industry || '');
            }
            queries.push(`remote ${industryString.toLowerCase()}`);
        });
    }

    // Fallback queries based on seniority
    if (queries.length < 3) {
        const seniorityQueries = {
            'entry': ['remote entry level', 'remote junior', 'remote associate'],
            'mid': ['remote specialist', 'remote professional', 'remote coordinator'],
            'senior': ['remote senior', 'remote lead', 'remote principal'],
            'lead': ['remote manager', 'remote lead', 'remote director'],
            'executive': ['remote director', 'remote vp', 'remote executive']
        };

        const level = analysis.seniorityLevel || 'mid';
        if (seniorityQueries[level]) {
            queries.push(...seniorityQueries[level]);
        }
    }

    // Remove duplicates and limit
    const uniqueQueries = [...new Set(queries)].slice(0, 12);
    console.log('Enhanced queries generated:', uniqueQueries);
    
    return uniqueQueries;
}

// FIXED: isRemoteJob function - Handle undefined values
function isRemoteJob(job) {
    if (!job) return false;
    
    // FIXED: Safely handle potentially undefined properties
    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase(); 
    const location = (job.location || '').toLowerCase();
    
    const allText = `${title} ${description} ${location}`;
    
    // Must have remote indicators
    const remoteKeywords = ['remote', 'work from home', 'wfh', 'telecommute', 'distributed', 'anywhere'];
    const hasRemote = remoteKeywords.some(keyword => allText.includes(keyword)) || 
                     location.includes('remote');
    
    // Must NOT have non-remote exclusions
    const nonRemoteKeywords = ['on-site', 'onsite', 'office required', 'relocation required', 'hybrid'];
    const hasNonRemote = nonRemoteKeywords.some(keyword => allText.includes(keyword));
    
    return hasRemote && !hasNonRemote;
}

// THEIRSTACK API - Enhanced for remote jobs
async function searchTheirstackJobs(query, filters) {
    const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
    
    if (!THEIRSTACK_API_KEY) {
        console.log('❌ Theirstack credentials missing');
        return [];
    }

    try {
        console.log('🔍 Theirstack: Making API request...');
        
        const response = await axios.get('https://api.theirstack.com/v1/jobs', {
            params: {
                query: query,
                remote: true,
                limit: 50
            },
            headers: {
                'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`✅ Theirstack API responded with ${response.data?.data?.length || 0} jobs`);

        if (!response.data?.data) {
            return [];
        }

        return response.data.data.map(job => {
            // Enhanced salary handling
            let salary = formatSalary(job.salary_min, job.salary_max);
            if (salary === 'Salary not specified') {
                salary = extractSalaryFromDescription(job.description);
            }
            
            return {
                title: job.title,
                company: job.company?.name || 'Unknown Company',
                location: job.location || 'Remote',
                link: job.url,
                source: 'Theirstack',
                description: job.description || '',
                salary: salary,
                type: job.employment_type || 'Full-time',
                datePosted: job.posted_at || new Date().toISOString()
            };
        });
        
    } catch (error) {
        console.error('❌ Theirstack error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return [];
    }
}

// ADZUNA API - Enhanced for remote jobs
async function searchAdzunaJobs(query, filters) {
        const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
        const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;
        
        if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
        console.log('❌ Adzuna credentials missing');
        return [];
    }

    try {
        console.log('🔍 Adzuna: Making API request...');
        
        const response = await axios.get('https://api.adzuna.com/v1/api/jobs/us/search/1', {
                    params: {
                        app_id: ADZUNA_APP_ID,
                        app_key: ADZUNA_API_KEY,
                        what: query,
                        where: 'remote',
                results_per_page: 30,
                sort_by: 'relevance'
            },
            timeout: 15000
        });

        console.log(`✅ Adzuna API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            return [];
        }

        return response.data.results.map(job => {
            // Enhanced salary handling
            let salary = formatSalary(job.salary_min, job.salary_max);
            if (salary === 'Salary not specified') {
                salary = extractSalaryFromDescription(job.description);
            }
            
            return {
                            title: job.title,
                            company: job.company?.display_name || 'Unknown Company',
                            location: job.location?.display_name || 'Remote',
                            link: job.redirect_url,
                            source: 'Adzuna',
                            description: job.description || '',
                salary: salary,
                            type: job.contract_time || 'Full-time',
                            datePosted: job.created || new Date().toISOString()
            };
        });
        
    } catch (error) {
        console.error('❌ Adzuna error:', error.message);
        return [];
    }
}

// THEMUSE API - Enhanced for remote jobs
async function searchTheMuseJobs(query, filters) {
        const THEMUSE_API_KEY = process.env.THEMUSE_API_KEY;
        
        if (!THEMUSE_API_KEY) {
        console.log('❌ TheMuse credentials missing');
        return [];
        }
        
    try {
        console.log('🔍 TheMuse: Making API request...');
        
        const response = await axios.get('https://www.themuse.com/api/public/jobs', {
            params: {
                api_key: THEMUSE_API_KEY,
                page: 0,
                limit: 30,
                location: 'Remote',
                level: filters.experience || undefined
            },
            timeout: 15000
        });

        console.log(`✅ TheMuse API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            return [];
        }

        // Enhanced relevance filtering
        const relevantJobs = response.data.results.filter(job => {
                const jobText = `${job.name} ${job.contents || ''}`.toLowerCase();
            const queryWords = query.toLowerCase().split(' ').filter(word => word !== 'remote');
            
            // More sophisticated matching
            if (queryWords.length === 0) return true;
            
            return queryWords.some(word => {
                if (word.length < 3) return false;
                // Check for partial matches and synonyms
                return jobText.includes(word) || 
                       (word === 'developer' && jobText.includes('engineer')) ||
                       (word === 'engineer' && jobText.includes('developer')) ||
                       (word === 'manager' && jobText.includes('lead')) ||
                       (word === 'analyst' && jobText.includes('analytics'));
            });
        });

        console.log(`✅ TheMuse: ${relevantJobs.length} jobs matched query "${query}"`);

        return relevantJobs.map(job => ({
                    title: job.name,
                    company: job.company?.name || 'Unknown Company',
                    location: job.locations?.[0]?.name || 'Remote',
                    link: job.refs?.landing_page,
                    source: 'TheMuse',
                    description: job.contents || '',
                    salary: 'Salary not specified',
                    type: job.type || 'Full-time',
                    datePosted: job.publication_date || new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ TheMuse error:', error.message);
        return [];
    }
}

// FIXED: JSearch RapidAPI function with proper error handling
async function searchJSearchRapidAPI(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

    if (!RAPIDAPI_KEY) {
        console.log('❌ RapidAPI credentials missing for JSearch');
        return [];
    }

    try {
        console.log('🔍 JSearch-RapidAPI: Making API request...');
        
        const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
                params: {
                query: query,
                page: '1',
                num_pages: '1',
                date_posted: 'all',
                remote_jobs_only: 'true'
            },
                headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            },
            timeout: 15000
        });

        console.log(`✅ JSearch-RapidAPI responded with ${response.data?.data?.length || 0} jobs`);

        if (!response.data?.data) {
            return [];
        }

        return response.data.data
            .filter(job => {
                // FIXED: Safely check if job exists and has required properties
                if (!job || !job.job_title || !job.employer_name) {
                    return false;
                }
                try {
                    return isRemoteJob({
                        title: job.job_title || '',
                        description: job.job_description || '',
                        location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country}` : 'Remote'
                    });
                } catch (filterError) {
                    console.warn('Error filtering JSearch job:', filterError.message);
                    return false;
                }
            })
            .map(job => {
                try {
                    // FIXED: Enhanced salary handling for JSearch with safety checks
                    let salary = 'Salary not specified';
                    try {
                        if (job.job_min_salary || job.job_max_salary) {
                            salary = formatRapidAPISalary(job.job_min_salary, job.job_max_salary);
                        }
                        if (salary === 'Salary not specified' && job.job_description) {
                            salary = extractSalaryFromDescription(job.job_description);
                        }
                    } catch (salaryError) {
                        console.warn('Salary parsing error for JSearch job:', salaryError.message);
                        salary = 'Salary not specified';
                    }
                    
                    return {
                        title: job.job_title || 'Job Title Not Available',
                        company: job.employer_name || 'Unknown Company', 
                        location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country || ''}`.trim() : 'Remote',
                        link: job.job_apply_link || job.job_url || '#',
                        source: 'JSearch-RapidAPI',
                        description: job.job_description || '',
                        salary: salary,
                        type: job.job_employment_type || 'Full-time',
                        datePosted: job.job_posted_at_datetime_utc || new Date().toISOString()
                    };
                } catch (mapError) {
                    console.warn('Error mapping JSearch job:', mapError.message);
                    return null;
                }
            })
            .filter(job => job !== null); // Remove any null jobs from mapping errors

    } catch (error) {
        console.error('❌ JSearch-RapidAPI error:', error.message);
        return [];
    }
}

// RAPIDAPI JOBS API - Alternative job aggregator
async function searchRapidAPIJobs(query, filters) {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

    if (!RAPIDAPI_KEY) {
        console.log('❌ RapidAPI credentials missing for Jobs API');
        return [];
    }

    try {
        console.log('🔍 RapidAPI-Jobs: Making API request...');
        
        const response = await axios.get('https://jobs-api14.p.rapidapi.com/list', {
            params: {
                query: query,
                location: 'Remote',
                distance: '1.0',
                language: 'en_GB',
                remoteOnly: 'true',
                datePosted: 'month',
                jobType: 'fulltime',
                index: '0'
            },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jobs-api14.p.rapidapi.com'
            },
            timeout: 15000
        });

        console.log(`✅ RapidAPI-Jobs responded with ${response.data?.jobs?.length || 0} jobs`);

        if (!response.data?.jobs) {
            return [];
        }

        return response.data.jobs
            .filter(job => isRemoteJob(job)) // Double-check remote status
            .map(job => {
                // Enhanced salary handling for RapidAPI-Jobs
                let salary = job.salary || 'Salary not specified';
                if (salary === 'Salary not specified') {
                    salary = extractSalaryFromDescription(job.description);
                }
                
                return {
                    title: job.title,
                    company: job.company || 'Unknown Company',
                    location: job.location || 'Remote',
                    link: job.url,
                    source: 'RapidAPI-Jobs',
                    description: job.description || '',
                    salary: salary,
                    type: job.jobType || 'Full-time',
                    datePosted: job.datePosted || new Date().toISOString()
                };
            });

    } catch (error) {
        console.error('❌ RapidAPI-Jobs error:', error.message);
        return [];
    }
}

// REED API - Real API integration only
async function searchReedJobs(query, filters) {
    const REED_API_KEY = process.env.REED_API_KEY;

    if (!REED_API_KEY) {
        console.log('❌ Reed credentials missing');
        return [];
    }

    try {
        console.log('🔍 Reed: Making API request...');

        const response = await axios.get('https://www.reed.co.uk/api/1.0/search', {
            params: {
                keywords: query,
                locationName: 'Remote',
                resultsToTake: 30,
                resultsToSkip: 0
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(REED_API_KEY + ':').toString('base64')}`
            },
            timeout: 15000
        });

        console.log(`✅ Reed API responded with ${response.data?.results?.length || 0} jobs`);

        if (!response.data?.results) {
            return [];
        }

        return response.data.results.map(job => ({
            title: job.jobTitle,
            company: job.employerName || 'Unknown Company',
            location: job.locationName || 'Remote',
            link: job.jobUrl,
            source: 'Reed',
            description: job.jobDescription || '',
            salary: job.minimumSalary && job.maximumSalary ? 
                    `£${job.minimumSalary.toLocaleString()} - £${job.maximumSalary.toLocaleString()}` : 
                    'Salary not specified',
            type: job.contractType || 'Full-time',
            datePosted: job.date || new Date().toISOString()
        }));

    } catch (error) {
        console.error('❌ Reed error:', error.message);
        return [];
    }
}

// Remove duplicate jobs
function removeDuplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
        const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Enhanced job matching calculation - NO FAKE RESULTS EVER
async function calculateEnhancedJobMatches(jobs, analysis, openai) {
    const matchedJobs = [];
    
    // Process jobs in batches to avoid rate limits - ALL REAL DATA
    const batchSize = 5;
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job, index) => {
            try {
                // Add delay based on index to stagger requests
                await new Promise(resolve => setTimeout(resolve, index * 200));
                
                const matchData = await calculateSingleEnhancedJobMatch(job, analysis, openai);
                return { ...job, ...matchData };
                
            } catch (error) {
                console.error(`Enhanced match calculation failed for "${job.title}":`, error.message);
                // Return original job with basic match - NO FAKE DATA
                return {
                    ...job,
                    matchPercentage: calculateBasicMatch(job, analysis),
                    matchedSkills: [],
                    reasoning: 'AI analysis failed - using basic matching on real job data'
                };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        matchedJobs.push(...batchResults);
        
        // Delay between batches
        if (i + batchSize < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return matchedJobs;
}

// Enhanced single job match calculation
async function calculateSingleEnhancedJobMatch(job, analysis, openai) {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: `Analyze this job match comprehensively. Consider not just exact skill matches, but role compatibility, industry fit, and growth potential.

Job: ${job.title} at ${job.company}
Description: ${job.description.substring(0, 800)}

Candidate Profile:
- Technical Skills: ${analysis.technicalSkills?.slice(0, 15).join(', ') || 'None'}
- Work Experience: ${analysis.workExperience?.slice(0, 8).join(', ') || 'None'}
- Industries: ${analysis.industries?.slice(0, 5).join(', ') || 'None'}
- Responsibilities: ${analysis.responsibilities?.slice(0, 8).join(', ') || 'None'}
- Seniority Level: ${analysis.seniorityLevel || 'Unknown'}

Return ONLY JSON:
{
  "matchPercentage": number (0-100),
  "matchedTechnicalSkills": ["skill1", "skill2"],
  "matchedSoftSkills": ["skill1", "skill2"],
  "matchedExperience": ["exp1", "exp2"],
  "missingRequirements": ["req1", "req2"],
  "reasoning": "brief explanation focusing on why this is/isn't a good match",
  "industryMatch": number (0-100),
  "seniorityMatch": number (0-100),
  "growthPotential": "low|medium|high"
}`
        }],
        temperature: 0.1,
        max_tokens: 500
    });

    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            matchPercentage: parsed.matchPercentage || 0,
            matchedTechnicalSkills: parsed.matchedTechnicalSkills || [],
            matchedSoftSkills: parsed.matchedSoftSkills || [],
            matchedExperience: parsed.matchedExperience || [],
            missingRequirements: parsed.missingRequirements || [],
            reasoning: parsed.reasoning || 'No reasoning provided',
            industryMatch: parsed.industryMatch || 0,
            seniorityMatch: parsed.seniorityMatch || 0,
            growthPotential: parsed.growthPotential || 'medium'
        };
    } else {
        throw new Error('No valid JSON found in AI response');
    }
}

// Enhanced basic fallback matching - NO DUMMY DATA, ONLY REAL API RESULTS
function calculateBasicMatch(job, analysis) {
    // Use the enhanced basic matching function
    return calculateEnhancedBasicMatch(job, analysis);
}

// Enhanced salary parsing and formatting functions

// Utility function for better salary formatting
function formatSalary(min, max) {
    if (min && max) {
        // Format both values consistently
        const minFormatted = min >= 1000 ? `${Math.round(min/1000)}k` : min.toLocaleString();
        const maxFormatted = max >= 1000 ? `${Math.round(max/1000)}k` : max.toLocaleString();
        return `$${minFormatted} - $${maxFormatted}`;
    } else if (min) {
        const minFormatted = min >= 1000 ? `${Math.round(min/1000)}k` : min.toLocaleString();
        return `From $${minFormatted}`;
    } else if (max) {
        const maxFormatted = max >= 1000 ? `${Math.round(max/1000)}k` : max.toLocaleString();
        return `Up to $${maxFormatted}`;
    }
    return 'Salary not specified';
}

// FIXED: Enhanced RapidAPI salary formatting with safety checks
function formatRapidAPISalary(minSalary, maxSalary) {
    let min = null, max = null;
    
    try {
        if (typeof minSalary === 'number' && minSalary > 0) {
            min = minSalary;
        } else if (typeof minSalary === 'string' && minSalary.trim()) {
            const parsed = parseFloat(minSalary.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
                min = parsed;
            }
        }
        
        if (typeof maxSalary === 'number' && maxSalary > 0) {
            max = maxSalary;
        } else if (typeof maxSalary === 'string' && maxSalary.trim()) {
            const parsed = parseFloat(maxSalary.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
                max = parsed;
            }
        }
    } catch (error) {
        console.warn('Error parsing salary values:', error.message);
        return 'Salary not specified';
    }
    
    return formatSalary(min, max);
}

// Enhanced salary extraction from job descriptions
function extractSalaryFromDescription(description) {
    if (!description) return 'Salary not specified';
    
    const text = description.toLowerCase();
    
    // Common salary patterns
    const patterns = [
        // $50k - $75k, $50,000 - $75,000
        /\$(\d+)(?:k|,000)\s*[-–to]\s*\$?(\d+)(?:k|,000)/i,
        // $50k+, $50,000+
        /\$(\d+)(?:k|,000)\+/i,
        // From $50k, Starting at $50k
        /(?:from|starting\s+at)\s+\$(\d+)(?:k|,000)/i,
        // Up to $75k
        /up\s+to\s+\$(\d+)(?:k|,000)/i,
        // Salary: $50k
        /salary:?\s*\$(\d+)(?:k|,000)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) {
                // Range found
                let min = parseInt(match[1]);
                let max = parseInt(match[2]);
                
                // Convert k to thousands if needed
                if (text.includes('k') || (min < 1000 && max < 1000)) {
                    min *= 1000;
                    max *= 1000;
                }
                
                return formatSalary(min, max);
            } else {
                // Single value found
                let value = parseInt(match[1]);
                if (text.includes('k') || value < 1000) {
                    value *= 1000;
                }
                
                if (text.includes('from') || text.includes('starting')) {
                    return formatSalary(value, null);
                } else if (text.includes('up to')) {
                    return formatSalary(null, value);
                } else if (text.includes('+')) {
                    return formatSalary(value, null);
                } else {
                    return formatSalary(value, value);
                }
            }
        }
    }
    
    return 'Salary not specified';
}

// NEW: Apply job filters (salary, experience, timezone)
function applyJobFilters(jobs, filters) {
    if (!filters || Object.keys(filters).length === 0) {
    return jobs;
}

    console.log('🔍 Applying filters:', filters);
    let filteredJobs = [...jobs];

    // Apply salary filter
    if (filters.salary && filters.salary !== '') {
        const salaryThreshold = getSalaryThreshold(filters.salary);
        if (salaryThreshold > 0) {
            filteredJobs = filteredJobs.filter(job => {
                const salaryNumbers = extractSalaryNumbersFromString(job.salary);
                return salaryNumbers.min >= salaryThreshold || salaryNumbers.max >= salaryThreshold;
            });
            console.log(`   Salary filter (${filters.salary}): ${filteredJobs.length} jobs remaining`);
        }
    }

    // Apply experience filter
    if (filters.experience && filters.experience !== '') {
        filteredJobs = filteredJobs.filter(job => {
            const title = job.title.toLowerCase();
            const description = (job.description || '').toLowerCase();
            
            if (filters.experience === 'entry') {
                return title.includes('junior') || title.includes('entry') || title.includes('associate') || 
                       description.includes('entry level') || description.includes('junior') ||
                       title.includes('intern') || description.includes('0-2 years');
            } else if (filters.experience === 'mid') {
                return !title.includes('senior') && !title.includes('lead') && !title.includes('principal') &&
                       !title.includes('junior') && !title.includes('entry') && !title.includes('director') &&
                       (description.includes('2-5 years') || description.includes('3-6 years') || 
                        (!description.includes('senior') && !description.includes('lead')));
            } else if (filters.experience === 'senior') {
                return title.includes('senior') || title.includes('lead') || title.includes('principal') ||
                       description.includes('senior') || description.includes('5+ years') || 
                       description.includes('6+ years') || description.includes('7+ years');
            } else if (filters.experience === 'lead') {
                return title.includes('lead') || title.includes('manager') || title.includes('principal') || 
                       title.includes('architect') || title.includes('director') || title.includes('head of') ||
                       description.includes('leadership') || description.includes('management');
            }
            return true;
        });
        console.log(`   Experience filter (${filters.experience}): ${filteredJobs.length} jobs remaining`);
    }

    // Apply timezone filter
    if (filters.timezone && filters.timezone !== '') {
        filteredJobs = filteredJobs.filter(job => {
            const description = (job.description || '').toLowerCase();
            const title = job.title.toLowerCase();
            const location = (job.location || '').toLowerCase();
            
            if (filters.timezone === 'us-only') {
                return description.includes('us') || description.includes('united states') || 
                       description.includes('usa') || location.includes('us') || 
                       description.includes('est') || description.includes('pst') || 
                       description.includes('cst') || description.includes('mst') ||
                       description.includes('eastern') || description.includes('pacific') ||
                       description.includes('central') || description.includes('mountain');
            } else if (filters.timezone === 'global') {
                return description.includes('global') || description.includes('worldwide') || 
                       description.includes('international') || description.includes('any timezone') ||
                       description.includes('flexible timezone');
            } else if (filters.timezone === 'europe') {
                return description.includes('europe') || description.includes('eu') || 
                       description.includes('cet') || description.includes('gmt') ||
                       description.includes('utc') || location.includes('europe');
            }
            return true;
        });
        console.log(`   Timezone filter (${filters.timezone}): ${filteredJobs.length} jobs remaining`);
    }

    return filteredJobs;
}

// Helper function to get salary threshold from filter string
function getSalaryThreshold(salaryFilter) {
    const thresholds = {
        '50k': 50000,
        '75k': 75000,
        '100k': 100000,
        '125k': 125000,
        '150k': 150000,
        '150000+': 150000
    };
    return thresholds[salaryFilter] || 0;
}

// Helper function to extract salary numbers from salary string
function extractSalaryNumbersFromString(salaryStr) {
    const salary = salaryStr.toLowerCase();
    let min = 0, max = 0;
    
    // Remove common currency symbols and text
    const cleanSalary = salary.replace(/[$£€,]/g, '');
    
    // Look for salary patterns
    const rangeMatch = cleanSalary.match(/(\d+)(?:k|,000)?\s*[-–to]\s*(\d+)(?:k|,000)?/);
    const singleMatch = cleanSalary.match(/(\d+)(?:k|,000)?/);
    const fromMatch = cleanSalary.match(/from\s+(\d+)(?:k|,000)?/);
    const upToMatch = cleanSalary.match(/up\s+to\s+(\d+)(?:k|,000)?/);
    
    if (rangeMatch) {
        // Range: "50k - 75k" or "50,000 - 75,000"
        min = parseInt(rangeMatch[1]);
        max = parseInt(rangeMatch[2]);
        
        // Handle k notation
        if (salary.includes('k') || min < 1000) {
            min *= 1000;
            max *= 1000;
        }
    } else if (fromMatch) {
        // "From 50k"
        min = parseInt(fromMatch[1]);
        if (salary.includes('k') || min < 1000) {
            min *= 1000;
        }
        max = min; // Use same value for comparison
    } else if (upToMatch) {
        // "Up to 75k"
        max = parseInt(upToMatch[1]);
        if (salary.includes('k') || max < 1000) {
            max *= 1000;
        }
        min = max; // Use same value for comparison
    } else if (singleMatch) {
        // Single number "50k" or "50000"
        const num = parseInt(singleMatch[1]);
        if (salary.includes('k') || num < 1000) {
            min = max = num * 1000;
        } else {
            min = max = num;
        }
    }
    
    return { min, max };
}