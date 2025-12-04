/**
 * Pro Concert Player v3.1
 * Main Application
 */

class ConcertPlayerApp {
    constructor() {
        console.log('🎵 Initializing Concert Player v3.1...');

        // Core modules
        this.settings = new Settings();
        this.audioEngine = new AudioEngine();
        this.playlist = new Playlist();
        
        // Load saved settings
        this.settings.load();

        // Application state
        this.volume = this.settings.get('volume') || 100;
        this.isLoopingAll = false;
        this.lastVolume = 100;
        this.currentSpeed = 1;

        // Concert timer state
        this.concertTimerRunning = false;
        this.concertStartTime = 0;
        this.concertElapsed = 0;
        this.concertTimerInterval = null;

        // Modules that will be initialized
        this.ui = null;
        this.visualizer = null;
        this.touchMode = null;
        this.dragDrop = null;
        this.remoteConnection = null;

        // Initialize everything
        this.init();
    }

    /**
     * Initialize all modules
     */
    async init() {
        try {
            // 1. Initialize UI first (needs DOM)
            this.ui = new UI(this);

            // 2. Initialize visualizer
            this.initVisualizer();

            // 3. Initialize touch mode
            this.initTouchMode();

            // 4. Initialize drag & drop
            this.initDragDrop();

            // 5. Initialize remote connection
            this.initRemoteConnection();

            // 6. Set initial volume
            this.setVolume(this.volume);

            // 7. Bind audio engine events
            this.audioEngine.onTimeUpdate = (data) => this.onTimeUpdate(data);

            // 8. Bind playlist events
            this.playlist.on('change', () => {
                this.ui.renderPlaylist();
                this.updatePlaylistInfo();
                this.broadcastState();
            });
            
            this.playlist.on('select', (track) => {
                this.onTrackSelect(track);
                this.broadcastState();
            });

            // 9. Settings change listener
            this.settings.onChange((values) => {
                this.onSettingsChange(values);
            });

            // 10. Start concert timer loop
            this.startConcertTimerLoop();

            // 11. Setup before unload warning
            this.setupBeforeUnload();

            // 12. Register service worker for PWA
            await this.registerServiceWorker();

            // 13. Check for app install prompt
            this.setupInstallPrompt();

            console.log('✅ Concert Player initialized successfully');

        } catch (error) {
            console.error('❌ Initialization error:', error);
        }
    }

    // ==================== INITIALIZATION METHODS ====================

    /**
     * Initialize audio visualizer
     */
    initVisualizer() {
        requestAnimationFrame(() => {
            const canvas = document.getElementById('visualizer');
            if (canvas) {
                this.visualizer = new Visualizer('visualizer', this.audioEngine);
                
                if (this.settings.get('showVisualizer')) {
                    setTimeout(() => {
                        if (this.visualizer) {
                            this.visualizer.start();
                        }
                    }, 300);
                }
            } else {
                console.warn('Visualizer canvas not found');
            }
        });
    }

    /**
     * Initialize touch mode
     */
    initTouchMode() {
        if (typeof TouchMode !== 'undefined') {
            this.touchMode = new TouchMode(this);
        }
    }

    /**
     * Initialize enhanced drag & drop
     */
    initDragDrop() {
        if (typeof DragDropManager === 'undefined') return;

        const playlist = document.getElementById('playlist');
        if (!playlist) return;

        this.dragDrop = new DragDropManager(playlist, {
            itemSelector: '.track-item',
            onReorder: (from, to) => {
                this.reorderTrack(from, to);
            }
        });
    }

    /**
     * Initialize remote control connection
     */
    initRemoteConnection() {
        if (typeof RemoteConnection !== 'undefined') {
            this.remoteConnection = new RemoteConnection(this);
            this.remoteConnection.start();
        }
    }

