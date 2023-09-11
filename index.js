import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';

import Game from './Game.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);
const port = process.env.PORT || 3000;

let games = {}

let g = new Game(12345);
console.log(JSON.stringify(g, null, 2));

app.get('/', (req, res) => {
  res.send('Hello, Express with ES6!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
