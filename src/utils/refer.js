// Constants for Map Cells
import { DIRECTIONS, PLAYER_ID, PLAYER_ID_CHILD, TILE_TYPE } from '../constants';
import { drive } from './utils';
import { socket } from '../server';

class TreeNode {
  constructor(val, dir = null, parent = null) {
    this.val = val;
    this.dir = dir;
    this.parent = parent;
    this.children = [];
    this.distance = parent ? parent.distance + 1 : 0;
  }
}

class GamePlayer {
  constructor(gameMap, playerInfo) {
    this.position = gameMap.to1dPos(playerInfo.currentPosition.col, playerInfo.currentPosition.row);
    this.playerInfo = playerInfo;
  }
}

export class GameMap {
  constructor() {
    this.map = [];
    this.flatMap = [];
    this.mapWidth = 26;
    this.player = null;
    this.bombs = [];
    this.spoils = [];
    // Trạng thái di chuyển và phá tường
    this.isMoving = false;
    this.isBreaking = false;
    this.currentTarget = null;
    this.isWaitingAtGodBadge = false;

    // Trạng thái đứng yên
    this.lastMoveTime = Date.now(); // Lần cuối cùng di chuyển
    this.lastPosition = null; // Vị trí lần cuối
    this.caculatorResetTime = 0;

    // kiểm tra việc sử dụng vũ khí thần
    this.parentSkill = true;
  }
  async start(res) {
    const currentPlayer = res.map_info.players.find(p => PLAYER_ID.includes(p.id));
    this.caculatorResetTime++;

    this.map = res.map_info.map;

    const enemies = res.map_info.players.filter(p => p.id !== PLAYER_ID && p.id !== PLAYER_ID_CHILD);

    if (enemies.length > 0) {
      enemies.forEach(enemy => {
        if (enemy !== undefined && enemy.currentPosition !== undefined && enemy.currentPosition.col !== undefined) {
          this.map[enemy.currentPosition.row][enemy.currentPosition.col] = TILE_TYPE.BALK;
        }
      });
    }

    const nonChildEnemies = enemies.filter(enemy => !enemy.id.endsWith('_child'));
    nonChildEnemies.forEach(enemy => {
      if (!enemy.hasTransform) {
        if (enemy.currentPosition.col !== undefined) {
          this.map[enemy.currentPosition.row][enemy.currentPosition.col] = TILE_TYPE.WALL;
        }
      }
    });

    this.replaceValuesInRadius(
      currentPlayer.currentPosition.row,
      currentPlayer.currentPosition.col,
      10,
      TILE_TYPE.DESTROYED_CELL,
      TILE_TYPE.ROAD
    );
    // check vij trí búa

    if (res.map_info.weaponHammers.length > 0) {
      this.updateMapWithICBM(res.map_info.weaponHammers, TILE_TYPE.BOMB_ZONE);
    }

    this.flatMap = this.map.flat();
    this.mapWidth = res.map_info.size.cols;
    this.spoils = res.map_info.spoils;

    this.player = new GamePlayer(this, currentPlayer);

    const hasTransform = this.player.playerInfo.hasTransform;
    this.bombs = res.map_info.bombs.filter(bomb => bomb.playerId === this.player.playerInfo.id);

    // Lặp qua tất cả các bomb trên bản đồ và tính toán vùng ảnh hưởng
    await res.map_info.bombs.forEach(bomb => {
      const bombPosition = this.to1dPos(bomb.col, bomb.row);
      this.replaceBombImpactWithSpecialZone(bombPosition);
    });

    if (this.flatMap[this.player.position] === TILE_TYPE.BOMB_ZONE) {
      const spoilsPath = this.findEscapePath(); // Tìm đường thoát trong bán kính 5 ô
      drive(spoilsPath);
      return;
    }

    if (hasTransform === undefined) {
      console.warn('Transform state is undefined. Skipping action.');
      return;
    }

    this.replaceSpoilsToMapValue();
    // Kiểm tra trạng thái đứng yên
    this.checkIdleStatus();

    if (enemies.length > 0 && this.parentSkill) {
      for (const enemy of enemies) {
        const isChild = enemy.id.endsWith('_child'); // Kiểm tra nếu ID kết thúc bằng '_child'
        if (
          enemy !== undefined &&
          this.player.playerInfo.timeToUseSpecialWeapons &&
          this.isWithinRadius(
            currentPlayer.currentPosition.row,
            currentPlayer.currentPosition.col,
            enemy.currentPosition.row,
            enemy.currentPosition.col,
            7
          ) &&
          (isChild || enemy.hasTransform) // Nếu là _child hoặc có hasTransform
        ) {
          if (enemy.currentPosition.col !== undefined) {
            this.parentSkill = false;
            await socket.emit('action', {
              action: 'use weapon',
              payload: {
                destination: {
                  col: enemy.currentPosition.col,
                  row: enemy.currentPosition.row
                }
              }
            });
            setTimeout(() => {
              this.parentSkill = true;
            }, 1000);
          }
          // Dừng loop ngay khi tìm thấy enemy phù hợp
          break;
        }
      }
    }

    if (this.playerStopNearbyBomb()) {
      drive('x');
    }
    // Picking Item TODO
    if (this.bombs.length === 0 && hasTransform && !this.isWaitingAtGodBadge) {
      const spoilsPath = this.getItem(); // Tìm Spoils trong bán kính 5 ô
      if (spoilsPath) {
        drive(spoilsPath);
      }
    }

    // Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường
    // console.log("Nếu không trong vùng nguy hiểm, tiếp tục xử lý logic thông thường", this.hasPlacedBomb)
    return this.decideNextAction(hasTransform);
  }

