/**
 * SignMentor AI Tutor - Client-side Chat Logic
 * LearnSign Platform
 * 
 * Features:
 * - Text chat with AI tutor
 * - Voice input using OpenAI Whisper
 * - Voice output using OpenAI TTS
 */

// State management
const TutorState = {
    userId: null,
    userProfile: null,
    conversationHistory: [],
    isLoading: false,
    isAuthenticated: false
};

// Voice State Management
const VoiceState = {
    isRecording: false,
    isPlaying: false,
    voiceEnabled: true, // TTS enabled by default
    mediaRecorder: null,
    audioChunks: [],
    recordingStartTime: null,
    recordingTimer: null,
    currentAudio: null,
    selectedLanguage: 'en', // Default language
    stream: null // Store stream for cleanup
};

// Supported languages
const SUPPORTED_LANGUAGES = {
    'en': { name: 'English', flag: '🇬🇧', native: 'English' },
    'hi': { name: 'Hindi', flag: '🇮🇳', native: 'हिंदी' },
    'kn': { name: 'Kannada', flag: '🇮🇳', native: 'ಕನ್ನಡ' },
    'te': { name: 'Telugu', flag: '🇮🇳', native: 'తెలుగు' }
};

// DOM Elements
const elements = {
    chatMessages: null,
    chatInput: null,
    sendBtn: null,
    loginModal: null,
    quickStats: {
        streak: null,
        courses: null
    },
    // Voice elements
    micBtn: null,
    speakerToggle: null,
    voiceRecordingIndicator: null,
    recordingTimer: null,
    voiceStatus: null
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    checkAuthentication();
    setupEventListeners();
    autoResizeTextarea();
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
    elements.chatMessages = document.getElementById('chat-messages');
    elements.chatInput = document.getElementById('chat-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.loginModal = document.getElementById('login-modal');
    elements.quickStats.streak = document.getElementById('stat-streak');
    elements.quickStats.courses = document.getElementById('stat-courses');
    
    // Voice elements
    elements.micBtn = document.getElementById('mic-btn');
    elements.speakerToggle = document.getElementById('speaker-toggle');
    elements.voiceRecordingIndicator = document.getElementById('voice-recording-indicator');
    elements.recordingTimer = document.getElementById('recording-timer');
    elements.voiceStatus = document.getElementById('voice-status');
    elements.languageSelect = document.getElementById('language-select');
    elements.stopRecordingBtn = document.getElementById('stop-recording-btn');
}

/**
 * Check if user is authenticated
 */
function checkAuthentication() {
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');
    
    if (userId) {
        TutorState.userId = userId;
        TutorState.isAuthenticated = true;
        loadUserProfile();
        updateWelcomeMessage(userName);
    } else {
        TutorState.isAuthenticated = false;
        // Show login modal after a short delay
        setTimeout(() => {
            showLoginModal();
        }, 2000);
    }
}

/**
 * Load user profile for personalization
 */
async function loadUserProfile() {
    try {
        const response = await fetch(`/api/tutor/profile/${TutorState.userId}`);
        if (response.ok) {
            TutorState.userProfile = await response.json();
            updateQuickStats();
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

/**
 * Update quick stats in the header
 */
function updateQuickStats() {
    if (!TutorState.userProfile) return;
    
    const { currentStreak, totalCourses } = TutorState.userProfile;
    
    if (elements.quickStats.streak) {
        elements.quickStats.streak.textContent = currentStreak || 0;
    }
    if (elements.quickStats.courses) {
        elements.quickStats.courses.textContent = totalCourses || 0;
    }
}

/**
 * Update welcome message with user name
 */
function updateWelcomeMessage(userName) {
    const welcomeMessage = document.querySelector('.welcome-message .message-body');
    if (welcomeMessage && userName) {
        const greeting = welcomeMessage.querySelector('p:first-child');
        if (greeting) {
            greeting.innerHTML = `Hello, <strong>${userName}</strong>! 👋 I'm your sign language tutor.`;
        }
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Send button click
    elements.sendBtn.addEventListener('click', handleSendMessage);
    
    // Enter key to send (Shift+Enter for new line)
    elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    // Character count update
    elements.chatInput.addEventListener('input', () => {
        updateCharCount();
        updateSendButton();
        autoResizeTextarea();
    });
    
    // Quick question buttons
    document.querySelectorAll('.quick-question-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.dataset.question;
            if (question) {
                elements.chatInput.value = question;
                updateCharCount();
                updateSendButton();
                autoResizeTextarea();
                elements.chatInput.focus();
            }
        });
    });
    
    // Voice controls
    setupVoiceEventListeners();
}

/**
 * Setup voice-related event listeners
 */
function setupVoiceEventListeners() {
    // Microphone button - click to toggle recording
    if (elements.micBtn) {
        elements.micBtn.addEventListener('click', toggleVoiceRecording);
    }
    
    // Stop recording button (in the indicator)
    if (elements.stopRecordingBtn) {
        elements.stopRecordingBtn.addEventListener('click', stopVoiceRecording);
    }
    
    // Speaker toggle button
    if (elements.speakerToggle) {
        elements.speakerToggle.addEventListener('click', toggleVoiceOutput);
    }
    
    // Language selector
    if (elements.languageSelect) {
        elements.languageSelect.addEventListener('change', (e) => {
            VoiceState.selectedLanguage = e.target.value;
            const lang = SUPPORTED_LANGUAGES[e.target.value];
            showVoiceStatus(`🌐 Language: ${lang.native} (${lang.name})`, 'info');
            setTimeout(hideVoiceStatus, 2000);
            console.log('[Voice] Language changed to:', e.target.value, lang.name);
        });
    }
}

/**
 * Toggle voice recording on/off
 */
function toggleVoiceRecording() {
    if (VoiceState.isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

/**
 * Auto-resize textarea based on content
 */
function autoResizeTextarea() {
    const textarea = elements.chatInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

/**
 * Update character count display (simplified)
 */
function updateCharCount() {
    // Character count removed from UI for cleaner look
}

/**
 * Update send button state
 */
function updateSendButton() {
    const hasContent = elements.chatInput.value.trim().length > 0;
    elements.sendBtn.disabled = !hasContent || TutorState.isLoading;
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
    const message = elements.chatInput.value.trim();
    
    if (!message || TutorState.isLoading) return;
    
    // Check authentication
    if (!TutorState.isAuthenticated) {
        showLoginModal();
        return;
    }
    
    // Add user message to UI
    addMessage(message, 'user');
    
    // Clear input
    elements.chatInput.value = '';
    updateCharCount();
    updateSendButton();
    autoResizeTextarea();
    
    // Add to conversation history
    TutorState.conversationHistory.push({
        role: 'user',
        content: message
    });
    
    // Show typing indicator
    showTypingIndicator();
    
    // Send to API
    try {
        TutorState.isLoading = true;
        updateSendButton();
        
        const response = await fetch('/api/tutor/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: TutorState.userId,
                message: message,
                conversationHistory: TutorState.conversationHistory.slice(-10)
            })
        });
        
        removeTypingIndicator();
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response');
        }
        
        const data = await response.json();
        
        // Add assistant response to UI
        addTutorResponse(data.response);
        
        // Add to conversation history
        TutorState.conversationHistory.push({
            role: 'assistant',
            content: JSON.stringify(data.response)
        });
        
        // Speak the response if voice output is enabled
        if (VoiceState.voiceEnabled && data.response?.response) {
            speakResponse(data.response.response);
        }
        
    } catch (error) {
        removeTypingIndicator();
        console.error('Chat error:', error);
        addErrorMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
        TutorState.isLoading = false;
        updateSendButton();
    }
}

/**
 * Add a message to the chat
 */
function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = sender === 'user' 
        ? getInitials(localStorage.getItem('userName') || 'U')
        : '🤟';
    
    const senderName = sender === 'user' 
        ? (localStorage.getItem('userName') || 'You')
        : 'SignMentor';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <span>${avatar}</span>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="sender-name">${senderName}</span>
                <span class="message-time">Just now</span>
            </div>
            <div class="message-body">
                <p>${escapeHtml(content)}</p>
            </div>
        </div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * Add tutor response with structured formatting
 */
function addTutorResponse(response) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message tutor-message';
    
    // Clear pending sequences before formatting (formatSignSequence will add new ones)
    window.pendingSequences = [];
    
    let bodyContent = formatTutorResponse(response);
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <span>🤟</span>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="sender-name">SignMentor</span>
                <span class="message-time">Just now</span>
            </div>
            <div class="message-body">
                ${bodyContent}
            </div>
        </div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    // Add event listeners for interactive elements
    setupResponseInteractions(messageDiv);
    
    // Initialize any pending video sequences (scripts in innerHTML don't execute!)
    if (window.pendingSequences && window.pendingSequences.length > 0) {
        window.pendingSequences.forEach(function(seq) {
            console.log('[VideoSeq] Initializing sequence from pending:', seq.sequenceId);
            
            // Create the sequence data
            window.videoSequences = window.videoSequences || {};
            window.videoSequences[seq.sequenceId] = {
                videos: seq.videos,
                currentIndex: 0,
                isPaused: false,
                isTransitioning: false,
                videoElement: null,
                sequenceId: seq.sequenceId
            };
            
            // Initialize after a short delay to ensure DOM is updated
            setTimeout(function() {
                window.initVideoSequence(seq.sequenceId);
            }, 100);
        });
        
        // Clear pending sequences
        window.pendingSequences = [];
    }
}

