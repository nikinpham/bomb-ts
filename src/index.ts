import dotenv from 'dotenv';
import express from 'express';
import { socket } from './server';
import { io as ClientIO, Socket } from 'socket.io-client';
import { EMITS } from './constants';

dotenv.config();
socket;

// Second BOT
const botSocket: Socket = ClientIO(process.env.SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true
});

botSocket.on('connect', () => {
  botSocket.emit('join game', {
    game_id: process.env.GAME_ID,
    player_id: 'player2-xxx'
  });
});

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.SOCKET_URL || 'http://localhost';

app.listen(PORT, () => {
  console.log(`Express server running on ${HOST}:${PORT}`);
});