    /**
     * Register service worker for PWA
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('✅ Service Worker registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.ui.showToast('Доступно обновление. Перезагрузите страницу.', 'info');
                        }
                    });
                }
            });

        } catch (error) {
            console.warn('Service Worker registration failed:', error);
        }
    }

    /**
     * Setup PWA install prompt
     */
    setupInstallPrompt() {
        let deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Show install button
            this.showInstallButton(deferredPrompt);
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            deferredPrompt = null;
            this.hideInstallButton();
        });
    }

    /**
     * Show install button
     */
    showInstallButton(prompt) {
        const existingBtn = document.getElementById('install-btn');
        if (existingBtn) return;

        const btn = document.createElement('button');
        btn.id = 'install-btn';
        btn.className = 'header-btn';
        btn.innerHTML = '📲';
        btn.title = 'Установить приложение';
        
        btn.addEventListener('click', async () => {
            if (prompt) {
                prompt.prompt();
                const result = await prompt.userChoice;
                if (result.outcome === 'accepted') {
                    this.ui.showToast('Приложение установлено!', 'success');
                }
            }
        });

        const controls = document.querySelector('.header-controls');
        if (controls) {
            controls.insertBefore(btn, controls.firstChild);
        }
    }

    /**
     * Hide install button
     */
    hideInstallButton() {
        const btn = document.getElementById('install-btn');
        if (btn) btn.remove();
    }

    /**
     * Setup before unload warning
     */
    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.settings.get('confirmClose')) {
                if (this.audioEngine.isPlaying || !this.playlist.isEmpty) {
                    e.preventDefault();
                    e.returnValue = 'У вас есть несохранённые данные. Закрыть?';
                    return e.returnValue;
                }
            }
        });
    }

    /**
     * Handle settings changes
     */
    onSettingsChange(values) {
        // Visualizer toggle
        if (this.visualizer) {
            if (values.showVisualizer) {
                this.visualizer.start();
            } else {
                this.visualizer.stop();
            }
        }

        // Re-render playlist for schedule changes
        this.ui.renderPlaylist();
    }

    // ==================== FILE HANDLING ====================

    /**
     * Handle dropped/selected files
     */
    async handleFiles(files) {
        const fileArray = Array.from(files);
        const audioFiles = fileArray.filter(f => Utils.isAudioFile(f));

        if (audioFiles.length === 0) {
            this.ui.showToast('Аудио файлы не найдены', 'warning');
            return;
        }

        this.ui.showToast(`Загрузка ${audioFiles.length} файл(ов)...`, 'info');

        let loadedCount = 0;
        let errorCount = 0;

        for (const file of audioFiles) {
            const title = Utils.getFilenameWithoutExt(file.name);
            
            // Check for imported metadata
            const importedMeta = this.playlist.matchImportedTrack(title);

            // Add track to playlist
            const track = this.playlist.add({
                title,
                file,
                note: importedMeta?.note || ''
            });

            const trackIndex = this.playlist.tracks.indexOf(track);

            // Update to loading state
            this.playlist.updateTrack(trackIndex, {
                isLoading: true
            });

            // Load audio asynchronously
            try {
                const buffer = await this.audioEngine.loadFile(file);
                
                this.playlist.updateTrack(trackIndex, {
                    buffer,
                    duration: buffer.duration,
                    isLoaded: true,
                    isLoading: false,
                    error: false
                });
                
                loadedCount++;

            } catch (err) {
                console.error('Failed to load audio:', file.name, err);
                
                this.playlist.updateTrack(trackIndex, {
                    isLoading: false,
                    error: true
                });
                
                errorCount++;
            }
        }

        // Auto-select first track if nothing selected
        if (!this.playlist.hasSelection && !this.playlist.isEmpty) {
            this.selectTrack(0);
        }

        // Show result
        if (errorCount > 0) {
            this.ui.showToast(`Загружено: ${loadedCount}, ошибок: ${errorCount}`, 'warning');
        } else {
            this.ui.showToast(`Загружено: ${loadedCount} трек(ов)`, 'success');
        }

        this.updatePlaylistInfo();
    }

    // ==================== PLAYLIST OPERATIONS ====================

    /**
     * Select track by index
     */
    selectTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;

        // Stop current playback
        if (this.audioEngine.isPlaying) {
            this.stop(false);
        }

        // Reset pause position
        this.audioEngine.pausePosition = 0;

        // Select in playlist
        const track = this.playlist.select(index);
        
        if (track) {
            this.ui.updateNowPlaying(track);
            this.ui.updateTime({
                currentTime: 0,
                duration: track.duration || 0,
                remaining: track.duration || 0,
                progress: 0
            });
            this.ui.scrollToCurrentTrack();
        }
    }

    /**
     * Remove track by index
     */
    removeTrack(index) {
        const wasCurrent = index === this.playlist.currentIndex;
        const wasPlaying = this.audioEngine.isPlaying;
        
        if (wasCurrent && wasPlaying) {
            this.stop(false);
        }

        const removed = this.playlist.remove(index);
        
        if (removed) {
            if (wasCurrent) {
                const newCurrent = this.playlist.getCurrent();
                this.ui.updateNowPlaying(newCurrent);
            }
            
            this.ui.showToast('Трек удалён', 'success');
            this.updatePlaylistInfo();
        }
    }

    /**
     * Duplicate track
     */
    duplicateTrack(index) {
        const copy = this.playlist.duplicate(index);
        
        if (copy) {
            this.ui.showToast('Трек скопирован', 'success');
        }
    }

    /**
     * Reorder track
     */
    reorderTrack(fromIndex, toIndex) {
        this.playlist.reorder(fromIndex, toIndex);
    }

    /**
     * Clear entire playlist
     */
    clearPlaylist() {
        if (this.playlist.isEmpty) {
            this.ui.showToast('Плейлист уже пуст', 'warning');
            return;
        }

        if (this.audioEngine.isPlaying) {
            this.stop(false);
        }

        this.playlist.clear();
        this.ui.updateNowPlaying(null);
        
        const searchInput = this.ui.elements.searchInput;
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.ui.showToast('Плейлист очищен', 'success');
        this.updatePlaylistInfo();
    }

    /**
     * Update playlist info display
     */
    updatePlaylistInfo() {
        const total = this.playlist.getTotalDuration();
        
        // Total duration
        const totalEl = document.querySelector('#total-duration .footer-stat-value');
        if (totalEl) {
            totalEl.textContent = Utils.formatTimeHMS(total);
        }

        // End time calculation
        const endEl = document.querySelector('#end-time .footer-stat-value');
        if (endEl) {
            const startTimeStr = this.settings.get('concertStartTime');
            const startTime = Utils.parseTimeString(startTimeStr);
            
            if (startTime && total > 0) {
                const endTime = new Date(startTime.getTime() + total * 1000);
                endEl.textContent = Utils.formatTimeHHMM(endTime);
            } else {
                endEl.textContent = '--:--';
            }
        }
    }

    /**
     * Update remaining duration display
     */
    updateRemainingDuration(currentPosition = 0) {
        const remainingEl = document.querySelector('#remaining-duration .footer-stat-value');
        if (!remainingEl) return;

        const remaining = this.playlist.getRemainingDuration(currentPosition);
        if (remaining > 0) {
            remainingEl.textContent = Utils.formatTimeHMS(remaining);
        } else {
            remainingEl.textContent = '--:--';
        }
    }

    /**
     * On track selected callback
     */
    onTrackSelect(track) {
        this.ui.updateNowPlaying(track);
        this.ui.renderPlaylist();
    }

    // ==================== PLAYBACK CONTROL ====================

    /**
     * Play current or selected track
     */
    play() {
        // Select first track if nothing selected
        if (!this.playlist.hasSelection && !this.playlist.isEmpty) {
            this.selectTrack(0);
        }

        const track = this.playlist.getCurrent();
        
        if (!track) {
            this.ui.showToast('Выберите трек', 'warning');
            return;
        }
        
        if (!track.isLoaded) {
            this.ui.showToast('Трек ещё загружается...', 'warning');
            return;
        }

        // Resume audio context (required after user interaction)
        this.audioEngine.resume();

        // Get current offset for resume
        const offset = this.audioEngine.pausePosition || 0;

        // Play track
        this.audioEngine.play(track.buffer, {
            offset: offset,
            fadeIn: offset === 0 ? this.settings.get('fadeInDuration') : 0,
            loop: this.audioEngine.isLooping,
            playbackRate: this.currentSpeed,
            onEnded: () => this.onTrackEnded()
        });

        // Start visualizer
        if (this.visualizer && this.settings.get('showVisualizer')) {
            this.visualizer.start();
        }

        // Auto-start concert timer on first play
        if (!this.concertTimerRunning && this.concertElapsed === 0) {
            this.startConcertTimer();
        }

        // Update UI
        this.ui.updatePlayButton(true);
        this.ui.updatePauseButton(false);
        this.ui.renderPlaylist();
        
        // Broadcast to remotes
        this.broadcastState();
    }

    /**
     * Stop playback
     */
    stop(withFade = true) {
        const fadeOut = withFade ? this.settings.get('fadeOutDuration') : 0;
        this.audioEngine.stop(fadeOut);

        // Update UI
        this.ui.updatePlayButton(false);
        this.ui.updatePauseButton(false);
        this.ui.renderPlaylist();

        // Reset time display
        const track = this.playlist.getCurrent();
        if (track) {
            this.ui.updateTime({
                currentTime: 0,
                duration: track.duration || 0,
                remaining: track.duration || 0,
                progress: 0
            });
        }

        // Broadcast to remotes
        this.broadcastState();
    }

    /**
     * Toggle play/stop
     */
    togglePlay() {
        if (this.audioEngine.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    /**
     * Toggle pause/resume
     */
    togglePause() {
        if (this.audioEngine.isPaused) {
            this.play();
        } else if (this.audioEngine.isPlaying) {
            this.audioEngine.pause();
            this.ui.updatePauseButton(true);
            this.ui.updatePlayButton(false);
            this.broadcastState();
        }
    }

    /**
     * Go to next track
     */
    nextTrack() {
        const wasPlaying = this.audioEngine.isPlaying;

        if (wasPlaying) {
            this.stop(false);
        }

        this.audioEngine.pausePosition = 0;

        const track = this.playlist.next();

        if (track && wasPlaying && this.settings.get('playMode') === 'auto') {
            setTimeout(() => this.play(), 50);
        }
    }

    /**
     * Go to previous track
     */
    prevTrack() {
        const wasPlaying = this.audioEngine.isPlaying;
        const elapsed = this.audioEngine.getCurrentTime();

        // If more than 3 seconds in, restart current track
        if (elapsed > 3) {
            if (wasPlaying) {
                this.stop(false);
            }
            this.audioEngine.pausePosition = 0;
            
            if (wasPlaying) {
                setTimeout(() => this.play(), 50);
            } else {
                const track = this.playlist.getCurrent();
                if (track) {
                    this.ui.updateTime({
                        currentTime: 0,
                        duration: track.duration,
                        remaining: track.duration,
                        progress: 0
                    });
                }
            }
            return;
        }

        if (wasPlaying) {
            this.stop(false);
        }

        this.audioEngine.pausePosition = 0;

        const track = this.playlist.prev();

        if (track && wasPlaying && this.settings.get('playMode') === 'auto') {
            setTimeout(() => this.play(), 50);
        }
    }

    /**
     * Handle track ended
     */
    onTrackEnded() {
        this.ui.updatePlayButton(false);
        this.ui.updatePauseButton(false);

        const mode = this.settings.get('playMode');

        if (mode === 'auto') {
            // Auto mode: play next track
            if (this.playlist.currentIndex < this.playlist.length - 1) {
                this.audioEngine.pausePosition = 0;
                this.playlist.next();
                setTimeout(() => this.play(), 100);
            } else if (this.isLoopingAll) {
                // Loop all: go to first track
                this.audioEngine.pausePosition = 0;
                this.playlist.select(0);
                setTimeout(() => this.play(), 100);
            } else {
                // End of playlist
                this.audioEngine.pausePosition = 0;
                this.playlist.select(0);
                this.ui.renderPlaylist();
            }
        } else {
            // Manual mode
            if (this.settings.get('autoSelectNext')) {
                if (this.playlist.currentIndex < this.playlist.length - 1) {
                    this.audioEngine.pausePosition = 0;
                    this.selectTrack(this.playlist.currentIndex + 1);
                }
            }
            this.ui.renderPlaylist();
        }

        this.broadcastState();
    }

    /**
     * Seek to position from click event
     */
    seekToPosition(e) {
        const track = this.playlist.getCurrent();
        if (!track || !track.duration) return;

        const container = this.ui.elements.progressContainer;
        const rect = container.getBoundingClientRect();
        const percent = Utils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const position = percent * track.duration;

        this.audioEngine.seek(position);

        // Update UI immediately
        this.ui.updateTime({
            currentTime: position,
            duration: track.duration,
            remaining: track.duration - position,
            progress: percent * 100
        });
    }

    /**
     * Seek relative to current position
     */
    seekRelative(delta) {
        const track = this.playlist.getCurrent();
        if (!track || !track.duration) return;

        const current = this.audioEngine.getCurrentTime();
        const newPosition = Utils.clamp(current + delta, 0, track.duration - 0.1);

        this.audioEngine.seek(newPosition);
    }

    /**
     * On time update callback from audio engine
     */
    onTimeUpdate(data) {
        this.ui.updateTime(data);
        this.updateRemainingDuration(data.currentTime);

        // Update playlist item progress
        const currentItem = this.ui.elements.playlist?.querySelector('.track-item.playing');
        if (currentItem) {
            currentItem.style.setProperty('--progress', `${data.progress}%`);
        }

        // Broadcast to remotes periodically
        if (this.remoteServer && this.remoteServer.isRunning) {
            this.remoteServer.sendState();
        }
    }

    // ==================== LOOP CONTROL ====================

    /**
     * Toggle loop current track
     */
    toggleLoop() {
        const isLooping = !this.audioEngine.isLooping;
        this.audioEngine.setLoop(isLooping);
        this.ui.updateLoopButton(isLooping);
        this.ui.showToast(`Loop ${isLooping ? 'включён' : 'выключен'}`, 'success');
    }

    /**
     * Toggle loop all tracks
     */
    toggleLoopAll() {
        this.isLoopingAll = !this.isLoopingAll;
        this.ui.updateLoopAllButton(this.isLoopingAll);
        this.ui.showToast(`Loop All ${this.isLoopingAll ? 'включён' : 'выключен'}`, 'success');
    }

    // ==================== VOLUME CONTROL ====================

    /**
     * Set volume (0-100)
     */
    setVolume(value) {
        this.volume = Utils.clamp(value, 0, 100);
        this.audioEngine.setVolume(this.volume / 100);
        this.settings.set('volume', this.volume);
        this.ui.updateVolume(this.volume);
        this.broadcastState();
    }

    /**
     * Adjust volume by delta
     */
    adjustVolume(delta) {
        this.setVolume(this.volume + delta);
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        if (this.volume > 0) {
            this.lastVolume = this.volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.lastVolume || 100);
        }
    }

    // ==================== SPEED CONTROL ====================

    /**
     * Set playback speed
     */
    setSpeed(value) {
        this.currentSpeed = Utils.clamp(parseFloat(value), 0.5, 2);
        this.audioEngine.setPlaybackRate(this.currentSpeed);
        this.ui.updateSpeed(this.currentSpeed);
    }

    /**
     * Reset speed to 1x
     */
    resetSpeed() {
        this.setSpeed(1);
    }

    // ==================== PLAY MODE ====================

    /**
     * Set play mode (manual/auto)
     */
    setPlayMode(mode) {
        this.settings.set('playMode', mode);
        this.ui.updatePlayMode(mode);
        this.ui.showToast(`Режим: ${mode === 'auto' ? 'Автоматический' : 'Ручной'}`, 'success');
    }

    // ==================== SCHEDULE ====================

    /**
     * Toggle schedule display
     */
    toggleSchedule() {
        const current = this.settings.get('showSchedule');
        this.settings.set('showSchedule', !current);
        this.ui.renderPlaylist();
        
        const btn = document.getElementById('schedule-btn');
        if (btn) {
            btn.classList.toggle('active', !current);
        }
        
        this.ui.showToast(`Расписание ${!current ? 'показано' : 'скрыто'}`, 'success');
    }

    // ==================== CONCERT TIMER ====================

    /**
     * Start concert timer update loop
     */
    startConcertTimerLoop() {
        setInterval(() => {
            if (this.concertTimerRunning) {
                const elapsed = (Date.now() - this.concertStartTime) / 1000;
                this.ui.updateConcertTimer(Utils.formatTimeHMS(elapsed), true);
            }
        }, 100);
    }

    /**
     * Toggle concert timer
     */
    toggleConcertTimer() {
        if (this.concertTimerRunning) {
            this.pauseConcertTimer();
        } else {
            this.startConcertTimer();
        }
    }

    /**
     * Start concert timer
     */
    startConcertTimer() {
        this.concertTimerRunning = true;
        this.concertStartTime = Date.now() - this.concertElapsed;
        
        const btn = document.getElementById('concert-timer-btn');
        if (btn) {
            btn.textContent = '⏸';
            btn.classList.add('active');
        }
        
        const valueEl = document.querySelector('.concert-timer-value');
        if (valueEl) {
            valueEl.classList.add('running');
        }
    }

    /**
     * Pause concert timer
     */
    pauseConcertTimer() {
        this.concertTimerRunning = false;
        this.concertElapsed = Date.now() - this.concertStartTime;
        
        const btn = document.getElementById('concert-timer-btn');
        if (btn) {
            btn.textContent = '▶';
            btn.classList.remove('active');
        }
        
        const valueEl = document.querySelector('.concert-timer-value');
        if (valueEl) {
            valueEl.classList.remove('running');
        }
    }

    /**
     * Reset concert timer
     */
    resetConcertTimer() {
        this.concertTimerRunning = false;
        this.concertElapsed = 0;
        this.concertStartTime = 0;
        
        this.ui.updateConcertTimer('00:00:00', false);
        
        const btn = document.getElementById('concert-timer-btn');
        if (btn) {
            btn.textContent = '▶';
            btn.classList.remove('active');
        }
        
        const valueEl = document.querySelector('.concert-timer-value');
        if (valueEl) {
            valueEl.classList.remove('running');
        }
    }

    // ==================== IMPORT/EXPORT ====================

    /**
     * Export playlist to JSON file
     */
    exportPlaylist() {
        if (this.playlist.isEmpty) {
            this.ui.showToast('Плейлист пуст', 'warning');
            return;
        }

        const data = {
            ...this.playlist.export(),
            settings: this.settings.values,
            exportedAt: new Date().toISOString()
        };

        const filename = `concert-setlist_${Utils.getDateString()}.json`;
        Utils.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
        
        this.ui.showToast('Плейлист экспортирован', 'success');
    }

    /**
     * Import playlist from JSON file
     */
    async importPlaylist(file) {
        try {
            const text = await Utils.readFileAsText(file);
            const data = JSON.parse(text);

            // Import settings if present
            if (data.settings) {
                this.settings.update(data.settings);
            }

            // Import playlist metadata
            if (data.tracks && data.tracks.length > 0) {
                this.playlist.import(data);
                this.ui.showToast(
                    `Импортировано ${data.tracks.length} трек(ов). Загрузите аудио файлы.`,
                    'success'
                );
            } else {
                this.ui.showToast('Треки не найдены в файле', 'warning');
            }

        } catch (err) {
            console.error('Import error:', err);
            this.ui.showToast('Ошибка импорта файла', 'error');
        }
    }

    // ==================== REMOTE CONTROL ====================

    /**
     * Show remote control modal
     */
    showRemoteControl() {
        if (this.remoteConnection) {
            this.remoteConnection.showConnectionModal();
        } else {
            this.ui.showToast('Remote не доступен', 'warning');
        }
    }

    /**
     * Broadcast state to remotes
     */
    broadcastState() {
        if (this.remoteConnection && this.remoteConnection.isRunning) {
            this.remoteConnection.sendState();
        }
    }

    // ==================== VISUALIZER ====================

    /**
     * Set visualizer style
     */
    setVisualizerStyle(style) {
        if (this.visualizer) {
            this.visualizer.setStyle(style);
        }
    }

    /**
     * Toggle visualizer
     */
    toggleVisualizer() {
        const current = this.settings.get('showVisualizer');
        this.settings.set('showVisualizer', !current);
        
        if (this.visualizer) {
            if (!current) {
                this.visualizer.start();
            } else {
                this.visualizer.stop();
            }
        }
    }

    // ==================== CLEANUP ====================

    /**
     * Destroy application
     */
    destroy() {
        if (this.visualizer) {
            this.visualizer.destroy();
        }
        if (this.touchMode) {
            this.touchMode.destroy();
        }
        if (this.dragDrop) {
            this.dragDrop.destroy();
        }
        if (this.remoteConnection) {
            this.remoteConnection.destroy();
        }
        if (this.audioEngine) {
            this.audioEngine.destroy();
        }
    }
}

// ==================== INITIALIZE APPLICATION ====================

let app = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new ConcertPlayerApp();
        window.app = app; // Expose for debugging
    } catch (err) {
        console.error('Failed to initialize app:', err);
    }
});

// Handle first user interaction for audio context
const resumeAudio = () => {
    if (app && app.audioEngine) {
        app.audioEngine.resume();
    }
};

document.addEventListener('click', resumeAudio, { once: true });
document.addEventListener('keydown', resumeAudio, { once: true });
document.addEventListener('touchstart', resumeAudio, { once: true });