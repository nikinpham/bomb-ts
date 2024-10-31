declare type TPosition = {
  row: number;
  col: number;
};
declare type TDirections = [number, number, string][];

declare type TMaps = number[][];

declare type TSpoil = {
  row: number;
  col: number;
  spoil_type: number;
};

declare type TSpoils = TSpoil[];

declare type TBomb = {
  row: number;
  col: number;
  remain_time: number;
  playerId: string;
};

declare type TBombs = TBomb[];
