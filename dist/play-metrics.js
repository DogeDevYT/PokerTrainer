"use strict";

function newPlayMetrics() {
  return {
    preflop:{decisions:0, matches:0, covered:0, actions:{}, last:null},
    call:{count:0, ev:0, equity:0},
    bet:{count:0, ev:0},
    value:{count:0, ev:0},
    bluff:{count:0, ev:0},
    lastRiver:null,
  };
}

function reviewPreflop(metric, decision) {
  if (!decision?.spot) return;
  const {spot, code, action} = decision;
  const frequencies = rangeFrequencies(spot, code);
  metric.last = {...decision, primary:rangePrimaryAction(spot, code), frequency:frequencies[action] ?? 0};
  metric.decisions++;
  if (action === metric.last.primary) metric.matches++;
  if (frequencies[action] > 0) metric.covered++;
  for (const possible of rangeActions(spot)) {
    metric.actions[possible] ??= {played:0, expected:0, opportunities:0};
    const tally = metric.actions[possible];
    tally.played += Number(action === possible);
    tally.expected += (frequencies[possible] ?? 0) / 100;
    tally.opportunities++;
  }
}

function modelRiverDecision(hero, board, type, {pot, size, target, checked}) {
  const known = new Set([...hero, ...board].map(card => card.rank + card.suit));
  const candidates = fullDeck().filter(card => !known.has(card.rank + card.suit));
  const heroScore = bestHand([...hero, ...board]);
  let weightTotal = 0;
  let equityTotal = 0;
  let gainTotal = 0;
  let foldTotal = 0;

  for (let first = 0; first < candidates.length; first++) {
    for (let second = first + 1; second < candidates.length; second++) {
      const score = bestHand([...board, candidates[first], candidates[second]]);
      const strength = POSTFLOP_STRENGTH[score[0]];
      const comparison = compareScores(heroScore, score);
      const equity = comparison > 0 ? 1 : comparison < 0 ? 0 : .5;
      const opens = botOpeningChance(strength);
      const weight = type === "call" ? opens : checked ? 1 - opens : 1;
      const folds = type === "bet" ? botFoldChance(strength, size, pot + target) : 0;
      const showdown = equity * (pot + 2 * size) - size;
      const gain = type === "bet" ? folds * pot + (1 - folds) * showdown - equity * pot : showdown;
      weightTotal += weight;
      equityTotal += weight * equity;
      gainTotal += weight * gain;
      foldTotal += weight * folds;
    }
  }
  return {type, ev:gainTotal / weightTotal / 2, equity:equityTotal / weightTotal, folds:foldTotal / weightTotal};
}

function reviewCompletedHand() {
  if (session.mode !== "infinite") return;
  const metrics = session.metrics;
  reviewPreflop(metrics.preflop, table.heroPreflop);
  const type = table.heroRiverCall ? "call" : "bet";
  const decision = table.heroRiverCall ?? table.heroRiverBet;
  if (!decision) return;
  const review = modelRiverDecision(table.players[0].cards, table.board, type, decision);
  const tally = metrics[type];
  tally.count++;
  tally.ev += review.ev;
  if (type === "call") tally.equity += review.equity;
  if (type === "bet") decision.review = review;
  metrics.lastRiver = review;
}

function reviewTaggedBet(tag, bet) {
  if (!bet.review || (tag !== "value" && tag !== "bluff")) return;
  const tally = session.metrics[tag];
  tally.count++;
  tally.ev += bet.review.ev;
}

function playMetricsPanel() {
  if (session.mode !== "infinite") return "";
  const {preflop, call, bet, value, bluff, lastRiver} = session.metrics;
  const rate = (count, total) => total ? polarityPercent(count / total) : "—";
  const equity = call.count ? polarityPercent(call.equity / call.count) : "—";
  const evRow = (label, tally) => '<tr><th scope="row">' + label + '</th><td>' + tally.count +
    '</td><td>' + (tally.count ? bbScore(tally.ev / tally.count) : "—") + '</td></tr>';
  const tagged = {count:value.count + bluff.count, ev:value.ev + bluff.ev};
  const actions = RANGE_ACTIONS.filter(action => preflop.actions[action]).map(action => {
    const {played, expected, opportunities} = preflop.actions[action];
    return '<tr><th scope="row">' + action + '</th><td>' + opportunities + '</td><td>' + rate(played, opportunities) +
      '</td><td>' + rate(expected, opportunities) + '</td></tr>';
  }).join("");
  const last = lastRiver ? '<p><strong>Latest river review.</strong> ' +
    (lastRiver.type === "call" ? 'Call ' + bbScore(lastRiver.ev) + ' vs fold · ' + polarityPercent(lastRiver.equity) + ' estimated showdown equity.' :
      'Bet ' + bbScore(lastRiver.ev) + ' vs checking to showdown · ' + polarityPercent(lastRiver.folds) + ' estimated folds.') + '</p>' : "";

  return '<section class="panel details live-polarity live-metrics"><h2>Infinite play metrics</h2>' +
    '<div class="summary"><div><strong>' + rate(preflop.matches, preflop.decisions) + '</strong>Preflop primary-action match</div>' +
    '<div><strong>' + rate(preflop.covered, preflop.decisions) + '</strong>Preflop in chart mix</div></div>' +
    '<p>' + preflop.decisions + ' charted preflop decisions across ' + session.hands + ' completed hands.</p>' +
    (actions ? '<table><thead><tr><th scope="col">Range action</th><th scope="col">Spots</th><th scope="col">Played</th><th scope="col">Chart</th></tr></thead><tbody>' + actions + '</tbody></table>' : '') +
    (preflop.last ? '<p><strong>Latest charted decision.</strong> ' + preflop.last.code + ' from ' + preflop.last.position + ' · ' + preflop.last.action + ' played (' + preflop.last.frequency + '% in chart) · ' + preflop.last.primary + ' most frequent.</p>' : '') +
    '<h3>Heads-up river EV</h3><table><thead><tr><th scope="col">Decision</th><th scope="col">Spots</th><th scope="col">Avg. EV</th></tr></thead><tbody>' +
    evRow("Calls vs fold", call) + evRow("Opening bets vs check", bet) + evRow("Tagged value bets", value) +
    evRow("Tagged bluffs", bluff) + evRow("Tagged polarized bets", tagged) + '</tbody></table>' +
    '<p>Average showdown equity on modeled calls · <strong>' + equity + '</strong></p>' + last +
    '<details><summary>How to read these metrics</summary><p>Preflop scores use first-in spots and charted BB defenses. BB defense uses the 2.5 BB chart as a reference for button opens from 2 to 3 BB. Range rates compare what you played with the chart’s mix for the hands dealt, using only spots where that action is available in the chart.</p>' +
    '<p>River estimates use possible opponent hands and the bot’s river rules. The model weights hands by the relevant river open or check and leaves out earlier betting. Bets use a check-to-showdown baseline and treat reraises as calls. Call EV is relative to folding.</p>' +
    '<p>Tagged polarized EV averages bets you marked Value or Bluff in River polarity. The sizing panel shows the share of bluffs in each group. Use the EV figures as practice estimates.</p></details></section>';
}

