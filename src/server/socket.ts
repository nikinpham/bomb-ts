import { io as ClientIO, Socket } from 'socket.io-client';
import dotenv from 'dotenv';
import GameEngine from '../game/gameEngine';
import { EMITS, PLAYER_ID } from '../constants';

dotenv.config();

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost';

export const socket: Socket = ClientIO(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  socket.emit(EMITS.JOIN_GAME, {
    game_id: process.env.GAME_ID,
    player_id: PLAYER_ID
  });
});

socket.on(EMITS.JOIN_GAME, () => {
  socket.emit(EMITS.REGISTER_CHARACTER_POWER, {
    game_id: process.env.GAME_ID,
    type: '2'
  });
  GameEngine.start();
});

socket.on(EMITS.UPDATE, res => {
  GameEngine.update(res);
});

socket.on(EMITS.DRIVE, res => {
  console.log(res);
});
