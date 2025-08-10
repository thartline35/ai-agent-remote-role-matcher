// reporting-integration.js - Add this to your existing frontend
// This script adds reporting capabilities to your existing application

class ReportingIntegration {
    constructor() {
        this.reportCount = 0;
        this.lastReportTime = null;
        this.isMonitoring = false;
        this.init();
    }

    init() {
        // Add reporting status to your existing UI
        this.createReportingWidget();
        
        // Set up client-side ReportingObserver for additional monitoring
        this.setupReportingObserver();
        
        // Check server-side reports periodically
        this.startReportMonitoring();
        
        // Add dashboard link to navigation if possible
        this.addDashboardLink();
    }

    createReportingWidget() {
        // Create a small widget that shows reporting status
        const widget = document.createElement('div');
        widget.id = 'reporting-widget';
        widget.innerHTML = `
            <div class="reporting-widget">
                <div class="widget-header">
                    <i class="fas fa-shield-alt"></i>
                    <span>Reporting</span>
                    <button class="widget-toggle" onclick="window.reportingIntegration.toggleWidget()">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>
                <div class="widget-content">
                    <div class="widget-stats">
                        <div class="stat">
                            <span class="stat-label">Reports:</span>
                            <span class="stat-value" id="widget-report-count">0</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Status:</span>
                            <span class="stat-value" id="widget-status">
                                <i class="fas fa-circle status-active"></i> Active
                            </span>
                        </div>
                    </div>
                    <div class="widget-actions">
                        <button onclick="window.reportingIntegration.openDashboard()" class="widget-btn primary">
                            <i class="fas fa-chart-line"></i> Dashboard
                        </button>
                        <button onclick="window.reportingIntegration.generateTestReport()" class="widget-btn secondary">
                            <i class="fas fa-flask"></i> Test
                        </button>
                    </div>
                    <div id="widget-last-report" class="widget-last-report" style="display: none;">
                        <small>Last report: <span id="last-report-time"></span></small>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        this.addWidgetStyles();

        // Append to body
        document.body.appendChild(widget);
    }

    addWidgetStyles() {
        const styles = `
            <style id="reporting-widget-styles">
                .reporting-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    border: 1px solid #e2e8f0;
                    min-width: 280px;
                    z-index: 10000;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }

                .reporting-widget.collapsed .widget-content {
                    display: none;
                }

                .widget-header {
                    padding: 12px 16px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 12px 12px 0 0;
                    font-weight: 600;
                }

                .reporting-widget.collapsed .widget-header {
                    border-radius: 12px;
                }

                .widget-header i {
                    font-size: 16px;
                }

                .widget-toggle {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                }

                .widget-toggle:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .widget-content {
                    padding: 16px;
                }

