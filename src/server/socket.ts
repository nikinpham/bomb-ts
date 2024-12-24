import { io as ClientIO, Socket } from 'socket.io-client';
import dotenv from 'dotenv';
import { EMITS } from '../constants';
import GameState from '../game/gameState';
import { emitTrashTalk } from '../utils';
import ChildGameState from '../game/childGameState';

dotenv.config();

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost';
const gameState = new GameState();
const childGameState = new ChildGameState();

export const socket: Socket = ClientIO(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  socket.emit(EMITS.JOIN_GAME, {
    game_id: process.env.GAME_ID,
    player_id: process.env.PLAYER_ID_JOIN_GAME
  });
});

socket.on(EMITS.JOIN_GAME, res => {
  socket.emit(EMITS.REGISTER_CHARACTER_POWER, {
    gameId: res.game_id,
    type: 2
  });
  emitTrashTalk();
});

socket.on(EMITS.UPDATE, res => {
  gameState.update(res);
  // childGameState.update(res);
});

socket.on(EMITS.DRIVE, res => {
  // console.log(`Res:  { direction: '${res.direction}', player_id: '${res.player_id}' }`);
  gameState.onPlayerStop(res);
});