  replaceBombImpactWithSpecialZone(bombPosition) {
    const bombImpactArea = this.getBombImpactArea(bombPosition);
    bombImpactArea.forEach(position => {
      if (this.flatMap[position] !== TILE_TYPE.WALL) {
        this.flatMap[position] = TILE_TYPE.BOMB_ZONE; // Thay thế bằng số 77
      }
    });
  }

  replaceSpoilsToMapValue() {
    // Kiểm tra dữ liệu spoils
    if (!this.spoils || !Array.isArray(this.spoils)) {
      return;
    }
    // Duyệt qua tất cả các item trong this.spoils
    this.spoils.forEach(spoil => {
      const { row, col } = spoil;

      // Tính chỉ số phẳng (1D) từ tọa độ 2D
      const index = this.to1dPos(col, row);

      // Kiểm tra chỉ số hợp lệ trước khi thay thế
      if (index >= 0 && index < this.flatMap.length) {
        this.flatMap[index] = TILE_TYPE.SPOIL; // Gán giá trị 99
      }
    });
  }

  convertFlatTo2DMap() {
    const map = [];
    for (let i = 0; i < this.flatMap.length; i += this.mapWidth) {
      map.push(this.flatMap.slice(i, i + this.mapWidth));
    }

    return map;
  }

  checkIdleStatus() {
    const currentPosition = this.player.position;

    if (this.lastPosition === currentPosition) {
      const timeSinceLastMove = Date.now() - this.lastMoveTime;

      if (timeSinceLastMove > 7000) {
        // Nếu đứng yên quá 7 giây
        this.hasPlacedBomb = false;
        this.forceRandomMove();
        this.lastMoveTime = Date.now(); // Cập nhật thời gian di chuyển cuối
      }
    } else {
      this.lastPosition = currentPosition;
      this.lastMoveTime = Date.now(); // Cập nhật thời gian di chuyển cuối
    }
  }

