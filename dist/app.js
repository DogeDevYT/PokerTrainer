"use strict";

const main = document.querySelector("#main");
const progressDialog = document.querySelector("#progress-dialog");
const defaults = {hands:0, wins:0, net:0, drills:0, correct:0, ranges:0, evAnswered:0, evCorrect:0, equityAnswered:0, equityError:0, polarityAnswered:0, polarityError:0, handSpeed:{identify:{answered:0,correct:0,seconds:0},board:{answered:0,correct:0,seconds:0}}};
let stats = {...defaults};
try { stats = {...stats, ...JSON.parse(localStorage.getItem("pokerlab-progress"))}; } catch {}
function saveStats() {
  try { localStorage.setItem("pokerlab-progress", JSON.stringify(stats)); } catch {}
}

const SESSION_MODES = {
  single:{label:"Single hand", limit:1, start:"Play one hand"},
  infinite:{label:"Infinite hands", limit:Infinity, start:"Start infinite session"},
};
let nextMode = "infinite";
let session = newSession(nextMode);
const table = new HoldemTable();

function newSession(mode) {
  return {mode, hands:0, net:0, adjusted:0, runouts:0, metrics:newPlayMetrics(), polarity:POLARITY_SIZES.map(() => ({value:0, bluff:0, target:0}))};
}

function sessionComplete() {
  return session.hands >= SESSION_MODES[session.mode].limit;
}
table.deal();
let timer = null;
let tab;
let lastCounted = 0;
let drillPosition = "BTN";
let rangePosition = "BTN";
let rangeMode = "study";
let rangeGoal = "Raise";
let rangeFilter = "";
let rangeThreshold = 50;
let selected = new Set();
let checkedRange = false;
let focusedHand = "AKs";
let drill = newDrill();

function newDrill() {
  const position = drillPosition === "Mix" ? POSITIONS[Math.floor(Math.random() * POSITIONS.length)] : drillPosition;
  const cards = shuffledDeck().slice(0, 2);
  return {position, cards, code:handCode(cards), answer:null};
}

function cardMarkup(card, empty = false) {
  if (!card) return empty ? '<span class="card empty" aria-hidden="true"></span>' : "";
  return '<span class="card ' + (["♥", "♦"].includes(card.suit) ? "red" : "") + '" aria-label="' + card.rank + card.suit + '">' + card.rank + '<small>' + card.suit + '</small></span>';
}

function intro(label, title, description, badge) {
  return '<section class="intro"><div><div class="eyebrow">' + label + '</div><h1>' + title + '</h1><p>' + description + '</p></div><span class="chip">' + badge + '</span></section>';
}

const ESTIMATE_TOLERANCE = 5;

function drillFeedback(correct, label, content) {
  const result = correct ? "correct" : "incorrect";
  const mark = correct ? "✓" : "×";
  return '<div class="feedback equity-feedback" data-result="' + result + '"><div class="feedback-heading">' +
    '<span class="feedback-mark" aria-hidden="true">' + mark + '</span><strong>' + label + '</strong></div>' +
    '<div class="feedback-content">' + content + '</div></div>';
}

function pulseDrill() {
  const feedback = main.querySelector("[data-result]");
  if (!feedback) return;
  const panel = feedback.closest(".practice");
  panel.dataset.impact = feedback.dataset.result;
  const heading = feedback.querySelector(".feedback-heading strong").textContent;
  const explanation = feedback.querySelector(".feedback-content").textContent;
  document.querySelector("#drill-announcement").textContent = heading + ". " + explanation;
}

function panelTitle(symbol, title, trailing = "") {
  return '<div class="panel-title"><strong><span aria-hidden="true">' + symbol + '</span>' + title + '</strong>' + trailing + '</div>';
}

