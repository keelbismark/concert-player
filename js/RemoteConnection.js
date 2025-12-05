/**
 * Remote Control Connection using WebSockets
 * Version 5.4 - Fixed seek and stop from remote
 */
class RemoteConnection {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.ws = null;
        this.playerId = localStorage.getItem('concertPlayerId') || this.generatePlayerId();
        this.playerName = localStorage.getItem('concertPlayerName') || this.generatePlayerName();
        
        this.lastStateSent = 0;
        this.throttleInterval = 200;
        this.throttleTimer = null;
        this.broadcastInterval = null;
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        
        localStorage.setItem('concertPlayerId', this.playerId);
        localStorage.setItem('concertPlayerName', this.playerName);
        
        this.remoteUrl = this.buildRemoteUrl();
        
        console.log('RemoteConnection initialized');
        console.log('Player ID:', this.playerId);
        console.log('Remote URL:', this.remoteUrl);
    }

    generatePlayerId() {
        return 'player-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
    }

    generatePlayerName() {
        const names = ['Stage A', 'Stage B', 'Main Hall', 'Studio 1', 'Live Room', 'Concert'];
        return names[Math.floor(Math.random() * names.length)] + ' Player';
    }

    buildRemoteUrl() {
        const baseUrl = `${window.location.protocol}//${window.location.host}`;
        return `${baseUrl}/remote.html?player=${encodeURIComponent(this.playerId)}`;
    }

    start() {
        if (this.isRunning && this.ws?.readyState === WebSocket.OPEN) {
            return { success: true, url: this.remoteUrl };
        }

        try {
            const isSecure = window.location.protocol === 'https:';
            const wsProtocol = isSecure ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}`;
            
            console.log('Page protocol:', window.location.protocol);
            console.log('WebSocket URL:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                
                this.ws.send(JSON.stringify({
                    type: 'identify',
                    clientType: 'main-app',
                    playerId: this.playerId,
                    playerName: this.playerName
                }));
                
                this.isRunning = true;
                this.app.ui?.showToast?.('Remote control подключён', 'success');
                this.startStateBroadcast();
                
                setTimeout(() => this.sendStateImmediate(), 100);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Parse error:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.isRunning = false;
                this.stopStateBroadcast();
                
                if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = setTimeout(() => this.start(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            return { success: true, url: this.remoteUrl };
            
        } catch (err) {
            console.error('Failed to start:', err);
            return { success: false, error: err.message };
        }
    }

    stop() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.stopStateBroadcast();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isRunning = false;
    }

    handleMessage(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'registered':
                if (data.playerId && data.playerId !== this.playerId) {
                    this.playerId = data.playerId;
                    localStorage.setItem('concertPlayerId', this.playerId);
                    this.remoteUrl = this.buildRemoteUrl();
                }
                if (data.playerName) {
                    this.playerName = data.playerName;
                    localStorage.setItem('concertPlayerName', this.playerName);
                }
                console.log(`Registered as: ${this.playerName} (${this.playerId})`);
                break;
                
            case 'pong':
                break;
                
            case 'play':
                this.app.play();
                break;
                
             case 'stop':
                this.app.stopWithPosition();
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
                    this.handleSeek(data.position);
                }
                break;
                
            case 'seek-relative':
                if (typeof data.delta === 'number') {
                    this.handleSeekRelative(data.delta);
                }
                break;
                
            case 'get-state':
                this.sendStateImmediate();
                break;
        }
    }

    /**
     * Handle seek command from remote
     */
    handleSeek(position) {
        const track = this.app.playlist.getCurrent();
        if (!track || !track.duration) return;
        
        const clampedPosition = Math.max(0, Math.min(track.duration - 0.1, position));
        
        if (this.app.audioEngine.isPaused) {
            // На паузе - обновляем позицию паузы
            this.app.audioEngine.pausePosition = clampedPosition;
            
            this.app.ui.updateTime({
                currentTime: clampedPosition,
                duration: track.duration,
                remaining: track.duration - clampedPosition,
                progress: (clampedPosition / track.duration) * 100
            });
        } else if (this.app.audioEngine.isPlaying) {
            // Играет - делаем seek
            this.app.audioEngine.seek(clampedPosition);
        } else {
            // Остановлено - сохраняем позицию для следующего play
            this.app.audioEngine.pausePosition = clampedPosition;
            
            this.app.ui.updateTime({
                currentTime: clampedPosition,
                duration: track.duration,
                remaining: track.duration - clampedPosition,
                progress: (clampedPosition / track.duration) * 100
            });
        }
        
        this.sendStateImmediate();
    }

    /**
     * Handle relative seek command from remote
     */
    handleSeekRelative(delta) {
        const track = this.app.playlist.getCurrent();
        if (!track || !track.duration) return;
        
        let currentPos;
        if (this.app.audioEngine.isPaused) {
            currentPos = this.app.audioEngine.pausePosition || 0;
        } else if (this.app.audioEngine.isPlaying) {
            currentPos = this.app.audioEngine.getCurrentTime();
        } else {
            currentPos = this.app.audioEngine.pausePosition || 0;
        }
        
        const newPosition = Math.max(0, Math.min(track.duration - 0.1, currentPos + delta));
        this.handleSeek(newPosition);
    }

    sendState() {
        const now = Date.now();
        
        if (now - this.lastStateSent >= this.throttleInterval) {
            this.sendStateImmediate();
        } else if (!this.throttleTimer) {
            this.throttleTimer = setTimeout(() => {
                this.throttleTimer = null;
                this.sendStateImmediate();
            }, this.throttleInterval - (now - this.lastStateSent));
        }
    }

    sendStateImmediate() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.lastStateSent = Date.now();

        const track = this.app.playlist.getCurrent();
        const nextTrack = this.app.playlist.getNext();
        
        // Получаем правильную текущую позицию
        const currentTime = this.app.audioEngine.getCurrentTime();

        const state = {
            type: 'state',
            playerId: this.playerId,
            playerName: this.playerName,
            isPlaying: this.app.audioEngine.isPlaying,
            isPaused: this.app.audioEngine.isPaused,
            isStopped: this.app.audioEngine.isStopped, // НОВОЕ
            currentTime: currentTime,
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

        try {
            this.ws.send(JSON.stringify(state));
        } catch (error) {
            console.error('Send error:', error);
        }
    }

    startStateBroadcast() {
        this.stopStateBroadcast();

        this.broadcastInterval = setInterval(() => {
            if (this.app.audioEngine.isPlaying && !this.app.audioEngine.isPaused) {
                this.sendState();
            }
        }, 250);

        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 25000);

        const sendStateHandler = () => this.sendState();
        this.app.playlist.on('change', sendStateHandler);
        this.app.playlist.on('select', sendStateHandler);
        this._sendStateHandler = sendStateHandler;
    }

    stopStateBroadcast() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.throttleTimer) {
            clearTimeout(this.throttleTimer);
            this.throttleTimer = null;
        }
    }

    showConnectionModal() {
        if (!this.isRunning) {
            this.start();
        }
        setTimeout(() => this._createModal(), 200);
    }

    _createModal() {
        const existing = document.getElementById('remote-modal');
        if (existing) existing.remove();

        this.remoteUrl = this.buildRemoteUrl();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'remote-modal';
        modal.innerHTML = `
            <div class="modal qr-modal">
                <div class="modal-header">
                    <div class="modal-title">
                        <span class="modal-title-icon">📱</span>
                        <span>Mobile Remote</span>
                    </div>
                    <button class="modal-close" id="remote-modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <div style="font-size: 1.1rem; color: #00ff88;">🎵 ${this.playerName}</div>
                        <div style="font-size: 0.7rem; color: #666; margin-top: 4px; font-family: monospace;">
                            ID: ${this.playerId.slice(-12)}
                        </div>
                    </div>
                    
                    <div class="qr-container">
                        <canvas id="qr-canvas" style="border-radius: 8px;"></canvas>
                    </div>
                    
                    <p class="qr-instruction">Отсканируйте QR-код камерой телефона</p>
                    
                    <div class="qr-url-container">
                        <input type="text" id="remote-url-input" value="${this.remoteUrl}" 
                               readonly onclick="this.select()" style="font-size: 0.7rem;">
                        <button id="copy-url-btn" class="copy-btn">📋</button>
                    </div>
                    
                    <button id="open-remote-btn" class="qr-open-btn">🔗 Открыть в новой вкладке</button>
                    
                    <div class="qr-status">
                        <span class="status-dot ${this.isRunning ? 'active' : ''}"></span>
                        <span>${this.isRunning ? 'Подключено' : 'Подключение...'}</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this._generateQR();

        document.getElementById('remote-modal-close').onclick = () => {
            modal.remove();
        };
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        document.getElementById('copy-url-btn').onclick = () => {
            navigator.clipboard.writeText(this.remoteUrl);
            document.getElementById('copy-url-btn').textContent = '✓';
            setTimeout(() => document.getElementById('copy-url-btn').textContent = '📋', 2000);
        };
        document.getElementById('open-remote-btn').onclick = () => {
            window.open(this.remoteUrl, '_blank');
        };
    }

    _generateQR() {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas) return;

        try {
            if (typeof qrcode !== 'function') {
                throw new Error('QR library not loaded');
            }

            const qr = qrcode(0, 'M');
            qr.addData(this.remoteUrl);
            qr.make();
            
            const ctx = canvas.getContext('2d');
            const size = 200;
            canvas.width = size;
            canvas.height = size;
            
            const moduleCount = qr.getModuleCount();
            const tileSize = size / moduleCount;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
            
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        const isFinderPattern = 
                            (row < 7 && col < 7) || 
                            (row < 7 && col >= moduleCount - 7) || 
                            (row >= moduleCount - 7 && col < 7);
                        
                        ctx.fillStyle = isFinderPattern ? '#00cc6a' : '#1a1d24';
                        ctx.fillRect(
                            Math.floor(col * tileSize),
                            Math.floor(row * tileSize),
                            Math.ceil(tileSize),
                            Math.ceil(tileSize)
                        );
                    }
                }
            }
        } catch (e) {
            console.error('QR error:', e);
        }
    }

    destroy() {
        this.stop();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RemoteConnection;
}