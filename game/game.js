import { sendMessage } from '../script.js';

const base = document.getElementById('base');
const cards = document.getElementById('cards');
const foci = document.getElementById('foci');

const basectx = base.getContext('2d');
const cardsctx = cards.getContext('2d');
const focictx = foci.getContext('2d');

window.addEventListener('DOMContentLoaded', () => {
    foci.addEventListener("mousemove", (event) => {
        window.spots=spots
        const rect = foci.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left) * (foci.width / rect.width);
        const mouseY = (event.clientY - rect.top) * (foci.width / rect.width);

        for (const spot of allSpots) {
            if (
                mouseX >= spot.x - padding &&
                mouseX <= spot.x + cardWidth + padding &&
                mouseY >= spot.y - padding &&
                mouseY <= spot.y + cardHeight + padding
            ) {
                focusedSpot = spot
                break;
            } else {
                focusedSpot = 0
            }
        }
    });

    foci.addEventListener("click", (event) => {
        if(!gameOn){return}
        const rect = foci.getBoundingClientRect();
        const clickX = (event.clientX - rect.left) * (foci.width / rect.width);
        const clickY = (event.clientY - rect.top) * (foci.width / rect.width);
        for (const spot of allSpots) {
            if (
                clickX >= spot.x - padding &&
                clickX <= spot.x + cardWidth + padding &&
                clickY >= spot.y - padding &&
                clickY <= spot.y + cardHeight + padding
            ) {
                handleSpotClick(spot);
                return;
            }
        }
        selectedSpot = 0;
        sendSelect(0);
    });

    resizeCanvas();
    createSpots();
    preloadSounds();
});

const cardKeys = [
    // Spades (S)
    "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13",

    // Diamonds (D)
    "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13",

    // Hearts (H)
    "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "H10", "H11", "H12", "H13",

    // Clubs (C)
    "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13"
];

const cardImages = {};
const backImg = new Image();

backImg.src = "./game/cards/back.png";
cardImages.back = backImg;

function loadCards(path = "./game/cards/") {
    cardKeys.forEach(key => {
        const img = new Image();
        img.src = `${path}${key}.png`;
        cardImages[key] = img;
    });
} 

loadCards();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};

['click', 'keydown', 'touchstart'].forEach(event => {
    window.addEventListener(event, () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }, { once: true });
});

// Preload function for one sound
async function loadSound(name, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
}

// Preload both sounds
async function preloadSounds() {
    await Promise.all([
        loadSound('move', './game/audio/move.wav'),
        loadSound('flip', './game/audio/flip.wav')
    ]);
}

// Play sound by name
function playSound(name) {
    const buffer = audioBuffers[name];
    if (!buffer) return;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    // Slight pitch variation: random between 0.90x and 1.1x
    const rate = 0.9 + Math.random() * 0.2;
    source.playbackRate.value = rate;

    source.start();
}

const padding = 12 // max 23
const maxStack = 5 // -1 for inf
const stackOffset = 5
const animationSpeed = 1
const cardPerspective = true
const cardScalar = 0.03 // how much card grows by when selected or focused

var piles = [1, 2, 3, 4, 5] // max 7
var decks = 1
var deck = [];
var spots
var gameOn = false

var focusedSpot
var selectedSpot = 0 
var oppSelectedSpot = 0

const allSpots = []

function init() {
    createdeck()
    spots.deckA.cards.push(...deck.slice(0, deck.length/2))
    spots.deckB.cards.push(...deck.slice(deck.length/2, deck.length))
}

export function startAnimation() {
    setup.style.display = 'none'
    requestAnimationFrame(gameLoop);
    gameOn = true
}

function deal() {

    //debugging
    //moveCard(spots.deckA, spots.stackA, {'flip':true})
    //moveCard(spots.deckB, spots.stackB, {'flip':true})

    var tasks = []
    for(const [i, num] of piles.entries()) {
        for (let j = 0; j < num; j++) {
            tasks.push(() => moveCard(
                spots.deckA, 
                spots.stockA[i], 
                j == num - 1 ? {"flip" : true} : false))
                tasks.push(() => moveCard(
                spots.deckB, 
                spots.stockB[i], 
                j == num - 1 ? {"flip" : true} : false))
        }
    }
    
        for(const i in tasks) {
        setTimeout(tasks[i], animationSpeed * 350 * Math.pow(i, 1/1.65))
    }
}

