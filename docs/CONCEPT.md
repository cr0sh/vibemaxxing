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
- You've got hired to *INSERT RANDOM COMPANY NAME HERE FROM A LIST*
  - You now have two windows. Messenger(slack-like purple theme) and Terminal
  - Your boss pings you every 120+-30 seconds with the messenger. You should press "check" emoji
    reaction in 30 seconds.
  - Your boss gives you tasks (shown like an attachment in the messenger UI).
    This is given right after you are hired, and every 2 minutes. You can
    drag-and-drop this attachment onto terminal.
  - The terminal is running a coding agent. It should resemble like Claude Code.
    When idle, attachments can be drag-and-dropped onto it and it'll be
    "working". The UI should show something like *thinking...* or something
    other random placeholders from a list(like CC does). When it's done working, the terminal shows the
    "artifact" as the box like the attachment in the messenger UI, which can
    also be drag-and-dropped back to the messenger. It concludes the task.
  - The boss will be angry when you fail to deliver the artifact in the deadline
    that the boss specified. You'll lose.
  - The boss pays you \$1 every second.
- The terminal can be "upgraded" with several features. Features are purchased
  by drag-and-dropping the item icon from the shop UI to the terminal.
  - Split window(\$20, $40, $100): The window can be split at max 4. Agents
    can run simultaneously.
  - Yolo mode($42): By default, the terminal asks for command approval(yes/no) for
    confirmation, randomly every 1-5 seconds. This lifts the restriction.
    Applies to window-wise. The terminal window border shines with rainbow color
    animation.
  - Multi-window($100): One more window. The split window upgrade costs double
    here, \$40/\$80/\$200 each.
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

