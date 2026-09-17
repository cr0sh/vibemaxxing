# Design Guidelines

The main UI should look like "macOS", but should not be the direct copy which
might incur copyright issues. Just a parody level.

A dock UI at the bottom should be a way to pick "window"s.

Each windows should have the similar modern macOS look-and-feel.

Most icons should represent itself with Emoji.

Most UIs should be "animated" and "fancy", like what TikTok kids would want.

Should bring enough "dopamine" playing the game. Make dynamic UIs

The game UI should stay game-like: NEVER ADD placeholder catchphrases, marketing copy, article or Markdown-like sections, or explanatory landing-page framing (for example, "This is a welcome preview"). Use concise in-world controls and messages instead. Keep in mind this is a game, not a dashboard nor article. Desktop windows are movable, and the dock is a classic shallow reflective glass shelf with icons resting on it. Resource and date/time widgets should read as compact desktop widgets rather than a global title bar or status bar.

Drag-and-drop guidance is contextual, never permanent filler. Hovering or focusing a draggable task, artifact, or shop upgrade, and beginning a native drag, reveals one concise overlay over the whole eligible destination window. A task overlay names the terminal window with an idle agent slot; an artifact overlay names Messenger; an upgrade overlay names the terminal window that can accept it. The overlay is pointer-transparent so the existing terminal pane drop handler can choose the idle slot. Empty terminal canvases show only their normal status/cursor until a relevant source is hovered or dragged. Clear hints on source leave (unless a native drag is active), drop, drag end, Escape, and unmount. Keep the game-only rule above: do not turn these overlays into marketing copy, placeholder sections, or dashboard instructions.
