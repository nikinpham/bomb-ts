import { Position } from './game';

export type Player = {
  id: string;
  currentPosition: Position;
  spawnBegin: Position;
  score: number;
  lives: number;
  speed: number;
  power: number;
  delay: number;
  dragonEggSpeed: number;
  dragonEggAttack: number;
  dragonEggDelay: number;
  dragonEggMystic: number;
  pill: number;
  box: number;
  quarantine: number;
  gstEggBeingAttacked: number;
  dragonEggMysticMinusEgg: number;
  dragonEggMysticAddEgg: number;
  dragonEggMysticIsolateGate: number;
};
