
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let mainAppWs = null;

// Serve static files
app.use(express.static(path.join(__dirname, '/')));

// WebSocket server logic
wss.on('connection', (ws) => {
  console.log('Client connected');

  // The first client to connect is the main application
  if (!mainAppWs) {
    mainAppWs = ws;
    console.log('Main application connected');
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // If the message is from the main app, broadcast it to all remotes
      if (ws === mainAppWs) {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      } else {
        // If the message is from a remote, send it to the main app
        if (mainAppWs && mainAppWs.readyState === WebSocket.OPEN) {
          mainAppWs.send(message);
        }
      }
    } catch (error) {
      console.error('Error parsing or handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (ws === mainAppWs) {
      console.log('Main application disconnected');
      mainAppWs = null;
    }
  });
});

// Start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
