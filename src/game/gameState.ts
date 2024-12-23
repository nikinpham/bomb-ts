import { isNull } from 'util';
import {
  ACTIONS,
  DANGER_BOMB_TIME,
  DIRECTIONS,
  LIMITATION_GOD_BADGE,
  MINIMUM_DISTANCE,
  MOVE_DIRECTION,
  PLAYER_DIRECTION,
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
  TreeNode,
  WeaponPlace
} from '../types';
import {
  canWalkThrough,
  checkTargetOpposite,
  drive,
  emitSwitchWeapon,
  emitUseSpecialSkill,
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
  private opponentsPositionsRaw: Position[] = [];
  private tag: string | null = null;
  private godBadges: Position[] = [];
  private bombs: Bomb[] = [];
  private rawBombs: Bomb[] = [];
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
  private lastAttackTime = Date.now();
  private lastCalculateSpecialSkill = Date.now();
  private lastUseSpecialSkillTime = Date.now();
  private weaponDropped: Position | null = null;

  private hasMarried: boolean = false;
  private gameLocked: boolean = false;
  private currentDirection: PLAYER_DIRECTION = PLAYER_DIRECTION.DOWN;
  private lastPosition: Position | null = null;
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
      if (currentPlayer?.currentPosition) {
        this.calculateDirection(currentPlayer.currentPosition);
      }
      if (currentPlayer.eternalBadge > 0 && childNotPresent) {
        // emitWedding();
      }
      if (currentPlayer.hasTransform && currentPlayer.currentWeapon === 1) {
        emitSwitchWeapon();
      }
    }
  }

  checkWeaponDropped(weaponPlaces: WeaponPlace[]) {
    const myWeapon = weaponPlaces.find(p => PLAYER_ID.includes(p.playerId));
    if (myWeapon) {
      this.weaponDropped = {
        row: myWeapon.row,
        col: myWeapon.col
      };
    } else {
      this.weaponDropped = null;
    }
  }

  updateMaps(maps: Maps) {
    this.maps = maps;
    this.flatMap = maps.flat();
  }

  updateOpponents(players: Player[], myPlayIds: string[] = []) {
    this.opponentsPositions = new Set<number>();
    this.opponentsPositionsRaw = [];
    const opponents = players.filter(p => !myPlayIds.includes(p.id));
    for (let opponent of opponents) {
      const p = opponent.currentPosition;
      this.opponentsPositionsRaw.push(p);
      this.opponentsPositions.add(to1dPos(p.col, p.row, this.mapSize.cols));
    }
  }

  calculateDirection(newPlayerPosition: Position) {
    if (!this.lastPosition) {
      this.lastPosition = newPlayerPosition;
      return;
    }
    if (newPlayerPosition.row === this.lastPosition.row && newPlayerPosition.col === this.lastPosition.col) return;
    if (newPlayerPosition.row === this.lastPosition.row) {
      if (newPlayerPosition.col > this.lastPosition.col) {
        this.currentDirection = PLAYER_DIRECTION.RIGHT;
      } else {
        this.currentDirection = PLAYER_DIRECTION.LEFT;
      }
    }
    if (newPlayerPosition.col === this.lastPosition.col) {
      if (newPlayerPosition.row > this.lastPosition.row) {
        this.currentDirection = PLAYER_DIRECTION.DOWN;
      } else {
        this.currentDirection = PLAYER_DIRECTION.TOP;
      }
    }
    this.lastPosition = newPlayerPosition;
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
      if (!this.hasMarried && tag === 'player:wedding-completed') {
        this.hasMarried = true;
      }
      if (tag === 'player:moving-banned') {
        this.canMove = true;
        this.roadMap = [];
        this.recheckCanBomb(bombs);
      } else if (tag === 'bomb:setup') {
        this.canBomb = false;
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
        // this.roadMap = [];
        // this.recheckCanBomb();
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
    const { size, players, map, spoils, bombs, weaponPlaces } = map_info;

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
    this.updateOpponents(players, [PLAYER_ID]);
    this.updateBombs(bombs);
    this.checkWeaponDropped(weaponPlaces);
    const currentPlayer = this.players[PLAYER_ID];
    const currentPlayerPosition = currentPlayer?.currentPosition;
    const currentPlayerPosition1P = to1dPos(currentPlayerPosition.col, currentPlayerPosition.row, this.mapSize.cols);

    const { action, path, node } = this.mainProcess();
    switch (action) {
      case ACTIONS.RUNNING: {
        drive(path);
        break;
      }
      case ACTIONS.USE_SPECIAL_SKILL: {
        emitUseSpecialSkill();
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
          console.log('idling... reset the destination');
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
    const myPlayer = this.players[PLAYER_ID];
    const currentPosition = myPlayer.currentPosition;
    const currentPositionFlat = to1dPos(currentPosition.col, currentPosition.row, this.mapSize.cols);
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

    if (!this.gameLocked) {
      this.gameLocked = true;
      const shouldUseSpecialWeapon =
        myPlayer.hasTransform &&
        this.hasMarried &&
        myPlayer.haveSpecialWeapon &&
        myPlayer.timeToUseSpecialWeapons > 0 &&
        Date.now() - this.lastCalculateSpecialSkill > 1500 &&
        Date.now() - this.lastUseSpecialSkillTime > 6000 &&
        this.canUseSpecialSkill(myPlayer.currentPosition);
      if (shouldUseSpecialWeapon) {
        this.lastUseSpecialSkillTime = Date.now();
        setTimeout(() => {
          this.gameLock = false;
        }, 2000);
        return { action: ACTIONS.USE_SPECIAL_SKILL, path: null };
      }
      if (this.roadMap[0] === currentPositionFlat) {
        this.roadMap.shift();
        this.idleStart = Date.now();

        if (this.roadMap.length === 0) {
          this.recheckCanBomb(this.rawBombs);
        }
      }

      if (this.roadMap.length && Date.now() - this.idleStart > TIME_IN_ONE_CELL) {
        console.log('idling... reset the destination');
        this.roadMap = [];
        this.recheckCanBomb(this.rawBombs);
      }

      if (this.waitForNextStop && Date.now() - this.haltSignalTime > TIME_IN_ONE_CELL) {
        this.waitForNextStop = false;
        this.roadMap = [];
        this.recheckCanBomb(this.rawBombs);
      }

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
        // COLLECT WEAPON
        if (this.weaponDropped) {
          const node = this.goToTarget(this.weaponDropped, currentPositionFlat);
          if (node) {
            const path = getPathFromRoot(node);
            this.storeRoadMap([node]);
            return { action: ACTIONS.RUNNING, path };
          }
        }
        if (this.canBomb) {
          const node = this.findOptimalBombPosition(currentPosition);
          if (node) {
            const extendPath = this.findSafePlace(
              node.val,
              new Set([...this.getBombSpots(node.val, PLAYER_ID), ...this.bombSpots]),
              node.distance
            );
            if (extendPath) {
              let direction = getPathFromRoot(node);
              const tailPath = getPathFromRoot(extendPath);
              // drive(direction + 'b' + tailPath);
              this.storeRoadMap([extendPath, node]);
              return { action: ACTIONS.RUNNING, path: direction + 'b' + tailPath };
            }
          }
        }
        //Find good spot while idling
        const goodSpot = this.findGoodSpot(currentPositionFlat);
        if (goodSpot) {
          console.log('good spot');
          const path = getPathFromRoot(goodSpot);
          if (path) {
            this.storeRoadMap([goodSpot]);
            return { action: ACTIONS.RUNNING, path };
          }
        }
      }
      this.gameLocked = false;
    }
    return { action: ACTIONS.RUNNING, path: null };
  }

  scanRawMap(startNode: TreeNode, map: FlatMap, callback: (node: TreeNode) => [TreeNode | null, boolean]) {
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
          return [currentNode, false];
        }
      }
      return [null, false];
    });

    let limitDistance = Infinity;
    let goodSpot = null;
    let foundOpponentEgg = false;
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
    const myPlayer = this.players[PLAYER_ID];
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
        console.log('found opponent', to2dPos(goodSpot.val, this.mapSize.cols));
        break;
      }
    }
    return goodSpot;
  }

  checkForGoodSpot(spot: TreeNode, goodSpot: TreeNode) {
    // let points = spot.boxes * spot.isolatedBoxes * 0.5;
    // let goodSpotPoints = goodSpot.boxes * goodSpot.isolatedBoxes * 0.5;
    // if (!this.isFullPower()) {
    //   points =
    //     spot.boxes * 0.7 + spot.bonusPoints * 0.2 * spot.isolatedBoxes * 0.5;
    //   goodSpotPoints =
    //     goodSpot.boxes * 0.7 +
    //     goodSpot.bonusPoints * 0.2 * goodSpot.isolatedBoxes * 0.5;
    // }
    const points = spot.boxes * 0.7 + spot.bonusPoints * 0.2 * spot.isolatedBoxes * 0.5;
    const goodSpotPoints = goodSpot.boxes * 0.7 + goodSpot.bonusPoints * 0.2 * goodSpot.isolatedBoxes * 0.5;
    return goodSpotPoints < points;
  }

  findGoodSpot(position: number) {
    const goodSpots = [];
    const badSpots = [];

    let limitDistance = Infinity;
    // if (this.pivotNode) {
    //   limitDistance = this.pivotNode.distance + AroundPivotLimit;
    // }

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

  canUseSpecialSkill(playerPosition: Position) {
    this.lastCalculateSpecialSkill = Date.now();
    let shouldAttack = false;
    const barriers = [TILE_TYPE.BRICK_WALL, TILE_TYPE.BALK, TILE_TYPE.WALL];
    const mapWidth = this.mapSize.cols;
    if (this.currentDirection === PLAYER_DIRECTION.LEFT || this.currentDirection === PLAYER_DIRECTION.RIGHT) {
      this.opponentsPositions.forEach(oPosition => {
        const currentRow = playerPosition.row;
        let max = (currentRow + 2) * this.mapSize.cols;
        let min = max - 3 * this.mapSize.cols;
        if (oPosition >= min && oPosition <= max) {
          let pos: number | null = to1dPos(playerPosition.col, playerPosition.row, mapWidth);
          if (oPosition <= currentRow * mapWidth) {
            pos -= mapWidth;
          } else if (oPosition > (currentRow + 1) * mapWidth) {
            pos += mapWidth;
          }

          if (
            (this.currentDirection === PLAYER_DIRECTION.LEFT && oPosition < pos) ||
            (this.currentDirection === PLAYER_DIRECTION.RIGHT && oPosition > pos)
          ) {
            if (this.currentDirection === PLAYER_DIRECTION.LEFT) {
              while (pos) {
                if (barriers.includes(this.flatMap[pos]) || pos < oPosition) {
                  pos = null;
                  continue;
                }
                if (pos === oPosition) {
                  shouldAttack = true;
                  pos = null;
                  break;
                }
                pos--;
              }
              return shouldAttack;
            }
            if (this.currentDirection === PLAYER_DIRECTION.RIGHT) {
              while (pos) {
                if (barriers.includes(this.flatMap[pos]) || pos > oPosition) {
                  pos = null;
                  continue;
                }
                if (pos === oPosition) {
                  shouldAttack = true;
                  pos = null;
                  break;
                }
                pos++;
              }
              return shouldAttack;
            }
          }
        }
      });
    }
    if (this.currentDirection === PLAYER_DIRECTION.TOP || this.currentDirection === PLAYER_DIRECTION.DOWN) {
      this.opponentsPositionsRaw.forEach(oPositionRaw => {
        const oPosition = to1dPos(oPositionRaw.col, oPositionRaw.row, mapWidth);
        const currentCol = playerPosition.col;
        const currentRow = playerPosition.row;

        if (oPositionRaw.col >= currentCol - 1 && oPositionRaw.col <= currentCol + 1) {
          let pos: number | null = to1dPos(oPositionRaw.col, currentRow, mapWidth);
          if (
            (this.currentDirection === PLAYER_DIRECTION.TOP && oPositionRaw.row < currentRow) ||
            (this.currentDirection === PLAYER_DIRECTION.DOWN && oPositionRaw.row > currentRow)
          ) {
            if (this.currentDirection === PLAYER_DIRECTION.TOP) {
              while (pos) {
                if (barriers.includes(this.flatMap[pos]) || pos < oPosition) {
                  pos = null;
                  continue;
                }
                if (pos === oPosition) {
                  shouldAttack = true;
                  pos = null;
                  break;
                }
                pos -= mapWidth;
              }
              return shouldAttack;
            }
            if (this.currentDirection === PLAYER_DIRECTION.DOWN) {
              while (pos) {
                if (barriers.includes(this.flatMap[pos]) || pos > oPosition) {
                  pos = null;
                  continue;
                }
                if (pos === oPosition) {
                  shouldAttack = true;
                  pos = null;
                  break;
                }
                pos += mapWidth;
              }
              return shouldAttack;
            }
          }
        }
      });
    }
    return shouldAttack;
  }

  goToTarget(target: Position, myPlayerPosition: number) {
    const targetFlat = to1dPos(target.col, target.row, this.mapSize.cols);
    const node = this.scanRawMap(this.createTreeNode(myPlayerPosition), this.flatMap, currentNode => {
      const loc = currentNode.val;
      if (this.opponentsPositions.has(loc)) {
        return [null, true];
      }
      if (this.bombDangers.has(loc)) {
        return [null, true];
      }

      if (currentNode.val === targetFlat) {
        return [currentNode, false];
      }

      return [null, false];
    });
    return node;
  }
}
