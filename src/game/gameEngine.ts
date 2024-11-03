import { TempoGameState } from '../types';
import GameState from './gameState';
import { socket } from '../server';
import { EMITS } from '../constants';

class GameEngine {
  static start() {
    console.log('[GAME_START]');
    socket.emit(EMITS.SPEAK, { command: 't4' });
  }
  static update(tempoGameState: TempoGameState) {
    GameState.update(tempoGameState);
  }
}

export default GameEngine;
