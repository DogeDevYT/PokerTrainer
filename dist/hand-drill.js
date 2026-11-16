"use strict";

const HAND_ID_SPOTS = [
  {hero:"As Kd", board:"9c 6h 2s"},
  {hero:"Ah Jc", board:"Ad 8s 4h"},
  {hero:"Ks 9d", board:"Kc 9s 5h 2c"},
  {hero:"8c 8d", board:"8h As 5c Kd 2d"},
  {hero:"Ah 5d", board:"2c 3h 4s Qd Jc"},
  {hero:"As Js", board:"9s 6s 2s Kd Qh"},
  {hero:"7s 7d", board:"7h Kc Kd 5h 3s"},
  {hero:"Qc Qd", board:"Qs Qh 8d 4c 2s"},
  {hero:"Th Jh", board:"8h 9h Qh Kc 2s"},
  {hero:"4c 4d", board:"As Ks Qs Js Ts"},
  {hero:"Ac Jd", board:"Ah Jc 9s 9h 2d"},
  {hero:"9h 8h", board:"7c 6d 5s Tc Qh"},
];

const BOARD_ID_SPOTS = [
  {board:"As 8d 2c"}, {board:"6h 7h 8h"}, {board:"Qc Qd 2h"},
  {board:"5s 6d 7c 8h"}, {board:"As 9s 5s 2d"}, {board:"Kc Kd 7h 7s"},
  {board:"Ah 2h 3h 9d"}, {board:"As Kd Qc Jh Ts"}, {board:"As Ad 8s 6s 2h"},
  {board:"As 9d 7c 3h 2s"}, {board:"Ts 7d 4c 2h"}, {board:"Ks 9s 5s 2d 2h"}, {board:"Qh Jh Th"},
];

const HAND_DRILL_NAMES = [...HAND_NAMES, "Royal flush"];

const HAND_HINTS = [
  "No pair, straight, or flush. The highest cards break ties.",
  "Two cards of one rank, plus three kickers.",
  "Two different pairs, plus one kicker.",
  "Three cards of one rank, plus two kickers.",
  "Five consecutive ranks. An ace can play low in A–2–3–4–5.",
  "Five cards of one suit. Their ranks need not be consecutive.",
  "Three of a kind and a pair.",
  "Four cards of one rank, plus one kicker.",
  "Five consecutive cards of one suit, topped by a king or lower.",
  "Ten, jack, queen, king, and ace of the same suit. This is the highest straight flush.",
];

let handMode = "identify";
let handQueue = [];
let handSpot = null;
let handStarted = null;
let handElapsed = 0;
let handReview = null;

function handDrillCategory([category, high]) {
  return category === 8 && high === 14 ? HAND_DRILL_NAMES.length - 1 : category;
}

function bestBoardHands(board) {
  const known = new Set(board.map(card => card.rank + card.suit));
  const deck = fullDeck().filter(card => !known.has(card.rank + card.suit));
  const counts = HAND_DRILL_NAMES.map(() => 0);
  let top = [];
  let example;
  for (let first = 0; first < deck.length; first++) {
    for (let second = first + 1; second < deck.length; second++) {
      const hole = [deck[first], deck[second]];
      const score = bestHand([...board, ...hole]);
      counts[handDrillCategory(score)]++;
      if (compareScores(score, top) > 0) {
        top = score;
        example = hole;
      }
    }
  }
  return {category:handDrillCategory(top), counts, example};
}

function setHandMode(value) {
  handMode = value;
  handQueue = [];
  handSpot = null;
  handStarted = null;
  handReview = null;
  renderHandDrill();
}

function nextHandDrill() {
  if (!handQueue.length) {
    handQueue = [...(handMode === "identify" ? HAND_ID_SPOTS : BOARD_ID_SPOTS)];
    for (let index = handQueue.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [handQueue[index], handQueue[other]] = [handQueue[other], handQueue[index]];
    }
    if (handQueue.at(-1) === handSpot) handQueue.unshift(handQueue.pop());
  }
  handSpot = handQueue.pop();
  handReview = null;
  handElapsed = 0;
  handStarted = performance.now();
  renderHandDrill();
  main.querySelector("[data-hand-rank]").focus();
}

function pauseHandDrill() {
  if (handStarted === null) return;
  handElapsed += performance.now() - handStarted;
  handStarted = null;
}