function createdeck() {
    for(let i = 0; i<decks; i++) {
            cardKeys.forEach(card => {
                deck.push({
                    "value" : card,
                    "faceUp" : false,
                    "busy" : false     
                })
        });
    }

    shuffle(deck)
}

function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function spotOutline(x, y) {
    drawLine(basectx, x-padding, y-padding, x+cardWidth+padding, y-padding);
    drawLine(basectx, x+cardWidth+padding, y-padding, x+cardWidth+padding, y+cardHeight+padding);
    drawLine(basectx, x+cardWidth+padding, y+cardHeight+padding, x-padding, y+cardHeight+padding);
    drawLine(basectx, x-padding, y+cardHeight+padding, x-padding, y-padding)
}

function createSpots() {
    spots = {
        "deckA" : {
            "x" : Math.round((base.width/2) - (cardWidth/2) - 500),
            "y" : Math.round((base.height/2) - (cardHeight/2)),
            "cards" : []
        },
        "deckB" : {
            "x" : Math.round((base.width/2) - (cardWidth/2) + 500),
            "y" : Math.round((base.height/2) - (cardHeight/2)),
            "cards" : []
        },
        "stackA" : {
            "x" : Math.round((base.width/2) - (cardWidth/2) - 100),
            "y" : Math.round((base.height/2) - (cardHeight/2)),
            "cards" : []
        },
        "stackB" : {
            "x" : Math.round((base.width/2) - (cardWidth/2) + 100),
            "y" : Math.round((base.height/2) - (cardHeight/2)),
            "cards" : []
        },
        "stockA" : [],
        "stockB" : []
    }
    
    for(const i in piles) {
        spots["stockA"].push({
            "x" : Math.round((base.width/2) + 150*((piles.length-1) - (i) - ((piles.length-1)/2)) - cardWidth/2),
            "y" : 100,
            "cards" : []
        })

        spots["stockB"].push({
            "x" : Math.round((base.width/2) + 150*((i) - ((piles.length-1)/2)) - cardWidth/2),
            "y" : base.height-100-cardHeight,
            "cards" : []
        })
    }

    allSpots.push(...[
        ...spots.stockA,
        ...spots.stockB,
        spots.deckA,
        spots.deckB,
        spots.stackA,
        spots.stackB
    ].flat());

    drawSpots()
}

function drawSpots(){    
    for(const spot of allSpots) {
        spotOutline(spot.x, spot.y)
    }
}

function shuffle(array) {
    var m = array.length, t, i;

    // While there remain elements to shuffle…
    while (m) {

        // Pick a remaining element…
        i = Math.floor(Math.random() * m--);

        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }

    return array;
}

const cardHeight = 138
const cardWidth = 103

//visual ONLY!
var animations = [] // all current animations
var statics = [] // all current static cards

//example animations...

// animations.push(createMoveAnimation(cardImages["S2"], 100, 100, 500, 300, 250, easingFn));

// statics.push({
//   img: cardImages["S11"],
//   x: 308,
//   y: 108,
//   width: 103,
//   height: 138
// });

function easingFn(t, p) {
    return (Math.pow(t, p) / (Math.pow(t, p) + Math.pow(1-t, p)))
}

function drawPile(spot) {
    // List of cards
    const pile = spot.cards
    // Only draws the top maxStack (-1 is inf) cards
    const topCards = pile.slice(-1 * (maxStack === -1 ? pile.length : maxStack))

    // Doesnt draw last card if is focusedSpot or 
    for(const [i, card] of (focusedSpot === spot || (selectedSpot === spot || oppSelectedSpot === spot)? topCards.slice(0,-1).entries() : topCards.entries())) {
        if(!card.busy){
            // Drawing the cards
            cardsctx.drawImage(
                // Checking if faceup
                card.faceUp ? cardImages[card.value] : cardImages.back, 
                Math.round(spot.x + (cardPerspective ? (((2*spot.x + cardWidth) / base.width) - 1) : -1) * ((stackOffset * (6/5))*i)), // Parallax effect
                Math.round(spot.y - (stackOffset*i)),
                cardWidth, 
                cardHeight
            );
        }
    }
    // Drawing remaining card larger if spot is focused
    if(focusedSpot === spot || (selectedSpot === spot || oppSelectedSpot === spot) && topCards.length > 0) {
        let card = topCards.at(-1)
        // Change size of card depending on if focused/selected
        let cardScale = 0
        if(focusedSpot === spot) {cardScale += cardScalar}
        if((selectedSpot === spot || oppSelectedSpot === spot)) {cardScale += cardScalar}

        if (card) {
            if(!card.busy){
                focictx.drawImage(
                    // Checking if faceup
                    card.faceUp ? cardImages[card.value] : cardImages.back, 
                    Math.round(spot.x + (cardPerspective ? (((2*spot.x + cardWidth) / base.width) - 1) : -1) * ((stackOffset * (6/5))*(topCards.length - 1)) - cardWidth*cardScale), // Parallax effect
                    Math.round(spot.y - (stackOffset*(topCards.length - 1)) - cardHeight*cardScale),
                    cardWidth * (1 + 2*cardScale),
                    cardHeight * (1 + 2*cardScale)
                );
            }
        }
    }
}

