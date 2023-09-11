import { PLAINS, MOUNTAIN, FOREST, ISLAND, SWAMP, cardTypes } from './Cards.js';

// Array shuffle algorithm
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Create deck with 25 cards, shuffle, put top 3 into hand, return Player object
const createPlayer = () => {
    let deck = shuffle(cardTypes.flatMap((card) => new Array(5).fill(card)));
    let discard = new Array();
    let hand = { visible: [], hidden: [deck.pop(), deck.pop(), deck.pop()] };
    let board = Object.fromEntries(cardTypes.map((card) => [card, 0]));
    return {
        "deck": deck,
        "discard": discard,
        "hand": hand,
        "board": board
    };
}

// Possible game states
const TURN_START = 0;
const MOUNTAIN_SELECT = 1;
const FOREST_SELECT = 2;
const ISLAND_SELECT = 3;
const SWAMP_SELECT = 4;
const WAIT_FOR_ISLAND_COUNTER = 5;
const TURN_END = 6;

class Game {
    constructor(gameID, sockets) {
        this.gameID = gameID;
        this.players = [createPlayer(), createPlayer()];
        this.sockets = sockets;
        this.curPlayer = 0;
        this.state = TURN_START;
    }

    setupSockets() {
        console.log("Setup sockets");
        [0,1].forEach((i) => {
            this.sockets[i].on("play card", (args) => this.playCard(i, args));
            this.sockets[i].on("end turn", () => this.endTurn(i));
            console.log("Sending board state to player "+i);
            this.sockets[i].emit("game started", this.gameID);
            this.sockets[i].emit("board state", this.getBoardState(i));
        });
    }

    getBoardState(player) {
        let myFullInfo = this.players[player];
        let otherFullInfo = this.players[1-player];
        let mySide = {
            "deck": myFullInfo.deck.length,
            "discard": myFullInfo.discard,
            "hand": myFullInfo.hand,
            "board": myFullInfo.board
        };
        let otherSide = {
            "deck": otherFullInfo.deck.length,
            "discard": otherFullInfo.discard,
            "hand": { "visible" : otherFullInfo.hand.visible.length,
                      "hidden" : otherFullInfo.hand.hidden.length },
            "board": otherFullInfo.board
        }

        return {"myTurn": player == this.curPlayer, "state": [mySide, otherSide]};
    }

    playCard(player, args) {
        let hand = this.players[player].hand;
        if (!args.index || !args.type || args.index >= hand.length || hand[args.index] != args.type) {
            this.sockets[player].emit("play card", false);
            return;
        }

        // TODO
    }

    endTurn(player) {
        if (player !== this.curPlayer) return;
        this.curPlayer = 1-this.curPlayer;
        [0,1].forEach((i) => this.sockets[i].emit("new turn", this.getBoardState(i)));
    }
}

export default Game;
