/**
 * CuePoints Manager - управление метками в треках
 */
class CuePointsManager {
    constructor(app) {
        this.app = app;
        this.cues = new Map(); // trackId -> [{id, time, label, color}]
        this.colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
        this.colorIndex = 0;
        
        this.loadFromStorage();
        this.bindKeyboard();
    }

    /**
     * Добавить cue point
     */
    addCue(trackId, time, label = null) {
        if (!this.cues.has(trackId)) {
            this.cues.set(trackId, []);
        }
        
        const trackCues = this.cues.get(trackId);
        
        // Автоматическая метка A, B, C...
        if (!label) {
            label = String.fromCharCode(65 + trackCues.length); // A, B, C, D...
        }
        
        const cue = {
            id: Date.now() + Math.random(),
            time: time,
            label: label,
            color: this.getNextColor()
        };
        
        trackCues.push(cue);
        trackCues.sort((a, b) => a.time - b.time);
        
        this.saveToStorage();
        this.renderCues(trackId);
        
        this.app.showToast(`Метка "${label}" добавлена на ${this.formatTime(time)}`);
        
        return cue;
    }

    /**
     * Удалить cue point
     */
    removeCue(trackId, cueId) {
        const trackCues = this.cues.get(trackId);
        if (!trackCues) return;
        
        const index = trackCues.findIndex(c => c.id === cueId);
        if (index !== -1) {
            const removed = trackCues.splice(index, 1)[0];
            this.saveToStorage();
            this.renderCues(trackId);
            this.app.showToast(`Метка "${removed.label}" удалена`);
        }
    }

    /**
     * Получить cue points для трека
     */
    getCues(trackId) {
        return this.cues.get(trackId) || [];
    }

    /**
     * Перейти к cue point
     */
    jumpToCue(trackId, cueId) {
        const cue = this.getCues(trackId).find(c => c.id === cueId);
        if (cue && this.app.audioEngine) {
            this.app.audioEngine.seek(cue.time);
            this.app.showToast(`Переход к метке "${cue.label}"`);
        }
    }

    /**
     * Перейти к следующему cue point
     */
    jumpToNextCue() {
        const currentTrack = this.app.playlist?.currentTrack;
        if (!currentTrack) return;
        
        const currentTime = this.app.audioEngine?.audio?.currentTime || 0;
        const cues = this.getCues(currentTrack.id);
        
        const nextCue = cues.find(c => c.time > currentTime + 0.5);
        if (nextCue) {
            this.jumpToCue(currentTrack.id, nextCue.id);
        }
    }

    /**
     * Перейти к предыдущему cue point
     */
    jumpToPrevCue() {
        const currentTrack = this.app.playlist?.currentTrack;
        if (!currentTrack) return;
        
        const currentTime = this.app.audioEngine?.audio?.currentTime || 0;
        const cues = this.getCues(currentTrack.id);
        
        const prevCues = cues.filter(c => c.time < currentTime - 0.5);
        if (prevCues.length > 0) {
            this.jumpToCue(currentTrack.id, prevCues[prevCues.length - 1].id);
        }
    }

    /**
     * Добавить cue на текущей позиции
     */
    addCueAtCurrentPosition() {
        const currentTrack = this.app.playlist?.currentTrack;
        if (!currentTrack) {
            this.app.showToast('Сначала выберите трек', 'warning');
            return;
        }
        
        const currentTime = this.app.audioEngine?.audio?.currentTime || 0;
        this.addCue(currentTrack.id, currentTime);
    }

    /**
     * Рендер cue points на прогресс-баре
     */
    renderCues(trackId) {
        const track = this.app.playlist?.tracks?.find(t => t.id === trackId);
        if (!track) return;
        
        // Рендер на главном прогресс-баре (если это текущий трек)
        if (this.app.playlist?.currentTrack?.id === trackId) {
            this.renderMainProgressCues(trackId, track.duration);
        }
        
        // Рендер в плейлисте
        this.renderPlaylistCues(trackId, track.duration);
    }

