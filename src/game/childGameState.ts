import {
  ACTIONS,
  DANGER_BOMB_TIME,
  DIRECTIONS,
  MINIMUM_DISTANCE,
  MOVE_DIRECTION,
  TAGS,
  TILE_TYPE,
  TIME_IN_ONE_CELL
} from '../constants';
import { Bomb, FlatMap, Map, Maps, Player, Position, TempoGameState, TreeNode } from '../types';
import { canWalkThrough, drive, getPathFromRoot, to1dPos } from '../utils';

const PLAYER_ID = process.env.PLAYER_ID || 'player2-xxx';
const PLAYER_ID_CHILD = PLAYER_ID + '_child';

export default class ChildGameState {
  constructor() {}

  private readonly players: { [id: string]: Player } = {};
  private mapSize: Map = {
    rows: 0,
    cols: 0
  };
  private maps: Maps = [];
  private flatMap: FlatMap = [];
  private reachableCells = new Set<number>();
  private bombPositions = new Set<number>();
  private bombMap = new Map<number, number>();
  private bombSpots = new Set<number>();
  private bombDangers = new Set<number>();
  private rottenBoxes = new Set<number>();
  private opponentsPositions = new Set<number>();
  private bombs: Bomb[] = [];
  private rawBombs: Bomb[] = [];
  private roadMap: number[] = [];
  private destinationStart = Date.now();
  private waitForNextStop: boolean = true;

  private isMoving: boolean = false;
  private canBomb: boolean = true;
  private canMove: boolean = false;
  private gameStart: boolean = false;
  private gameLock: boolean = true;
  private oldOpponentBombs: number[] = [];
  private newOpponentBombs: number[] = [];
  private haltSignal: boolean = false;
  private haltSignalTime: number = -1;
  private idleStart: number = Date.now();
  private lastAttackTime = Date.now();

  setMapSize(cols: number, rows: number) {
    if (this.mapSize && this.mapSize.cols === cols && this.mapSize.rows === rows) {
      return;
    }
    this.mapSize = { cols, rows };
  }

  updatePlayerStats(player: Player) {
    this.players[player.id] = { ...player };
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
    const canBomb = bombs.filter(b => PLAYER_ID_CHILD.includes(b.playerId)).length === 0;
    if (canBomb) {
      this.canBomb = canBomb;
    }
  }