function answerHandDrill(choice) {
  if (!handSpot || handReview || handStarted === null || !Number.isInteger(choice) || !HAND_DRILL_NAMES[choice]) return;
  pauseHandDrill();
  const board = equityCards(handSpot.board);
  const review = handMode === "identify" ?
    {category:handDrillCategory(bestHand([...equityCards(handSpot.hero), ...board]))} : bestBoardHands(board);
  handReview = {...review, correct:choice === review.category, seconds:handElapsed / 1000, choice};
  const progress = stats.handSpeed[handMode];
  progress.answered++;
  if (handReview.correct) {
    progress.correct++;
    progress.seconds += handReview.seconds;
  }
  saveStats();
  renderHandDrill();
  pulseDrill();
  main.querySelector("[data-hand-start]").focus();
}

function handDrillFeedback() {
  if (!handReview) return "";
  const {category, choice, correct, seconds, counts, example} = handReview;
  const possible = counts ? '<p><strong>Example hole cards.</strong> ' + example.map(card => card.rank + card.suit).join(" ") +
    ' can make the strongest hand.</p><details class="possible-hands"><summary>See every possible hand category</summary>' +
    '<table><thead><tr><th scope="col">Best made hand</th><th scope="col">Hole-card combos</th></tr></thead><tbody>' +
    counts.map((count, index) => count ? '<tr><th scope="row">' + HAND_DRILL_NAMES[index] + '</th><td>' + count + '</td></tr>' : '').reverse().join("") +
    '</tbody></table><p>Each possible pair of hole cards counts once, under its best hand on this board.</p></details>' : "";
  return drillFeedback(correct, correct ? "Correct" : "Incorrect",
    '<strong>' + HAND_DRILL_NAMES[category] + '</strong> · ' + seconds.toFixed(1) + ' s' +
    (correct ? "" : '<p>You chose ' + HAND_DRILL_NAMES[choice].toLowerCase() + '.</p>') +
    '<p>' + HAND_HINTS[category] + '</p>' + possible);
}

function renderHandDrill() {
  const identify = handMode === "identify";
  const progress = stats.handSpeed[handMode];
  const precision = progress.answered ? Math.round(progress.correct / progress.answered * 100) + "%" : "—";
  const speed = progress.correct ? (progress.seconds / progress.correct).toFixed(1) + " s" : "—";
  const showCards = (label, source) => '<div class="equity-hand"><span>' + label + '</span><div class="cards">' +
    equityCards(source).map(card => cardMarkup(card)).join("") + '</div></div>';
  const options = [['identify','Identify your hand'],['board','Read the board']].map(([mode,label]) =>
    '<option value="' + mode + '"' + (handMode === mode ? " selected" : "") + '>' + label + '</option>').join("");
  const prompt = identify ? "What’s your best made hand?" : "What’s the strongest hand possible?";
  const board = handSpot ? equityCards(handSpot.board) : [];
  const table = handSpot ?
    '<div class="spot hand-spot"><span class="chip">' + STREETS[board.length - 2] + (handReview ? '' : ' · Timed') +
    '</span><h2>' + prompt + '</h2><div class="equity-cards">' +
    (identify ? showCards("Your hand", handSpot.hero) : '') + showCards("Board", handSpot.board) + '</div>' +
    '<p>' + (identify ? 'Choose the best five-card category you can make now.' : 'Imagine any two unseen hole cards. Choose the strongest category possible right now.') + '</p></div>' +
    '<div class="hand-answers">' + HAND_DRILL_NAMES.map((name,index) =>
      '<button class="soft" data-hand-rank="' + index + '"' + (handReview ? ' disabled' : '') + '>' + name + '</button>').join("") +
    '</div>' + handDrillFeedback() +
    (handReview ? '<div class="answers"><button class="primary" data-hand-start>Next spot →</button></div>' : '') :
    '<div class="spot hand-spot"><h2>' + prompt + '</h2><p>The clock starts when the cards are dealt.</p><button class="primary" data-hand-start>Start timed drill</button></div>';
  main.innerHTML = intro("Recognition drills", "Hand ID", "Build speed reading made hands and community cards.", "TIMED PRACTICE") +
    '<div class="layout"><section class="panel practice"><div class="controls"><label>Drill<select id="hand-drill-mode">' + options +
    '</select></label></div>' + tutorial("hands") + table +
    '</section><aside class="rail"><section class="panel details"><h2>Speed and accuracy</h2><div class="summary hand-speed"><div><strong>' +
    progress.answered + '</strong>Attempts</div><div><strong>' + precision + '</strong>Accuracy</div><div><strong>' + speed +
    '</strong>Avg. correct time</div></div></section></aside></div>';
}

