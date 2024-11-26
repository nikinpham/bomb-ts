import { Position } from './game';

export type Player = {
  id: string;
  currentPosition: Position;
  spawnBegin: Position;
  score: number;
  lives: number;
  transformType: number;
  ownerWeapon: number[];
  currentWeapon: number;
  hasTransform: boolean;
  timeToUseSpecialWeapon: number;
  isStun: boolean;
  speed: number;
  power: number;
  delay: number;
  box: number;
  stickyRice: number;
  chungCake: number;
  nineTuskElephant: number;
  nineSpurRooster: number;
  nineManeHairHorse: number;
  holySpiritStone: number;
  eternalBadge: number;
  brickWall: number;
};
