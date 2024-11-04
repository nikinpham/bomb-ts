import { start } from 'node:repl';

export type Position = {
  row: number;
  col: number;
};
export type Directions = [number, number, string][];

export type Maps = number[][];

export type Map = {
  cols: number;
  rows: number;
};

export type Bomb = {
  row: number;
  col: number;
  remainTime: number;
  playerId: string;
  power: number;
};

export type Spoil = {
  row: number;
  col: number;
  spoil_type: number;
  // Values of spoil types: 				Bonus:
  // 32 - STICKY RICE								1 score
  // 33 - Chung Cake								2 score
  // 34 - Nine Tusk Elephant				5 points (increases power by 1 unit)
  // 35 - Nine Spur Rooster					3 score
  // 36 - Nine Mane Hair Horse			4 score
  // 37 - Holy Spirit Stone					3 score
};

export type WeaponHammer = {
  playerId: string;
  power: number;
  destination: Position;
};

export type WeaponWinds = {
  playerId: string;
  currentRow: number;
  currentCol: number;
  power: number;
  destination: Position;
};

export enum TAGS {
  //  Player's tag values
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
