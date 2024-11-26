import { FACE_DIRECTIONS, TILE_TYPE } from '../constants';
import { Maps, Position } from '../types';
// import { PathfindingPoint } from 'pathfinding-worker';

export const findGodBadges = (maps: Maps): Position[] => {
  const positions: Position[] = [];

  maps.forEach((row, rowIndex) => {
    if (row.includes(TILE_TYPE.GOD_BADGE)) {
      row.forEach((cell, colIndex) => {
        if (cell === TILE_TYPE.GOD_BADGE) {
          positions.push({ row: rowIndex, col: colIndex });
        }
      });
    }
  });

  return positions;
};

export const getFacedDirection = (from: Position, to: Position) => {
  if (from.row === to.row && from.col > to.col) return FACE_DIRECTIONS.LEFT; // Left
  if (from.row === to.row && from.col < to.col) return FACE_DIRECTIONS.RIGHT; // Right
  if (from.col === to.col && from.row > to.row) return FACE_DIRECTIONS.UP; // Up
  return FACE_DIRECTIONS.DOWN;
};

export const setWeight = (cell: number): number => {
  switch (cell) {
    case TILE_TYPE.WALL:
    case TILE_TYPE.PRISON_PLACE:
      return 1;
    case TILE_TYPE.GOD_BADGE:
      return 0.5;
    default:
      return TILE_TYPE.ROAD;
  }
};

// export const setWeightWithoutWeight = (cell: number): number => {
//   switch (cell) {
//     case TILE_TYPE.WALL:
//     case TILE_TYPE.PRISON_PLACE:
//     case TILE_TYPE.BALK:
//       return 1;
//     case TILE_TYPE.BRICK_WALL:
//       return 5;
//     default:
//       return TILE_TYPE.ROAD;
//   }
// };
//
// export const convertPathToPositions = (paths: PathfindingPoint[] | null): Position[] => {
//   return paths?.map(({ x, y }) => ({ col: x, row: y })) || [];
// };
