import { Maps, Position } from '../types';
import { DIRECTIONS, TILE_TYPE } from '../constants';

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
