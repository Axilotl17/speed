import { startGame, startAnimation, recieveCards, recieveMove, recieveFlip, recieveSelect, flipNext, lose } from './game/game.js';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

const maxConnections = 1; // doesnt include host

let peerConnections = {}; // key: peerId, value: RTCPeerConnection
let dataChannels = {};    // key: peerId, value: RTCDataChannel

let localPeerId = generateUUID();
let roomCode = '';

const roomCodeInput = document.getElementById('roomCode');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const startBtn = document.getElementById('startBtn')
const setup = document.getElementById('setup');
const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');




let isHost = false;

const signalingSocket = new WebSocket("wss://142.151.132.228:3000");
setStatus("Not in room", "disconnected");

function setStatus(text, state = "pending") {
    const status = document.getElementById('status');
    status.textContent = text;
    status.className = "status " + state; // "disconnected", "pending", or "connected"
}

function handleGameMsg(msg) {
    //console.log("msg:")
    console.log(msg)
    switch (msg.type) {
        case 'start':
            startAnimation()
            break;
        case 'move':
            recieveMove(msg);
            break;
        case 'flip':
            recieveFlip(msg);
            break;
        case 'cards':
            recieveCards(msg);
            break;
        case 'select':
            recieveSelect(msg)
            break;
        case 'flipNext':
            flipNext(true)
            break;
        case 'win': 
            lose()
            break;
    }
}

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
    joinRoomBtn.disabled = true;
    isHost = true;
    roomCode = generateId();
    roomCodeInput.value = roomCode;
    setStatus("Waiting for peer...", "pending");  // host waits
    signalingSocket.send(JSON.stringify({ type: 'create-room', room: roomCode, peerId: localPeerId }));
};

joinRoomBtn.onclick = () => {
    createRoomBtn.disabled = true;
    roomCode = roomCodeInput.value.trim();
    setStatus("Joining room...", "pending");
    signalingSocket.send(JSON.stringify({ type: 'join-room', room: roomCode, peerId: localPeerId }));
};

startBtn.onclick = () => {
    startGame()
}

document.getElementsByClassName("playAgain")[0].onclick = () => {
    // Append a dummy query string to bust cache
    window.location.href = window.location.pathname + "?cachebust=" + new Date().getTime();
}
    document.getElementsByClassName("playAgain")[1].onclick = () => {
    window.location.href = window.location.pathname + "?cachebust=" + new Date().getTime();
}

export function sendMessage(msg) {
    for (const id in dataChannels) {dataChannels[id].send(JSON.stringify(msg));}
};

function createPeerConnection(peerId, isInitiator) {
    if (Object.keys(peerConnections).length >= maxConnections) {
        console.log(`Connection limit (${maxConnections}) reached, ignoring peer ${peerId}`);
        return null; // don’t create a new connection
    }

    const pc = new RTCPeerConnection(configuration);
    console.log(`Creating peer connection to ${peerId} (initiator: ${isInitiator})`);
    setStatus("Connecting to peer...", "pending");  // new state here

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
    dc.onmessage = (event) => handleGameMsg(JSON.parse(event.data))
    console.log(`Data channel with ${peerId} established`);
    setStatus("Connected to peer!", "connected");  // final green status
    if(isHost) {
        startBtn.disabled = false
    }
}

export async function handleOffer(msg) {
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
