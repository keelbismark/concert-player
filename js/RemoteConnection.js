/**
 * Remote Control Connection using WebSockets
 * Version 5.0 - Fixed Multi-room + QR with session ID
 */
class RemoteConnection {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.ws = null;
        this.remoteUrl = '';
        this.playerId = localStorage.getItem('concertPlayerId') || this.generatePlayerId();
        this.playerName = localStorage.getItem('concertPlayerName') || this.generatePlayerName();
        
        this.lastStateSent = 0;
        this.throttleInterval = 200;
        this.throttleTimer = null;
        this.broadcastInterval = null;
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        
        // Сохраняем ID сразу
        localStorage.setItem('concertPlayerId', this.playerId);
        localStorage.setItem('concertPlayerName', this.playerName);
        
        // Формируем URL с playerId
        this.updateRemoteUrl();
    }

    generatePlayerId() {
        return 'player-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
    }

    generatePlayerName() {
        const names = ['Stage A', 'Stage B', 'Main Hall', 'Studio 1', 'Live Room', 'Concert'];
        return names[Math.floor(Math.random() * names.length)] + ' Player';
    }

    updateRemoteUrl() {
        // КРИТИЧНО: URL должен содержать playerId для привязки к конкретному плееру
        const baseUrl = `${window.location.protocol}//${window.location.host}`;
        this.remoteUrl = `${baseUrl}/remote.html?player=${encodeURIComponent(this.playerId)}`;
        console.log('Remote URL updated:', this.remoteUrl);
    }

    start() {
        if (this.isRunning && this.ws?.readyState === WebSocket.OPEN) {
            return { success: true, url: this.remoteUrl };
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('Connecting to:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                
                this.ws.send(JSON.stringify({
                    type: 'identify',
                    clientType: 'main-app',
                    playerId: this.playerId,
                    playerName: this.playerName
                }));
                
                this.isRunning = true;
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
                console.log('WebSocket closed:', event.code);
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
                this.playerId = data.playerId;
                this.playerName = data.playerName;
                localStorage.setItem('concertPlayerId', this.playerId);
                localStorage.setItem('concertPlayerName', this.playerName);
                this.updateRemoteUrl();
                console.log(`Registered as: ${data.playerName} (${data.playerId})`);
                this.app.ui?.showToast?.(`Remote: ${data.playerName}`, 'success');
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
            playerId: this.playerId,
            playerName: this.playerName,
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

        // Небольшая задержка для обновления URL после регистрации
        setTimeout(() => this._createModal(), 300);
    }

    _createModal() {
        const existing = document.getElementById('remote-modal');
        if (existing) existing.remove();

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
                    <div class="player-info" style="text-align: center; margin-bottom: 16px;">
                        <div style="font-size: 1.1rem; color: #00ff88;">🎵 ${this.playerName}</div>
                        <div style="font-size: 0.7rem; color: #666; margin-top: 4px; font-family: monospace;">
                            ID: ${this.playerId.slice(-12)}
                        </div>
                    </div>
                    
                    <div class="qr-container">
                        <div class="qr-glow"></div>
                        <canvas id="qr-canvas" style="border-radius: 8px;"></canvas>
                    </div>
                    
                    <p class="qr-instruction">
                        Отсканируйте QR-код камерой телефона
                    </p>
                    
                    <div class="qr-url-container">
                        <input type="text" 
                               id="remote-url-input"
                               value="${this.remoteUrl}" 
                               readonly 
                               onclick="this.select()"
                               style="font-size: 0.75rem;">
                        <button id="copy-url-btn" class="copy-btn" title="Копировать">📋</button>
                    </div>
                    
                    <button id="open-remote-btn" class="qr-open-btn">
                        🔗 Открыть в новой вкладке
                    </button>
                    
                    <div class="qr-status">
                        <span class="status-dot ${this.isRunning ? 'active' : ''}"></span>
                        <span>${this.isRunning ? 'Сервер активен' : 'Подключение...'}</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this._generateQR();

        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        };

        document.getElementById('remote-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.getElementById('copy-url-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(this.remoteUrl).then(() => {
                const btn = document.getElementById('copy-url-btn');
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = '📋'; }, 2000);
                this.app.ui?.showToast?.('Ссылка скопирована', 'success');
            });
        });

        document.getElementById('open-remote-btn').addEventListener('click', () => {
            window.open(this.remoteUrl, '_blank');
        });
    }

    _generateQR() {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas) return;

        console.log('Generating QR for:', this.remoteUrl);

        try {
            // Используем библиотеку qrcode-generator
            if (typeof qrcode === 'function') {
                const qr = qrcode(0, 'M');
                qr.addData(this.remoteUrl);
                qr.make();
                
                const ctx = canvas.getContext('2d');
                const size = 200;
                canvas.width = size;
                canvas.height = size;
                
                const moduleCount = qr.getModuleCount();
                const tileSize = size / moduleCount;
                
                // Белый фон
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                
                // Модули QR
                for (let row = 0; row < moduleCount; row++) {
                    for (let col = 0; col < moduleCount; col++) {
                        if (qr.isDark(row, col)) {
                            // Определяем цвет (акцент для finder patterns)
                            const isFinderPattern = 
                                (row < 7 && col < 7) || 
                                (row < 7 && col >= moduleCount - 7) || 
                                (row >= moduleCount - 7 && col < 7);
                            
                            ctx.fillStyle = isFinderPattern ? '#00ff88' : '#1a1d24';
                            
                            ctx.fillRect(
                                Math.floor(col * tileSize),
                                Math.floor(row * tileSize),
                                Math.ceil(tileSize),
                                Math.ceil(tileSize)
                            );
                        }
                    }
                }
                
                // Логотип по центру
                const logoSize = size * 0.15;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(size/2 - logoSize, size/2 - logoSize/2, logoSize * 2, logoSize);
                ctx.font = `${logoSize * 0.8}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🎵', size/2, size/2);
                
                console.log('QR generated successfully');
            } else {
                throw new Error('qrcode library not loaded');
            }
        } catch (e) {
            console.error('QR generation failed:', e);
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            ctx.fillStyle = '#1a1d24';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#ff4444';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('QR Error', 100, 95);
            ctx.fillStyle = '#888';
            ctx.font = '10px Arial';
            ctx.fillText(e.message, 100, 115);
        }
    }

    destroy() {
        this.stop();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RemoteConnection;
}