function moveCard(spotA, spotB, task, avoidSend) {
    if(!avoidSend) {
        sendMove(spotA, spotB, task)
    }
    playSound("move")

    if (task) task.destination = spotB;

    const card = spotA.cards.pop();
    card.busy = true;
    spotB.cards.push(card);

    let cardIndexA = (maxStack === -1 ? spotA.cards.length : Math.min(spotA.cards.length, maxStack - 1))
    let cardIndexB = (maxStack === -1 ? spotB.cards.length : Math.min(spotB.cards.length, maxStack - 1)) - 1

    let fromX = Math.round(spotA.x + (cardPerspective ? (((2*spotA.x + cardWidth) / base.width) - 1) : -1) * (stackOffset * (6/5)) * cardIndexA)
    let fromY = Math.round(spotA.y - stackOffset * cardIndexA)
    let toX = Math.round(spotB.x + (cardPerspective ? (((2*spotB.x + cardWidth) / base.width) - 1) : -1) * (stackOffset * (6/5)) *  (cardIndexB))
    let toY = Math.round(spotB.y - stackOffset * (cardIndexB))
    animations.push(createMoveAnimation(card, fromX, fromY, toX, toY, animationSpeed * 250, task));
}

function flipCard(spot, card, avoidSend) {
    if(!avoidSend) {
        sendFlip(spot)
    }
    playSound("flip")
    if(!card) {
        card = spot.cards[spot.cards.length - 1]
    }
    card.busy = true;
    card.faceUp = true;

    let cardIndex = (maxStack === -1 ? spot.cards.length : Math.min(spot.cards.length, maxStack - 1)) - 1

    // Calculating for Parallax stacking
    let x = Math.round(spot.x + (cardPerspective ? (((2*spot.x + cardWidth) / base.width) - 1) : -1) * (stackOffset * (6/5)) * cardIndex)
    let y = Math.round(spot.y - stackOffset * cardIndex)

    animations.push(createFlipAnimation(card, x, y, animationSpeed * 150))
}

function errorCard(spot) {
    let card = spot.cards[spot.cards.length - 1]
    if(card.busy) {
        return;
    }
    card.busy = true;
    let cardIndex = (maxStack === -1 ? spot.cards.length : Math.min(spot.cards.length, maxStack)) - 1

    // Calculating for Parallax stacking
    let x = Math.round(spot.x + (cardPerspective ? (((2*spot.x + cardWidth) / base.width) - 1) : -1) * (stackOffset * (6/5)) * cardIndex)
    let y = Math.round(spot.y - stackOffset * cardIndex)
    animations.push(createErrorAnimation(card, x, y, animationSpeed * 250, spot))
}

function createMoveAnimation(card, fromX, fromY, toX, toY, duration, task) {
    const startTime = performance.now();
    const img = (card.faceUp ? cardImages[card.value] : cardImages.back)

    return {
        card,
        task,
        draw(now) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1); // normalized time [0,1]
            const easedT = easingFn(t, 2.5); // apply easing function

            const x = fromX + (toX - fromX) * easedT;
            const y = fromY + (toY - fromY) * easedT;

            cardsctx.drawImage(img, x, y, cardWidth, cardHeight);

            return t >= 1; // return true when animation is done
        }
    };
}

function createFlipAnimation(card, x, y, duration) {

    const startTime = performance.now();
    const img = (card.faceUp ? cardImages[card.value] : cardImages.back)

    return {
        card,
        draw(now) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);

            const easedT = easingFn(t, 2);  // apply easing here

            // Flip progress is still based on mirrored distance from 0.5
            const flipProgress = 2 * Math.abs(easedT - 0.5);

            const image = easedT < 0.5 ? cardImages["back"] : img; // Swaps to backside when halfway through animation

            // Marking center of card, scaling about center
            const centerX = x + cardWidth / 2;
            const centerY = y + cardHeight / 2;

            cardsctx.save();
            cardsctx.translate(centerX, centerY);
            cardsctx.scale(flipProgress, 1);
            cardsctx.drawImage(image, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
            cardsctx.restore(); // so it scales the original image every time

            return t >= 1; // return true when animation is done
        }
    };
}

