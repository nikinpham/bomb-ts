export enum TILE_TYPE {
  ROAD = 0,
  WALL = 1,
  BALK = 2,
  BRICK_WALL = 3,
  PRISON_PLACE = 5,
  GOD_BADGE = 6,
  DESTROYED_CELL = 7,
  ENEMY = 9,
  BOMB_ZONE = 10,
  SPOIL = 0.5
}

export enum MOVE_DIRECTION {
  LEFT = '1',
  RIGHT = '2',
  UP = '3',
  DOWN = '4',
  STOP = 'x',
  BOMB = 'b'
}

export const DIRECTIONS = [
  { row: 0, col: 1, move: '2' }, // Right
  { row: 0, col: -1, move: '1' }, // Left
  { row: 1, col: 0, move: '4' }, // Down
  { row: -1, col: 0, move: '3' } // Up
];

export enum EMITS {
  JOIN_GAME = 'join game',
  DRIVE = 'drive player',
  SPEAK = 'player speak',
  UPDATE = 'ticktack player',
  REGISTER_CHARACTER_POWER = 'register character power',
  ACTIONS = 'action'
}

export enum EMIT_ACTIONS {
  SWITCH_WEAPON = 'switch weapon',
  USE_WEAPON = 'use weapon',
  MARRY_WIFE = 'marry wife'
}

export enum ACTIONS {
  RUNNING = 'RUNNING',
  HIT = 'HIT',
  MARRY = 'MARRY',
  NO_ACTION = 'NO_ACTION',
  WAITING = 'WAITING',
  BOMBED = 'BOMBED',
  USE_SPECIAL_SKILL = 'USE_SPECIAL_SKILL'
}

export enum WEAPON {
  WOODEN_PESTLE = 1,
  BOMB = 2
}

export enum TAGS {
  //  Player's tag values
  PLAYER_TRANSFORMED = 'player:transformed',
  PLAYER_MOVING_BANNED = 'player:moving-banned',
  PLAYER_START_MOVING = 'player:start-moving',
  PLAYER_STOP_MOVING = 'player:stop-moving',
  PLAYER_BE_ISOLATED = 'player:be-isolated',
  PLAYER_BACK_TO_PLAYGROUND = 'player:back-to-playground',
  PLAYER_PICK_SPOIL = 'player:pick-spoil',
  PLAYER_STUN_BY_WEAPON = 'player:stun-by-weapon',
  PLAYER_STUN_TIMEOUT = 'player:stun-timeout',

  //  Bomb's tag values
  BOMB_EXPLODED = 'bomb:exploded',
  BOMB_SETUP = 'bomb:setup',

  //  Game's tag values
  START_GAME = 'start-game',
  UPDATE_DATA = 'update-data',

  //  Wedding's tag values
  PLAYER_INTO_WEDDING_ROOM = 'player:into-wedding-room',
  PLAYER_OUTTO_WEDDING_ROOM = 'player:outto-wedding-room',
  PLAYER_COMPLETED_WEDDING = 'player:completed-wedding',

  //  Hammer's tag values
  HAMMER_EXPLODED = 'hammer:exploded',

  //  Wooden-pestle tag values
  WOODEN_PESTLE_SETUP = 'wooden-pestle:setup',

  //  WeaponWind's tag values
  WIND_EXPLODED = 'wind:exploded'
}

export const LIMIT_FULL = [
  TILE_TYPE.WALL,
  TILE_TYPE.PRISON_PLACE,
  TILE_TYPE.BRICK_WALL,
  TILE_TYPE.BALK,
  TILE_TYPE.DESTROYED_CELL,
  TILE_TYPE.BOMB_ZONE,
  TILE_TYPE.ENEMY
];

export const LIMIT_WITHOUT_BRICK = [TILE_TYPE.WALL, TILE_TYPE.PRISON_PLACE, TILE_TYPE.BALK, TILE_TYPE.DESTROYED_CELL];
export const COLLECT_SPOIL_LIMIT = [
  TILE_TYPE.WALL,
  TILE_TYPE.PRISON_PLACE,
  TILE_TYPE.BRICK_WALL,
  TILE_TYPE.DESTROYED_CELL
];

export const SAFE_PATH_LIMIT = [
  TILE_TYPE.WALL,
  TILE_TYPE.PRISON_PLACE,
  TILE_TYPE.BRICK_WALL,
  TILE_TYPE.DESTROYED_CELL,
  TILE_TYPE.BALK
];
