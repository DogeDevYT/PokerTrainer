"use strict";

// The reward is the pot already on the table. The risk is the new money
// committed. A showdown spot assumes no future betting and no rake.
const EV_SPOTS = {
  call: [
    {reward:30, risk:10, chance:30}, {reward:45, risk:15, chance:22},
    {reward:24, risk:16, chance:40}, {reward:36, risk:24, chance:44},
    {reward:28, risk:8, chance:20}, {reward:50, risk:25, chance:35},
    {reward:32, risk:12, chance:26}, {reward:60, risk:20, chance:25},
  ],
  bluff: [
    {reward:20, risk:15, chance:50}, {reward:30, risk:20, chance:35},
    {reward:25, risk:25, chance:50}, {reward:40, risk:30, chance:46},
    {reward:18, risk:9, chance:30}, {reward:24, risk:36, chance:64},
    {reward:30, risk:45, chance:56}, {reward:40, risk:10, chance:20},
  ],
};

let evMode = "mixed";
let evQueue = [];
let evSpot;
let evAnswer = null;
let exploredChance;

function nextEvSpot() {
  if (!evQueue.length) {
    const banks = {...EV_SPOTS, equity:EQUITY_SPOTS, polarity:POLARITY_SPOTS};
    const types = evMode === "mixed" ? Object.keys(EV_SPOTS) : [evMode];
    evQueue = types.flatMap(type => banks[type].map((spot, index) => ({...spot, type, id:type + index})));
    for (let index = evQueue.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [evQueue[index], evQueue[other]] = [evQueue[other], evQueue[index]];
    }
    if (evSpot && evQueue.at(-1).id === evSpot.id) {
      evQueue.unshift(evQueue.pop());
    }
  }
  evSpot = evQueue.pop();
  evAnswer = null;
  exploredChance = evSpot.chance;
}

function evNumerator({reward, risk}, chance) {
  return chance * reward - (100 - chance) * risk;
}

function gradeEv(spot) {
  return Math.sign(evNumerator(spot, spot.chance));
}

function evAmount(numerator) {
  const amount = numerator / 100;
  return (amount > 0 ? "+" : "") + amount.toFixed(2) + " BB";
}

function answerEv(answer) {
  if (evAnswer !== null) return;
  evAnswer = answer;
  stats.evAnswered++;
  if (answer === gradeEv(evSpot)) stats.evCorrect++;
  saveStats();
  renderEv();
  pulseDrill();
  main.querySelector("[data-ev-next]").focus();
}

function evMeter(spot, chance) {
  const breakEven = 100 * spot.risk / (spot.reward + spot.risk);
  return '<div class="ev-track" aria-hidden="true" style="--threshold:' + breakEven + '%;--chance:' + chance + '%"><span></span><i></i></div>' +
    '<div class="ev-scale"><span>−EV</span><span>Break-even ' + Number(breakEven.toFixed(2)) + '%</span><span>+EV</span></div>';
}

function evModeSelect() {
  const modes = [["equity", "Showdown equity"], ["polarity", "River polarity"], ["mixed", "Mix calls and bluffs"], ["call", "Calls"], ["bluff", "Bluffs"]];
  return '<div class="controls"><label>Spot type<select id="ev-mode">' +
    modes.map(([value, label]) => '<option value="' + value + '"' + (evMode === value ? ' selected' : '') + '>' + label + '</option>').join("") +
    '</select></label></div>';
}

function renderEv() {
  if (!evSpot) nextEvSpot();
  if (evMode === "equity") return renderEquity();
  if (evMode === "polarity") return renderPolarity();
  const {type, reward, risk, chance} = evSpot;
  const call = type === "call";
  const action = call ? "Call" : "Bluff";
  const baseline = call ? "Folding" : "Checking";
  const chanceLabel = call ? "Showdown equity" : "Opponent folds";
  const answered = evAnswer !== null;
  const grade = gradeEv(evSpot);
  const expected = evAmount(evNumerator(evSpot, chance));
  const correctLabel = grade > 0 ? "Take the spot" : grade < 0 ? "Pass" : "Break-even";
  const accuracy = stats.evAnswered ? Math.round(100 * stats.evCorrect / stats.evAnswered) + "%" : "—";

  main.innerHTML = intro("Decision drills", "EV Trainer", "Weigh the chips at risk against what you can win.", "RISK / REWARD") +
    '<div class="layout"><section class="panel practice">' + evModeSelect() + tutorial("ev") + '<div class="spot ev-spot"><span class="chip">' + (call ? 'River call' : 'River bluff') + '</span><h2>' + (call ? 'Is this call profitable?' : 'Is this bluff profitable?') +
    '</h2><p>' + (call ? 'The pot includes your opponent’s river bet. Calling closes the action.' : 'Your hand has zero showdown equity. A fold wins the pot, and a call loses your bet.') +
    '</p><div class="summary ev-values"><div><strong>' + reward + ' BB</strong>Pot to win</div><div><strong>' + risk + ' BB</strong>' +
    (call ? 'Cost to call' : 'Bluff size') + '</div><div><strong>' + chance + '%</strong>' + chanceLabel + '</div></div></div>' +
    '<div class="answers">' + [[1, action + " (+EV)"], [-1, "Pass (−EV)"], [0, "Break-even"]].map(([value,label]) =>
      '<button class="' + (value === 1 ? 'primary' : 'soft') + '" data-ev-answer="' + value + '"' + (answered ? ' disabled' : '') + '>' + label + '</button>').join("") +
    (answered ? '<button class="ghost" data-ev-next>Next spot →</button>' : '') + '</div>' +
    (answered ? drillFeedback(evAnswer === grade, evAnswer === grade ? "Correct" : "Incorrect",
      '<strong>Best answer · ' + correctLabel + '.</strong> ' + action + ' EV is <strong>' + expected + '</strong> versus ' +
      baseline.toLowerCase() + ' (0 BB).<div class="ev-equation">' + chance + '% × ' + reward + ' BB − ' +
      (100 - chance) + '% × ' + risk + ' BB = ' + expected + '</div>') +
      '<div class="ev-explore"><label for="ev-chance">Try a different ' + (call ? 'equity' : 'fold rate') + '</label><input id="ev-chance" type="range" min="0" max="100" value="' + exploredChance +
      '"><output for="ev-chance" id="ev-output"></output><div id="ev-meter"></div></div>' : '') + '</section>' +
    '<aside class="rail"><section class="panel details"><h2>Your EV stats</h2><div class="summary"><div><strong>' + stats.evAnswered +
    '</strong>Answered</div><div><strong>' + accuracy + '</strong>Accuracy</div></div></section>' +
    '<section class="panel details"><h2>Break-even probability</h2><p>Divide the amount you risk by the pot you can win plus that risk. Above this threshold, the play gains chips on average.</p>' +
    '<p>Each spot measures EV from the current decision, before rake. ' + baseline + ' is the 0 BB baseline.</p></section></aside></div>';
  if (answered) updateEvExplorer(exploredChance);
}

function updateEvExplorer(chance) {
  exploredChance = chance;
  document.querySelector("#ev-output").textContent = chance + "% · " + evAmount(evNumerator(evSpot, chance));
  document.querySelector("#ev-meter").innerHTML = evMeter(evSpot, chance);
}





