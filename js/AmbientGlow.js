/**
 * AmbientGlow.js
 * Фоновая подсветка по периметру экрана
 */

class AmbientGlow {
    constructor() {
        this.element = document.getElementById('ambient-glow');
        this.currentState = 'stopped';
        this.isEnabled = true;
        
        this.init();
        
    }
    
    init() {
        this.loadSettings();
        
        if (this.isEnabled && this.element) {
            this.element.classList.add('active');
            console.log('🌈 AmbientGlow: activated');
        }
    }
    
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('concertPlayerSettings') || '{}');
            this.isEnabled = settings.ambientGlow !== false;
        } catch (e) {
            this.isEnabled = true;
        }
    }
    
    saveSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('concertPlayerSettings') || '{}');
            settings.ambientGlow = this.isEnabled;
            localStorage.setItem('concertPlayerSettings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save ambient settings');
        }
    }
    
    setState(state) {
        if (!this.element) return;
        
        // Если выключено и состояние не 'hidden' - не показываем
        if (!this.isEnabled && state !== 'hidden') return;
        
        const states = ['playing', 'paused', 'stopped', 'warning', 'critical', 'hidden'];
        states.forEach(s => this.element.classList.remove(s));
        
        if (state === 'hidden') {
            this.element.classList.remove('active');
        } else {
            this.element.classList.add('active');
            this.element.classList.add(state);
        }
        
        this.currentState = state;
        
        console.log('🌈 AmbientGlow: state changed to', state);
    }
    
    updateByTime(remaining, isPlaying, isPaused) {
        if (!this.isEnabled) return;
        
        if (!isPlaying && !isPaused) {
            this.setState('stopped');
        } else if (isPaused) {
            this.setState('paused');
        } else if (remaining <= 5) {
            this.setState('critical');
        } else if (remaining <= 15) {
            this.setState('warning');
        } else {
            this.setState('playing');
        }
    }
    
    /**
     * Скрыть полностью (когда плейлист пуст)
     */
    hide() {
        this.setState('hidden');
        console.log('🌈 AmbientGlow: hidden');
    }
    
    /**
     * Показать (когда есть треки)
     */
    show() {
        if (this.isEnabled && this.element) {
            this.element.classList.add('active');
            this.setState('stopped');
        }
    }
    
    toggle(enabled) {
        this.isEnabled = enabled;
        
        if (!this.element) return;
        
        if (enabled) {
            this.element.classList.add('active');
        } else {
            this.element.classList.remove('active');
        }
        
        this.saveSettings();
    }
    
    getState() {
        return this.currentState;
    }
    
    isActive() {
        return this.isEnabled;
    }
}

// Экспорт
window.AmbientGlow = AmbientGlow;