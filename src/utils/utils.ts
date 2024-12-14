import { TILE_TYPE } from '../constants';
import { Maps, Position, Spoil } from '../types';

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

export const isWithinRadius = (playerPosition: Position, spoils: Spoil[], radius: number) => {
  return spoils.filter(spoil => {
    const distance = Math.abs(playerPosition.row - spoil.row) + Math.abs(playerPosition.col - spoil.col);
    return distance <= radius;
  });
};

export const hasValueThree = (position: Position, maps: Maps) => {
  const { row, col } = position;
  return (
    maps[row + 1]?.[col] === TILE_TYPE.BRICK_WALL ||
    maps[row - 1]?.[col] === TILE_TYPE.BRICK_WALL ||
    maps[row]?.[col + 1] === TILE_TYPE.BRICK_WALL ||
    maps[row]?.[col - 1] === TILE_TYPE.BRICK_WALL
  );
};
