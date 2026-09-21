ENDER SHARDS V24

Changes:
- Removed random autosell intervals.
- Autosell is now inventory-threshold driven.
- Default threshold: 50% of the 36 inventory slots (18 occupied slots).
- Threshold options in the localhost panel: 25%, 50%, 75%, 90%, 100%.
- When threshold is reached, autosell opens /sellgui and moves all sellable inventory into the GUI.
- Threshold monitoring continues after reconnect/login.
- After 5 consecutive sell failures, the bot still reconnects after 60 seconds and autosell remains enabled.
- Discord has /list as a real DM slash command and a direct /list text fallback.
- Discord also has /threshold <bot> <percent>.
- Discord /list sends the player-list screenshot to the owner DM.
- No random autosell timer is used.

Start:
1. Keep your existing bots.csv and discord.csv in this folder if you already have them.
2. Run start.bat.
3. Open http://localhost:3000
