/**
 * CAVERN PVP - SIGNALING SERVER (TCP)
 * 
 * To run:
 * 1. npm install ws
 * 2. node server.js
 * 
 * This server uses TCP (WebSockets) to facilitate the initial handshake (Signaling).
 * Once clients connect, they establish a DIRECT UDP (WebRTC) connection for the game.
 */

const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[SIGNALING] Server running on port ${PORT}`);
console.log(`[SIGNALING] Ready to bootstrap UDP connections.`);

wss.on('connection', function connection(ws, req) {
  const ip = req.socket.remoteAddress;
  console.log(`[CONN] New client connected from ${ip}`);

  ws.on('message', function incoming(message) {
    // Broadcast to all other clients to find peers
    // In a production app, we would target specific IDs, but for 2-player LAN, broadcast is fine.
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log(`[DISC] Client disconnected`);
  });
});