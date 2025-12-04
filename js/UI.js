/**
 * UI Manager - Handles all DOM interactions
 */

class UI {
    constructor(app) {
        this.app = app;
        this.elements = {};
        this.editingNoteIndex = -1;

        this.cacheElements();
        this.bindEvents();
        this.renderHotkeys();
        this.renderSettings();
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Playlist
            playlist: document.getElementById('playlist'),
            dropArea: document.getElementById('drop-area'),
            searchInput: document.getElementById('search-input'),
            trackCount: document.getElementById('track-count'),
            totalDuration: document.getElementById('total-duration'),
            remainingDuration: document.getElementById('remaining-duration'),
            endTime: document.getElementById('end-time'),

            // Now Playing
            currentTrackName: document.getElementById('current-track-name'),
            currentTrackNote: document.getElementById('current-track-note'),
            nextTrackInfo: document.getElementById('next-track-info'),
            timer: document.getElementById('timer'),
            progressBar: document.getElementById('progress-bar'),
            progressContainer: document.getElementById('progress-container'),
            progressHover: document.getElementById('progress-hover'),
            timeCurrent: document.getElementById('time-current'),
            timeTotal: document.getElementById('time-total'),

            // Controls
            playBtn: document.getElementById('play-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            nextBtn: document.getElementById('next-btn'),
            prevBtn: document.getElementById('prev-btn'),
            loopBtn: document.getElementById('loop-btn'),
            loopAllBtn: document.getElementById('loop-all-btn'),

            // Volume & Speed
            volumeSlider: document.getElementById('volume-slider'),
            volumeValue: document.getElementById('volume-value'),
            volumeIcon: document.getElementById('volume-icon'),
            speedSlider: document.getElementById('speed-slider'),
            speedValue: document.getElementById('speed-value'),
            speedReset: document.getElementById('speed-reset'),

            // Concert Timer
            concertTimer: document.getElementById('concert-timer'),
            concertTimerBtn: document.getElementById('concert-timer-btn'),
            concertTimerReset: document.getElementById('concert-timer-reset'),

            // Modals
            settingsModal: document.getElementById('settings-modal'),
            settingsBody: document.getElementById('settings-body'),
            noteModal: document.getElementById('note-modal'),
            noteInput: document.getElementById('note-input'),
            noteTrackTitle: document.getElementById('note-track-title'),

            // Other
            hotkeysPanel: document.getElementById('hotkeys-panel'),
            toastContainer: document.getElementById('toast-container'),
            fileInput: document.getElementById('file-input'),
            importInput: document.getElementById('import-input')
        };
    }

    /**
     * Bind all UI events
     */
    bindEvents() {
        // ==================== FILE DRAG & DROP ====================
        
        const dropArea = this.elements.dropArea;
        if (dropArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
                dropArea.addEventListener(event, (e) => e.preventDefault());
                document.body.addEventListener(event, (e) => e.preventDefault());
            });

            ['dragenter', 'dragover'].forEach(event => {
                dropArea.addEventListener(event, () => {
                    dropArea.classList.add('highlight');
                });
            });

            ['dragleave', 'drop'].forEach(event => {
                dropArea.addEventListener(event, () => {
                    dropArea.classList.remove('highlight');
                });
            });

            dropArea.addEventListener('drop', (e) => {
                this.app.handleFiles(e.dataTransfer.files);
            });

