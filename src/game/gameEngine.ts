import { TempoGameState } from '../types';
import GameState from './gameState';
import { socket } from '../server';
import { EMITS } from '../constants';

class GameEngine {
  static start() {
    socket.emit(EMITS.SPEAK, { command: 't4' });
  }
  static update(gameState: TempoGameState) {
    GameState.update(gameState);
  }
}

export default GameEngine;
