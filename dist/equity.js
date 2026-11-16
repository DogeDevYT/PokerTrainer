"use strict";

const EQUITY_SPOTS = [
  {hero:"As Js", villain:"Kh Kd", board:"Ks 7s 2d", reward:42, risk:18,
    note:"Start by counting the spades. A flush can still lose if the board pairs and your opponent makes a full house or quads."},
  {hero:"9h 8h", villain:"As Ad", board:"7c 6s Kd 2c", reward:32, risk:8,
    note:"Any five or ten completes your straight. With one card to come, count those eight outs among the 44 unseen cards."},
  {hero:"Ac Kc", villain:"Qs Qh", board:"Jc 7c 2d 4s", reward:45, risk:15,
    note:"A club makes a flush. An ace or king also wins, so count the non-club aces and kings as separate outs."},
  {hero:"Ac Ah", villain:"Ks Kh", board:"Jd 8s 4h 2c", reward:55, risk:25,
    note:"Try estimating from the other side. Your opponent has two kings left to make a set."},
  {hero:"Ac Kd", villain:"As Qh", board:"Jh Tc 9s 8d", reward:60, risk:20,
    note:"The opponent already has a queen-high straight. A queen makes your king-high straight. A seven puts a straight on the board, but the opponent’s queen still plays."},
  {hero:"As 5h", villain:"Ad 6h", board:"Kh Qc Jd Ts", reward:40, risk:20,
    note:"Both players already have Broadway. The four board cards have different suits and ranks, so one river card cannot give either player a flush or a full house. The pot always splits."},
  {hero:"Ac Qd", villain:"Js Jh", board:"Td 7c 2s", reward:50, risk:25,
    note:"Two overcards give you six immediate pair outs. With two cards to come, also account for backdoor wins and for your opponent improving after you hit."},
  {hero:"8c 8d", villain:"Ah Kh", board:"As 8h 2h", reward:54, risk:18,
    note:"Your set leads now. The opponent can make a flush, but the set can improve to a full house or quads."},
];

function equityCards(source) {
  return source.split(" ").map(([rank, suit]) => ({
    rank, suit:SUITS["shdc".indexOf(suit)], value:14 - RANKS.indexOf(rank)
  }));
}

function showdownEquity(hero, villain, board) {
  const known = new Set([...hero, ...villain, ...board].map(card => card.rank + card.suit));
  const unseen = [...RANKS].flatMap((rank, index) => SUITS.map(suit => ({rank, suit, value:14 - index})))
    .filter(card => !known.has(card.rank + card.suit));
  let wins = 0;
  let ties = 0;
  let losses = 0;

  function scoreRunout(runout) {
    const shared = [...board, ...runout];
    const result = compareScores(bestHand([...hero, ...shared]), bestHand([...villain, ...shared]));
    if (result > 0) wins++;
    else if (result === 0) ties++;
    else losses++;
  }

  if (board.length === 4) {
    for (const card of unseen) scoreRunout([card]);
  } else {
    for (let first = 0; first < unseen.length; first++) {
      for (let second = first + 1; second < unseen.length; second++) {
        scoreRunout([unseen[first], unseen[second]]);
      }
    }
  }

  const total = wins + ties + losses;
  return {wins, ties, losses, total, percent:100 * (wins + ties / 2) / total};
}

function equityPercent(value) {
  return value.toFixed(2) + "%";
}

let equityResult = null;

function answerEquity(estimate) {
  if (evMode !== "equity" || evAnswer !== null || !Number.isFinite(estimate) || estimate < 0 || estimate > 100) return;
  evAnswer = estimate;
  equityResult = showdownEquity(equityCards(evSpot.hero), equityCards(evSpot.villain), equityCards(evSpot.board));
  stats.equityAnswered++;
  stats.equityError += Math.abs(estimate - equityResult.percent);
  saveStats();
  renderEv();
  pulseDrill();
  main.querySelector("[data-ev-next]").focus();
}

function renderEquity() {
  const {hero, villain, board, risk, reward, note} = evSpot;
  const shared = equityCards(board);
  const answered = evAnswer !== null;
  const averageError = stats.equityAnswered ? (stats.equityError / stats.equityAnswered).toFixed(1) + " pp" : "—";
  const hand = (label, cards) => '<div class="equity-hand"><span>' + label + '</span><div class="cards">' +
    cards.map(card => cardMarkup(card)).join("") + '</div></div>';
  let feedback = "";
  if (answered) {
    const {wins, ties, losses, total, percent} = equityResult;
    const expected = evAmount(evNumerator(evSpot, percent));
    const breakEven = equityPercent(100 * risk / (risk + reward));
    const error = Math.abs(evAnswer - percent);
    const close = error <= ESTIMATE_TOLERANCE + 1e-9;
    feedback = drillFeedback(close, close ? "Within 5 percentage points" : "Outside 5 percentage points",
      '<strong>' + equityPercent(percent) + ' showdown equity</strong>' +
      '<p>Your estimate was ' + equityPercent(evAnswer) + ', a difference of ' + error.toFixed(2) + ' percentage points.</p>' +
      '<p>' + wins + ' wins · ' + ties + ' ties · ' + losses + ' losses across ' + total + ' possible runouts.</p>' +
      '<p class="ev-equation">(' + wins + ' + ' + ties + ' ÷ 2) ÷ ' + total + ' = ' + equityPercent(percent) + '</p>' +
      '<p>' + note + '</p>') + '<div class="ev-explore equity-ev"><strong>Call EV ' + expected + '</strong>' +
      '<span>Break-even equity ' + breakEven + '</span><div id="ev-meter">' + evMeter(evSpot, percent) + '</div></div>';
  }

  main.innerHTML = intro("Decision drills", "EV Trainer", "Estimate showdown equity and see what it means for a call.", "SHOWDOWN EQUITY") +
    '<div class="layout"><section class="panel practice">' + evModeSelect() + tutorial("equity") +
    '<div class="spot ev-spot equity-spot"><span class="chip">' + (shared.length === 3 ? 'Flop' : 'Turn') + ' · Heads-up all-in</span><h2>What’s your showdown equity?</h2>' +
    '<div class="equity-cards">' + hand("Your hand", equityCards(hero)) + hand("Opponent", equityCards(villain)) + hand("Board", shared) + '</div>' +
    '<div class="summary equity-pot"><div><strong>' + reward + ' BB</strong>Pot after the bet</div><div><strong>' + risk + ' BB</strong>Cost to call</div></div></div>' +
    (answered ? '<div class="answers"><button class="primary" data-ev-next>Next spot →</button></div>' :
      '<form id="equity-form" class="answers equity-form"><label for="equity-estimate">Your equity (%)</label><input class="wager" id="equity-estimate" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="0–100" required><button class="primary" type="submit">Check estimate</button></form>') +
    feedback + '</section><aside class="rail"><section class="panel details"><h2>Your equity stats</h2><div class="summary"><div><strong>' +
    stats.equityAnswered + '</strong>Answered</div><div><strong>' + averageError + '</strong>Average error</div></div></section>' +
    '<section class="panel details"><h2>Estimating equity</h2><p>Count clean outs that make you the winner. Multiply by roughly 2 with one card to come or 4 with two cards to come.</p>' +
    '<p>If you’re already ahead, start by counting your opponent’s outs. A tie contributes half a win to heads-up equity.</p>' +
    '<p>Each drill shows one specific opponent hand. The call closes the action and assumes no rake.</p></section></aside></div>';
}




