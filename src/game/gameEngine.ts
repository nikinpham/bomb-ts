import { TickTackResponse } from '../types';
import GameState from './gameState';
import { socket } from '../server';

class GameEngine {
  static start() {
    console.log('[GAME_START]');
    socket.emit('drive player', { direction: 'x' });
  }
  static update(res: TickTackResponse) {
    const { map_info, tag, gameRemainTime } = res;
    const { size, players, map, bombs, spoils, dragonEggGSTArray } = map_info;

    GameState.setMapSize(size.cols, size.rows);

    GameState.setDragonEggs(dragonEggGSTArray);

    GameState.setGameRemainTime(gameRemainTime);

    players.forEach(player => {
      GameState.updatePlayerStats(player);
    });

    GameState.updateMaps(map);

    GameState.updateBombs(bombs);

    GameState.updateSpoils(spoils);

    GameState.updateTag(tag);
  }
}

export default GameEngine;
