import { isNull } from 'util';
import {
  ACTIONS,
  DANGER_BOMB_TIME,
  DIRECTIONS,
  LIMITATION_GOD_BADGE,
  MINIMUM_DISTANCE,
  MOVE_DIRECTION,
  TAGS,
  TILE_TYPE,
  TIME_IN_ONE_CELL
} from '../constants';
import {
  Bomb,
  DrivePlayerResponse,
  FlatMap,
  Map,
  Maps,
  Player,
  Position,
  Spoil,
  TempoGameState,
  TreeNode
} from '../types';
import {
  canWalkThrough,
  checkTargetOpposite,
  drive,
  emitSwitchWeapon,
  emitWedding,
  findAllItemsByType,
  findEscapePath,
  findPathToTargets,
  getPathFromRoot,
  isWithinRadius,
  to1dPos,
  to2dPos
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
  private flatMap: FlatMap = [];
  private reachableCells = new Set<number>();
  private bombPositions = new Set<number>();
  private bombMap = new Map<number, number>();
  private bombSpots = new Set<number>();
  private bombDangers = new Set<number>();
  private rottenBoxes = new Set<number>();
  private opponentsPositions = new Set<number>();
  private tag: string | null = null;
  private godBadges: Position[] = [];
  private bombs: Bomb[] = [];
  private roadMap: number[] = [];
  private destinationStart = Date.now();
  private waitForNextStop: boolean = true;

  private isMoving: boolean = false;
  private needTurned: boolean = false;
  private canBomb: boolean = true;
  private canMove: boolean = false;
  private gameStart: boolean = false;
  private gameLock: boolean = true;
  private oldOpponentBombs: number[] = [];
  private newOpponentBombs: number[] = [];
  private haltSignal: boolean = false;
  private haltSignalTime: number = -1;
  private idleStart: number = Date.now();

  //ONLY FOR TESTING
  private lives: number = 5;

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
        // emitWedding();
      }
      if (currentPlayer.hasTransform && currentPlayer.currentWeapon === 1) {
        emitSwitchWeapon();
      }
    }
  }

  updateMaps(maps: Maps) {
    this.maps = maps;
    this.flatMap = maps.flat();
  }

  updateOpponents(players: Player[], myPlayIds: string[] = []) {
    this.opponentsPositions = new Set<number>();
    const opponents = players.filter(p => !myPlayIds.includes(p.id));
    for (let opponent of opponents) {
      const p = opponent.currentPosition;
      this.opponentsPositions.add(to1dPos(p.col, p.row, this.mapSize.cols));
    }
  }

  getBombSpots(pos: number, playerId: string) {
    let playerPower = 3;
    const player = this.players[playerId];
    if (player) {
      playerPower = player.power;
    }
    const passThroughCells = new Set([TILE_TYPE.ROAD, TILE_TYPE.GOD_BADGE]);
    const bombSpots = new Set([pos]);
    const allDirections = [-1, 1, -this.mapSize.cols, this.mapSize.cols];
    for (let d of allDirections) {
      for (let i = 1; i <= playerPower; i++) {
        const p = pos + d * i;
        const cellType = this.flatMap[p];
        if (!passThroughCells.has(cellType)) {
          if (cellType === TILE_TYPE.BALK) {
            this.rottenBoxes.add(p);
          }
          break;
        }
        bombSpots.add(p);
      }
    }

    return bombSpots;
  }

  recheckCanBomb(bombs: Bomb[]) {
    const canBomb = bombs.filter(b => PLAYER_ID.includes(b.playerId)).length === 0;
    if (canBomb) {
      this.canBomb = canBomb;
    }
  }

  updateMapBaseOnTag(tag: string, playerId: string, bombs: Bomb[]) {
    if (PLAYER_ID.includes(playerId)) {
      //console.log(tag, player_id, this.to2dPos(this.player.position));
      if (tag === 'player:stop-moving') {
        if (this.waitForNextStop) {
          this.waitForNextStop = false;
          this.roadMap = [];
          this.recheckCanBomb(bombs);
        }
      }
      if (tag === 'player:moving-banned') {
        // if (this.canMoveHandler) {
        //   clearTimeout(this.canMoveHandler);
        //   this.canMoveHandler = null;
        // }
        this.canMove = true;
        this.roadMap = [];
        this.recheckCanBomb(bombs);
      } else if (tag === 'bomb:setup') {
        this.canBomb = false;
        //const delay = 2000; //this.player?.playerInfo?.delay ?? 2000;
        const delay = this.players[PLAYER_ID]?.delay ?? 2000;
        setTimeout(() => (this.canBomb = true), delay);
      }
    }
  }

  onPlayerStop(res: DrivePlayerResponse) {
    if (PLAYER_ID.includes(res.player_id)) {
      if (res.direction === 'x') {
        this.haltSignal = false;
        this.waitForNextStop = true;
        //this.roadMap = [];
        //this.recheckCanBomb();
      }
    }
  }

  updateBombs(bombs: Bomb[]) {
    this.bombPositions = new Set();
    this.bombSpots = new Set();
    this.bombDangers = new Set();
    this.rottenBoxes = new Set();
    this.newOpponentBombs = [];
    this.bombMap = new Map();
    // bombs.forEach((newBomb: Bomb) => {
    //   const adjustedCreatedAt = newBomb.createdAt + 500;
    //   const exists = this.bombs.some(bomb => bomb.createdAt === adjustedCreatedAt);
    //   if (!exists) {
    //     const updatedBomb = {
    //       ...newBomb,
    //       remainTime: newBomb.remainTime + this.players[PLAYER_ID].speed,
    //       createdAt: adjustedCreatedAt
    //     };
    //     this.bombs.push(updatedBomb);
    //   }
    // });

    bombs.sort((a, b) => b.remainTime - a.remainTime);
    for (let bomb of bombs) {
      const bombPos = to1dPos(bomb.col, bomb.row, this.mapSize.cols);
      const bombSpots = this.getBombSpots(bombPos, bomb.playerId);
      this.bombPositions.add(bombPos);
      this.bombSpots = new Set([...this.bombSpots, ...bombSpots]);
      if (bomb.remainTime < DANGER_BOMB_TIME) {
        this.bombDangers = new Set([...this.bombDangers, ...bombSpots]);
      }
      for (let spot of bombSpots) {
        this.bombMap.set(spot, bomb.remainTime);
        if (!PLAYER_ID.includes(bomb.playerId)) {
          this.newOpponentBombs.push(bombPos);
        }
      }
    }

    const hasNewBomb = this.newOpponentBombs.filter(b => this.oldOpponentBombs.indexOf(b) === -1).length > 0;
    this.oldOpponentBombs = this.newOpponentBombs;
    if (hasNewBomb && this.roadMap.filter(c => this.bombSpots.has(c)).length) {
      this.haltSignal = true;
      drive('x');
      this.haltSignalTime = Date.now();
    }

    // removeExpiredBombs
    const currentTimestamp = Date.now();
    this.bombs = this.bombs.filter(bomb => currentTimestamp - bomb.createdAt <= 2000);

    this.replaceBombExplosionOnMap();
  }

  findSafePlace(position: number, dangerSpots: Set<number>, initDistance: number = 0) {
    const goodSpots = [];

    const map = this.flatMap;
    const startNode = this.createTreeNode(position);
    startNode.distance = initDistance;
    const queue = [startNode];
    const visited = new Set([position]);
    while (queue.length) {
      const currentNode = queue.shift()!;
      const val = currentNode.val;

      //console.log(this.to2dPos(p));
      if (this.opponentsPositions.has(val)) {
        continue;
      }
      if (val !== position && this.bombPositions.has(val)) {
        continue;
      }

      if (this.bombMap.has(val)) {
        const bombTime = this.bombMap.get(val)!;
        if (!canWalkThrough(bombTime, currentNode.distance)) {
          continue;
        }
      }
      this.countBoxHits(currentNode);
      if (!goodSpots.length || currentNode.bonusPoints || currentNode.boxes || currentNode.isolatedBoxes >= 1) {
        if (!dangerSpots.has(val)) {
          goodSpots.push(currentNode);
        }
      }

      const neighbors = this.getNeighborNodes(val, this.mapSize.cols);
      for (let idx in neighbors) {
        const neighbor = neighbors[idx];
        const cellValue = map[neighbor];
        if (cellValue === TILE_TYPE.ROAD) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            const dir = parseInt(idx, 10) + 1;
            const neighborNode = this.createTreeNode(neighbor, dir.toString(), currentNode);
            currentNode.children.push(neighborNode);
            queue.push(neighborNode);
          }
        }
      }
    }

    let goodSpot = null;
    let firstDistance = Infinity;
    let foundOpponentEgg = false;
    for (let spot of goodSpots) {
      if (!goodSpot) {
        goodSpot = spot;
        firstDistance = spot.distance;
        continue;
      }
      // if (!foundOpponentEgg && spot.attackThis && spot.distance < firstDistance + MinimumDistance) {
      //   foundOpponentEgg = true;
      //   goodSpot = spot;
      //   continue;
      // }
      const points = spot.bonusPoints;
      const goodSpotPoints = goodSpot.bonusPoints;
      if (
        (goodSpot.boxes < spot.boxes || (goodSpotPoints < 1 && goodSpotPoints < points)) &&
        spot.distance < firstDistance + MINIMUM_DISTANCE
      ) {
        goodSpot = spot;
      }
    }

    return goodSpot;
  }

  storeRoadMap(nodes: TreeNode[]) {
    this.roadMap = [];
    this.destinationStart = Date.now();
    for (let node of nodes) {
      let n: TreeNode | null = node;
      while (n) {
        if (this.roadMap[0] !== n.val) {
          this.roadMap.unshift(n.val);
        }
        n = n.parent;
      }
    }
  }

  update(tempoGameState: TempoGameState) {
    const { map_info, tag, gameRemainTime, player_id } = tempoGameState;
    const { size, players, map, spoils, bombs } = map_info;

    if (!this.gameStart) {
      this.canMove = true;
      this.gameLock = false;
    }
    this.updateMapBaseOnTag(tag, player_id, bombs);
    this.gameStart = true;

    this.setMapSize(size.cols, size.rows);

    this.gameRemainTime = gameRemainTime;
    this.tag = tag;
    this.spoils = spoils;

    // if (this.tag === TAGS.PLAYER_TRANSFORMED) {
    //   emitSwitchWeapon();
    // }

    this.setGodBadges(map);
    players.forEach(player => {
      this.updatePlayerStats(player);
    });
    ///
    const currentPlayerTemp = this.players[PLAYER_ID];
    this.lives = currentPlayerTemp.lives;
    ////
    this.updateMaps(map);
    this.updateOpponents(players, Object.keys(this.players));
    this.updateBombs(bombs);
    const currentPlayer = this.players[PLAYER_ID];
    const currentPlayerPosition = currentPlayer?.currentPosition;
    const currentPlayerPosition1P = to1dPos(currentPlayerPosition.col, currentPlayerPosition.row, this.mapSize.cols);

    const { action, path, node } = this.mainProcess();
    switch (action) {
      case ACTIONS.RUNNING: {
        drive(path);
        break;
      }
      case ACTIONS.BOMBED: {
        // const bombPositionSlice = path ? path.slice(0, -1) : '';
        // drive(bombPositionSlice + MOVE_DIRECTION.BOMB);
        if (this.roadMap[0] === currentPlayerPosition1P) {
          //logger.info(this.player.position);
          this.roadMap.shift();
          this.idleStart = Date.now();

          if (this.roadMap.length === 0) {
            //logger.info('reach destination...');
            this.recheckCanBomb(bombs);
          }
        }
        if (this.roadMap.length && Date.now() - this.idleStart > TIME_IN_ONE_CELL) {
          //if (
          //    !this.haltSignal &&
          //    !this.waitForNextStop &&
          //    this.roadMap.length &&
          //    Date.now() - this.idleStart > TimeInOneCell
          //) {
          console.log('idling... reset the destination');
          this.roadMap = [];
          this.recheckCanBomb(bombs);
          //this.haltSignal = true;
          //this.socket.emit('drive player', { direction: 'x' });
          //this.haltSignalTime = Date.now();
        }
        if (this.waitForNextStop && Date.now() - this.haltSignalTime > TIME_IN_ONE_CELL) {
          this.waitForNextStop = false;
          this.roadMap = [];
          this.recheckCanBomb(bombs);
        }
        if (!this.roadMap.length) {
          if (this.canBomb) {
            if (node) {
              const extendPath = this.findSafePlace(
                node.val,
                new Set([...this.getBombSpots(node.val, PLAYER_ID), ...this.bombSpots]),
                node.distance
              );
              if (extendPath) {
                let direction = getPathFromRoot(node);
                const tailPath = getPathFromRoot(extendPath);
                drive(direction + 'b' + tailPath);
                this.storeRoadMap([extendPath, node]);
              }
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  mainProcess(): {
    action: ACTIONS;
    path: string | null;
    node?: TreeNode | null;
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
    // if (this.maps[currentPosition.row][currentPosition.col] === TILE_TYPE.BOMB_ZONE) {
    //   const runningPath = findEscapePath(this.maps, currentPosition);
    //   if (runningPath) {
    //     return {
    //       action: ACTIONS.RUNNING,
    //       path: runningPath
    //     };
    //   } else {
    //     return { action: ACTIONS.NO_ACTION, path: null };
    //   }
    // }

    // COLLECT SPOIL
    // const spoilPath = this.findSpoilAndPath(this.maps, currentPosition, this.spoils);
    // if (spoilPath) {
    //   return {
    //     action: ACTIONS.RUNNING,
    //     path: spoilPath.path
    //   };
    // }
    if (!this.players[PLAYER_ID].hasTransform) {
      return {
        action: ACTIONS.NO_ACTION,
        path: null
      };
    }
    // SETUP BOMB
    const node = this.findOptimalBombPosition(currentPosition);
    return { action: ACTIONS.BOMBED, path: '', node };
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

  createTreeNode(val: number, dir: string | null = null, parent: TreeNode | null = null): TreeNode {
    return {
      val,
      dir,
      parent,
      boxes: 0,
      isolatedBoxes: 0,
      distance: parent ? parent.distance + 1 : 0,
      bonusPoints: parent ? parent.bonusPoints : 0,
      playerFootprint: false,
      children: []
    };
  }

  isIsolatedBalk(pos: number) {
    const cols = this.mapSize.cols;
    const surroundSpots = [
      pos - 1,
      pos + 1,
      pos - cols,
      pos - cols - 1,
      pos - cols + 1,
      pos + cols,
      pos + cols - 1,
      pos + cols + 1
    ];

    for (let spot of surroundSpots) {
      if (this.flatMap[spot] === TILE_TYPE.BALK) {
        return false;
      }
    }
    return true;
  }

  countBoxHits(node: TreeNode) {
    const loc = node.val;
    const playerPower = this.players[PLAYER_ID]?.power ?? 1;
    let boxes = 0;
    let isolatedBoxes = 0;
    const allDirections = [-1, 1, -this.mapSize.cols, this.mapSize.cols];
    for (let d of allDirections) {
      for (let i = 1; i <= playerPower; i++) {
        const p = loc + d * i;

        let cellType = this.flatMap[p];
        if (cellType === TILE_TYPE.WALL || cellType === TILE_TYPE.BRICK_WALL) {
          break;
        }
        if (cellType === TILE_TYPE.BALK && !this.rottenBoxes.has(p)) {
          if (this.isIsolatedBalk(p)) {
            isolatedBoxes += 1;
          } else {
            boxes += 1;
          }
          break;
        }

        if (this.opponentsPositions.has(p)) {
          node.playerFootprint = true;
        }
      }
    }
    node.boxes = boxes;
    node.isolatedBoxes = isolatedBoxes;
  }

  getNeighborNodes(val: number, mapWidth: number) {
    const cols = mapWidth;
    return [val - 1, val + 1, val - cols, val + cols];
  }

  findOptimalBombPosition(position: Position) {
    const attackSpots = [];
    const startRow = position.row;
    const startCol = position.col;
    const playerPosition = to1dPos(startCol, startRow, this.mapSize.cols);
    const startNode = this.createTreeNode(playerPosition);

    const queue = [startNode];
    const visited = new Set<number>([playerPosition]);

    while (queue.length > 0) {
      const current: TreeNode = queue.shift()!;
      const val = current.val;

      if (this.opponentsPositions.has(val)) {
        continue;
      }

      if (this.bombPositions.has(val)) {
        continue;
      }

      if (this.bombMap.has(val)) {
        const bombTime = this.bombMap.get(val)!;
        if (!canWalkThrough(bombTime, current.distance)) {
          continue;
        }
      }

      this.countBoxHits(current);

      if (current.boxes > 0 || current.isolatedBoxes >= 1 || current.playerFootprint) {
        attackSpots.push(current);
      }

      const neighbors = this.getNeighborNodes(val, this.mapSize.cols);
      for (let idx in neighbors) {
        const neighbor = neighbors[idx];
        const cellValue = this.flatMap[neighbor];
        if (cellValue === TILE_TYPE.ROAD) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            const dir = parseInt(idx, 10) + 1;
            const neighborNode = this.createTreeNode(neighbor, dir.toString(), current);
            current.children.push(neighborNode);
            queue.push(neighborNode);
          }
        }
      }
    }
    let goodSpot = null;
    for (let spot of attackSpots) {
      if (!goodSpot) {
        goodSpot = spot;
        // console.log("goodSpot", goodSpot);
        continue;
      }
      // const isAllowedAttack = Date.now() - this.lastAttackTime > 5000;
      // const isUsingBomb = this.player.playerInfo.currentWeapon === Weapons.Bomb;
      if (
        spot.distance < 30 &&
        spot.playerFootprint
        // isAllowedAttack &&
        // isUsingBomb
      ) {
        // this.lastAttackTime = Date.now();
        goodSpot = spot;
        console.log('found opponent', to2dPos(goodSpot.val, this.mapSize.cols));
        break;
      }
    }
    return goodSpot;
  }
}
