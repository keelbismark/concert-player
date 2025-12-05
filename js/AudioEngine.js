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
        
        this.onEnded = null;
        this.onTimeUpdate = null;
        this.updateInterval = null;
    }

    async resume() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
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

        if (fadeIn > 0 && offset === 0) {
            this.currentGainNode.gain.setValueAtTime(0, this.context.currentTime);
            this.currentGainNode.gain.linearRampToValueAtTime(1, this.context.currentTime + fadeIn);
        }

        this.currentSource.onended = () => {
            if (this.isPlaying && !this.isLooping) {
                this.isPlaying = false;
                this.isPaused = false;
                this.pausePosition = 0;
                this.stopUpdates();
                if (this.onEnded) this.onEnded();
            }
        };

        this.currentSource.start(0, offset);
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        this.isPaused = false;
        // НЕ сбрасываем pausePosition здесь - он уже использован в offset

        this.startUpdates();
    }

    stop(fadeOut = 0, preservePosition = false) {
        if (!this.currentSource && !this.isPaused) return;

        // Сохраняем позицию ДО любых действий
        const currentPos = this.getCurrentTime();

        const doStop = () => {
            this.cleanup();
            this.isPlaying = false;
            this.isPaused = false;
            this.stopUpdates();
            
            if (preservePosition && currentPos > 0) {
                this.pausePosition = currentPos;
            } else {
                this.pausePosition = 0;
            }
        };

        if (fadeOut > 0 && this.currentGainNode) {
            // Сохраняем позицию ДО fade
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
            // Сохраняем позицию для следующего play
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
        const volume = Utils.clamp(value, 0, 1);
        this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
    }

    getCurrentTime() {
        if (this.isPlaying) {
            return (this.context.currentTime - this.startTime) * this.playbackRate;
        }
        // Для паузы или остановки - возвращаем сохранённую позицию
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
        if (this.context.state !== 'closed') {
            this.context.close();
        }
    }
}