const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Multi-room: Хранение нескольких плееров
const players = new Map();
const remotes = new Map();

// Отключаем кэш для HTML
app.use((req, res, next) => {
    if (req.url.endsWith('.html')) {
        res.set('Cache-Control', 'no-store');
    }
    next();
});

app.use(express.static(path.join(__dirname, '/')));

wss.on('connection', (ws) => {
    console.log('📡 New client connected');
    
    ws.isAlive = true;
    ws.clientType = null;
    ws.playerId = null;

    ws.on('message', (message) => {
        try {
            const messageStr = message.toString();
            const data = JSON.parse(messageStr);
            
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                return;
            }
            
            if (data.type === 'identify') {
                handleIdentification(ws, data);
                return;
            }
            
            if (data.type === 'get-players') {
                sendPlayerList(ws);
                return;
            }
            
            if (data.type === 'select-player') {
                handlePlayerSelection(ws, data);
                return;
            }

            routeMessage(ws, messageStr, data);

        } catch (error) {
            console.error('Parse error:', error.message);
        }
    });

    ws.on('close', () => handleDisconnection(ws));
    ws.on('pong', () => { ws.isAlive = true; });
});

function handleIdentification(ws, data) {
    if (data.clientType === 'main-app') {
        const playerId = data.playerId || `player-${Date.now()}`;
        const playerName = data.playerName || `Player ${players.size + 1}`;
        
        ws.clientType = 'main-app';
        ws.playerId = playerId;
        
        players.set(playerId, {
            ws,
            name: playerName,
            state: null,
            connectedAt: Date.now()
        });
        
        console.log(`✅ Player registered: ${playerName} (${playerId})`);
        
        ws.send(JSON.stringify({ 
            type: 'registered', 
            playerId,
            playerName 
        }));
        
        broadcastPlayerList();
        
        const connectedRemotes = getRemotesForPlayer(playerId);
        if (connectedRemotes.length > 0) {
            ws.send(JSON.stringify({ type: 'get-state' }));
        }

    } else if (data.clientType === 'remote') {
        ws.clientType = 'remote';
        
        remotes.set(ws, {
            playerId: null,
            connectedAt: Date.now()
        });
        
        console.log(`✅ Remote connected (total: ${remotes.size})`);
        sendPlayerList(ws);
    }
}

function handlePlayerSelection(ws, data) {
    const { playerId } = data;
    const remote = remotes.get(ws);
    
    if (!remote) return;
    
    const player = players.get(playerId);
    
    if (!player) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Player not found' 
        }));
        return;
    }
    
    remote.playerId = playerId;
    console.log(`📱 Remote connected to player: ${player.name}`);
    
    ws.send(JSON.stringify({ 
        type: 'player-selected',
        playerId,
        playerName: player.name
    }));
    
    if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({ type: 'get-state' }));
    }
}

function sendPlayerList(ws) {
    const playerList = Array.from(players.entries()).map(([id, player]) => ({
        id,
        name: player.name,
        hasState: player.state !== null
    }));
    
    ws.send(JSON.stringify({
        type: 'player-list',
        players: playerList
    }));
}

function broadcastPlayerList() {
    const playerList = Array.from(players.entries()).map(([id, player]) => ({
        id,
        name: player.name,
        hasState: player.state !== null
    }));
    
    const message = JSON.stringify({
        type: 'player-list',
        players: playerList
    });
    
    remotes.forEach((remote, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

function getRemotesForPlayer(playerId) {
    const result = [];
    remotes.forEach((remote, ws) => {
        if (remote.playerId === playerId && ws.readyState === WebSocket.OPEN) {
            result.push(ws);
        }
    });
    return result;
}

function routeMessage(ws, messageStr, data) {
    if (ws.clientType === 'main-app') {
        if (data.type === 'state') {
            const player = players.get(ws.playerId);
            if (player) {
                player.state = data;
            }
        }
        
        const targetRemotes = getRemotesForPlayer(ws.playerId);
        targetRemotes.forEach(remoteWs => {
            remoteWs.send(messageStr);
        });
        
    } else if (ws.clientType === 'remote') {
        const remote = remotes.get(ws);
        if (!remote || !remote.playerId) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'No player selected' 
            }));
            return;
        }
        
        console.log(`📱 Remote command: ${data.type}`);
        
        const player = players.get(remote.playerId);
        if (player && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(messageStr);
        }
    }
}

function handleDisconnection(ws) {
    if (ws.clientType === 'main-app') {
        const player = players.get(ws.playerId);
        console.log(`❌ Player disconnected: ${player?.name || ws.playerId}`);
        
        players.delete(ws.playerId);
        
        remotes.forEach((remote, remoteWs) => {
            if (remote.playerId === ws.playerId && remoteWs.readyState === WebSocket.OPEN) {
                remoteWs.send(JSON.stringify({ 
                    type: 'player-disconnected',
                    message: 'Плеер отключился'
                }));
                remote.playerId = null;
            }
        });
        
        broadcastPlayerList();

    } else if (ws.clientType === 'remote') {
        remotes.delete(ws);
        console.log(`❌ Remote disconnected (remaining: ${remotes.size})`);
    }
}

setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) {
            console.log('🔌 Terminating dead connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🎵 Concert Player Server v4.0            ║
║      Multi-room Edition                    ║
╠════════════════════════════════════════════╣
║  Player: http://localhost:${port}              ║
║  Remote: http://localhost:${port}/remote.html  ║
╚════════════════════════════════════════════╝
    `);
});