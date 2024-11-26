import { Maps, Position } from '../types';
import { TILE_TYPE } from '../constants';

export const getDirection = (current: Position, next: Position): string => {
  if (current.col === next.col && current.row < next.row) return '4'; //  DOWN
  if (current.col === next.col && current.row > next.row) return '3'; //  UP

  if (current.row === next.row && current.col < next.col) return '2'; //  LEFT
  if (current.row === next.row && current.col > next.col) return '1'; //  RIGHT
  return 'x'; // Stop or invalid move
};

export const pathToDirection = (path: Position[] | null, valueFromMaps: number[]): string => {
  let directions = '';

  // Early exit if path is null, returning an empty string
  if (path === null || path.length === 1) {
    return directions;
  }

  // Loop through the path and convert each segment to a direction
  for (let i = 0; i < path.length - 1; i++) {
    const movement = getDirection(path[i], path[i + 1]);
    if (valueFromMaps[i] === 0 && valueFromMaps[i + 1] !== 0) {
      return directions + 'b';
    }
    directions += movement;
  }
  return directions;
};

export const getValuesFromMap = (map: Maps, positions: Position[]): number[] => {
  const values: number[] = [];

  for (const position of positions) {
    const { col, row } = position;
    if (map[row] && map[row][col] !== undefined) {
      values.push(map[row][col]);
    }
  }

  return values;
};
