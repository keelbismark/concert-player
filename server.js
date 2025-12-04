
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let mainAppWs = null;
const remoteClients = new Set();

// Serve static files
app.use(express.static(path.join(__dirname, '/')));

// WebSocket server logic
wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Client Identification
      if (data.type === 'identify') {
        if (data.clientType === 'main-app') {
          mainAppWs = ws;
          ws.clientType = 'main-app';
          console.log('Main application identified');
          // If remotes are already waiting, ask the main app for its current state
          if (remoteClients.size > 0) {
            mainAppWs.send(JSON.stringify({ type: 'get-state' }));
          }
        } else if (data.clientType === 'remote') {
          remoteClients.add(ws);
          ws.clientType = 'remote';
          console.log('Remote client identified');
          // If the main app is already here, ask it for the latest state
          if (mainAppWs && mainAppWs.readyState === WebSocket.OPEN) {
            mainAppWs.send(JSON.stringify({ type: 'get-state' }));
          }
        }
        return;
      }

      // If the message is a state update from the main app, broadcast it to all remotes
      if (ws.clientType === 'main-app' && data.type === 'state') {
        remoteClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
      // If the message is a command from a remote, send it to the main app
      else if (ws.clientType === 'remote') {
        if (mainAppWs && mainAppWs.readyState === WebSocket.OPEN) {
          mainAppWs.send(JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Error parsing or handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected (${ws.clientType})`);
    if (ws.clientType === 'main-app') {
      mainAppWs = null;
      console.log('Main application disconnected');
    } else if (ws.clientType === 'remote') {
      remoteClients.delete(ws);
      console.log('Remote client disconnected');
    }
  });
});

// Start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
