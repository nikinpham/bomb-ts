export enum TILE_TYPE {
  ROAD = 0,
  WALL = 1,
  BALK = 2,
  BRICK_WALL = 3,
  PRISON_PLACE = 5,
  GOD_BADGE = 6,
  DESTROYED_CELL = 7
}

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
  COLLECT_BADGE = 'COLLECT_BADGE',
  COLLECT_SPOIL = 'COLLECT_SPOIL',
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

export const EARLY_GAME_TILE_LIMIT = [TILE_TYPE.WALL, TILE_TYPE.PRISON_PLACE, TILE_TYPE.BALK, TILE_TYPE.DESTROYED_CELL];
