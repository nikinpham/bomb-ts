import { Directions } from '../types';

export enum TILE_TYPE {
  ROAD = 0,
  WALL = 1,
  BALK = 2,
  BRICK_WALL = 3,
  PRISON_PLACE = 5,
  GOD_BADGE = 6,
  DESTROYED_CELL = 7
}

// 1 - Move LEFT
// 2 - Move RIGHT.
// 3 - Move UP
// 4 - Move DOWN
// b - Drop BOMB
// x - Stop Moving
// export const DIRECTIONS: Directions = [
//   [0, -1, '1'],
//   [0, 1, '2'],
//   [-1, 0, '3'],
//   [1, 0, '4']
// ];

export enum EMITS {
  JOIN_GAME = 'join game',
  DRIVE = 'drive player',
  SPEAK = 'player speak',
  UPDATE = 'ticktack player',
  REGISTER_CHARACTER_POWER = 'register character power',
  ACTIONS = 'action'
}

export enum ACTIONS {
  SWITCH_WEAPON = 'switch weapon',
  USE_WEAPON = 'use weapon',
  MARRY_WIFE = 'marry wife'
}

export enum GAME_MODE {
  SAFE = 'SAFE',
  COLLECT_BADGE = 'COLLECT_BADGE',
  ATTACK_GOAL = 'ATTACK_GOAL',
  KILLER = 'KILLER'
}

export const PLAYER_ID = 'player1-xxx';

export enum WEAPON {
  WOODEN_PESTLE = 1,
  BOMB = 2
}

export enum FACE_DIRECTIONS {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  UP = 'UP',
  DOWN = 'DOWN'
}
