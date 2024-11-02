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

export type Spoil = {
  row: number;
  col: number;
  spoil_type: number;
};

export type Bomb = {
  row: number;
  col: number;
  remain_time: number;
  playerId: string;
};

export type Goal = { row: number; col: number; player_id: string };
