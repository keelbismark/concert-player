/**
 * Audio Engine - Web Audio API wrapper
 * With visibility change handling
 */

class AudioEngine {
    constructor() {
        this.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new this.AudioContext();
        
        // Master nodes
        this.masterGain = this.context.createGain();
        this.analyser = this.context.createAnalyser();
        
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        
        this.analyser.fftSize = 256;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        
        this.currentSource = null;
        this.currentGainNode = null;
        this.currentBuffer = null;
        
        this.isPlaying = false;
        this.isPaused = false;
        this.isLooping = false;
        
        this.startTime = 0;
        this.pausePosition = 0;
        this.playbackRate = 1;
        this.volume = 1;
        
        this.onEnded = null;
        this.onTimeUpdate = null;
        this.updateInterval = null;
        
        // NEW: Visibility change handling
        this.wasPlayingBeforeHidden = false;
        this.savedPositionBeforeHidden = 0;
        this.autoResumeOnVisible = false; // Configurable
        this.pauseOnHidden = false; // Configurable
        
        // NEW: State verification
        this.lastKnownPosition = 0;
        this.positionCheckInterval = null;
        
        // Initialize visibility handling
        this.initVisibilityHandling();
        
        // Initialize audio focus handling
        this.initAudioFocusHandling();
    }

