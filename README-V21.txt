ENDER SHARDS V21

Changes:
- Added real Discord /list slash command (DM + owner only).
- /list executes the Minecraft /list command and sends the same PNG player-list screenshot used by the localhost panel to the owner's Discord DM.
- Added Discord /list command output handling with a Home button.
- Autosell /list command path now waits for the screenshot send instead of scheduling an untracked duplicate task.
- Improved Mineflayer connection stability: keepAlive enabled and client timeout check raised to 180 seconds.
- Added a lightweight 15-second movement/look heartbeat so idle connections continue producing normal client movement packets.
- AFK look interval changed to 30 seconds and movement interval to 45 seconds.
- Heartbeat timers are cleaned up on bot removal and shutdown.
- Disconnect/kick logs now include a short reason.

Important:
The bot still respects the 60-second global join/reconnect gate. A server-side UAB/AuthMe/proxy can still disconnect a client; this version does not bypass those protections. The new heartbeat is intended to prevent client-side idle/timeout behavior and make the connection more stable.

Discord /list may take some time to appear after command registration because Discord global application-command propagation is not always instant.
