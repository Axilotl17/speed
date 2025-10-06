const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000, host: '0.0.0.0' });

const rooms = new Map(); // roomCode -> Set of clients

wss.on('connection', (ws) => {
  ws.peerId = null;
  ws.room = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      return;
    }

    const { type, room, peerId, target } = msg;

    if (type === 'create-room') {
      ws.peerId = peerId;
      ws.room = room;
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);
      console.log(`[ROOM CREATED] Room ${room} created by peer ${peerId}`);
    }

    if (type === 'join-room') {
      ws.peerId = peerId;
      ws.room = room;
      const peers = rooms.get(room);
      if (!peers) return;

      peers.forEach(peer => {
        if (peer !== ws) {
          peer.send(JSON.stringify({ type: 'new-peer', peerId }));
        }
      });

      peers.add(ws);
      console.log(`[ROOM JOIN] Peer ${peerId} joined room ${room}`);
    }

    if (type === 'offer' || type === 'answer' || type === 'ice-candidate') {
      const peers = rooms.get(ws.room);
      if (!peers) return;

      for (const peer of peers) {
        if (peer.peerId === target) {
          peer.send(JSON.stringify({ ...msg }));
          break;
        }
      }
    }

    // Clean up dead connections
    if (type === 'leave') {
      const peers = rooms.get(ws.room);
      if (peers) peers.delete(ws);
    }
  });

  ws.on('close', () => {
    const peers = rooms.get(ws.room);
    if (peers) peers.delete(ws);
  });
});

console.log('Signaling server running on ws://142.151.132.228:3000');