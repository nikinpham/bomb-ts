import { Bomb, Goal, Map, Maps, Player, Spoil, TempoGameState } from '../types';
import { EMITS, GAME_MODE, TILE_TYPE } from '../constants';
import { Pathfinding } from 'pathfinding-worker';
import { bfsFindWeight, pathToDirection } from './utils';
import { socket } from '../server';

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

  static mode: string = GAME_MODE.SAFE;
  static target: number[] = [TILE_TYPE.BALK, TILE_TYPE.MYSTIC];

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

  static setDragonEggs(dragonEggs: Goal[]) {
    if (
      this.dragonEggs.every(
        (egg, index) =>
          egg.row === dragonEggs[index].row &&
          egg.col === dragonEggs[index].col &&
          egg.player_id === dragonEggs[index].player_id
      )
    ) {
      return;
    }
    this.dragonEggs = dragonEggs;
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
          bomb.remain_time === bombs[index].remain_time &&
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
    const { size, players, map, bombs, spoils, dragonEggGSTArray } = map_info;

    this.setGameRemainTime(gameRemainTime);
    this.setMapSize(size.cols, size.rows);
    this.setDragonEggs(dragonEggGSTArray);

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
    switch (this.mode) {
      case GAME_MODE.ATTACK_GOAL: {
        this.attackGoalMode();
        break;
      }
      case GAME_MODE.KILLER: {
        this.killerMode();
        break;
      }
      default: {
        this.safeMode();
      }
    }
  }

  //  [Q1]: Tìm kiến tồn tại đơn vị để nâng cao điểm trên bản đồ?
  //  [Q1_Y]: Đi thu thập
  //  [Q1_N]:   [Q2] kiểm tra điểm của mình có cao hơn hoặc đối phương không?
  //            [Q2_Y]:   Chuyển sang ATTACK_GOAL_MODE
  //            [Q2_N]:   Chuyển sang KILLER_MODE
  static safeMode() {
    const pathfinding = new Pathfinding();
    const mapLayer = this.maps.map(row =>
      row.map(cell => cell === TILE_TYPE.ROAD)
    );

    const layer = pathfinding.createLayer(mapLayer);
    const from = {
      x: this.players['player1-xxx'].currentPosition.col,
      y: this.players['player1-xxx'].currentPosition.row
    };
    // this.players['player1-xxx'].power
    // console.log(this.players['player1-xxx'].dragonEggAttack);
    const newTarget = bfsFindWeight({
      maps: this.maps,
      startX: from.x,
      startY: from.y,
      tileType: TILE_TYPE.BALK
    });
    let to = newTarget && {
      x: newTarget.x,
      y: newTarget.y
    };

    let direction = '';

    if (!!from && !!to) {
      layer.findPath(
        {
          from,
          to,
          diagonals: false
        },
        ({ path }) => {
          // console.log('from -  to - path', from, to, pathToDirection(path));
          // console.log(pathToDirection(path));
          direction = pathToDirection(path);
        }
      );
    }

    direction.length > 0 &&
      socket.emit(EMITS.DRIVE, {
        direction
      });
  }

  static attackGoalMode() {
    // console.log('[ATTACK_GOAL_MODE]');
    // Đi đến vị trí GOAL
    // Tìm vị trí an toàn nhất
    // Dặt bomb để duy trì điểm
  }

  static killerMode() {
    // console.log('[KILLER_MODE]');
    // Đi đến vị trí của kẻ địch
    // Tính toán các vị trí có thể khóa mục tiêu
    // Đặt bomb và di chuyển đến vị trí an toàn mà vẫn khóa mục tiêu
  }
}

export default GameState;
