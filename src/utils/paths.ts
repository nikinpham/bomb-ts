import { Maps, Position, PositionWithValue } from '../types';

export const getDirection = (current: Position, next: Position): string => {
  if (current.row === next.row && current.col > next.col) return '1'; //  RIGHT
  if (current.row === next.row && current.col < next.col) return '2'; //  LEFT
  if (current.col === next.col && current.row > next.row) return '3'; //  UP
  if (current.col === next.col && current.row < next.row) return '4'; //  DOWN
  return 'x'; // Stop or invalid move
};

export const getPathToNearestItems = (
  maps: Maps,
  limitTile: number[],
  start: Position,
  goals: Position[]
): PositionWithValue[] | null => {
  const rows = maps.length;
  const cols = maps[0].length;

  // Priority queue for Dijkstra
  const queue: { position: Position; cost: number; path: PositionWithValue[] }[] = [
    {
      position: start,
      cost: maps[start.row][start.col],
      path: [{ ...start, value: maps[start.row][start.col] }]
    }
  ];

  const visited = new Set<string>();
  visited.add(`${start.row},${start.col}`);

  while (queue.length > 0) {
    // Sort queue by cost to always process the least-cost path first
    queue.sort((a, b) => a.cost - b.cost);
    const { position, cost, path } = queue.shift()!;

    // Check if the current position is one of the goals
    for (const goal of goals) {
      if (position.row === goal.row && position.col === goal.col) {
        return path; // Return the full path with values to the goal
      }
    }

    // Explore neighbors (No diagonal movements)
    const directions = [
      { row: 0, col: 1 }, // Right
      { row: 0, col: -1 }, // Left
      { row: 1, col: 0 }, // Down
      { row: -1, col: 0 } // Up
    ];

    for (const dir of directions) {
      const newRow = position.row + dir.row;
      const newCol = position.col + dir.col;

      // Check bounds
      if (
        newRow >= 0 &&
        newRow < rows &&
        newCol >= 0 &&
        newCol < cols &&
        !visited.has(`${newRow},${newCol}`) &&
        !limitTile.includes(maps[newRow][newCol])
      ) {
        visited.add(`${newRow},${newCol}`);

        // Add new position to the queue with updated cost and path
        queue.push({
          position: { row: newRow, col: newCol },
          cost: cost + maps[newRow][newCol], // Accumulate the total cost
          path: [...path, { col: newCol, row: newRow, value: maps[newRow][newCol] }]
        });
      }
    }
  }

  return null; // No goal found
};

export const convertRawPath = (rawPath: PositionWithValue[]): string | null => {
  // Check if rawPath is empty or has less than 2 positions
  if (!rawPath || rawPath.length < 2) return null;

  let directions = '';

  for (let i = 0; i < rawPath.length - 1; i++) {
    const current = rawPath[i];
    const next = rawPath[i + 1];
    const direction = getDirection(current, next);
    if (next.value === 3) {
      return directions;
    }
    directions += direction;
  }

  return directions;
};