function createErrorAnimation(card, x, y, duration, spot) {
    const startTime = performance.now();
    const img = (card.faceUp ? cardImages[card.value] : cardImages.back)

    return {
        card, 
        draw(now) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1); 

            // Wiggle it
            let displacedX = x + cardWidth * (10 * (Math.pow(t,5) - 2.5*Math.pow(t,4) + 2*Math.pow(t,3) - 0.5*Math.pow(t,2)));

            let cardScale = 0
            if(focusedSpot === spot) {cardScale += cardScalar}
            if((selectedSpot === spot || oppSelectedSpot === spot)) {cardScale += cardScalar}
            
            if(focusedSpot) {
                cardsctx.drawImage(
                    img, 
                    displacedX - cardScale*cardWidth, 
                    y - cardScale*cardHeight, 
                    cardWidth * (1+2*cardScale), 
                    cardHeight * (1+2*cardScale)
                );
            } else {
                cardsctx.drawImage(img, displacedX, y, cardWidth, cardHeight);
            }

            return t >= 1; // return true when animation is done

        }
    }
}

function handleSpotClick(spot) {
    if(spot === selectedSpot) { // deselect spot
        selectedSpot = 0;
        sendSelect(0);
    } else if (spot === spots.deckB && !checkForMoves()) { // if on deckB and no valid moves
        selectedSpot = spot
        sendSelect(spot)
        if(oppSelectedSpot === spots.deckA) {
            flipNext()
        }
    } else if (selectedSpot == 0) { // if none selected...
        if(spots.stockB.includes(spot) && spot.cards.length != 0) { // and it's in your stock...
            selectedSpot = spot; // select this spot.
            sendSelect(spot);
        } else if (spot.cards.length != 0){
            errorCard(spot); // error if not selectable
        }
    } else if (!(selectedSpot == spots.deckA || selectedSpot == spots.deckB)) { // all cases where 2 cards have been selected (ish)
        // excluding selectedSpot being a deck because dont want to move from deck to stock
        if(spot === spots.stackA || spot === spots.stackB) { // onto one of the stacks
            if (isAdjacent(selectedSpot, spot)){
                moveCard(selectedSpot, spot);
                if(selectedSpot.cards.length){
                    if(!selectedSpot.cards.at(-1).faceUp) {flipCard(selectedSpot)}; // check last card in first stack, flip if needed
                }
                selectedSpot = 0;
                sendSelect(0);
                checkForWin()
            } else {
                errorCard(selectedSpot)
                selectedSpot = 0;
                sendSelect(0);
            }
        } else if (spots.stockB.includes(spot)) { // onto your stock
            if(spot.cards.length == 0){ // if no cards in target spot
                moveCard(selectedSpot, spot); 
                if(selectedSpot.cards.length){
                    if(!selectedSpot.cards.at(-1).faceUp) {flipCard(selectedSpot)}; // check last card in first stack, flip if needed
                }
                selectedSpot = 0;
                sendSelect(0);
            } else if(isSame(selectedSpot, spot)){
                moveCard(selectedSpot, spot);
                if(selectedSpot.cards.length){
                    if(!selectedSpot.cards.at(-1).faceUp) {flipCard(selectedSpot)}; // check last card in first stack, flip if needed
                }
                selectedSpot = 0;
                sendSelect(0);
            } else {
                errorCard(selectedSpot)
                selectedSpot = spot;
                sendSelect(spot);
            }  
        } else { // onto somewhere silly
            errorCard(spot)
            selectedSpot = 0
        }
    }
}

function isAdjacent(spotA, spotB) {
    let valueA = parseInt(spotA.cards.at(-1).value.slice(1));
    let valueB = parseInt(spotB.cards.at(-1).value.slice(1));

    //true if adjacent, e.g. 2&3; also true for 1&13 and 13&1.
    return (Math.abs(valueA-valueB) == 1 || Math.abs(valueA%13-valueB%13) == 1);
}

function isSame(spotA, spotB) {
    let valueA = parseInt(spotA.cards.at(-1).value.slice(1));
    let valueB = parseInt(spotB.cards.at(-1).value.slice(1));

    return (valueA == valueB);
}