  async forceRandomMove() {
    const neighbors = this.getNeighborNodes(this.player.position);

    // Chọn ngẫu nhiên một ô lân cận có thể di chuyển
    const validNeighbors = neighbors.filter(
      ({ pos }) => this.flatMap[pos] === TILE_TYPE.ROAD || this.flatMap[pos] === TILE_TYPE.SPOIL // Thêm TILE_TYPE.Spoils
    );

    if (validNeighbors.length > 0) {
      const randomNeighbor = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      drive(randomNeighbor.dir);
    }
  }

  to1dPos(x, y) {
    return y * this.mapWidth + x;
  }

  to2dPos(pos) {
    const x = pos % this.mapWidth;
    const y = Math.floor(pos / this.mapWidth);
    return { x, y };
  }

  updateMapAfterBreaking(targetPos) {
    this.flatMap[targetPos] = TILE_TYPE.ROAD; // Biến tường gạch thành đường trống
  }

  decideNextAction(hasTransform) {
    if (this.isMoving || this.isBreaking || this.isWaitingAtGodBadge) {
      return; // Không thực hiện thêm hành động khi đang bận
    }

    const playerPosition = this.player.position;
    if (hasTransform === undefined) {
      console.warn('Transform state is undefined. Skipping action.');
      return;
    }
    // Nếu đã transformed, chỉ đặt bomb và tránh vùng nổ
    if (hasTransform) {
      if (this.player.playerInfo.currentWeapon !== 2) {
        socket.emit('action', { action: 'switch weapon' });
        this.player.playerInfo.currentWeapon = 2; // Cập nhật trạng thái weapon
        return;
      }

      if (!this.hasPlacedBomb) {
        const bombPosition = this.findOptimalBombPosition(playerPosition);
        if (bombPosition) {
          this.placeBombAndRetreat(bombPosition);
          return;
        } else {
          return;
        }
      } else {
        return;
      }
    }
    // console.log("Ưu tiên đến GodBadge nếu chưa transformed");
    // Ưu tiên đến GodBadge nếu chưa transformed
    const closestGodBadge = this.findClosestCell(playerPosition, TILE_TYPE.GOD_BADGE);
    if (closestGodBadge !== null && this.currentTarget !== closestGodBadge) {
      const pathToBadge = this.findPath(playerPosition, closestGodBadge);

      if (pathToBadge && this.isPathValid(pathToBadge, playerPosition)) {
        this.currentTarget = closestGodBadge;
        this.moveToAndWait(pathToBadge, 3000); // Đứng tại GodBadge trong 3 giây
        return;
      }
    }
    // Nếu không có GodBadge hoặc đã biến hình, tìm tường gạch gần nhất
    const closestBrickWall = this.findClosestCell(playerPosition, TILE_TYPE.BRICK_WALL);
    if (closestBrickWall !== null && this.currentTarget !== closestBrickWall) {
      const pathToBrick = this.findPath(playerPosition, closestBrickWall);

      if (pathToBrick && pathToBrick.length > 0) {
        this.currentTarget = closestBrickWall;
        this.moveToAndBreakProperly(pathToBrick, closestBrickWall);
        return;
      }
    }

    this.currentTarget = null;
  }

  moveToAndWait(path, waitTime) {
    if (path && path.length > 0) {
      this.isMoving = true;
      this.moveTo(path);

      setTimeout(() => {
        this.isMoving = false;
        this.isWaitingAtGodBadge = true;

        // Chờ 3 giây tại GodBadge
        setTimeout(() => {
          this.isWaitingAtGodBadge = false;
          this.decideNextAction(); // Tiếp tục hành động tiếp theo
        }, waitTime);
      }, path.length * 500); // Thời gian di chuyển phụ thuộc vào độ dài path
    } else {
      this.isMoving = false;
    }
  }