                .widget-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .stat {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .stat-label {
                    color: #64748b;
                    font-weight: 500;
                }

                .stat-value {
                    font-weight: 600;
                    color: #1e293b;
                }

                .status-active {
                    color: #10b981;
                    font-size: 8px;
                    margin-right: 4px;
                }

                .status-error {
                    color: #ef4444;
                    font-size: 8px;
                    margin-right: 4px;
                }

                .widget-actions {
                    display: flex;
                    gap: 8px;
                }

                .widget-btn {
                    flex: 1;
                    padding: 8px 12px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    transition: all 0.2s ease;
                }

                .widget-btn.primary {
                    background: #4f46e5;
                    color: white;
                }

                .widget-btn.primary:hover {
                    background: #4338ca;
                }

                .widget-btn.secondary {
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }

                .widget-btn.secondary:hover {
                    background: #e2e8f0;
                }

                .widget-last-report {
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid #e2e8f0;
                    color: #64748b;
                    text-align: center;
                }

                .widget-notification {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: bold;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }

                @media (max-width: 768px) {
                    .reporting-widget {
                        bottom: 10px;
                        right: 10px;
                        left: 10px;
                        min-width: auto;
                    }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupReportingObserver() {
        // Use the ReportingObserver API for client-side monitoring
        if ('ReportingObserver' in window) {
            const observer = new ReportingObserver((reports, observer) => {
                console.log('🔍 Client-side reports detected:', reports);
                
                reports.forEach(report => {
                    this.handleClientSideReport(report);
                });
            }, { types: ['deprecation', 'intervention'] });

            observer.observe();
            console.log('✅ ReportingObserver started for client-side monitoring');
        } else {
            console.log('⚠️ ReportingObserver not supported in this browser');
        }
    }

    handleClientSideReport(report) {
        console.log('📊 Client-side report:', {
            type: report.type,
            url: report.url,
            body: report.body
        });

        this.reportCount++;
        this.lastReportTime = new Date();
        this.updateWidget();

        // You could send these to your server-side endpoint
        this.sendClientReportToServer(report);
    }

    async sendClientReportToServer(report) {
        try {
            // Convert ReportingObserver report to server format
            const serverReport = {
                type: report.type,
                url: window.location.href,
                user_agent: navigator.userAgent,
                body: report.body,
                age: 0
            };

            await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/reports+json'
                },
                body: JSON.stringify([serverReport])
            });

            console.log('✅ Client report sent to server');
        } catch (error) {
            console.error('❌ Failed to send client report to server:', error);
        }
    }

    async startReportMonitoring() {
        this.isMonitoring = true;
        
        // Check for new reports every 30 seconds
        setInterval(async () => {
            if (this.isMonitoring) {
                await this.checkReportStatus();
            }
        }, 30000);

        // Initial check
        await this.checkReportStatus();
    }

    async checkReportStatus() {
        try {
            const response = await fetch('/api/reports-dashboard');
            const data = await response.json();

            if (data.success && data.summary) {
                const newCount = data.summary.total;
                const hasNewReports = newCount > this.reportCount;

                this.reportCount = newCount;
                
                if (data.summary.mostRecentReport) {
                    this.lastReportTime = new Date(data.summary.mostRecentReport);
                }

                this.updateWidget();

                if (hasNewReports) {
                    this.showNotification();
                }
            }
        } catch (error) {
            console.error('Error checking report status:', error);
            this.updateWidgetStatus('error');
        }
    }

    updateWidget() {
        const countElement = document.getElementById('widget-report-count');
        const lastReportElement = document.getElementById('widget-last-report');
        const lastReportTimeElement = document.getElementById('last-report-time');

        if (countElement) {
            countElement.textContent = this.reportCount;
        }

        if (this.lastReportTime && lastReportElement && lastReportTimeElement) {
            lastReportElement.style.display = 'block';
            lastReportTimeElement.textContent = this.formatTimeAgo(this.lastReportTime);
        }
    }

    updateWidgetStatus(status) {
        const statusElement = document.getElementById('widget-status');
        if (statusElement) {
            if (status === 'error') {
                statusElement.innerHTML = '<i class="fas fa-circle status-error"></i> Error';
            } else {
                statusElement.innerHTML = '<i class="fas fa-circle status-active"></i> Active';
            }
        }
    }

    showNotification() {
        const widget = document.querySelector('.reporting-widget');
        if (!widget.querySelector('.widget-notification')) {
            const notification = document.createElement('div');
            notification.className = 'widget-notification';
            notification.textContent = '!';
            widget.appendChild(notification);

            // Remove notification after 5 seconds
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    }

    toggleWidget() {
        const widget = document.querySelector('.reporting-widget');
        const toggle = document.querySelector('.widget-toggle i');
        
        widget.classList.toggle('collapsed');
        
        if (widget.classList.contains('collapsed')) {
            toggle.className = 'fas fa-chevron-down';
        } else {
            toggle.className = 'fas fa-chevron-up';
        }
    }

    openDashboard() {
        // Open dashboard in new tab or navigate to it
        window.open('/reports-dashboard.html', '_blank');
    }

    async generateTestReport() {
        try {
            // Generate a test deprecation warning
            if (window.webkitStorageInfo) {
                const info = window.webkitStorageInfo;
                console.log('Test deprecation:', info);
            }

            // Try to violate CSP (this will fail but generate a report)
            const script = document.createElement('script');
            script.src = 'https://malicious-test-domain.example.com/script.js';
            document.head.appendChild(script);

            // Try document.write (will be blocked and generate report)
            try {
                document.write('<span>Test violation</span>');
            } catch (e) {
                console.log('Document.write blocked (as expected):', e);
            }

            // Show feedback
            this.showTestFeedback();

        } catch (error) {
            console.error('Error generating test report:', error);
        }
    }

    showTestFeedback() {
        const feedback = document.createElement('div');
        feedback.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; font-family: Inter, sans-serif; font-size: 14px;">
                <i class="fas fa-check-circle"></i> Test reports generated!
            </div>
        `;
        document.body.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
            // Refresh report count
            this.checkReportStatus();
        }, 3000);
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    addDashboardLink() {
        // Try to add a link to existing navigation
        const nav = document.querySelector('nav, .navigation, .header-nav, .main-nav');
        if (nav) {
            const link = document.createElement('a');
            link.href = '/reports-dashboard.html';
            link.target = '_blank';
            link.innerHTML = '<i class="fas fa-chart-line"></i> Reports';
            link.style.cssText = 'margin-left: 1rem; color: #4f46e5; text-decoration: none; font-weight: 500;';
            
            nav.appendChild(link);
        }
    }

    // Public methods for external use
    getReportCount() {
        return this.reportCount;
    }

    getLastReportTime() {
        return this.lastReportTime;
    }

    toggleMonitoring() {
        this.isMonitoring = !this.isMonitoring;
        this.updateWidgetStatus(this.isMonitoring ? 'active' : 'error');
    }
}

// Initialize the reporting integration
window.reportingIntegration = new ReportingIntegration();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportingIntegration;
}