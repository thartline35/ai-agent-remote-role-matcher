// Frontend.js - FIXED VERSION
class AIJobMatcher {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.initializeLazyLoading();
        this.currentFile = null;
        this.resumeAnalysis = {
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
        this.jobResults = [];
        this.totalJobs = 0;
        this.displayedJobsCount = 0;
        this.currentFilteredJobs = [];
        this.searchProgress = 0;
        this.sourcesCompleted = 0;
        this.totalSources = 6;
        this.savedJobs = this.loadSavedJobs();
        this.updateSavedCount();
        
        // FIXED: Add tracking for intermediate results without updating UI
        this.tempJobResults = [];
        this.searchInProgress = false;
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('upload-area');
        this.resumeFile = document.getElementById('resume-file');
        this.uploadPrompt = document.getElementById('upload-prompt');
        this.fileInfo = document.getElementById('file-info');
        this.fileName = document.getElementById('file-name');
        this.fileSize = document.getElementById('file-size');
        this.removeFile = document.getElementById('remove-file');
        this.analyzeResumeBtn = document.getElementById('analyze-resume');

        // Analysis elements
        this.analysisSection = document.getElementById('analysis-section');
        this.skillsGrid = document.getElementById('skills-grid');

        // Search elements
        this.searchSection = document.getElementById('search-section');
        this.experienceFilter = document.getElementById('experience-filter');
        this.salaryFilter = document.getElementById('salary-filter');
        this.timezoneFilter = document.getElementById('timezone-filter');
        this.startSearchBtn = document.getElementById('start-search');

        // Loading elements
        this.loadingSection = document.getElementById('loading-section');
        this.loadingMessage = document.getElementById('loading-message');
        this.progressFill = document.getElementById('progress-fill');

        // Results elements
        this.resultsSection = document.getElementById('results-section');
        this.totalJobsElement = document.getElementById('total-jobs');
        this.matchPercentage = document.getElementById('match-percentage');
        this.filterChips = document.getElementById('filter-chips');
        this.clearFilters = document.getElementById('clear-filters');
        this.jobsGrid = document.getElementById('jobs-grid');
        this.loadMore = document.getElementById('load-more');
        
        // Scraping status elements
        this.scrapingStatus = document.getElementById('scraping-status');
        this.scrapingSources = document.getElementById('scraping-sources');
        this.scrapingCount = document.getElementById('scraping-count');
        this.apiHealth = document.getElementById('api-health');
        this.scraperHealth = document.getElementById('scraper-health');
        this.userMessages = document.getElementById('user-messages');

        // Error elements
        this.errorSection = document.getElementById('error-section');
        this.errorMessage = document.getElementById('error-message');
    }

    /**
     * Initialize lazy loading
     */
    initializeLazyLoading() {
        // Initialize lazy loader
        if (typeof lazyLoader !== 'undefined') {
            lazyLoader.init();
            console.log('🔄 Lazy loading initialized');
        }
    }

    bindEvents() {
        // File upload events
        if (this.uploadArea) this.uploadArea.addEventListener('click', () => this.resumeFile.click());
        if (this.uploadArea) this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        if (this.uploadArea) this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        if (this.uploadArea) this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        if (this.resumeFile) this.resumeFile.addEventListener('change', (e) => this.handleFileSelect(e));
        if (this.removeFile) this.removeFile.addEventListener('click', () => this.removeCurrentFile());

        // Analysis and search events
        if (this.analyzeResumeBtn) this.analyzeResumeBtn.addEventListener('click', () => this.analyzeResume());
        if (this.startSearchBtn) this.startSearchBtn.addEventListener('click', () => this.startJobSearch());
        if (this.clearFilters) this.clearFilters.addEventListener('click', () => this.clearAllFilters());

        // Filter change events
        if (this.experienceFilter) this.experienceFilter.addEventListener('change', () => this.applyFilters());
        if (this.salaryFilter) this.salaryFilter.addEventListener('change', () => this.applyFilters());
        if (this.timezoneFilter) this.timezoneFilter.addEventListener('change', () => this.applyFilters());

        // Load more functionality
        if (this.loadMore) this.loadMore.addEventListener('click', () => this.loadMoreJobs());
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.style.borderColor = '#764ba2';
        this.uploadArea.style.background = 'rgba(102, 126, 234, 0.1)';
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.style.borderColor = '#667eea';
        this.uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.style.borderColor = '#667eea';
        this.uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('Please upload a PDF, DOC, DOCX, or TXT file.');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('File size must be less than 5MB.');
            return;
        }

