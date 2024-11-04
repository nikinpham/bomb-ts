import { TILE_TYPE } from '../constants';
import { Bomb, Map, Maps, Player, Spoil, TempoGameState } from '../types';

class GameState {
  static gameRemainTime: number = 0;
  static mapSize: Map = {
    rows: 0,
    cols: 0
  };
  static dragonEggs: {
    row: number;
    col: number;
    player_id: string;
  }[] = [];
  static players: { [id: string]: Player } = {};
  static bombs: Bomb[] = [];
  static spoils: Spoil[] = [];
  static maps: Maps = [];
  static tag: string = '';

  static target: number[] = [TILE_TYPE.BALK];

  static setGameRemainTime(time: number) {
    if (this.gameRemainTime && this.gameRemainTime === time) return;
    this.gameRemainTime = time;
  }

  static setMapSize(cols: number, rows: number) {
    if (
      this.mapSize &&
      this.mapSize.cols === cols &&
      this.mapSize.rows === rows
    ) {
      return;
    }
    this.mapSize = { cols, rows };
  }

  static updateTag(tag: string) {
    if (this.tag === tag) return;
    this.tag = tag;
    console.log('[TAG]: ', this.tag);
  }

  static updatePlayerStats(player: Player) {
    this.players[player.id] = { ...player };
  }

  static updateSpoils(spoils: Spoil[]) {
    if (
      this.spoils.every(
        (spoil, index) =>
          spoil.row === spoils[index].row &&
          spoil.col === spoils[index].col &&
          spoil.spoil_type === spoils[index].spoil_type
      )
    ) {
      return;
    }

    this.spoils = spoils;
    console.log('[SPOILS]: ', spoils);
  }

  static updateBombs(bombs: Bomb[]) {
    if (
      this.bombs.every(
        (bomb, index) =>
          bomb.row === bombs[index].row &&
          bomb.col === bombs[index].col &&
          bomb.remainTime === bombs[index].remainTime &&
          bomb.playerId === bombs[index].playerId
      )
    ) {
      return;
    }
    this.bombs = bombs;
  }

  static updateMaps(maps: Maps) {
    if (
      this.maps.length > 0 &&
      this.maps.every((row, rowIndex) =>
        row.every((cell, colIndex) => cell === maps[rowIndex][colIndex])
      )
    ) {
      return;
    }
    this.maps = maps;
  }

  static update(tempoGameState: TempoGameState) {
    const { map_info, tag, gameRemainTime } = tempoGameState;
    const { size, players, map, bombs, spoils } = map_info;

    this.setGameRemainTime(gameRemainTime);
    this.setMapSize(size.cols, size.rows);

    this.updateTag(tag);
    players.forEach(player => {
      this.updatePlayerStats(player);
    });

    this.updateMaps(map);
    this.updateBombs(bombs);
    this.updateSpoils(spoils);

    this.play();
  }

  static play() {}
}

export default GameState;
