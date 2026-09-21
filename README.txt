ENDER SHARDS CONTROL PANEL V12

This version adds a Discord DM control center using buttons and dropdown menus.

SETUP
1. Install Node.js LTS.
2. Run start.bat.
3. Open http://localhost:3000.
4. Add Minecraft bots in the panel.
5. In Discord Control enter your Discord bot token and YOUR Discord User ID.
6. Save & Connect.

DISCORD OWNER DM CONTROL
The bot uses no Guild ID or Channel ID. Controls are restricted to Owner User ID and DM interactions.

When the Discord bot connects, it automatically sends the owner a private control panel with:
- Minecraft bot dropdown
- Bot Management category
- Economy category
- Minecraft category
- Logs & Information category
- Buttons for start/stop/reconnect/status
- Balance and Auto-Pay ON/OFF
- AFK ON/OFF
- /spawn, /home, /balance buttons
- Custom Minecraft command modal for anything else
- Recent logs

The Discord status message is updated every 60 seconds and edited instead of creating a new message each minute.

SLASH COMMANDS
The previous slash commands remain available in DMs for compatibility, plus /panel to reopen the interactive panel.

SECURITY
- Only Owner User ID is authorized.
- Guild/server commands are rejected.
- Discord token is stored locally in discord.csv.
- Minecraft credentials are stored locally in bots.csv.
- Do not upload bots.csv or discord.csv to GitHub.
