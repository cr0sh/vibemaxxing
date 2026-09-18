# Game Concepts

The player has three resources.

run Terminal so will be in trouble

- Energy: needs to do "something". Defeats if went zero
- Token: needs to run agent in the Terminal. The game proceeds even if it's zero but user can't
- Money(`$`): needs to purchase various features or upgrades.

The flow of the game is:

- The player is an SWE. Starts from have a job
  - The probability of job offer is 1% at start
  - The user should submit a form to apply, fields reset to blank after each submission(deliberate friction)
  - After 3 manual submissions, there will be a autocomplete button next to the submit
    button to ease the user
- You've got hired to _INSERT RANDOM COMPANY NAME HERE FROM A LIST_
  - You are an L3 intern engineer.
  - You now have two windows. Messenger(slack-like purple theme) and Terminal
  - Your boss gives you tasks (shown like an attachment in the messenger UI).
    This is given right after you are hired, and every 2 minutes. You can
    drag-and-drop this attachment onto terminal.
  - The terminal is running a coding agent. It should resemble like Claude Code.
    When idle, attachments can be drag-and-dropped onto it and it'll be
    "working". The UI should show something like _thinking..._ or something
    other random placeholders from a list(like CC does). When it's done working, the terminal shows the
    "artifact" as the box like the attachment in the messenger UI, which can
    also be drag-and-dropped back to the messenger. It concludes the task. - The boss will be angry when you fail to deliver the artifact in the deadline
    that the boss specified. You'll lose.
  - Each employed job pays you \$5 every second.
- The terminal can be "upgraded" with several features. Features are purchased
  by drag-and-dropping the item icon from the shop UI to the terminal.
  - Split window(\$200, $400, $1000): The window can be split at max 4. Agents
    can run simultaneously.
  - Yolo mode($420): By default, the terminal asks for command approval(yes/no) for
    confirmation, randomly every 1–2 seconds of active work, including the opening. This lifts the restriction.
    Applies to window-wise. The terminal window border shines with rainbow color
    animation.
  - Multi-window($1000): One more window. The split window upgrade costs double
    here, \$400/\$800/\$2000 each.
- The boss has an internal "expectation" value governing assignment cadence and
  deadlines. It rises with projected gross earnings, using the same \$5/s base
  wage as actual pay plus expected task rewards. Opening grace and minimum
  execution budgets are retained.
- After solving first five tasks, the boss will enable "incentivized mode" and
  tell the player with the message. Then each tasks will have the dollar based reward (with cash bag emoji). The reward depreciates by 10% per 10 seconds, until it reaches the 5% of its initial value. The deadline system still counts.
- Each solved tasks spend tokens worth `10000 * difficulty`. Tokens start at 10M and are capped at 10M
  in inventory, and refilled to 10M every 100 seconds. The refill timer should be
  shown in Terminal. Additional tokens are purchased in Shop: 100K tokens for
  \$10.

- As your boss raises expectation, tokens are getting more scarce. For the first
  time the tokens inventory goes under 20%, the \#watercooler channel shows a
  badge icon and a colleague sends a message linking ZZZ website(which is a parody of X
  social network service), offering "Tiro"'s usage reset campaign. When the user
  clicks the link, a new app ZZZ SNS is installed into the dock. The first
  update in the timeline is Tiro's reset message. Also, another message shows in
  after 5s: "I'll consider resetting another time when YOU like this message!
  Maybe... at 1% chance?"
  then the player clicks the like button (heart icon) in the update, and every
  time it's clicked there is a 1% chance of full reset. When reset is happened,
  Tiro should post another update into the timeline.

