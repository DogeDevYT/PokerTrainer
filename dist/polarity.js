"use strict";

const POLARITY_SPOTS = [
  {pot:36, bet:12, value:28}, {pot:40, bet:20, value:18},
  {pot:40, bet:30, value:21}, {pot:50, bet:50, value:24},
  {pot:40, bet:50, value:18}, {pot:36, bet:54, value:15},
  {pot:30, bet:60, value:18}, {pot:60, bet:15, value:25},
];

function bluffShare(pot, bet) {
  return bet / (pot + 2 * bet);
}

function polarityPercent(fraction) {
  return (100 * fraction).toFixed(1) + "%";
}

function renderPolarity() {
  const {pot, bet, value} = evSpot;
  const target = bluffShare(pot, bet);
  const combos = value * bet / (pot + bet);
  const answered = evAnswer !== null;
  const average = stats.polarityAnswered ? (stats.polarityError / stats.polarityAnswered).toFixed(1) + " pp" : "—";
  const error = Math.abs(evAnswer - target * 100);
  const close = error <= ESTIMATE_TOLERANCE + 1e-9;
  const prompt = '<p>You bet into one opponent on the river. Your value hands always beat a bluff-catcher, and your bluffs always lose when called.</p>';
  const feedback = answered ?
    drillFeedback(close, close ? "Within 5 percentage points" : "Outside 5 percentage points",
      '<strong>' + polarityPercent(target) + ' bluffs · ' + polarityPercent(1 - target) + ' value</strong>' +
    '<p>Your estimate was ' + evAnswer + '%, a difference of ' + error.toFixed(2) + ' percentage points.</p>' +
    '<p class="ev-equation">' + bet + ' ÷ (' + pot + ' + 2 × ' + bet + ') = ' + polarityPercent(target) + '</p>' +
    '<p>With ' + value + ' value combos, that’s about <strong>' + Number(combos.toFixed(1)) + ' bluff combos</strong>. The remaining hands can check.</p>') : "";

  main.innerHTML = intro("Decision drills", "EV Trainer", "Practice balancing a river betting range.", "RIVER POLARITY") +
    '<div class="layout"><section class="panel practice">' + evModeSelect() + tutorial("polarity") +
    '<div class="spot ev-spot"><span class="chip">Heads-up river</span><h2>How often should this bet be a bluff?</h2>' + prompt +
    '<div class="summary ev-values"><div><strong>' + pot + ' BB</strong>Pot before bet</div><div><strong>' + bet + ' BB</strong>Bet size</div>' +
    '<div><strong>' + value + '</strong>Value combos</div></div></div>' +
    (answered ? '<div class="answers"><button class="primary" data-ev-next>Next spot →</button></div>' :
      '<form id="polarity-form" class="answers equity-form"><label for="polarity-estimate">Bluffs in betting range (%)</label>' +
      '<input class="wager" id="polarity-estimate" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="0–100" required>' +
      '<button class="primary" type="submit">Check estimate</button></form>') + feedback +
    '</section><aside class="rail"><section class="panel details"><h2>Your polarity stats</h2><div class="summary"><div><strong>' +
    stats.polarityAnswered + '</strong>Answered</div><div><strong>' + average + '</strong>Average error</div></div></section>' +
    '<section class="panel details"><h2>Building a polarized range</h2><p>Use strong hands for value and weak hands that benefit from folds as bluffs. Medium-strength hands often benefit from checking.</p>' +
    '<p>This benchmark makes a pure bluff-catcher indifferent between calling and folding. In real hands, which combos you choose and how often you reach the river also matter.</p></section></aside></div>';
}

function answerPolarity(estimate) {
  if (evMode !== "polarity" || evAnswer !== null || !Number.isFinite(estimate) || estimate < 0 || estimate > 100) return;
  evAnswer = estimate;
  stats.polarityAnswered++;
  stats.polarityError += Math.abs(estimate - 100 * bluffShare(evSpot.pot, evSpot.bet));
  saveStats();
  renderEv();
  pulseDrill();
  main.querySelector("[data-ev-next]").focus();
}

const POLARITY_SIZES = ["Under ¾ pot", "¾ to 1¼ pot", "Over 1¼ pot"];

function recordPolarityTag(tag) {
  const bet = table.heroRiverBet;
  if (!table.result || !bet || bet.tag || !["value", "bluff", "other"].includes(tag)) return;
  bet.tag = tag;
  if (tag !== "other") {
    const ratio = bet.size / bet.pot;
    const bucket = session.polarity[ratio < .75 ? 0 : ratio <= 1.25 ? 1 : 2];
    bucket[tag]++;
    bucket.target += bluffShare(bet.pot, bet.size);
    reviewTaggedBet(tag, bet);
  }
}

function riverPolarityPanel() {
  const bet = table.result && table.heroRiverBet;
  const rows = session.polarity.map(({value, bluff, target}, index) => {
    const total = value + bluff;
    if (!total) return "";
    return '<tr><th scope="row">' + POLARITY_SIZES[index] + '</th><td>' + value + ' / ' + bluff +
      '</td><td>' + polarityPercent(bluff / total) + '</td><td>' + polarityPercent(target / total) + '</td></tr>';
  }).join("");
  const buttons = bet && !bet.tag ?
    '<p>What was the intent of your ' + bet.size / 2 + ' BB river bet into ' + bet.pot / 2 + ' BB?</p>' +
    '<div class="answers"><button class="soft" data-polarity-tag="value">Value</button><button class="soft" data-polarity-tag="bluff">Bluff</button>' +
    '<button class="ghost" data-polarity-tag="other">Other</button></div>' : "";
  const tagged = bet?.tag ? '<p>Tagged ' + bet.tag + (bet.tag === "other" ? ' · excluded from the value/bluff mix' : '') + '.</p>' : "";
  return '<section class="panel details live-polarity"><h2>River polarity</h2>' + buttons + tagged +
    (rows ? '<table><thead><tr><th scope="col">Bet size</th><th scope="col">Value / bluff</th><th scope="col">Bluff %</th><th scope="col">Target</th></tr></thead><tbody>' +
      rows + '</tbody></table><p>Targets average the benchmark for each tagged bet in the group. A few tagged bets can swing the mix.</p>' :
      '<p>Tag your first bet on a heads-up river to compare your value and bluff mix by sizing.</p>') +
    '<a href="#polarity">Practice river polarity →</a></section>';
}




