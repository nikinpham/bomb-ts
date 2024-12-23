import { Bomb, Maps, Spoil, WeaponPlace } from './game';
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
    weaponPlaces: WeaponPlace[];
    cellSize: number;
  };
  tag: string;
  gameRemainTime: number;
  player_id: string;
};

export type DrivePlayerResponse = {
  direction: string;
  player_id: string;
};
