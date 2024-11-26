import { TILE_TYPE } from '../constants';

export const bfsFindWeight = ({
  maps,
  startX,
  startY,
  tileType
}: {
  maps: number[][];
  startX: number;
  startY: number;
  tileType: number;
}): { x: number; y: number } | null => {
  const queue: [number, number][] = [[startX, startY]];
  const visited: Set<string> = new Set([`${startX},${startY}`]);
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0]
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;

    if (maps[y] && maps[y][x] === tileType) {
      if (tileType === TILE_TYPE.BALK) {
        for (const [dx, dy] of directions) {
          const px = x - dx;
          const py = y - dy;
          if (
            px >= 0 &&
            px < maps[0].length &&
            py >= 0 &&
            py < maps.length &&
            maps[py][px] !== tileType &&
            maps[py][px] !== TILE_TYPE.WALL &&
            visited.has(`${px},${py}`)
          ) {
            return { x: px, y: py };
          }
        }
      }
      return { x, y };
    }

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (
        nx >= 0 &&
        nx < maps[0].length &&
        ny >= 0 &&
        ny < maps.length &&
        !visited.has(key) &&
        maps[ny][nx] !== TILE_TYPE.WALL
      ) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  return null; // Trả về null nếu không tìm thấy tileType
};
