/**
 * PulseBorders.js
 * Пульсирующие границы панелей в такт музыке
 */

class PulseBorders {
    constructor(app) {
        this.app = app;
        this.isEnabled = true;
        this.mode = 'soft'; // 'soft', 'intense', 'rainbow'
        this.analyser = null;
        this.dataArray = null;
        this.animationFrame = null;
        this.isActive = false;
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        
        if (this.isEnabled) {
            document.body.classList.add('pulse-border-enabled');
            document.body.classList.add(`pulse-mode-${this.mode}`);
        }
        
        console.log('💫 PulseBorders: initialized, mode:', this.mode);
    }
    
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('concertPlayerSettings') || '{}');
            this.isEnabled = settings.pulseBorders !== false;
            this.mode = settings.pulseBorderMode || 'soft';
        } catch (e) {
            this.isEnabled = true;
            this.mode = 'soft';
        }
    }
    
    saveSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('concertPlayerSettings') || '{}');
            settings.pulseBorders = this.isEnabled;
            settings.pulseBorderMode = this.mode;
            localStorage.setItem('concertPlayerSettings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save pulse border settings');
        }
    }
    
    /**
     * Запустить пульсацию
     */
    start() {
        if (!this.isEnabled) return;
        
        this.isActive = true;
        document.body.classList.add('pulse-active');
        document.body.classList.remove('pulse-paused', 'pulse-warning', 'pulse-critical');
        
        // Для интенсивного режима подключаемся к анализатору
        if (this.mode === 'intense') {
            this.startIntenseMode();
        }
        
        console.log('💫 PulseBorders: started');
    }
    
    /**
     * Остановить пульсацию
     */
    stop() {
        this.isActive = false;
        document.body.classList.remove('pulse-active', 'pulse-paused', 'pulse-warning', 'pulse-critical');
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Сбросить интенсивность
        document.body.style.setProperty('--pulse-intensity', '0');
        
        console.log('💫 PulseBorders: stopped');
    }
    
    /**
     * Установить состояние паузы
     */
    setPaused(isPaused) {
        if (!this.isEnabled || !this.isActive) return;
        
        if (isPaused) {
            document.body.classList.add('pulse-paused');
            document.body.classList.remove('pulse-active');
        } else {
            document.body.classList.remove('pulse-paused');
            document.body.classList.add('pulse-active');
        }
    }
    
    /**
     * Обновить на основе оставшегося времени
     */
    updateByTime(remaining) {
        if (!this.isEnabled || !this.isActive) return;
        
        document.body.classList.remove('pulse-warning', 'pulse-critical');
        
        if (remaining <= 5) {
            document.body.classList.add('pulse-critical');
        } else if (remaining <= 15) {
            document.body.classList.add('pulse-warning');
        }
    }
    
    /**
     * Интенсивный режим - анализ аудио
     */
    startIntenseMode() {
        if (!this.app.audioEngine || !this.app.audioEngine.analyser) {
            console.warn('💫 PulseBorders: analyser not available');
            return;
        }
        
        this.analyser = this.app.audioEngine.analyser;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        this.updateIntensity();
    }
    
    updateIntensity() {
        if (!this.isActive || this.mode !== 'intense' || !this.analyser) {
            return;
        }
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Считаем среднюю громкость низких частот (бас)
        let sum = 0;
        const bassRange = Math.floor(this.dataArray.length * 0.1); // Первые 10% - басы
        
        for (let i = 0; i < bassRange; i++) {
            sum += this.dataArray[i];
        }
        
        const average = sum / bassRange;
        const intensity = Math.min(1, average / 200); // Нормализуем до 0-1
        
        document.body.style.setProperty('--pulse-intensity', intensity.toFixed(3));
        
        this.animationFrame = requestAnimationFrame(() => this.updateIntensity());
    }
    
    /**
     * Включить/выключить
     */
    toggle(enabled) {
        this.isEnabled = enabled;
        
        if (enabled) {
            document.body.classList.add('pulse-border-enabled');
            document.body.classList.add(`pulse-mode-${this.mode}`);
        } else {
            document.body.classList.remove('pulse-border-enabled', 'pulse-active', 'pulse-paused');
            this.stop();
        }
        
        this.saveSettings();
    }
    
    /**
     * Сменить режим
     */
    setMode(mode) {
        // Удаляем старый класс режима
        document.body.classList.remove(`pulse-mode-${this.mode}`);
        
        this.mode = mode;
        
        // Добавляем новый
        document.body.classList.add(`pulse-mode-${this.mode}`);
        
        // Перезапускаем если активен
        if (this.isActive) {
            if (mode === 'intense') {
                this.startIntenseMode();
            } else if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        }
        
        this.saveSettings();
        console.log('💫 PulseBorders: mode changed to', mode);
    }
    
    /**
     * Получить текущий режим
     */
    getMode() {
        return this.mode;
    }
    
    /**
     * Активен ли
     */
    isRunning() {
        return this.isActive;
    }
}

// Экспорт
window.PulseBorders = PulseBorders;