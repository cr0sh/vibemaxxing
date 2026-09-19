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
    The first arrives immediately; the opening interval is 30 seconds, easing
    toward a 9-second minimum (15 seconds per job after the second-career unlock).
    Active backlog extends those intervals. Drag attachments onto Terminal.
    Task catalogs contain 16 standard assignments and 8 architecture assignments.
    Each kind uses its own seeded shuffle bag shared across employers: exhaust
    the catalog before reshuffling, without an immediate repeat at the boundary.
    Task and artifact cards never select text, including non-draggable history.
    Forwarded messenger tasks are dimmed and explicitly labeled.
    A top-of-general reminder locates pending starts, retries, and artifact
    deliveries; reading or scrolling does not resolve it.
    Rejected drops show a red helper at the bottom of the targeted terminal pane
    for four seconds. An occupied pane never redirects the task into an idle
    sibling; undelivered artifacts, pending approvals, and insufficient tokens
    explain why forwarding is unavailable.
  - The terminal is running a coding agent. It should resemble like Claude Code.
    When idle, attachments can be drag-and-dropped onto it and it'll be
    "working". The UI should show something like _thinking..._ or something
    other random placeholders from a list(like CC does). When it's done working, the terminal shows the
    "artifact" as the box like the attachment in the messenger UI, which can
    also be drag-and-dropped back to the messenger. It concludes the task. - The boss will be angry when you fail to deliver the artifact in the deadline
    that the boss specified. You'll lose.
    Basic tasks take 9–18 seconds of active work, excluding approval pauses.
    Other models and Fast mode retain their relative speed advantages.
  - Each employed job pays you \$15 every second.
- The terminal can be "upgraded" with several features. Features are purchased
  by drag-and-dropping the item icon from the shop UI to the terminal.
  Mouse, touch, and stylus drops install the upgrade on the target terminal.
  Shop products appear the first time their prerequisites and purchase price
  are met, then remain visible after spending. Discovery is per product, not
  per split tier or target terminal. Token refill is always visible and never
  triggers discovery highlights or dock notifications.
  Newly discovered products notify the Shop dock icon; balance fluctuations
  and already-discovered upgrades do not. Viewing Shop acknowledges its updates.
  Newly discovered entries wait until Shop is visible and focused, then get a
  golden border/glow for fifteen real seconds or until that product is purchased,
  whichever comes first. Independent timers start immediately for discoveries
  made while Shop is already focused. Once started, they continue while Shop is
  hidden or unfocused and do not restart on refocus. Reduced motion keeps a static
  gold border.
  Shop toggle inputs are positioned inside their visible labels so mouse,
  touch, and keyboard focus scroll only the Shop's inner content, never the
  surrounding window into an empty bottom gutter.
  - Split window(\$200, $400, $1000): The window can be split at max 4. Agents
    can run simultaneously.
  - Yolo mode($2,222): By default, the terminal asks for command approval(yes/no) for
    confirmation, randomly every 3–6 seconds of active work, including the opening. This lifts the restriction.
    Applies to window-wise. The terminal window border shines with rainbow color
    animation. Idle panes display “YOLO!”.
    Its price is visible from hiring as a savings target, but buying and dragging
    remain disabled until affordable. Each purchase affects only the selected
    terminal, including local Spark and Spark Ultra windows.
  - Multi-window($1000): One more window. The split window upgrade costs double
    here, \$400/\$800/\$2000 each.
- The boss has an internal "expectation" value governing assignment cadence and
  deadlines. It rises with projected gross earnings, using the same \$15/s base
  wage as actual pay plus expected task rewards. Opening grace and minimum
  execution budgets are retained.
- After solving the first two tasks, the boss enables "incentivized mode".
  Rewards depreciate by 10% per 30 seconds after assignment, down to 5% of their
  initial value. Deadlines continue to apply.
- Each attempt spends `100000 * difficulty` tokens before model/Fast multipliers.
  Tokens start at 10M, remain capped at 10M, and refill every 420 seconds.
  The longer refill window preserves token scarcity with fewer assignments.
  Terminal shows the refill countdown. Shop sells 100K tokens for \$100.

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

- After completing 17 tasks, the player is promoted to L4.
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

- Each completed architecture task adds 12.5 percentage points to its appearance
  chance, up to 80%. After two architecture deliveries, Fast mode unlocks:
  2× speed for 2× tokens, selectable in Shop.

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
- After accepting the second job, owners of Mercury can buy **Mercury 2.0** for
  **$50,000**. The upgrade is announced and visible in Shop even before it is
  affordable, with no extra waiting timer. Base Mercury remains a separate
  $8,000 prerequisite.
  - New assignments and eligible retries use deadline-aware terminal matching:
    estimate execution time and the number of attempts that fit, maximize the
    chance of finishing by the deadline, then avoid excess model intelligence.
    Expected completion time, execution token cost, workload, and stable terminal
    order resolve remaining ties. If no attempt fits, prefer faster completion.
  - Only free, funded placements are considered. Failed tasks can move to a
    better terminal; running tasks are never interrupted. Terminal models remain
    player-selected. Handoff fees, reserved return fees, and the 10-second retry
    delay are unchanged; rerouting a retry does not charge its initial handoff again.
  - Ownership adds **10 percentage points** to every task's completion success
    chance, capped at 100%. This includes manual work, local terminals, tasks
    already running at purchase, and work while Mercury automation is off.