function seatMarkup(index) {
  const [name, initials, color] = PLAYERS[index];
  const player = table.players[index];
  const stack = table.stack(index) + (table.result?.chips[index] ?? 0);
  const reveal = index === 0 || (table.result?.showdown && !player.folded);
  return '<div class="seat s' + index + (index === 0 ? ' hero' : '') + (player.folded ? ' folded' : '') + (table.actor === index ? ' acting' : '') + '">' +
    (reveal ? '<div class="cards ' + (index ? 'mini' : '') + '">' + player.cards.map(card => cardMarkup(card)).join("") + '</div>' : '<div class="avatar" style="background:' + color + '">' + initials + '</div>') +
    '<div class="seat-info">' + name + ' · ' + table.position(index) + '<span class="money">' + stack / 2 + ' BB</span></div>' +
    (table.dealer === index ? '<span class="dealer" title="Dealer button">D</span>' : '') +
    (!table.result && player.wager ? '<span class="bet">' + player.wager / 2 + ' BB</span>' : '') + '</div>';
}

function tableControls() {
  if (table.result) {
    const {winners, awards, net, adjusted, adjustedRunout} = table.result;
    const names = winners.map(index => PLAYERS[index][0]).join(" & ");
    const summary = winners.length > 1 ? (awards.length > 1 ? "Multiple pot winners" : names + " split the pot") :
      winners[0] === 0 ? "You win the hand" : names + " wins the hand";
    const newRun = sessionComplete() || nextMode !== session.mode;
    const next = newRun ? SESSION_MODES[nextMode].start : "Next hand";
    return '<div><strong>' + summary + '</strong><small>Your net ' + bbScore(net) +
      (adjustedRunout ? ' · Adjusted EV ' + bbScore(adjusted) : '') + '</small></div><button class="primary" data-act="deal">' + next + ' →</button>';
  }
  if (table.actor !== 0) return '<div><strong>' + PLAYERS[table.actor][0] + ' to act</strong><small>' + STREETS[table.street] + '</small></div>';
  const call = table.toCall(0);
  const min = table.minTarget(0) / 2;
  const max = table.maxTarget(0) / 2;
  const starting = table.street === 0 && table.currentBet === 2 ? Math.max(min, 2.5) : min;
  return '<div><strong>Your turn</strong><small>' + (call ? call / 2 + ' BB to call' : (table.canRaise(0) ? 'You can check or ' + (table.currentBet ? 'raise' : 'bet') : 'You can check')) + '</small></div><div class="action-buttons">' +
    (call ? '<button class="danger" data-act="fold">Fold</button>' : '') +
    '<button class="soft" data-act="pass">' + (call ? 'Call ' + call / 2 + ' BB' + (call === table.stack(0) ? ' · All-in' : '') : 'Check') + '</button>' +
    (table.canRaise(0) ? '<input class="wager" id="wager" type="number" inputmode="decimal" aria-label="Total wager in big blinds" title="Total wager in big blinds" min="' + min + '" max="' + max + '" step="0.5" value="' + Math.min(starting, max) + '"><button class="primary" data-act="raise">' + (table.currentBet ? 'Raise' : 'Bet') + '</button>' : '') + '</div>';
}

