/**
 * Remote Control Server using BroadcastChannel API
 * For same-origin remote control (no external server needed)
 */

class RemoteServer {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.channel = null;
        this.remoteUrl = '';
        this.connectedClients = 0;
        this.lastState = null;

        // Generate unique session ID
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2, 10);
    }

    /**
     * Start the remote server
     */
    start() {
        if (this.isRunning) return;

        try {
            // Create broadcast channel for communication
            this.channel = new BroadcastChannel(`concert-player-${this.sessionId}`);
            
            // Listen for messages from remotes
            this.channel.onmessage = (event) => this.handleMessage(event.data);

            this.isRunning = true;
            this.remoteUrl = `${window.location.origin}/remote.html?session=${this.sessionId}`;

            // Start state broadcasting
            this.startStateBroadcast();

            console.log('Remote server started:', this.remoteUrl);
            
            return {
                success: true,
                url: this.remoteUrl,
                sessionId: this.sessionId
            };
        } catch (err) {
            console.error('Failed to start remote server:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Stop the remote server
     */
    stop() {
        if (!this.isRunning) return;

        this.stopStateBroadcast();

        if (this.channel) {
            this.channel.postMessage({ type: 'server-stopped' });
            this.channel.close();
            this.channel = null;
        }

        this.isRunning = false;
        console.log('Remote server stopped');
    }

    /**
     * Handle incoming messages from remotes
     */
    handleMessage(data) {
        if (!data || !data.type) return;

        console.log('Remote command:', data.type);

        switch (data.type) {
            case 'connect':
                this.connectedClients++;
                this.sendState();
                this.app.ui.showToast(`Remote подключён (${this.connectedClients})`, 'success');
                break;

            case 'disconnect':
                this.connectedClients = Math.max(0, this.connectedClients - 1);
                break;

            case 'play':
                this.app.play();
                break;

            case 'stop':
                this.app.stop();
                break;

            case 'pause':
                this.app.togglePause();
                break;

            case 'next':
                this.app.nextTrack();
                break;

            case 'prev':
                this.app.prevTrack();
                break;

            case 'select':
                if (typeof data.index === 'number') {
                    this.app.selectTrack(data.index);
                }
                break;

            case 'volume':
                if (typeof data.value === 'number') {
                    this.app.setVolume(data.value);
                }
                break;

            case 'seek':
                if (typeof data.position === 'number') {
                    this.app.audioEngine.seek(data.position);
                }
                break;

            case 'get-state':
                this.sendState();
                break;
        }
    }

    /**
     * Send current state to all remotes
     */
    sendState() {
        if (!this.channel || !this.isRunning) return;

        const track = this.app.playlist.getCurrent();
        const nextTrack = this.app.playlist.getNext();

        const state = {
            type: 'state',
            isPlaying: this.app.audioEngine.isPlaying,
            isPaused: this.app.audioEngine.isPaused,
            currentTime: this.app.audioEngine.getCurrentTime(),
            duration: track?.duration || 0,
            volume: this.app.volume,
            currentTrack: track ? {
                index: this.app.playlist.currentIndex,
                title: track.title,
                note: track.note || '',
                duration: track.duration
            } : null,
            nextTrack: nextTrack ? {
                title: nextTrack.title,
                duration: nextTrack.duration
            } : null,
            playlist: this.app.playlist.tracks.map((t, i) => ({
                index: i,
                title: t.title,
                duration: t.duration,
                isLoaded: t.isLoaded
            })),
            playlistLength: this.app.playlist.length
        };

        this.channel.postMessage(state);
        this.lastState = state;
    }

    /**
     * Start periodic state broadcasting
     */
    startStateBroadcast() {
        this.stopStateBroadcast();

        // Broadcast state every 100ms when playing
        this.broadcastInterval = setInterval(() => {
            if (this.app.audioEngine.isPlaying) {
                this.sendState();
            }
        }, 100);

        // Also send on significant events
        this.app.playlist.on('change', () => this.sendState());
        this.app.playlist.on('select', () => this.sendState());
    }

    /**
     * Stop state broadcasting
     */
    stopStateBroadcast() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
    }

    /**
     * Get QR code URL for remote
     */
    getQRCodeUrl() {
        // Using a free QR code API
        const encodedUrl = encodeURIComponent(this.remoteUrl);
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
    }

    /**
     * Show remote connection modal
     */
    showConnectionModal() {
        if (!this.isRunning) {
            this.start();
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'remote-modal';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">
                        <span class="modal-title-icon">📱</span>
                        <span>Mobile Remote</span>
                    </div>
                    <button class="modal-close" id="remote-modal-close">✕</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <p style="margin-bottom: 20px; color: var(--text-secondary);">
                        Отсканируйте QR-код или откройте ссылку на мобильном устройстве
                    </p>
                    
                    <div style="background: white; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 20px;">
                        <img src="${this.getQRCodeUrl()}" alt="QR Code" style="display: block; width: 200px; height: 200px;">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <input type="text" 
                               value="${this.remoteUrl}" 
                               readonly 
                               style="width: 100%; padding: 12px; background: var(--bg-primary); border: 1px solid var(--border-default); border-radius: 8px; color: var(--accent-primary); font-family: var(--font-mono); font-size: 0.85rem; text-align: center;"
                               onclick="this.select()">
                    </div>
                    
                    <button id="copy-remote-url" class="modal-btn primary" style="width: 100%;">
                        📋 Копировать ссылку
                    </button>
                    
                    <p style="margin-top: 20px; font-size: 0.85rem; color: var(--text-muted);">
                        Подключено устройств: <strong id="connected-count">${this.connectedClients}</strong>
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handler
        modal.querySelector('#remote-modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Copy handler
        modal.querySelector('#copy-remote-url').addEventListener('click', () => {
            navigator.clipboard.writeText(this.remoteUrl).then(() => {
                this.app.ui.showToast('Ссылка скопирована', 'success');
            });
        });

        // Update connected count
        const countEl = modal.querySelector('#connected-count');
        const updateCount = setInterval(() => {
            if (document.contains(modal)) {
                countEl.textContent = this.connectedClients;
            } else {
                clearInterval(updateCount);
            }
        }, 1000);
    }

    destroy() {
        this.stop();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RemoteServer;
}