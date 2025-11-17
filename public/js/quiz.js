/**
 * Quiz page with sign language recognition functionality
 * Fixed version with proper frame capture and API communication
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Quiz page loaded, initializing...');
    
    // DOM Elements
    const webcamElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('canvas');
    const startQuizBtn = document.getElementById('start-quiz');
    const submitSignBtn = document.getElementById('submit-sign');
    const nextQuestionBtn = document.getElementById('next-question');
    const restartQuizBtn = document.getElementById('restart-quiz');
    const currentPromptElement = document.getElementById('current-prompt');
    const currentQuestionElement = document.getElementById('current-question');
    const totalQuestionsElement = document.getElementById('total-questions');
    const progressIndicator = document.querySelector('.progress-indicator');
    const countdownElement = document.getElementById('countdown');
    const feedbackElement = document.getElementById('feedback');
    const quizResultsElement = document.querySelector('.quiz-results-section');
    const scoreElement = document.getElementById('score');
    const maxScoreElement = document.getElementById('max-score');
    const resultMessageElement = document.getElementById('result-message');
    
    // Quiz state
    let stream = null;
    let currentQuestionIndex = 0;
    let score = 0;
    let questions = [];
    let isCapturing = false;
    let countdownTimer = null;
    let captureTimer = null;
    let quizStartTime = null;
    let totalTimeSpent = 0;
    let capturedFrames = []; // Make this global to prevent loss
    
    // Constants - FIXED VALUES
    const API_URL = '/api/quiz'; // Use Node proxy to FastAPI
    const COUNTDOWN_DURATION = 3; // Seconds
    const CAPTURE_DURATION = 3; // Reduced to 3 seconds for better UX
    const CAPTURE_INTERVAL = 100; // Capture every 100ms (10 FPS)
    const MIN_FRAMES_REQUIRED = 20; // Minimum frames needed
    const MAX_FRAMES = 30; // Maximum number of frames to capture
    const IMAGE_QUALITY = 0.7; // Slightly better quality
    const IMAGE_SCALE = 0.5; // Scale factor for image size
    
    // Enable debug mode
    const DEBUG = true;
    
    // Debug logging function
    function debugLog(...args) {
        if (DEBUG) {
            console.log('[Quiz Debug]', ...args);
        }
    }
    
    // Initialize quiz
    function initQuiz() {
        try {
            console.log('🚀 Starting quiz initialization...');
            
            // Quiz questions - matching trained signs
            questions = [
                { prompt: "Show the sign for number 1", answer: "one" },
                { prompt: "Show the sign for number 2", answer: "two" },
                { prompt: "Show the sign for number 3", answer: "three" },
                { prompt: "Show the sign for letter A", answer: "a" },
                { prompt: "Show the sign for letter B", answer: "b" },
                { prompt: "Show the sign for letter C", answer: "c" }
            ];
            
            debugLog('Quiz initialized with questions:', questions);
            
            // Update UI elements
            if (totalQuestionsElement) {
                totalQuestionsElement.textContent = questions.length;
            }
            
            if (maxScoreElement) {
                maxScoreElement.textContent = questions.length;
            }
            
            // Reset quiz state
            currentQuestionIndex = 0;
            score = 0;
            quizStartTime = Date.now();
            totalTimeSpent = 0;
            capturedFrames = [];
            
            // Set up first question
            setCurrentQuestion();
            
            console.log('✅ Quiz initialization completed successfully');
        } catch (error) {
            console.error('❌ Error during quiz initialization:', error);
        }
    }
    
    // Update UI with current question
    function setCurrentQuestion() {
        try {
            const question = questions[currentQuestionIndex];
            
            if (!question) {
                console.error('❌ No question found for index:', currentQuestionIndex);
                return;
            }
            
            if (currentPromptElement) {
                currentPromptElement.textContent = question.prompt;
            }
            
            if (currentQuestionElement) {
                currentQuestionElement.textContent = currentQuestionIndex + 1;
            }
            
            // Update progress bar
            if (progressIndicator) {
                const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;
                progressIndicator.style.width = `${progressPercentage}%`;
                
                // Update percentage text
                const percentageText = document.querySelector('.progress-percentage');
                if (percentageText) {
                    percentageText.textContent = `${Math.round(progressPercentage)}%`;
                }
            }
            
            debugLog(`Current question: ${question.prompt} (answer: ${question.answer})`);
        } catch (error) {
            console.error('❌ Error in setCurrentQuestion:', error);
        }
    }
    
    // Start webcam stream
    async function startWebcam() {
        try {
            // Stop any existing stream
            if (stream) {
                stopWebcam();
            }
            
            debugLog('Starting webcam...');
            
            // Request camera with optimized settings
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                }
            };
            
            // Get user media
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            webcamElement.srcObject = stream;
            
            debugLog('Webcam stream acquired successfully');
            
            // Wait for video to be ready
            return new Promise((resolve) => {
                webcamElement.onloadedmetadata = () => {
                    webcamElement.play().then(() => {
                        debugLog('Webcam video playback started');
                        // Update camera status
                        const statusText = document.querySelector('.status-text');
                        if (statusText) {
                            statusText.textContent = 'Camera Active';
                        }
                        resolve();
                    }).catch(error => {
                        console.error('Error playing video:', error);
                        resolve();
                    });
                };
            });
        } catch (error) {
            console.error('Error accessing webcam:', error);
            alert('Unable to access the webcam. Please make sure you have a webcam connected and have granted permission to use it.');
            throw error;
        }
    }
    
    // Stop webcam stream
    function stopWebcam() {
        if (stream) {
            debugLog('Stopping webcam stream');
            stream.getTracks().forEach(track => track.stop());
            webcamElement.srcObject = null;
            stream = null;
            
            // Update camera status
            const statusText = document.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = 'Camera Stopped';
            }
        }
    }
    
    // Capture image from webcam with size reduction
    function captureImage() {
        // Check if webcam is ready
        if (!webcamElement.videoWidth || !webcamElement.videoHeight) {
            console.warn('Webcam not ready yet');
            return null;
        }
        
        // Calculate new dimensions (scaled down)
        const scaledWidth = Math.floor(webcamElement.videoWidth * IMAGE_SCALE);
        const scaledHeight = Math.floor(webcamElement.videoHeight * IMAGE_SCALE);
        
        // Set canvas dimensions to the scaled size
        canvasElement.width = scaledWidth;
        canvasElement.height = scaledHeight;
        
        // Draw the video frame to the canvas, scaled down
        const context = canvasElement.getContext('2d');
        context.drawImage(webcamElement, 0, 0, scaledWidth, scaledHeight);
        
        // Convert canvas to base64 image with reduced quality
        const imageData = canvasElement.toDataURL('image/jpeg', IMAGE_QUALITY);
        
        // Return just the base64 string without the data URL prefix
        const base64String = imageData.split(',')[1];
        debugLog('Image captured, size:', Math.round(base64String.length / 1024), 'KB');
        return base64String;
    }
    
    // Start capturing frames for sign recognition - FIXED VERSION
    function startCapturing() {
        if (isCapturing) {
            debugLog('Already capturing, ignoring request');
            return;
        }
        
        // Reset state
        isCapturing = true;
        capturedFrames = []; // Reset frames array
        submitSignBtn.disabled = true;
        
        debugLog('Starting capture sequence');
        
        // Show recording indicator
        const recordingIndicator = document.getElementById('recording-indicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'flex';
        }
        
        // Display countdown
        let countdownSeconds = COUNTDOWN_DURATION;
        countdownElement.textContent = countdownSeconds;
        countdownElement.style.display = 'block';
        countdownElement.style.fontSize = '48px';
        countdownElement.style.color = '#ff6b6b';
        
        // Countdown phase
        countdownTimer = setInterval(() => {
            countdownSeconds--;
            
            if (countdownSeconds <= 0) {
                clearInterval(countdownTimer);
                countdownElement.style.display = 'none';
                
                // Start the actual capture phase
                startActualCapture();
            } else {
                countdownElement.textContent = countdownSeconds;
            }
        }, 1000);
    }
    
    // Actual capture phase - IMPROVED VERSION
    function startActualCapture() {
        let captureCount = 0;
        const startTime = Date.now();
        
        // Show recording status
        countdownElement.textContent = 'RECORDING...';
        countdownElement.style.display = 'block';
        countdownElement.style.fontSize = '24px';
        countdownElement.style.color = '#4CAF50';
        
        debugLog('Starting frame capture phase');
        
        // Capture frames at regular intervals
        captureTimer = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            
            // Check if we should stop capturing
            if (elapsedTime >= CAPTURE_DURATION * 1000 || capturedFrames.length >= MAX_FRAMES) {
                // Stop capture
                clearInterval(captureTimer);
                finishCapture();
                return;
            }
            
            // Capture frame
            const frame = captureImage();
            if (frame) {
                capturedFrames.push(frame);
                captureCount++;
                
                // Update UI with capture progress
                const remainingTime = Math.ceil((CAPTURE_DURATION * 1000 - elapsedTime) / 1000);
                countdownElement.textContent = `RECORDING... ${capturedFrames.length} frames (${remainingTime}s)`;
                
                debugLog(`Captured frame ${capturedFrames.length}/${MAX_FRAMES}`);
            }
        }, CAPTURE_INTERVAL);
    }
    
    // Finish capture and submit - IMPROVED VERSION
    function finishCapture() {
        // Hide recording indicators
        countdownElement.style.display = 'none';
        const recordingIndicator = document.getElementById('recording-indicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'none';
        }
        
        isCapturing = false;
        
        debugLog(`Capture complete. Total frames: ${capturedFrames.length}`);
        
        // Check if we have enough frames
        if (capturedFrames.length < MIN_FRAMES_REQUIRED) {
            alert(`Not enough frames captured (${capturedFrames.length}/${MIN_FRAMES_REQUIRED}). Please try again with better hand positioning.`);
            submitSignBtn.disabled = false;
            capturedFrames = [];
            return;
        }
        
        // Submit the captured frames
        submitSign(capturedFrames);
    }
    
    // Submit captured frames to backend - FIXED VERSION
    async function submitSign(frames) {
        try {
            if (!frames || frames.length === 0) {
                alert('No frames were captured. Please try again.');
                submitSignBtn.disabled = false;
                return;
            }
            
            debugLog(`Submitting ${frames.length} frames for analysis`);
            
            // Current question
            const question = questions[currentQuestionIndex];
            
            // Show loading indicator
            feedbackElement.innerHTML = '<div class="feedback-content"><div class="feedback-icon">⏳</div><div class="feedback-text">Processing your sign...</div></div>';
            feedbackElement.className = 'feedback-panel';
            feedbackElement.style.display = 'block';
            feedbackElement.style.opacity = '1';
            
            // Prepare data for API
            const requestData = {
                frames: frames,
                expectedSign: question.answer
            };
            
            debugLog('Sending request to:', API_URL);
            debugLog('Expected sign:', question.answer);
            debugLog('Number of frames:', frames.length);
            
            // Send to backend with proper error handling
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', response.status, errorText);
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            debugLog('Recognition result:', result);
            
            // Display feedback
            showFeedback(result.isCorrect, result.predictedSign, result.confidence);
            
            // Update score if correct
            if (result.isCorrect) {
                score++;
                debugLog('Score increased to', score);
            }
            
            // Enable next question button
            nextQuestionBtn.style.display = 'inline-block';
            submitSignBtn.disabled = true;
            
        } catch (error) {
            console.error('Error submitting sign:', error);
            
            // Show error feedback
            feedbackElement.innerHTML = '<div class="feedback-content error"><div class="feedback-icon">❌</div><div class="feedback-text">Failed to analyze sign. Please check your connection and try again.</div></div>';
            feedbackElement.style.display = 'block';
            feedbackElement.style.opacity = '1';
            
            // Re-enable submit button
            submitSignBtn.disabled = false;
            capturedFrames = []; // Clear frames
        }
    }
    
    // Show feedback - ENHANCED VERSION
    function showFeedback(isCorrect, predictedSign, confidence) {
        // Create feedback message
        let message;
        let icon;
        if (isCorrect) {
            icon = '✅';
            message = `Correct! Well done!`;
        } else {
            icon = '❌';
            message = `Incorrect. You showed "${predictedSign}"`;
        }
        
        debugLog('Showing feedback:', message);
        
        // Update feedback panel
        feedbackElement.innerHTML = `
            <div class="feedback-content ${isCorrect ? 'success' : 'error'}">
                <div class="feedback-icon">${icon}</div>
                <div class="feedback-text">${message}</div>
            </div>
        `;
        feedbackElement.style.display = 'block';
        feedbackElement.style.opacity = '1';
        
        // Show webcam overlay feedback
        showWebcamFeedback(isCorrect);
        
        // Play sound feedback
        playFeedbackSound(isCorrect);
    }
    
    // Show visual feedback on webcam overlay
    function showWebcamFeedback(isCorrect) {
        const webcamOverlay = document.querySelector('.webcam-overlay');
        if (!webcamOverlay) return;
        
        // Remove any existing feedback classes
        webcamOverlay.classList.remove('feedback-correct', 'feedback-incorrect');
        
        // Add appropriate feedback class
        const feedbackClass = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
        webcamOverlay.classList.add(feedbackClass);
        
        // Remove the feedback class after animation
        setTimeout(() => {
            webcamOverlay.classList.remove(feedbackClass);
        }, 2000);
    }
    
    // Play feedback sound
    function playFeedbackSound(isCorrect) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            if (isCorrect) {
                // Success sound
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
            } else {
                // Error sound
                oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(293.66, audioContext.currentTime + 0.1);
            }
            
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            debugLog('Audio feedback not available:', error.message);
        }
    }
    
    // Move to next question
    function nextQuestion() {
        debugLog('Moving to next question');
        
        // Reset UI
        feedbackElement.style.display = 'none';
        capturedFrames = [];
        
        currentQuestionIndex++;
        
        if (currentQuestionIndex < questions.length) {
            // More questions remain
            setCurrentQuestion();
            submitSignBtn.disabled = false;
            nextQuestionBtn.style.display = 'none';
        } else {
            // End of quiz
            endQuiz();
        }
    }
    
    // End quiz and show results
    async function endQuiz() {
        debugLog('Quiz completed. Final score:', score);
        
        // Stop webcam
        stopWebcam();
        
        // Calculate total time spent
        if (quizStartTime) {
            totalTimeSpent = Math.round((Date.now() - quizStartTime) / 1000);
        }
        
        // Update score
        scoreElement.textContent = score;
        
        // Calculate percentage
        const percentage = Math.round((score / questions.length) * 100);
        
        // Update UI elements
        const accuracyElement = document.getElementById('accuracy');
        if (accuracyElement) {
            accuracyElement.textContent = `${percentage}%`;
        }
        
        const scorePercentageElement = document.getElementById('score-percentage');
        if (scorePercentageElement) {
            scorePercentageElement.textContent = `${percentage}%`;
        }
        
        const totalTimeElement = document.getElementById('total-time');
        if (totalTimeElement) {
            const minutes = Math.floor(totalTimeSpent / 60);
            const seconds = totalTimeSpent % 60;
            totalTimeElement.textContent = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        }
        
        // Calculate rating
        const ratingElement = document.getElementById('rating');
        if (ratingElement) {
            let stars = Math.ceil(percentage / 20); // 1-5 stars
            ratingElement.textContent = '⭐'.repeat(Math.max(1, stars));
        }
        
        // Set result message
        let message;
        if (percentage >= 80) {
            message = '🎉 Excellent! You have mastered these signs!';
        } else if (percentage >= 60) {
            message = '👍 Good job! Keep practicing to improve.';
        } else if (percentage >= 40) {
            message = '💪 Nice effort! More practice will help.';
        } else {
            message = '📚 Keep learning! Practice makes perfect.';
        }
        
        resultMessageElement.textContent = message;
        
        // Submit quiz results to API
        await submitQuizResults(score, percentage, totalTimeSpent);
        
        // Show results panel
        document.querySelector('.webcam-container').style.display = 'none';
        document.querySelector('.quiz-progress').style.display = 'none';
        document.querySelector('.quiz-prompt').style.display = 'none';
        quizResultsElement.style.display = 'block';
    }
    
    // Submit quiz results to backend API
    async function submitQuizResults(finalScore, percentage, timeSpent) {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.warn('No userId found, skipping quiz result submission');
                return;
            }
            
            // Get courseId from URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const courseId = urlParams.get('id') || urlParams.get('courseId') || 'quiz-001';
            const quizId = 'quiz-' + Date.now();
            
            const quizData = {
                userId,
                courseId,
                quizId,
                score: percentage,
                totalQuestions: questions.length,
                correct: finalScore,
                timeMs: timeSpent * 1000,
                passed: percentage >= 60,
                answers: [] // Could be enhanced to track individual answers
            };
            
            console.log('Submitting quiz results:', quizData);
            
            // Use relative URL to work in both development and production
            const response = await fetch(`/api/quizzes/${courseId}/${quizId}/attempts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quizData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Quiz results saved successfully:', result);
            } else {
                console.error('Failed to save quiz results:', response.status);
            }
        } catch (error) {
            console.error('Error submitting quiz results:', error);
        }
    }
    
    // Cancel ongoing capture
    function cancelCapture() {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        
        if (captureTimer) {
            clearInterval(captureTimer);
            captureTimer = null;
        }
        
        countdownElement.style.display = 'none';
        isCapturing = false;
        capturedFrames = [];
        
        const recordingIndicator = document.getElementById('recording-indicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'none';
        }
        
        debugLog('Capture canceled');
    }
    
    // Event Listeners
    startQuizBtn.addEventListener('click', async () => {
        try {
            startQuizBtn.disabled = true;
            startQuizBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Starting...</span>';
            
            await startWebcam();
            
            // Hide start button, show submit button
            startQuizBtn.style.display = 'none';
            submitSignBtn.disabled = false;
            
            // Initialize/reset quiz
            initQuiz();
            
        } catch (error) {
            console.error('Error starting quiz:', error);
            startQuizBtn.disabled = false;
            startQuizBtn.innerHTML = '<span class="btn-icon">🚀</span><span>Start Quiz</span>';
        }
    });
    
    submitSignBtn.addEventListener('click', () => {
        if (!isCapturing) {
            startCapturing();
        }
    });
    
    nextQuestionBtn.addEventListener('click', nextQuestion);
    
    restartQuizBtn.addEventListener('click', () => {
        // Reset UI
        document.querySelector('.webcam-container').style.display = 'block';
        document.querySelector('.quiz-progress').style.display = 'block';
        document.querySelector('.quiz-prompt').style.display = 'block';
        quizResultsElement.style.display = 'none';
        
        // Reset buttons
        submitSignBtn.disabled = true;
        nextQuestionBtn.style.display = 'none';
        startQuizBtn.style.display = 'inline-block';
        startQuizBtn.disabled = false;
        startQuizBtn.innerHTML = '<span class="btn-icon">🚀</span><span>Start Quiz</span>';
        
        // Cancel any ongoing capture
        cancelCapture();
        
        // Stop webcam
        stopWebcam();
        
        debugLog('Quiz restarted');
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            cancelCapture();
        }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        stopWebcam();
        cancelCapture();
    });
    
    // Initialize on page load
    console.log('🎯 Quiz module loaded and ready');
    
    // Set initial state
    if (currentPromptElement) {
        currentPromptElement.textContent = 'Click "Start Quiz" to begin';
    }
    
    // Verify API connectivity on load
    fetch('/')
        .then(response => response.text())
        .then(() => {
            console.log('✅ Web server is running');
        })
        .catch(() => {
            console.error('⚠️ Web server not responding. Ensure the Node server (index.js) is running on port 3000.');
            alert('Warning: Frontend server is not running. Please start the Node server on port 3000.');
        });
});