import { COLLECT_SPOIL_LIMIT, EARLY_GAME_TILE_LIMIT, GAME_MODE, SAFE_PATH_LIMIT, TILE_TYPE } from '../constants';
import { Bomb, Map, Maps, Player, Position, Spoil, TAGS, TempoGameState } from '../types';
import {
  bombSetup,
  convertRawPath,
  drive,
  findGodBadges,
  getPathToNearestItems,
  getPathToNearestSafeTile,
  getPositionsWithValue,
  onSwitchWeapon,
  onWedding,
  turnPlayerFace,
  updateMapsWithDangerZone
} from '../utils';

export default class GameState {
  private gameRemainTime: number;
  private mapSize: Map;
  private readonly players: { [id: string]: Player };
  private bombs: Bomb[];
  private spoils: Spoil[];
  private balks: Position[];
  private brickWalls: Position[];
  private maps: Maps;
  private tag: string | null;
  private godBadges: Position[];
  private playerId: string;

  private gameMode: GAME_MODE;
  private isMoving: boolean;

  constructor() {
    this.gameRemainTime = 0;
    this.mapSize = {
      rows: 0,
      cols: 0
    };
    this.players = {};
    this.bombs = [];
    this.spoils = [];
    this.maps = [];
    this.tag = null;
    this.godBadges = [];
    this.isMoving = false;
    this.gameMode = GAME_MODE.COLLECT_BADGE;
    this.balks = [];
    this.brickWalls = [];
    this.playerId = process.env.MY_ID || '';
  }

  setGameRemainTime(time: number) {
    if (this.gameRemainTime && this.gameRemainTime === time) return;
    this.gameRemainTime = time;
  }

  setMapSize(cols: number, rows: number) {
    if (this.mapSize && this.mapSize.cols === cols && this.mapSize.rows === rows) {
      return;
    }
    this.mapSize = { cols, rows };
  }

  setGodBadges(maps: Maps) {
    const godBadges = findGodBadges(maps);
    if (
      this.godBadges?.length === godBadges.length &&
      this.godBadges.every((badge, index) => badge.row === godBadges[index].row && badge.col === godBadges[index].col)
    ) {
      return;
    }
    this.godBadges = godBadges;
  }

  updateTag(tag: string) {
    if (tag === TAGS.PLAYER_TRANSFORMED) this.gameMode = GAME_MODE.COLLECT_SPOIL;
    if (this.tag === tag) return;
    this.tag = tag;
    // console.log('TAG:', this.tag);
  }

  updatePlayerStats(player: Player) {
    this.players[player.id] = { ...player };
    if (this.players[this.playerId] && this.players[this.playerId].hasTransform)
      this.gameMode = GAME_MODE.COLLECT_SPOIL;
  }

  updateSpoils(spoils: Spoil[]) {
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
  }

  updateBombs(bombs: Bomb[]) {
    this.bombs = bombs;
  }

  updateMaps(maps: Maps) {
    if (
      this.maps.length > 0 &&
      this.maps.every((row, rowIndex) => row.every((cell, colIndex) => cell === maps[rowIndex][colIndex]))
    ) {
      return;
    }
    this.maps = maps;
  }

  updateBalks(maps: Maps) {
    this.balks = getPositionsWithValue(maps, TILE_TYPE.BALK);
  }
  updateBrickWalls(maps: Maps) {
    this.brickWalls = getPositionsWithValue(maps, TILE_TYPE.BRICK_WALL);
  }

  update(tempoGameState: TempoGameState) {
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
    this.updateBalks(map);
    this.updateBrickWalls(map);

    this.play();
  }

  play() {
    switch (this.gameMode) {
      case GAME_MODE.COLLECT_BADGE:
        const collected = this.collectTarget(this.maps, this.godBadges, TILE_TYPE.BRICK_WALL, EARLY_GAME_TILE_LIMIT);
        if (collected) {
          this.gameMode = GAME_MODE.COLLECT_SPOIL;
        }
        break;
      case GAME_MODE.COLLECT_SPOIL:
        const targets: Position[] = this.balks.length > 0 ? this.balks : this.brickWalls;
        const targetType = this.balks.length > 0 ? TILE_TYPE.BALK : TILE_TYPE.BRICK_WALL;
        const currentWeapon = this.players[this.playerId] && this.players[this.playerId].currentWeapon;
        if (
          (targetType === TILE_TYPE.BALK && currentWeapon === 1) ||
          (targetType === TILE_TYPE.BRICK_WALL && currentWeapon === 2)
        ) {
          onSwitchWeapon();
        }

        const condition = false;
        // const condition = this.players[this.playerId].eternalBadge > 0;
        const readyForWedding = this.collectTarget(this.maps, targets, targetType, COLLECT_SPOIL_LIMIT, condition);
        if (readyForWedding) {
          onWedding();
          this.gameMode = GAME_MODE.KILLER;
        }
        break;
      default:
        this.killerMode();
    }
  }

  killerMode() {}

  collectTarget(map: Maps, targets: Position[], targetType: number, limitation: number[], condition?: boolean) {
    if (condition || targets.length === 0) return true;
    if (this.isMoving) return false;

    const { updatedMap } = updateMapsWithDangerZone(this.maps, this.bombs);
    const rawSafePath = getPathToNearestSafeTile(
      updatedMap,
      SAFE_PATH_LIMIT,
      this.players[this.playerId].currentPosition
    );

    // Avoid Bomb
    if (rawSafePath && rawSafePath.length > 1 && this.players[this.playerId].hasTransform) {
      this.isMoving = true;
      const avoidBombDirections = convertRawPath(rawSafePath);
      drive(avoidBombDirections);
      setTimeout(() => {
        this.isMoving = false;
      }, this.players[this.playerId].speed);
      return false;
    } else {
      const rawPathToTarget = getPathToNearestItems(
        map,
        limitation,
        this.players[this.playerId].currentPosition,
        targets
      );
      if (!rawPathToTarget) return false;
      const directions = convertRawPath(rawPathToTarget, targetType);
      if (!directions) {
        const faceDirection = turnPlayerFace(this.players[this.playerId].currentPosition, rawPathToTarget[1]);
        if (faceDirection) {
          this.isMoving = true;
          drive(faceDirection);
          setTimeout(() => {
            drive(bombSetup());
            setTimeout(() => {
              this.isMoving = false;
            }, 1000);
          }, this.players[this.playerId].speed);
        }
        if (targetType !== TILE_TYPE.BRICK_WALL) {
          drive(bombSetup());
          setTimeout(() => {
            this.isMoving = false;
          }, this.players[this.playerId].delay);
        }
        return false;
      }

      this.isMoving = true;
      drive(directions);
      setTimeout(() => {
        this.isMoving = false;
      }, directions.length * this.players[this.playerId].speed);
      return false;
    }
  }
}
