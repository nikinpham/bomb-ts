import { Position } from './game';

export type FindPathData = {
  start: Position;
  end: Position;
  obstacles: Position[];
};