function renderPlay() {
  if (!main.querySelector("#play-table")) {
    main.innerHTML = intro("Practice table", "Play vs Bots", "Play six-max No-Limit Hold’em against five computer opponents.", "6-MAX CASH") +
      '<div class="layout"><section class="panel" id="play-table"><div class="table-head"><div><strong><i class="status-dot"></i>Training Table</strong><small>No-Limit Hold’em</small></div><div class="tools"><span class="chip">0.5 / 1 BB</span></div></div>' +
      '<div class="play-tutorial">' + tutorial("play") + '</div>' + sessionControls() + '<div class="arena" id="play-arena"></div><div class="action-bar" id="play-actions" aria-live="polite"></div></section>' +
      '<aside class="rail"><div id="play-score"></div><div id="play-polarity"></div><div id="play-metrics"></div><section class="panel"><div id="play-history-heading"></div>' +
      '<ol id="play-history" class="history" aria-label="Most recent actions first"></ol></section>' +
      '<section class="panel guide"><div class="section-label">Preflop practice</div><h2>What would you open?</h2><p>Get a starting hand and a position, then choose your action and get feedback.</p><a href="#drill">Start a preflop drill →</a></section>' +
      '<a href="#range" class="panel shortcut"><strong>Range Trainer</strong><small>Study or recall the 169 starting hands.</small><span class="arrow">↗</span></a></aside></div>';
  }

  const arena = '<div class="felt"></div><div class="board"><div class="pot"><i>◉</i> POT ' + (table.result?.pot ?? table.pot()) / 2 + ' BB</div><div class="cards">' +
    Array.from({length:5}, (_, index) => cardMarkup(table.board[index], true)).join("") + '</div><div class="street">' +
    STREETS[table.street] + ' · Hand #' + table.number + '</div></div>' + PLAYERS.map((_, index) => seatMarkup(index)).join("");
  main.querySelector("#play-arena").innerHTML = arena;
  main.querySelector("#play-actions").innerHTML = tableControls();
  main.querySelector("#session-status").textContent = sessionStatus();

  const scorePanel = main.querySelector("#play-score");
  const score = sessionScore();
  if (scorePanel.dataset.markup !== score) {
    const detailsOpen = scorePanel.querySelector("details")?.open;
    scorePanel.dataset.markup = score;
    scorePanel.innerHTML = score;
    scorePanel.querySelector("details").open = Boolean(detailsOpen);
  }
  const metricsPanel = main.querySelector("#play-metrics");
  const metrics = playMetricsPanel();
  if (metricsPanel.dataset.markup !== metrics) {
    const detailsOpen = metricsPanel.querySelector("details")?.open;
    metricsPanel.dataset.markup = metrics;
    metricsPanel.innerHTML = metrics;
    const details = metricsPanel.querySelector("details");
    if (details) details.open = Boolean(detailsOpen);
  }
  main.querySelector("#play-polarity").innerHTML = riverPolarityPanel();
  main.querySelector("#play-history-heading").innerHTML = panelTitle("↶", "Hand history", '<small class="chip">#' + table.number + '</small>');
  main.querySelector("#play-history").innerHTML = table.history.map(line => '<li>' + line + '</li>').join("");
}

function bbScore(value) {
  const rounded = Math.round(value * 100) / 100;
  return (rounded > 0 ? "+" : "") + rounded.toFixed(2) + " BB";
}

function sessionControls() {
  const options = Object.entries(SESSION_MODES).map(([value, mode]) =>
    '<option value="' + value + '"' + (value === nextMode ? ' selected' : '') + '>' + mode.label + '</option>').join("");
  return '<div class="session-controls"><label>Session mode <select id="session-mode">' + options +
    '</select></label><span id="session-status"></span></div>';
}

function sessionStatus() {
  const mode = SESSION_MODES[session.mode];
  const hand = session.hands + (table.result ? 0 : 1);
  return 'Hand ' + hand + (Number.isFinite(mode.limit) ? ' of ' + mode.limit : '') +
    (nextMode !== session.mode ? ' · New mode starts on the next deal' : '');
}

function sessionScore() {
  return '<section class="panel details session-score"><h2>Session score</h2><div class="summary"><div><strong>' +
    bbScore(session.net) + '</strong>Actual net</div><div><strong>' + bbScore(session.adjusted) +
    '</strong>All-in-adjusted EV</div></div><details><summary>How EV is scored</summary>' +
    '<p>When betting closes before the river with you eligible for a contested pot, the score uses your expected payout against the live hands. It samples earlier runouts and enumerates turn runouts. Other hands use the actual result.</p>' +
    '<p>Actual minus adjusted results: ' + bbScore(session.net - session.adjusted) + '.</p><p>' + session.runouts + ' adjusted ' + (session.runouts === 1 ? 'hand.' : 'hands.') + ' Stacks carry over. Busted seats rebuy for 100 BB before the next hand.</p></details></section>';
}

function recordResult() {
  if (!table.result || lastCounted === table.number) return;
  lastCounted = table.number;
  const {net, adjusted, adjustedRunout, winners} = table.result;
  session.hands++;
  session.net += net;
  session.adjusted += adjusted;
  if (adjustedRunout) session.runouts++;
  reviewCompletedHand();
  stats.hands++;
  if (winners.includes(0)) stats.wins++;
  stats.net += net;
  saveStats();
}

function updateTable() {
  clearTimeout(timer);
  recordResult();
  if (tab !== "play") return;
  renderPlay();
  if (!table.result && table.actor !== 0) {
    timer = setTimeout(() => {
      table.botAct();
      updateTable();
    }, 340);
  }
}

function scenario(position) {
  return position === "BB" ? "Button opens to 2.5 BB. The small blind folds." : "Action folds to you. Choose whether to open the pot.";
}

