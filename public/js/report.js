/**
 * LearnSign - Parent Report Generator
 * Handles report loading, chart rendering, and PDF download
 */

// Report State
const ReportState = {
    data: null,
    charts: {
        weekly: null,
        quiz: null
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadReport();
    setupDownloadButton();
});

/**
 * Load report data from API
 */
async function loadReport() {
    const loadingEl = document.getElementById('report-loading');
    const contentEl = document.getElementById('report-content');
    const errorEl = document.getElementById('report-error');
    
    try {
        const userId = localStorage.getItem('userId');
        
        if (!userId) {
            showError('Please log in to view your report.');
            return;
        }
        
        console.log('[Report] Loading report for user:', userId);
        
        const response = await fetch(`/api/report/generate/${userId}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load report');
        }
        
        const data = await response.json();
        
        if (!data.success || !data.report) {
            throw new Error('Invalid report data');
        }
        
        ReportState.data = data.report;
        console.log('[Report] Report loaded:', data.report);
        
        // Render the report
        renderReport(data.report);
        
        // Show content, hide loading
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        
    } catch (error) {
        console.error('[Report] Error:', error);
        showError(error.message);
    }
}

/**
 * Show error state
 */
function showError(message) {
    document.getElementById('report-loading').style.display = 'none';
    document.getElementById('report-content').style.display = 'none';
    document.getElementById('report-error').style.display = 'block';
    document.getElementById('error-message').textContent = message;
}

/**
 * Render the full report
 */
function renderReport(report) {
    // Set report date
    const reportDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('report-date').textContent = reportDate;
    document.getElementById('footer-date').textContent = reportDate;
    
    // Render student profile
    renderStudentProfile(report.student);
    
    // Render AI summary
    renderAISummary(report.aiInsights);
    
    // Render statistics
    renderStatistics(report.statistics);
    
    // Render charts
    renderWeeklyChart(report.weeklyActivity);
    renderQuizChart(report.quizTrend);
    
    // Render course progress
    renderCourseProgress(report.courseProgress);
    
    // Render achievements
    renderAchievements(report.aiInsights?.achievements || []);
    
    // Render analysis
    renderAnalysis(report.aiInsights, report.strengths, report.improvements);
    
    // Render parent tips
    renderParentTips(report.aiInsights?.parentTips || []);
    
    // Render weekly goal
    document.getElementById('weekly-goal').textContent = 
        report.aiInsights?.weeklyGoal || 'Complete one lesson and practice daily!';
    
    // Render encouragement
    document.getElementById('encouragement-text').textContent = 
        report.aiInsights?.encouragement || 'Keep up the amazing work! Every sign learned is a step forward! 🌟';
}

/**
 * Render student profile section
 */
function renderStudentProfile(student) {
    const name = student.name || 'Learner';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    document.getElementById('student-initials').textContent = initials;
    document.getElementById('student-name').textContent = name;
    document.getElementById('student-age-group').textContent = student.ageGroup || 'Not specified';
    document.getElementById('member-since').textContent = student.memberSince || 'Unknown';
    document.getElementById('current-streak').textContent = student.currentStreak || 0;
}

/**
 * Render AI summary
 */
function renderAISummary(insights) {
    const summary = insights?.overallSummary || 
        'Your child is making progress in their sign language learning journey!';
    document.getElementById('ai-summary').textContent = summary;
}

/**
 * Render statistics cards
 */
function renderStatistics(stats) {
    document.getElementById('stat-courses').textContent = 
        `${stats.completedCourses}/${stats.totalCourses}`;
    
    const hours = Math.floor(stats.totalTimeMinutes / 60);
    const minutes = stats.totalTimeMinutes % 60;
    document.getElementById('stat-time').textContent = 
        hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    document.getElementById('stat-progress').textContent = `${stats.avgProgress}%`;
    document.getElementById('stat-quiz-score').textContent = `${stats.avgQuizScore}%`;
}

/**
 * Render weekly activity chart
 */
function renderWeeklyChart(weeklyData) {
    const ctx = document.getElementById('weeklyChart');
    if (!ctx) return;
    
    const labels = weeklyData.map(d => d.day);
    const data = weeklyData.map(d => d.minutes);
    
    ReportState.charts.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Minutes',
                data,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (ctx) => `${ctx.raw} minutes`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#718096' },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    ticks: { color: '#718096' },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Render quiz performance chart
 */
function renderQuizChart(quizData) {
    const ctx = document.getElementById('quizChart');
    if (!ctx) return;
    
    // If no quiz data, show placeholder
    if (!quizData || quizData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 200px; color: #718096;">
                <p>No quizzes taken yet. Start a quiz to see progress!</p>
            </div>
        `;
        return;
    }
    
    const labels = quizData.map((_, i) => `Quiz ${quizData.length - i}`).reverse();
    const data = quizData.map(q => q.score).reverse();
    
    ReportState.charts.quiz = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Score',
                data,
                borderColor: 'rgba(72, 187, 120, 1)',
                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(72, 187, 120, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (ctx) => `Score: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { 
                        color: '#718096',
                        callback: (val) => `${val}%`
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    ticks: { color: '#718096' },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Render course progress bars
 */
function renderCourseProgress(courses) {
    const container = document.getElementById('course-progress-list');
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <p style="color: #718096; text-align: center; padding: 2rem;">
                No courses started yet. Explore our course catalog to begin learning!
            </p>
        `;
        return;
    }
    
    container.innerHTML = courses.map(course => `
        <div class="course-progress-item">
            <span class="course-name">${escapeHtml(course.courseName)}</span>
            <div class="progress-bar-container">
                <div class="progress-bar-fill ${course.status === 'completed' ? 'completed' : 'in-progress'}" 
                     style="width: ${course.progress}%"></div>
            </div>
            <span class="progress-percentage">${course.progress}%</span>
        </div>
    `).join('');
}

/**
 * Render achievements
 */
function renderAchievements(achievements) {
    const container = document.getElementById('achievements-list');
    
    const defaultAchievements = [
        '🌟 Started Learning Journey',
        '📚 Explored First Course',
        '🎯 Ready to Grow'
    ];
    
    const items = achievements.length > 0 ? achievements : defaultAchievements;
    
    container.innerHTML = items.map(achievement => `
        <div class="achievement-badge">
            <span class="achievement-icon">🏆</span>
            <span class="achievement-text">${escapeHtml(achievement)}</span>
        </div>
    `).join('');
}

/**
 * Render strengths and growth analysis
 */
function renderAnalysis(insights, strengths, improvements) {
    // Strengths
    document.getElementById('strengths-text').textContent = 
        insights?.strengthsAnalysis || 'Building a strong foundation in sign language.';
    
    const strengthsList = document.getElementById('strengths-list');
    if (strengths && strengths.length > 0) {
        strengthsList.innerHTML = strengths.map(s => 
            `<li>${escapeHtml(s.course)}: ${s.avgScore}% average</li>`
        ).join('');
    } else {
        strengthsList.innerHTML = '<li>Keep learning to discover your strengths!</li>';
    }
    
    // Growth areas
    document.getElementById('growth-text').textContent = 
        insights?.areasForGrowth || 'Consistent practice will help reinforce learning.';
    
    const growthList = document.getElementById('growth-list');
    if (improvements && improvements.length > 0) {
        growthList.innerHTML = improvements.map(i => 
            `<li>${escapeHtml(i.course)}: Focus on practice exercises</li>`
        ).join('');
    } else {
        growthList.innerHTML = '<li>Doing great across all areas!</li>';
    }
}

/**
 * Render parent tips
 */
function renderParentTips(tips) {
    const container = document.getElementById('parent-tips');
    
    const defaultTips = [
        'Practice signs together during daily routines like meals',
        'Use signs for common words at home',
        'Celebrate small wins to keep motivation high'
    ];
    
    const items = tips.length > 0 ? tips : defaultTips;
    
    container.innerHTML = items.map((tip, index) => `
        <div class="tip-card">
            <div class="tip-number">${index + 1}</div>
            <p class="tip-text">${escapeHtml(tip)}</p>
        </div>
    `).join('');
}

/**
 * Setup PDF download button
 */
function setupDownloadButton() {
    const downloadBtn = document.getElementById('download-pdf-btn');
    if (!downloadBtn) return;
    
    downloadBtn.addEventListener('click', downloadPDF);
}

/**
 * Download report as PDF
 */
async function downloadPDF() {
    const downloadBtn = document.getElementById('download-pdf-btn');
    const originalText = downloadBtn.innerHTML;
    
    try {
        downloadBtn.innerHTML = '⏳ Generating PDF...';
        downloadBtn.disabled = true;
        
        const element = document.getElementById('report-content');
        
        // Hide action buttons for PDF
        const actions = document.querySelector('.report-actions');
        if (actions) actions.style.display = 'none';
        
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `LearnSign_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        await html2pdf().set(opt).from(element).save();
        
        // Restore action buttons
        if (actions) actions.style.display = 'flex';
        
        downloadBtn.innerHTML = '✅ Downloaded!';
        setTimeout(() => {
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('[Report] PDF download error:', error);
        downloadBtn.innerHTML = '❌ Error';
        setTimeout(() => {
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }, 2000);
    }
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

