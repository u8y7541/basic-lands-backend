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
const GAME_OVER = 6;

class Game {
    constructor(gameID, sockets, destroyMe) {
        this.gameID = gameID;
        this.destroyMe = destroyMe;
        this.players = [createPlayer(), createPlayer()];
        this.sockets = sockets;
        this.curPlayer = Math.floor(Math.random() * 2);
        this.state = TURN_START;
    }

    setupSockets() {
        console.log("Setup sockets");
        [0, 1].forEach((i) => {
            let sock = this.sockets[i];
            sock.on("play card", (args) => this.playCard(i, args));
            sock.on("mountain select", (args) => this.mountainSelect(i, args));
            sock.on("forest select", (args) => this.forestSelect(i, args));
            sock.on("island select", (args) => this.islandSelect(i, args));
            sock.on("swamp select", (args) => this.swampSelect(i, args));
            sock.on("end turn", () => this.endTurn(i));

            sock.emit("game started", this.gameID);
            sock.emit("board state", this.getBoardState(i));
        });
    }

    getBoardState(player) {
        let myFullInfo = this.players[player];
        let otherFullInfo = this.players[1 - player];
        let mySide = {
            "deck": myFullInfo.deck.length,
            "discard": myFullInfo.discard,
            "hand": myFullInfo.hand,
            "board": myFullInfo.board
        };
        if (this.state === ISLAND_SELECT && player === this.curPlayer) {
            let islandLength = Math.min(myFullInfo.deck.length, 4);
            let top4 = myFullInfo.deck.slice(myFullInfo.deck.length - islandLength);
            mySide["top4"] = []
            for (let i = top4.length - 1; i >= 0; i--) {
                mySide["top4"].push(top4[i])
            }
        }
        let otherSide = {
            "deck": otherFullInfo.deck.length,
            "discard": otherFullInfo.discard,
            "hand": {
                "visible": otherFullInfo.hand.visible,
                "hidden": otherFullInfo.hand.hidden.length
            },
            "board": otherFullInfo.board
        }

        return { "myTurn": player === this.curPlayer, "state": this.state, "cards": [mySide, otherSide] };
    }

    updatePlayers() {
        [0, 1].forEach((i) => this.sockets[i].emit("board state", this.getBoardState(i)));
    }

    drawCard(player) {
        let p = this.players[player];
        if (p.deck.length === 0) {
            p.deck = shuffle(p.discard);
            p.discard = [];
        }
        return p.deck.pop();
    }

    checkWin(player) {
        let p = this.players[player];
        if (cardTypes.every((x) => (p.board[x] > 0)) ||
            cardTypes.some((x) => (p.board[x] == 5))) {
            return true;
        }
        return false;
    }

    playCard(player, args) {
        console.log("Player " + player + " playing card: " + JSON.stringify(args, null, 4));
        let p = this.players[player];
        let q = this.players[1 - player];
        let hand = (args.visible ? p.hand.visible : p.hand.hidden);
        if (this.curPlayer !== player || this.state !== TURN_START ||
            !("index" in args) || !("visible" in args) ||
            (typeof args.visible) !== "boolean" || (typeof args.index) !== "number" ||
            args.index < 0 || args.index >= hand.length) {
            console.log("Invalid");
            return;
        }

        let type = hand[args.index];
        hand.splice(args.index, 1);
        // TODO: island negation
        p.board[type]++;
        switch (type) {
            case PLAINS:
                p.hand.hidden.push(this.drawCard(player));
                this.endTurn(player);
                return;
            case MOUNTAIN:
                if (cardTypes.every((x) => (q.board[x] === 0))) {
                    this.endTurn(player);
                    return;
                }
                this.state = MOUNTAIN_SELECT;
                break;
            case FOREST:
                if (p.discard.length === 0) {
                    this.endTurn(player);
                    return;
                }
                this.state = FOREST_SELECT;
                break;
            case ISLAND:
                this.state = ISLAND_SELECT;
                break;
            case SWAMP:
                if ((q.hand.hidden.length + q.hand.visible.length) === 0) {
                    this.endTurn(player);
                    return;
                }
                this.state = SWAMP_SELECT;
                q.hand.visible = q.hand.visible.concat(q.hand.hidden);
                q.hand.hidden = [];
                break;
        }
        this.updatePlayers();
    }

    // TODO: better type checking for all of these
    mountainSelect(player, args) {
        let [p, q] = [this.players[player], this.players[1 - player]];
        if (this.curPlayer !== player || this.state != MOUNTAIN_SELECT ||
            !(cardTypes.includes(args.type)) || q.board[args.type] < 1) {
            console.log("Invalid mountain");
            return;
        }
        q.board[args.type]--;
        q.discard.push(args.type);
        this.endTurn(player);
    }

    forestSelect(player, args) {
        let [p, q] = [this.players[player], this.players[1 - player]];
        if (this.curPlayer !== player || this.state !== FOREST_SELECT ||
            (typeof args.index) !== "number" || args.index < 0 ||
            args.index >= p.discard.length) {
            console.log("Invalid forest");
            return;
        }
        p.hand.visible.push(p.discard[args.index]);
        p.discard.splice(args.index, 1);
        this.endTurn(player);
    }

    islandSelect(player, args) {
        let [p, q] = [this.players[player], this.players[1 - player]];
        let islandLength = Math.min(p.deck.length, 4);
        if (this.curPlayer !== player || this.state != ISLAND_SELECT ||
            args.some((x) => (x < 0 || x >= islandLength)) ||
            (new Set(args)).size != args.length) {
            console.log("Invalid island");
            return;
        }
        args = args.map(arg => (args.length - 1 - arg))
        let newFour = args.map((x) => p.deck[p.deck.length - islandLength + x]);
        let all = Array.from(Array(islandLength).keys());
        all.forEach((i) => {
            if (!(args.includes(i))) {
                p.discard.push(p.deck[p.deck.length - 1 - i]);
            }
        });

        p.deck.splice(p.deck.length - islandLength, islandLength, ...newFour);
        this.endTurn(player);
    }

    swampSelect(player, args) {
        let [p, q] = [this.players[player], this.players[1 - player]];
        if (this.curPlayer !== player || this.state != SWAMP_SELECT ||
            (typeof args.index) !== "number" || args.index < 0 ||
            args.index >= q.hand.visible.length) {
            console.log("Invalid swamp");
            return;
        }
        q.discard.push(q.hand.visible[args.index]);
        q.hand.visible.splice(args.index, 1);
        this.endTurn(player);
    }

    endTurn(player) {
        if (player !== this.curPlayer) return;
        if (this.checkWin(player)) this.state = GAME_OVER;
        else this.state = TURN_START;
        this.curPlayer = 1 - this.curPlayer;
        let p = this.players[this.curPlayer];
        p.hand.hidden.push(this.drawCard(this.curPlayer));
        this.updatePlayers();
        if (this.state === GAME_OVER)
            this.destroyMe();
    }
}

export default Game;