    /**
     * Рендер на главном прогресс-баре
     */
    renderMainProgressCues(trackId, duration) {
        const container = document.getElementById('progress-container');
        if (!container) return;
        
        // Удалить старые
        container.querySelectorAll('.cue-marker').forEach(el => el.remove());
        
        const cues = this.getCues(trackId);
        cues.forEach(cue => {
            const marker = document.createElement('div');
            marker.className = 'cue-marker';
            marker.dataset.cueId = cue.id;
            marker.style.left = `${(cue.time / duration) * 100}%`;
            marker.style.backgroundColor = cue.color;
            marker.title = `${cue.label} - ${this.formatTime(cue.time)}`;
            marker.textContent = cue.label;
            
            marker.addEventListener('click', (e) => {
                e.stopPropagation();
                this.jumpToCue(trackId, cue.id);
            });
            
            marker.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showCueContextMenu(e, trackId, cue);
            });
            
            container.appendChild(marker);
        });
    }

    /**
     * Рендер в плейлисте
     */
    renderPlaylistCues(trackId, duration) {
        const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
        if (!trackElement) return;
        
        let cueContainer = trackElement.querySelector('.track-cues');
        if (!cueContainer) {
            cueContainer = document.createElement('div');
            cueContainer.className = 'track-cues';
            const progressArea = trackElement.querySelector('.track-progress') || trackElement;
            progressArea.appendChild(cueContainer);
        }
        
        cueContainer.innerHTML = '';
        
        const cues = this.getCues(trackId);
        cues.forEach(cue => {
            const marker = document.createElement('div');
            marker.className = 'cue-dot';
            marker.style.left = `${(cue.time / duration) * 100}%`;
            marker.style.backgroundColor = cue.color;
            marker.title = `${cue.label} - ${this.formatTime(cue.time)}`;
            cueContainer.appendChild(marker);
        });
    }

    /**
     * Показать контекстное меню для cue
     */
    showCueContextMenu(event, trackId, cue) {
        // Удалить старое меню
        document.querySelectorAll('.cue-context-menu').forEach(el => el.remove());
        
        const menu = document.createElement('div');
        menu.className = 'cue-context-menu';
        menu.innerHTML = `
            <div class="cue-menu-item" data-action="rename">✏️ Переименовать</div>
            <div class="cue-menu-item" data-action="delete">🗑️ Удалить</div>
        `;
        
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'delete') {
                this.removeCue(trackId, cue.id);
            } else if (action === 'rename') {
                this.renameCue(trackId, cue);
            }
            menu.remove();
        });
        
        document.body.appendChild(menu);
        
        // Закрыть при клике вне меню
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 0);
    }

    /**
     * Переименовать cue
     */
    renameCue(trackId, cue) {
        const newLabel = prompt('Введите новое название метки:', cue.label);
        if (newLabel && newLabel.trim()) {
            cue.label = newLabel.trim();
            this.saveToStorage();
            this.renderCues(trackId);
        }
    }

    /**
     * Показать модальное окно управления cue points
     */
    showCueModal(trackId) {
        const track = this.app.playlist?.tracks?.find(t => t.id === trackId);
        if (!track) return;
        
        const cues = this.getCues(trackId);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'cue-modal';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">
                        <span class="modal-title-icon">📍</span>
                        <span>Метки: ${track.title}</span>
                    </div>
                    <button class="modal-close" id="cue-modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="cue-list" id="cue-list">
                        ${cues.length === 0 ? '<div class="cue-empty">Нет меток. Нажмите M во время воспроизведения, чтобы добавить.</div>' : ''}
                        ${cues.map(cue => `
                            <div class="cue-list-item" data-cue-id="${cue.id}">
                                <div class="cue-color" style="background: ${cue.color}"></div>
                                <div class="cue-label">${cue.label}</div>
                                <div class="cue-time">${this.formatTime(cue.time)}</div>
                                <button class="cue-jump" title="Перейти">▶</button>
                                <button class="cue-delete" title="Удалить">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="cue-actions">
                        <button class="modal-btn primary" id="add-cue-btn">+ Добавить метку на текущей позиции</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчики
        modal.querySelector('#cue-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        
        modal.querySelector('#add-cue-btn').onclick = () => {
            this.addCueAtCurrentPosition();
            modal.remove();
            this.showCueModal(trackId); // Перерисовать
        };
        
        modal.querySelectorAll('.cue-jump').forEach(btn => {
            btn.onclick = () => {
                const cueId = parseFloat(btn.closest('.cue-list-item').dataset.cueId);
                this.jumpToCue(trackId, cueId);
            };
        });
        
        modal.querySelectorAll('.cue-delete').forEach(btn => {
            btn.onclick = () => {
                const cueId = parseFloat(btn.closest('.cue-list-item').dataset.cueId);
                this.removeCue(trackId, cueId);
                modal.remove();
                this.showCueModal(trackId); // Перерисовать
            };
        });
    }

    /**
     * Привязка горячих клавиш
     */
    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Игнорировать если в поле ввода
            if (e.target.matches('input, textarea')) return;
            
            switch(e.key.toLowerCase()) {
                case 'm':
                    // M - добавить метку на текущей позиции
                    this.addCueAtCurrentPosition();
                    break;
                case ',':
                    // < - предыдущая метка
                    e.preventDefault();
                    this.jumpToPrevCue();
                    break;
                case '.':
                    // > - следующая метка
                    e.preventDefault();
                    this.jumpToNextCue();
                    break;
            }
        });
    }

    /**
     * Получить следующий цвет
     */
    getNextColor() {
        const color = this.colors[this.colorIndex % this.colors.length];
        this.colorIndex++;
        return color;
    }

    /**
     * Форматирование времени
     */
    formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Сохранить в localStorage
     */
    saveToStorage() {
        const data = {};
        this.cues.forEach((cues, trackId) => {
            data[trackId] = cues;
        });
        localStorage.setItem('concertPlayerCues', JSON.stringify(data));
    }

    /**
     * Загрузить из localStorage
     */
    loadFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('concertPlayerCues') || '{}');
            Object.entries(data).forEach(([trackId, cues]) => {
                this.cues.set(trackId, cues);
            });
        } catch (e) {
            console.warn('Failed to load cue points:', e);
        }
    }

    /**
     * Экспорт cue points
     */
    export() {
        const data = {};
        this.cues.forEach((cues, trackId) => {
            data[trackId] = cues;
        });
        return data;
    }

    /**
     * Импорт cue points
     */
    import(data) {
        Object.entries(data).forEach(([trackId, cues]) => {
            this.cues.set(trackId, cues);
        });
        this.saveToStorage();
    }
}

// Экспорт
window.CuePointsManager = CuePointsManager;