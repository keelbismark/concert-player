/**
 * Page Protection - защита от случайного закрытия и потери фокуса
 */
class PageProtection {
    constructor(app) {
        this.app = app;
        this.wasPlayingBeforeHidden = false;
        this.isUserInteracted = false;
        
        this.init();
    }

    init() {
        this.bindBeforeUnload();
        this.bindVisibilityChange();
        this.bindUserInteraction();
        this.preventAccidentalNavigation();
    }

    /**
     * Защита от закрытия страницы
     */
    bindBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.shouldProtect()) {
                e.preventDefault();
                e.returnValue = 'У вас есть несохранённый плейлист. Вы уверены, что хотите покинуть страницу?';
                return e.returnValue;
            }
        });
    }

    /**
     * Проверить нужна ли защита
     */
    shouldProtect() {
        const hasPlaylist = this.app.playlist?.tracks?.length > 0;
        const isPlaying = this.app.audioEngine?.isPlaying;
        const hasUnsavedChanges = this.app.hasUnsavedChanges;
        
        return hasPlaylist || isPlaying || hasUnsavedChanges;
    }

    /**
     * Обработка потери/получения фокуса
     */
    bindVisibilityChange() {
        // Page Visibility API
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onPageHidden();
            } else {
                this.onPageVisible();
            }
        });

        // Window blur/focus (дополнитель��о)
        window.addEventListener('blur', () => {
            this.onWindowBlur();
        });

        window.addEventListener('focus', () => {
            this.onWindowFocus();
        });

        // Audio focus (для мобильных)
        if ('mediaSession' in navigator) {
            this.setupMediaSession();
        }
    }

    /**
     * Страница скрыта
     */
    onPageHidden() {
        console.log('📱 Page hidden');
        
        const audioEngine = this.app.audioEngine;
        if (!audioEngine) return;
        
        // Запоминаем состояние воспроизведения
        this.wasPlayingBeforeHidden = audioEngine.isPlaying && !audioEngine.isPaused;
        
        // Сохраняем позицию
        this.savedPosition = audioEngine.audio?.currentTime || 0;
        this.savedTrackIndex = this.app.playlist?.currentIndex;
        
        // Настройка из settings - приостанавливать ли при скрытии
        const pauseOnHide = this.app.settings?.get('pauseOnHide') ?? false;
        
        if (pauseOnHide && this.wasPlayingBeforeHidden) {
            audioEngine.pause();
            this.app.showToast('⏸ Пауза (страница скрыта)', 'info');
        }
        
        // Сохраняем состояние в localStorage на случай краша
        this.saveEmergencyState();
    }

    /**
     * Страница снова видима
     */
    onPageVisible() {
        console.log('📱 Page visible');
        
        const audioEngine = this.app.audioEngine;
        if (!audioEngine) return;
        
        // Проверяем, нужно ли возобновить воспроизведение
        const autoResume = this.app.settings?.get('autoResumeOnFocus') ?? false;
        
        if (autoResume && this.wasPlayingBeforeHidden && !audioEngine.isPlaying) {
            // Небольшая задержка для стабильности
            setTimeout(() => {
                audioEngine.play();
                this.app.showToast('▶ Воспроизведение возобновлено', 'info');
            }, 100);
        }
        
        // Проверяем синхронизацию состояния
        this.verifyAudioState();
        
        this.wasPlayingBeforeHidden = false;
    }

    /**
     * Окно потеряло фокус
     */
    onWindowBlur() {
        // Менее агрессивная реакция чем на visibilitychange
        // Просто логируем
        console.log('👁 Window blur');
    }

    /**
     * Окно получило фокус
     */
    onWindowFocus() {
        console.log('👁 Window focus');
        
        // Обновляем UI на всякий случай
        if (this.app.ui?.updateNowPlaying) {
            this.app.ui.updateNowPlaying();
        }
    }

    /**
     * Проверить состояние аудио после возврата
     */
    verifyAudioState() {
        const audioEngine = this.app.audioEngine;
        if (!audioEngine?.audio) return;
        
        const audio = audioEngine.audio;
        
        // Проверяем, не "застрял" ли аудио
        if (audioEngine.isPlaying && audio.paused) {
            console.warn('⚠️ Audio state mismatch, fixing...');
            
            // Пробуем возобновить
            audio.play().catch(err => {
                console.error('Failed to resume audio:', err);
                this.app.showToast('⚠️ Ошибка воспроизведения, нажмите Play', 'warning');
            });
        }
        
        // Проверяем, не сбросилась ли позиция
        if (this.savedPosition && Math.abs(audio.currentTime - this.savedPosition) > 2) {
            console.warn('⚠️ Position drift detected');
            // Можно предложить восстановить позицию
        }
    }

    /**
     * Настройка Media Session API
     */
    setupMediaSession() {
        navigator.mediaSession.setActionHandler('play', () => {
            this.app.audioEngine?.play();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            this.app.audioEngine?.pause();
        });
        
        navigator.mediaSession.setActionHandler('stop', () => {
            this.app.audioEngine?.stop();
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            this.app.playlist?.prev();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            this.app.playlist?.next();
        });
        
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime) {
                this.app.audioEngine?.seek(details.seekTime);
            }
        });
    }

    /**
     * Обновить метаданные Media Session
     */
    updateMediaSession(track) {
        if (!('mediaSession' in navigator) || !track) return;
        
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title || 'Unknown Track',
            artist: 'Concert Player',
            album: this.app.playlist?.name || 'Playlist',
            artwork: [
                { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
            ]
        });
    }

    /**
     * Отслеживание взаимодействия пользователя
     */
    bindUserInteraction() {
        const markInteracted = () => {
            this.isUserInteracted = true;
            document.removeEventListener('click', markInteracted);
            document.removeEventListener('keydown', markInteracted);
            document.removeEventListener('touchstart', markInteracted);
        };
        
        document.addEventListener('click', markInteracted);
        document.addEventListener('keydown', markInteracted);
        document.addEventListener('touchstart', markInteracted);
    }

    /**
     * Предотвращение случайной навигации
     */
    preventAccidentalNavigation() {
        // Предотвращаем случайный backspace
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.matches('input, textarea, [contenteditable]')) {
                e.preventDefault();
            }
        });
        
        // Предотвращаем случайное обновление (F5, Ctrl+R)
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'F5' || (e.ctrlKey && e.key === 'r')) && this.shouldProtect()) {
                if (!confirm('Обновить страницу? Несохранённые данные будут потеряны.')) {
                    e.preventDefault();
                }
            }
        });
    }

    /**
     * Сохранение аварийного состояния
     */
    saveEmergencyState() {
        try {
            const state = {
                timestamp: Date.now(),
                currentTrackIndex: this.app.playlist?.currentIndex,
                position: this.app.audioEngine?.audio?.currentTime || 0,
                isPlaying: this.app.audioEngine?.isPlaying,
                volume: this.app.audioEngine?.volume,
                playlistData: this.app.playlist?.export?.()
            };
            
            localStorage.setItem('concertPlayerEmergencyState', JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save emergency state:', e);
        }
    }

    /**
     * Восстановление из аварийного состояния
     */
    recoverFromEmergencyState() {
        try {
            const stateJson = localStorage.getItem('concertPlayerEmergencyState');
            if (!stateJson) return null;
            
            const state = JSON.parse(stateJson);
            
            // Проверяем актуальность (не старше 1 часа)
            if (Date.now() - state.timestamp > 3600000) {
                localStorage.removeItem('concertPlayerEmergencyState');
                return null;
            }
            
            return state;
        } catch (e) {
            return null;
        }
    }

    /**
     * Показать диалог восстановления
     */
    showRecoveryDialog(state) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-sm">
                <div class="modal-header">
                    <div class="modal-title">
                        <span class="modal-title-icon">🔄</span>
                        <span>Восстановление сессии</span>
                    </div>
                </div>
                <div class="modal-body">
                    <p>Обнаружена предыдущая сессия:</p>
                    <ul style="margin: 12px 0; padding-left: 20px;">
                        <li>Треков: ${state.playlistData?.tracks?.length || 0}</li>
                        <li>Позиция: ${this.formatTime(state.position)}</li>
                        <li>Сохранено: ${new Date(state.timestamp).toLocaleTimeString()}</li>
                    </ul>
                    <p>Восстановить?</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" id="recovery-no">Нет, начать заново</button>
                    <button class="modal-btn primary" id="recovery-yes">Да, восстановить</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        return new Promise((resolve) => {
            modal.querySelector('#recovery-yes').onclick = () => {
                modal.remove();
                resolve(true);
            };
            
            modal.querySelector('#recovery-no').onclick = () => {
                modal.remove();
                localStorage.removeItem('concertPlayerEmergencyState');
                resolve(false);
            };
        });
    }

    formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Экспорт
window.PageProtection = PageProtection;