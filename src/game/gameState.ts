import { ACTIONS, DIRECTIONS, LIMITATION_GOD_BADGE, MOVE_DIRECTION, TAGS, TILE_TYPE } from '../constants';
import { Bomb, Map, Maps, Player, Position, Spoil, TempoGameState } from '../types';
import {
  checkTargetOpposite,
  drive,
  emitSwitchWeapon,
  emitWedding,
  findAllItemsByType,
  findEscapePath,
  findPathToTargets,
  isWithinRadius
} from '../utils';

const PLAYER_ID = process.env.PLAYER_ID || 'player2-xxx';
const PLAYER_ID_CHILD = process.env.PLAYER_ID + '_child';

export default class GameState {
  constructor() {}

  private readonly players: { [id: string]: Player } = {};
  private gameRemainTime: number = 0;
  private mapSize: Map = {
    rows: 0,
    cols: 0
  };
  private spoils: Spoil[] = [];
  private maps: Maps = [];
  private tag: string | null = null;
  private godBadges: Position[] = [];
  private bombs: Bomb[] = [];

  private isMoving: boolean = false;
  private needTurned: boolean = false;

  setMapSize(cols: number, rows: number) {
    if (this.mapSize && this.mapSize.cols === cols && this.mapSize.rows === rows) {
      return;
    }
    this.mapSize = { cols, rows };
  }

