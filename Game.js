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
    constructor(gameID) {
        this.gameID = gameID;
        this.players = [createPlayer(), createPlayer()];
        this.curPlayer = 0;
        this.state = TURN_START;
    }
}

export default Game;
