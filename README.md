# PokerLab

PokerLab is a browser-based, play-money Texas Hold’em trainer. Open `dist/index.html` in a browser to start. No installation or build step is required. Each training mode has an expandable tutorial with a worked example and an explanation of its feedback.

- **Play vs Bots** deals six-max no-limit hands against five computer opponents. Blinds are 0.5/1 BB, the dealer button rotates, and you can choose a single hand or an unlimited session. Stacks start at 100 BB and carry forward within a session. Busted seats rebuy before the next hand. The score tracks actual and all-in-adjusted results. Infinite sessions show preflop chart alignment, observed action frequencies, and modeled heads-up river call and bet EV with sample counts. Tag first bets on heads-up rivers to compare your value and bluff mix against sizing-based benchmarks.
- **Preflop Drill** quizzes first-in decisions from UTG through SB and big-blind defense against a 2.5 BB button open.
- **Range Trainer** shows the 169 starting-hand classes. Open the range tutorial, inspect heuristic action mixes and combo-weighted totals, highlight hands with an action-frequency cutoff, or recall the hands where an action is most frequent. The BB chart includes defense against a BTN open and checking or raising against an SB limp.
- **EV Trainer** quizzes river calls and pure bluffs. It shows EV in big blinds, the break-even probability, and how changing equity or fold rate affects the decision. Showdown Equity mode asks for an estimate on the flop or turn against a known hand and reveals the exact runout counts, equity, and call EV. River Polarity mode quizzes the bluff share for a given pot and bet size.
- **Hand ID** times recognition of your best five-card hand or the strongest hand possible using any two unseen hole cards.
- The **PL** button opens progress. Results are stored in the browser where local storage is available.

The preflop decision drill uses approximate single-action charts. The charts and bots are heuristic and do not use a solver.










