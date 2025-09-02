// lazy-loader.js - Lazy loading utilities for job cards and images

/**
 * Lazy Loading Manager for job cards and images
 * Provides intersection observer-based lazy loading
 */
export class LazyLoader {
    constructor() {
        this.observer = null;
        this.imageObserver = null;
        this.initialized = false;
        this.loadedImages = new Set();
    }

    /**
     * Initialize lazy loading
     */
    init() {
        if (this.initialized) return;
        
        // Initialize intersection observer for job cards
        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                root: null,
                rootMargin: '50px',
                threshold: 0.1
            }
        );

        // Initialize intersection observer for images
        this.imageObserver = new IntersectionObserver(
            this.handleImageIntersection.bind(this),
            {
                root: null,
                rootMargin: '100px',
                threshold: 0.1
            }
        );

        this.initialized = true;
        console.log('🔄 Lazy loader initialized');
    }

    /**
     * Handle intersection for job cards
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                this.loadJobCard(element);
                this.observer.unobserve(element);
            }
        });
    }

    /**
     * Handle intersection for images
     */
    handleImageIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.imageObserver.unobserve(img);
            }
        });
    }

    /**
     * Load job card with animation
     */
    loadJobCard(element) {
        element.classList.add('job-card-loaded');
        
        // Add staggered animation
        const delay = Math.random() * 200;
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, delay);
    }

    /**
     * Load image with fade-in effect
     */
    loadImage(img) {
        const src = img.dataset.src;
        if (!src || this.loadedImages.has(src)) return;

        this.loadedImages.add(src);
        
        // Create new image to preload
        const newImg = new Image();
        newImg.onload = () => {
            img.src = src;
            img.classList.add('image-loaded');
            img.style.opacity = '1';
        };
        newImg.onerror = () => {
            img.classList.add('image-error');
            img.style.opacity = '0.5';
        };
        newImg.src = src;
    }

    /**
     * Observe job card for lazy loading
     */
    observeJobCard(element) {
        if (!this.initialized) this.init();
        
        // Set initial state
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        this.observer.observe(element);
    }

    /**
     * Observe image for lazy loading
     */
    observeImage(img) {
        if (!this.initialized) this.init();
        
        // Set initial state
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
        
        this.imageObserver.observe(img);
    }

    /**
     * Create lazy-loaded job card
     */
    createLazyJobCard(job) {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <div class="job-header">
                <h3 class="job-title">${this.escapeHtml(job.title)}</h3>
                <div class="job-actions">
                    <button class="save-job-btn" data-job-id="${job.id}">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
            </div>
            <div class="job-company">${this.escapeHtml(job.company)}</div>
            <div class="job-location">${this.escapeHtml(job.location)}</div>
            ${job.salary ? `<div class="job-salary">${this.escapeHtml(job.salary)}</div>` : ''}
            <div class="job-description">${this.truncateText(this.escapeHtml(job.description), 150)}</div>
            <div class="job-footer">
                <div class="job-source">${this.escapeHtml(job.source)}</div>
                <a href="${job.url}" target="_blank" class="apply-btn">
                    Apply <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;

        // Add event listeners
        this.addJobCardEventListeners(card, job);
        
        // Observe for lazy loading
        this.observeJobCard(card);
        
        return card;
    }

    /**
     * Add event listeners to job card
     */
    addJobCardEventListeners(card, job) {
        const saveBtn = card.querySelector('.save-job-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSaveJob(job, saveBtn);
            });
        }

        // Add click tracking
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.save-job-btn') && !e.target.closest('.apply-btn')) {
                this.trackJobClick(job);
            }
        });
    }

    /**
     * Toggle save job
     */
    toggleSaveJob(job, btn) {
        const isSaved = btn.classList.contains('saved');
        const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '[]');
        
        if (isSaved) {
            // Remove from saved
            const index = savedJobs.findIndex(saved => saved.id === job.id);
            if (index > -1) {
                savedJobs.splice(index, 1);
                btn.classList.remove('saved');
                btn.innerHTML = '<i class="fas fa-bookmark"></i>';
            }
        } else {
            // Add to saved
            savedJobs.push(job);
            btn.classList.add('saved');
            btn.innerHTML = '<i class="fas fa-bookmark"></i>';
        }
        
        localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
        this.updateSavedCount();
    }

    /**
     * Update saved jobs count
     */
    updateSavedCount() {
        const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '[]');
        const countElements = document.querySelectorAll('#saved-count, #saved-count-saved');
        countElements.forEach(el => {
            el.textContent = savedJobs.length;
        });
    }

    /**
     * Track job click
     */
    trackJobClick(job) {
        // Analytics tracking could be added here
        console.log('Job clicked:', job.title);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Truncate text with ellipsis
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Create virtual scrolling container
     */
    createVirtualScrollingContainer(container, items, itemHeight = 200) {
        const containerHeight = container.clientHeight;
        const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
        
        let startIndex = 0;
        let endIndex = Math.min(startIndex + visibleItems, items.length);
        
        const renderItems = () => {
            const fragment = document.createDocumentFragment();
            
            for (let i = startIndex; i < endIndex; i++) {
                const item = items[i];
                const element = this.createLazyJobCard(item);
                fragment.appendChild(element);
            }
            
            container.innerHTML = '';
            container.appendChild(fragment);
        };
        
        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const newStartIndex = Math.floor(scrollTop / itemHeight);
            
            if (newStartIndex !== startIndex) {
                startIndex = newStartIndex;
                endIndex = Math.min(startIndex + visibleItems, items.length);
                renderItems();
            }
        };
        
        container.addEventListener('scroll', handleScroll);
        renderItems();
        
        return {
            updateItems: (newItems) => {
                items = newItems;
                startIndex = 0;
                endIndex = Math.min(startIndex + visibleItems, items.length);
                renderItems();
            },
            destroy: () => {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }

    /**
     * Destroy lazy loader
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }
        this.initialized = false;
    }
}

// Export singleton instance
export const lazyLoader = new LazyLoader();
