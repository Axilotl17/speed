// script.js


console.log("AAA")

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

let peerConnections = {}; // key: peerId, value: RTCPeerConnection
let dataChannels = {};    // key: peerId, value: RTCDataChannel

let localPeerId = generateUUID();
let roomCode = '';

const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const chatLog = document.getElementById('chatLog');

let isHost = false;

const signalingSocket = new WebSocket('ws://localhost:3000');

signalingSocket.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'new-peer':
      if (isHost) {
        const peerId = msg.peerId;
        createPeerConnection(peerId, true);
      }
      break;
    case 'offer':
      await handleOffer(msg);
      break;
    case 'answer':
      await handleAnswer(msg);
      break;
    case 'ice-candidate':
      await handleCandidate(msg);
      break;
  }
};

createRoomBtn.onclick = () => {
  isHost = true;
  roomCode = generateId();
  roomCodeInput.value = roomCode;
  signalingSocket.send(JSON.stringify({ type: 'create-room', room: roomCode, peerId: localPeerId }));
};

joinRoomBtn.onclick = () => {
  roomCode = roomCodeInput.value.trim();
  signalingSocket.send(JSON.stringify({ type: 'join-room', room: roomCode, peerId: localPeerId }));
};

sendMessageBtn.onclick = () => {
  const msg = messageInput.value;
  appendToChat(`You: ${msg}`);
  for (const id in dataChannels) {
    dataChannels[id].send(msg);
  }
  messageInput.value = '';
};

function appendToChat(text) {
  chatLog.value += text + '\n';
}

function createPeerConnection(peerId, isInitiator) {
  const pc = new RTCPeerConnection(configuration);
    console.log(`Creating peer connection to ${peerId} (initiator: ${isInitiator})`);
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      signalingSocket.send(JSON.stringify({
        type: 'ice-candidate',
        target: peerId,
        candidate: event.candidate,
        peerId: localPeerId
      }));
    }
  };

  if (isInitiator) {
    const dc = pc.createDataChannel('chat');
    setupDataChannel(dc, peerId);
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        signalingSocket.send(JSON.stringify({
          type: 'offer',
          offer: pc.localDescription,
          target: peerId,
          peerId: localPeerId
        }));
      });
  } else {
    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel, peerId);
    };
  }

  peerConnections[peerId] = pc;
  return pc;
}

function setupDataChannel(dc, peerId) {
  dataChannels[peerId] = dc;
  dc.onmessage = (event) => {
    appendToChat(`${peerId}: ${event.data}`);
  };
  console.log(`Data channel with ${peerId} established`);
}

async function handleOffer(msg) {
  const pc = createPeerConnection(msg.peerId, false);
  await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  signalingSocket.send(JSON.stringify({
    type: 'answer',
    answer: answer,
    target: msg.peerId,
    peerId: localPeerId
  }));
}

async function handleAnswer(msg) {
  const pc = peerConnections[msg.peerId];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
  }
}

async function handleCandidate(msg) {
  const pc = peerConnections[msg.peerId];
  if (pc) {
    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
  }
}

function generateId(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateUUID() { // RFC4122 version 4 compliant
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
