import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';

import Game from './Game.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);
const port = process.env.PORT || 3000;

let games = {}

io.on("connection", (socket) => {
    console.log("New connection");
    let gameID = -1;
    socket.on("join game", (id) => {
        console.log("New join to "+id);
        if (id in games) {
            if (games[id].started) {
                socket.emit("invalid game");
                return;
            }
            console.log("Starting new game "+id);
            games[id].sockets.push(socket);
            games[id].game = new Game(id,games[id].sockets);
            games[id].game.setupSockets();
            games[id].started = true;
            return;
        }
        console.log("Creating new game "+id);
        games[id] = {
            "started": false,
            "sockets": [socket]
        };
        socket.emit("waiting for other player");
    })
})

//let g = new Game(12345);
//console.log(JSON.stringify(g, null, 2));

app.get('/', (req, res) => {
  res.send('Hello, Express with ES6!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.listen(3001, () => {
  console.log('server running at http://localhost:3001');
});