/**
 * Format tutor response based on type
 */
function formatTutorResponse(response) {
    let html = '';
    
    // Main response text
    if (response.response) {
        html += `<p>${formatText(response.response)}</p>`;
    }
    
    // Warning for missing words
    if (response.warning) {
        html += `<p style="color: var(--warning-color); font-size: 1.3rem;"><em>⚠️ ${escapeHtml(response.warning)}</em></p>`;
    }
    
    // Type-specific formatting
    switch (response.type) {
        case 'sign_sequence':
            html += formatSignSequence(response);
            break;
        case 'sign_instruction':
            html += formatSignInstruction(response);
            break;
        case 'not_found':
            html += formatNotFound(response);
            break;
        case 'general_help':
            html += formatGeneralHelp(response);
            break;
        case 'recommendation':
            html += formatRecommendation(response);
            break;
        case 'support':
            html += formatSupport(response);
            break;
    }
    
    return html;
}

/**
 * Format sign sequence (multiple videos for a sentence)
 */
function formatSignSequence(response) {
    let html = '';
    
    if (response.videoSequence && response.videoSequence.length > 0) {
        const sequenceId = Date.now();
        
        // Store sequence data for initialization (scripts in innerHTML don't execute!)
        window.pendingSequences = window.pendingSequences || [];
        window.pendingSequences.push({
            sequenceId: sequenceId,
            videos: response.videoSequence
        });
        
        // Word indicators at top
        html += `
            <div class="sentence-display" id="sentence-display-${sequenceId}">
                ${response.videoSequence.map((item, index) => 
                    `<span class="word-indicator ${index === 0 ? 'playing' : ''}" data-index="${index}" onclick="jumpToVideo(${sequenceId}, ${index})">${escapeHtml(item.word)}</span>`
                ).join('<span class="word-arrow">→</span>')}
            </div>
        `;
        
        // Video player
        html += `
            <div class="sign-video-container" id="video-container-${sequenceId}" data-sequence-id="${sequenceId}">
                <div class="video-header">
                    <span class="video-icon">🎥</span>
                    <span class="video-title" id="video-title-${sequenceId}">Playing: ${escapeHtml(response.videoSequence[0].word)}</span>
                    <span class="video-counter" id="video-counter-${sequenceId}">1/${response.videoSequence.length}</span>
                </div>
                <div class="video-wrapper">
                    <video 
                        class="sign-video" 
                        id="sequence-video-${sequenceId}"
                        autoplay 
                        muted
                        playsinline
                        src="${escapeHtml(response.videoSequence[0].path)}"
                    ></video>
                </div>
                <div class="video-progress-bar">
                    <div class="video-progress-fill" id="progress-${sequenceId}" style="width: ${100 / response.videoSequence.length}%"></div>
                </div>
                <div class="video-controls">
                    <button class="video-control-btn" onclick="restartSequence(${sequenceId})">🔄 Restart</button>
                    <button class="video-control-btn" onclick="togglePause(${sequenceId})">⏸️ Pause</button>
                    <button class="video-control-btn" onclick="toggleSlowMotion(this)">🐢 Slow</button>
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Format not found response with suggestions
 */
function formatNotFound(response) {
    let html = '';
    
    if (response.suggestions && response.suggestions.length > 0) {
        html += `
            <div style="margin-top: 1.5rem;">
                <p><strong>Try these instead:</strong></p>
                <div class="related-signs">
                    ${response.suggestions.map(sign => 
                        `<span class="related-sign-tag" onclick="askAboutSign('${escapeHtml(sign)}')">${escapeHtml(sign)}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    if (response.totalAvailable) {
        html += `<p style="margin-top: 1rem; font-size: 1.3rem; color: var(--dark-gray);"><em>${response.totalAvailable} signs available in our library</em></p>`;
    }
    
    return html;
}

/**
 * Format sign instruction response
 */
function formatSignInstruction(response) {
    let html = '';
    
    // VIDEO PLAYER - Show first if video is available
    if (response.videoAvailable && response.videoPath) {
        html += `
            <div class="sign-video-container">
                <div class="video-header">
                    <span class="video-icon">🎥</span>
                    <span class="video-title">Sign Demo: ${escapeHtml(response.sign || 'Sign')}</span>
                </div>
                <div class="video-wrapper">
                    <video 
                        class="sign-video" 
                        controls 
                        autoplay 
                        loop 
                        muted
                        playsinline
                        src="${escapeHtml(response.videoPath)}"
                    >
                        Your browser does not support video playback.
                    </video>
                </div>
                <div class="video-controls">
                    <button class="video-control-btn" onclick="replayVideo(this)">
                        🔄 Replay
                    </button>
                    <button class="video-control-btn" onclick="toggleSlowMotion(this)">
                        🐢 Slow Motion
                    </button>
                </div>
            </div>
        `;
    }
    
    // Step by step
    if (response.stepByStep && response.stepByStep.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header">
                    <span class="icon">📝</span>
                    <span class="title">Step-by-Step Guide</span>
                </div>
                <div class="response-card-body">
                    <ol class="steps-list">
                        ${response.stepByStep.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
                    </ol>
                </div>
            </div>
        `;
    }
    
    // Common mistakes
    if (response.commonMistakes && response.commonMistakes.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                    <span class="icon">⚠️</span>
                    <span class="title">Common Mistakes to Avoid</span>
                </div>
                <div class="response-card-body">
                    <div class="tips-grid">
                        ${response.commonMistakes.map(mistake => 
                            `<div class="tip-item">${escapeHtml(mistake)}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Memory trick
    if (response.memoryTrick) {
        html += `
            <div class="encouragement-box">
                <p><strong>💡 Memory Trick:</strong> ${escapeHtml(response.memoryTrick)}</p>
            </div>
        `;
    }
    
    // Cultural note
    if (response.culturalNote) {
        html += `<p><em>🌍 ${escapeHtml(response.culturalNote)}</em></p>`;
    }
    
    // Related signs
    if (response.relatedSigns && response.relatedSigns.length > 0) {
        html += `
            <div style="margin-top: 1.5rem;">
                <p><strong>Related Signs:</strong></p>
                <div class="related-signs">
                    ${response.relatedSigns.map(sign => 
                        `<span class="related-sign-tag" onclick="askAboutSign('${escapeHtml(sign)}')">${escapeHtml(sign)}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    // Practice exercise
    if (response.practiceExercise) {
        html += `
            <div class="response-card" style="margin-top: 1.5rem;">
                <div class="response-card-header" style="background: linear-gradient(135deg, #48BB78 0%, #38A169 100%);">
                    <span class="icon">🏋️</span>
                    <span class="title">Practice Exercise</span>
                </div>
                <div class="response-card-body">
                    <p>${escapeHtml(response.practiceExercise)}</p>
                    ${response.estimatedPracticeTime ? `<p><em>⏱️ Estimated time: ${escapeHtml(response.estimatedPracticeTime)}</em></p>` : ''}
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Replay video
 */
window.replayVideo = function(btn) {
    const video = btn.closest('.sign-video-container').querySelector('video');
    if (video) {
        video.currentTime = 0;
        video.play();
    }
};

/**
 * Toggle slow motion
 */
window.toggleSlowMotion = function(btn) {
    const video = btn.closest('.sign-video-container').querySelector('video');
    if (video) {
        if (video.playbackRate === 1) {
            video.playbackRate = 0.5;
            btn.innerHTML = '🐇 Normal';
            btn.classList.add('active');
        } else {
            video.playbackRate = 1;
            btn.innerHTML = '🐢 Slow';
            btn.classList.remove('active');
        }
    }
};

/**
 * Video Sequence Controls
 */
window.videoSequences = window.videoSequences || {};

/**
 * Initialize video sequence with proper event listeners
 */
window.initVideoSequence = function(sequenceId) {
    const sequence = window.videoSequences[sequenceId];
    if (!sequence) {
        console.log('[VideoSeq] Sequence not found:', sequenceId);
        return;
    }
    
    const video = document.getElementById(`sequence-video-${sequenceId}`);
    if (!video) {
        console.log('[VideoSeq] Video element not found:', sequenceId);
        return;
    }
    
    console.log('[VideoSeq] Initializing sequence:', sequenceId, 'with', sequence.videos.length, 'videos');
    console.log('[VideoSeq] Videos:', sequence.videos.map(v => v.word).join(' -> '));
    
    // Store reference to video element
    sequence.videoElement = video;
    sequence.isTransitioning = false;
    
    // Remove loop attribute if present
    video.removeAttribute('loop');
    
    // Function to advance to next video
    function advanceToNextVideo() {
        if (sequence.isPaused || sequence.isTransitioning) {
            return;
        }
        
        sequence.isTransitioning = true;
        
        const nextIndex = sequence.currentIndex + 1;
        
        if (nextIndex < sequence.videos.length) {
            sequence.currentIndex = nextIndex;
            console.log('[VideoSeq] >>> Advancing to:', nextIndex, sequence.videos[nextIndex].word);
            playNextVideo();
        } else {
            sequence.currentIndex = 0;
            console.log('[VideoSeq] >>> Looping back to start');
            playNextVideo();
        }
    }
    
    // Function to play the video at current index
    function playNextVideo() {
        const currentItem = sequence.videos[sequence.currentIndex];
        if (!currentItem) return;
        
        console.log('[VideoSeq] Loading:', currentItem.word, currentItem.path);
        
        // Update UI
        updateSequenceUI(sequenceId);
        
        // Set new source and play
        video.src = currentItem.path;
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(function() {
                console.log('[VideoSeq] Playing:', currentItem.word);
                sequence.isTransitioning = false;
            }).catch(function(e) {
                console.log('[VideoSeq] Play error:', e.message);
                sequence.isTransitioning = false;
            });
        } else {
            sequence.isTransitioning = false;
        }
    }
    
    // PRIMARY: Use timeupdate to detect video end (most reliable)
    video.addEventListener('timeupdate', function() {
        if (sequence.isPaused || sequence.isTransitioning) return;
        
        // Check if video has ended (within 50ms of end)
        if (video.duration > 0 && video.currentTime > 0) {
            const timeRemaining = video.duration - video.currentTime;
            if (timeRemaining < 0.05) {
                console.log('[VideoSeq] Video ending (timeupdate):', sequence.videos[sequence.currentIndex]?.word);
                advanceToNextVideo();
            }
        }
    });
    
    // BACKUP: Also listen to ended event
    video.addEventListener('ended', function() {
        console.log('[VideoSeq] Video ended event:', sequence.videos[sequence.currentIndex]?.word);
        if (!sequence.isTransitioning) {
            advanceToNextVideo();
        }
    });
    
    // Store advance function for external use
    sequence.advanceToNext = advanceToNextVideo;
    
    // Start playing first video
    console.log('[VideoSeq] Starting first video:', sequence.videos[0]?.word);
    video.play().catch(function(e) {
        console.log('[VideoSeq] Autoplay blocked:', e.message);
    });
};

/**
 * Play video at specific index (for external calls like jumpToVideo)
 */
function playVideoAtIndex(sequenceId, index) {
    const sequence = window.videoSequences[sequenceId];
    if (!sequence || !sequence.videoElement) return;
    
    const video = sequence.videoElement;
    const currentItem = sequence.videos[index];
    
    if (!currentItem) return;
    
    sequence.currentIndex = index;
    sequence.isTransitioning = false;
    
    console.log('[VideoSeq] Jump to:', index, currentItem.word);
    
    // Update UI
    updateSequenceUI(sequenceId);
    
    // Play video
    video.src = currentItem.path;
    video.play().catch(function(e) {
        console.log('[VideoSeq] Play error:', e.message);
    });
}

/**
 * Update UI elements for video sequence
 */
function updateSequenceUI(sequenceId) {
    const sequence = window.videoSequences[sequenceId];
    if (!sequence) return;
    
    const title = document.getElementById(`video-title-${sequenceId}`);
    const counter = document.getElementById(`video-counter-${sequenceId}`);
    const display = document.getElementById(`sentence-display-${sequenceId}`);
    const progress = document.getElementById(`progress-${sequenceId}`);
    
    const currentItem = sequence.videos[sequence.currentIndex];
    
    // Update title
    if (title && currentItem) {
        title.textContent = `Playing: ${currentItem.word}`;
    }
    
    // Update counter
    if (counter) {
        counter.textContent = `${sequence.currentIndex + 1}/${sequence.videos.length}`;
    }
    
    // Update word indicators
    if (display) {
        display.querySelectorAll('.word-indicator').forEach((el, idx) => {
            el.classList.remove('playing', 'done');
            if (idx < sequence.currentIndex) {
                el.classList.add('done');
            } else if (idx === sequence.currentIndex) {
                el.classList.add('playing');
            }
        });
    }
    
    // Update progress bar
    if (progress) {
        const percent = ((sequence.currentIndex + 1) / sequence.videos.length) * 100;
        progress.style.width = `${percent}%`;
    }
}

/**
 * Restart sequence from beginning
 */
window.restartSequence = function(sequenceId) {
    const sequence = window.videoSequences[sequenceId];
    if (!sequence) return;
    
    console.log('[VideoSeq] Restarting sequence');
    sequence.currentIndex = 0;
    sequence.isPaused = false;
    sequence.isTransitioning = false;
    playVideoAtIndex(sequenceId, 0);
    
    // Update pause button
    const container = document.getElementById(`video-container-${sequenceId}`);
    if (container) {
        const pauseBtn = container.querySelector('.video-control-btn:nth-child(2)');
        if (pauseBtn) pauseBtn.innerHTML = '⏸️ Pause';
    }
};

/**
 * Toggle pause/play
 */
window.togglePause = function(sequenceId) {
    const sequence = window.videoSequences[sequenceId];
    if (!sequence) return;
    
    const video = sequence.videoElement || document.getElementById(`sequence-video-${sequenceId}`);
    const container = document.getElementById(`video-container-${sequenceId}`);
    const pauseBtn = container?.querySelector('.video-control-btn:nth-child(2)');
    
    if (video) {
        if (video.paused) {
            video.play();
            sequence.isPaused = false;
            sequence.isTransitioning = false;
            if (pauseBtn) pauseBtn.innerHTML = '⏸️ Pause';
            console.log('[VideoSeq] Resumed');
        } else {
            video.pause();
            sequence.isPaused = true;
            if (pauseBtn) pauseBtn.innerHTML = '▶️ Play';
            console.log('[VideoSeq] Paused');
        }
    }
};

/**
 * Jump to specific video in sequence
 */
window.jumpToVideo = function(sequenceId, index) {
    const sequence = window.videoSequences[sequenceId];
    if (!sequence || index < 0 || index >= sequence.videos.length) return;
    
    console.log('[VideoSeq] Jumping to index:', index);
    sequence.isPaused = false;
    sequence.isTransitioning = false;
    playVideoAtIndex(sequenceId, index);
};

/**
 * Format general help response
 */
function formatGeneralHelp(response) {
    let html = '';
    
    // Key points
    if (response.keyPoints && response.keyPoints.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header">
                    <span class="icon">🎯</span>
                    <span class="title">Key Points</span>
                </div>
                <div class="response-card-body">
                    <ul>
                        ${response.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    // Available signs (if provided in fallback mode)
    if (response.availableSigns && response.availableSigns.length > 0) {
        html += `
            <div class="response-card" style="margin-top: 1.5rem;">
                <div class="response-card-header" style="background: linear-gradient(135deg, var(--success-color) 0%, #2D9B67 100%);">
                    <span class="icon">📚</span>
                    <span class="title">Try These Signs</span>
                </div>
                <div class="response-card-body">
                    <div class="related-signs">
                        ${response.availableSigns.map(sign => 
                            `<span class="related-sign-tag" onclick="askAboutSign('${escapeHtml(sign)}')">${escapeHtml(sign)}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Actionable advice
    if (response.actionableAdvice) {
        html += `
            <div class="encouragement-box">
                <p><strong>✅ Action Step:</strong> ${escapeHtml(response.actionableAdvice)}</p>
            </div>
        `;
    }
    
    // Encouragement
    if (response.encouragement) {
        html += `<p><em>💪 ${escapeHtml(response.encouragement)}</em></p>`;
    }
    
    return html;
}

/**
 * Format recommendation response
 */
function formatRecommendation(response) {
    let html = '';
    
    // Progress assessment
    if (response.progressAssessment) {
        html += `<p><strong>📊 Your Progress:</strong> ${escapeHtml(response.progressAssessment)}</p>`;
    }
    
    // Strengths
    if (response.strengths && response.strengths.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header" style="background: linear-gradient(135deg, #48BB78 0%, #38A169 100%);">
                    <span class="icon">💪</span>
                    <span class="title">Your Strengths</span>
                </div>
                <div class="response-card-body">
                    <ul>
                        ${response.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    // Areas to improve
    if (response.areasToImprove && response.areasToImprove.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                    <span class="icon">📈</span>
                    <span class="title">Areas to Focus On</span>
                </div>
                <div class="response-card-body">
                    <ul>
                        ${response.areasToImprove.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    // Recommended courses
    if (response.recommendedCourses && response.recommendedCourses.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header">
                    <span class="icon">📚</span>
                    <span class="title">Recommended Courses</span>
                </div>
                <div class="response-card-body">
                    ${response.recommendedCourses.map(course => `
                        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f8f9fc; border-radius: 8px;">
                            <p><strong>${escapeHtml(course.title || '')}</strong></p>
                            <p style="font-size: 0.85rem; color: #718096;">${escapeHtml(course.reason || '')}</p>
                            ${course.estimatedTime ? `<p style="font-size: 0.8rem;"><em>⏱️ ${escapeHtml(course.estimatedTime)}</em></p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Weekly goal
    if (response.weeklyGoal) {
        html += `
            <div class="encouragement-box">
                <p><strong>🎯 This Week's Goal:</strong> ${escapeHtml(response.weeklyGoal)}</p>
            </div>
        `;
    }
    
    // Motivation message
    if (response.motivationMessage) {
        html += `<p><em>🌟 ${escapeHtml(response.motivationMessage)}</em></p>`;
    }
    
    return html;
}

/**
 * Format support response
 */
function formatSupport(response) {
    let html = '';
    
    // Empathy
    if (response.empathy) {
        html += `<p>${escapeHtml(response.empathy)}</p>`;
    }
    
    // Diagnosis
    if (response.diagnosis) {
        html += `<p><strong>🔍 What's happening:</strong> ${escapeHtml(response.diagnosis)}</p>`;
    }
    
    // Solutions
    if (response.solutions && response.solutions.length > 0) {
        html += `
            <div class="response-card">
                <div class="response-card-header" style="background: linear-gradient(135deg, #48BB78 0%, #38A169 100%);">
                    <span class="icon">💡</span>
                    <span class="title">Solutions</span>
                </div>
                <div class="response-card-body">
                    ${response.solutions.map((sol, i) => `
                        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f8f9fc; border-radius: 8px;">
                            <p><strong>${i + 1}. ${escapeHtml(sol.solution || '')}</strong></p>
                            <p style="font-size: 0.85rem; color: #4a5568;">${escapeHtml(sol.howTo || '')}</p>
                            ${sol.timeNeeded ? `<p style="font-size: 0.8rem;"><em>⏱️ ${escapeHtml(sol.timeNeeded)}</em></p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Encouragement
    if (response.encouragement) {
        html += `
            <div class="encouragement-box">
                <p><strong>💪</strong> ${escapeHtml(response.encouragement)}</p>
            </div>
        `;
    }
    
    // Reminder of progress
    if (response.reminderOfProgress) {
        html += `<p><em>🌟 ${escapeHtml(response.reminderOfProgress)}</em></p>`;
    }
    
    return html;
}

/**
 * Add error message to chat
 */
function addErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message tutor-message';
    errorDiv.innerHTML = `
        <div class="message-avatar">
            <span>🤟</span>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="sender-name">SignMentor</span>
                <span class="message-time">Just now</span>
            </div>
            <div class="message-body">
                <div class="error-message">
                    <p>⚠️ ${escapeHtml(message)}</p>
                </div>
                <p>Please try again, or ask a different question.</p>
            </div>
        </div>
    `;
    
    elements.chatMessages.appendChild(errorDiv);
    scrollToBottom();
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'message tutor-message';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <span>🤟</span>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    elements.chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
        typingDiv.remove();
    }
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Show login modal
 */
function showLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.style.display = 'flex';
    }
}

/**
 * Close login modal (global function for onclick)
 */
window.closeLoginModal = function() {
    if (elements.loginModal) {
        elements.loginModal.style.display = 'none';
    }
};

/**
 * Setup response interactions
 */
function setupResponseInteractions(messageDiv) {
    // Related sign tags
    messageDiv.querySelectorAll('.related-sign-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const sign = tag.textContent.trim();
            askAboutSign(sign);
        });
    });
}

/**
 * Ask about a specific sign (global function)
 */
window.askAboutSign = function(sign) {
    elements.chatInput.value = sign;
    updateSendButton();
    autoResizeTextarea();
    handleSendMessage();
};

/**
 * Go to video library (global function)
 */
window.goToVideoLibrary = function(sign) {
    // Navigate to the tutorials page or show video
    window.location.href = `/tutorials/basics`;
};

/**
 * Utility: Get initials from name
 */
function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Utility: Format text with line breaks
 */
function formatText(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// ========== VOICE FUNCTIONALITY ==========

/**
 * Start voice recording
 */
async function startVoiceRecording() {
    if (VoiceState.isRecording || TutorState.isLoading) return;
    
    // Check authentication
    if (!TutorState.isAuthenticated) {
        showLoginModal();
        return;
    }
    
    try {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        VoiceState.stream = stream; // Store for cleanup
        VoiceState.isRecording = true;
        VoiceState.audioChunks = [];
        VoiceState.recordingStartTime = Date.now();
        
        // Determine best supported mime type
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = ''; // Let browser choose
                }
            }
        }
        console.log('[Voice] Using mimeType:', mimeType || 'browser default');
        console.log('[Voice] Language:', VoiceState.selectedLanguage);
        
        // Create MediaRecorder
        const recorderOptions = mimeType ? { mimeType } : {};
        VoiceState.mediaRecorder = new MediaRecorder(stream, recorderOptions);
        
        VoiceState.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                VoiceState.audioChunks.push(event.data);
            }
        };
        
        VoiceState.mediaRecorder.onstop = () => {
            // Stop all tracks
            if (VoiceState.stream) {
                VoiceState.stream.getTracks().forEach(track => track.stop());
                VoiceState.stream = null;
            }
            
            // Process the recording
            processVoiceRecording();
        };
        
        // Start recording
        VoiceState.mediaRecorder.start();
        
        // Update UI
        showRecordingIndicator();
        startRecordingTimer();
        
        // Visual feedback on button
        if (elements.micBtn) {
            elements.micBtn.classList.add('recording');
            elements.micBtn.querySelector('.mic-icon').textContent = '⏹️';
            elements.micBtn.title = 'Click to stop recording';
        }
        
        const lang = SUPPORTED_LANGUAGES[VoiceState.selectedLanguage];
        showVoiceStatus(`🎤 Recording in ${lang.native}... Click ⏹️ to stop`, 'processing');
        
        console.log('[Voice] Recording started');
        
    } catch (error) {
        console.error('[Voice] Microphone access error:', error);
        showVoiceStatus('❌ Microphone access denied. Please allow microphone access.', 'error');
        VoiceState.isRecording = false;
    }
}

/**
 * Stop voice recording
 */
function stopVoiceRecording() {
    if (!VoiceState.isRecording || !VoiceState.mediaRecorder) return;
    
    VoiceState.isRecording = false;
    
    // Stop the media recorder
    if (VoiceState.mediaRecorder.state !== 'inactive') {
        VoiceState.mediaRecorder.stop();
    }
    
    // Hide recording indicator
    hideRecordingIndicator();
    stopRecordingTimer();
    
    // Reset button visual
    if (elements.micBtn) {
        elements.micBtn.classList.remove('recording');
        elements.micBtn.querySelector('.mic-icon').textContent = '🎤';
        elements.micBtn.title = 'Click to start recording';
    }
    
    console.log('[Voice] Recording stopped');
}

/**
 * Process voice recording and send to API
 */
async function processVoiceRecording() {
    console.log('[Voice] Processing recording, chunks:', VoiceState.audioChunks.length);
    
    if (VoiceState.audioChunks.length === 0) {
        showVoiceStatus('⚠️ No audio recorded. Hold the mic button while speaking.', 'warning');
        return;
    }
    
    // Check minimum recording duration (0.5 seconds)
    const duration = Date.now() - VoiceState.recordingStartTime;
    console.log('[Voice] Recording duration:', duration, 'ms');
    
    if (duration < 500) {
        showVoiceStatus('⚠️ Recording too short. Hold the button longer while speaking.', 'warning');
        return;
    }
    
    showVoiceStatus('🔄 Processing your voice...', 'processing');
    
    try {
        // Create audio blob - use the actual mimeType from recorder
        const mimeType = VoiceState.mediaRecorder?.mimeType || 'audio/webm';
        console.log('[Voice] Creating blob with mimeType:', mimeType);
        const audioBlob = new Blob(VoiceState.audioChunks, { type: mimeType });
        console.log('[Voice] Blob size:', audioBlob.size, 'bytes');
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            console.log('[Voice] Base64 audio length:', base64Audio?.length || 0);
            
            // Show typing indicator
            showTypingIndicator();
            TutorState.isLoading = true;
            updateSendButton();
            
            try {
                console.log('[Voice] Sending to API with language:', VoiceState.selectedLanguage);
                // Send to voice chat API
                const response = await fetch('/api/voice/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: TutorState.userId,
                        audio: base64Audio,
                        language: VoiceState.selectedLanguage,
                        conversationHistory: TutorState.conversationHistory.slice(-10),
                        voiceEnabled: VoiceState.voiceEnabled
                    })
                });
                
                console.log('[Voice] API response status:', response.status);
                removeTypingIndicator();
                hideVoiceStatus();
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to process voice');
                }
                
                const data = await response.json();
                
                // Add user's transcribed message to chat
                if (data.transcription) {
                    addMessage(data.transcription, 'user');
                    TutorState.conversationHistory.push({
                        role: 'user',
                        content: data.transcription
                    });
                }
                
                // Add tutor response to chat
                if (data.response) {
                    addTutorResponse(data.response);
                    TutorState.conversationHistory.push({
                        role: 'assistant',
                        content: JSON.stringify(data.response)
                    });
                }
                
                // Play TTS audio if available and voice is enabled
                if (data.audio && VoiceState.voiceEnabled) {
                    playTTSAudio(data.audio);
                }
                
            } catch (error) {
                removeTypingIndicator();
                console.error('[Voice] API error:', error);
                const errorMsg = error.message || 'Failed to process voice';
                showVoiceStatus(`❌ ${errorMsg}`, 'error');
                addErrorMessage(errorMsg + '. Please try again or type your message.');
            } finally {
                TutorState.isLoading = false;
                updateSendButton();
            }
        };
        
        reader.onerror = (error) => {
            console.error('[Voice] FileReader error:', error);
            showVoiceStatus('❌ Failed to read audio data.', 'error');
        };
        
    } catch (error) {
        console.error('[Voice] Processing error:', error);
        showVoiceStatus('❌ Error processing audio. Please try again.', 'error');
    }
}

/**
 * Play TTS audio response
 */
function playTTSAudio(base64Audio) {
    try {
        // Stop any currently playing audio
        if (VoiceState.currentAudio) {
            VoiceState.currentAudio.pause();
            VoiceState.currentAudio = null;
        }
        
        // Create audio element
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        VoiceState.currentAudio = audio;
        VoiceState.isPlaying = true;
        
        // Update speaker button to show playing state
        if (elements.speakerToggle) {
            elements.speakerToggle.classList.add('playing');
        }
        
        audio.onended = () => {
            VoiceState.isPlaying = false;
            VoiceState.currentAudio = null;
            if (elements.speakerToggle) {
                elements.speakerToggle.classList.remove('playing');
            }
        };
        
        audio.onerror = (e) => {
            console.error('[Voice] Audio playback error:', e);
            VoiceState.isPlaying = false;
            VoiceState.currentAudio = null;
            if (elements.speakerToggle) {
                elements.speakerToggle.classList.remove('playing');
            }
        };
        
        // Play the audio
        audio.play().catch(e => {
            console.error('[Voice] Failed to play audio:', e);
        });
        
        console.log('[Voice] Playing TTS audio');
        
    } catch (error) {
        console.error('[Voice] TTS playback error:', error);
    }
}

/**
 * Toggle voice output (TTS) on/off
 */
function toggleVoiceOutput() {
    VoiceState.voiceEnabled = !VoiceState.voiceEnabled;
    
    if (elements.speakerToggle) {
        if (VoiceState.voiceEnabled) {
            elements.speakerToggle.classList.add('active');
            elements.speakerToggle.querySelector('.speaker-icon').textContent = '🔊';
            elements.speakerToggle.title = 'Voice responses ON (click to disable)';
            showVoiceStatus('🔊 Voice responses enabled', 'success');
        } else {
            elements.speakerToggle.classList.remove('active');
            elements.speakerToggle.querySelector('.speaker-icon').textContent = '🔇';
            elements.speakerToggle.title = 'Voice responses OFF (click to enable)';
            showVoiceStatus('🔇 Voice responses disabled', 'info');
            
            // Stop any currently playing audio
            if (VoiceState.currentAudio) {
                VoiceState.currentAudio.pause();
                VoiceState.currentAudio = null;
                VoiceState.isPlaying = false;
            }
        }
    }
    
    // Auto-hide status after 2 seconds
    setTimeout(hideVoiceStatus, 2000);
}

/**
 * Show recording indicator
 */
function showRecordingIndicator() {
    if (elements.voiceRecordingIndicator) {
        elements.voiceRecordingIndicator.style.display = 'flex';
    }
}

/**
 * Hide recording indicator
 */
function hideRecordingIndicator() {
    if (elements.voiceRecordingIndicator) {
        elements.voiceRecordingIndicator.style.display = 'none';
    }
}

/**
 * Start recording timer
 */
function startRecordingTimer() {
    let seconds = 0;
    VoiceState.recordingTimer = setInterval(() => {
        seconds++;
        if (elements.recordingTimer) {
            elements.recordingTimer.textContent = `${seconds}s`;
        }
        
        // Max recording time: 30 seconds
        if (seconds >= 30) {
            stopVoiceRecording();
            showVoiceStatus('⏱️ Maximum recording time reached (30s)', 'warning');
        }
    }, 1000);
}

/**
 * Stop recording timer
 */
function stopRecordingTimer() {
    if (VoiceState.recordingTimer) {
        clearInterval(VoiceState.recordingTimer);
        VoiceState.recordingTimer = null;
    }
    if (elements.recordingTimer) {
        elements.recordingTimer.textContent = '0s';
    }
}

/**
 * Show voice status message
 */
function showVoiceStatus(message, type = 'info') {
    if (elements.voiceStatus) {
        elements.voiceStatus.textContent = message;
        elements.voiceStatus.className = `voice-status ${type}`;
        elements.voiceStatus.style.display = 'block';
    }
}

/**
 * Hide voice status message
 */
function hideVoiceStatus() {
    if (elements.voiceStatus) {
        elements.voiceStatus.style.display = 'none';
    }
}

/**
 * Request TTS for existing text response (for text chat)
 */
async function speakResponse(text) {
    if (!VoiceState.voiceEnabled || !text) return;
    
    try {
        const response = await fetch('/api/voice/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice: 'nova'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.audio) {
                playTTSAudio(data.audio);
            }
        }
    } catch (error) {
        console.error('[Voice] TTS request error:', error);
    }
}

