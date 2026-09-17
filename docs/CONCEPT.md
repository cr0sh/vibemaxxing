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
  - Your boss pings you every 120+-30 seconds with the messenger. You should press "check" emoji
    reaction in 30 seconds.
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
  - The boss pays you \$1 every second.
- The terminal can be "upgraded" with several features. Features are purchased
  by drag-and-dropping the item icon from the shop UI to the terminal.
  - Split window(\$200, $400, $1000): The window can be split at max 4. Agents
    can run simultaneously.
  - Yolo mode($420): By default, the terminal asks for command approval(yes/no) for
    confirmation, randomly every 1-5 seconds. This lifts the restriction.
    Applies to window-wise. The terminal window border shines with rainbow color
    animation.
  - Multi-window($1000): One more window. The split window upgrade costs double
    here, \$400/\$800/\$2000 each.
- The boss has an internal "expectation" value which represents the user's speed
  of resolving the tasks each. The tasks each has a random "difficulty" value
  here and the deadline is `1.5 * difficulty / expectation` in seconds. The expectation
  value is updated based on the observed speed of player's resolving.
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
