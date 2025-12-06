/**
 * QuickActionsWheel.js
 * Круговое меню быстрых действий для треков
 */

class QuickActionsWheel {
    constructor(app) {
        this.app = app;
        this.overlay = null;
        this.wheel = null;
        this.currentTrackIndex = null;
        this.isOpen = false;
        
        this.actions = [
            { id: 'play', icon: '▶', label: 'Play', position: 'top', class: 'action-play' },
            { id: 'next', icon: '⏭', label: 'Next', position: 'top-right', class: 'action-next' },
            { id: 'duplicate', icon: '📋', label: 'Copy', position: 'bottom-right', class: '' },
            { id: 'note', icon: '📝', label: 'Note', position: 'bottom', class: '' },
            { id: 'cue', icon: '🎯', label: 'Cue', position: 'bottom-left', class: '' },
            { id: 'delete', icon: '🗑️', label: 'Delete', position: 'top-left', class: 'action-delete' }
        ];
        
        this.init();
    }
    
    init() {
        this.createOverlay();
        this.bindEvents();
        console.log('🎯 QuickActionsWheel: initialized');
    }
    
    createOverlay() {
        // Создаём overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'quick-actions-overlay';
        this.overlay.id = 'quick-actions-overlay';
        
        // Создаём wheel
        this.wheel = document.createElement('div');
        this.wheel.className = 'quick-actions-wheel';
        
        // Центральная часть
        const center = document.createElement('div');
        center.className = 'quick-actions-center';
        center.innerHTML = '🎵';
        this.wheel.appendChild(center);
        
        // Кнопки действий
        this.actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `quick-action-btn ${action.class}`;
            btn.setAttribute('data-position', action.position);
            btn.setAttribute('data-action', action.id);
            btn.innerHTML = `
                <span class="quick-action-icon">${action.icon}</span>
                <span class="quick-action-label">${action.label}</span>
            `;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.executeAction(action.id);
            });
            this.wheel.appendChild(btn);
        });
        
        this.overlay.appendChild(this.wheel);
        document.body.appendChild(this.overlay);
    }
    
    bindEvents() {
        // Закрытие по клику на overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Правый клик на треках
        const playlist = document.getElementById('playlist');
        if (playlist) {
            playlist.addEventListener('contextmenu', (e) => {
                const trackItem = e.target.closest('.track-item');
                if (trackItem) {
                    e.preventDefault();
                    const index = parseInt(trackItem.dataset.index);
                    this.open(e.clientX, e.clientY, index);
                }
            });
        }
    }
    
    open(x, y, trackIndex) {
        this.currentTrackIndex = trackIndex;
        this.isOpen = true;
        
        // Позиционирование
        const padding = 100; // Половина размера wheel
        const maxX = window.innerWidth - padding;
        const maxY = window.innerHeight - padding;
        
        const posX = Math.max(padding, Math.min(x, maxX));
        const posY = Math.max(padding, Math.min(y, maxY));
        
        this.wheel.style.left = `${posX}px`;
        this.wheel.style.top = `${posY}px`;
        
        // Обновляем центральную иконку
        const track = this.app.playlist.tracks[trackIndex];
        const center = this.wheel.querySelector('.quick-actions-center');
        if (track && center) {
            center.innerHTML = trackIndex + 1;
            center.title = track.title;
        }
        
        // Показываем
        this.overlay.classList.add('active');
        
        console.log('🎯 QuickActionsWheel: opened for track', trackIndex);
    }
    
    close() {
        this.isOpen = false;
        this.overlay.classList.remove('active');
        this.currentTrackIndex = null;
    }
    
    executeAction(actionId) {
        if (this.currentTrackIndex === null) return;
        
        const index = this.currentTrackIndex;
        
        console.log('🎯 QuickActionsWheel: executing', actionId, 'on track', index);
        
        switch (actionId) {
            case 'play':
                this.app.selectTrack(index);
                this.app.play();
                break;
                
            case 'next':
                // Установить как следующий (переместить после текущего)
                const currentIndex = this.app.playlist.currentIndex;
                if (index !== currentIndex && index !== currentIndex + 1) {
                    this.app.reorderTrack(index, currentIndex + 1);
                    this.app.ui.showToast('Трек будет следующим', 'success');
                }
                break;
                
            case 'duplicate':
                this.app.duplicateTrack(index);
                break;
                
            case 'note':
                this.app.ui.showNoteModal(index);
                break;
                
            case 'cue':
                // Открыть cue points для трека
                if (this.app.cuePoints) {
                    this.app.showCuePointsModal(this.app.playlist.tracks[index].id);
                } else {
                    this.app.ui.showToast('Cue points недоступны', 'warning');
                }
                break;
                
            case 'delete':
                this.app.removeTrack(index);
                break;
        }
        
        this.close();
    }
    
    destroy() {
        if (this.overlay) {
            this.overlay.remove();
        }
    }
}

// Экспорт
window.QuickActionsWheel = QuickActionsWheel;