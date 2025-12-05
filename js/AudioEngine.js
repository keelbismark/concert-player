/**
 * Audio Engine - Web Audio API wrapper
 */

class AudioEngine {
    constructor() {
        this.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new this.AudioContext();
        
        // Master nodes
        this.masterGain = this.context.createGain();
        this.analyser = this.context.createAnalyser();
        
        // Connect: source -> trackGain -> masterGain -> analyser -> destination
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        
        // Analyser config
        this.analyser.fftSize = 256;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        
        // Current playback state
        this.currentSource = null;
        this.currentGainNode = null;
        this.currentBuffer = null;
        
        this.isPlaying = false;
        this.isPaused = false;
        this.isLooping = false;
        
        this.startTime = 0;
        this.pausePosition = 0;
        this.playbackRate = 1;
        
        // Callbacks
        this.onEnded = null;
        this.onTimeUpdate = null;
        
        // Timer
        this.updateInterval = null;
    }

    /**
     * Resume audio context (required after user interaction)
     */
    async resume() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    /**
     * Decode audio file to buffer
     */
    async decodeAudio(arrayBuffer) {
        return await this.context.decodeAudioData(arrayBuffer);
    }

    /**
     * Load and decode audio file
     */
    async loadFile(file) {
        const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
        return await this.decodeAudio(arrayBuffer);
    }

    /**
     * Play audio buffer
     */
    play(buffer, options = {}) {
        const {
            offset = 0,
            fadeIn = 0,
            loop = false,
            playbackRate = 1,
            onEnded = null
        } = options;

        // Cleanup previous
        this.cleanup();

        this.currentBuffer = buffer;
        this.isLooping = loop;
        this.playbackRate = playbackRate;
        this.onEnded = onEnded;

        // Create source
        this.currentSource = this.context.createBufferSource();
        this.currentSource.buffer = buffer;
        this.currentSource.loop = loop;
        this.currentSource.playbackRate.value = playbackRate;

        // Create gain for this track
        this.currentGainNode = this.context.createGain();
        this.currentSource.connect(this.currentGainNode);
        this.currentGainNode.connect(this.masterGain);

        // Fade in
        if (fadeIn > 0 && offset === 0) {
            this.currentGainNode.gain.setValueAtTime(0, this.context.currentTime);
            this.currentGainNode.gain.linearRampToValueAtTime(1, this.context.currentTime + fadeIn);
        }

        // Handle ended
        this.currentSource.onended = () => {
            if (this.isPlaying && !this.isLooping) {
                this.isPlaying = false;
                this.isPaused = false;
                this.pausePosition = 0;
                this.stopUpdates();
                if (this.onEnded) this.onEnded();
            }
        };

        // Start playback
        this.currentSource.start(0, offset);
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        this.isPaused = false;
        // НЕ сбрасываем pausePosition здесь!

        this.startUpdates();
    }

    /**
     * Stop playback with optional fade out
     * @param {number} fadeOut - fade out duration in seconds
     * @param {boolean} preservePosition - save position for resume (default: false)
     */
    stop(fadeOut = 0, preservePosition = false) {
        if (!this.currentSource && !this.isPaused) return;

        // Сохраняем позицию ДО остановки
        const currentPos = this.getCurrentTime();

        const doStop = () => {
            this.cleanup();
            this.isPlaying = false;
            this.isPaused = false;
            this.stopUpdates();
            
            if (preservePosition && currentPos > 0) {
                // Сохраняем позицию для продолжения
                this.pausePosition = currentPos;
            } else {
                // Полный сброс
                this.pausePosition = 0;
            }
        };

        if (fadeOut > 0 && this.currentGainNode) {
            const now = this.context.currentTime;
            this.currentGainNode.gain.setValueAtTime(this.currentGainNode.gain.value, now);
            this.currentGainNode.gain.linearRampToValueAtTime(0.001, now + fadeOut);
            setTimeout(doStop, fadeOut * 1000);
        } else {
            doStop();
        }
    }

    /**
     * Pause playback
     */
    pause() {
        if (!this.isPlaying) return;

        this.pausePosition = this.getCurrentTime();
        this.cleanup();
        this.isPlaying = false;
        this.isPaused = true;
        this.stopUpdates();
    }

    /**
     * Seek to position
     */
    seek(position) {
        if (!this.currentBuffer) return;

        const wasPlaying = this.isPlaying;
        const buffer = this.currentBuffer;
        const clampedPosition = Utils.clamp(position, 0, buffer.duration - 0.1);
        
        const options = {
            offset: clampedPosition,
            loop: this.isLooping,
            playbackRate: this.playbackRate,
            onEnded: this.onEnded
        };

        if (wasPlaying) {
            this.cleanup();
            this.isPlaying = false;
            this.play(buffer, options);
        } else {
            // Сохраняем позицию для следующего play
            this.pausePosition = clampedPosition;
        }
    }

    /**
     * Seek relative to current position
     */
    seekRelative(delta) {
        const current = this.getCurrentTime();
        this.seek(current + delta);
    }

    /**
     * Set playback rate
     */
    setPlaybackRate(rate) {
        this.playbackRate = Utils.clamp(rate, 0.5, 2);
        if (this.currentSource) {
            this.currentSource.playbackRate.value = this.playbackRate;
        }
    }

    /**
     * Set loop mode
     */
    setLoop(enabled) {
        this.isLooping = enabled;
        if (this.currentSource) {
            this.currentSource.loop = enabled;
        }
    }

    /**
     * Set master volume (0-1)
     */
    setVolume(value) {
        const volume = Utils.clamp(value, 0, 1);
        this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
    }

    /**
     * Get current playback time
     */
    getCurrentTime() {
        if (this.isPlaying) {
            return (this.context.currentTime - this.startTime) * this.playbackRate;
        }
        // Для паузы, остановки - возвращаем сохранённую позицию
        return this.pausePosition || 0;
    }

    /**
     * Get buffer duration
     */
    getDuration() {
        return this.currentBuffer ? this.currentBuffer.duration : 0;
    }

    /**
     * Get remaining time
     */
    getRemainingTime() {
        return Math.max(0, this.getDuration() - this.getCurrentTime());
    }

    /**
     * Get progress (0-100)
     */
    getProgress() {
        const duration = this.getDuration();
        if (!duration) return 0;
        return (this.getCurrentTime() / duration) * 100;
    }

    /**
     * Get frequency data for visualizer
     */
    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    /**
     * Cleanup current source
     */
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

    /**
     * Start time update interval
     */
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

    /**
     * Stop time update interval
     */
    stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Destroy engine
     */
    destroy() {
        this.cleanup();
        this.stopUpdates();
        if (this.context.state !== 'closed') {
            this.context.close();
        }
    }
}