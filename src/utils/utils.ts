import { EMITS, TILE_TYPE } from '../constants';
import { Maps, Position } from '../types';
import { socket } from '../server';

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

export const drive = (direction: string) => {
  socket.emit(EMITS.DRIVE, {
    direction
  });
};

export const bombSetup = (faced?: string) => `${faced ?? ''}b`;