  moveToAndBreakProperly(path, targetPos) {
    if (path.length > 0) {
      this.isMoving = true;
      this.moveTo(path); // Di chuyển đến gần tường gạch

      // Sau khi di chuyển xong
      setTimeout(async () => {
        this.isMoving = false;

        const playerPosition = this.player.position;
        const directionToBrick = this.getDirectionToNeighbor(playerPosition, targetPos);

        if (directionToBrick) {
          drive(directionToBrick);
          drive('b');
          // Cập nhật bản đồ sau khi phá tường
          this.updateMapAfterBreaking(targetPos);

          // Kiểm tra và phá tiếp các tường xung quanh nếu có
          this.isBreaking = false;
          this.breakSurroundingBrickWalls(); // Kiểm tra và phá tiếp các tường xung quanh
        }
      }, path.length * 30); // Thời gian chờ phụ thuộc vào độ dài đường đi
    }
  }

  breakSurroundingBrickWalls() {
    const playerPosition = this.player.position;

    // Lấy danh sách các ô lân cận
    const neighbors = this.getNeighborNodes(playerPosition);

    for (let neighbor of neighbors) {
      const { pos, dir } = neighbor;
      const cellValue = this.flatMap[pos];

      // Kiểm tra nếu ô lân cận là tường gạch
      if (cellValue === TILE_TYPE.BRICK_WALL) {
        // Quay mặt vào tường gạch
        drive(dir);

        setTimeout(() => {
          drive('b');

          // Cập nhật bản đồ sau khi phá tường
          this.updateMapAfterBreaking(pos);

          // Tiếp tục kiểm tra và phá các tường khác
          setTimeout(() => {
            this.breakSurroundingBrickWalls();
          }, 500);
        }, 500);

        return; // Dừng vòng lặp để xử lý từng tường một
      }
    }

    this.decideNextAction(); // Tiếp tục hành động tiếp theo
  }

  getDirectionToNeighbor(currentPos, targetPos) {
    const { x: currX, y: currY } = this.to2dPos(currentPos);
    const { x: targetX, y: targetY } = this.to2dPos(targetPos);

    if (currX === targetX && currY - 1 === targetY) return DIRECTIONS.UP; // Target ở trên
    if (currX === targetX && currY + 1 === targetY) return DIRECTIONS.DOWN; // Target ở dưới
    if (currX - 1 === targetX && currY === targetY) return DIRECTIONS.LEFT; // Target ở trái
    if (currX + 1 === targetX && currY === targetY) return DIRECTIONS.RIGHT; // Target ở phải

    return null; // Không phải ô lân cận
  }

  findClosestCell(playerPosition, cellType) {
    let closestCell = null;
    let minDistance = Infinity;

    this.flatMap.forEach((cell, index) => {
      if (cell === cellType) {
        const path = this.findPath(playerPosition, index);
        if (path && path.length > 0) {
          const distance = path.length;
          if (distance < minDistance) {
            minDistance = distance;
            closestCell = index;
          }
        }
      }
    });

    return closestCell;
  }

  findPath(startPos, targetPos) {
    const startNode = new TreeNode(startPos);
    const resultNode = this.scanRawMap(startNode, this.flatMap, currentNode => {
      if (currentNode.val === targetPos) {
        return [currentNode, false];
      }
      return [null, false];
    });

    if (resultNode) {
      const path = [];
      let node = resultNode;
      while (node.parent) {
        path.unshift(node.dir);
        node = node.parent;
      }
      return path;
    }

    return null;
  }

  isPathValid(path, startPos) {
    let currentPos = startPos; // Bắt đầu từ vị trí hiện tại
    for (const step of path) {
      // Tính vị trí tiếp theo dựa trên bước đi
      const { x, y } = this.to2dPos(currentPos);
      if (step === DIRECTIONS.UP) currentPos = this.to1dPos(x, y - 1);
      if (step === DIRECTIONS.DOWN) currentPos = this.to1dPos(x, y + 1);
      if (step === DIRECTIONS.LEFT) currentPos = this.to1dPos(x - 1, y);
      if (step === DIRECTIONS.RIGHT) currentPos = this.to1dPos(x + 1, y);

      // Kiểm tra nếu ô không hợp lệ
      const cellValue = this.flatMap[currentPos];
      if (cellValue !== TILE_TYPE.SPOIL && cellValue !== TILE_TYPE.ROAD && cellValue !== TILE_TYPE.GOD_BADGE) {
        return false;
      }
    }
    return true; // Tất cả các ô hợp lệ
  }

