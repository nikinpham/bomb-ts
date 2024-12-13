import { COLLECT_SPOIL_LIMIT, EARLY_GAME_TILE_LIMIT, GAME_MODE, SAFE_PATH_LIMIT, TAGS, TILE_TYPE } from '../constants';
import { Bomb, Map, Maps, Player, Position, Spoil, TempoGameState } from '../types';
import {
  bombSetup,
  convertRawPath,
  drive,
  driveChild,
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
  private readonly playerId: string;
  private readonly playerChildId: string;
  private readonly players: { [id: string]: Player };

  private gameRemainTime: number;
  private mapSize: Map;
  private bombs: Bomb[];
  private spoils: Spoil[];
  private balks: Position[];
  private brickWalls: Position[];
  private maps: Maps;
  private tag: string | null;
  private godBadges: Position[];

  private gameMode: GAME_MODE;
  private isMoving: boolean;
  private isChildMoving: boolean;

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
    this.isChildMoving = false;
    this.gameMode = GAME_MODE.COLLECT_BADGE;
    this.balks = [];
    this.brickWalls = [];
    this.playerId = process.env.MY_ID || '';
    this.playerChildId = this.playerId + '_child';
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

  updatePlayerStats(player: Player) {
    this.players[player.id] = { ...player };
    if (
      this.players[this.playerId] &&
      this.players[this.playerId].hasTransform &&
      !Object.keys(this.players).includes(this.playerChildId)
    )
      this.gameMode = GAME_MODE.COLLECT_SPOIL;
    if (
      this.players[this.playerId] &&
      this.players[this.playerId].eternalBadge > 0 &&
      !Object.keys(this.players).includes(this.playerChildId)
    ) {
      this.gameMode = GAME_MODE.KILLER;
      // onWedding();
    }
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
    this.balks = getPositionsWithValue(maps, TILE_TYPE.BALK);
    this.brickWalls = getPositionsWithValue(maps, TILE_TYPE.BRICK_WALL);
    if (
      this.maps.length > 0 &&
      this.maps.every((row, rowIndex) => row.every((cell, colIndex) => cell === maps[rowIndex][colIndex]))
    ) {
      return;
    }
    this.maps = maps;
  }

  update(tempoGameState: TempoGameState) {
    const { map_info, tag, gameRemainTime } = tempoGameState;
    const { size, players, map, bombs, spoils } = map_info;

    this.gameRemainTime = gameRemainTime;
    this.tag = tag;

    this.setMapSize(size.cols, size.rows);
    this.setGodBadges(map);
    players.forEach(player => {
      this.updatePlayerStats(player);
    });
    this.updateMaps(map);
    this.updateBombs(bombs);
    this.updateSpoils(spoils);

    this.play();
  }

  play() {
    const targets: Position[] = this.balks.length > 0 ? this.balks : this.brickWalls;
    const targetType = this.balks.length > 0 ? TILE_TYPE.BALK : TILE_TYPE.BRICK_WALL;
    const currentWeapon = this.players[this.playerId] && this.players[this.playerId].currentWeapon;
    switch (this.gameMode) {
      case GAME_MODE.COLLECT_BADGE: {
        this.collectTarget(this.maps, this.godBadges, TILE_TYPE.BRICK_WALL, EARLY_GAME_TILE_LIMIT);
        return;
      }
      case GAME_MODE.COLLECT_SPOIL: {
        if (
          (targetType === TILE_TYPE.BALK && currentWeapon === 1) ||
          (targetType === TILE_TYPE.BRICK_WALL && currentWeapon === 2)
        ) {
          onSwitchWeapon();
        }
        const collectSpoilCondition = this.players[this.playerId].eternalBadge > 0;
        this.collectTarget(this.maps, targets, targetType, COLLECT_SPOIL_LIMIT, collectSpoilCondition);
        return;
      }
      default: {
        if (targetType === TILE_TYPE.BRICK_WALL && currentWeapon === 2) {
          onSwitchWeapon();
        }
        // const { updatedMap } = updateMapsWithDangerZone(this.maps, this.bombs);
        const limit = this.balks.length > 0 ? COLLECT_SPOIL_LIMIT : EARLY_GAME_TILE_LIMIT;
        this.collectTarget(this.maps, targets, targetType, limit, false);
        // if (Object.keys(this.players).includes(this.playerChildId))
        //   this.collectTargetChild(updatedMap, targets, targetType, limit, false);
      }
    }
  }

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

  collectTargetChild(map: Maps, targets: Position[], targetType: number, limitation: number[], condition?: boolean) {
    if (condition || targets.length === 0) return true;
    if (this.isChildMoving) return false;

    const rawSafePath = getPathToNearestSafeTile(
      map,
      SAFE_PATH_LIMIT,
      this.players[this.playerChildId].currentPosition
    );

    // Avoid Bomb
    if (rawSafePath && rawSafePath.length > 1) {
      this.isChildMoving = true;
      const avoidBombDirections = convertRawPath(rawSafePath);
      driveChild(avoidBombDirections);
      setTimeout(() => {
        this.isChildMoving = false;
      }, this.players[this.playerChildId].speed);
      return false;
    } else {
      const rawPathToTarget = getPathToNearestItems(
        map,
        limitation,
        this.players[this.playerChildId].currentPosition,
        targets
      );
      if (!rawPathToTarget) return false;
      const directions = convertRawPath(rawPathToTarget, targetType);
      if (!directions) {
        const faceDirection = turnPlayerFace(this.players[this.playerChildId].currentPosition, rawPathToTarget[1]);
        if (faceDirection) {
          this.isChildMoving = true;
          driveChild(faceDirection);
          setTimeout(() => {
            driveChild(bombSetup());
            setTimeout(() => {
              this.isChildMoving = false;
            }, 1000);
          }, this.players[this.playerChildId].speed);
        }
        if (targetType !== TILE_TYPE.BRICK_WALL) {
          driveChild(bombSetup());
          setTimeout(() => {
            this.isChildMoving = false;
          }, this.players[this.playerChildId].delay);
        }
        return false;
      }

      this.isChildMoving = true;
      driveChild(directions);
      setTimeout(() => {
        this.isChildMoving = false;
      }, directions.length * this.players[this.playerChildId].speed);
      return false;
    }
  }
}
