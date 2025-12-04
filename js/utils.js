/**
 * Utility functions
 */

const Utils = {
    /**
     * Format seconds to MM:SS
     */
    formatTime(seconds) {
        if (!seconds || seconds < 0 || !isFinite(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${String(sec).padStart(2, '0')}`;
    },

    /**
     * Format seconds to HH:MM:SS
     */
    formatTimeHMS(seconds) {
        if (!seconds || seconds < 0 || !isFinite(seconds)) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const min = Math.floor((seconds % 3600) / 60);
        const sec = Math.floor(seconds % 60);
        return `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Download file
     */
    downloadFile(content, filename, type = 'application/json') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    /**
     * Read file as ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Extract filename without extension
     */
    getFilenameWithoutExt(filename) {
        return filename.replace(/\.[^/.]+$/, '');
    },

    /**
     * Check if file is audio
     */
    isAudioFile(file) {
        return file.type.startsWith('audio/') || 
               /\.(mp3|wav|ogg|flac|m4a|aac|wma)$/i.test(file.name);
    },

    /**
     * Get current date string for filenames
     */
    getDateString() {
        return new Date().toISOString().slice(0, 10);
    },

    /**
     * Calculate time from HH:MM string
     */
    parseTimeString(timeStr) {
        if (!timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    },

    /**
     * Format Date to HH:MM
     */
    formatTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${mins}`;
    }
};

// Export for modules (if using)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}