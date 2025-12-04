/**
 * Audio Visualizer - Fixed Version
 */

class Visualizer {
    constructor(canvasId, audioEngine) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Visualizer: Canvas not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.audioEngine = audioEngine;
        this.isRunning = false;
        this.animationId = null;

        // Dimensions
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;

        // Visual style: 'bars', 'wave', 'circular'
        this.style = 'bars';
        
        // Colors
        this.colors = {
            background: '#07080a',
            primary: '#00ff88',
            secondary: '#00d4aa',
            accent: '#00b4d8',
            glow: 'rgba(0, 255, 136, 0.3)'
        };

        // Smoothing
        this.smoothedData = null;
        this.smoothingFactor = 0.65;

        // Initialize
        this.resize();
        
        // Resize observer
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas.parentElement);

        // Fallback resize
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Resize canvas properly
     */
    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;

        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.width = rect.width;
        this.height = rect.height;
        
        // Set canvas size with device pixel ratio
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        
        // Set display size
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        // Scale context
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        
        // Clear after resize
        this.clear();
    }

    /**
     * Start visualization
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.draw();
    }

    /**
     * Stop visualization
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.clear();
    }

    /**
     * Clear canvas
     */
    clear() {
        if (!this.ctx) return;
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Main draw loop
     */
    draw() {
        if (!this.isRunning || !this.ctx) return;

        // Clear
        this.clear();

        // Get frequency data from audio engine
        let frequencyData;
        try {
            frequencyData = this.audioEngine.getFrequencyData();
        } catch (e) {
            frequencyData = new Uint8Array(64).fill(0);
        }

        // Initialize smoothed data
        if (!this.smoothedData || this.smoothedData.length !== frequencyData.length) {
            this.smoothedData = new Float32Array(frequencyData.length);
        }

        // Apply smoothing
        for (let i = 0; i < frequencyData.length; i++) {
            this.smoothedData[i] = this.smoothedData[i] * this.smoothingFactor + 
                                   frequencyData[i] * (1 - this.smoothingFactor);
        }

        // Draw based on style
        switch (this.style) {
            case 'wave':
                this.drawWave();
                break;
            case 'circular':
                this.drawCircular();
                break;
            default:
                this.drawBars();
        }

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    /**
     * Draw bars visualization
     */
    drawBars() {
        const data = this.smoothedData;
        if (!data || data.length === 0) return;

        const bufferLength = data.length;
        const barCount = Math.min(bufferLength, 48);
        const totalWidth = this.width;
        const barWidth = totalWidth / barCount;
        const gap = 2;

        this.ctx.save();

        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor(i * bufferLength / barCount);
            const value = data[dataIndex] / 255;
            const barHeight = Math.max(2, value * this.height * 0.85);

            const x = i * barWidth + gap / 2;
            const y = this.height - barHeight;
            const width = barWidth - gap;

            // Gradient
            const gradient = this.ctx.createLinearGradient(0, this.height, 0, y);
            gradient.addColorStop(0, this.colors.secondary);
            gradient.addColorStop(0.6, this.colors.primary);
            gradient.addColorStop(1, this.colors.accent);

            // Glow effect
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = this.colors.glow;

            // Draw bar with rounded corners
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            
            // Manual rounded rect for compatibility
            const radius = Math.min(3, width / 2);
            this.ctx.moveTo(x + radius, y);
            this.ctx.lineTo(x + width - radius, y);
            this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            this.ctx.lineTo(x + width, this.height);
            this.ctx.lineTo(x, this.height);
            this.ctx.lineTo(x, y + radius);
            this.ctx.quadraticCurveTo(x, y, x + radius, y);
            this.ctx.closePath();
            this.ctx.fill();

            // Reflection (subtle)
            this.ctx.shadowBlur = 0;
            const reflectionGradient = this.ctx.createLinearGradient(0, this.height, 0, this.height + barHeight * 0.3);
            reflectionGradient.addColorStop(0, `rgba(0, 255, 136, ${value * 0.15})`);
            reflectionGradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = reflectionGradient;
            this.ctx.fillRect(x, this.height, width, barHeight * 0.25);
        }

        this.ctx.restore();
    }

    /**
     * Draw wave visualization
     */
    drawWave() {
        const data = this.smoothedData;
        if (!data || data.length === 0) return;

        const bufferLength = data.length;
        const sliceWidth = this.width / bufferLength;
        const centerY = this.height / 2;

        this.ctx.save();

        // Background glow
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        bgGradient.addColorStop(0, 'transparent');
        bgGradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.05)');
        bgGradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw wave line
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);

        for (let i = 0; i < bufferLength; i++) {
            const value = data[i] / 255;
            const y = centerY + (value - 0.5) * this.height * 0.7;
            const x = i * sliceWidth;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        // Stroke wave
        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.glow;
        this.ctx.stroke();

        // Fill under wave
        this.ctx.lineTo(this.width, centerY);
        this.ctx.lineTo(this.width, this.height);
        this.ctx.lineTo(0, this.height);
        this.ctx.closePath();

        const fillGradient = this.ctx.createLinearGradient(0, centerY, 0, this.height);
        fillGradient.addColorStop(0, 'rgba(0, 255, 136, 0.2)');
        fillGradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = fillGradient;
        this.ctx.shadowBlur = 0;
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Draw circular visualization
     */
    drawCircular() {
        const data = this.smoothedData;
        if (!data || data.length === 0) return;

        const bufferLength = Math.min(data.length, 128);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.25;

        this.ctx.save();
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.glow;

        for (let i = 0; i < bufferLength; i++) {
            const value = data[i] / 255;
            const angle = (i / bufferLength) * Math.PI * 2 - Math.PI / 2;
            const barLength = value * radius * 0.7 + 2;

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barLength);
            const y2 = centerY + Math.sin(angle) * (radius + barLength);

            const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, this.colors.secondary);
            gradient.addColorStop(1, this.colors.primary);

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        // Center circle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
        this.ctx.fillStyle = this.colors.background;
        this.ctx.shadowBlur = 0;
        this.ctx.fill();
        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * Set visualization style
     */
    setStyle(style) {
        if (['bars', 'wave', 'circular'].includes(style)) {
            this.style = style;
        }
    }

    /**
     * Set colors
     */
    setColors(colors) {
        Object.assign(this.colors, colors);
    }

    /**
     * Destroy visualizer
     */
    destroy() {
        this.stop();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        window.removeEventListener('resize', this.resize);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Visualizer;
}