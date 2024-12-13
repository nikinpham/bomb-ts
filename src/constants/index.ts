export enum TILE_TYPE {
  ROAD = 0,
  WALL = 1,
  BALK = 2,
  BRICK_WALL = 3,
  PRISON_PLACE = 5,
  GOD_BADGE = 6,
  DESTROYED_CELL = 7,
  BOMB_ZONE = 69
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
  KILLER = 'KILLER'
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

export const EARLY_GAME_TILE_LIMIT = [TILE_TYPE.WALL, TILE_TYPE.PRISON_PLACE, TILE_TYPE.BALK, TILE_TYPE.DESTROYED_CELL];
export const COLLECT_SPOIL_LIMIT = [
  TILE_TYPE.WALL,
  TILE_TYPE.PRISON_PLACE,
  TILE_TYPE.BRICK_WALL,
  TILE_TYPE.DESTROYED_CELL,
  TILE_TYPE.BOMB_ZONE
];

export const SAFE_PATH_LIMIT = [
  TILE_TYPE.WALL,
  TILE_TYPE.PRISON_PLACE,
  TILE_TYPE.BRICK_WALL,
  TILE_TYPE.DESTROYED_CELL,
  TILE_TYPE.BALK
];
