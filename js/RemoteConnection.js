/**
 * Remote Control Connection using WebSockets
 * Version 4.0 - Multi-room + Throttle + QR
 */
class RemoteConnection {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.ws = null;
        this.remoteUrl = '';
        this.playerId = localStorage.getItem('concertPlayerId');
        this.playerName = 'Concert Player';
        
        this.lastStateSent = 0;
        this.throttleInterval = 200;
        this.throttleTimer = null;
        this.broadcastInterval = null;
        this.heartbeatInterval = null;
    }

    start() {
        if (this.isRunning) return { success: true, url: this.remoteUrl };

        try {
            const wsUrl = `ws://${window.location.host}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                
                this.ws.send(JSON.stringify({
                    type: 'identify',
                    clientType: 'main-app',
                    playerId: this.playerId || `player-${Date.now()}`,
                    playerName: this.playerName
                }));
                
                this.isRunning = true;
                this.app.ui.showToast('Remote control подключён', 'success');
                
                setTimeout(() => this.sendState(), 100);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Parse error:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.isRunning = false;
                this.stopStateBroadcast();
                setTimeout(() => this.start(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.remoteUrl = `${window.location.origin}/remote.html`;
            this.startStateBroadcast();
            
            return { success: true, url: this.remoteUrl };
        } catch (err) {
            console.error('Failed to start:', err);
            return { success: false, error: err.message };
        }
    }

    stop() {
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
                this.playerId = data.playerId;
                this.playerName = data.playerName;
                localStorage.setItem('concertPlayerId', this.playerId);
                console.log(`Registered as: ${data.playerName}`);
                break;
            case 'pong':
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
            case 'seek-relative':
                if (typeof data.delta === 'number') {
                    const current = this.app.audioEngine.getCurrentTime();
                    const duration = this.app.playlist.getCurrent()?.duration || 0;
                    const newPos = Math.max(0, Math.min(duration, current + data.delta));
                    this.app.audioEngine.seek(newPos);
                }
                break;
            case 'get-state':
                this.sendStateImmediate();
                break;
        }
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
                    <div class="qr-container">
                        <div class="qr-glow"></div>
                        <canvas id="qr-canvas"></canvas>
                    </div>
                    
                    <p class="qr-instruction">
                        Отсканируйте камерой телефона
                    </p>
                    
                    <div class="qr-url-container">
                        <input type="text" 
                               id="remote-url-input"
                               value="${this.remoteUrl}" 
                               readonly 
                               onclick="this.select()">
                        <button id="copy-url-btn" class="copy-btn" title="Копировать">
                            📋
                        </button>
                    </div>
                    
                    <button id="open-remote-btn" class="qr-open-btn">
                        🔗 Открыть в браузере
                    </button>
                    
                    <div class="qr-status">
                        <span class="status-dot"></span>
                        <span>${this.playerName || 'Concert Player'}</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const canvas = document.getElementById('qr-canvas');
        const qrGenerator = new QRCodeGenerator();
        
        qrGenerator.generate(canvas, this.remoteUrl, {
            size: 200,
            colorDark: '#1a1d24',
            colorLight: '#ffffff',
            colorAccent: '#00ff88',
            logoText: '🎵',
            style: 'rounded'
        });

        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        };

        modal.querySelector('#remote-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        modal.querySelector('#copy-url-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(this.remoteUrl).then(() => {
                const btn = modal.querySelector('#copy-url-btn');
                btn.textContent = '✓';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = '📋';
                    btn.classList.remove('copied');
                }, 2000);
                this.app.ui.showToast('Ссылка скопирована', 'success');
            });
        });

        modal.querySelector('#open-remote-btn').addEventListener('click', () => {
            window.open(this.remoteUrl, '_blank');
        });
    }

    destroy() {
        this.stop();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RemoteConnection;
}