- You'll get eventually promoted (around after solving 50 quests) to L4.
  Congrats from the boss. Then, the "systems architecture" tasks
  occasionally(35% prob)
  comes in. With the current agent model, it is 50% chance to solve, so when
  failed it should be retried(considering this, the deadline should be
  considered 5x).
  - In detail(don't expose the user), each models have "intelligence" param and
    each tasks have "complexity". Chances are `min(100%, complexity / intelligence)`, and basic model and basic tasks both start with 1.

- After solving the first systems architecture task, Tiro shows a new model:
  speed -40%, but 100% chance to solve the sys-architectural
  tasks(intelligence=2).

- After solving more sys-architectural tasks, the odds of getting the complex tasks goes high, eventually to 80%. Then, the user would have the pain waiting. So Tiro announces the "fast mode", which can be toggled at the shop, consumes 2x tokens and +100% speed.

- (Til the above the targeted playtime is 5 mins )

- Further solving the tasks, you start to get some free time(boss's expectation is bounded). There will be a side playable contents that's installed at this stage:
  - Bitcoin trading. You can buy/sell with your free money. It should have a
    separate balance system for USD and BTC, and trading is fee-free,
    slippage-free. The chart is a line chart randomly drawn(brownian +
    occassional big dips and pumps), so with enough risk
    control the player can earn money quite easily.
  - Tiro announces a "Mapple Spark" device which can be purchased after 10s from
    the shop, with \$15k. It's a local LLM inference computer. When purchased, you get a new
    dedicated terminal with two split panes and intelligence=2. No fast mode
    here. There is a delay for "physcal delivery" and it's (15s + 5s for every 1s late purchase) capped at 1m.

- After the side events above, Tiro will announce "a major model upgrade" which
  will introduce a more advanced model. It'll cloud hosted and intelligence=3,
  speed same as the intelligence=2 model. After purchasing this, there will be a
  "Mercury" agent option purchasable with \$8k. When purchased, it'll
  automatically deliver tasks and artifacts between terminals(to any free slots,
  including the Spark's) and back, costing 300K token in each forwardings. This
  is toggle-able so the player can still do the thing manually if he wants to
  hyperoptimize.

- After further progression, there will be another "job slot" unlocked so the
  user can have the second job. Just add the job application app back, autofill enabled at start. The new job starts from L3.
- Also, the promotion upside is raised to L5(don't notify explicitly about
  this). While progressing the work process, the boss will promote you
  occasionally and start giving more complex tasks. Level N engineers will get
  tasks with complexity from N-2 to N.

- Tiro will will also introduce another model, consuming token 2x, same speed
  from the previous generation, intelligence=4. The model switcher should be
  enabled on all terminals(excluding the Spark's) and able to be choose the model window locally.

- (Til the above the targeted playtime cumulative is 15 mins)

- As work becomes automated, boredom becomes part of the resource pressure.
  After the first hire, energy declines after an interval without qualifying
  human interaction. The interval decreases continuously from 20 seconds
  initially to 10 seconds at 10 elapsed minutes and 5 seconds at 30 minutes,
  then stays at 5 seconds. Consecutive idle penalties double: -1, -2, -4, -8,
  then -16 per interval. The qualifying interactions are:
  - Purchasing an item with CLICKING (so token autopurchase is not counted)
  - Realizing a positive PNL on BTC trading
  - Scrolling "shorts"(explained below)

  Each qualifying interaction resets the inactivity timer and penalty ramp,
  and restores 1 energy.

- Also, Tiro (eventually) announces "WE MONOPOLIZED THE FRONTIERS" and the token prices goes
  up by 1.1x for every 5s. So the user should eventually lose more money than
  the reward solving the tasks.

- Some time later(like ≈1m?), Mapple announces another local LLM machine (Mapple
  Spark Ultra) that costs \$100k, with intelligence=3. Same delivery delay
  applies too. It'll be helpful after the user is lacking cloud based tokens.

- Purchasing Mercury immediately unlocks the clapper-board Shorts app. With
  automation handling the work, the player has something to doomscroll.
  The mobile-like feed scrolls continuously in both directions without a
  visible scrollbar or a finite catalog counter.

- When energy goes to 0, the player defeats. The end message is like "the user got
  to depression".

- When the user reaches \$4.242M, the user wins the game. End message like: "You are
  now a multimillionare. No need to work"

## Implementation and balance notes

- The inactivity clock starts on accepting the first job, not during initial
  applications, where none of the qualifying recovery interactions are available.
  Application submission costs remain unchanged.
- Monopoly starts 60 seconds after the frontier model unlock. Spark Ultra is
  announced 60 seconds later; orders open after another 10 seconds. Its price
  remains $100,000, with the same 15–60 second delivery rule as Spark.
- L5 task rewards use a 600× multiplier instead of 200×. L4 remains at 100×;
  early-career rewards and existing purchase prices are unchanged.
  Two-minute reducer smoke runs (seeds 12345, 42, and 2026, at most two actions
  per second) bought the first split at 40 seconds, down from 88–93 seconds.
  After buying the split, they bought YOLO at 94–96 seconds. They encountered
  24–31 approval prompts before YOLO and none afterward, versus 1–2 prompts
  in the previous two-minute opening. All three remained employed.
- The $4.242M victory threshold includes cash, trading USD, and BTC at its current
  market price, without double-counting transfers. Both endings freeze gameplay.
- Shorts shuffles four remotely hosted GIPHY MP4 meme loops, recycles five cards
  for bounded infinite scrolling, and loads only the foreground clip. Each
  genuine clip transition increments a running viewing count and restores
  energy once. Each clip links to its source; playback depends on the remote
  host. Playback, focus changes, and layout changes do not restore energy.
- Default-open and already-focused apps do not bounce in the dock. Unseen
  background updates and newly available unopened apps can still attract attention.
- Messenger and timeline updates use distinct original synthesized notification
  chimes, not copied phone recordings. Both respect the existing sound mute.