function positionSelect(id, current, mix = false) {
  const options = mix ? [...POSITIONS, "Mix"] : POSITIONS;
  return '<label>Position<select id="' + id + '">' + options.map(position => '<option value="' + position + '"' + (position === current ? ' selected' : '') + '>' + (position === "Mix" ? "Random position" : position) + '</option>').join("") + '</select></label>';
}

function renderDrill() {
  const accuracy = stats.drills ? Math.round(stats.correct / stats.drills * 100) + "%" : "—";
  const correct = chartAction(drill.position, drill.code);
  const correctLabel = correct === "Raise" && drill.position === "BB" ? "3-bet" : correct;
  const reason = drill.code + (correct === "Fold" ? ' falls outside the ' + drill.position + ' continuing range.' :
    ' is in the ' + drill.position + ' ' + (correct === "Raise" ? (drill.position === "BB" ? "3-bet" : "opening") : "calling") + ' range.');
  const feedback = drill.answer ? drillFeedback(drill.answer === correct, drill.answer === correct ? "Correct" : "Incorrect",
    '<strong>Chart action · ' + correctLabel + '.</strong> ' + reason) : "";
  main.innerHTML = intro("Decision drills", "Preflop Drill", "Practice one preflop decision at a time and check it against the chart.", "100 BB · 6-MAX") +
    '<div class="layout"><section class="panel practice">' + tutorial("preflop") + '<div class="controls">' + positionSelect("drill-position", drillPosition, true) + '</div>' +
    '<div class="spot"><span class="chip">' + drill.position + ' · ' + (drill.position === "BB" ? 'Facing BTN open' : 'Unopened pot') + '</span><div class="cards">' +
    drill.cards.map(card => cardMarkup(card)).join("") + '</div><h2>' + drill.code + '</h2><p>' + scenario(drill.position) + '</p></div><div class="answers">' +
    (drill.position === "BB" ? ["Fold", "Call", "Raise"] : ["Fold", "Raise"]).map(action => '<button class="' + (action === "Raise" ? "primary" : "soft") + '" data-answer="' + action + '"' + (drill.answer ? " disabled" : "") + '>' + (action === "Raise" && drill.position === "BB" ? "3-bet" : action) + '</button>').join("") +
    '<button class="ghost" data-drill-next>' + (drill.answer ? 'Next hand →' : 'Skip') + '</button></div>' + feedback + '</section>' +
    '<aside class="rail"><section class="panel details"><h2>Your drill stats</h2><div class="summary"><div><strong>' + stats.drills + '</strong>Answered</div><div><strong>' + accuracy + '</strong>Accuracy</div></div></section>' +
    '<section class="panel details"><h2>Chart setup</h2><p>Six-max cash, 100 BB effective. Practice opening from UTG through SB, or defending the BB against a BTN open.</p><p>These simplified GTO-style charts use one action per hand. They are approximate and do not include solver frequencies.</p><a class="soft ghost" href="#range">Open range chart →</a></section></aside></div>';
}

const MATRIX = [...RANKS].flatMap((row, index) => [...RANKS].map((column, other) => index === other ? row + column : index < other ? row + column + "s" : column + row + "o"));
function comboCount(code) { return code.length === 2 ? 6 : code.endsWith("s") ? 4 : 12; }

function rangeActionLabel(action) {
  return rangePosition === "BB" && action === "Raise" ? "3-bet" : action;
}

function rangeMixBar(frequencies, className = "range-mix") {
  return '<span class="' + className + '" aria-hidden="true">' +
    RANGE_ACTIONS.filter(action => frequencies[action] > 0).map(action =>
      '<i class="range-' + action.toLowerCase() + '" style="flex-basis:' + frequencies[action] + '%"></i>').join("") + '</span>';
}

function rangeThresholdControls(actions) {
  const options = actions.map(action => '<option value="' + action + '"' + (rangeFilter === action ? ' selected' : '') + '>' +
    rangeActionLabel(action) + '</option>').join("");
  return '<div class="range-threshold"><div class="controls"><label>Highlight action<select id="range-filter">' +
    '<option value="">All actions</option>' + options + '</select></label><label class="range-threshold-slider"><span>Minimum frequency <output id="range-threshold-value" for="range-threshold">' +
    rangeThreshold + '%</output></span><input id="range-threshold" type="range" min="1" max="100" aria-describedby="range-threshold-summary" value="' + rangeThreshold + '"' +
    (rangeFilter ? '' : ' disabled') + '></label></div><p id="range-threshold-summary"></p></div>';
}

