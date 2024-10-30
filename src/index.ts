import dotenv from "dotenv";
import express from "express";
import socket from "./server/socket";

dotenv.config();
socket;

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
