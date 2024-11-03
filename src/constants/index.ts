import { Directions } from '../types';

export enum TILE_TYPE {
  ROAD = 0,
  WALL = 1,
  BALK = 2,
  TELEPORT_GATE = 3,
  QUARANTINE_AREA = 4,
  DRAGON_EGG = 5,
  MYSTIC = 6
}

// 1 - Move LEFT
// 2 - Move RIGHT.
// 3 - Move UP
// 4 - Move DOWN
// b - Drop BOMB
// x - Stop Moving
export const DIRECTIONS: Directions = [
  [0, -1, '1'],
  [0, 1, '2'],
  [-1, 0, '3'],
  [1, 0, '4']
];

export enum EMITS {
  JOIN_GAME = 'join game',
  DRIVE = 'drive player',
  SPEAK = 'player speak',
  UPDATE = 'ticktack player'
}

export enum GAME_MODE {
  SAFE = 'SAFE',
  ATTACK_GOAL = 'ATTACK_GOAL',
  KILLER = 'KILLER'
}