function sendCards(spot){
    let msg = {}
    msg.type = 'cards'
    msg.spot = swapAB(getSpotInfo(spot).spotName)
    msg.cards = spot.cards
    sendMessage(msg)
    console.log('sending cards')
}

function sendMove(spotA, spotB, task) {
    let msg = {};
    msg.type = 'move';
    msg.spotA = swapAB(getSpotInfo(spotA).spotName);
    msg.indexA = getSpotInfo(spotA).spotIndex;
    msg.spotB = swapAB(getSpotInfo(spotB).spotName);
    msg.indexB = getSpotInfo(spotB).spotIndex;
    msg.task = task;
    sendMessage(msg);
}

function sendFlip(spot) {
    let msg = {};
    msg.type = 'flip';
    msg.spot = swapAB(getSpotInfo(spot).spotName)
    msg.index = getSpotInfo(spot).spotIndex;
    sendMessage(msg);
}

function sendSelect(spot) {
    let msg = {};
    msg.type = 'select';
    if(spot == 0) {
        msg.spot = 0
        msg.index = -1;
    } else {
        msg.spot = swapAB(getSpotInfo(spot).spotName)
        msg.index = getSpotInfo(spot).spotIndex;
    }
    sendMessage(msg);
}

export function recieveCards(msg) {
    console.log('recieving cards')
    let spot 
    switch (msg.spot) { //only works when sending to deckA or deckB
        case 'deckA' :
            spot = spots.deckA;
            break;
        case 'deckB' :
            spot = spots.deckB;
            break;
    }
    spot.cards.push(...msg.cards)
}

export function recieveMove(msg) {
    let spotA, spotB
    switch (msg.spotA) { // only works when sending from decks or stocks
        case 'deckA':
            spotA = spots.deckA;
            break;
        case 'deckB':
            spotA = spots.deckB; //stock B, but the index A is the "from" index
            break;
        case 'stockA':
            spotA = spots.stockA[msg.indexA];
            break;
        case 'stockB':
            spotA = spots.stockB[msg.indexA]; //stock B, but the index A is the "from" index
            break;
    }
    switch (msg.spotB) { // only works when sending to stacks or stocks
        case 'stackA':
            spotB = spots.stackA;
            break;
        case 'stackB':
            spotB = spots.stackB;
            break;
        case 'stockA':
            spotB = spots.stockA[msg.indexB]; //stock A, but the index B is the "to" index
            break;
        case 'stockB':
            spotB = spots.stockB[msg.indexB]; 
            break;
    }
    moveCard(spotA, spotB, msg.task, true)
}

export function recieveFlip(msg) {
    let spot
    switch (msg.spot) {
        case 'stackA':
            spot = spots.stackA;
            break;
        case 'stackB':
            spot = spots.stackB;
            break;
        case 'stockA':
            spot = spots.stockA[msg.index];
            break;
        case 'stockB':
            spot = spots.stockB[msg.index];
            break;
    }
    flipCard(spot, false, true)
}

export function recieveSelect(msg) {
    let spot
    switch (msg.spot) {
        case 0 :
            spot = 0
            break;
        case 'deckA':
            spot = spots.deckA;
            break;
        case 'stockA':
            spot = spots.stockA[msg.index];
            break;
    }
    oppSelectedSpot = spot
}

function getSpotInfo(spot) {
    let spotKey = Object.keys(spots).find(key => spots[key] === spot);
    let index
    if(spotKey) { // if stacks or decks
        index = -1
    } else if (spots.stockA.includes(spot)){ // if in stockA
        spotKey = "stockA"
        index = spots.stockA.indexOf(spot)
    } else if (spots.stockB.includes(spot)){ // if in stockB
        spotKey = "stockB"
        index = spots.stockB.indexOf(spot)
    }
    return {
        "spotName" : spotKey,
        "spotIndex" : index
    }
}

function swapAB(spotName) { // swaps A for B in spot names vice versa
    return spotName.slice(0,-1) + (spotName.at(-1) == "A" ? "B" : "A")
}

