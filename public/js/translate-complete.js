// ====================================================================================
// COMPLETE TRANSLATION SYSTEM - ALL FEATURES FROM AMBIT INTEGRATED
// 1. Sign-to-Text Recognition
// 2. Text-to-Sign Video Playback (354 videos)
// 3. Speech Translation with Visualizer
// 4. Intelligent Text Summarizer
// ====================================================================================

class CompleteTranslationSystem {
    constructor() {
        this.currentMode = 'sign-to-text';
        this.init();
    }

    init() {
        this.initModeSwitching();
        this.initSignToText();
        this.initTextToSign();
        this.initSpeechTranslation();
        this.initSummarizer();
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
    // 1. SIGN-TO-TEXT RECOGNITION
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
            if (text && text !== 'Waiting for sign detection...') this.speakText(text);
        });

        document.getElementById('copy-translation')?.addEventListener('click', () => {
            const text = this.translationResultEl?.textContent;
            if (text && text !== 'Waiting for sign detection...') this.copyToClipboard(text);
        });
    }

    async startCamera() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } }
            });
            
            this.video.srcObject = this.mediaStream;
            this.video.play();
            this.startCameraBtn.disabled = true;
            this.startTranslateBtn.disabled = false;
            this.updateStatus('Camera started', 'success');
        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('Failed to start camera', 'error');
            alert('Could not access camera');
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
        this.updateStatus('Translating...', 'recording');
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
            console.error('Translation error:', error);
        }
    }

    displaySignResults(result) {
        const gestureText = this.detectedSignEl?.querySelector('.gesture-text');
        if (gestureText) gestureText.textContent = result.detected_sign || 'Unknown';
        
        
        if (this.translationResultEl) {
            this.translationResultEl.textContent = result.translation || 'No translation';
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
                <strong>${result.detected_sign}</strong> → ${result.translation}
            </div>
            <small>${new Date().toLocaleTimeString()}</small>
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
    // 2. TEXT-TO-SIGN VIDEO PLAYBACK (354 videos)
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
            this.showToast('⚠️ Please enter some text first!');
            return;
        }
        
        this.isPlayingSignVideo = true;
        this.isPausedSignVideo = false;
        this.currentVideoIndex = 0;
        
        this.translateToSignBtn.disabled = true;
        this.stopSignVideoBtn.style.display = 'inline-flex';
        this.loopSignVideoBtn.disabled = false;
        this.videoStatusText.textContent = 'Loading...';
        
        this.videoSequence = await this.prepareVideoSequence(text);
        
        if (this.videoSequence.length === 0) {
            this.videoStatusText.textContent = 'No videos found';
            this.translateToSignBtn.disabled = false;
            this.showToast('❌ No sign videos available for this text');
            return;
        }
        
        document.querySelector('.video-placeholder').style.display = 'none';
        this.signVideo.style.display = 'block';
        
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
                this.translateToSignBtn.textContent = '▶️ Resume';
                return;
            }
            
            this.currentVideoIndex = i;
            const item = this.videoSequence[i];
            this.videoProgressText.textContent = `${i + 1} / ${this.videoSequence.length}`;
            this.videoStatusText.textContent = `Playing: ${item.label}`;
            
            this.signVideo.src = item.path;
            this.signVideo.loop = this.isLoopingSignVideo && (i === this.videoSequence.length - 1);
            
            try {
                await this.signVideo.play();
            } catch (e) {
                console.error('Video play error:', e);
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
            this.videoStatusText.textContent = 'Completed';
            this.isPlayingSignVideo = false;
            this.translateToSignBtn.disabled = false;
            this.translateToSignBtn.textContent = '🎬 Translate to Sign Language';
            this.stopSignVideoBtn.style.display = 'none';
            this.showToast('✅ Video sequence completed!');
        }
    }

    stopSignVideo() {
        this.isPausedSignVideo = true;
        this.signVideo.pause();
        this.videoStatusText.textContent = 'Paused';
        this.translateToSignBtn.disabled = false;
        this.translateToSignBtn.textContent = '▶️ Resume';
    }

    toggleLoop() {
        this.isLoopingSignVideo = !this.isLoopingSignVideo;
        this.loopSignVideoBtn.textContent = this.isLoopingSignVideo ? '🔁 Stop Loop' : '🔁 Loop Video';
        this.loopSignVideoBtn.classList.toggle('active', this.isLoopingSignVideo);
    }

    // ====================================================================================
    // 3. SPEECH TRANSLATION WITH VISUALIZER
    // ====================================================================================
    initSpeechTranslation() {
        this.startSpeechBtn = document.getElementById('start-speech-btn');
        this.originalTextEl = document.getElementById('original-text');
        this.translatedTextEl = document.getElementById('translated-text');
        this.sourceLangSelect = document.getElementById('source-lang');
        this.targetLangSelect = document.getElementById('target-lang');
        this.audioVisualizer = document.getElementById('audio-visualizer');
        this.summarizeBtn = document.getElementById('summarize-btn');
        this.summarySection = document.getElementById('summary-section');
        this.summaryTextCard = document.getElementById('summary-text-card');
        this.summaryTextEl = document.getElementById('summary-text');
        
        this.recognition = null;
        this.isListening = false;
        this.audioContext = null;
        this.analyser = null;
        
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            
            this.recognition.onresult = (e) => this.handleSpeechResult(e);
            this.recognition.onend = () => this.stopListening();
        }
        
        this.startSpeechBtn?.addEventListener('click', () => this.toggleSpeechListening());
        this.setupSpeechActionButtons();
        this.summarizeBtn?.addEventListener('click', () => this.generateSummary());
    }

    async toggleSpeechListening() {
        if (!this.recognition) {
            alert('Speech Recognition not supported in this browser');
            return;
        }
        
        if (!this.isListening) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.startAudioVisualizer(stream);
                
                this.recognition.lang = this.sourceLangSelect.value;
                this.recognition.start();
                
                this.isListening = true;
                this.startSpeechBtn.classList.add('listening');
                this.startSpeechBtn.innerHTML = '⏹️ Stop Listening<div class="mic-bars active"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>';
                
                this.summarySection.style.display = 'none';
            } catch (error) {
                console.error('Microphone error:', error);
                alert('Failed to access microphone');
            }
        } else {
            this.recognition.stop();
            this.stopAudioVisualizer();
        }
    }

    async handleSpeechResult(event) {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript + ' ';
        }
        
        if (text.trim() !== '') {
            this.originalTextEl.textContent = text;
            
            try {
                const response = await fetch('/api/speech/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text,
                        source_lang: this.sourceLangSelect.value,
                        target_lang: this.targetLangSelect.value
                    })
                });
                
                const data = await response.json();
                this.translatedTextEl.textContent = data.translated_text || '';
            } catch (error) {
                console.error('Translation error:', error);
            }
        }
    }

    stopListening() {
        this.isListening = false;
        this.startSpeechBtn.classList.remove('listening');
        this.startSpeechBtn.innerHTML = '🎙️ Start Listening<div class="mic-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>';
        
        if (this.translatedTextEl.textContent.trim() !== '') {
            this.summarySection.style.display = 'block';
        }
    }

    startAudioVisualizer(stream) {
        if (!this.audioVisualizer) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.analyser.fftSize = 256;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const ctx = this.audioVisualizer.getContext('2d');
        this.audioVisualizer.width = 400;
        this.audioVisualizer.height = 100;
        
        const draw = () => {
            if (!this.analyser) return;
            requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, this.audioVisualizer.width, this.audioVisualizer.height);
            const barWidth = (this.audioVisualizer.width / dataArray.length) * 2.5;
            let x = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const barHeight = dataArray[i] / 2;
                ctx.fillStyle = `rgb(${barHeight + 100}, 50, 255)`;
                ctx.fillRect(x, this.audioVisualizer.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        
        draw();
    }

    stopAudioVisualizer() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        
        if (this.audioVisualizer) {
            const ctx = this.audioVisualizer.getContext('2d');
            ctx.clearRect(0, 0, this.audioVisualizer.width, this.audioVisualizer.height);
        }
    }

    setupSpeechActionButtons() {
        document.getElementById('copy-original-btn')?.addEventListener('click', () => {
            this.copyToClipboard(this.originalTextEl.textContent);
        });
        
        document.getElementById('copy-translated-btn')?.addEventListener('click', () => {
            this.copyToClipboard(this.translatedTextEl.textContent);
        });
        
        document.getElementById('copy-summary-btn')?.addEventListener('click', () => {
            this.copyToClipboard(this.summaryTextEl.textContent);
        });
        
        document.getElementById('speak-original-btn')?.addEventListener('click', () => {
            this.speakText(this.originalTextEl.textContent);
        });
        
        document.getElementById('speak-translated-btn')?.addEventListener('click', () => {
            this.speakText(this.translatedTextEl.textContent);
        });
        
        document.getElementById('speak-summary-btn')?.addEventListener('click', () => {
            this.speakText(this.summaryTextEl.textContent);
        });
    }

    async generateSummary() {
        const text = this.translatedTextEl.textContent.trim();
        if (!text) return;
        
        this.summarizeBtn.disabled = true;
        this.summarizeBtn.textContent = '⏳ Generating...';
        
        try {
            const response = await fetch('/api/speech/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            
            const data = await response.json();
            this.summaryTextEl.textContent = data.summary_text || '';
            this.summaryTextCard.style.display = 'block';
            this.showToast('✅ Summary generated!');
        } catch (error) {
            console.error('Summarization error:', error);
            this.showToast('❌ Failed to generate summary');
        } finally {
            this.summarizeBtn.disabled = false;
            this.summarizeBtn.textContent = '📝 Generate Summary';
        }
    }

    // ====================================================================================
    // 4. INTELLIGENT TEXT SUMMARIZER
    // ====================================================================================
    initSummarizer() {
        this.summarizerInput = document.getElementById('summarizer-input');
        this.wordLimitInput = document.getElementById('word-limit');
        this.summarizeTextBtn = document.getElementById('summarize-text-btn');
        this.summarizerOutput = document.getElementById('summarizer-output');
        this.summarizerResult = document.getElementById('summarizer-result');
        
        this.summarizeTextBtn?.addEventListener('click', () => this.summarizeText());
        
        document.getElementById('copy-summary-output')?.addEventListener('click', () => {
            this.copyToClipboard(this.summarizerResult.textContent);
        });
        
        document.getElementById('speak-summary-output')?.addEventListener('click', () => {
            this.speakText(this.summarizerResult.textContent);
        });
    }

    summarizeText() {
        const text = this.summarizerInput?.value.trim();
        if (!text) {
            this.showToast('⚠️ Please enter text to summarize');
            return;
        }
        
        const wordLimit = parseInt(this.wordLimitInput.value) || 50;
        const summary = this.extractiveSummarize(text, wordLimit);
        
        this.summarizerResult.textContent = summary;
        this.summarizerOutput.style.display = 'block';
        
        const originalWords = text.split(/\s+/).length;
        const summaryWords = summary.split(/\s+/).length;
        const reduction = Math.round(((originalWords - summaryWords) / originalWords) * 100);
        
        document.getElementById('original-words').textContent = originalWords;
        document.getElementById('summary-words').textContent = summaryWords;
        document.getElementById('reduction-percent').textContent = reduction + '%';
        
        this.showToast('✅ Summary created!');
    }

    extractiveSummarize(text, wordLimit) {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const freq = {};
        const stopwords = ["the","and","of","to","in","a","is","it","for","on","with","as","by","at","this","that","from","or"];
        text.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).forEach(word => {
            if (!stopwords.includes(word) && word.length > 2) {
                freq[word] = (freq[word] || 0) + 1;
            }
        });
        
        const scored = sentences.map(s => {
            let score = 0;
            s.toLowerCase().split(/\s+/).forEach(w => { if (freq[w]) score += freq[w]; });
            return { sentence: s, score };
        });
        scored.sort((a, b) => b.score - a.score);

        const summarySentences = [];
        let totalWords = 0;
        for (const s of scored) {
            const words = s.sentence.split(/\s+/).length;
            if (totalWords + words <= wordLimit) {
                summarySentences.push(s.sentence.trim());
                totalWords += words;
            }
            if (totalWords >= wordLimit) break;
        }
        if (summarySentences.length === 0) return text;
        return summarySentences.join(' ');
    }

    // ====================================================================================
    // UTILITY FUNCTIONS
    // ====================================================================================
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('✅ Copied to clipboard!');
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
            position: fixed; bottom: 30px; right: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 15px 25px; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 10000; animation: slideIn 0.3s ease; font-weight: 500;
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CompleteTranslationSystem();
    console.log('✅ Complete Translation System Loaded with all 4 modes!');
});

