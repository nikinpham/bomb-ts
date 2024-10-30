import dotenv from "dotenv";
import express from "express";
import socket from "./server/socket";

dotenv.config();
socket;

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.SOCKET_URL || "http://localhost";

app.listen(PORT, () => {
  console.log(`Express server running on ${HOST}:${PORT}`);
});
