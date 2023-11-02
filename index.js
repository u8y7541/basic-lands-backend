import express from 'express';
import https from 'https';
import { Server as SocketIO } from 'socket.io';
import fs from 'fs';

import Game from './Game.js';
import cors from 'cors'

const app = express();

const corsOptions = {
  origin: '*',
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true,
  exposedHeaders: 'Custom-Header',
};


app.use(cors(corsOptions));

const privateKey = fs.readFileSync('/etc/letsencrypt/live/api.basiclands.xyz/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/api.basiclands.xyz/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/api.basiclands.xyz/chain.pem', 'utf8'); // Optional CA bundle

const credentials = {
  key: privateKey,
  cert: certificate,
  ca: ca, // Include if you have a CA bundle
};

const server = https.createServer(credentials, app);

const io = new SocketIO(server,{
  cors:{
    origin: "*",
    methods: ["Get", "POST"],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
});
const port = process.env.PORT || 3002;

let games = {}

io.on("connection", (socket) => {
    console.log("New connection");
    let gameID = -1;
    socket.on("join game", (args) => {
        let id = args.id;
        let name = args.name;
        console.log("New join to "+id);
        if (id in games) {
            if (games[id].started) {
                socket.emit("invalid game");
                return;
            }
            console.log("Starting new game "+id);
            games[id].names.push(name);
            games[id].sockets.push(socket);
            let destroyMe = () => {
                // TODO: Remove game from games object, record history, etc.
                console.log("Destroying game "+id);
                games[id].ended = true;
                games[id].sockets.forEach((sock) => sock.disconnect(true));
            }
            games[id].game = new Game(id,games[id].names,games[id].sockets,destroyMe);
            games[id].game.setupSockets();
            games[id].started = true;
            return;
        }
        console.log("Creating new game "+id);
        games[id] = {
            "started": false,
            "ended": false,
            "names": [name],
            "sockets": [socket],
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