  updateMapBaseOnTag(tag: string, playerId: string, bombs: Bomb[]) {
    if (PLAYER_ID_CHILD.includes(playerId)) {
      if (tag === TAGS.PLAYER_STOP_MOVING) {
        if (this.waitForNextStop) {
          this.waitForNextStop = false;
          this.roadMap = [];
          this.recheckCanBomb(bombs);
        }
      }
      if (tag === TAGS.PLAYER_MOVING_BANNED) {
        this.canMove = true;
        this.roadMap = [];
        this.recheckCanBomb(bombs);
      } else if (tag === TAGS.BOMB_SETUP) {
        this.canBomb = false;
        const delay = this.players[PLAYER_ID_CHILD]?.delay ?? 2000;
        setTimeout(() => (this.canBomb = true), delay);
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
    this.rawBombs = [...bombs];
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
        if (!PLAYER_ID_CHILD.includes(bomb.playerId)) {
          this.newOpponentBombs.push(bombPos);
        }
      }
    }
    const hasNewBomb = this.newOpponentBombs.filter(b => this.oldOpponentBombs.indexOf(b) === -1).length > 0;
    this.oldOpponentBombs = this.newOpponentBombs;
    if (hasNewBomb && this.roadMap.filter(c => this.bombSpots.has(c)).length) {
      this.haltSignal = true;
      drive(MOVE_DIRECTION.STOP, 'child');
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
    for (let spot of goodSpots) {
      if (!goodSpot) {
        goodSpot = spot;
        firstDistance = spot.distance;
        continue;
      }
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

    players.forEach(player => {
      this.updatePlayerStats(player);
    });
    const currentPlayer = this.players[PLAYER_ID_CHILD];
    if (!currentPlayer) return;

    this.updateMaps(map);
    this.updateOpponents(players, [PLAYER_ID_CHILD]);
    this.updateBombs(bombs);
    const currentPlayerPosition1P = to1dPos(
      currentPlayer.currentPosition.col,
      currentPlayer.currentPosition.row,
      this.mapSize.cols
    );

    const { action, path, node } = this.mainProcess();
    switch (action) {
      case ACTIONS.RUNNING: {
        drive(path, 'child');
        break;
      }
      case ACTIONS.BOMBED: {
        if (this.roadMap[0] === currentPlayerPosition1P) {
          this.roadMap.shift();
          this.idleStart = Date.now();
          if (this.roadMap.length === 0) {
            this.recheckCanBomb(bombs);
          }
        }
        if (this.roadMap.length && Date.now() - this.idleStart > TIME_IN_ONE_CELL) {
          this.roadMap = [];
          this.recheckCanBomb(bombs);
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
                new Set([...this.getBombSpots(node.val, PLAYER_ID_CHILD), ...this.bombSpots]),
                node.distance
              );
              if (extendPath) {
                let direction = getPathFromRoot(node);
                const tailPath = getPathFromRoot(extendPath);
                drive(direction + MOVE_DIRECTION.BOMB + tailPath, 'child');
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
    const myPlayer = this.players[PLAYER_ID_CHILD];
    const currentPosition = myPlayer.currentPosition;
    const currentPositionFlat = to1dPos(currentPosition.col, currentPosition.row, this.mapSize.cols);
    if (this.isMoving) {
      this.isMoving = false;
      return { action: ACTIONS.NO_ACTION, path: null };
    }

    if (this.roadMap[0] === currentPositionFlat) {
      this.roadMap.shift();
      this.idleStart = Date.now();

      if (this.roadMap.length === 0) {
        this.recheckCanBomb(this.rawBombs);
      }
    }

    if (this.roadMap.length && Date.now() - this.idleStart > TIME_IN_ONE_CELL) {
      this.roadMap = [];
      this.recheckCanBomb(this.rawBombs);
    }

    if (this.waitForNextStop && Date.now() - this.haltSignalTime > TIME_IN_ONE_CELL) {
      this.waitForNextStop = false;
      this.roadMap = [];
      this.recheckCanBomb(this.rawBombs);
    }

    // SETUP BOMB
    if (!this.roadMap.length) {
      const isInDanger = this.bombSpots.has(currentPositionFlat);
      if (isInDanger) {
        const node = this.gotoSafePlace();
        if (node) {
          const path = getPathFromRoot(node);
          this.storeRoadMap([node]);
          return {
            action: ACTIONS.RUNNING,
            path
          };
        }
      }
      if (this.canBomb) {
        const node = this.findOptimalBombPosition(currentPosition);
        if (node) {
          const extendPath = this.findSafePlace(
            node.val,
            new Set([...this.getBombSpots(node.val, PLAYER_ID_CHILD), ...this.bombSpots]),
            node.distance
          );
          if (extendPath) {
            let direction = getPathFromRoot(node);
            const tailPath = getPathFromRoot(extendPath);
            this.storeRoadMap([extendPath, node]);
            return { action: ACTIONS.RUNNING, path: direction + 'b' + tailPath };
          }
        }
      }
      //Find good spot while idling
      const goodSpot = this.findGoodSpot(currentPositionFlat);
      if (goodSpot) {
        const path = getPathFromRoot(goodSpot);
        if (path) {
          this.storeRoadMap([goodSpot]);
          return { action: ACTIONS.RUNNING, path };
        }
      }
    }
    return { action: ACTIONS.RUNNING, path: null };
  }

  scanRawMap(startNode: TreeNode, map: FlatMap, callback: (node: TreeNode) => [boolean | null, boolean]) {
    const queue = [startNode];
    const visited = new Set([startNode.val]);
    while (queue.length) {
      const currentNode = queue.shift()!;

      if (callback) {
        const [r, ignoreThisNode] = callback(currentNode);
        if (ignoreThisNode) {
          continue;
        }
        if (r) {
          return r;
        }
      }

      const neighbors = this.getNeighborNodes(currentNode.val, this.mapSize.cols);

      for (let idx in neighbors) {
        const neighbor = neighbors[idx];
        const cellValue = map[neighbor];
        if (cellValue === TILE_TYPE.ROAD && !visited.has(neighbor)) {
          visited.add(neighbor);
          const dir = parseInt(idx, 10) + 1;
          const neighborNode = this.createTreeNode(neighbor, dir.toString(), currentNode);
          currentNode.children.push(neighborNode);
          queue.push(neighborNode);
        }
      }
    }

    return null;
  }

  getAvoidBomb(startNode: TreeNode, map: number[], bombSpots: Set<number>) {
    const goodSpots = new Set<TreeNode>();
    let limit = 20;
    this.scanRawMap(startNode, map, (currentNode: TreeNode) => {
      const loc = currentNode.val;
      if (this.opponentsPositions.has(loc)) {
        return [null, true];
      }
      if (startNode.val !== loc && this.bombPositions.has(loc)) {
        return [null, true];
      }
      if (startNode.val !== loc && this.bombDangers.has(loc)) {
        return [null, true];
      }
      if (!bombSpots.has(loc)) {
        this.countBoxHits(currentNode);
        const isGoodSpot1 = currentNode.boxes > 0 || currentNode.isolatedBoxes > 0;

        if (goodSpots.size === 0 || isGoodSpot1) {
          goodSpots.add(currentNode);
        }

        if (--limit <= 0) {
          return [true, false];
        }
      }
      return [null, false];
    });

    let limitDistance = Infinity;
    let goodSpot = null;
    for (let spot of goodSpots) {
      if (!goodSpot) {
        goodSpot = spot;
        continue;
      }

      if (spot.distance > limitDistance) {
        break;
      }

      const points = spot.boxes + spot.bonusPoints;
      if (goodSpot.boxes + goodSpot.bonusPoints < points) {
        goodSpot = spot;
      }
    }
    return goodSpot;
  }

  gotoSafePlace() {
    const myPlayer = this.players[PLAYER_ID_CHILD];
    const currentPosition = to1dPos(myPlayer.currentPosition.col, myPlayer.currentPosition.row, this.mapSize.cols);
    const root = this.createTreeNode(currentPosition, null, null);
    let node = this.getAvoidBomb(root, this.flatMap, this.bombSpots);
    return node;
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
    const playerPower = this.players[PLAYER_ID_CHILD]?.power ?? 1;
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
        continue;
      }
      const isAllowedAttack = Date.now() - this.lastAttackTime > 5000;
      if (
        spot.distance < 20 &&
        spot.playerFootprint &&
        isAllowedAttack
        // isUsingBomb
      ) {
        this.lastAttackTime = Date.now();
        goodSpot = spot;
        break;
      }
    }
    return goodSpot;
  }

  checkForGoodSpot(spot: TreeNode, goodSpot: TreeNode) {
    const points = spot.boxes * 0.7 + spot.bonusPoints * 0.2 * spot.isolatedBoxes * 0.5;
    const goodSpotPoints = goodSpot.boxes * 0.7 + goodSpot.bonusPoints * 0.2 * goodSpot.isolatedBoxes * 0.5;
    return goodSpotPoints < points;
  }

  findGoodSpot(position: number) {
    const goodSpots = [];
    const badSpots = [];

    let limitDistance = Infinity;
    const map = this.flatMap;
    const startNode = this.createTreeNode(position);
    const queue = [startNode];
    const visited = new Set([position]);
    while (queue.length) {
      const currentNode = queue.shift()!;
      const p = currentNode.val;

      if (currentNode.distance > limitDistance) {
        break;
      }

      if (this.opponentsPositions.has(p)) {
        continue;
      }
      if (p !== position && this.bombPositions.has(p)) {
        continue;
      }

      if (this.bombMap.has(p)) {
        const bombTime = this.bombMap.get(p)!;
        if (!canWalkThrough(bombTime, currentNode.distance)) {
          continue;
        }
      }
      this.countBoxHits(currentNode);
      if (
        !goodSpots.length ||
        currentNode.bonusPoints ||
        currentNode.boxes ||
        currentNode.isolatedBoxes > 1 ||
        currentNode.playerFootprint
      ) {
        if (!this.bombSpots.has(p)) {
          goodSpots.push(currentNode);
        } else {
          badSpots.push(currentNode);
        }
      }

      const neighbors = this.getNeighborNodes(currentNode.val, this.mapSize.cols);
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
    for (let spot of goodSpots) {
      if (!goodSpot) {
        goodSpot = spot;
        continue;
      }
      if (this.checkForGoodSpot(spot, goodSpot)) {
        goodSpot = spot;
      }
    }
    if (!goodSpot) {
      for (let spot of badSpots) {
        goodSpot = spot;
      }
    }
    return goodSpot;
  }
}