  getNeighborNodes(val) {
    const cols = this.mapWidth;

    return [
      { pos: val - cols, dir: DIRECTIONS.UP },
      { pos: val + cols, dir: DIRECTIONS.DOWN },
      { pos: val - 1, dir: DIRECTIONS.LEFT },
      { pos: val + 1, dir: DIRECTIONS.RIGHT }
    ].filter(neighbor => {
      const { pos } = neighbor;
      return pos >= 0 && pos < this.flatMap.length;
    });
  }

  scanRawMap(startNode, map, callback) {
    const queue = [startNode];
    const visited = new Set([startNode.val]);

    while (queue.length) {
      const currentNode = queue.shift();

      if (callback) {
        const [result, ignoreThisNode] = callback(currentNode);
        if (ignoreThisNode) continue;
        if (result) return result;
      }

      const neighbors = this.getNeighborNodes(currentNode.val);
      for (let neighbor of neighbors) {
        const { pos, dir } = neighbor;
        const cellValue = map[pos];

        if (
          cellValue === TILE_TYPE.SPOIL ||
          cellValue === TILE_TYPE.ROAD ||
          cellValue === TILE_TYPE.BRICK_WALL ||
          cellValue === TILE_TYPE.GOD_BADGE
        ) {
          if (!visited.has(pos)) {
            visited.add(pos);
            const neighborNode = new TreeNode(pos, dir, currentNode);
            currentNode.children.push(neighborNode);
            queue.push(neighborNode);
          }
        }
      }
    }

    return null;
  }

  // Hàm tìm vị trí đặt bomb
  findOptimalBombPosition(position) {
    if (!this.mapWidth || typeof this.mapWidth !== 'number' || this.mapWidth <= 0) {
      return null;
    }

    const numRows = Math.floor(this.flatMap.length / this.mapWidth);

    if (position < 0 || position >= this.flatMap.length) {
      console.error('Error: Invalid position index');
      return null;
    }

    // Chuyển vị trí từ chỉ số phẳng (flat index) thành tọa độ 2D
    const startRow = Math.floor(position / this.mapWidth);
    const startCol = position % this.mapWidth;

    // Tọa độ di chuyển tương ứng với DIRECTIONS
    const directions = [
      { dr: 0, dc: -1, move: DIRECTIONS.LEFT }, // Trái
      { dr: 0, dc: 1, move: DIRECTIONS.RIGHT }, // Phải
      { dr: -1, dc: 0, move: DIRECTIONS.UP }, // Lên
      { dr: 1, dc: 0, move: DIRECTIONS.DOWN } // Xuống
    ];

    // BFS: Hàng đợi chứa các trạng thái {row, col, path}
    const queue = [];
    const visited = new Set();

    // Thêm trạng thái bắt đầu vào hàng đợi
    queue.push({ row: startRow, col: startCol, path: '' });
    visited.add(position); // Đánh dấu đã duyệt vị trí bắt đầu

    while (queue.length > 0) {
      const current = queue.shift();
      const { row, col, path } = current;

      // Chuyển tọa độ 2D (row, col) thành index phẳng
      const flatIndex = row * this.mapWidth + col;

      // Nếu tìm thấy Balk (ô giá trị 2), trả về đường đi
      if (this.flatMap[flatIndex] === TILE_TYPE.BALK) {
        // console.log(`Found Balk at row=${row}, col=${col}`);
        return path;
      }

      // Thử tất cả hướng di chuyển
      for (const { dr, dc, move } of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        // Kiểm tra điều kiện hợp lệ của tọa độ mới
        if (newRow >= 0 && newRow < numRows && newCol >= 0 && newCol < this.mapWidth) {
          const newFlatIndex = newRow * this.mapWidth + newCol;

          if (
            !visited.has(newFlatIndex) && // Chưa duyệt qua
            (this.flatMap[newFlatIndex] === TILE_TYPE.ROAD || this.flatMap[newFlatIndex] === TILE_TYPE.BALK) && // Chỉ đi qua Road hoặc Balk
            this.flatMap[newFlatIndex] !== TILE_TYPE.BOMB_ZONE // Tuyệt đối không đi qua BombZone
          ) {
            queue.push({ row: newRow, col: newCol, path: path + move });
            visited.add(newFlatIndex); // Đánh dấu vị trí đã duyệt
          }
        }
      }
    }

    return null;
  }

