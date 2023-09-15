export const PLAINS   = "plains";
export const MOUNTAIN = "mountain";
export const FOREST   = "forest";
export const ISLAND   = "island";
export const SWAMP    = "swamp";

export const cardTypes = [PLAINS,MOUNTAIN,FOREST,ISLAND,SWAMP];
export const cardNames = (card) => {
    switch (card) {
        case PLAINS:
            return "Plains";
        case MOUNTAIN:
            return "Mountain";
        case FOREST:
            return "Forest";
        case ISLAND:
            return "Island";
        case SWAMP:
            return "Swamp";
    }
    return "dog";
}
/*    PLAINS: "Plains",
    MOUNTAIN: "Mountain",
    FOREST: "Forest",
    ISLAND: "Island",
    SWAMP: "Swamp"
};*/
