import { MOVE_DIRECTION, TILE_TYPE } from '../constants';
import { Maps, Position, Spoil } from '../types';

export const getDirection = (current: Position, next: Position): string => {
  if (current.row === next.row && current.col > next.col) return '1'; //  RIGHT
  if (current.row === next.row && current.col < next.col) return '2'; //  LEFT
  if (current.col === next.col && current.row > next.row) return '3'; //  UP
  if (current.col === next.col && current.row < next.row) return '4'; //  DOWN
  return 'x'; // Stop or invalid move
};

export const findAllItemsByType = (maps: Maps, type: number): Position[] => {
  const positions: Position[] = [];
  maps.forEach((row, rowIndex) => {
    if (row.includes(type)) {
      row.forEach((cell, colIndex) => {
        if (cell === type) {
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

export const checkTargetOpposite = (maps: Maps, position: Position, target: number, currentSide: string) => {
  const { row, col } = position;
  switch (currentSide) {
    case MOVE_DIRECTION.LEFT:
      console.log(row, col - 1);
      return maps[row]?.[col - 1] === target; // Kiểm tra ô bên trái
    case MOVE_DIRECTION.RIGHT:
      return maps[row]?.[col + 1] === target; // Kiểm tra ô bên phải
    case MOVE_DIRECTION.UP:
      return maps[row - 1]?.[col] === target; // Kiểm tra ô phía trên
    case MOVE_DIRECTION.DOWN:
      return maps[row + 1]?.[col] === target; // Kiểm tra ô phía dưới
    default:
      return false; // Nếu không thuộc hướng nào, trả về false
  }
};
