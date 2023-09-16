import { PLAINS, MOUNTAIN, FOREST, ISLAND, SWAMP, cardTypes, cardNames } from './Cards.js';

// Array shuffle algorithm
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Create deck with 25 cards, shuffle, put top 3 into hand, return Player object
const createPlayer = (name) => {
    let deck = shuffle(cardTypes.flatMap((card) => new Array(5).fill(card)));
    let discard = new Array();
    let hand = { visible: [], hidden: [deck.pop(), deck.pop(), deck.pop()] };
    let board = Object.fromEntries(cardTypes.map((card) => [card, 0]));
    return {
        "name": name,
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
const COUNTER_SELECT = 5;
const GAME_OVER = 6;

class Game {
    constructor(gameID, names, sockets, destroyMe) {
        this.gameID = gameID;
        this.destroyMe = destroyMe;
        this.players = [createPlayer(names[0]), createPlayer(names[1])];
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

            sock.on("counter select", (args) => this.counterSelect(i, args));

            sock.emit("game started", this.gameID);
            sock.emit("board state", this.getBoardState(i));
        });
    }

    sendLogMessage(msg, player) {
        [0, 1].forEach((i) => {
            let sock = this.sockets[i];
            sock.emit("log", { "message": msg, "talkingAboutYou": (player === i) });
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

        let counterInfo = {}
        if (this.state === COUNTER_SELECT) {
            counterInfo.myCounterTurn = (player === this.counterPlayer)
            counterInfo.counterCard = this.counterCard
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

        return { "counterInfo": counterInfo, "myTurn": player === this.curPlayer, "state": this.state, "cards": [mySide, otherSide] };
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
        let [p, q] = [this.players[player], this.players[1-player]];
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
        p.board[type]++;
        this.sendLogMessage(p.name + " played " + cardNames(type), player);
        switch (type) {
            case PLAINS:
                this.askCounter(player, PLAINS,
                    () => {
                        p.board[PLAINS]--;
                        p.discard.push(PLAINS);
                        this.endTurn(player);
                    },
                    () => {
                        p.hand.hidden.push(this.drawCard(player));
                        this.endTurn(player);
                    })
                return;
            case MOUNTAIN:
                if (cardTypes.every((x) => (q.board[x] === 0))) {
                    this.askCounter(player, MOUNTAIN,
                        () => {
                            p.board[MOUNTAIN]--;
                            p.discard.push(MOUNTAIN);
                            this.endTurn(player);
                        },
                        () => {
                            this.endTurn(player);
                        })
                    return;
                }
                this.state = MOUNTAIN_SELECT;
                break;
            case FOREST:
                if (p.discard.length === 0) {
                    this.askCounter(player, FOREST,
                        () => {
                            p.board[FOREST]--;
                            p.discard.push(FOREST);
                            this.endTurn(player)
                        },
                        () => {
                            this.endTurn(player);
                        })
                    return;
                }
                this.state = FOREST_SELECT;
                break;
            case ISLAND:
                this.askCounter(player, ISLAND,
                    () => {
                        p.board[ISLAND]--;
                        p.discard.push(ISLAND);
                        this.endTurn(player)
                    }
                    , () => {
                        this.state = ISLAND_SELECT;
                        this.updatePlayers();
                    }
                )
                break;
            case SWAMP:
                if ((q.hand.hidden.length + q.hand.visible.length) === 0) {
                    this.askCounter(player, SWAMP,
                        () => {
                            p.board[SWAMP]--;
                            p.discard.push(SWAMP);
                            this.endTurn(player)
                        }
                        , () => { this.endTurn(player); }
                    )
                    return;
                }
                this.askCounter(player, SWAMP, () => {
                    p.board[SWAMP]--;
                    p.discard.push(SWAMP);
                    this.endTurn(player)
                }, () => {
                    this.state = SWAMP_SELECT;
                    q.hand.visible = q.hand.visible.concat(q.hand.hidden);
                    q.hand.hidden = [];
                    this.updatePlayers();
                })
                break;
        }
        this.updatePlayers();
    }

    // TODO: better type checking for all of these

    //means player chose to counter
    //args.cards is of the form [{index: number,visible: boolean },{index: number, visible: boolean}]
    //args.counter is a boolean
    counterSelect(player, args) {
        console.log(args)
        let [p, q] = [this.players[player], this.players[1 - player]];

        if (player !== this.counterPlayer) {
            console.log("invalid counter");
            return;
        }
        let intendToCounter = args.counter;
        if (typeof intendToCounter !== "boolean") {
            console.log("invalid counter");
            return;
        }
        if (!intendToCounter) {
            this.sendLogMessage(p.name + " chose not to counter.", player);
            this.onNoCounter();
            return;
        }

        //player intends to counter
        //check that this is a valid counter or ignore it
        if (args.cards.length !== 2) {
            console.log("invalid counter")
            return;
        }

        let checkValid = (arg) => {
            let index = arg.index
            let visible = arg.visible
            if ((typeof visible) !== "boolean" || (typeof index) !== "number")
                return null;
            let impPart = (visible) ? p.hand.visible : p.hand.hidden;
            if (index >= impPart.length || index < 0) {
                return null;
            }
            return impPart[index];
        }

        let sCards = [checkValid(args.cards[0]), checkValid(args.cards[1])]
        if (!sCards[0] || !sCards[1] ||
            (args.cards[0].visible === args.cards[1].visible &&
                args.cards[0].index === args.cards[1].index)) {
            console.log("invalid counter");
            return;
        }
        let target = [ISLAND, this.counterCard]

        target.sort()
        sCards.sort()

        if (!(target.every((value, index) => value === sCards[index]))) {
            console.log("invalid counter");
            return;
        }

        //swap if less so that the splicing below works
        if (args.cards[0].index < args.cards[1].index) {
            [args.cards[0], args.cards[1]] = [args.cards[1], args.cards[0]];
        }

        //remove it from hand
        for (let arg of args.cards) {
            let impPart = (arg.visible) ? p.hand.visible : p.hand.hidden;
            p.discard.push(impPart.splice(arg.index, 1)[0]);
        }

        this.askCounter(player, ISLAND, this.onNoCounter, this.onCounter)
        this.sendLogMessage(p.name + " countered!", player);
    }

    mountainSelect(player, args) {
        let [p, q] = [this.players[player], this.players[1 - player]];
        if (this.curPlayer !== player || this.state != MOUNTAIN_SELECT ||
            !(cardTypes.includes(args.type)) || q.board[args.type] < 1) {
            console.log("Invalid mountain");
            return;
        }
        this.sendLogMessage(p.name + " destroyed " + q.name + "'s " + cardNames(args.type), player);
        q.board[args.type]--;
        q.discard.push(args.type);
        let saveIdx = q.discard.length - 1;
        this.askCounter(player, MOUNTAIN, () => {
            p.board[MOUNTAIN]--;
            p.discard.push(MOUNTAIN);
            //need to do some weird shenanigans to remove the right one, discard could have changed
            let destroyType = q.discard.splice(saveIdx, 1)[0]
            q.board[destroyType]++;
            this.endTurn(player);
        }, () => {
            this.endTurn(player);
        })
    }

    forestSelect(player, args) {
        let [p, q] = [this.players[player], this.players[1 - player]];
        if (this.curPlayer !== player || this.state !== FOREST_SELECT ||
            (typeof args.index) !== "number" || args.index < 0 ||
            args.index >= p.discard.length) {
            console.log("Invalid forest");
            return;
        }
        this.sendLogMessage(p.name + " revived " + cardNames(p.discard[args.index]), player);
        p.hand.visible.push(p.discard[args.index]);
        p.discard.splice(args.index, 1);
        this.askCounter(player, FOREST, () => {
            // TODO: Don't let player counter a counter with the island they revived
            p.board[FOREST]--;
            p.discard.push(FOREST);
            let revived = p.hand.visible.pop()
            p.discard.splice(args.index, 0, revived)
            this.endTurn(player);
        }, () => {
            this.endTurn(player);
        })
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

        this.sendLogMessage(p.name + " shuffled their top 4 cards", player);
        let newFour = args.map((x) => p.deck[p.deck.length - 1 - x]);
        newFour.reverse();
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

        this.sendLogMessage(p.name + " destroyed " + q.name + "'s " + cardNames(q.hand.visible[args.index]), player);
        q.discard.push(q.hand.visible[args.index]);
        q.hand.visible.splice(args.index, 1);
        this.endTurn(player);
    }

    //ask other person if they want to counter, should require card of type
    //onCounter, onNoCounter tell the game what to do in both cases
    askCounter(player, type, onCounter, onNoCounter) {
        this.state = COUNTER_SELECT
        this.counterCard = type
        this.counterPlayer = 1 - player
        if (onCounter !== null) {
            this.onCounter = onCounter;
        }
        if (onNoCounter !== null) {
            this.onNoCounter = onNoCounter;
        }
        this.updatePlayers()
    }

    endTurn(player) {
        if (player !== this.curPlayer) return;
        this.sendLogMessage(this.players[player].name + " ended their turn", player);
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
