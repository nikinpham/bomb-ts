import { EARLY_GAME_TILE_LIMIT, GAME_MODE, PLAYER_ID } from '../constants';
import { Bomb, Map, Maps, Player, Position, Spoil, TAGS, TempoGameState } from '../types';
import {
  bombSetup,
  convertRawPath,
  drive,
  findGodBadges,
  getPathToNearestItems,
  isHaveWedding,
  turnPlayerFace
} from '../utils';

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
  static prevPlayerPosition: Position | undefined = undefined;

  static bombs: Bomb[] = [];
  static spoils: Spoil[] = [];
  static maps: Maps = [];
  static tag = '';
  static godBadges: Position[] = [];

  static target: number[] = [];
  static path: string | null = '';
  static isRunning = false;
  static gameMode: GAME_MODE = GAME_MODE.COLLECT_BADGE;
  static faceSide: string | null = null;

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
    if (tag === TAGS.PLAYER_TRANSFORMED) this.gameMode = GAME_MODE.COLLECT_SPOIL;
    if (this.tag === tag) return;
    this.tag = tag;

    // console.log('[TAG]: ', this.tag);
  }

  static updatePlayerStats(player: Player) {
    this.players[player.id] = { ...player };
    if (this.players[PLAYER_ID].hasTransform) this.gameMode = GAME_MODE.COLLECT_SPOIL;
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
    // console.log('[SPOILS]: ', spoils);
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
        const collected = this.collectGodBadge();
        if (collected) {
          this.gameMode = GAME_MODE.COLLECT_SPOIL;
        }
        break;
      case GAME_MODE.COLLECT_SPOIL:
        const readyForWedding = this.collectSpoils();
        if (readyForWedding) {
          this.gameMode = GAME_MODE.KILLER;
        }
        break;
      default:
        this.killerMode();
    }
  }

  static collectGodBadge() {
    if (this.godBadges.length === 0) {
      return true;
    }
    const rawPathToGodBadge = getPathToNearestItems(
      this.maps,
      EARLY_GAME_TILE_LIMIT,
      this.players[PLAYER_ID].currentPosition,
      this.godBadges
    );

    if (!rawPathToGodBadge) {
      return false;
    }

    const directions = convertRawPath(rawPathToGodBadge);
    const faceDirection = turnPlayerFace(this.players[PLAYER_ID].currentPosition, rawPathToGodBadge[1]);

    if (!directions) {
      if (this.faceSide !== faceDirection) {
        this.faceSide = faceDirection;
        drive(this.faceSide);
        return false;
      } else {
        drive(bombSetup());
        this.faceSide = null;
        return false;
      }
    } else {
      this.faceSide = null;
      drive(directions);
      return false;
    }
  }

  static collectSpoils() {
    const readyForWedding = isHaveWedding(this.players[PLAYER_ID]);
    if (readyForWedding) {
      return true;
    }

    // else
    //    scan các các đối tượng
    //    pick target (
    //    đập box
    //    tìm vị trí an
    //    đợi bomb nổ
  }

  static killerMode() {}
}

export default GameState;