  // Hàm đặt bomb và di chuyển đến vị trí an toàn
  async placeBombAndRetreat(bombPosition) {
    const playerPosition = this.player.position;
    const neighbors = this.getNeighborNodes(playerPosition);
    const hasBalk = neighbors.some(({ pos }) => this.flatMap[pos] === TILE_TYPE.BALK);
    if (bombPosition) {
      drive(bombPosition);
    }
    if (hasBalk) {
      drive('b');
    }
  }

  // Hàm xác định vùng ảnh hưởng của bomb
  getBombImpactArea(bombPosition) {
    const impactArea = new Set();
    impactArea.add(bombPosition); // Thêm tâm bom vào vùng ảnh hưởng
    const directions = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
    // Duyệt qua từng hướng (Lên, Xuống, Trái, Phải)
    directions.forEach(dir => {
      let currentPos = bombPosition;
      // Tính toán vùng ảnh hưởng trong phạm vi sức mạnh của người chơi
      for (let i = 1; i <= this.player.playerInfo.power; i++) {
        const { x, y } = this.to2dPos(currentPos);
        // Di chuyển theo hướng tương ứng
        let newX = x,
          newY = y;
        if (dir === DIRECTIONS.UP) newY -= 1;
        if (dir === DIRECTIONS.DOWN) newY += 1;
        if (dir === DIRECTIONS.LEFT) newX -= 1;
        if (dir === DIRECTIONS.RIGHT) newX += 1;
        // Chuyển từ tọa độ 2D sang tọa độ 1D
        const newIndex = this.to1dPos(newX, newY);
        // Kiểm tra nếu vị trí nằm ngoài bản đồ
        if (newIndex < 0 || newIndex >= this.flatMap.length) break;
        const cellValue = this.flatMap[newIndex];
        // Nếu gặp khối không thể xuyên qua, dừng lại và không thêm khối đó vào vùng nổ
        if (cellValue !== TILE_TYPE.ROAD && cellValue !== TILE_TYPE.SPOIL) {
          break;
        }
        // Nếu ô hợp lệ, thêm vào vùng nổ
        impactArea.add(newIndex);
        // Di chuyển vị trí hiện tại
        currentPos = newIndex;
      }
    });

    return impactArea;
  }

  async moveTo(path) {
    if (path && path.length > 0) {
      const pathString = path.join(''); // Chuyển path thành chuỗi
      drive(pathString);
      this.isMoving = true; // Đặt trạng thái đang di chuyển
      // Giả lập hoàn tất sau một thời gian tùy thuộc vào độ dài path
      const estimatedTime = path.length * 500; // Giả sử mỗi bước mất 500ms
      setTimeout(() => {
        this.isMoving = false; // Reset trạng thái
        this.currentTarget = null; // Đặt lại mục tiêu
        this.decideNextAction(); // Thực hiện hành động tiếp theo
      }, estimatedTime);
    } else {
      this.isMoving = false;
      this.currentTarget = null; // Đặt lại mục tiêu
      this.decideNextAction(); // Thực hiện hành động tiếp theo
    }
  }

