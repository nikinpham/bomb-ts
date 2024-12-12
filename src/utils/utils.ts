import { ACTIONS, EMITS, TILE_TYPE } from '../constants';
import { Bomb, Maps, Player, Position } from '../types';
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

export const drive = (direction: string | null) => {
  direction &&
    socket.emit(EMITS.DRIVE, {
      direction
    });
};

export const bombSetup = (facedDirection?: string | null) => `${facedDirection ?? ''}b`;

// export const isHaveWedding = (playerInformation: Player) => {
//   return false;
// };

export const getPositionsWithValue = (map: Maps, value: number) => {
  const positions = [];

  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      if (map[row][col] === value) {
        positions.push({ row, col });
      }
    }
  }

  return positions;
};

export const onSwitchWeapon = () => {
  socket.emit(EMITS.ACTIONS, {
    action: ACTIONS.SWITCH_WEAPON
  });
};
export const onWedding = () => {
  socket.emit(EMITS.ACTIONS, {
    action: ACTIONS.MARRY_WIFE
  });
};

export const updateMapsWithDangerZone = (
  updatedMap: Maps,
  bombs: Bomb[]
): { updatedMap: Maps; dangerZones: Position[] } => {
  const limitTile = [TILE_TYPE.WALL, TILE_TYPE.PRISON_PLACE, TILE_TYPE.BALK, TILE_TYPE.BRICK_WALL];
  const dangerZones: Position[] = []; // Array to store danger zone positions

  // Helper function to mark danger zones in a specific direction
  const markDangerZone = (startRow: number, startCol: number, deltaRow: number, deltaCol: number, power: number) => {
    for (let i = 1; i <= power; i++) {
      const newRow = startRow + i * deltaRow;
      const newCol = startCol + i * deltaCol;

      if (
        newRow >= 0 &&
        newRow < updatedMap.length &&
        newCol >= 0 &&
        newCol < updatedMap[newRow].length &&
        !limitTile.includes(updatedMap[newRow][newCol])
      ) {
        if (updatedMap[newRow][newCol] !== TILE_TYPE.BOMB_ZONE) {
          updatedMap[newRow][newCol] = TILE_TYPE.BOMB_ZONE;
          dangerZones.push({ row: newRow, col: newCol });
        }
      } else break;
    }
  };

  bombs.forEach((bomb: Bomb) => {
    const { row, col, power } = bomb;

    // Mark danger zones in all four directions
    markDangerZone(row, col, 0, -1, power); // Left
    markDangerZone(row, col, 0, 1, power); // Right
    markDangerZone(row, col, -1, 0, power); // Up
    markDangerZone(row, col, 1, 0, power); // Down

    // Mark the bomb's position
    if (updatedMap[row][col] !== TILE_TYPE.BOMB_ZONE) {
      updatedMap[row][col] = TILE_TYPE.BOMB_ZONE;
      dangerZones.push({ row, col });
    }
  });

  return { updatedMap, dangerZones };
};