  setGodBadges(maps: Maps) {
    const godBadges = findAllItemsByType(maps, TILE_TYPE.GOD_BADGE);
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

    if (player.id === PLAYER_ID) {
      const currentPlayer = this.players[PLAYER_ID];
      const childNotPresent = !Object.keys(this.players).includes(PLAYER_ID_CHILD);
      if (currentPlayer.eternalBadge > 0 && childNotPresent) {
        emitWedding();
      }
    }
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

  updateBombs(bombs: Bomb[]) {
    bombs.forEach((newBomb: Bomb) => {
      const adjustedCreatedAt = newBomb.createdAt + 500;
      const exists = this.bombs.some(bomb => bomb.createdAt === adjustedCreatedAt);
      if (!exists) {
        const updatedBomb = {
          ...newBomb,
          remainTime: newBomb.remainTime + this.players[PLAYER_ID].speed,
          createdAt: adjustedCreatedAt
        };
        this.bombs.push(updatedBomb);
      }
    });

    // removeExpiredBombs
    const currentTimestamp = Date.now();
    this.bombs = this.bombs.filter(bomb => currentTimestamp - bomb.createdAt <= 2000);

    this.replaceBombExplosionOnMap();
  }

  update(tempoGameState: TempoGameState) {
    const { map_info, tag, gameRemainTime } = tempoGameState;
    const { size, players, map, spoils, bombs } = map_info;

    this.setMapSize(size.cols, size.rows);

    this.gameRemainTime = gameRemainTime;
    this.tag = tag;
    this.spoils = spoils;

    if (this.tag === TAGS.PLAYER_TRANSFORMED) {
      emitSwitchWeapon();
    }

    this.setGodBadges(map);
    players.forEach(player => {
      this.updatePlayerStats(player);
    });
    this.updateMaps(map);
    this.updateBombs(bombs);

    const { action, path } = this.mainProcess();
    switch (action) {
      case ACTIONS.RUNNING: {
        drive(path);
        break;
      }
      case ACTIONS.BOMBED: {
        const bombPositionSlice = path ? path.slice(0, -1) : '';
        drive(bombPositionSlice + MOVE_DIRECTION.BOMB);
        break;
      }
      default:
        break;
    }
  }

  mainProcess(): {
    action: ACTIONS;
    path: string | null;
  } {
    const currentPosition = this.players[PLAYER_ID].currentPosition;
    if (this.isMoving) {
      this.isMoving = false;
      return { action: ACTIONS.NO_ACTION, path: null };
    }

    // Collect God Badge
    if (!this.players[PLAYER_ID].hasTransform) {
      if (this.tag === TAGS.WOODEN_PESTLE_SETUP) {
        this.isMoving = false;
        return { action: ACTIONS.NO_ACTION, path: null };
      }

      const pathToGodBadge = findPathToTargets(this.maps, LIMITATION_GOD_BADGE, currentPosition, this.godBadges);
      const { action, path } = pathToGodBadge;

      this.isMoving = true;

      if (action === ACTIONS.RUNNING && path?.length) {
        const lastMove = path[path.length - 1];

        if (path.length === 1) {
          const isBrickWall = checkTargetOpposite(this.maps, currentPosition, TILE_TYPE.BRICK_WALL, lastMove);
          if (isBrickWall && this.needTurned) {
            this.needTurned = false;
            return { action: ACTIONS.RUNNING, path: MOVE_DIRECTION.BOMB };
          }
          this.needTurned = true;
        } else {
          this.needTurned = false;
        }
        return {
          action: ACTIONS.RUNNING,
          path
        };
      }
    }

    // const balks = findAllItemsByType(this.maps, TILE_TYPE.BALK);
    // const rawPathToBalk = findPathToNearestItems(this.maps, LIMITATION_BALK, currentPosition, balks);
    //
    // const noPathToBalk = balks.length > 0 && !rawPathToBalk && this.players[PLAYER_ID].currentWeapon === WEAPON.BOMB;
    // const canDestroyBalk = rawPathToBalk && this.players[PLAYER_ID].currentWeapon !== WEAPON.BOMB;
    //
    // if (canDestroyBalk || noPathToBalk) {
    //   emitSwitchWeapon();
    //   return { action: ACTIONS.NO_ACTION, path: null };
    // }
    //
    // const bricks = findAllItemsByType(this.maps, TILE_TYPE.BRICK_WALL);
    // const pathToBricks = findPathToTargets(this.maps, LIMITATION_BRICK, currentPosition, bricks);
    //
    // if (pathToBricks) {
    //   this.isMoving = true;
    //   const { action: escapeAction, path: escapePath } = pathToBricks;
    //   if (escapeAction === ACTIONS.RUNNING && escapePath?.length) {
    //     const lastMove = escapePath[escapePath.length - 1];
    //
    //     if (escapePath.length === 1) {
    //       const isBrickWall = checkTargetOpposite(this.maps, currentPosition, TILE_TYPE.BRICK_WALL, lastMove);
    //       if (isBrickWall && this.needTurned) {
    //         this.needTurned = false;
    //         return { action: ACTIONS.RUNNING, path: MOVE_DIRECTION.BOMB };
    //       }
    //       this.needTurned = true;
    //     } else {
    //       this.needTurned = false;
    //     }
    //     return {
    //       action: ACTIONS.RUNNING,
    //       path: escapePath
    //     };
    //   }
    // }

    // AVOID BOMB
    if (this.maps[currentPosition.row][currentPosition.col] === TILE_TYPE.BOMB_ZONE) {
      const runningPath = findEscapePath(this.maps, currentPosition);
      if (runningPath) {
        return {
          action: ACTIONS.RUNNING,
          path: runningPath
        };
      } else {
        return { action: ACTIONS.NO_ACTION, path: null };
      }
    }

    // COLLECT SPOIL
    const spoilPath = this.findSpoilAndPath(this.maps, currentPosition, this.spoils);
    if (spoilPath) {
      return {
        action: ACTIONS.RUNNING,
        path: spoilPath.path
      };
    }

    // SETUP BOMB
    const boxPath = this.findOptimalBombPosition(currentPosition);
    return { action: ACTIONS.BOMBED, path: boxPath };
  }

  replaceBombExplosionOnMap() {
    const limitTile = [TILE_TYPE.WALL, TILE_TYPE.PRISON_PLACE, TILE_TYPE.BALK, TILE_TYPE.BRICK_WALL];
    const currentTime = Date.now();
    this.bombs.forEach(bomb => {
      const { row: bombRow, col: bombCol, power, createdAt } = bomb;
      if (currentTime - createdAt >= 35) {
        this.maps[bombRow][bombCol] = TILE_TYPE.BOMB_ZONE;
        DIRECTIONS.forEach(({ row: dr, col: dc }) => {
          for (let step = 1; step <= power; step++) {
            const newRow = bombRow + dr * step;
            const newCol = bombCol + dc * step;
            if (
              newRow >= 0 &&
              newRow < this.maps.length &&
              newCol >= 0 &&
              newCol < this.maps[0].length &&
              !limitTile.includes(this.maps[newRow][newCol])
            ) {
              this.maps[newRow][newCol] = TILE_TYPE.BOMB_ZONE;
            } else {
              break;
            }
          }
        });
      }
    });
  }

  findSpoilAndPath(map: Maps, playerPosition: Position, spoils: Spoil[]) {
    const nearbySpoils = isWithinRadius(playerPosition, spoils, 7);
    if (nearbySpoils.length === 0) {
      return null;
    }

    for (const spoil of nearbySpoils) {
      const path = this.findPathToSpoil(map, playerPosition, spoil);
      if (path) {
        return { spoil, path };
      }
    }

    return null;
  }

  findPathToSpoil(map: Maps, start: Position, spoil: Spoil) {
    const directions = [
      { dr: 0, dc: -1, move: '1' },
      { dr: 0, dc: 1, move: '2' },
      { dr: -1, dc: 0, move: '3' },
      { dr: 1, dc: 0, move: '4' }
    ];

    const queue: any = [{ row: start.row, col: start.col, path: '' }];
    const visited = Array.from({ length: map.length }, () => Array(map[0].length).fill(false));
    visited[start.row][start.col] = true;

    while (queue.length > 0) {
      const { row, col, path } = queue.shift();
      if (row === spoil.row && col === spoil.col) {
        return path;
      }

      for (const { dr, dc, move } of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        if (
          newRow >= 0 &&
          newRow < map.length &&
          newCol >= 0 &&
          newCol < map[0].length &&
          !visited[newRow][newCol] &&
          map[newRow][newCol] === TILE_TYPE.ROAD
        ) {
          queue.push({ row: newRow, col: newCol, path: path + move });
          visited[newRow][newCol] = true;
        }
      }
    }

    return null;
  }

  findOptimalBombPosition(position: Position) {
    const startRow = position.row;
    const startCol = position.col;

    const directions = [
      { dr: 0, dc: -1, move: MOVE_DIRECTION.LEFT },
      { dr: 0, dc: 1, move: MOVE_DIRECTION.RIGHT },
      { dr: -1, dc: 0, move: MOVE_DIRECTION.UP },
      { dr: 1, dc: 0, move: MOVE_DIRECTION.DOWN }
    ];

    const queue = [];
    const visited = new Set();

    queue.push({ row: startRow, col: startCol, path: '', distance: 0 });
    visited.add(`${startRow},${startCol}`);

    while (queue.length > 0) {
      const current: any = queue.shift();
      const { row, col, path, distance } = current;

      if (this.maps[row][col] === TILE_TYPE.BALK) {
        return path;
      }

      for (const { dr, dc, move } of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        if (
          newRow >= 0 &&
          newRow < this.maps.length &&
          newCol >= 0 &&
          newCol < this.maps[0].length &&
          !visited.has(`${newRow},${newCol}`) &&
          (this.maps[newRow][newCol] === TILE_TYPE.ROAD || this.maps[newRow][newCol] === TILE_TYPE.BALK)
        ) {
          queue.push({ row: newRow, col: newCol, path: path + move, distance: distance + 1 });
          visited.add(`${newRow},${newCol}`);
        }
      }
    }

    return null;
  }
}
