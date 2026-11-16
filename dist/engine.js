"use strict";

const RANKS = "AKQJT98765432";
const SUITS = ["♠", "♥", "♦", "♣"];
const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
const STREETS = ["Preflop", "Flop", "Turn", "River"];
const HAND_NAMES = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];

function fullDeck() {
  return [...RANKS].flatMap((rank, index) => SUITS.map(suit => ({rank, suit, value:14 - index})));
}

function shuffledDeck() {
  const deck = fullDeck();
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

function handCode(cards) {
  const [high, low] = [...cards].sort((a, b) => b.value - a.value);
  return high.rank + low.rank + (high.rank === low.rank ? "" : high.suit === low.suit ? "s" : "o");
}

function compareScores(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function scoreFive(cards) {
  const counts = new Map();
  for (const {value} of cards) counts.set(value, (counts.get(value) ?? 0) + 1);
  const values = [...counts.keys()].sort((a, b) => b - a);
  const groups = [...counts].sort(([a, aCount], [b, bCount]) => bCount - aCount || b - a);
  const flush = cards.every(card => card.suit === cards[0].suit);
  const straight = values.length === 5 && (values[0] - values[4] === 4 ? values[0] : values.join() === "14,5,4,3,2" ? 5 : 0);
  const [first, second] = groups;
  if (straight && flush) return [8, straight];
  if (first[1] === 4) return [7, first[0], second[0]];
  if (first[1] === 3 && second[1] === 2) return [6, first[0], second[0]];
  if (flush) return [5, ...values];
  if (straight) return [4, straight];
  if (first[1] === 3) return [3, ...groups.map(group => group[0])];
  if (second[1] === 2) return [2, ...groups.map(group => group[0])];
  if (first[1] === 2) return [1, ...groups.map(group => group[0])];
  return [0, ...values];
}

function bestHand(cards) {
  if (cards.length === 5) return scoreFive(cards);
  let best = [];
  const excludePair = cards.length === 7;
  for (let first = 0; first < cards.length; first++) {
    const start = excludePair ? first + 1 : cards.length;
    const end = excludePair ? cards.length - 1 : cards.length;
    for (let second = start; second <= end; second++) {
      const score = scoreFive(cards.filter((_, index) => index !== first && index !== second));
      if (compareScores(score, best) > 0) best = score;
    }
  }
  return best;
}

// Pure-action, 100 BB practice charts. Each open group extends the tighter range.
const OPEN_GROUPS = [
  "AA KK QQ JJ TT 99 88 77 AKs AQs AJs ATs A5s KQs KJs QJs JTs T9s AKo AQo",
  "66 A9s A4s KTs QTs 98s AJo KQo",
  "55 44 A8s A7s A6s A3s A2s K9s Q9s J9s T8s 87s 76s ATo KJo QJo",
  "33 22 K8s K7s K6s K5s K4s Q8s Q7s J8s J7s T7s 97s 96s 86s 75s 65s 54s A9o A8o A7o A6o A5o KTo K9o QTo JTo T9o",
];
const SMALL_BLIND = OPEN_GROUPS.slice(0, 3).join(" ") + " 33 22 K8s K7s Q8s J8s 97s 86s 65s 54s A9o A8o A5o KTo QTo JTo";
const DEFEND_RAISE = "AA KK QQ JJ TT AKs AQs A5s AKo";
const DEFEND_CALL = OPEN_GROUPS.join(" ") + " K3s K2s Q6s Q5s Q4s Q3s Q2s J6s T6s 95s 85s 84s 74s 64s 63s 53s 43s A4o A3o A2o K8o K7o Q9o Q8o J9o J8o T8o 98o 87o 76o";
const CHARTS = Object.fromEntries(POSITIONS.map((position, index) => {
  const raises = position === "BB" ? DEFEND_RAISE : position === "SB" ? SMALL_BLIND : OPEN_GROUPS.slice(0, index + 1).join(" ");
  return [position, {raise:new Set(raises.split(" ")), call:new Set(position === "BB" ? DEFEND_CALL.split(" ") : [])}];
}));

function chartAction(position, code) {
  const {raise, call} = CHARTS[position];
  if (raise.has(code)) return "Raise";
  if (call.has(code)) return "Call";
  return "Fold";
}

const BB_LIMP = "BB-limp";
const RANGE_ACTIONS = ["Raise", "Call", "Check", "Fold"];
const RANGE_MIXES = {
  UTG: {Raise:{A5s:75, T9s:75, AQo:75}, Fold:{66:25, KTs:25, AJo:25}},
  HJ: {Raise:{66:75, A4s:75, KQo:75}, Fold:{55:25, A8s:25, QJo:25}},
  CO: {Raise:{44:75, A2s:75, QJo:75}, Fold:{33:25, K8s:25, J8s:25}},
  BTN: {Raise:{22:75, K4s:75, "54s":75, K9o:75, T9o:75}, Fold:{K3s:25, Q6s:25, "64s":25, A4o:25, J9o:25}},
  SB: {Raise:{22:75, K7s:75, Q8s:75, A5o:75}, Fold:{K6s:25, J7s:25, Q9o:25}},
  BB: {Raise:{TT:75, AQs:75, A5s:60}, Call:{99:20, AJs:25, KQs:25, A4s:30, "76o":35, "87o":25, Q8o:35}, Fold:{"65o":25, J7o:25, "52s":25}},
};
const BB_CALL_OR_RAISE = new Set(["99", "AJs", "KQs", "A4s"]);
const LIMP_RAISES = new Set("AA KK QQ JJ TT 99 88 77 AKs AQs AJs ATs A9s A5s A4s KQs KJs KTs QJs JTs AKo AQo AJo KQo".split(" "));
const LIMP_MIXES = {77:60, A9s:65, A5s:70, A4s:60, JTs:70, KQo:65, "66":30, A8s:35, QTs:35, T9s:35, ATo:40};

function rangeActions(spot) {
  if (spot === BB_LIMP) return ["Raise", "Check"];
  return spot === "BB" ? ["Raise", "Call", "Fold"] : ["Raise", "Fold"];
}

function rangeFrequencies(spot, code) {
  if (spot === BB_LIMP) {
    const raise = LIMP_MIXES[code] ?? (LIMP_RAISES.has(code) ? 100 : 0);
    return {Raise:raise, Check:100 - raise};
  }
  const primary = chartAction(spot, code);
  const mix = RANGE_MIXES[spot][primary]?.[code];
  if (mix === undefined) return {[primary]:100};
  if (spot === "BB") {
    if (primary === "Raise") return {Raise:mix, Call:100 - mix};
    if (primary === "Call") return {Call:100 - mix, [BB_CALL_OR_RAISE.has(code) ? "Raise" : "Fold"]:mix};
    return {Fold:100 - mix, Call:mix};
  }
  return primary === "Raise" ? {Raise:mix, Fold:100 - mix} : {Fold:100 - mix, Raise:mix};
}

function rangePrimaryAction(spot, code) {
  return Object.entries(rangeFrequencies(spot, code)).reduce((best, entry) => entry[1] > best[1] ? entry : best)[0];
}
const POSTFLOP_STRENGTH = [0.22, 0.48, 0.65, 0.77, 0.85, 0.9, 0.96, 0.99, 1];

function botFoldChance(strength, call, pot) {
  if (!call) return 0;
  const pressure = call / Math.max(8, pot) + call / 240;
  return Math.max(0, Math.min(1, (.63 + pressure * .42 - strength) / .34));
}

function botOpeningChance(strength) {
  return strength > .75 ? .35 : .09;
}

const PLAYERS = [
  ["You", "ME", "#d1b5fb"], ["Nova", "NV", "#efacbc"], ["Atlas", "AT", "#a9dbcd"],
  ["Indigo", "IN", "#b0b3f5"], ["Mika", "MK", "#ecc58a"], ["Jules", "JL", "#b9ccef"]
];

class HoldemTable {
  constructor() {
    this.number = 0;
    this.dealer = 2;
  }

  deal(fresh = false) {
    const previous = this.result;
    const stacks = fresh || !previous ? PLAYERS.map(() => 200) :
      this.players.map((_, index) => this.stack(index) + previous.chips[index]);
    this.number++;
    this.dealer = (this.dealer + 1) % PLAYERS.length;
    this.deck = shuffledDeck();
    this.players = stacks.map(stack => ({
      cards:[this.deck.pop(), this.deck.pop()], start:stack || 200,
      total:0, wager:0, folded:false, actedAt:null,
    }));
    this.board = [];
    this.street = 0;
    this.currentBet = 2;
    this.minRaise = 2;
    this.history = [];
    this.result = null;
    this.lockedBoard = null;
    this.heroRiverBet = null;
    this.heroRiverCall = null;
    this.riverOpen = null;
    this.preflopLine = [];
    this.heroPreflop = null;
    stacks.forEach((stack, index) => {
      if (stack === 0) this.addLog(PLAYERS[index][0] + " rebuys for 100 BB");
    });
    this.post((this.dealer + 1) % 6, 1);
    this.post((this.dealer + 2) % 6, 2);
    this.advance((this.dealer + 2) % 6);
  }

  position(index) { return POSITIONS[(index - this.dealer + 9) % 6]; }
  stack(index) { return this.players[index].start - this.players[index].total; }
  pot() { return this.players.reduce((sum, player) => sum + player.total, 0); }
  hasBettingOpponent(index) {
    return this.players.some((player, other) => index !== other && !player.folded && this.stack(other) > 0);
  }

  toCall(index) {
    const target = this.hasBettingOpponent(index) ? this.currentBet :
      Math.max(...this.players.filter(player => !player.folded).map(player => player.wager));
    return Math.min(this.stack(index), Math.max(0, target - this.players[index].wager));
  }
  maxTarget(index) { return this.stack(index) + this.players[index].wager; }
  canRaise(index) {
    const {actedAt} = this.players[index];
    return this.hasBettingOpponent(index) && this.maxTarget(index) > this.currentBet &&
      (actedAt === null || actedAt === 0 || this.currentBet - actedAt >= this.minRaise);
  }
  minTarget(index) { return Math.min(this.maxTarget(index), this.currentBet + this.minRaise); }
  addLog(message) { this.history.unshift(message); }

  contribute(index, amount) {
    this.players[index].wager += amount;
    this.players[index].total += amount;
  }

  post(index, amount) {
    const posted = Math.min(amount, this.stack(index));
    this.contribute(index, posted);
    this.addLog(PLAYERS[index][0] + " posts " + (posted / 2) + " BB");
  }

  act(action, target) {
    const index = this.actor;
    if (this.result || !Number.isInteger(index)) return false;
    const player = this.players[index];
    const name = PLAYERS[index][0];
    const call = this.toCall(index);
    if (action === "fold") {
      player.folded = true;
      this.addLog(name + " folds");
    } else if (action === "pass") {
      const amount = call;
      if (index === 0 && this.street === 3 && amount && this.riverOpen &&
          this.riverOpen.index !== 0 && this.riverOpen.target === this.currentBet && !player.wager) {
        this.heroRiverCall = {pot:this.riverOpen.pot, size:amount};
      }
      this.contribute(index, amount);
      this.addLog(amount ? name + " calls " + amount / 2 + " BB" : name + " checks");
    } else if (action === "raise" && this.canRaise(index) && Number.isInteger(target) && target >= this.minTarget(index) && target <= this.maxTarget(index)) {
      const wasBet = this.currentBet > 0;
      if (this.street === 3 && !wasBet) {
        const opponents = this.players.map((_, seat) => seat).filter(seat => seat !== index && !this.players[seat].folded);
        if (opponents.length === 1 && (index === 0 || opponents[0] === 0)) {
          this.riverOpen = {index, target, pot:this.pot()};
          if (index === 0) {
            const opponent = opponents[0];
            this.heroRiverBet = {pot:this.pot(), size:Math.min(target, this.stack(opponent)), target,
              checked:this.players[opponent].actedAt === 0, tag:null};
          }
        }
      }
      this.contribute(index, target - player.wager);
      this.minRaise = Math.max(this.minRaise, target - this.currentBet);
      this.currentBet = target;
      this.addLog(name + (wasBet ? " raises to " : " bets ") + target / 2 + " BB");
    } else {
      return false;
    }
    if (this.street === 0) {
      const verb = action === "pass" ? (call ? "Call" : "Check") : action === "raise" ? "Raise" : "Fold";
      if (index === 0 && !this.heroPreflop) this.recordPreflop(verb);
      if (verb === "Call" || verb === "Raise") this.preflopLine.push({index, verb, target});
    }
    player.actedAt = this.currentBet;
    this.advance(index);
    return true;
  }

  recordPreflop(action) {
    const position = this.position(0);
    let spot = null;
    if (!this.preflopLine.length && position !== "BB") spot = position;
    if (position === "BB" && this.preflopLine.length === 1) {
      const {index, verb, target} = this.preflopLine[0];
      const opener = this.position(index);
      if (opener === "BTN" && verb === "Raise" && target >= 4 && target <= 6 && this.players[(this.dealer + 1) % 6].folded) spot = "BB";
      if (opener === "SB" && verb === "Call") spot = BB_LIMP;
    }
    this.heroPreflop = {spot, position, action, code:handCode(this.players[0].cards)};
  }

  advance(after) {
    const remaining = this.players.map((_, index) => index).filter(index => !this.players[index].folded);
    if (remaining.length === 1) return this.finish(remaining);
    for (let offset = 1; offset <= 6; offset++) {
      const index = (after + offset) % 6;
      const player = this.players[index];
      if (!player.folded && this.stack(index) && (this.toCall(index) || (player.actedAt === null && this.hasBettingOpponent(index)))) {
        this.actor = index;
        return;
      }
    }
    if (this.street === 3) return this.finish(remaining);
    if (!this.lockedBoard && remaining.filter(index => this.stack(index) > 0).length <= 1) {
      this.lockedBoard = [...this.board];
      this.addLog("Betting closed · running out the board");
    }
    this.street++;
    this.deck.pop();
    const count = this.street === 1 ? 3 : 1;
    for (let card = 0; card < count; card++) this.board.push(this.deck.pop());
    this.addLog(STREETS[this.street] + " dealt");
    this.currentBet = 0;
    this.minRaise = 2;
    for (const player of this.players) {
      player.actedAt = null;
      player.wager = 0;
    }
    this.advance(this.dealer);
  }

  settlement(remaining) {
    const pots = [];
    const refunds = Array(PLAYERS.length).fill(0);
    const levels = [...new Set(this.players.map(player => player.total))].sort((a, b) => a - b);
    let previous = 0;
    for (const level of levels) {
      const increment = level - previous;
      previous = level;
      if (!increment) continue;
      const contributors = this.players.map((_, index) => index).filter(index => this.players[index].total >= level);
      if (contributors.length === 1) {
        refunds[contributors[0]] += increment;
        continue;
      }
      const eligible = remaining.filter(index => this.players[index].total >= level);
      const amount = increment * contributors.length;
      const last = pots.at(-1);
      if (last && last.eligible.join() === eligible.join()) last.amount += amount;
      else pots.push({amount, eligible});
    }
    return {pots, refunds};
  }

  awards(pots, board) {
    const scores = new Map();
    const order = index => (index - this.dealer + PLAYERS.length - 1) % PLAYERS.length;
    return pots.map(({amount, eligible}) => {
      let winners = eligible;
      let hand = "";
      if (eligible.length > 1) {
        for (const index of eligible) {
          if (!scores.has(index)) scores.set(index, bestHand([...this.players[index].cards, ...board]));
        }
        const ranked = [...eligible].sort((a, b) => compareScores(scores.get(b), scores.get(a)));
        winners = ranked.filter(index => compareScores(scores.get(index), scores.get(ranked[0])) === 0);
        hand = HAND_NAMES[scores.get(ranked[0])[0]];
      }
      winners = [...winners].sort((a, b) => order(a) - order(b));
      const payouts = winners.map((_, index) => Math.floor(amount / winners.length) + (index < amount % winners.length ? 1 : 0));
      return {winners, payouts, amount, hand};
    });
  }

  lockedShare(pots, remaining) {
    const heroPots = pots.filter(pot => pot.eligible.includes(0));
    if (!this.lockedBoard || !heroPots.some(pot => pot.eligible.length > 1)) return null;
    const known = new Set([...this.lockedBoard, ...remaining.flatMap(index => this.players[index].cards)].map(card => card.rank + card.suit));
    const unseen = fullDeck().filter(card => !known.has(card.rank + card.suit));
    const cardsNeeded = 5 - this.lockedBoard.length;
    let total = 0;
    const sample = runout => {
      const awards = this.awards(heroPots, [...this.lockedBoard, ...runout]);
      for (const {winners, payouts} of awards) total += payouts[winners.indexOf(0)] ?? 0;
    };
    if (cardsNeeded === 1) {
      unseen.forEach(card => sample([card]));
      return total / unseen.length;
    }
    const trials = 256;
    for (let trial = 0; trial < trials; trial++) {
      for (let index = 0; index < cardsNeeded; index++) {
        const other = index + Math.floor(Math.random() * (unseen.length - index));
        [unseen[index], unseen[other]] = [unseen[other], unseen[index]];
      }
      sample(unseen.slice(0, cardsNeeded));
    }
    return total / trials;
  }

  finish(remaining) {
    const {pots, refunds} = this.settlement(remaining);
    const awards = this.awards(pots, this.board);
    const chips = [...refunds];
    const positions = new Set();
    const pot = pots.reduce((sum, entry) => sum + entry.amount, 0);
    refunds.forEach((amount, index) => {
      if (amount) this.addLog(PLAYERS[index][0] + " gets " + amount / 2 + " BB back");
    });
    awards.forEach(({winners, payouts, amount, hand}, index) => {
      winners.forEach((winner, position) => {
        chips[winner] += payouts[position];
        positions.add(winner);
      });
      this.addLog(winners.map(winner => PLAYERS[winner][0]).join(" & ") + (winners.length > 1 ? " split " : " wins ") +
        amount / 2 + " BB" + (awards.length > 1 ? (index ? " · Side pot " + index : " · Main pot") : "") + (hand ? " · " + hand : ""));
    });
    const expected = this.lockedShare(pots, remaining);
    const net = (chips[0] - this.players[0].total) / 2;
    const adjusted = expected === null ? net : (expected + refunds[0] - this.players[0].total) / 2;
    this.result = {winners:[...positions], chips, pot, awards, showdown:remaining.length > 1, net, adjusted, adjustedRunout:expected !== null};
    this.actor = null;
  }

  botAct() {
    const index = this.actor;
    const player = this.players[index];
    const call = this.toCall(index);
    const random = Math.random();
    let strength;
    if (this.street === 0) {
      const code = handCode(player.cards);
      const [high, low] = [...player.cards].sort((a, b) => b.value - a.value);
      const premium = OPEN_GROUPS[0].split(" ").includes(code);
      strength = premium ? .67 + (high.value + low.value - 15) * .019 : .11 + high.value * .021 + low.value * .014 + (high.suit === low.suit ? .09 : 0) + (high.value === low.value ? .14 : 0);
    } else {
      const score = bestHand([...player.cards, ...this.board]);
      strength = POSTFLOP_STRENGTH[score[0]];
    }
    if (random < botFoldChance(strength, call, this.pot())) return this.act("fold");
    if (this.canRaise(index) && random < (call ? (strength > .75 ? .35 : 0) : botOpeningChance(strength))) {
      const target = Math.min(this.maxTarget(index), Math.max(this.minTarget(index), this.currentBet + (this.street ? Math.round(this.pot() * .46) : 4)));
      return this.act("raise", target);
    }
    return this.act("pass");
  }
}







