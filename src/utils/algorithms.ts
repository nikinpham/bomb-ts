import { Position } from '../types';

export const manhattanDistance = (a: Position, b: Position) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