- Also, the promotion upside is raised to L5(don't notify explicitly about
  this). While progressing the work process, the boss will promote you
  occasionally and start giving more complex tasks. Level N engineers will get
  tasks with complexity from N-2 to N.

- Tiro will will also introduce another model, consuming token 2x, same speed
  from the previous generation, intelligence=4. The model switcher should be
  enabled on all terminals(excluding the Spark's) and able to be choose the model window locally.

- (Til the above the targeted playtime cumulative is 15 mins)

- As work becomes automated, boredom becomes part of the resource pressure.
  Energy inactivity decay starts only after purchasing Mercury, when Shorts
  also becomes available. Manual work before that purchase does not accumulate
  idle time or energy penalties. After activation, the interval follows total
  game time: 20 seconds at time zero, 10 seconds at 10 elapsed minutes, and
  5 seconds at 30 minutes, then stays at 5 seconds. Consecutive idle penalties double: -1, -2, -4, -8,
  then -16 per interval. The qualifying interactions are:
  - Purchasing an item with CLICKING (so token autopurchase is not counted)
  - Realizing a positive PNL on BTC trading
  - Scrolling "shorts"(explained below)

  Each qualifying interaction resets the inactivity timer and penalty ramp.
  A settled Shorts navigation restores 5 energy; other qualifying interactions
  restore 1. Energy is capped at 100. Watching a clip without navigating does not
  restore energy.

- Tiro gloats that the competition is gone and demands payment. Token refill
  prices compound by 1.1× every five seconds. The widget bar shows the current
  multiplier in bold dark red, so the rising cost stays visible outside Shop.
  Shop explains the escape route: local Spark and Spark Ultra execution is
  token-free, but Mercury handoffs are not. Disable Mercury, drag assignments to
  local terminals, and return artifacts to Messenger manually to avoid those
  fees. Energy decay continues while Mercury is disabled.

- Some time later(like ≈1m?), Mapple announces another local LLM machine (Mapple
  Spark Ultra) that costs \$100k, with intelligence=3. Same delivery delay
  applies too. It'll be helpful after the user is lacking cloud based tokens.

- Purchasing Mercury immediately unlocks the clapper-board Shorts app. With
  automation handling the work, the player has something to doomscroll.
  The mobile-like feed scrolls continuously in both directions without a
  visible scrollbar or a finite catalog counter.

- When energy goes to 0, the player defeats. The end message is like "the user got
  to depression".

- Reaching \$4.242M in liquid net worth records a victory. “Keep playing” resumes
  the same run beyond that target without resetting progress or repeating the win.

## Localization

- English, German, French, Spanish, Japanese, and Korean are available from the
  globe picker aligned with the top-right widgets. Language names remain native.
  A saved explicit choice wins; otherwise the first supported browser language
  is selected, including regional variants. Unsupported preferences fall back
  to English. Unavailable browser storage does not prevent session-only changes.
- The dedicated language menu matches the translucent cream-and-purple widgets,
  with a checkmark for the active language. Its popover uses the browser's top
  layer so desktop windows cannot cover its options. Arrow keys and Home/End
  move focus; Enter/Space select; Escape restores focus to the globe. Tab and
  outside clicks dismiss the menu without trapping focus. Options remain
  touch-sized on narrow screens.
- Changing language preserves the current run, window state, task and dialogue
  history, and the current Shorts media element. Number, currency, and time
  formatting follows the selected locale. Brands, company and model names,
  technical code, and player-entered application text are not translated.
  Sample application pitches are translated when inserted into the form.
- `src/i18n/catalogs/en.ts` defines the message-key schema. Every shipped locale
  implements the complete `Catalog`; catalog tests reject missing or blank
  entries and interpolation-placeholder mismatches. English remains the runtime
  fallback. Rich messages interpolate React nodes without parsing HTML.
- Durable game messages store keys and parameters rather than translated prose.
  Nested `MessageReference` values are resolved at render time, so existing
  task titles and failure explanations follow language changes too.
- Cached `Intl.NumberFormat` instances are keyed by both locale and options.
  React Compiler can retain the formatter map across locale changes; an
  options-only cache key would leave existing counters in the previous locale.

## Implementation and balance notes

- Mercury ownership gates the inactivity clock; disabling its automatic handoffs
  does not pause energy decay. Purchasing Mercury resets the idle timer and
  penalty ramp through the normal purchase interaction, without retroactive
  pre-purchase penalties or refilling energy to maximum. The decay curve still
  uses total game time, not time since purchase. Application submission costs,
  task deadlines, wages, and token rules remain unchanged.
- Automatic token purchases consider pending assignment/retry costs and reserved
  Mercury return fees, not just balances below 1M. They still buy the selected
  pack at most once per simulation second, using the current price and available
  cash. A capacity-only blockage does not cause an otherwise unnecessary refill.
- Monopoly starts 360 seconds after the frontier model unlock. Spark Ultra is
  announced 60 seconds later; orders open after another 10 seconds. Its price
  remains $100,000, with the same 15–60 second delivery rule as Spark.
- Execution, deadline budgets, and assignment cadence are about 3× longer.
  Task-count gates are correspondingly reduced: incentives 2; L4 17; Fast mode
  2 architecture tasks; Market 18 total plus 3 architecture tasks; second job
  33 combined tasks; L5 27 per job after the second-career unlock; frontier
  65 combined tasks with a second job. Checkpoints remain earned, not timer-gated.
- Rewards per difficulty are 15 instead of 5, compensating for fewer deliveries.
  L4/L5 multipliers remain 100×/600×, as do model/token multipliers and purchase
  prices other than YOLO. Base wages are \$15/s per job, with the same rate used
  in boss income projection. Without other spending, wages fund the first \$200
  split after 14 seconds.
- YOLO's \$2,222 price and \$15/s wage target a median purchase at 3:00 ±45s
  after hiring. An earlier 64-seed real-reducer calibration measured 217.5s (3:37.5),
  ranging from 211–223.5s, with every run reaching YOLO. The policy uses serialized
  2s actions, 2.5s approval reactions, all three primary split upgrades before
  YOLO, and legal social token recovery without artificial cash or token grants.
  Price reduction alone at the old \$5/s wage measured a 326.25s median.
  Across the same 64 seeds, buying only one split before YOLO gives a 145s median
  (140–149.5s); buying all splits with slower 3s actions gives a 220.25s median
  (214.5–228.5s). All policy medians fit the target; individual slower-action runs
  can exceed 225s. No run failed before YOLO, and pre-Mercury energy stayed intact.
  Other purchase orders and reaction times can shift the checkpoint; this is a
  simulation benchmark, not a human playtest or a scripted unlock timer.
- Follow-up pacing controls use 32 seeds each at serialized 2s and 4s action
  cadences, cloud Fast mode, YOLO on every terminal, and priority energy recovery.
  Moving Frontier from 97 to 65 tasks reduces median second-job-to-Frontier gaps
  from 535/506s to 257/228s. The longer monopoly delay preserves its approximate
  arrival: medians move from 1186/1244s to 1180/1238s.
  During minutes 10–20, Shorts actions fall from 5.68/5.33 to 2.24/2.54 per minute.
  These controls keep Mercury enabled through monopoly and do not trade; they
  are pacing benchmarks, not human win rates. Deadline rules remain unchanged.
- Mercury 2.0 calibration uses the same 32-seed 2s/4s Fast-mode control policies,
  adding only the paid upgrade purchase after second-job acceptance. Wins rise
  from 1/32 and 0/32 without the upgrade to 20/32 and 13/32 with it; no upgraded
  run loses before monopoly. These remain automated policy comparisons, not
  human win-rate estimates. All 64 controls could afford $50,000 at introduction:
  median cash at second-job acceptance was $108,648 / $225,057.50.
- The $4.242M victory threshold includes cash, trading USD, and BTC at its current
  market price, without double-counting transfers. Winning pauses only until
  acknowledgment; the achievement remains recorded during continued play.
  Ordinary deadline and energy-loss rules still apply. Loss ends the run.
- Shorts shuffles four remotely hosted GIPHY MP4 meme loops and keeps three
  clip-keyed cards for bounded infinite scrolling. Both neighboring videos
  preload before navigation; moving a clip to the center preserves its media
  element. Only the current foreground clip plays. Each settled user transition
  increments the viewing count and restores 5 energy once; playback, focus,
  resizing, and internal recentering do not. Clips retain their source links.
  Media failures show an explicit error and source link rather than an unloaded
  placeholder; playback still depends on GIPHY availability.
- Default-open and already-focused apps do not bounce in the dock. Unseen
  background updates and newly available unopened apps can still attract attention.
  Each terminal approval checkpoint and blocked state counts as a fresh update;
  focusing the terminal acknowledges it, without suppressing later checkpoints.
- Every window resizes from all four edges and corners with directional cursors.
  The opposite edge stays anchored at minimum-size and screen-boundary limits.
  The lower-right handle remains the single keyboard resize control: arrow keys
  change size by 8 pixels, or 32 with Shift. Title-bar dragging is unchanged.
- Messenger and timeline updates use distinct original synthesized notification
  chimes, not copied phone recordings. Both respect the existing sound mute.
- The New game button wiggles continuously while hovered and stops on pointer
  leave; reduced-motion preferences disable the loop.
- SNS Like feedback follows the actual giveaway result without changing odds:
  misses shake the button sideways; successful token resets emit a short
  heart-and-sparkle burst. Repeated likes restart bounded feedback without
  moving keyboard focus. Reduced motion skips shaking and keeps the stationary
  success fade. The watercooler social action uses high-contrast text.
