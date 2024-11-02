import { Bomb, Goal, Maps, Spoil } from './game';
import { Player } from './player';

export type TickTackResponse = {
  id: number;
  timestamp: Date;
  map_info: {
    size: {
      cols: number;
      rows: number;
    };
    players: Player[];
    map: Maps;
    bombs: Bomb[];
    spoils: Spoil[];
    gameStatus: string | null;
    dragonEggGSTArray: Goal[];
  };
  tag: string;
  gameRemainTime: number;
};