function updateRangeThreshold() {
  const filter = document.getElementById("range-filter");
  if (!filter) return;
  document.getElementById("range-threshold").disabled = !rangeFilter;
  document.getElementById("range-threshold-value").textContent = rangeThreshold + "%";
  let hands = 0;
  let combos = 0;
  main.querySelectorAll(".range-cell").forEach(cell => {
    const code = cell.dataset.hand;
    const frequency = rangeFrequencies(rangePosition, code)[rangeFilter] ?? 0;
    const qualifies = rangeFilter && frequency >= rangeThreshold;
    cell.classList.toggle("range-below", Boolean(rangeFilter && !qualifies));
    if (qualifies) {
      hands++;
      combos += comboCount(code);
    }
  });
  document.getElementById("range-threshold-summary").textContent = rangeFilter ?
    hands + " of 169 hand classes · " + combos + " of 1,326 possible card combos meet the cutoff." :
    "Choose an action to highlight hands that meet a minimum frequency.";
}

function renderRange() {
  const practice = rangeMode === "recall";
  const actions = rangeActions(rangePosition);
  const rows = MATRIX.map(code => ({code, mix:rangeFrequencies(rangePosition, code)}));
  const matches = code => rangePrimaryAction(rangePosition, code) === rangeGoal;
  const total = practice ? MATRIX.filter(matches).length : 0;
  const hits = [...selected].filter(matches).length;
  const extras = selected.size - hits;
  const complete = hits === total && extras === 0;
  const summary = checkedRange ? drillFeedback(complete, complete ? "Range matched" : "Range needs work",
    '<strong>' + hits + ' of ' + total + ' correct hands.</strong> ' + (total - hits) + ' missed · ' + extras + ' extra.') : "";

  const cells = rows.map(({code, mix}) => {
    if (!practice) {
      const label = actions.map(action => rangeActionLabel(action) + ' ' + (mix[action] ?? 0) + '%').join(', ');
      return '<button class="cell range-cell" data-hand="' + code + '" aria-label="' + code + ', ' + label + '" aria-pressed="' +
        (code === focusedHand) + '" title="' + code + ' · ' + label + '">' + rangeMixBar(mix, "range-fill") + '<span>' + code + '</span></button>';
    }
    const marked = selected.has(code);
    const css = checkedRange && marked && !matches(code) ? "extra" : checkedRange && !marked && matches(code) ? "missed" : marked ? "marked" : "";
    return '<button class="cell ' + css + '" data-hand="' + code + '" aria-label="' + code + '" aria-pressed="' + marked + '">' + code + '</button>';
  }).join("");

  const comboSummary = actions.map(action => {
    const weighted = rows.reduce((sum, {code, mix}) => sum + (mix[action] ?? 0) * comboCount(code), 0);
    return '<div><strong>' + (weighted / 1326).toFixed(1) + '%</strong>' + rangeActionLabel(action) + '</div>';
  }).join("");
  const handMix = rangeFrequencies(rangePosition, focusedHand);
  const breakdown = actions.map(action =>
    '<div><dt><i class="range-' + action.toLowerCase() + '"></i>' + rangeActionLabel(action) + '</dt><dd>' + (handMix[action] ?? 0) + '%</dd></div>').join("");
  const spots = POSITIONS.map(position => [position, position === "BB" ? "BB vs BTN open" : position + " first in"]).concat([[BB_LIMP, "BB vs SB limp"]]);
  const situation = rangePosition === BB_LIMP ? "Everyone folds to the small blind, who completes to 1 BB. You can check or raise." : scenario(rangePosition);
  const positionOptions = spots.map(([value, label]) =>
    '<option value="' + value + '"' + (rangePosition === value ? ' selected' : '') + '>' + label + '</option>').join("");
  const goalOptions = actions.map(action =>
    '<option value="' + action + '"' + (rangeGoal === action ? ' selected' : '') + '>' + rangeActionLabel(action) + '</option>').join("");

  main.innerHTML = intro("Range practice", "Range Trainer", "Explore action frequencies by hand and position.", "169 STARTING HANDS") +
    '<div class="layout"><section class="panel practice">' + tutorial("range") + '<div class="controls"><label>Spot<select id="range-position">' + positionOptions + '</select></label>' +
    '<label>Mode<select id="range-mode"><option value="study"' + (!practice ? ' selected' : '') + '>Study chart</option><option value="recall"' + (practice ? ' selected' : '') + '>Recall range</option></select></label>' +
    (practice ? '<label>Action<select id="range-goal">' + goalOptions + '</select></label>' : '') +
    '</div>' + (practice ? '' : rangeThresholdControls(actions)) + '<div class="matrix" aria-label="Starting hand chart">' + cells + '</div>' +
    (practice ? '<div class="answers"><button class="primary" data-check' + (checkedRange ? ' disabled' : '') + '>Check range</button><button class="ghost" data-clear>Reset</button><span class="chip">' + selected.size + ' selected</span></div>' :
      '<div class="legend range-legend">' + actions.map(action => '<span class="range-' + action.toLowerCase() + '">' + rangeActionLabel(action) + '</span>').join("") + '</div>') +
    summary + '</section><aside class="rail">' +
    '<section class="panel details"><h2>' + spots.find(([value]) => value === rangePosition)[1] + '</h2><p>' + situation + '</p>' +
    (practice ? '<p>Select the hands where <strong>' + rangeActionLabel(rangeGoal).toLowerCase() + '</strong> is the most frequent action.</p>' :
      '<section class="range-hand" aria-live="polite"><h3>' + focusedHand + ' <small>' + comboCount(focusedHand) + ' combos</small></h3>' +
      rangeMixBar(handMix) + '<dl class="range-breakdown">' + breakdown + '</dl></section><h3 class="range-summary-title">Overall range</h3><div class="summary">' + comboSummary + '</div><p>Weighted by the number of card combinations per hand.</p>') +
    '</section><section class="panel details"><h2>Chart assumptions</h2><p>Six-max cash at 100 BB effective. Frequencies are heuristic practice estimates. First-in spots use a simplified raise-or-fold model.</p>' +
    '</section></aside></div>';
  if (!practice) updateRangeThreshold();
}
function resetRange() {
  selected.clear();
  checkedRange = false;
}

