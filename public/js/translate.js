// ====================================================================================
// SIGN LANGUAGE LEARNING PLATFORM
// Student-Friendly Interface for Learning and Practicing Sign Language
// ====================================================================================

class SignLanguageLearning {
    constructor() {
        this.currentMode = 'sign-to-text';
        this.init();
    }

    init() {
        this.initModeSwitching();
        this.initSignToText();
        this.initTextToSign();
    }

    // ====================================================================================
    // MODE SWITCHING
    // ====================================================================================
    initModeSwitching() {
        const modeTabs = document.querySelectorAll('.mode-tab');
        const modeContents = document.querySelectorAll('.translation-mode-content');

        modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                modeTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                modeContents.forEach(content => content.classList.remove('active'));
                document.getElementById(`${mode}-mode`)?.classList.add('active');
                this.currentMode = mode;
            });
        });
    }

    // ====================================================================================
    // SIGN-TO-TEXT: PRACTICE MODE
    // ====================================================================================
    initSignToText() {
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas?.getContext('2d');
        
        this.startCameraBtn = document.getElementById('start-camera');
        this.startTranslateBtn = document.getElementById('start-translate');
        this.stopTranslateBtn = document.getElementById('stop-translate');
        this.detectedSignEl = document.getElementById('detected-sign');
        this.translationResultEl = document.getElementById('translation-result');
        this.historyListEl = document.getElementById('history-list');
        
        this.isTranslating = false;
        this.mediaStream = null;
        this.translationInterval = null;
        this.frameBuffer = [];
        this.lastTranslation = null;
        this.lastTranslationTime = 0;
        this.selectedLanguage = 'en';
        this.translationCooldown = 1000;
        
        this.startCameraBtn?.addEventListener('click', () => this.startCamera());
        this.startTranslateBtn?.addEventListener('click', () => this.startSignTranslation());
        this.stopTranslateBtn?.addEventListener('click', () => this.stopSignTranslation());
        
        document.getElementById('target-language')?.addEventListener('change', (e) => {
            this.selectedLanguage = e.target.value;
        });

        document.getElementById('speak-translation')?.addEventListener('click', () => {
            const text = this.translationResultEl?.textContent;
            if (text && text !== 'Start practicing to see results!') this.speakText(text);
        });

        document.getElementById('copy-translation')?.addEventListener('click', () => {
            const text = this.translationResultEl?.textContent;
            if (text && text !== 'Start practicing to see results!') this.copyToClipboard(text);
        });
    }
    
    async startCamera() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });
            
            this.video.srcObject = this.mediaStream;
            this.video.play();
            this.startCameraBtn.disabled = true;
            this.startTranslateBtn.disabled = false;
            this.updateStatus('Camera ready!', 'success');
            this.showToast('✅ Camera started! Click "Start Practice" to begin');
        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('Camera failed', 'error');
            this.showToast('❌ Could not access camera. Please check permissions.');
        }
    }

    startSignTranslation() {
        if (!this.mediaStream) return;
        this.isTranslating = true;
        this.frameBuffer = [];
        this.startTranslateBtn.style.display = 'none';
        this.stopTranslateBtn.style.display = 'inline-flex';
        document.getElementById('recording-indicator').style.display = 'flex';
        this.startRealTimeTranslation();
        this.updateStatus('Practicing...', 'recording');
        this.showToast('🎯 Show your signs to the camera!');
    }
    
    stopSignTranslation() {
        this.isTranslating = false;
        this.startTranslateBtn.style.display = 'inline-flex';
        this.stopTranslateBtn.style.display = 'none';
        document.getElementById('recording-indicator').style.display = 'none';
        if (this.translationInterval) {
            clearInterval(this.translationInterval);
            this.translationInterval = null;
        }
        this.updateStatus('Ready', 'ready');
        this.showToast('✅ Practice session ended');
    }
    
    startRealTimeTranslation() {
        this.translationInterval = setInterval(() => {
            if (!this.isTranslating) return;
            this.captureFrame();
            if (this.frameBuffer.length >= 10) this.processRealTimeFrames();
            if (this.frameBuffer.length > 20) this.frameBuffer.shift();
        }, 100);
    }
    
    captureFrame() {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);
        const frameData = this.canvas.toDataURL('image/jpeg', 0.7);
        this.frameBuffer.push(frameData.split(',')[1]);
    }
    
    async processRealTimeFrames() {
        const now = Date.now();
        if (now - this.lastTranslationTime < this.translationCooldown) return;
        
        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frames: this.frameBuffer.slice(-10), language: this.selectedLanguage })
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            
            if (result.confidence > 0.3 && result.detected_sign !== 'unknown') {
                this.displaySignResults(result);
                this.lastTranslationTime = now;
                this.lastTranslation = result;
            }
        } catch (error) {
            console.error('Recognition error:', error);
        }
    }

    displaySignResults(result) {
        const gestureText = this.detectedSignEl?.querySelector('.gesture-text');
        if (gestureText) gestureText.textContent = result.detected_sign || 'Unknown';
        
        
        if (this.translationResultEl) {
            this.translationResultEl.textContent = result.translation || 'Keep trying!';
        }
        
        document.getElementById('speak-translation').disabled = false;
        document.getElementById('copy-translation').disabled = false;
        
        if (!this.lastTranslation || this.lastTranslation.detected_sign !== result.detected_sign) {
            this.addToHistory(result);
        }
    }
    
    addToHistory(result) {
        if (!this.historyListEl) return;
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        historyItem.innerHTML = `
            <div class="history-content">
                <span class="history-emoji">🌟</span>
                <div class="history-details">
                    <strong class="history-sign">${result.detected_sign}</strong>
                    <span class="history-translation"> → ${result.translation}</span>
                </div>
            </div>
            <small class="history-time">${new Date().toLocaleTimeString()}</small>
        `;
        
        const emptyState = this.historyListEl.querySelector('.history-empty');
        if (emptyState) emptyState.remove();
        
        this.historyListEl.insertBefore(historyItem, this.historyListEl.firstChild);
        
        const items = this.historyListEl.querySelectorAll('.history-item');
        if (items.length > 10) items[items.length - 1].remove();
    }

    updateStatus(message, type) {
        const statusText = document.querySelector('.status-text');
        const statusDot = document.querySelector('.status-dot');
        if (statusText) statusText.textContent = message;
        if (statusDot) statusDot.className = `status-dot ${type}`;
    }

    // ====================================================================================
    // TEXT-TO-SIGN: LEARNING MODE
    // ====================================================================================
    initTextToSign() {
        this.textToSignInput = document.getElementById('text-to-sign-input');
        this.translateToSignBtn = document.getElementById('translate-to-sign-btn');
        this.stopSignVideoBtn = document.getElementById('stop-sign-video-btn');
        this.loopSignVideoBtn = document.getElementById('loop-sign-video-btn');
        this.signVideo = document.getElementById('sign-video');
        this.videoStatusText = document.getElementById('video-status-text');
        this.videoProgressText = document.getElementById('video-progress-text');
        
        this.isPlayingSignVideo = false;
        this.isPausedSignVideo = false;
        this.isLoopingSignVideo = false;
        this.currentVideoIndex = 0;
        this.videoSequence = [];
        
        this.translateToSignBtn?.addEventListener('click', () => this.startTextToSign());
        this.stopSignVideoBtn?.addEventListener('click', () => this.stopSignVideo());
        this.loopSignVideoBtn?.addEventListener('click', () => this.toggleLoop());

        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.textToSignInput.value = btn.dataset.text;
                this.startTextToSign();
            });
        });
    }

    async startTextToSign() {
        const text = this.textToSignInput?.value.trim();
        if (!text) {
            this.showToast('⚠️ Please type something first!');
            return;
        }
        
        this.isPlayingSignVideo = true;
        this.isPausedSignVideo = false;
        this.currentVideoIndex = 0;
        
        this.translateToSignBtn.disabled = true;
        this.stopSignVideoBtn.style.display = 'inline-block';
        this.loopSignVideoBtn.disabled = false;
        this.videoStatusText.textContent = 'Loading...';
        
        this.videoSequence = await this.prepareVideoSequence(text);
        
        if (this.videoSequence.length === 0) {
            this.videoStatusText.textContent = 'Not available';
            this.translateToSignBtn.disabled = false;
            this.showToast('😕 No videos found for these words');
            return;
        }
        
        document.querySelector('.video-placeholder').style.display = 'none';
        this.signVideo.style.display = 'block';
        
        this.showToast('🎬 Playing sign language video!');
        await this.playVideoSequence(0);
    }

    async checkVideoExists(path) {
        return new Promise(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', path, true);
            xhr.onload = () => resolve(xhr.status !== 404);
            xhr.onerror = () => resolve(false);
            xhr.send();
        });
    }

    async getVideoPath(name) {
        const formats = ['.webm', '.mp4'];
        for (const ext of formats) {
            const path = `/assets/videos/signs/${name.toUpperCase()}${ext}`;
            if (await this.checkVideoExists(path)) return path;
        }
        return null;
    }

    async prepareVideoSequence(text) {
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const seq = [];
        
        for (const word of words) {
            const path = await this.getVideoPath(word);
            if (path) {
                seq.push({ path, label: word });
            } else {
                for (const letter of word.toUpperCase()) {
                    if (/[A-Z0-9]/.test(letter)) {
                        const letterPath = await this.getVideoPath(letter);
                        if (letterPath) seq.push({ path: letterPath, label: letter });
                    }
                }
            }
        }
        
        return seq;
    }

    async playVideoSequence(startIndex = 0) {
        for (let i = startIndex; i < this.videoSequence.length; i++) {
            if (this.isPausedSignVideo) {
                this.currentVideoIndex = i;
                this.translateToSignBtn.disabled = false;
                this.translateToSignBtn.innerHTML = '<span class="btn-icon">▶️</span><span>Continue</span>';
                return;
            }
            
            this.currentVideoIndex = i;
            const item = this.videoSequence[i];
            this.videoProgressText.textContent = `${i + 1} / ${this.videoSequence.length}`;
            this.videoStatusText.textContent = item.label.toUpperCase();
            
            this.signVideo.src = item.path;
            this.signVideo.loop = this.isLoopingSignVideo && (i === this.videoSequence.length - 1);
            
            try {
                await this.signVideo.play();
            } catch (e) {
                console.error('Video error:', e);
                continue;
            }
            
            await new Promise(resolve => {
                const onEnd = () => {
                    this.signVideo.removeEventListener('ended', onEnd);
                    if (!this.isLoopingSignVideo || i < this.videoSequence.length - 1) {
                        resolve(true);
                    }
                };
                
                if (!this.isLoopingSignVideo || i < this.videoSequence.length - 1) {
                    this.signVideo.addEventListener('ended', onEnd);
                }
            });
        }
        
        if (!this.isLoopingSignVideo) {
            this.videoStatusText.textContent = 'Finished!';
            this.isPlayingSignVideo = false;
            this.translateToSignBtn.disabled = false;
            this.translateToSignBtn.innerHTML = '<span class="btn-icon">▶️</span><span>Show Sign Language</span>';
            this.stopSignVideoBtn.style.display = 'none';
            this.showToast('✅ All done! Try another word?');
        }
    }

    stopSignVideo() {
        this.isPausedSignVideo = true;
        this.signVideo.pause();
        this.videoStatusText.textContent = 'Paused';
        this.translateToSignBtn.disabled = false;
        this.translateToSignBtn.innerHTML = '<span class="btn-icon">▶️</span><span>Continue</span>';
    }

    toggleLoop() {
        this.isLoopingSignVideo = !this.isLoopingSignVideo;
        this.loopSignVideoBtn.textContent = this.isLoopingSignVideo ? '🔁 Stop Loop' : '🔁 Loop';
        this.loopSignVideoBtn.classList.toggle('active', this.isLoopingSignVideo);
    }

    // ====================================================================================
    // UTILITY FUNCTIONS
    // ====================================================================================
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('✅ Copied!');
        }).catch(() => {
            this.showToast('❌ Failed to copy');
        });
    }

    speakText(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
        this.showToast('🔊 Speaking...');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 15px 25px; border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3); z-index: 10000;
            animation: slideIn 0.3s ease; font-weight: 500; font-size: 14px;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new SignLanguageLearning();
    console.log('🤟 Sign Language Learning Platform Ready!');
});
