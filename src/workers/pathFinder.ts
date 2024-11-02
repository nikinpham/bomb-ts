import { parentPort } from 'worker_threads';
import { FindPathData, Position } from '../types';

const findPath = (
  start: Position,
  end: Position,
  obstacles: Position[]
): Position[] => {
  console.log(start, end, obstacles);
  return [];
};

parentPort?.on('message', (data: FindPathData): void => {
  const path = findPath(data.start, data.end, data.obstacles);
  parentPort?.postMessage(path);
});
