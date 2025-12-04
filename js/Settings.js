/**
 * Settings Manager
 */

class Settings {
    constructor() {
        this.storageKey = 'concertPlayerSettings';
        
        this.defaults = {
            fadeOutDuration: 0.5,
            fadeInDuration: 0,
            warningTime: 15,
            criticalTime: 5,
            autoSelectNext: true,
            showVisualizer: true,
            showSchedule: true,
            confirmClose: true,
            playMode: 'manual',
            concertStartTime: '',
            volume: 100
        };

        this.values = { ...this.defaults };
        this.listeners = [];
    }

    /**
     * Load settings from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.values = { ...this.defaults, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
        return this.values;
    }

    /**
     * Save settings to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.values));
            this.notifyListeners();
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    /**
     * Get setting value
     */
    get(key) {
        return this.values[key] ?? this.defaults[key];
    }

    /**
     * Set setting value
     */
    set(key, value) {
        this.values[key] = value;
        this.save();
    }

    /**
     * Update multiple settings
     */
    update(newValues) {
        Object.assign(this.values, newValues);
        this.save();
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.values = { ...this.defaults };
        this.save();
    }

    /**
     * Export settings
     */
    export() {
        return JSON.stringify(this.values, null, 2);
    }

    /**
     * Import settings
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.values = { ...this.defaults, ...imported };
            this.save();
            return true;
        } catch (e) {
            console.error('Failed to import settings:', e);
            return false;
        }
    }

    /**
     * Add change listener
     */
    onChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify all listeners
     */
    notifyListeners() {
        this.listeners.forEach(cb => cb(this.values));
    }

    /**
     * Generate settings HTML
     */
    generateHTML() {
        return `
            <div class="settings-group">
                <div class="settings-group-title">Тайминги</div>
                
                <div class="setting-item">
                    <div class="setting-label">
                        Fade Out (стоп)
                        <span>Плавное затухание</span>
                    </div>
                    <div>
                        <input type="number" class="setting-input" 
                               data-setting="fadeOutDuration" 
                               value="${this.get('fadeOutDuration')}" 
                               min="0" max="5" step="0.1"> сек
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-label">
                        Fade In (старт)
                        <span>Плавное нарастание</span>
                    </div>
                    <div>
                        <input type="number" class="setting-input" 
                               data-setting="fadeInDuration" 
                               value="${this.get('fadeInDuration')}" 
                               min="0" max="5" step="0.1"> сек
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-label">
                        Предупреждение
                        <span>Жёлтый таймер</span>
                    </div>
                    <div>
                        <input type="number" class="setting-input" 
                               data-setting="warningTime" 
                               value="${this.get('warningTime')}" 
                               min="5" max="60"> сек
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-label">
                        Критическое
                        <span>Красный + мигание</span>
                    </div>
                    <div>
                        <input type="number" class="setting-input" 
                               data-setting="criticalTime" 
                               value="${this.get('criticalTime')}" 
                               min="1" max="30"> сек
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-title">Поведение</div>
                
                <div class="setting-item">
                    <div class="setting-label">Автовыбор следующего</div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="autoSelectNext" 
                               ${this.get('autoSelectNext') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="setting-item">
                    <div class="setting-label">Визуализация</div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="showVisualizer" 
                               ${this.get('showVisualizer') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="setting-item">
                    <div class="setting-label">Показывать расписание</div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="showSchedule" 
                               ${this.get('showSchedule') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="setting-item">
                    <div class="setting-label">Подтверждение закрытия</div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="confirmClose" 
                               ${this.get('confirmClose') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-title">Расписание концерта</div>
                <div class="setting-item">
                    <div class="setting-label">Время начала</div>
                    <input type="time" class="setting-input" 
                           data-setting="concertStartTime"
                           value="${this.get('concertStartTime')}" 
                           style="width: 100px;">
                </div>
            </div>
        `;
    }
}