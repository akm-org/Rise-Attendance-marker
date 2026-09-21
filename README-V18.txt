
ENDER SHARDS V18

New:
- Inventory monitor remains live.
- Preset selection is visually highlighted (FARM / SAFE / SELL).
- FARM MODE and SELL MODE use a random autosell delay between 30 seconds and 5 minutes.
- Random interval can be toggled per bot from the localhost panel or Discord.
- Fixed base interval can still be selected when random mode is OFF.
- Discord gets a Player List screenshot action.
- Local panel has a PLAYER LIST button that opens a screenshot-style PNG of the current online players visible to the selected Minecraft bot.
- Player-list image includes player names, ping, count, server and bot information.
- Discord final actions return to the main bot selector.
- Category screens retain Back/Home navigation.
- Discord command output continues to be sent to the owner's DM when server responses are received.
- One Discord token + Owner User ID remains shared across all Minecraft bots.

PLAYER LIST NOTE
The generated image is a screenshot-style player-list report based on the online player/tab-list data visible to Mineflayer. It is not a camera screenshot of the Minecraft world.

SHARP
The player-list PNG renderer uses the sharp Node package. start.bat installs dependencies automatically with npm install.