  playerStopNearbyBomb() {
    const playerPosition = this.to2dPos(this.player.position);
    const map = this.convertFlatTo2DMap();

    // Các tọa độ lân cận cần kiểm tra
    const directions = [
      { dx: -1, dy: 0 }, // Trái
      { dx: 1, dy: 0 }, // Phải
      { dx: 0, dy: -1 }, // Lên
      { dx: 0, dy: 1 }, // Xuống
      { dx: -1, dy: -1 }, // Góc trên-trái
      { dx: 1, dy: 1 }, // Góc dưới-phải
      { dx: -1, dy: 1 }, // Góc dưới-trái
      { dx: 1, dy: -1 } // Góc trên-phải
    ];
    if (map[playerPosition.y]?.[playerPosition.x] === TILE_TYPE.BOMB_ZONE) {
      return false;
    }
    // Lặp qua các hướng
    for (const { dx, dy } of directions) {
      const newY = playerPosition.y + dy;
      const newX = playerPosition.x + dx;

      // Kiểm tra nếu vị trí lân cận là vùng bom
      if (map[newY]?.[newX] === TILE_TYPE.BOMB_ZONE) {
        return true;
      }
    }
    return false;
  }

  // kiểm tra vị trí của địch. có nằm trong tầm xả không
  isWithinRadius(centerRow, centerCol, targetRow, targetCol, radius) {
    // Tính khoảng cách Euclidean
    const distance = Math.sqrt(Math.pow(centerRow - targetRow, 2) + Math.pow(centerCol - targetCol, 2));
    // Kiểm tra nếu khoảng cách nằm trong bán kính nhưng không nhỏ hơn 3
    return distance <= radius && distance >= 3;
  }

  // replace vị trí rìu thần thành dranger zone để né. Còn né được hay không thì ..
  updateMapWithICBM(players, replacementValue) {
    players.forEach(player => {
      const { destination, power } = player;
      const centerRow = destination.row;
      const centerCol = destination.col;
      const radius = power;

      // Duyệt qua các hàng trong phạm vi bán kính
      for (let row = centerRow - radius; row <= centerRow + radius; row++) {
        if (row < 0 || row >= this.map.length) continue; // Bỏ qua nếu ngoài giới hạn map

        // Duyệt qua các cột trong phạm vi bán kính
        for (let col = centerCol - radius; col <= centerCol + radius; col++) {
          if (col < 0 || col >= this.map[row].length) continue; // Bỏ qua nếu ngoài giới hạn map

          // Tính khoảng cách Euclidean
          const distance = Math.sqrt(Math.pow(centerRow - row, 2) + Math.pow(centerCol - col, 2));
          if (distance <= radius && (this.map[row][col] === TILE_TYPE.ROAD || this.map[row][col] === TILE_TYPE.SPOIL)) {
            // Thay thế giá trị nếu trong bán kính và giá trị bằng 0
            this.map[row][col] = replacementValue;
          }
        }
      }
    });
    return true;
  }

  // replace vùng nổ thành đất cỏ
  replaceValuesInRadius(centerRow, centerCol, radius, targetValue, newValue) {
    // Duyệt qua các hàng trong phạm vi bán kính
    for (let row = Math.max(0, centerRow - radius); row <= Math.min(this.map.length - 1, centerRow + radius); row++) {
      // Duyệt qua các cột trong phạm vi bán kính
      for (
        let col = Math.max(0, centerCol - radius);
        col <= Math.min(this.map[row].length - 1, centerCol + radius);
        col++
      ) {
        // Kiểm tra nếu nằm trong bán kính bằng khoảng cách Euclidean
        const distance = Math.sqrt(Math.pow(centerRow - row, 2) + Math.pow(centerCol - col, 2));
        if (distance <= radius && this.map[row][col] === targetValue) {
          this.map[row][col] = newValue; // Thay giá trị nếu thỏa mãn
        }
      }
    }
    return true;
  }

