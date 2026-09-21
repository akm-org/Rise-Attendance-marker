# Discord Attendance Bot v2.0 — Gateway Fix

This build diagnoses and fixes the startup path that was hanging at:

`Preparing to connect to the gateway...`

### Changes

- Pins Render to Node.js 22.x.
- Uses discord.js 14.25.1 exactly.
- Tests unauthenticated Discord `/gateway`.
- Tests authenticated `/gateway/bot` using the configured bot token.
- Opens a raw WebSocket directly to Discord and waits for the Hello packet.
- Only after those checks pass does it start discord.js.
- Restores the required Guilds + GuildMembers + GuildPresences intents for the actual client.
- Adds Gateway/shard diagnostics.
- Keeps the Render HTTP health endpoint.

### Render

Build:
`npm install`

Start:
`npm start`

Environment:
`DISCORD_TOKEN=...`
`GUILD_ID=...`

### Important

Do not expose the actual Discord bot token in chat or screenshots. If the token shown in any log is a real usable token, regenerate it in Discord Developer Portal and update Render immediately.

### Expected

The startup should show:

`✅ Discord Gateway URL...`
`✅ Gateway URL from authenticated endpoint...`
`✅ RAW WEBSOCKET OPENED`
`✅ DISCORD HELLO RECEIVED...`
`🎉 PRE-FLIGHT PASSED`
`✅ DISCORD READY`
`🎉 DISCORD LOGIN SUCCESSFUL — BOT IS ONLINE`

If the raw WebSocket fails, the error will now identify the network/Gateway stage directly.
