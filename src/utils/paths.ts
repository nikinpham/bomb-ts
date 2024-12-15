import { Maps, Position, PositionWithValue } from '../types';
import { ACTIONS, DIRECTIONS, TILE_TYPE } from '../constants';

export const findEscapePath = (maps: Maps, start: Position) => {
  const numRows = maps.length;
  const numCols = maps[0].length;
  const visited = Array.from({ length: numRows }, () => Array(numCols).fill(false));

  const queue: any = [{ row: start.row, col: start.col, path: '' }];
  visited[start.row][start.col] = true;

  while (queue.length > 0) {
    const { row, col, path } = queue.shift();

    if (maps[row][col] === TILE_TYPE.ROAD) {
      return path;
    }

    for (const dir of DIRECTIONS) {
      const newRow = row + dir.row;
      const newCol = col + dir.col;

      if (
        newRow >= 0 &&
        newRow < numRows &&
        newCol >= 0 &&
        newCol < numCols &&
        !visited[newRow][newCol] &&
        maps[newRow][newCol] !== TILE_TYPE.WALL &&
        maps[newRow][newCol] !== TILE_TYPE.PRISON_PLACE &&
        maps[newRow][newCol] !== TILE_TYPE.BALK &&
        maps[newRow][newCol] !== TILE_TYPE.BRICK_WALL
      ) {
        queue.push({
          row: newRow,
          col: newCol,
          path: path + dir.move
        });
        visited[newRow][newCol] = true;
      }
    }
  }

  return null;
};

export const findPathToNearestItems = (maps: Maps, limitTile: number[], start: Position, goals: Position[]) => {
  const rows = maps.length;
  const cols = maps[0].length;

  const queue: { position: Position; cost: number; path: PositionWithValue[] }[] = [
    {
      position: start,
      cost: maps[start.row][start.col],
      path: [{ ...start, value: maps[start.row][start.col], move: null }]
    }
  ];

  const visited = new Set<string>();
  visited.add(`${start.row},${start.col}`);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { position, cost, path } = queue.shift()!;

    for (const goal of goals) {
      if (position.row === goal.row && position.col === goal.col) {
        return path;
      }
    }

    for (const dir of DIRECTIONS) {
      const newRow = position.row + dir.row;
      const newCol = position.col + dir.col;

      if (
        newRow >= 0 &&
        newRow < rows &&
        newCol >= 0 &&
        newCol < cols &&
        !visited.has(`${newRow},${newCol}`) &&
        !limitTile.includes(maps[newRow][newCol])
      ) {
        visited.add(`${newRow},${newCol}`);
        queue.push({
          position: { row: newRow, col: newCol },
          cost: cost + maps[newRow][newCol],
          path: [...path, { col: newCol, row: newRow, value: maps[newRow][newCol], move: dir.move }]
        });
      }
    }
  }

  return null;
};

export const findPathToTargets = (maps: Maps, limitTile: number[], start: Position, goals: Position[]) => {
  const rawPath = findPathToNearestItems(maps, limitTile, start, goals);
  const stoppingPath: string[] = [];
  if (rawPath) {
    for (const step of rawPath) {
      step.move && stoppingPath.push(step.move);

      if (step.value === TILE_TYPE.BRICK_WALL) {
        return { action: ACTIONS.RUNNING, path: stoppingPath.join('') };
      }
    }
    return { action: ACTIONS.RUNNING, path: stoppingPath.join('') };
  }
  return { action: ACTIONS.NO_ACTION, path: null };
};
