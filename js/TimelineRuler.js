/**
 * TimelineRuler.js
 * Линейка времени с метками
 */

class TimelineRuler {
    constructor() {
        this.container = document.getElementById('timeline-container');
        this.track = document.getElementById('timeline-track');
        this.progress = document.getElementById('timeline-progress');
        this.marks = document.getElementById('timeline-marks');
        this.hover = document.getElementById('timeline-hover');
        
        this.duration = 0;
        this.onSeek = null;
        
        this.init();
    }
    
    init() {
        if (!this.track) return;
        
        this.setupEvents();
    }
    
    setupEvents() {
        // Mouse move - показать hover time
        this.track.addEventListener('mousemove', (e) => {
            this.handleHover(e);
        });
        
        // Mouse leave - скрыть hover
        this.track.addEventListener('mouseleave', () => {
            if (this.hover) {
                this.hover.style.opacity = '0';
            }
        });
        
        // Click - seek
        this.track.addEventListener('click', (e) => {
            this.handleClick(e);
        });
    }
    
    handleHover(e) {
        if (this.duration <= 0 || !this.hover) return;
        
        const rect = this.track.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.duration;
        
        this.hover.textContent = this.formatTime(time);
        this.hover.style.left = `${percent * 100}%`;
        this.hover.style.opacity = '1';
    }
    
    handleClick(e) {
        if (this.duration <= 0) return;
        
        const rect = this.track.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.duration;
        
        if (this.onSeek) {
            this.onSeek(time);
        }
    }
    
    /**
     * Инициализировать для трека
     * @param {number} duration - длительность в секундах
     */
    setDuration(duration) {
        this.duration = duration;
        this.generateMarks();
        this.updateProgress(0);
    }
    
    /**
     * Сгенерировать метки
     */
    generateMarks() {
        if (!this.marks) return;
        
        this.marks.innerHTML = '';
        
        if (this.duration <= 0) return;
        
        // Интервал меток
        let interval = 30;
        if (this.duration > 600) interval = 60;
        if (this.duration > 1800) interval = 120;
        if (this.duration < 120) interval = 15;
        if (this.duration < 60) interval = 10;
        
        // Генерация
        for (let time = 0; time <= this.duration; time += interval) {
            this.createMark(time, time % 60 === 0);
        }
        
        // Финальная метка
        const lastMark = Math.floor(this.duration / interval) * interval;
        if (this.duration - lastMark > interval * 0.3) {
            this.createMark(this.duration, true);
        }
    }
    
    createMark(time, isMajor) {
        const mark = document.createElement('div');
        mark.className = `timeline-mark${isMajor ? ' major' : ''}`;
        
        const percent = (time / this.duration) * 100;
        mark.style.left = `${percent}%`;
        
        const label = document.createElement('span');
        label.className = 'timeline-mark-label';
        label.textContent = this.formatTime(time);
        mark.appendChild(label);
        
        this.marks.appendChild(mark);
    }
    
    /**
     * Обновить прогресс
     * @param {number} currentTime 
     */
    updateProgress(currentTime) {
        if (!this.progress || this.duration <= 0) return;
        
        const percent = Math.min(100, (currentTime / this.duration) * 100);
        this.progress.style.width = `${percent}%`;
    }
    
    /**
     * Установить callback для seek
     * @param {function} callback 
     */
    setSeekCallback(callback) {
        this.onSeek = callback;
    }
    
    /**
     * Сбросить
     */
    reset() {
        this.duration = 0;
        if (this.marks) this.marks.innerHTML = '';
        if (this.progress) this.progress.style.width = '0%';
    }
    
    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Глобальный экземпляр
window.timelineRuler = new TimelineRuler();