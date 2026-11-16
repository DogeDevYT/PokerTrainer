"use strict";

const TUTORIALS = {
  play: {
    title:"How to play the practice table",
    goal:"Play a full hand of Texas Hold’em and see how your decisions and stack size carry into the next hand.",
    steps:[
      ["Read the table", "The small and big blinds post 0.5 and 1 BB before the hand. You have two private cards. The flop adds three shared cards, the turn adds one, and the river adds one more. At showdown, each player makes their best five-card hand from their private cards and the board."],
      ["Choose an action", "Check to pass the action for free, call to match a bet, fold to give up the pot, or bet and raise to put more chips in. The sizing box sets your total wager for the current betting round in big blinds (BB)."],
      ["Choose your session", "Use Single hand to focus on one spot. Use Infinite hands to carry stacks forward as the dealer button rotates. Between hands, busted seats rebuy for 100 BB."],
    ],
    example:"If everyone before you checks on the turn, you can check or bet. If someone bets 5 BB and you have put in nothing this round, calling costs 5 BB.",
    feedback:"Actual net counts your chip gain or loss. All-in-adjusted EV uses your expected share when betting is closed and cards remain to come. After an opening bet on a heads-up river, tag it as value, bluff, or other to track your sizing mix."
  },
  preflop: {
    title:"How the preflop drill works",
    goal:"Practice choosing a starting-hand action from your cards, position, and the action in front of you.",
    steps:[
      ["Pick a position", "UTG acts first preflop, followed by HJ (hijack) and CO (cutoff). BTN is the dealer button, and SB and BB are the small and big blinds. Random position mixes the spots."],
      ["Read what happened", "In a first-in spot, everyone before you folded. Choose Raise to open the pot or Fold to pass. In the BB drill, the button already raised to 2.5 BB, so you can fold, call, or 3-bet (raise again)."],
      ["Use position", "With fewer players left to act, you can generally open more hands. The button also gets to act last after the flop when it faces the blinds."],
    ],
    example:"In PokerLab’s chart, K9s folds first in from UTG but opens from the button. Try those two spots in Range Trainer to see where the opening range widens.",
    feedback:"The drill grades one chart action for each hand. Accuracy shows how often you matched that practice chart."
  },
  range: {
    title:"How poker ranges work",
    goal:"A range describes the hands a player could hold and how often those hands take an action. Before the flop, the grid groups the 1,326 possible two-card combinations into 169 hand classes.",
    steps:[
      ["Pick the spot", "Position and prior action change the range. You can call or fold facing a raise, and you can check when there’s nothing left to call."],
      ["Read one hand", "Pairs are on the diagonal (6 combos each), suited hands are above it (4 each), and offsuit hands are below it (12 each). Split colors show a mix. In BB vs BTN open, A5s calls 40% and 3-bets 60% in this chart."],
      ["Read the whole range", "Overall action frequencies weight each hand by its combo count and its action frequency. A5s contributes 4 × 40% = 1.6 weighted combos to the calling range. Once you see a call, hands that call more often carry more weight among the possible holdings."],
    ],
    example:"In BB vs BTN open, highlight Call at 50%. A5s drops out. Lower the threshold to 40% and it’s highlighted. The cutoff changes which hands are highlighted. The chart’s underlying mixes stay the same.",
    feedback:"Study chart shows the frequencies. In Recall range, select hands for which the chosen action is the most frequent. Feedback marks misses and extra selections."
  },
  ev: {
    title:"How calls and bluffs earn EV",
    goal:"Expected value (EV) is the average chip gain or loss if the same decision were repeated many times.",
    steps:[
      ["For a call, compare equity to pot odds", "Break-even equity is call cost ÷ (pot after the opponent’s bet + call cost). Above that threshold, the call gains chips on average."],
      ["For a pure bluff, compare fold rate to risk", "Break-even fold rate is bet size ÷ (pot before your bet + bet size). A pure bluff wins the pot when the opponent folds and loses the bet when called."],
      ["Choose +EV, −EV, or break-even", "Compare the call against folding, or the pure bluff against checking. Both baselines are 0 BB in these drills."],
    ],
    example:"Calling 10 BB to win the 30 BB already in the pot needs 25% equity. With 30% equity, the call earns 0.30 × 30 − 0.70 × 10 = +2 BB on average. A 10 BB bluff into 20 BB needs 33.3% folds to break even. If the opponent folds 40% of the time, the bluff earns 0.40 × 20 − 0.60 × 10 = +2 BB on average.",
    feedback:"After you answer, read the equation and use the slider to move equity or fold rate across break-even. The sign changes when the play crosses that point."
  },
  equity: {
    title:"How to estimate showdown equity",
    goal:"Showdown equity is the share of the pot you expect to win if the remaining cards are dealt and both hands go to showdown.",
    steps:[
      ["See who’s ahead", "Read your hand, the opponent’s hand, and the board. If you’re behind, count clean outs, which are unseen cards that put you ahead and hold up. If you’re ahead, start with the opponent’s outs."],
      ["Make a quick estimate", "Multiply clean outs by about 2 with one card to come or 4 with two cards to come. On the flop, later cards can undo a lead, so these shortcuts give a rough estimate."],
      ["Account for ties", "A heads-up tie gives you half the pot. Exact equity is (wins + half the ties) ÷ all possible runouts."],
    ],
    example:"On the turn, eight clean outs among 44 unseen cards give 8 ÷ 44 ≈ 18.2% equity if every other river loses. The quick rule gives about 16%.",
    feedback:"Enter your best estimate as a percentage. The drill reveals the exact win, tie, and loss counts against the shown hand, your error in percentage points, and the call EV at the quoted price."
  },
  hands: {
    title:"How to recognize made hands",
    goal:"Read the best five-card hand you can make with the cards already visible. A draw needs a future card to become a made hand.",
    steps:[
      ["Read your own hand", "Combine your two hole cards with the board. You may use both, one, or no hole cards as long as the best hand has exactly five cards. Choose Royal flush for ten through ace of one suit. Choose Straight flush for lower sequences of one suit."],
      ["Read the board", "Picture any two unseen hole cards and look for the strongest category the board allows. Start with paired ranks, then look for three cards of a suit or ranks that can fit into a five-card straight."],
      ["Practice speed", "Start the timer by dealing a spot. Choose a category as soon as you can identify it. Your average time uses correct answers."],
    ],
    example:"On A♠ 8♦ 2♣, A♥ A♦ makes three aces. No two hole cards can make a straight, flush, full house, or quads with that flop.",
    feedback:"The drill shows the correct category and your time. In Read the board, expand the combo breakdown to see every category an opponent’s best five cards could make."
  },
  polarity: {
    title:"How to balance river value bets and bluffs",
    goal:"A polarized betting range combines strong value hands that want calls with weak hands that benefit from folds. Medium-strength hands often check.",
    steps:[
      ["Read the bet size", "The pot is measured before your river bet. In this heads-up model, all value hands beat a bluff-catcher and all bluffs lose if called."],
      ["Estimate the bluff share", "Divide the bet by (pot + twice the bet). At that share, a pure bluff-catcher breaks even on a call."],
      ["Translate the mix into combos", "Multiply your value combo count by bet ÷ (pot + bet) to find how many bluff combos the mix calls for."],
    ],
    example:"Betting 20 BB into 40 BB gives a target of 20 ÷ (40 + 40) = 25% bluffs. With 18 value combos, that’s 6 bluff combos, or one bluff for every three value hands.",
    feedback:"The drill compares your estimate with the benchmark. In bot play, tag your heads-up river bets to compare your observed mix by sizing. The benchmark assumes the simplified model above, and a few tagged bets can swing the result."
  }
};

const openTutorials = new Set();

function tutorial(topic) {
  const {title, goal, steps, example, feedback} = TUTORIALS[topic];
  return '<details class="trainer-tutorial" data-tutorial="' + topic + '"' + (openTutorials.has(topic) ? ' open' : '') +
    '><summary>' + title + '</summary><p>' + goal + '</p><ol>' + steps.map(([label, text]) =>
      '<li><strong>' + label + '.</strong> ' + text + '</li>').join("") + '</ol><p><strong>Example.</strong> ' +
    example + '</p><p><strong>Reading your results.</strong> ' + feedback + '</p></details>';
}



