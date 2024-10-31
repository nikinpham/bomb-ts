declare type TTickTackResponse = {
  id: number;
  timestamp: Date;
  map_info: {
    size: {
      cols: number;
      rows: number;
    };
    players: IPlayer[];
    map: TMaps;
    bombs: TBombs;
    spoils: TSpoils;
    gameStatus: string | null;
    dragonEggGSTArray: {
      row: number;
      col: number;
      id: string;
    }[];
  };
  tag: string;
  gameRemainTime: number;
};