function route() {
  if (tab === "hands") pauseHandDrill();
  const hash = location.hash.slice(1);
  tab = hash === "polarity" ? "ev" : ["drill", "range", "ev", "hands"].includes(hash) ? hash : "play";
  if (hash === "polarity" && evMode !== "polarity") {
    evMode = "polarity";
    evQueue = [];
    nextEvSpot();
  }
  clearTimeout(timer);
  document.querySelectorAll("[data-tab]").forEach(link => {
    const active = link.dataset.tab === tab;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (tab === "play") updateTable();
  if (tab === "drill") renderDrill();
  if (tab === "range") renderRange();
  if (tab === "ev") renderEv();
  if (tab === "hands") {
    if (handSpot && !handReview) handStarted = performance.now();
    renderHandDrill();
  }
}

main.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const {act, answer, hand} = button.dataset;
  if (button.hasAttribute("data-hand-start")) {
    nextHandDrill();
  } else if (button.hasAttribute("data-hand-rank")) {
    answerHandDrill(Number(button.dataset.handRank));
  } else if (button.dataset.polarityTag) {
    recordPolarityTag(button.dataset.polarityTag);
    renderPlay();
    main.querySelector('[data-act="deal"]').focus();
  } else if (button.hasAttribute("data-ev-answer")) {
    answerEv(Number(button.dataset.evAnswer));
  } else if (button.hasAttribute("data-ev-next")) {
    nextEvSpot();
    renderEv();
    main.querySelector("#polarity-estimate, #equity-estimate, [data-ev-answer]").focus();
  } else if (act === "deal" && table.result) {
    const fresh = sessionComplete() || nextMode !== session.mode;
    if (fresh) session = newSession(nextMode);
    table.deal(fresh);
    updateTable();
  } else if (act && table.actor === 0) {
    const input = document.querySelector("#wager");
    if (act === "raise" && (!input.value || !input.reportValidity())) {
      input.focus();
      return;
    }
    if (table.act(act, input?.valueAsNumber * 2)) updateTable();
  } else if (answer && !drill.answer) {
    drill.answer = answer;
    stats.drills++;
    if (answer === chartAction(drill.position, drill.code)) stats.correct++;
    saveStats();
    renderDrill();
    pulseDrill();
    main.querySelector("[data-drill-next]").focus();
  } else if (button.hasAttribute("data-drill-next")) {
    drill = newDrill();
    renderDrill();
    main.querySelector("[data-answer]").focus();
  } else if (hand) {
    focusedHand = hand;
    if (rangeMode === "recall" && !checkedRange) {
      if (selected.has(hand)) selected.delete(hand);
      else selected.add(hand);
    }
    renderRange();
    main.querySelector('[data-hand="' + hand + '"]').focus({preventScroll:true});
  } else if (button.hasAttribute("data-check") && !checkedRange) {
    checkedRange = true;
    stats.ranges++;
    saveStats();
    renderRange();
    pulseDrill();
    main.querySelector("[data-clear]").focus();
  } else if (button.hasAttribute("data-clear")) {
    resetRange();
    renderRange();
    main.querySelector("[data-check]").focus();
  }
});