function checkForMoves() {
    console.log('checking for moves')

    // checking for if can simplify stock A
    if(spots.stockA.some(spot => spot.cards.some(card => !card.faceUp))) { // if any card is faceDown
        if(spots.stockA.some(spot => spot.cards.length == 0)) { // and there's an empty space
            console.log("empty space + facedown cards in stock A");
            return true;
        } else { // why its in else? following will error if empty space. 
            // checking if can stack likes in stock
            for (let i = 0; i < spots.stockA.length; i++) { 
                for (let j = i + 1; j < spots.stockA.length; j++) {
                    if (isSame(spots.stockA[i], spots.stockA[j])) {
                        console.log("like cards in stock A");
                        return true;
                    }
                }
            }
        }
    } 

    // checking for if can simplify stock B
    if(spots.stockB.some(spot => spot.cards.some(card => !card.faceUp))) { // if any card is faceDown
        if(spots.stockB.some(spot => spot.cards.length == 0)) { // and there's an empty space
            console.log("empty space + facedown cards in stock B");
            return true;
        } else { // why its in else? following will error if empty space. 
            // checking if can stack likes in stock
            for (let i = 0; i < spots.stockB.length; i++) {
                for (let j = i + 1; j < spots.stockB.length; j++) {
                    if (isSame(spots.stockB[i], spots.stockB[j])) {
                        console.log("like cards in stock B");
                        return true;
                    }
                }
            }
        }
    } 
    
    // checking if both stacks are empty 
    if(spots.stackA.cards.length == 0 && spots.stackB.cards.length == 0) {
        console.log("both stacks empty");
        return false;
    }

    // checking for if moves can be played to stack
    if(spots.stockA.some(spot => spot.cards.length > 0 && isAdjacent(spot, spots.stackA))){
        console.log ("viable stockA -> stackA"); 
        return true;
    }
    if(spots.stockB.some(spot => spot.cards.length > 0 && isAdjacent(spot, spots.stackA))){
        console.log ("viable stockB -> stackA"); 
        return true;
    }
    if(spots.stockA.some(spot => spot.cards.length > 0 && isAdjacent(spot, spots.stackB))){
        console.log ("viable stockA -> stackB"); 
        return true;
    }
    if(spots.stockB.some(spot => spot.cards.length > 0 && isAdjacent(spot, spots.stackB))){
        console.log ("viable stockB -> stackB"); 
        return true;
    }
}

function checkForWin() {
    if(!spots.stockB.some(spot => spot.cards.length > 0)) { //if no spots with >0 cards
        let msg = {};
        msg.type = 'win';
        sendMessage(msg);
        gameOn = false;
        winScreen.style.display = 'flex'
    }
}

export function lose() {
    gameOn = false
    loseScreen.style.display = 'flex'
}

export function startGame() {
    startAnimation()
    init()
    sendCards(spots.deckA)
    sendCards(spots.deckB)
    sendMessage({'type':'start'})
    deal()
}

export function flipNext(avoidSend) {
    moveCard(spots.deckA, spots.stackA, {'flip':true}, true)
    moveCard(spots.deckB, spots.stackB, {'flip':true}, true)
    selectedSpot = 0
    sendSelect(0)
    if(!avoidSend) {
        sendMessage({'type':'flipNext'})
    }
}

window.getSpotInfo = getSpotInfo; // debug

function gameLoop(now) {
    cardsctx.clearRect(0, 0, cards.width, cards.height);
    focictx.clearRect(0, 0, foci.width, foci.height);

    // Draw static cards
    // for (const card of statics) {
    //         cardsctx.drawImage(card.img, card.x, card.y, cardWidth, cardHeight);
    // }

    for(const spot of allSpots) {
    drawPile(spot)
    }

    // Draw animations and remove finished
    for (let i = 0; i < animations.length;) {
        const done = animations[i].draw(now);
        if (done) {
            if (animations[i].card) {
                animations[i].card.busy = false;
                if (animations[i].task) {
                    if (animations[i].task.flip) {
                        flipCard(animations[i].task.destination, animations[i].card, true)
                    }
                }
            }
            animations.splice(i, 1);
        } else {
            i++
        }
    }

    if(gameOn || animations.length > 0) {requestAnimationFrame(gameLoop)};
}

function resizeCanvas() {
    let width, height
    if(window.innerWidth/window.innerHeight > 1.5) {
        width = innerHeight*1.5
        height = innerHeight
    } else {
        width = innerWidth
        height = innerWidth/1.5
    }

    base.style.width = width-18+"px";
    base.style.height = height-18+"px";

    cards.style.width = width-18+"px";
    cards.style.height = height-18+"px";

    foci.style.width = width-18+"px";
    foci.style.height = height-18+"px";
}

window.addEventListener('resize', resizeCanvas);