  getItem() {
    const playerPosition = this.to2dPos(this.player.position);
    const map = this.convertFlatTo2DMap();
    const startRow = playerPosition.y;
    const startCol = playerPosition.x;
    const radius = 5;

    const directions = [
      { row: 0, col: -1, move: DIRECTIONS.LEFT },
      { row: 0, col: 1, move: DIRECTIONS.RIGHT },
      { row: -1, col: 0, move: DIRECTIONS.UP },
      { row: 1, col: 0, move: DIRECTIONS.DOWN }
    ];

    const rows = map.length;
    const cols = map[0].length;

    const isValid = (row, col, visited) => {
      return (
        row >= 0 &&
        row < rows &&
        col >= 0 &&
        col < cols &&
        (map[row][col] === 0 || map[row][col] === 99) &&
        !visited[row][col]
      );
    };

    const queue = [{ row: startRow, col: startCol, path: '' }]; // Bắt đầu với chuỗi rỗng
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    visited[startRow][startCol] = true;

    while (queue.length > 0) {
      const { row, col, path } = queue.shift();

      // Kiểm tra nếu tìm thấy đích
      if (map[row][col] === 99) {
        return path; // Trả về chuỗi đường đi
      }

      // Duyệt qua các hướng
      for (const { row: dr, col: dc, move } of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        // Tính khoảng cách Euclidean
        const distance = Math.sqrt(Math.pow(newRow - startRow, 2) + Math.pow(newCol - startCol, 2));
        if (distance > radius) continue; // Bỏ qua nếu ngoài bán kính

        if (isValid(newRow, newCol, visited)) {
          visited[newRow][newCol] = true;
          queue.push({ row: newRow, col: newCol, path: path + move }); // Nối hướng di chuyển vào chuỗi
        }
      }
    }

    return null;
  }

  findEscapePath() {
    const playerPosition = this.to2dPos(this.player.position);
    const map = this.convertFlatTo2DMap();
    const startRow = playerPosition.y;
    const startCol = playerPosition.x;
    const radius = 8;
    const directions = [
      { row: 0, col: -1, move: DIRECTIONS.LEFT },
      { row: 0, col: 1, move: DIRECTIONS.RIGHT },
      { row: -1, col: 0, move: DIRECTIONS.UP },
      { row: 1, col: 0, move: DIRECTIONS.DOWN }
    ];

    const rows = map.length;
    const cols = map[0].length;

    // Xác định nếu bắt đầu trong ô 77
    const isIn77 = map[startRow][startCol] === 77;
    const isValid = (row, col, visited) => {
      return (
        row >= 0 &&
        row < rows &&
        col >= 0 &&
        col < cols &&
        ((isIn77 && (map[row][col] === 77 || map[row][col] === 0 || map[row][col] === 99)) ||
          (!isIn77 && (map[row][col] === 0 || map[row][col] === 99))) &&
        !visited[row][col]
      );
    };

    const queue = [{ row: startRow, col: startCol, path: '' }]; // Bắt đầu với chuỗi rỗng
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    visited[startRow][startCol] = true;

    while (queue.length > 0) {
      const { row, col, path } = queue.shift();

      // Kiểm tra nếu tìm thấy đích
      if (map[row][col] === TILE_TYPE.SPOIL || map[row][col] === TILE_TYPE.ROAD) {
        return path; // Trả về chuỗi đường đi
      }

      // Duyệt qua các hướng
      for (const { row: dr, col: dc, move } of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        // Tính khoảng cách Euclidean
        const distance = Math.sqrt(Math.pow(newRow - startRow, 2) + Math.pow(newCol - startCol, 2));
        if (distance > radius) continue; // Bỏ qua nếu ngoài bán kính

        if (isValid(newRow, newCol, visited)) {
          visited[newRow][newCol] = true;
          queue.push({ row: newRow, col: newCol, path: path + move }); // Nối hướng di chuyển vào chuỗi
        }
      }
    }

    return null;
  }
}