main.addEventListener("change", event => {
  const {id, value} = event.target;
  if (id === "hand-drill-mode") {
    setHandMode(value);
  } else if (id === "session-mode") {
    nextMode = value;
    if (!session.hands && !table.result) session.mode = value;
    updateTable();
  } else if (id === "ev-mode") {
    evMode = value;
    evQueue = [];
    nextEvSpot();
    renderEv();
  } else if (id === "drill-position") {
    drillPosition = value;
    drill = newDrill();
    renderDrill();
  } else if (id === "range-filter") {
    rangeFilter = value;
    updateRangeThreshold();
  } else if (["range-position", "range-mode", "range-goal"].includes(id)) {
    if (id === "range-position") {
      rangePosition = value;
      if (!rangeActions(value).includes(rangeFilter)) rangeFilter = "";
      rangeGoal = "Raise";
    }
    if (id === "range-mode") rangeMode = value;
    if (id === "range-goal") rangeGoal = value;
    resetRange();
    renderRange();
  } else return;
  document.getElementById(id)?.focus();
});

main.addEventListener("submit", event => {
  if (event.target.id === "polarity-form") {
    event.preventDefault();
    answerPolarity(document.querySelector("#polarity-estimate").valueAsNumber);
  } else if (event.target.id === "equity-form") {
    event.preventDefault();
    answerEquity(document.querySelector("#equity-estimate").valueAsNumber);
  }
});

main.addEventListener("input", event => {
  if (event.target.id === "ev-chance") updateEvExplorer(event.target.valueAsNumber);
  if (event.target.id === "range-threshold") {
    rangeThreshold = event.target.valueAsNumber;
    updateRangeThreshold();
  }
});

main.addEventListener("toggle", event => {
  const topic = event.target.dataset.tutorial;
  if (topic && event.target.open) openTutorials.add(topic);
  else if (topic) openTutorials.delete(topic);
}, true);

document.querySelector("#progress").addEventListener("click", () => {
  document.querySelector("#progress-content").innerHTML = '<div class="summary">' +
    [[stats.hands, "Hands played"], [stats.wins, "Hands won or split"], [stats.net + " BB", "Net chips"], [stats.correct + "/" + stats.drills, "Correct drill answers"], [stats.ranges, "Ranges checked"], [stats.evCorrect + "/" + stats.evAnswered, "Correct EV answers"], [stats.equityAnswered, "Equity estimates"], [stats.polarityAnswered, "Polarity estimates"], [stats.handSpeed.identify.correct + "/" + stats.handSpeed.identify.answered, "Hand ID correct"], [stats.handSpeed.board.correct + "/" + stats.handSpeed.board.answered, "Board reading correct"]]
      .map(([value, label]) => '<div><strong>' + value + '</strong>' + label + '</div>').join("") + '</div>';
  progressDialog.showModal();
});
window.addEventListener("hashchange", route);
route();

















