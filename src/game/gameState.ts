import { GAME_MODE, PLAYER_ID } from '../constants';
import { Bomb, Map, Maps, Player, Position, Spoil, TempoGameState } from '../types';
import { findGodBadges } from '../utils';
import { collectGodBadge } from './earlyGame';

class GameState {
  // Game status
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
  static tag = '';
  static godBadges: Position[] = [];

  // Custom Variables
  static target: number[] = [];
  static path = '';
  static currentFacedDirection = '';
  static isRunning = false;
  static gameMode: GAME_MODE = GAME_MODE.COLLECT_BADGE;

  static setGameRemainTime(time: number) {
    if (this.gameRemainTime && this.gameRemainTime === time) return;
    this.gameRemainTime = time;
  }

  static setMapSize(cols: number, rows: number) {
    if (this.mapSize && this.mapSize.cols === cols && this.mapSize.rows === rows) {
      return;
    }
    this.mapSize = { cols, rows };
  }

  static setGodBadges(maps: Maps) {
    const godBadges = findGodBadges(maps);

    if (
      this.godBadges?.length === godBadges.length &&
      this.godBadges.every((badge, index) => badge.row === godBadges[index].row && badge.col === godBadges[index].col)
    ) {
      return;
    }
    this.godBadges = godBadges;
  }

  static updateTag(tag: string) {
    if (this.tag === tag) return;
    this.tag = tag;

    console.log('[TAG]: ', this.tag);
  }

  static updatePlayerStats(player: Player) {
    // console.log(player);
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
      this.maps.every((row, rowIndex) => row.every((cell, colIndex) => cell === maps[rowIndex][colIndex]))
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
    this.setGodBadges(map);

    this.updateTag(tag);
    players.forEach(player => {
      this.updatePlayerStats(player);
    });
    this.updateMaps(map);
    this.updateBombs(bombs);
    this.updateSpoils(spoils);

    this.play();
  }

  static play() {
    switch (this.gameMode) {
      case GAME_MODE.COLLECT_BADGE:
        const collected = collectGodBadge(this.maps, this.players[PLAYER_ID].currentPosition, this.godBadges);
        if (collected) {
          this.gameMode = GAME_MODE.COLLECT_SPOIL;
        }
        break;
      default:
        this.collectItems();
    }
  }

  static collectItems() {}
}

export default GameState;
