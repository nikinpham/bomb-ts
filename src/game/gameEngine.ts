import { JoinGameState } from "../interfaces";

class GameEngine {
  static start(res: JoinGameState) {
    console.log("[GAME_PLAY]: Start", res);
  }
  static stop() {
    console.log("[GAME_PLAY]: Stop");
  }
  static update(res: any) {
    console.log("[GAME_PLAY]: Update", res);
  }
  static drive(res: any) {
    console.log("[GAME_PLAY]: Drive", res);
  }
}

export default GameEngine;