        this.currentFile = file;
        this.displayFileInfo(file);
        this.analyzeResumeBtn.disabled = false;
    }

    displayFileInfo(file) {
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.uploadPrompt.style.display = 'none';
        this.fileInfo.style.display = 'flex';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeCurrentFile() {
        this.currentFile = null;
        this.resumeFile.value = '';
        this.uploadPrompt.style.display = 'block';
        this.fileInfo.style.display = 'none';
        this.analyzeResumeBtn.disabled = true;
        this.hideAnalysisSection();
    }

    async analyzeResume() {
        if (!this.currentFile) return;

        try {
            this.showLoading(true, 'Analyzing your resume comprehensively...');
            this.hideError();

            let resumeText;

            // Handle different file types
            if (this.currentFile.type === 'application/pdf') {
                // For PDF files, send to backend for parsing first
                const formData = new FormData();
                formData.append('resume', this.currentFile);
                
                const parseResponse = await fetch('/api/parse-pdf', {
                    method: 'POST',
                    body: formData
                });
                
                if (!parseResponse.ok) {
                    throw new Error('Failed to parse PDF');
                }
                
                const parseResult = await parseResponse.json();
                resumeText = parseResult.text;
            } else {
                // For other file types, read directly
                resumeText = await this.readFileContent(this.currentFile);
            }

            // Send to backend for enhanced analysis
            const response = await fetch('/api/analyze-resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ resumeText })
            });

            if (!response.ok) {
                throw new Error('Failed to analyze resume');
            }

            const data = await response.json();

            // Handle enhanced analysis structure
            this.resumeAnalysis = {
                technicalSkills: data.technicalSkills || [],
                softSkills: data.softSkills || [],
                workExperience: data.workExperience || [],
                education: data.education || [],
                qualifications: data.qualifications || [],
                industries: data.industries || [],
                responsibilities: data.responsibilities || [],
                achievements: data.achievements || [],
                seniorityLevel: data.seniorityLevel || 'mid'
            };

            console.log('Enhanced resume analysis completed:', this.resumeAnalysis);
            console.log('Technical Skills Count:', this.resumeAnalysis.technicalSkills.length);
            console.log('Industries Count:', this.resumeAnalysis.industries.length);
            console.log('Work Experience Count:', this.resumeAnalysis.workExperience.length);

            this.displayEnhancedSkillsAnalysis();
            this.showSearchSection();
            this.showLoading(false);

        } catch (error) { 
            console.error('Error analyzing resume:', error);
            this.showError('Failed to analyze resume. Please try again.');
            this.showLoading(false);
        }
    }

    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);

            if (file.type === 'text/plain') {
                reader.readAsText(file);
            } else if (file.type === 'application/pdf') {
                // For PDF files, we need to send to backend for parsing
                reader.readAsArrayBuffer(file);
            } else {
                // For DOC/DOCX files, try reading as text
                reader.readAsText(file);
            }
        });
    }

    displayEnhancedSkillsAnalysis() {
        console.log('Displaying enhanced skills analysis...');
        console.log('Current resumeAnalysis:', this.resumeAnalysis);
        console.log('Technical Skills:', this.resumeAnalysis.technicalSkills);
        console.log('Industries:', this.resumeAnalysis.industries);
        console.log('Work Experience:', this.resumeAnalysis.workExperience);
        
        this.skillsGrid.innerHTML = '';

        // Create summary card first
        this.createSummaryCard();

        // Display Technical Skills
        if (this.resumeAnalysis.technicalSkills && this.resumeAnalysis.technicalSkills.length > 0) {
            this.createSkillSection('Technical Skills', this.resumeAnalysis.technicalSkills, 'fas fa-code', 'technical');
        }

        // Display Soft Skills
        if (this.resumeAnalysis.softSkills && this.resumeAnalysis.softSkills.length > 0) {
            this.createSkillSection('Soft Skills', this.resumeAnalysis.softSkills, 'fas fa-users', 'soft');
        }

        // Display Work Experience
        if (this.resumeAnalysis.workExperience && this.resumeAnalysis.workExperience.length > 0) {
            this.createSkillSection('Work Experience', this.resumeAnalysis.workExperience, 'fas fa-briefcase', 'experience');
        }

        // Display Industries
        if (this.resumeAnalysis.industries && this.resumeAnalysis.industries.length > 0) {
            this.createSkillSection('Industries', this.resumeAnalysis.industries, 'fas fa-industry', 'industry');
        }

        // Display Responsibilities
        if (this.resumeAnalysis.responsibilities && this.resumeAnalysis.responsibilities.length > 0) {
            this.createSkillSection('Key Responsibilities', this.resumeAnalysis.responsibilities, 'fas fa-tasks', 'responsibility');
        }

        // Display Education
        if (this.resumeAnalysis.education && this.resumeAnalysis.education.length > 0) {
            this.createSkillSection('Education & Certifications', this.resumeAnalysis.education, 'fas fa-graduation-cap', 'education');
        }

        // Display Achievements
        if (this.resumeAnalysis.achievements && this.resumeAnalysis.achievements.length > 0) {
            this.createSkillSection('Key Achievements', this.resumeAnalysis.achievements, 'fas fa-trophy', 'achievement');
        }

        // Display Qualifications
        if (this.resumeAnalysis.qualifications && this.resumeAnalysis.qualifications.length > 0) {
            this.createSkillSection('Qualifications', this.resumeAnalysis.qualifications, 'fas fa-certificate', 'qualification');
        }

        this.analysisSection.style.display = 'block';
        this.analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    createSummaryCard() {
        const summarySection = document.createElement('div');
        summarySection.className = 'skills-section summary-card';
        
        const seniorityDisplay = this.resumeAnalysis.seniorityLevel.charAt(0).toUpperCase() + this.resumeAnalysis.seniorityLevel.slice(1);
        
        summarySection.innerHTML = `
            <h3><i class="fas fa-user-tie"></i> Profile Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">Seniority Level:</span>
                    <span class="summary-value">${seniorityDisplay}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Technical Skills:</span>
                    <span class="summary-value">${this.resumeAnalysis.technicalSkills.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Industries:</span>
                    <span class="summary-value">${this.resumeAnalysis.industries.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Key Roles:</span>
                    <span class="summary-value">${this.resumeAnalysis.workExperience.length}</span>
                </div>
            </div>
        `;
        
        this.skillsGrid.appendChild(summarySection);
    }

    createSkillSection(title, skills, iconClass, chipClass) {
        const section = document.createElement('div');
        section.className = 'skills-section';
        section.innerHTML = `<h3><i class="${iconClass}"></i> ${title}</h3>`;

        skills.forEach(skill => {
            const skillChip = document.createElement('div');
            skillChip.className = `skill-chip ${chipClass}`;
            
            // Handle both string and object cases
            let displayText;
            if (typeof skill === 'string') {
                displayText = skill;
            } else if (skill && typeof skill === 'object') {
                // For work experience objects, extract job title or use a meaningful field
                if (skill.jobTitle) {
                    displayText = skill.jobTitle;
                } else if (skill.title) {
                    displayText = skill.title;
                } else if (skill.role) {
                    displayText = skill.role;
                } else {
                    displayText = JSON.stringify(skill);
                }
            } else {
                displayText = String(skill);
            }
            
            skillChip.textContent = displayText;
            section.appendChild(skillChip);
        });

        this.skillsGrid.appendChild(section);
    }

    hideAnalysisSection() {
        this.analysisSection.style.display = 'none';
        this.searchSection.style.display = 'none';
    }

    showSearchSection() {
        this.searchSection.style.display = 'block';
        this.searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async startJobSearch() {
        try {
            // FIXED: Reset all counters and temporary storage
            this.searchInProgress = true;
            this.jobResults = [];
            this.tempJobResults = [];
            this.totalJobs = 0;
            this.displayedJobsCount = 0;
            this.searchProgress = 0;
            this.sourcesCompleted = 0;
            this.jobsGrid.innerHTML = '';
            this.resultsSection.style.display = 'none';

            this.showLoading(true, 'Initializing job search...');
            this.hideError();
            this.clearUserMessages();
    
            const filters = this.getSearchFilters(); // FIXED: This method is now properly defined below
    
            console.log('🚀 Starting REAL-TIME job search...');
            console.log('Analysis data:', this.resumeAnalysis);
            console.log('Filters:', filters);
            
            // Start streaming request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
            
            const response = await fetch('/api/search-jobs-modular', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    analysis: this.resumeAnalysis,
                    filters
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(errorData.error || `Server error (${response.status})`);
            }
    
            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let lastActivity = Date.now();
    
            console.log('📖 Reading real-time job search stream...');
    
            // Keep-alive mechanism
            const keepAliveInterval = setInterval(() => {
                const timeSinceLastActivity = Date.now() - lastActivity;
                if (timeSinceLastActivity > 30000) { // 30 seconds without activity
                    console.log('⚠️ No activity for 30 seconds, checking connection...');
                }
            }, 10000); // Check every 10 seconds
    
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        console.log('✅ Job search stream completed');
                        break;
                    }
    
                    lastActivity = Date.now();
    
                    // Handle streaming data
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonStr = line.slice(6).trim();
                                if (!jsonStr) continue;
                                
                                const data = JSON.parse(jsonStr);
                                await this.handleStreamingUpdate(data);
                                
                            } catch (parseError) {
                                console.warn('⚠️ Failed to parse streaming data:', parseError.message);
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.error('❌ Stream reading error:', streamError);
                
                // Check if we have any jobs already
                if (this.jobResults.length > 0) {
                    console.log(`✅ Found ${this.jobResults.length} jobs before connection error`);
                    this.showLoading(false);
                    this.displayJobResults();
                    return;
                }
                
                // Handle specific error types
                if (streamError.name === 'AbortError') {
                    throw new Error('Job search timed out. Please try again.');
                } else if (streamError.message.includes('network') || streamError.message.includes('fetch')) {
                    throw new Error('Network connection lost. Please check your internet connection and try again.');
                } else {
                    throw new Error('Failed to read job search results. Please try again.');
                }
            } finally {
                clearInterval(keepAliveInterval);
                reader.releaseLock();
            }
    
        } catch (error) {
            console.error('❌ Job search error:', error);
    
            let userMessage = 'Failed to search for jobs. Please try again.';
    
            if (error.message.includes('No jobs found')) {
                userMessage = error.message;
            } else if (error.message.includes('timeout')) {
                userMessage = 'Job search timed out. Please try again.';
            } else if (error.message.includes('Network connection lost')) {
                userMessage = 'Network connection lost. Please check your internet connection and try again.';
            } else if (error.message.includes('Failed to read job search results')) {
                userMessage = 'Connection interrupted. Please try again.';
            }
    
            this.showError(userMessage);
            this.showLoading(false);
            this.addRetryButton();
            
            this.searchInProgress = false;
            this.tempJobResults = [];
        }
    }

    // FIXED: Added the missing getSearchFilters method inside the class
    getSearchFilters() {
        return {
            experience: this.experienceFilter?.value || '',
            salary: this.salaryFilter?.value || '',
            timezone: this.timezoneFilter?.value || ''
        };
    }

    async handleStreamingUpdate(data) {
        console.log('📨 Handling streaming update:', data.type, data);

        switch (data.type) {
            case 'search_started':
                console.log('🎬 Search started:', data.message);
                this.loadingMessage.textContent = data.message;
                this.updateProgressBar(5);
                break;

            case 'progress_update':
                console.log('📊 Progress update:', data.percentage + '%', data.message);
                this.loadingMessage.textContent = data.message;
                this.updateProgressBar(data.percentage);
                break;

            case 'jobs_found':
                console.log('🎯 Jobs found from', data.source + ':', data.jobs.length, 'jobs');
                await this.handleJobsFound(data);
                break;

            case 'search_complete':
                console.log('🏁 Search complete:', data.totalJobs, 'total jobs');
                await this.handleSearchComplete(data);
                break;

            case 'user_message':
                console.log('💬 User message:', data.title);
                this.displayUserMessage(data);
                break;

            case 'scraper_start':
                console.log('🕷️ Scraper started:', data.scraper);
                this.loadingMessage.textContent = data.message;
                break;

            case 'scraper_complete':
                console.log('🕷️ Scraper completed:', data.scraper, data.count, 'jobs');
                this.loadingMessage.textContent = data.message;
                break;

            case 'scraper_error':
                console.log('🕷️ Scraper error:', data.scraper, data.error);
                this.loadingMessage.textContent = data.message;
                break;

            case 'error':
                console.error('❌ Streaming error:', data.error);
                this.showError(data.error);
                this.showLoading(false);
                break;

            default:
                console.warn('❓ Unknown streaming data type:', data.type, data);
                break;
        }
    }

    async handleJobsFound(data) {
        console.log(`🎯 RECEIVED: ${data.jobs.length} jobs from ${data.source}`);
        
        // FIXED: Add to temporary results and track our own accurate total
        this.tempJobResults.push(...data.jobs);
        const accurateTotal = this.tempJobResults.length;
        
        console.log(`📊 Accurate cumulative total: ${accurateTotal} (${data.jobs.length} new from ${data.source})`);

        // Show results section if first jobs
        if (this.resultsSection.style.display === 'none') {
            this.resultsSection.style.display = 'block';
            this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Display jobs immediately with animation
        data.jobs.forEach((job, index) => {
            setTimeout(() => {
                const jobCard = this.createEnhancedJobCard(job);
                this.jobsGrid.appendChild(jobCard);
                
                jobCard.style.opacity = '0';
                jobCard.style.transform = 'translateY(20px)';
                
                requestAnimationFrame(() => {
                    jobCard.style.transition = 'all 0.5s ease-out';
                    jobCard.style.opacity = '1';
                    jobCard.style.transform = 'translateY(0)';
                });
                
                this.displayedJobsCount++;
                
            }, index * 100);
        });

        // FIXED: Clear, accurate messages using our own count
        if (data.jobs.length > 0) {
            this.loadingMessage.textContent = `Found ${accurateTotal} jobs total - ${data.jobs.length} new from ${data.source}`;
        } else {
            this.loadingMessage.textContent = `Found ${accurateTotal} jobs total - no new jobs from ${data.source}`;
        }
        
        // FIXED: Use our accurate count, not the backend's potentially wrong count
        if (this.totalJobsElement) {
            this.totalJobsElement.textContent = `${accurateTotal} (searching...)`;
        }
        
        if (this.matchPercentage) {
            this.matchPercentage.textContent = 'Calculating...';
        }
        
        if (data.sourceProgress) {
            this.updateProgressBar(Math.min(data.sourceProgress, 90));
        }

        console.log(`✅ STREAMED: ${data.jobs.length} jobs from ${data.source}, ACCURATE TOTAL: ${accurateTotal}`);
    }

    // FIXED: New function for intermediate stats updates during search
    updateIntermediateStats(sourceName) {
        // Only update displayed count during search, not final calculations
        if (this.totalJobsElement) {
            this.totalJobsElement.textContent = `${this.displayedJobsCount} (searching...)`;
        }
        
        if (this.matchPercentage) {
            this.matchPercentage.textContent = 'Calculating...';
        }
    }

    async handleSearchComplete(data) {
        console.log('🏁 Search completed:', data);

        // FIXED: Use ONLY frontend-tracked jobs, ignore backend totalJobs
        this.jobResults = [...this.tempJobResults]; // Copy all collected jobs
        this.totalJobs = this.jobResults.length; // Use frontend count, not data.totalJobs
        
        console.log(`🎉 FINAL RESULTS: ${this.totalJobs} total jobs found (frontend count)!`);
        console.log(`📊 Backend reported: ${data.totalJobs || 'unknown'} jobs (ignored)`);
        
        // FIXED: Calculate final stats based on ALL jobs from ALL sources
        this.updateFinalStats();
        
        // Sort jobs by match percentage for better display
        this.sortJobsByMatch();
        
        this.showLoading(false);
        this.updateProgressBar(100);
        
        // Update scraping status
        if (data.apiStatus || data.scraperStatus) {
            this.updateScrapingStatus(data.apiStatus, data.scraperStatus);
        }
        
        // Display user messages
        if (data.userMessages && data.userMessages.length > 0) {
            data.userMessages.forEach(message => {
                this.displayUserMessage(message);
            });
        }
        
        // Clear temporary results
        this.tempJobResults = [];
        this.searchInProgress = false;
    }

    // FIXED: New function for final statistics calculation
    updateFinalStats() {
        console.log(`📊 Calculating final stats for ${this.totalJobs} jobs`);
        
        // Update total jobs count
        if (this.totalJobsElement) {
            this.totalJobsElement.textContent = this.totalJobs;
        }
        
        // FIXED: Calculate REAL average match percentage from ALL jobs
        if (this.jobResults.length > 0) {
            const jobsWithMatches = this.jobResults.filter(job => job.matchPercentage && job.matchPercentage > 0);
            console.log(`📊 Jobs with match percentages: ${jobsWithMatches.length}/${this.jobResults.length}`);
            
            if (jobsWithMatches.length > 0) {
                const avgMatch = Math.round(
                    jobsWithMatches.reduce((sum, job) => sum + job.matchPercentage, 0) / jobsWithMatches.length
                );
                if (this.matchPercentage) {
                    this.matchPercentage.textContent = `${avgMatch}%`;
                }
                console.log(`📊 FINAL Average match percentage: ${avgMatch}%`);
            } else {
                if (this.matchPercentage) {
                    this.matchPercentage.textContent = 'No matches';
                }
            }
        }
    }

    // FIXED: Update existing updateJobStats to only be used for filtering, not during search
    updateJobStats() {
        // Only used when filtering existing results, not during search
        const currentJobs = this.currentFilteredJobs.length > 0 ? this.currentFilteredJobs : this.jobResults;
        
        console.log(`📊 Updating filter stats for ${currentJobs.length} jobs`);
        
        if (this.totalJobsElement) {
            this.totalJobsElement.textContent = currentJobs.length;
        }
        
        // Calculate average match percentage for filtered results
        if (currentJobs.length > 0) {
            const jobsWithMatches = currentJobs.filter(job => job.matchPercentage && job.matchPercentage > 0);
            
            if (jobsWithMatches.length > 0) {
                const avgMatch = Math.round(
                    jobsWithMatches.reduce((sum, job) => sum + job.matchPercentage, 0) / jobsWithMatches.length
                );
                if (this.matchPercentage) {
                    this.matchPercentage.textContent = `${avgMatch}%`;
                }
                console.log(`📊 Filtered average match percentage: ${avgMatch}%`);
            } else {
                if (this.matchPercentage) {
                    this.matchPercentage.textContent = 'No matches';
                }
            }
        }
    }

    // Add missing method for compatibility
    displayJobResults() {
        console.log('📺 displayJobResults called - showing all jobs');
        if (this.jobResults && this.jobResults.length > 0) {
            this.displayFilteredResults(this.jobResults);
        }
    }

    sortJobsByMatch() {
        const jobCards = Array.from(this.jobsGrid.children);
        
        // Sort job results
        this.jobResults.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
        
        // Re-order DOM elements to match sorted results
        jobCards.sort((a, b) => {
            const aMatch = parseInt(a.querySelector('.job-match')?.textContent) || 0;
            const bMatch = parseInt(b.querySelector('.job-match')?.textContent) || 0;
            return bMatch - aMatch;
        });
        
        // Re-append in sorted order
        jobCards.forEach(card => this.jobsGrid.appendChild(card));
    }

    createEnhancedJobCard(job) {
        const card = document.createElement('div');
        card.className = 'job-card';

        // REAL AI MATCH PERCENTAGE from OpenAI analysis
        const matchPercentage = job.matchPercentage || 0;
        const matchClass = this.getMatchClass(matchPercentage);

        // Enhanced match breakdown with REAL AI data
        let matchBreakdown = '';
        if (job.industryMatch !== undefined || job.seniorityMatch !== undefined || job.growthPotential) {
            matchBreakdown = `
                <div class="match-breakdown">
                    <div class="match-item">
                        <span class="match-label">Overall Match:</span>
                        <span class="match-value">${job.matchPercentage || 0}%</span>
                    </div>
                    ${job.industryMatch !== undefined ? `
                    <div class="match-item">
                        <span class="match-label">Industry Fit:</span>
                        <span class="match-value">${job.industryMatch}%</span>
                    </div>` : ''}
                    ${job.seniorityMatch !== undefined ? `
                    <div class="match-item">
                        <span class="match-label">Level Match:</span>
                        <span class="match-value">${job.seniorityMatch}%</span>
                    </div>` : ''}
                    ${job.growthPotential ? `
                    <div class="match-item">
                        <span class="match-label">Growth:</span>
                        <span class="match-value growth-${job.growthPotential}">${job.growthPotential}</span>
                    </div>` : ''}
                </div>
            `;
        }

        // REAL AI skills analysis
        let skillsDisplay = '';
        
        if (job.matchedTechnicalSkills && job.matchedTechnicalSkills.length > 0) {
            skillsDisplay += `
                <div class="job-skills-category">
                    <h4><i class="fas fa-code"></i> Matched Technical Skills</h4>
                    <div class="job-skills-list">
                        ${job.matchedTechnicalSkills.map(skill => `<span class="job-skill technical matched">${skill}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (job.matchedSoftSkills && job.matchedSoftSkills.length > 0) {
            skillsDisplay += `
                <div class="job-skills-category">
                    <h4><i class="fas fa-users"></i> Matched Soft Skills</h4>
                    <div class="job-skills-list">
                        ${job.matchedSoftSkills.map(skill => `<span class="job-skill soft matched">${skill}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (job.matchedExperience && job.matchedExperience.length > 0) {
            skillsDisplay += `
                <div class="job-skills-category">
                    <h4><i class="fas fa-briefcase"></i> Matched Experience</h4>
                    <div class="job-skills-list">
                        ${job.matchedExperience.map(exp => `<span class="job-skill experience matched">${exp}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (job.missingRequirements && job.missingRequirements.length > 0) {
            skillsDisplay += `
                <div class="job-skills-category missing">
                    <h4><i class="fas fa-exclamation-triangle"></i> Missing Requirements</h4>
                    <div class="job-skills-list">
                        ${job.missingRequirements.map(req => `<span class="job-skill missing">${req}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Enhanced salary formatting
        const formattedSalary = this.formatJobSalary(job.salary);

        card.innerHTML = `
            <div class="job-header">
                <div class="job-main-info">
                    <h3 class="job-title">${job.title || 'Job Title Not Available'}</h3>
                    <p class="job-company">${job.company || 'Company Not Available'}</p>
                    <p class="job-location"><i class="fas fa-map-marker-alt"></i> ${job.location || 'Remote'}</p>
                    <p class="job-source"><i class="fas fa-external-link-alt"></i> Source: ${job.source || 'Unknown'}</p>
                </div>
                <div class="job-header-right">
                    <button class="expand-btn" onclick="this.closest('.job-card').classList.toggle('expanded'); this.querySelector('i').classList.toggle('fa-chevron-down'); this.querySelector('i').classList.toggle('fa-chevron-up');">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            
            <div class="job-always-visible">
                <div class="job-summary-info">
                    <p class="job-salary"><i class="fas fa-dollar-sign"></i> ${formattedSalary}</p>
                    <div class="job-match-display">
                        <span class="job-match ${matchClass}">${matchPercentage}% Match</span>
                    </div>
                </div>
            </div>
            
            <div class="job-details collapsed">
                <div class="job-additional-info">
                    <p class="job-type"><i class="fas fa-clock"></i> ${job.type || 'Full-time'}</p>
                </div>
                
                <div class="job-full-details">
                    ${matchBreakdown}
                    ${job.reasoning ? `<div class="job-reasoning"><strong>Comprehensive Analysis:</strong> ${job.reasoning}</div>` : ''}
                    <div class="job-description-container">
                        <h4><i class="fas fa-file-alt"></i> Job Description</h4>
                        <div class="job-description collapsed">
                            <p>${this.truncateDescription(job.description || 'No description available')}</p>
                        </div>
                        <div class="job-description expanded" style="display: none;">
                            <p>${job.description || 'No description available'}</p>
                        </div>
                        ${(job.description && job.description.length > 300) ? `
                        <button class="expand-description-btn" onclick="this.closest('.job-description-container').querySelector('.job-description.collapsed').style.display='none'; this.closest('.job-description-container').querySelector('.job-description.expanded').style.display='block'; this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
                            <i class="fas fa-chevron-down"></i> Show Full Description
                        </button>
                        <button class="collapse-description-btn" style="display: none;" onclick="this.closest('.job-description-container').querySelector('.job-description.collapsed').style.display='block'; this.closest('.job-description-container').querySelector('.job-description.expanded').style.display='none'; this.style.display='none'; this.previousElementSibling.style.display='inline-block';">
                            <i class="fas fa-chevron-up"></i> Show Less
                        </button>` : ''}
                    </div>
                    ${skillsDisplay}
                </div>
                
                <div class="job-actions">
                    <button class="apply-btn" onclick="window.open('${job.link || '#'}', '_blank')">
                        <i class="fas fa-paper-plane"></i>
                        Apply Now
                    </button>
                    <button class="save-btn ${this.savedJobs.find(savedJob => savedJob.id === this.generateJobId(job)) ? 'saved' : ''}" onclick="window.aiJobMatcher.saveJob(${JSON.stringify(job).replace(/"/g, '&quot;')})">
                        <i class="fas fa-bookmark"></i>
                        ${this.savedJobs.find(savedJob => savedJob.id === this.generateJobId(job)) ? 'Saved!' : 'Save Job'}
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    formatJobSalary(salaryStr) {
        if (!salaryStr || salaryStr === 'Salary not specified') {
            return 'Salary not specified';
        }
        
        // Clean up and standardize salary display
        let cleanSalary = salaryStr.trim();
        
        // Handle common formatting improvements
        if (cleanSalary.includes(' - ')) {
            return cleanSalary;
        } else if (cleanSalary.includes('From ')) {
            return cleanSalary;
        } else if (cleanSalary.includes('Up to ')) {
            return cleanSalary;
        } else if (cleanSalary.match(/^\$?\d+k?\s*-\s*\$?\d+k?$/i)) {
            // Simple range like "50k-75k" or "$50k-$75k"
            const parts = cleanSalary.split('-');
            if (parts.length === 2) {
                let min = parts[0].trim().replace(/^\$/, '');
                let max = parts[1].trim().replace(/^\$/, '');
                
                // Ensure both have $ prefix
                if (!min.startsWith('$')) min = '$' + min;
                if (!max.startsWith('$')) max = '$' + max;
                
                return `${min} - ${max}`;
            }
        }
        
        return cleanSalary;
    }

    formatSalaryNumber(num) {
        if (num >= 1000) {
            return `${Math.round(num / 1000)}k`;
        }
        return num.toLocaleString();
    }

    getMatchClass(matchPercentage) {
        if (matchPercentage >= 85) return 'excellent-match';
        if (matchPercentage >= 80) return 'great-match';
        if (matchPercentage >= 75) return 'good-match';
        if (matchPercentage >= 70) return 'solid-match';
        return 'low-match';
    }

    getMatchReason(job) {
        const title = (job.title || '').toLowerCase();
        const reasons = [];
        
        // Check technical skills
        if (this.resumeAnalysis.technicalSkills.some(skill => 
            title.includes(String(skill).toLowerCase())
        )) {
            reasons.push('technical skills');
        }
        
        // Check work experience
        if (this.resumeAnalysis.workExperience.some(exp => 
            title.includes(String(exp).toLowerCase())
        )) {
            reasons.push('work experience');
        }
        
        // Check industries
        if (this.resumeAnalysis.industries.some(industry => 
            title.includes(String(industry).toLowerCase())
        )) {
            reasons.push('industry experience');
        }
        
        return reasons.length > 0 ? reasons.join(', ') : 'relevant background';
    }

    truncateDescription(description) {
        if (description.length <= 300) return description;
        return description.substring(0, 300) + '...';
    }

    clearAllFilters() {
        this.experienceFilter.value = '';
        this.salaryFilter.value = '';
        this.timezoneFilter.value = '';
        this.filterChips.innerHTML = '';

        this.currentFilteredJobs = [];
        this.displayedJobsCount = 0;
        
        // Show all jobs when filters are cleared
        if (this.jobResults && this.jobResults.length > 0) {
            this.displayFilteredResults(this.jobResults);
        }
        
        // Hide clear filters button
        if (this.clearFilters) {
            this.clearFilters.style.display = 'none';
        }
    }

    applyFilters() {
        if (!this.jobResults || this.jobResults.length === 0) return;

        const experienceFilter = this.experienceFilter.value;
        const salaryFilter = this.salaryFilter.value;
        const timezoneFilter = this.timezoneFilter.value;

        let filteredJobs = [...this.jobResults];

        // Apply experience filter
        if (experienceFilter) {
            filteredJobs = filteredJobs.filter(job => {
                const title = job.title.toLowerCase();
                const description = (job.description || '').toLowerCase();
                
                if (experienceFilter === 'entry') {
                    return title.includes('junior') || title.includes('entry') || title.includes('associate') || 
                           description.includes('entry level') || description.includes('junior');
                } else if (experienceFilter === 'mid') {
                    return !title.includes('senior') && !title.includes('lead') && !title.includes('principal') &&
                           !title.includes('junior') && !title.includes('entry') && !title.includes('director');
                } else if (experienceFilter === 'senior') {
                    return title.includes('senior') || title.includes('lead') || title.includes('principal') ||
                           description.includes('senior') || description.includes('5+ years');
                } else if (experienceFilter === 'lead') {
                    return title.includes('lead') || title.includes('manager') || title.includes('principal') || 
                           title.includes('architect') || title.includes('director') || title.includes('head of');
                }
                return true;
            });
        }

        // Apply salary filter
        if (salaryFilter) {
            filteredJobs = filteredJobs.filter(job => {
                const salary = job.salary || '';
                if (salary === 'Salary not specified') return false;
                
                const salaryNumbers = this.extractSalaryNumbers(salary);
                
                if (salaryFilter === '50k') return salaryNumbers.min >= 50000 || salaryNumbers.max >= 50000;
                if (salaryFilter === '75k') return salaryNumbers.min >= 75000 || salaryNumbers.max >= 75000;
                if (salaryFilter === '100k') return salaryNumbers.min >= 100000 || salaryNumbers.max >= 100000;
                if (salaryFilter === '125k') return salaryNumbers.min >= 125000 || salaryNumbers.max >= 125000;
                if (salaryFilter === '150k') return salaryNumbers.min >= 150000 || salaryNumbers.max >= 150000;
                
                return true;
            });
        }

        // Apply timezone filter
        if (timezoneFilter) {
            filteredJobs = filteredJobs.filter(job => {
                const description = (job.description || '').toLowerCase();
                const location = (job.location || '').toLowerCase();
                
                if (timezoneFilter === 'us-only') {
                    return description.includes('us') || location.includes('us') || 
                           description.includes('est') || description.includes('pst');
                } else if (timezoneFilter === 'global') {
                    return description.includes('global') || description.includes('worldwide') || 
                           description.includes('any timezone');
                } else if (timezoneFilter === 'europe') {
                    return description.includes('europe') || description.includes('cet') || 
                           description.includes('gmt');
                }
                return true;
            });
        }

        this.displayFilteredResults(filteredJobs);
        this.updateFilterChips();
        
        // Show/hide clear filters button
        if (this.clearFilters) {
            const hasFilters = experienceFilter || salaryFilter || timezoneFilter;
            this.clearFilters.style.display = hasFilters ? 'inline-flex' : 'none';
        }
    }

    displayFilteredResults(filteredJobs) {
        this.currentFilteredJobs = filteredJobs;
        this.jobsGrid.innerHTML = '';

        // Use lazy loading for better performance
        if (filteredJobs.length > 20 && typeof lazyLoader !== 'undefined') {
            // Use virtual scrolling for large datasets
            this.virtualScrolling = lazyLoader.createVirtualScrollingContainer(
                this.jobsGrid, 
                filteredJobs, 
                200 // job card height
            );
        } else {
            // Use regular lazy loading for smaller datasets
            filteredJobs.forEach(job => {
                const jobCard = this.createEnhancedJobCard(job);
                this.jobsGrid.appendChild(jobCard);
                
                // Apply lazy loading to each card
                if (typeof lazyLoader !== 'undefined') {
                    lazyLoader.observeJobCard(jobCard);
                }
            });
        }

        this.displayedJobsCount = filteredJobs.length;

        // FIXED: Update stats for filtered results only
        this.updateJobStats();
    }

    updateFilterChips() {
        this.filterChips.innerHTML = '';

        const experienceFilter = this.experienceFilter.value;
        const salaryFilter = this.salaryFilter.value;
        const timezoneFilter = this.timezoneFilter.value;

        if (experienceFilter) {
            const expLabels = {
                'entry': 'Entry Level',
                'mid': 'Mid Level', 
                'senior': 'Senior Level',
                'lead': 'Lead/Management'
            };
            this.addFilterChip('Experience', expLabels[experienceFilter], () => {
                this.experienceFilter.value = '';
                this.applyFilters();
            });
        }

        if (salaryFilter) {
            const salaryLabels = {
                '50k': '$50k+',
                '75k': '$75k+',
                '100k': '$100k+',
                '125k': '$125k+',
                '150k': '$150k+'
            };
            this.addFilterChip('Salary', salaryLabels[salaryFilter], () => {
                this.salaryFilter.value = '';
                this.applyFilters();
            });
        }

        if (timezoneFilter) {
            const timezoneLabels = {
                'us-only': 'US Only',
                'global': 'Global/Any Timezone',
                'europe': 'Europe/EU'
            };
            this.addFilterChip('Timezone', timezoneLabels[timezoneFilter], () => {
                this.timezoneFilter.value = '';
                this.applyFilters();
            });
        }
    }

    addFilterChip(label, value, onRemove) {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';

        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-times';
        removeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            chip.remove();
            onRemove();
        });

        chip.textContent = `${label}: ${value} `;
        chip.appendChild(removeIcon);
        this.filterChips.appendChild(chip);
    }

    extractSalaryNumbers(salaryStr) {
        const salary = salaryStr.toLowerCase();
        let min = 0, max = 0;
        
        const cleanSalary = salary.replace(/[$£€,]/g, '');
        const rangeMatch = cleanSalary.match(/(\d+)(?:k|,000)?\s*[-–to]\s*(\d+)(?:k|,000)?/);
        const singleMatch = cleanSalary.match(/(\d+)(?:k|,000)?/);
        
        if (rangeMatch) {
            min = parseInt(rangeMatch[1]);
            max = parseInt(rangeMatch[2]);
            if (salary.includes('k') || min < 1000) {
                min *= 1000;
                max *= 1000;
            }
        } else if (singleMatch) {
            const num = parseInt(singleMatch[1]);
            min = max = salary.includes('k') || num < 1000 ? num * 1000 : num;
        }
        
        return { min, max };
    }

    loadMoreJobs() {
        console.log('Load more jobs functionality');
    }

    showLoading(show, message = '') {
        if (show) {
            this.loadingSection.style.display = 'block';
            if (message) {
                this.loadingMessage.textContent = message;
            }
            this.progressFill.style.width = '0%';
        } else {
            this.loadingSection.style.display = 'none';
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
    }

    hideError() {
        this.errorSection.style.display = 'none';
        const retryBtn = document.getElementById('retry-button');
        if (retryBtn) {
            retryBtn.remove();
        }
    }

    addRetryButton() {
        const existingRetryBtn = document.getElementById('retry-button');
        if (existingRetryBtn) {
            existingRetryBtn.remove();
        }

        const retryBtn = document.createElement('button');
        retryBtn.id = 'retry-button';
        retryBtn.className = 'retry-btn';
        retryBtn.innerHTML = '<i class="fas fa-redo"></i> Try Again';
        retryBtn.onclick = () => this.startJobSearch();

        this.errorSection.appendChild(retryBtn);
    }

    updateProgressBar(percentage) {
        this.progressFill.style.width = `${Math.min(percentage, 100)}%`;
    }

    generateJobId(job) {
        // Create a unique ID based on title, company, and source
        const cleanTitle = (job.title || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanCompany = (job.company || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanSource = (job.source || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `${cleanTitle}-${cleanCompany}-${cleanSource}`;
    }

    saveJob(job) {
        // Create a unique ID based on title and company
        const jobId = this.generateJobId(job);
        const existingJob = this.savedJobs.find(savedJob => savedJob.id === jobId);
        
        if (existingJob) {
            this.removeSavedJob(jobId);
            return;
        }

        const newJob = {
            ...job,
            id: jobId,
            savedAt: new Date().toISOString()
        };
        this.savedJobs.push(newJob);
        this.saveJobsToStorage();
        this.updateSavedJobsDisplay();
        this.updateSavedCount();
        this.updateSaveButtonStates();
        this.showToast('Job saved!', 'success');
    }

    removeSavedJob(jobId) {
        this.savedJobs = this.savedJobs.filter(job => job.id !== jobId);
        this.saveJobsToStorage();
        this.updateSavedJobsDisplay();
        this.updateSavedCount();
        this.updateSaveButtonStates();
        this.showToast('Job removed!', 'info');
    }

    updateSaveButtonStates() {
        // Update all save buttons in the current view
        const saveButtons = document.querySelectorAll('.save-btn');
        saveButtons.forEach(button => {
            const jobCard = button.closest('.job-card');
            if (jobCard) {
                const jobTitle = jobCard.querySelector('.job-title')?.textContent;
                const jobCompany = jobCard.querySelector('.job-company')?.textContent;
                const jobSource = jobCard.querySelector('.job-source')?.textContent?.replace('Source: ', '') || '';
                
                // Create job ID to match
                const jobId = this.generateJobId({
                    title: jobTitle,
                    company: jobCompany,
                    source: jobSource
                });
                
                // Find the job in saved jobs
                const savedJob = this.savedJobs.find(job => job.id === jobId);
                
                if (savedJob) {
                    button.classList.add('saved');
                    button.innerHTML = '<i class="fas fa-bookmark"></i> Saved!';
                } else {
                    button.classList.remove('saved');
                    button.innerHTML = '<i class="fas fa-bookmark"></i> Save Job';
                }
            }
        });
    }

    loadSavedJobs() {
        const savedJobs = localStorage.getItem('savedJobs');
        if (savedJobs) {
            return JSON.parse(savedJobs);
        }
        return [];
    }

    saveJobsToStorage() {
        localStorage.setItem('savedJobs', JSON.stringify(this.savedJobs));
    }

    updateSavedJobsDisplay() {
        const savedJobsContainer = document.getElementById('saved-jobs-container');
        if (!savedJobsContainer) return;

        savedJobsContainer.innerHTML = '';
        if (this.savedJobs.length === 0) {
            savedJobsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bookmark"></i>
                    <h3>No saved jobs yet</h3>
                    <p>Find some great opportunities and save them for later!</p>
                </div>
            `;
            return;
        }

        this.savedJobs.forEach(job => {
            const jobCard = this.createEnhancedJobCard(job);
            // Mark as saved in the saved jobs view
            const saveBtn = jobCard.querySelector('.save-btn');
            saveBtn.classList.add('saved');
            saveBtn.innerHTML = '<i class="fas fa-bookmark"></i> Saved!';
            saveBtn.onclick = () => this.removeSavedJob(job.id);
            savedJobsContainer.appendChild(jobCard);
        });
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showResults() {
        document.getElementById('results-section').style.display = 'block';
        document.getElementById('saved-jobs-section').style.display = 'none';
        
        // Update button states
        document.getElementById('view-results').classList.add('active');
        document.getElementById('view-saved').classList.remove('active');
        document.getElementById('view-results-saved').classList.remove('active');
        document.getElementById('view-saved-saved').classList.add('active');
    }

    showSavedJobs() {
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('saved-jobs-section').style.display = 'block';
        
        // Update button states
        document.getElementById('view-results').classList.remove('active');
        document.getElementById('view-saved').classList.add('active');
        document.getElementById('view-results-saved').classList.add('active');
        document.getElementById('view-saved-saved').classList.remove('active');
        
        this.updateSavedJobsDisplay();
    }

    updateSavedCount() {
        const count = this.savedJobs.length;
        document.getElementById('saved-count').textContent = count;
        document.getElementById('saved-count-saved').textContent = count;
    }

    // Scraping status methods
    updateScrapingStatus(apiStatus, scraperStatus) {
        if (!this.scrapingStatus) return;
        
        // Show scraping status if we have data
        if (apiStatus || scraperStatus) {
            this.scrapingStatus.style.display = 'block';
            
            // Update API health
            if (apiStatus && this.apiHealth) {
                this.apiHealth.textContent = `${apiStatus.systemHealth.healthyPercentage}%`;
            }
            
            // Update scraper health
            if (scraperStatus && this.scraperHealth) {
                this.scraperHealth.textContent = `${scraperStatus.healthPercentage}%`;
            }
            
            // Update source counts
            if (this.scrapingSources && this.scrapingCount) {
                const apiCount = apiStatus ? apiStatus.systemHealth.healthyApis : 0;
                const scraperCount = scraperStatus ? scraperStatus.availableScrapers : 0;
                this.scrapingSources.textContent = apiCount;
                this.scrapingCount.textContent = scraperCount;
            }
        } else {
            this.scrapingStatus.style.display = 'none';
        }
    }

    displayUserMessage(message) {
        if (!this.userMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${message.messageType}`;
        
        const icon = message.messageType === 'warning' ? '⚠️' : 'ℹ️';
        const actionText = message.action === 'try_again_later' 
            ? 'Try again later for better results' 
            : 'Continue with current results';
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-icon">${icon}</span>
                <span class="message-title">${message.title}</span>
            </div>
            <div class="message-body">
                <p>${message.message}</p>
                <p class="message-action">💡 ${actionText}</p>
            </div>
        `;
        
        this.userMessages.appendChild(messageElement);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 10000);
    }

    clearUserMessages() {
        if (this.userMessages) {
            this.userMessages.innerHTML = '';
        }
    }
}

// Initialize the global instance
window.aiJobMatcher = new AIJobMatcher();