            dropArea.addEventListener('click', () => {
                this.elements.fileInput?.click();
            });
        }

        // File input
        this.elements.fileInput?.addEventListener('change', (e) => {
            this.app.handleFiles(e.target.files);
            e.target.value = '';
        });

        // Import input
        this.elements.importInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.app.importPlaylist(e.target.files[0]);
            }
            e.target.value = '';
        });

        // ==================== SEARCH ====================
        
        this.elements.searchInput?.addEventListener('input', 
            Utils.debounce((e) => this.filterPlaylist(e.target.value), 150)
        );

        // ==================== PROGRESS BAR ====================
        
        const progressContainer = this.elements.progressContainer;
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                this.app.seekToPosition(e);
            });

            progressContainer.addEventListener('mousemove', (e) => {
                this.updateProgressHover(e);
            });

            progressContainer.addEventListener('mouseleave', () => {
                if (this.elements.progressHover) {
                    this.elements.progressHover.style.opacity = '0';
                }
            });
        }

        // ==================== VOLUME ====================
        
        this.elements.volumeSlider?.addEventListener('input', (e) => {
            this.app.setVolume(parseInt(e.target.value));
        });

        this.elements.volumeIcon?.addEventListener('click', () => {
            this.app.toggleMute();
        });

        // ==================== SPEED ====================
        
        this.elements.speedSlider?.addEventListener('input', (e) => {
            this.app.setSpeed(e.target.value);
        });

        this.elements.speedReset?.addEventListener('click', () => {
            this.app.resetSpeed();
        });

        // ==================== MAIN CONTROLS ====================
        
        this.elements.playBtn?.addEventListener('click', () => {
            this.app.togglePlay();
        });

        this.elements.pauseBtn?.addEventListener('click', () => {
            this.app.togglePause();
        });

        this.elements.nextBtn?.addEventListener('click', () => {
            this.app.nextTrack();
        });

        this.elements.prevBtn?.addEventListener('click', () => {
            this.app.prevTrack();
        });

        this.elements.loopBtn?.addEventListener('click', () => {
            this.app.toggleLoop();
        });

        this.elements.loopAllBtn?.addEventListener('click', () => {
            this.app.toggleLoopAll();
        });

        // ==================== HEADER BUTTONS ====================
        
        document.getElementById('import-btn')?.addEventListener('click', () => {
            this.elements.importInput?.click();
        });

        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.app.exportPlaylist();
        });

        document.getElementById('clear-btn')?.addEventListener('click', () => {
            if (confirm('Очистить весь плейлист?')) {
                this.app.clearPlaylist();
            }
        });

        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        document.getElementById('hotkeys-btn')?.addEventListener('click', () => {
            this.toggleHotkeysPanel();
        });

        document.getElementById('schedule-btn')?.addEventListener('click', () => {
            this.app.toggleSchedule();
        });

        document.getElementById('remote-btn')?.addEventListener('click', () => {
            this.app.showRemoteControl();
        });

        // ==================== MODE TOGGLE ====================
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.app.setPlayMode(e.target.dataset.mode);
            });
        });

        // ==================== CONCERT TIMER ====================
        
        this.elements.concertTimerBtn?.addEventListener('click', () => {
            this.app.toggleConcertTimer();
        });

        this.elements.concertTimerReset?.addEventListener('click', () => {
            this.app.resetConcertTimer();
        });

        // ==================== SETTINGS MODAL ====================
        
        document.getElementById('settings-close')?.addEventListener('click', () => {
            this.closeSettings();
        });

        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });

        // ==================== NOTE MODAL ====================
        
        document.getElementById('note-close')?.addEventListener('click', () => {
            this.closeNoteModal();
        });

        document.getElementById('note-cancel')?.addEventListener('click', () => {
            this.closeNoteModal();
        });

        document.getElementById('note-save')?.addEventListener('click', () => {
            this.saveNote();
        });

        this.elements.noteModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.noteModal) {
                this.closeNoteModal();
            }
        });

        // Enter to save note
        this.elements.noteInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.saveNote();
            }
        });

        // ==================== KEYBOARD SHORTCUTS ====================
        
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // ==================== BEFORE UNLOAD ====================
        
        // Handled in app.js

        // ==================== FIRST INTERACTION ====================
        
        // Handled in app.js
    }

    // ==================== PLAYLIST RENDERING ====================

    /**
     * Render playlist
     */
    renderPlaylist() {
        const container = this.elements.playlist;
        if (!container) return;

        const playlist = this.app.playlist;

        if (playlist.isEmpty) {
            container.innerHTML = `
                <li class="empty-state">
                    <div class="icon">🎵</div>
                    <p>Плейлист пуст</p>
                    <small>Загрузите треки для начала работы</small>
                </li>
            `;
            this.updateTrackCount();
            return;
        }

        // Calculate schedule if enabled
        const showSchedule = this.app.settings.get('showSchedule');
        let schedule = {};
        
        if (showSchedule) {
            const startTimeStr = this.app.settings.get('concertStartTime');
            const startTime = Utils.parseTimeString(startTimeStr);
            schedule = playlist.calculateSchedule(startTime);
        }

        // Build playlist HTML
        container.innerHTML = '';

        playlist.tracks.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'track-item';
            li.draggable = true;
            li.dataset.index = index;

            // State classes
            if (index === playlist.currentIndex) {
                li.classList.add(this.app.audioEngine.isPlaying ? 'playing' : 'selected');
                if (this.app.audioEngine.isPlaying) {
                    li.style.setProperty('--progress', `${this.app.audioEngine.getProgress()}%`);
                }
            }
            
            if (index === playlist.currentIndex + 1) {
                li.classList.add('next-up');
            }

            // Build meta info
            let metaHTML = '';
            
            if (track.isLoading) {
                metaHTML = '<span class="loading"></span> Загрузка...';
            } else if (track.error) {
                metaHTML = '<span style="color: var(--danger)">Ошибка загрузки</span>';
            } else {
                if (schedule[index]) {
                    metaHTML += `<span class="track-schedule">⏰ ${schedule[index]}</span>`;
                }
                if (track.note) {
                    metaHTML += `<span class="track-note">📝 ${this.escapeHtml(track.note)}</span>`;
                }
            }

            // Track number with wave bars for playing
            let numberContent = index + 1;
            if (index === playlist.currentIndex && this.app.audioEngine.isPlaying) {
                numberContent = `
                    <div class="wave-bars">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                `;
            }

            li.innerHTML = `
                <div class="track-number">${numberContent}</div>
                <div class="track-info">
                    <div class="track-title">${this.escapeHtml(track.title)}</div>
                    <div class="track-meta">${metaHTML}</div>
                </div>
                <div class="track-actions">
                    <button class="track-btn" data-action="note" title="Заметка">📝</button>
                    <button class="track-btn" data-action="duplicate" title="Копировать">📋</button>
                    <button class="track-btn delete" data-action="delete" title="Удалить">🗑</button>
                </div>
                <div class="track-duration">
                    ${track.duration > 0 ? Utils.formatTime(track.duration) : '--:--'}
                </div>
            `;

            // Click to select
            li.addEventListener('click', (e) => {
                if (!e.target.closest('.track-actions')) {
                    this.app.selectTrack(index);
                }
            });

            // Double-click to play
            li.addEventListener('dblclick', (e) => {
                if (!e.target.closest('.track-actions')) {
                    this.app.selectTrack(index);
                    this.app.play();
                }
            });

            // Action buttons
            li.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    
                    switch (action) {
                        case 'note':
                            this.openNoteModal(index);
                            break;
                        case 'duplicate':
                            this.app.duplicateTrack(index);
                            break;
                        case 'delete':
                            this.app.removeTrack(index);
                            break;
                    }
                });
            });

            // Native drag events (for mouse)
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index);
                li.classList.add('dragging');
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                li.classList.add('drag-over');
            });

            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over');
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    this.app.reorderTrack(fromIndex, toIndex);
                }
            });

            container.appendChild(li);
        });

        this.updateTrackCount();
    }

    /**
     * Update track count display
     */
    updateTrackCount() {
        const el = document.getElementById('track-count');
        if (el) {
            el.textContent = `${this.app.playlist.length} треков`;
        }
    }

    /**
     * Scroll to current track
     */
    scrollToCurrentTrack() {
        const index = this.app.playlist.currentIndex;
        if (index < 0) return;

        const container = this.elements.playlist;
        if (!container) return;

        const item = container.children[index];
        if (item && item.classList.contains('track-item')) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Filter playlist by search query
     */
    filterPlaylist(query) {
        const container = this.elements.playlist;
        if (!container) return;

        const visibleIndices = this.app.playlist.filter(query);
        const items = container.querySelectorAll('.track-item');

        items.forEach((item, index) => {
            const isVisible = visibleIndices.includes(index);
            item.classList.toggle('filtered-out', !isVisible);
        });
    }

    // ==================== NOW PLAYING ====================

    /**
     * Update now playing info
     */
    updateNowPlaying(track) {
        const titleEl = this.elements.currentTrackName;
        const noteEl = this.elements.currentTrackNote;
        const nextEl = this.elements.nextTrackInfo;
        const timerEl = this.elements.timer;
        const totalEl = this.elements.timeTotal;

        if (!track) {
            if (titleEl) titleEl.textContent = '—';
            if (noteEl) noteEl.textContent = '';
            if (nextEl) nextEl.textContent = '';
            if (timerEl) {
                timerEl.textContent = '--:--';
                timerEl.className = '';
            }
            if (totalEl) totalEl.textContent = '0:00';
            return;
        }

        if (titleEl) titleEl.textContent = track.title;
        if (noteEl) noteEl.textContent = track.note || '';
        if (totalEl) totalEl.textContent = Utils.formatTime(track.duration);

        // Next track info
        const nextTrack = this.app.playlist.getNext();
        if (nextEl) {
            nextEl.textContent = nextTrack ? `Далее: ${nextTrack.title}` : '';
        }
    }

    /**
     * Update time display
     */
    updateTime(data) {
        const { currentTime, duration, remaining, progress } = data;

        // Current time
        if (this.elements.timeCurrent) {
            this.elements.timeCurrent.textContent = Utils.formatTime(currentTime);
        }

        // Progress bar
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${Math.min(progress, 100)}%`;
        }

        // Timer
        if (this.elements.timer) {
            this.elements.timer.textContent = Utils.formatTime(remaining);
            
            // Warning classes
            const warning = this.app.settings.get('warningTime');
            const critical = this.app.settings.get('criticalTime');

            this.elements.timer.classList.remove('warning', 'critical');
            
            if (remaining <= critical && remaining > 0) {
                this.elements.timer.classList.add('critical');
            } else if (remaining <= warning) {
                this.elements.timer.classList.add('warning');
            }
        }
    }

    /**
     * Update progress hover preview
     */
    updateProgressHover(e) {
        const track = this.app.playlist.getCurrent();
        if (!track || !track.duration) return;

        const container = this.elements.progressContainer;
        const hover = this.elements.progressHover;
        if (!container || !hover) return;

        const rect = container.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * track.duration;

        hover.textContent = Utils.formatTime(time);
        hover.style.left = `${e.clientX - rect.left}px`;
        hover.style.opacity = '1';
    }

    // ==================== CONTROL BUTTONS ====================

    /**
     * Update play button state
     */
    updatePlayButton(isPlaying) {
        const btn = this.elements.playBtn;
        if (!btn) return;

        if (isPlaying) {
            btn.innerHTML = '<span class="control-icon">⏹</span><span>STOP</span><span class="hotkey">SPACE</span>';
            btn.classList.add('playing');
        } else {
            btn.innerHTML = '<span class="control-icon">▶</span><span>PLAY</span><span class="hotkey">SPACE</span>';
            btn.classList.remove('playing');
        }
    }

    /**
     * Update pause button state
     */
    updatePauseButton(isPaused) {
        const btn = this.elements.pauseBtn;
        if (!btn) return;

        if (isPaused) {
            btn.innerHTML = '<span class="control-icon">▶</span><span>RESUME</span><span class="hotkey">P</span>';
            btn.classList.add('paused');
        } else {
            btn.innerHTML = '<span class="control-icon">⏸</span><span>PAUSE</span><span class="hotkey">P</span>';
            btn.classList.remove('paused');
        }
    }

    /**
     * Update loop button state
     */
    updateLoopButton(isLooping) {
        const btn = this.elements.loopBtn;
        if (btn) {
            btn.classList.toggle('active', isLooping);
        }
    }

    /**
     * Update loop all button state
     */
    updateLoopAllButton(isLoopingAll) {
        const btn = this.elements.loopAllBtn;
        if (btn) {
            btn.classList.toggle('active', isLoopingAll);
        }
    }

    /**
     * Update play mode buttons
     */
    updatePlayMode(mode) {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    // ==================== VOLUME & SPEED ====================

    /**
     * Update volume display
     */
    updateVolume(value) {
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.value = value;
        }
        
        if (this.elements.volumeValue) {
            this.elements.volumeValue.textContent = `${value}%`;
        }
        
        if (this.elements.volumeIcon) {
            if (value == 0) {
                this.elements.volumeIcon.textContent = '🔇';
            } else if (value < 50) {
                this.elements.volumeIcon.textContent = '🔉';
            } else {
                this.elements.volumeIcon.textContent = '🔊';
            }
        }
    }

    /**
     * Update speed display
     */
    updateSpeed(value) {
        if (this.elements.speedSlider) {
            this.elements.speedSlider.value = value;
        }
        
        if (this.elements.speedValue) {
            this.elements.speedValue.textContent = `${parseFloat(value).toFixed(2)}x`;
        }
    }

    // ==================== CONCERT TIMER ====================

    /**
     * Update concert timer display
     */
    updateConcertTimer(timeString, isRunning) {
        const display = document.querySelector('.concert-timer-value');
        if (display) {
            display.textContent = timeString;
            display.classList.toggle('running', isRunning);
        }
    }

    // ==================== MODALS ====================

    /**
     * Open settings modal
     */
    openSettings() {
        this.renderSettings();
        if (this.elements.settingsModal) {
            this.elements.settingsModal.classList.add('active');
        }
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.classList.remove('active');
        }
    }

    /**
     * Render settings form
     */
    renderSettings() {
        if (!this.elements.settingsBody) return;

        this.elements.settingsBody.innerHTML = this.app.settings.generateHTML();

        // Bind settings change events
        this.elements.settingsBody.querySelectorAll('[data-setting]').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.setting;
                let value;
                
                if (e.target.type === 'checkbox') {
                    value = e.target.checked;
                } else if (e.target.type === 'number') {
                    value = parseFloat(e.target.value);
                } else {
                    value = e.target.value;
                }
                
                this.app.settings.set(key, value);
            });
        });
    }

    /**
     * Open note modal
     */
    openNoteModal(index) {
        const track = this.app.playlist.tracks[index];
        if (!track) return;

        this.editingNoteIndex = index;
        
        if (this.elements.noteTrackTitle) {
            this.elements.noteTrackTitle.textContent = track.title;
        }
        
        if (this.elements.noteInput) {
            this.elements.noteInput.value = track.note || '';
        }
        
        if (this.elements.noteModal) {
            this.elements.noteModal.classList.add('active');
        }
        
        // Focus input
        setTimeout(() => {
            this.elements.noteInput?.focus();
        }, 100);
    }

    /**
     * Close note modal
     */
    closeNoteModal() {
        if (this.elements.noteModal) {
            this.elements.noteModal.classList.remove('active');
        }
        this.editingNoteIndex = -1;
    }

    /**
     * Save note
     */
    saveNote() {
        if (this.editingNoteIndex >= 0 && this.elements.noteInput) {
            const note = this.elements.noteInput.value.trim();
            this.app.playlist.setNote(this.editingNoteIndex, note);
            this.showToast('Заметка сохранена', 'success');
        }
        this.closeNoteModal();
    }

    // ==================== HOTKEYS ====================

    /**
     * Render hotkeys panel
     */
    renderHotkeys() {
        if (!this.elements.hotkeysPanel) return;

        const hotkeys = [
            ['Play / Stop', 'SPACE'],
            ['Пауза', 'P'],
            ['Следующий', 'ENTER / →'],
            ['Предыдущий', '←'],
            ['Громкость +', '↑'],
            ['Громкость -', '↓'],
            ['Перемотка -5с', '['],
            ['Перемотка +5с', ']'],
            ['Loop', 'L'],
            ['Полный экран', 'F'],
            ['Трек 1-9', '1-9'],
            ['Поиск', 'Ctrl+F']
        ];

        this.elements.hotkeysPanel.innerHTML = `
            <div class="hotkeys-title">⌨️ Горячие клавиши</div>
            <div class="hotkeys-list">
                ${hotkeys.map(([action, key]) => `
                    <div class="hotkey-item">
                        <span class="hotkey-action">${action}</span>
                        <span class="hotkey-key">${key}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Toggle hotkeys panel
     */
    toggleHotkeysPanel() {
        if (this.elements.hotkeysPanel) {
            this.elements.hotkeysPanel.classList.toggle('visible');
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // Skip if typing in input
        const tagName = e.target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }

        // Ctrl+F for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.elements.searchInput?.focus();
            return;
        }

        // Handle other keys
        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.app.togglePlay();
                break;

            case 'p':
            case 'P':
            case 'з':
            case 'З':
                e.preventDefault();
                this.app.togglePause();
                break;

            case 'l':
            case 'L':
            case 'д':
            case 'Д':
                e.preventDefault();
                this.app.toggleLoop();
                break;

            case 'Enter':
                e.preventDefault();
                this.app.nextTrack();
                break;

            case 'ArrowRight':
                e.preventDefault();
                if (e.shiftKey) {
                    this.app.seekRelative(10);
                } else {
                    this.app.nextTrack();
                }
                break;

            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) {
                    this.app.seekRelative(-10);
                } else {
                    this.app.prevTrack();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.app.adjustVolume(5);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.app.adjustVolume(-5);
                break;

            case 'f':
            case 'F':
            case 'а':
            case 'А':
                e.preventDefault();
                this.toggleFullscreen();
                break;

            case '[':
            case 'х':
                e.preventDefault();
                this.app.seekRelative(-5);
                break;

            case ']':
            case 'ъ':
                e.preventDefault();
                this.app.seekRelative(5);
                break;

            case 'm':
            case 'M':
            case 'ь':
            case 'Ь':
                e.preventDefault();
                this.app.toggleMute();
                break;

            case 'Escape':
                this.closeSettings();
                this.closeNoteModal();
                if (this.elements.hotkeysPanel) {
                    this.elements.hotkeysPanel.classList.remove('visible');
                }
                break;

            default:
                // Number keys 1-9 for quick track selection
                if (e.key >= '1' && e.key <= '9') {
                    const index = parseInt(e.key) - 1;
                    if (index < this.app.playlist.length) {
                        e.preventDefault();
                        this.app.selectTrack(index);
                    }
                }
        }
    }

    // ==================== FULLSCREEN ====================

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        document.body.classList.toggle('fullscreen-mode');
    }

    // ==================== TOAST NOTIFICATIONS ====================

    /**
     * Show toast notification
     */
    showToast(message, type = 'success') {
        const container = this.elements.toastContainer;
        if (!container) return;

        const icons = {
            success: '✓',
            warning: '⚠',
            error: '✕',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
        `;
        
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==================== HELPERS ====================

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}