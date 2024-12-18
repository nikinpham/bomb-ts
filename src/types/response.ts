import { Bomb, Maps, Spoil } from './game';
import { Player } from './player';

export type TempoGameState = {
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
    weaponHammers: number[];
    cellSize: number;
  };
  tag: string;
  gameRemainTime: number;
};
