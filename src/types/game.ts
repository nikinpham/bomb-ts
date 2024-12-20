export type Position = {
  row: number;
  col: number;
};

export type PositionWithValue = Position & { value: number; move: string | null };
export type Directions = [number, number, string][];

export type Maps = number[][];
export type FlatMap = number[];

export type Map = {
  cols: number;
  rows: number;
};

export type Bomb = Position & {
  remainTime: number;
  playerId: string;
  power: number;
  createdAt: number;
  row: number;
  col: number;
};

export type Spoil = Position & {
  spoil_type: number;
  // Values of spoil types: 				Bonus:
  // 32 - STICKY RICE								1 score
  // 33 - Chung Cake								2 score
  // 34 - Nine Tusk Elephant				5 points (increases power by 1 unit)
  // 35 - Nine Spur Rooster					3 score
  // 36 - Nine Mane Hair Horse			4 score
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

export type TreeNode = {
  val: number;
  dir: string | null;
  parent: TreeNode | null;
  boxes: number;
  isolatedBoxes: number;
  distance: number;
  bonusPoints: number;
  playerFootprint: boolean;
  children: TreeNode[];
};
