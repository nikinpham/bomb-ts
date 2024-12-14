import { ACTIONS, DIRECTIONS, MOVE_DIRECTION, TAGS, TILE_TYPE, WEAPON } from '../constants';
import { Bomb, Map, Maps, Player, Position, Spoil, TempoGameState } from '../types';
import {
  drive,
  emitSwitchWeapon,
  emitWedding,
  findEscapePath,
  findGodBadges,
  hasValueThree,
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

    if (!this.players[PLAYER_ID].hasTransform) {
      if (this.maps[currentPosition.row][currentPosition.col] === TILE_TYPE.GOD_BADGE) {
        return {
          action: ACTIONS.WAITING,
          path: null
        };
      }

      if (this.tag === TAGS.WOODEN_PESTLE_SETUP) {
        this.isMoving = false;
        return { action: ACTIONS.NO_ACTION, path: null };
      }

      if (this.tag === TAGS.PLAYER_STOP_MOVING) {
        if (hasValueThree(currentPosition, this.maps)) {
          this.isMoving = true;
          return { action: ACTIONS.RUNNING, path: MOVE_DIRECTION.BOMB };
        }
      }

      const findPathStoppingAtThree: { action: string; path: string | null } = this.findPathStoppingAtThree(
        this.maps,
        currentPosition
      );

      if (findPathStoppingAtThree.action === ACTIONS.RUNNING || !this.isMoving) {
        this.isMoving = true;
        return {
          action: ACTIONS.RUNNING,
          path: findPathStoppingAtThree.path
        };
      }

      if (!hasValueThree(currentPosition, this.maps)) {
        this.isMoving = false;
        return { action: ACTIONS.NO_ACTION, path: null };
      }
    }

    // Switch Weapon
    if (this.players[PLAYER_ID].currentWeapon !== WEAPON.BOMB) {
      emitSwitchWeapon();
      return { action: ACTIONS.NO_ACTION, path: null };
    }

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

  findPathStoppingAtThree = (grid: number[][], start: { row: number; col: number }) => {
    const directions: [number, number, string][] = [
      [1, 0, '4'],
      [0, -1, '1'],
      [0, 1, '2'],
      [-1, 0, '3']
    ];

    const isValid = (x: number, y: number, visited: boolean[][]): boolean => {
      const rows = grid.length;
      const cols = grid[0].length;
      return (
        x >= 0 &&
        x < rows &&
        y >= 0 &&
        y < cols &&
        !visited[x][y] &&
        (grid[x][y] === TILE_TYPE.ROAD || grid[x][y] === TILE_TYPE.BRICK_WALL || grid[x][y] === TILE_TYPE.GOD_BADGE)
      );
    };

    type PathStep = { move: string | null; value: number; row: number; col: number };

    const queue: [number, number, PathStep[]][] = [[start.row, start.col, []]]; // [row, col, path[]]

    const visited: boolean[][] = Array.from({ length: grid.length }, () => Array(grid[0].length).fill(false));
    visited[start.row][start.col] = true;

    while (queue.length > 0) {
      const [x, y, path] = queue.shift()!;
      if (grid[x][y] === TILE_TYPE.GOD_BADGE) {
        const fullPath: PathStep[] = [...path, { move: null, value: TILE_TYPE.GOD_BADGE, row: x, col: y }];
        const stoppingPath: string[] = [];
        for (const step of fullPath) {
          if (step.value === TILE_TYPE.BRICK_WALL) {
            return { action: ACTIONS.RUNNING, path: stoppingPath.join('') };
          }
          if (step.move) stoppingPath.push(step.move);
        }
        return { action: ACTIONS.RUNNING, path: stoppingPath.join('') };
      }

      for (const [dx, dy, action] of directions) {
        const nx = x + dx;
        const ny = y + dy;

        if (isValid(nx, ny, visited)) {
          queue.push([nx, ny, [...path, { move: action, value: grid[x][y], row: x, col: y }]]);
          visited[nx][ny] = true;
        }
      }
    }

    return { action: ACTIONS.NO_ACTION, path: null };
  };

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
