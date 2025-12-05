const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Правильное хранение клиентов
let mainAppWs = null;
const remoteClients = new Set();

// Serve static files
app.use(express.static(path.join(__dirname, '/')));

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('📡 New client connected, waiting for identification...');
    
    ws.isAlive = true;
    ws.clientType = null; // Пока не идентифицирован

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // ✅ Обработка идентификации — КРИТИЧЕСКИ ВАЖНО
            if (data.type === 'identify') {
                handleIdentification(ws, data);
                return;
            }

            // ✅ Маршрутизация на основе типа клиента
            routeMessage(ws, message, data);

        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        handleDisconnection(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

/**
 * Handle client identification
 */
function handleIdentification(ws, data) {
    const { clientType } = data;

    if (clientType === 'main-app') {
        // Если уже есть другой main-app — отключаем старый
        if (mainAppWs && mainAppWs !== ws && mainAppWs.readyState === WebSocket.OPEN) {
            console.log('⚠️  Replacing existing main app connection');
            mainAppWs.clientType = null;
        }
        
        mainAppWs = ws;
        ws.clientType = 'main-app';
        console.log('✅ Main application identified and registered');

        // Если есть ожидающие пульты — запросить состояние
        if (remoteClients.size > 0) {
            console.log(`📤 Requesting state for ${remoteClients.size} waiting remote(s)`);
            ws.send(JSON.stringify({ type: 'get-state' }));
        }

    } else if (clientType === 'remote') {
        remoteClients.add(ws);
        ws.clientType = 'remote';
        console.log(`✅ Remote client registered (total: ${remoteClients.size})`);

        // Если плеер уже подключён — запросить состояние
        if (mainAppWs && mainAppWs.readyState === WebSocket.OPEN) {
            console.log('📤 Requesting state for new remote');
            mainAppWs.send(JSON.stringify({ type: 'get-state' }));
        } else {
            // Уведомить пульт что плеер офлайн
            ws.send(JSON.stringify({ 
                type: 'status', 
                status: 'waiting',
                message: 'Ожидание подключения плеера...'
            }));
        }

    } else {
        console.warn('⚠️  Unknown client type:', clientType);
    }
}

/**
 * Route messages between clients
 */
function routeMessage(ws, rawMessage, data) {
    if (ws.clientType === 'main-app') {
        // Сообщение от плеера → всем пультам
        broadcastToRemotes(rawMessage);
        
    } else if (ws.clientType === 'remote') {
        // Команда от пульта → плееру
        sendToMainApp(rawMessage);
        
    } else {
        // Неидентифицированный клиент
        console.warn('⚠️  Message from unidentified client ignored:', data.type);
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Please identify first' 
        }));
    }
}

/**
 * Broadcast message to all remote clients
 */
function broadcastToRemotes(message) {
    let sent = 0;
    remoteClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sent++;
        }
    });
    if (sent > 0) {
        // console.log(`📡 Broadcasted to ${sent} remote(s)`);
    }
}

/**
 * Send message to main app
 */
function sendToMainApp(message) {
    if (mainAppWs && mainAppWs.readyState === WebSocket.OPEN) {
        mainAppWs.send(message);
    } else {
        console.warn('⚠️  Main app not connected, cannot forward command');
    }
}

/**
 * Handle client disconnection
 */
function handleDisconnection(ws) {
    if (ws.clientType === 'main-app') {
        console.log('❌ Main application disconnected');
        mainAppWs = null;
        
        // Уведомить все пульты
        const notification = JSON.stringify({ 
            type: 'status', 
            status: 'player-disconnected',
            message: 'Плеер отключился'
        });
        remoteClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(notification);
            }
        });

    } else if (ws.clientType === 'remote') {
        remoteClients.delete(ws);
        console.log(`❌ Remote disconnected (remaining: ${remoteClients.size})`);

    } else {
        console.log('❌ Unidentified client disconnected');
    }
}

// Ping interval to detect dead connections
const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log('🔌 Terminating inactive connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(pingInterval);
});

// Start server
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║         🎵 Concert Player Server Started 🎵            ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Player:  http://localhost:${port}                        ║
║  Remote:  http://localhost:${port}/remote.html            ║
║                                                        ║
║  On your network:                                      ║
║  Remote:  http://<your-ip>:${port}/remote.html            ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
});