    /**
     * NEW: Initialize visibility change handling
     */
    initVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onPageHidden();
            } else {
                this.onPageVisible();
            }
        });

        // Additional: handle window blur/focus
        window.addEventListener('blur', () => this.onWindowBlur());
        window.addEventListener('focus', () => this.onWindowFocus());

        // Handle page freeze (mobile browsers)
        if ('onfreeze' in document) {
            document.addEventListener('freeze', () => this.onPageFreeze());
            document.addEventListener('resume', () => this.onPageResume());
        }
    }

    /**
     * NEW: Initialize audio focus handling (for mobile)
     */
    initAudioFocusHandling() {
        // Handle audio interruption (phone call, etc.)
        if (this.context.onstatechange !== undefined) {
            this.context.onstatechange = () => {
                console.log('🔊 Audio context state:', this.context.state);
                
                if (this.context.state === 'interrupted') {
                    this.onAudioInterrupted();
                } else if (this.context.state === 'running' && this.wasPlayingBeforeHidden) {
                    this.onAudioResumed();
                }
            };
        }
    }

    /**
     * NEW: Handle page becoming hidden
     */
    onPageHidden() {
        console.log('📱 Page hidden, audio state:', this.isPlaying ? 'playing' : 'stopped');
        
        // Save current state
        this.wasPlayingBeforeHidden = this.isPlaying && !this.isPaused;
        this.savedPositionBeforeHidden = this.getCurrentTime();
        this.lastKnownPosition = this.savedPositionBeforeHidden;
        
        // Optionally pause on hide (configurable)
        if (this.pauseOnHidden && this.isPlaying) {
            this.pause();
            console.log('⏸ Auto-paused on page hide');
        }
        
        // Save state to localStorage for crash recovery
        this.saveEmergencyState();
    }

    /**
     * NEW: Handle page becoming visible
     */
    onPageVisible() {
        console.log('📱 Page visible, was playing:', this.wasPlayingBeforeHidden);
        
        // Verify audio state
        this.verifyAudioState();
        
        // Optionally auto-resume
        if (this.autoResumeOnVisible && this.wasPlayingBeforeHidden && !this.isPlaying) {
            console.log('▶ Auto-resuming playback');
            this.resumeFromPosition(this.savedPositionBeforeHidden);
        }
        
        this.wasPlayingBeforeHidden = false;
    }

    /**
     * NEW: Handle window blur
     */
    onWindowBlur() {
        // Less aggressive than page hidden - just save position
        if (this.isPlaying) {
            this.lastKnownPosition = this.getCurrentTime();
        }
    }

    /**
     * NEW: Handle window focus
     */
    onWindowFocus() {
        // Verify audio is still playing correctly
        this.verifyAudioState();
    }

    /**
     * NEW: Handle page freeze (mobile)
     */
    onPageFreeze() {
        console.log('❄️ Page frozen');
        this.wasPlayingBeforeHidden = this.isPlaying;
        this.savedPositionBeforeHidden = this.getCurrentTime();
        
        // Force pause to save resources
        if (this.isPlaying) {
            this.pause();
        }
        
        this.saveEmergencyState();
    }

    /**
     * NEW: Handle page resume (mobile)
     */
    onPageResume() {
        console.log('🔥 Page resumed');
        this.verifyAudioState();
    }

    /**
     * NEW: Handle audio interruption (phone call, etc.)
     */
    onAudioInterrupted() {
        console.log('📞 Audio interrupted');
        this.wasPlayingBeforeHidden = this.isPlaying;
        this.savedPositionBeforeHidden = this.getCurrentTime();
        
        if (this.isPlaying) {
            this.pause();
        }
    }

    /**
     * NEW: Handle audio resumed after interruption
     */
    onAudioResumed() {
        console.log('📞 Audio interruption ended');
        // Don't auto-resume - let user decide
    }

    /**
     * NEW: Verify audio state is consistent
     */
    verifyAudioState() {
        if (!this.isPlaying) return;
        
        // Check if source is still connected and playing
        if (this.currentSource) {
            const currentPos = this.getCurrentTime();
            const drift = Math.abs(currentPos - this.lastKnownPosition);
            
            // If position hasn't changed in a while but we think we're playing
            if (drift < 0.01 && this.isPlaying && !this.isPaused) {
                console.warn('⚠️ Audio may be stuck, current:', currentPos, 'last:', this.lastKnownPosition);
                
                // Try to recover
                this.attemptRecovery();
            }
            
            this.lastKnownPosition = currentPos;
        }
        
        // Check AudioContext state
        if (this.context.state === 'suspended') {
            console.warn('⚠️ AudioContext suspended, attempting resume');
            this.resume();
        }
    }

    /**
     * NEW: Attempt to recover audio playback
     */
    attemptRecovery() {
        if (!this.currentBuffer || !this.isPlaying) return;
        
        console.log('🔧 Attempting audio recovery...');
        
        const position = this.lastKnownPosition || this.pausePosition;
        const buffer = this.currentBuffer;
        const wasLooping = this.isLooping;
        const rate = this.playbackRate;
        const onEnded = this.onEnded;
        
        // Stop current playback
        this.cleanup();
        this.isPlaying = false;
        
        // Restart from saved position
        setTimeout(() => {
            this.play(buffer, {
                offset: position,
                loop: wasLooping,
                playbackRate: rate,
                onEnded: onEnded
            });
            console.log('✅ Audio recovered at position:', position);
        }, 100);
    }

    /**
     * NEW: Resume from specific position
     */
    resumeFromPosition(position) {
        if (!this.currentBuffer) return;
        
        this.play(this.currentBuffer, {
            offset: position,
            loop: this.isLooping,
            playbackRate: this.playbackRate,
            onEnded: this.onEnded
        });
    }

    /**
     * NEW: Save emergency state to localStorage
     */
    saveEmergencyState() {
        try {
            const state = {
                timestamp: Date.now(),
                position: this.getCurrentTime(),
                isPlaying: this.isPlaying,
                isPaused: this.isPaused,
                volume: this.volume,
                playbackRate: this.playbackRate
            };
            localStorage.setItem('audioEngineEmergencyState', JSON.stringify(state));
        } catch (e) {
            // Ignore storage errors
        }
    }

    /**
     * NEW: Load emergency state from localStorage
     */
    loadEmergencyState() {
        try {
            const json = localStorage.getItem('audioEngineEmergencyState');
            if (json) {
                return JSON.parse(json);
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    /**
     * NEW: Start position verification interval
     */
    startPositionVerification() {
        this.stopPositionVerification();
        this.positionCheckInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused) {
                const currentPos = this.getCurrentTime();
                const expectedDelta = 1; // 1 second
                const actualDelta = currentPos - this.lastKnownPosition;
                
                // If position hasn't advanced as expected
                if (actualDelta < 0.5 && actualDelta >= 0) {
                    console.warn('⚠️ Audio position stalled');
                    this.verifyAudioState();
                }
                
                this.lastKnownPosition = currentPos;
            }
        }, 1000);
    }

    /**
     * NEW: Stop position verification interval
     */
    stopPositionVerification() {
        if (this.positionCheckInterval) {
            clearInterval(this.positionCheckInterval);
            this.positionCheckInterval = null;
        }
    }

    /**
     * NEW: Configure visibility behavior
     */
    setVisibilityBehavior(options = {}) {
        if (typeof options.pauseOnHidden === 'boolean') {
            this.pauseOnHidden = options.pauseOnHidden;
        }
        if (typeof options.autoResumeOnVisible === 'boolean') {
            this.autoResumeOnVisible = options.autoResumeOnVisible;
        }
    }

    // ==================== EXISTING METHODS ====================

    async resume() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
            console.log('🔊 AudioContext resumed');
        }
    }

    async decodeAudio(arrayBuffer) {
        return await this.context.decodeAudioData(arrayBuffer);
    }

    async loadFile(file) {
        const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
        return await this.decodeAudio(arrayBuffer);
    }

    play(buffer, options = {}) {
        const {
            offset = 0,
            fadeIn = 0,
            loop = false,
            playbackRate = 1,
            onEnded = null
        } = options;

        this.cleanup();

        this.currentBuffer = buffer;
        this.isLooping = loop;
        this.playbackRate = playbackRate;
        this.onEnded = onEnded;

        this.currentSource = this.context.createBufferSource();
        this.currentSource.buffer = buffer;
        this.currentSource.loop = loop;
        this.currentSource.playbackRate.value = playbackRate;

        this.currentGainNode = this.context.createGain();
        this.currentSource.connect(this.currentGainNode);
        this.currentGainNode.connect(this.masterGain);

        // Apply current volume
        this.currentGainNode.gain.setValueAtTime(this.volume, this.context.currentTime);

        if (fadeIn > 0 && offset === 0) {
            this.currentGainNode.gain.setValueAtTime(0, this.context.currentTime);
            this.currentGainNode.gain.linearRampToValueAtTime(this.volume, this.context.currentTime + fadeIn);
        }

        this.currentSource.onended = () => {
            if (this.isPlaying && !this.isLooping) {
                this.isPlaying = false;
                this.isPaused = false;
                this.pausePosition = 0;
                this.stopUpdates();
                this.stopPositionVerification();
                if (this.onEnded) this.onEnded();
            }
        };

        this.currentSource.start(0, offset);
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        this.isPaused = false;
        this.lastKnownPosition = offset;

        this.startUpdates();
        this.startPositionVerification();
    }

    stop(fadeOut = 0, preservePosition = false) {
        if (!this.currentSource && !this.isPaused) return;

        const currentPos = this.getCurrentTime();

        const doStop = () => {
            this.cleanup();
            this.isPlaying = false;
            this.isPaused = false;
            this.stopUpdates();
            this.stopPositionVerification();
            
            if (preservePosition && currentPos > 0) {
                this.pausePosition = currentPos;
            } else {
                this.pausePosition = 0;
            }
        };

        if (fadeOut > 0 && this.currentGainNode) {
            if (preservePosition) {
                this.pausePosition = currentPos;
            }
            
            const now = this.context.currentTime;
            this.currentGainNode.gain.setValueAtTime(this.currentGainNode.gain.value, now);
            this.currentGainNode.gain.linearRampToValueAtTime(0.001, now + fadeOut);
            setTimeout(doStop, fadeOut * 1000);
        } else {
            doStop();
        }
    }

    pause() {
        if (!this.isPlaying) return;

        this.pausePosition = this.getCurrentTime();
        this.cleanup();
        this.isPlaying = false;
        this.isPaused = true;
        this.stopUpdates();
        this.stopPositionVerification();
    }

    seek(position) {
        if (!this.currentBuffer) return;

        const wasPlaying = this.isPlaying;
        const buffer = this.currentBuffer;
        const clampedPosition = Utils.clamp(position, 0, buffer.duration - 0.1);
        
        if (wasPlaying) {
            this.cleanup();
            this.isPlaying = false;
            this.play(buffer, {
                offset: clampedPosition,
                loop: this.isLooping,
                playbackRate: this.playbackRate,
                onEnded: this.onEnded
            });
        } else {
            this.pausePosition = clampedPosition;
        }
    }

    seekRelative(delta) {
        const current = this.getCurrentTime();
        this.seek(current + delta);
    }

    setPlaybackRate(rate) {
        this.playbackRate = Utils.clamp(rate, 0.5, 2);
        if (this.currentSource) {
            this.currentSource.playbackRate.value = this.playbackRate;
        }
    }

    setLoop(enabled) {
        this.isLooping = enabled;
        if (this.currentSource) {
            this.currentSource.loop = enabled;
        }
    }

    setVolume(value) {
        this.volume = Utils.clamp(value, 0, 1);
        this.masterGain.gain.setValueAtTime(this.volume, this.context.currentTime);
    }

    getCurrentTime() {
        if (this.isPlaying) {
            return (this.context.currentTime - this.startTime) * this.playbackRate;
        }
        return this.pausePosition || 0;
    }

    getDuration() {
        return this.currentBuffer ? this.currentBuffer.duration : 0;
    }

    getRemainingTime() {
        return Math.max(0, this.getDuration() - this.getCurrentTime());
    }

    getProgress() {
        const duration = this.getDuration();
        if (!duration) return 0;
        return (this.getCurrentTime() / duration) * 100;
    }

    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    cleanup() {
        if (this.currentSource) {
            this.currentSource.onended = null;
            try {
                this.currentSource.stop();
            } catch (e) {}
            this.currentSource.disconnect();
            this.currentSource = null;
        }
        if (this.currentGainNode) {
            this.currentGainNode.disconnect();
            this.currentGainNode = null;
        }
    }

    startUpdates() {
        this.stopUpdates();
        this.updateInterval = setInterval(() => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate({
                    currentTime: this.getCurrentTime(),
                    duration: this.getDuration(),
                    remaining: this.getRemainingTime(),
                    progress: this.getProgress()
                });
            }
        }, 50);
    }

    stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.cleanup();
        this.stopUpdates();
        this.stopPositionVerification();
        if (this.context.state !== 'closed') {
            this.context.close();
        }
    }
}