import { io as ClientIO, Socket } from "socket.io-client";
import dotenv from "dotenv";
import GameEngine from "../game/gameEngine";

dotenv.config();

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost";

const socket: Socket = ClientIO(SOCKET_URL, {
  transports: ["websocket"],
  reconnection: true,
});

socket.on("connect", () => {
  console.log(`[SOCKET_LOG] Connected to server with Socket ID: ${socket.id}`);
  socket.emit("join game", {
    game_id: process.env.GAME_ID,
    player_id: process.env.PLAYER_ID,
  });
});

socket.on("disconnect", () => {
  console.log(
    `[SOCKET_LOG] Disconnected to server with Socket ID: ${socket.id}`
  );
});

// socket.on("connect_failed", () => {
//   console.warn("[SOCKET_LOG] Connect Failed to server.");
// });

socket.on("error", (err) => {
  console.error(`[SOCKET_LOG] Error: ${err}`);
});

socket.on("join game", (res) => {
  GameEngine.start(res);
});

socket.on("ticktack player", (res) => {
  GameEngine.update(res);
});

socket.on("drive player", (res) => {
  GameEngine.drive(res);
});

export default socket;
