import { Bomb, Goal, Map, Maps, Player, Spoil } from '../types';

class GameState {
  private static gameRemainTime: number = 0;
  private static mapSize: Map;
  private static dragonEggs: {
    row: number;
    col: number;
    player_id: string;
  }[] = [];
  private static players: { [id: string]: Player } = {};
  private static bombs: Bomb[] = [];
  private static spoils: Spoil[] = [];
  private static maps: Maps = [];
  private static tag: string = '';

  static setGameRemainTime(time: number) {
    if (this.gameRemainTime === time) return;
    this.gameRemainTime = time;
  }

  static setMapSize(cols: number, rows: number) {
    if (
      this.mapSize &&
      this.mapSize.cols === cols &&
      this.mapSize.rows === rows
    ) {
      return;
    }
    this.mapSize = { cols, rows };
  }

  static setDragonEggs(dragonEggs: Goal[]) {
    if (
      this.dragonEggs.length === dragonEggs.length &&
      this.dragonEggs.every(
        (egg, index) =>
          egg.row === dragonEggs[index].row &&
          egg.col === dragonEggs[index].col &&
          egg.player_id === dragonEggs[index].player_id
      )
    ) {
      return;
    }
    this.dragonEggs = dragonEggs;
  }

  static updateTag(tag: string) {
    if (this.tag === tag) return;
    this.tag = tag;
    console.log('[TAG]: ', this.tag);
  }

  static updatePlayerStats(player: Player) {
    this.players[player.id] = { ...player };
  }

  static updateSpoils(spoils: Spoil[]) {
    if (
      this.spoils.length === spoils.length &&
      this.spoils.every(
        (spoil, index) =>
          spoil.row === spoils[index].row &&
          spoil.col === spoils[index].col &&
          spoil.spoil_type === spoils[index].spoil_type
      )
    ) {
      return;
    }

    this.spoils = spoils;
    console.log('[SPOILS]: ', spoils);
  }

  static updateBombs(bombs: Bomb[]) {
    if (
      this.bombs.length === bombs.length &&
      this.bombs.every(
        (bomb, index) =>
          bomb.row === bombs[index].row &&
          bomb.col === bombs[index].col &&
          bomb.remain_time === bombs[index].remain_time &&
          bomb.playerId === bombs[index].playerId
      )
    ) {
      return;
    }

    this.bombs = bombs;
    console.log('[BOMBS_UPDATED]');
  }

  static updateMaps(maps: Maps) {
    if (
      this.maps.length === maps.length &&
      this.maps.every(
        (row, rowIndex) =>
          row.length === maps[rowIndex].length &&
          row.every(
            (cell: number, colIndex: number) =>
              cell === maps[rowIndex][colIndex]
          )
      )
    ) {
      return;
    }
    this.maps = maps;
    console.log('[MAP_UPDATED]');
  }

  // static addBomb(playerId: string): Bomb | null {
  //   const player = this.players[playerId];
  //   if (!player) return null;
  //   //
  //   // const bomb: Bomb = {
  //   //   // id: playerId,
  //   //   // position: { ...player.currentPosition },
  //   //   // timer: 3000, // Bom sẽ nổ sau 3 giây
  //   //   // range: 2 // Phạm vi nổ của bom
  //   // };
  //
  //   // this.bombs.push(bomb);
  //   // return bomb;
  //   return null;
  // }

  // static explodeBomb(bomb: Bomb) {
  //   return {
  //     // position: bomb.position,
  //     // affectedArea: this.calculateExplosionArea(bomb.position, bomb.range)
  //   };
  // }

  // private static calculateExplosionArea(
  //   position: Position,
  //   range: number
  // ): Position[] {
  //   const area: Position[] = [];
  //   for (let i = 1; i <= range; i++) {
  //     // area.push({ x: position.x + i, y: position.y });
  //     // area.push({ x: position.x - i, y: position.y });
  //     // area.push({ x: position.x, y: position.y + i });
  //     // area.push({ x: position.x, y: position.y - i });
  //   }
  //   return area;
  // }
}

export default GameState;
